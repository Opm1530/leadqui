import axios from "axios";
import prisma from "./prisma";
import { getCompanySettings } from "./companySettings";

export async function evolutionConfig(): Promise<{ baseUrl: string; apiKey: string } | null> {
  const s = (await getCompanySettings()) as any;
  if (!s?.evolution_api_url || !s?.evolution_api_key) return null;
  return { baseUrl: s.evolution_api_url.replace(/\/$/, ""), apiKey: s.evolution_api_key };
}

// Envia texto por uma instância Evolution para um JID (grupo ou contato). Retorna o payload da Evolution.
export async function sendWhatsappText(instance: string, jid: string, text: string): Promise<any> {
  const cfg = await evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada.");
  const r = await axios.post(
    `${cfg.baseUrl}/message/sendText/${instance}`,
    { number: jid, text },
    { headers: { apikey: cfg.apiKey }, timeout: 30000 }
  );
  return r.data;
}

// Upsert da conversa + cria a mensagem. Usado pelo webhook (entrada) e pelo envio (saída).
export async function recordMessage(opts: {
  instance: string;
  chatJid: string;
  text: string;
  fromMe: boolean;
  waMessageId?: string | null;
  authorName?: string | null;
  authorUserId?: string | null;
  name?: string | null;
  timestamp?: Date;
}) {
  const isGroup = opts.chatJid.endsWith("@g.us");
  const ts = opts.timestamp || new Date();

  // Vincula a um cliente se o grupo/contato bater
  let client_id: string | null = null;
  if (isGroup) {
    const c = await (prisma as any).client.findFirst({ where: { wa_group_id: opts.chatJid }, select: { id: true } });
    if (c) client_id = c.id;
  }

  const conv = await (prisma as any).whatsappConversation.upsert({
    where: { instance_chat_jid: { instance: opts.instance, chat_jid: opts.chatJid } },
    create: {
      instance: opts.instance,
      chat_jid: opts.chatJid,
      is_group: isGroup,
      name: opts.name || null,
      client_id,
      last_message_text: opts.text.slice(0, 200),
      last_message_at: ts,
      unread: opts.fromMe ? 0 : 1,
    },
    update: {
      ...(opts.name ? { name: opts.name } : {}),
      ...(client_id ? { client_id } : {}),
      last_message_text: opts.text.slice(0, 200),
      last_message_at: ts,
      ...(opts.fromMe ? {} : { unread: { increment: 1 } }),
    },
  });

  // Dedup por id da mensagem do WhatsApp
  if (opts.waMessageId) {
    const existing = await (prisma as any).whatsappMessage.findFirst({
      where: { conversation_id: conv.id, wa_message_id: opts.waMessageId },
      select: { id: true },
    });
    if (existing) return conv;
  }

  await (prisma as any).whatsappMessage.create({
    data: {
      conversation_id: conv.id,
      wa_message_id: opts.waMessageId || null,
      direction: opts.fromMe ? "OUT" : "IN",
      from_me: opts.fromMe,
      author_name: opts.authorName || null,
      author_user_id: opts.authorUserId || null,
      text: opts.text,
      timestamp: ts,
    },
  });

  return conv;
}
