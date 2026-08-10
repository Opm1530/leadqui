import axios from "axios";
import prisma from "./prisma";
import { getCompanySettings } from "./companySettings";

// ── Mídia ─────────────────────────────────────────────────────────────
// Detecta o tipo de mídia numa mensagem do Evolution.
export function detectMedia(data: any): { type: string; mime?: string; name?: string } | null {
  const m = data?.message || {};
  if (m.imageMessage) return { type: "image", mime: m.imageMessage.mimetype, name: "imagem.jpg" };
  if (m.videoMessage) return { type: "video", mime: m.videoMessage.mimetype, name: "video.mp4" };
  if (m.audioMessage) return { type: "audio", mime: m.audioMessage.mimetype, name: "audio.ogg" };
  if (m.stickerMessage) return { type: "sticker", mime: m.stickerMessage.mimetype, name: "sticker.webp" };
  if (m.documentMessage) return { type: "document", mime: m.documentMessage.mimetype, name: m.documentMessage.fileName || "arquivo" };
  return null;
}

// Baixa a mídia da mensagem (base64) via Evolution.
export async function fetchMediaBase64(instance: string, data: any): Promise<{ buffer: Buffer; mime?: string } | null> {
  const cfg = await evolutionConfig();
  if (!cfg) return null;
  try {
    const r = await axios.post(
      `${cfg.baseUrl}/chat/getBase64FromMediaMessage/${instance}`,
      { message: { key: data.key }, convertToMp4: false },
      { headers: { apikey: cfg.apiKey }, timeout: 90000 }
    );
    const b64 = r.data?.base64 || r.data?.media || (typeof r.data === "string" ? r.data : null);
    if (!b64 || typeof b64 !== "string") return null;
    return { buffer: Buffer.from(b64, "base64"), mime: r.data?.mimetype };
  } catch { return null; }
}

// Envia mídia por URL pública via Evolution.
export async function sendWhatsappMedia(instance: string, jid: string, mediatype: string, url: string, opts: { caption?: string; fileName?: string } = {}): Promise<any> {
  const cfg = await evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada.");
  const r = await axios.post(
    `${cfg.baseUrl}/message/sendMedia/${instance}`,
    { number: jid, mediatype, media: url, caption: opts.caption || undefined, fileName: opts.fileName || undefined },
    { headers: { apikey: cfg.apiKey }, timeout: 60000 }
  );
  return r.data;
}

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

// ── Filtro: só instâncias marcadas alimentam o inbox (cache 30s) ──────
let enabledCache: { at: number; set: Set<string> } | null = null;
export async function isInboxInstance(instance: string): Promise<boolean> {
  if (!enabledCache || Date.now() - enabledCache.at > 30000) {
    const rows = await (prisma as any).instance.findMany({ where: { inbox_enabled: true }, select: { evolution_instance_id: true } });
    enabledCache = { at: Date.now(), set: new Set(rows.map((r: any) => r.evolution_instance_id)) };
  }
  return enabledCache.set.has(instance);
}
export function clearInboxInstanceCache() { enabledCache = null; }

// ── Sincroniza nomes de grupos (o payload da msg não traz o subject) ──
const groupNameCache = new Map<string, { at: number; map: Map<string, string> }>();
async function fetchGroupNameMap(instance: string): Promise<Map<string, string>> {
  const cached = groupNameCache.get(instance);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.map;
  const cfg = await evolutionConfig();
  if (!cfg) return new Map();
  try {
    const r = await axios.get(`${cfg.baseUrl}/group/fetchAllGroups/${instance}`, { headers: { apikey: cfg.apiKey }, params: { getParticipants: "false" }, timeout: 60000 });
    const arr: any[] = Array.isArray(r.data) ? r.data : (r.data?.groups || []);
    const map = new Map<string, string>();
    for (const g of arr) { const id = g.id || g.jid; const name = g.subject || g.name; if (id && name) map.set(id, name); }
    groupNameCache.set(instance, { at: Date.now(), map });
    return map;
  } catch { return new Map(); }
}
export async function syncGroupNames(instances: string[]): Promise<void> {
  for (const inst of [...new Set(instances)]) {
    const map = await fetchGroupNameMap(inst);
    if (map.size === 0) continue;
    const unnamed = await (prisma as any).whatsappConversation.findMany({ where: { instance: inst, is_group: true, name: null }, select: { id: true, chat_jid: true } });
    for (const c of unnamed) { const nm = map.get(c.chat_jid); if (nm) await (prisma as any).whatsappConversation.update({ where: { id: c.id }, data: { name: nm } }).catch(() => {}); }
  }
}

// Upsert da conversa + cria a mensagem. Usado pelo webhook (entrada) e pelo envio (saída).
const MEDIA_LABEL: Record<string, string> = { image: "📷 Imagem", video: "🎬 Vídeo", audio: "🎵 Áudio", document: "📄 Documento", sticker: "Figurinha" };

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
  mediaType?: string | null;
  mediaKey?: string | null;
  mediaMime?: string | null;
  mediaName?: string | null;
}) {
  const isGroup = opts.chatJid.endsWith("@g.us");
  const ts = opts.timestamp || new Date();
  const preview = (opts.text || (opts.mediaType ? MEDIA_LABEL[opts.mediaType] || "Mídia" : "")).slice(0, 200);

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
      last_message_text: preview,
      last_message_at: ts,
      unread: opts.fromMe ? 0 : 1,
    },
    update: {
      ...(opts.name ? { name: opts.name } : {}),
      ...(client_id ? { client_id } : {}),
      last_message_text: preview,
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
      text: opts.text || null,
      media_type: opts.mediaType || null,
      media_key: opts.mediaKey || null,
      media_mime: opts.mediaMime || null,
      media_name: opts.mediaName || null,
      timestamp: ts,
    },
  });

  return conv;
}
