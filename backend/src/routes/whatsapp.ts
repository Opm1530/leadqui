import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendTextToClientGroup, onClientApproved, onClientRejected } from "../lib/approval";
import { classifyDemand } from "../lib/demandClassifier";

const router = Router();

// Extrai texto de um payload de mensagem do Evolution (vários formatos possíveis).
function extractText(data: any): string {
  const m = data?.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    // voto de enquete: nome da opção selecionada
    m.pollUpdateMessage?.vote?.selectedOptions?.[0] ||
    data?.pollVote?.selectedOptions?.[0] ||
    ""
  ).toString();
}

function isApprove(t: string): boolean {
  const s = t.toLowerCase();
  return /aprov|✅|👍|pode postar|ok\b|perfeito|ficou (bom|ótimo|otimo)/.test(s);
}
function isReject(t: string): boolean {
  const s = t.toLowerCase();
  return /reprov|❌|👎|n[ãa]o\b|ajust|trocar|mudar|corrig|refaz|refazer/.test(s);
}

// ── POST /api/whatsapp/webhook ────────────────────────────────────────
// Recebe eventos do Evolution. Configurado para o evento messages.upsert.
router.post("/webhook", async (req: Request, res: Response) => {
  res.sendStatus(200); // responde já
  try {
    const body = req.body || {};
    const data = body.data || body;
    // Ignora mensagens enviadas por nós mesmos
    if (data?.key?.fromMe) return;

    const groupJid: string = data?.key?.remoteJid || "";
    if (!groupJid.endsWith("@g.us")) return; // só grupos

    const text = extractText(data).trim();
    if (!text) return;

    // Acha o cliente vinculado a esse grupo
    const client = await prisma.client.findFirst({ where: { wa_group_id: groupJid } });
    if (!client) return;

    // Post mais recente aguardando aprovação desse cliente
    const post = await (prisma as any).calendarPost.findFirst({
      where: { client_id: client.id, status: "AGUARDANDO_APROVACAO" },
      orderBy: { approval_sent_at: "desc" },
    });
    // ── A) Contexto de aprovação de post ──────────────────────────────
    if (post) {
      // 1. Já estávamos aguardando o MOTIVO da reprovação → esta msg é o motivo
      if (post.awaiting_reason) {
        await (prisma as any).calendarPost.update({
          where: { id: post.id },
          data: { status: "PRODUZINDO", rejection_reason: text, awaiting_reason: false },
        });
        await onClientRejected(post, text);
        await sendTextToClientGroup(client, "Anotado! Vamos ajustar e te enviar de novo. 🙏");
        console.log(`[WhatsApp] Post ${post.id} reprovado. Motivo: ${text}`);
        return;
      }

      // 2. Decisão de aprovação
      if (isApprove(text) && !isReject(text)) {
        await (prisma as any).calendarPost.update({
          where: { id: post.id }, data: { status: "APROVADO" },
        });
        await onClientApproved(post);
        await sendTextToClientGroup(client, "Aprovado! ✅ Vamos agendar a publicação.");
        console.log(`[WhatsApp] Post ${post.id} APROVADO`);
        return;
      }

      if (isReject(text)) {
        const semKeyword = text.replace(/reprov\w*|n[ãa]o|❌|👎/gi, "").trim();
        if (semKeyword.length > 4) {
          await (prisma as any).calendarPost.update({
            where: { id: post.id },
            data: { status: "PRODUZINDO", rejection_reason: semKeyword, awaiting_reason: false },
          });
          await onClientRejected(post, semKeyword);
          await sendTextToClientGroup(client, "Anotado! Vamos ajustar e te enviar de novo. 🙏");
          console.log(`[WhatsApp] Post ${post.id} reprovado. Motivo: ${semKeyword}`);
        } else {
          await (prisma as any).calendarPost.update({
            where: { id: post.id }, data: { awaiting_reason: true },
          });
          await sendTextToClientGroup(client, "Sem problema! Pode me dizer o que você gostaria de ajustar? ✍️");
          console.log(`[WhatsApp] Post ${post.id} reprovado, aguardando motivo`);
        }
        return;
      }
    }

    // ── B) Captação de demandas (bot atendente silencioso) ────────────
    // Mensagem não consumida pela aprovação → IA decide se é demanda.
    const sender = data?.pushName || data?.key?.participant || "";
    const result = await classifyDemand(text);
    if (result?.is_demand && result.summary) {
      await (prisma as any).demand.create({
        data: {
          client_id: client.id,
          group_jid: groupJid,
          sender: String(sender).slice(0, 80),
          original_text: text.slice(0, 2000),
          summary: result.summary.slice(0, 500),
          category: result.category || "OUTRO",
          status: "NOVA",
        },
      });
      console.log(`[Demanda] ${client.name}: ${result.summary}`);
    }
  } catch (e: any) {
    console.error("[WhatsApp Webhook] erro:", e.message);
  }
});

export default router;
