import axios from "axios";
import prisma from "./prisma";
import { getCompanySettings } from "./companySettings";

// Resolve URL/key do Evolution + o id da instância vinculada ao cliente.
async function evolutionForClient(client: any): Promise<{ baseUrl: string; apiKey: string; instance: string } | null> {
  if (!client?.wa_instance_id || !client?.wa_group_id) return null;
  const settings = await getCompanySettings();
  if (!(settings as any)?.evolution_api_url || !(settings as any)?.evolution_api_key) return null;
  const instance = await prisma.instance.findUnique({ where: { id: client.wa_instance_id } });
  if (!instance) return null;
  return {
    baseUrl: (settings as any).evolution_api_url.replace(/\/$/, ""),
    apiKey: (settings as any).evolution_api_key,
    instance: instance.evolution_instance_id,
  };
}

const TIPO_LABEL: Record<string, string> = {
  POST: "Post", STORY: "Story", REEL: "Reels", CARROSSEL: "Carrossel", AD: "Anúncio",
};

// Envia a arte + legenda + enquete de aprovação para o grupo do cliente.
// Retorna true se enviou.
export async function sendApprovalToGroup(postId: string): Promise<boolean> {
  const post = await (prisma as any).calendarPost.findUnique({
    where: { id: postId },
    include: { client: true },
  });
  if (!post) throw new Error("Post não encontrado");

  const ev = await evolutionForClient(post.client);
  if (!ev) throw new Error("Cliente sem grupo de WhatsApp vinculado ou Evolution não configurado.");

  const grupo = post.client.wa_group_id;
  const dataBR = new Date(post.scheduled_date).toLocaleDateString("pt-BR");
  const legenda = `*${TIPO_LABEL[post.type] || post.type}* — ${dataBR}\n\n${post.title || "(sem título)"}\n\n${post.content || ""}`.trim();

  let medias: string[] = [];
  try { medias = post.media_urls ? JSON.parse(post.media_urls) : []; } catch {}

  const headers = { apikey: ev.apiKey, "Content-Type": "application/json" };

  // 1. Envia a arte (primeira mídia) com a legenda; se não houver, manda texto.
  try {
    if (medias.length) {
      const url = medias[0];
      const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
      await axios.post(`${ev.baseUrl}/message/sendMedia/${ev.instance}`, {
        number: grupo,
        mediatype: isVideo ? "video" : "image",
        media: url,
        caption: legenda,
      }, { headers });
    } else {
      await axios.post(`${ev.baseUrl}/message/sendText/${ev.instance}`, {
        number: grupo, text: legenda,
      }, { headers });
    }
  } catch (e: any) {
    console.error("[Aprovação] erro ao enviar mídia:", e.response?.data || e.message);
    throw new Error("Falha ao enviar a arte no grupo.");
  }

  // 2. Envia a enquete Sim/Não.
  try {
    await axios.post(`${ev.baseUrl}/message/sendPoll/${ev.instance}`, {
      number: grupo,
      name: "Aprova este conteúdo?",
      selectableCount: 1,
      values: ["✅ Aprovar", "❌ Reprovar"],
    }, { headers });
  } catch (e: any) {
    // Fallback: instrução por texto, caso enquete não seja suportada.
    console.warn("[Aprovação] enquete falhou, usando texto:", e.response?.data || e.message);
    await axios.post(`${ev.baseUrl}/message/sendText/${ev.instance}`, {
      number: grupo,
      text: "Responda *APROVADO* para aprovar ou *REPROVADO* (com o motivo) para ajustes.",
    }, { headers });
  }

  await (prisma as any).calendarPost.update({
    where: { id: postId },
    data: { status: "AGUARDANDO_APROVACAO", approval_sent_at: new Date(), awaiting_reason: false },
  });
  return true;
}

// Envia uma mensagem de texto simples para o grupo de um cliente.
export async function sendTextToClientGroup(client: any, text: string): Promise<void> {
  const ev = await evolutionForClient(client);
  if (!ev) return;
  try {
    await axios.post(`${ev.baseUrl}/message/sendText/${ev.instance}`,
      { number: client.wa_group_id, text },
      { headers: { apikey: ev.apiKey, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.warn("[Aprovação] erro ao enviar texto:", e.response?.data || e.message);
  }
}
