"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMedia = detectMedia;
exports.fetchMediaBase64 = fetchMediaBase64;
exports.sendWhatsappAudio = sendWhatsappAudio;
exports.sendWhatsappMedia = sendWhatsappMedia;
exports.evolutionConfig = evolutionConfig;
exports.sendWhatsappText = sendWhatsappText;
exports.isInboxInstance = isInboxInstance;
exports.clearInboxInstanceCache = clearInboxInstanceCache;
exports.syncGroupNames = syncGroupNames;
exports.recordMessage = recordMessage;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("./prisma"));
const companySettings_1 = require("./companySettings");
// ── Mídia ─────────────────────────────────────────────────────────────
// Detecta o tipo de mídia numa mensagem do Evolution.
function detectMedia(data) {
    const m = data?.message || {};
    if (m.imageMessage)
        return { type: "image", mime: m.imageMessage.mimetype, name: "imagem.jpg" };
    if (m.videoMessage)
        return { type: "video", mime: m.videoMessage.mimetype, name: "video.mp4" };
    if (m.audioMessage)
        return { type: "audio", mime: m.audioMessage.mimetype, name: "audio.ogg" };
    if (m.stickerMessage)
        return { type: "sticker", mime: m.stickerMessage.mimetype, name: "sticker.webp" };
    if (m.documentMessage)
        return { type: "document", mime: m.documentMessage.mimetype, name: m.documentMessage.fileName || "arquivo" };
    return null;
}
// Baixa a mídia da mensagem (base64) via Evolution.
async function fetchMediaBase64(instance, data) {
    const cfg = await evolutionConfig();
    if (!cfg)
        return null;
    try {
        const r = await axios_1.default.post(`${cfg.baseUrl}/chat/getBase64FromMediaMessage/${instance}`, { message: { key: data.key }, convertToMp4: false }, { headers: { apikey: cfg.apiKey }, timeout: 90000 });
        const b64 = r.data?.base64 || r.data?.media || (typeof r.data === "string" ? r.data : null);
        if (!b64 || typeof b64 !== "string")
            return null;
        return { buffer: Buffer.from(b64, "base64"), mime: r.data?.mimetype };
    }
    catch {
        return null;
    }
}
// Envia áudio como mensagem de voz (ptt) via Evolution.
async function sendWhatsappAudio(instance, jid, base64) {
    const cfg = await evolutionConfig();
    if (!cfg)
        throw new Error("Evolution API não configurada.");
    const r = await axios_1.default.post(`${cfg.baseUrl}/message/sendWhatsAppAudio/${instance}`, { number: jid, audio: base64 }, { headers: { apikey: cfg.apiKey }, timeout: 60000 });
    return r.data;
}
// Envia mídia por URL pública via Evolution.
async function sendWhatsappMedia(instance, jid, mediatype, url, opts = {}) {
    const cfg = await evolutionConfig();
    if (!cfg)
        throw new Error("Evolution API não configurada.");
    const r = await axios_1.default.post(`${cfg.baseUrl}/message/sendMedia/${instance}`, { number: jid, mediatype, media: url, caption: opts.caption || undefined, fileName: opts.fileName || undefined }, { headers: { apikey: cfg.apiKey }, timeout: 60000 });
    return r.data;
}
async function evolutionConfig() {
    const s = (await (0, companySettings_1.getCompanySettings)());
    if (!s?.evolution_api_url || !s?.evolution_api_key)
        return null;
    return { baseUrl: s.evolution_api_url.replace(/\/$/, ""), apiKey: s.evolution_api_key };
}
// Envia texto por uma instância Evolution para um JID (grupo ou contato). Retorna o payload da Evolution.
async function sendWhatsappText(instance, jid, text) {
    const cfg = await evolutionConfig();
    if (!cfg)
        throw new Error("Evolution API não configurada.");
    const r = await axios_1.default.post(`${cfg.baseUrl}/message/sendText/${instance}`, { number: jid, text }, { headers: { apikey: cfg.apiKey }, timeout: 30000 });
    return r.data;
}
// ── Filtro: só instâncias marcadas alimentam o inbox (cache 30s) ──────
let enabledCache = null;
async function isInboxInstance(instance) {
    if (!enabledCache || Date.now() - enabledCache.at > 30000) {
        const rows = await prisma_1.default.instance.findMany({ where: { inbox_enabled: true }, select: { evolution_instance_id: true } });
        enabledCache = { at: Date.now(), set: new Set(rows.map((r) => r.evolution_instance_id)) };
    }
    return enabledCache.set.has(instance);
}
function clearInboxInstanceCache() { enabledCache = null; }
// ── Sincroniza nomes de grupos (o payload da msg não traz o subject) ──
const groupNameCache = new Map();
async function fetchGroupNameMap(instance) {
    const cached = groupNameCache.get(instance);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000)
        return cached.map;
    const cfg = await evolutionConfig();
    if (!cfg)
        return new Map();
    try {
        const r = await axios_1.default.get(`${cfg.baseUrl}/group/fetchAllGroups/${instance}`, { headers: { apikey: cfg.apiKey }, params: { getParticipants: "false" }, timeout: 60000 });
        const arr = Array.isArray(r.data) ? r.data : (r.data?.groups || []);
        const map = new Map();
        for (const g of arr) {
            const id = g.id || g.jid;
            const name = g.subject || g.name;
            if (id && name)
                map.set(id, name);
        }
        groupNameCache.set(instance, { at: Date.now(), map });
        return map;
    }
    catch {
        return new Map();
    }
}
async function syncGroupNames(instances) {
    for (const inst of [...new Set(instances)]) {
        const map = await fetchGroupNameMap(inst);
        if (map.size === 0)
            continue;
        const unnamed = await prisma_1.default.whatsappConversation.findMany({ where: { instance: inst, is_group: true, name: null }, select: { id: true, chat_jid: true } });
        for (const c of unnamed) {
            const nm = map.get(c.chat_jid);
            if (nm)
                await prisma_1.default.whatsappConversation.update({ where: { id: c.id }, data: { name: nm } }).catch(() => { });
        }
    }
}
// Upsert da conversa + cria a mensagem. Usado pelo webhook (entrada) e pelo envio (saída).
const MEDIA_LABEL = { image: "📷 Imagem", video: "🎬 Vídeo", audio: "🎵 Áudio", document: "📄 Documento", sticker: "Figurinha" };
async function recordMessage(opts) {
    const isGroup = opts.chatJid.endsWith("@g.us");
    const ts = opts.timestamp || new Date();
    const preview = (opts.text || (opts.mediaType ? MEDIA_LABEL[opts.mediaType] || "Mídia" : "")).slice(0, 200);
    // Vincula a um cliente se o grupo/contato bater
    let client_id = null;
    if (isGroup) {
        const c = await prisma_1.default.client.findFirst({ where: { wa_group_id: opts.chatJid }, select: { id: true } });
        if (c)
            client_id = c.id;
    }
    const conv = await prisma_1.default.whatsappConversation.upsert({
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
        const existing = await prisma_1.default.whatsappMessage.findFirst({
            where: { conversation_id: conv.id, wa_message_id: opts.waMessageId },
            select: { id: true },
        });
        if (existing)
            return conv;
    }
    await prisma_1.default.whatsappMessage.create({
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
//# sourceMappingURL=whatsapp.js.map