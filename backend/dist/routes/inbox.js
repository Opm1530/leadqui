"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const whatsapp_1 = require("../lib/whatsapp");
const storage_1 = require("../lib/storage");
const router = (0, express_1.Router)();
const mediaUpload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } }); // 60MB
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireAdmin);
const mediatypeFromMime = (mime) => {
    if (mime?.startsWith("image/"))
        return "image";
    if (mime?.startsWith("video/"))
        return "video";
    if (mime?.startsWith("audio/"))
        return "audio";
    return "document";
};
// ── GET /api/inbox/conversations ──────────────────────────────────────
// Lista as conversas (mais recentes primeiro), com nome do cliente vinculado.
router.get("/conversations", async (req, res) => {
    try {
        const showArchived = req.query.archived === "1";
        // Preenche nomes de grupos que ainda não têm (lazy sync, com cache interno)
        const unnamed = await prisma_1.default.whatsappConversation.findMany({ where: { is_group: true, name: null }, select: { instance: true }, distinct: ["instance"] });
        if (unnamed.length)
            await (0, whatsapp_1.syncGroupNames)(unnamed.map((u) => u.instance));
        const convs = await prisma_1.default.whatsappConversation.findMany({
            where: { archived: showArchived },
            orderBy: { last_message_at: "desc" },
            take: 200,
        });
        const clientIds = [...new Set(convs.map((c) => c.client_id).filter(Boolean))];
        const clients = clientIds.length
            ? await prisma_1.default.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
            : [];
        const cliMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
        const allTags = await prisma_1.default.whatsappTag.findMany();
        const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));
        let list = convs;
        if (req.query.tag)
            list = list.filter((c) => (c.tag_ids || []).includes(String(req.query.tag)));
        const conversations = list.map((c) => ({
            ...c,
            client_name: c.client_id ? cliMap[c.client_id] || null : null,
            tags: (c.tag_ids || []).map((id) => tagMap[id]).filter(Boolean),
        }));
        res.json({ conversations });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── GET /api/inbox/conversations/:id/messages ─────────────────────────
router.get("/conversations/:id/messages", async (req, res) => {
    try {
        const messages = await prisma_1.default.whatsappMessage.findMany({
            where: { conversation_id: String(req.params.id) },
            orderBy: { timestamp: "asc" },
            take: 500,
        });
        res.json({ messages });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/inbox/conversations/:id/read ────────────────────────────
router.post("/conversations/:id/read", async (req, res) => {
    try {
        await prisma_1.default.whatsappConversation.update({ where: { id: String(req.params.id) }, data: { unread: 0 } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/inbox/conversations/:id/archive ─────────────────────────
router.post("/conversations/:id/archive", async (req, res) => {
    try {
        const archived = req.body?.archived !== false; // default true
        await prisma_1.default.whatsappConversation.update({ where: { id: String(req.params.id) }, data: { archived } });
        res.json({ ok: true, archived });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/inbox/conversations/:id/send ────────────────────────────
router.post("/conversations/:id/send", async (req, res) => {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
        res.status(400).json({ error: "Mensagem vazia" });
        return;
    }
    try {
        const conv = await prisma_1.default.whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
        if (!conv) {
            res.status(404).json({ error: "Conversa não encontrada" });
            return;
        }
        const sent = await (0, whatsapp_1.sendWhatsappText)(conv.instance, conv.chat_jid, String(text).trim());
        const waId = sent?.key?.id || sent?.message?.key?.id || null;
        const me = await prisma_1.default.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        await (0, whatsapp_1.recordMessage)({
            instance: conv.instance,
            chatJid: conv.chat_jid,
            text: String(text).trim(),
            fromMe: true,
            waMessageId: waId,
            authorName: me?.name || null,
            authorUserId: req.user.id,
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message });
    }
});
// ── GET /api/inbox/messages/:id/media ── (stream do R2) ───────────────
router.get("/messages/:id/media", async (req, res) => {
    try {
        const msg = await prisma_1.default.whatsappMessage.findUnique({ where: { id: String(req.params.id) } });
        if (!msg?.media_key) {
            res.status(404).json({ error: "Sem mídia" });
            return;
        }
        const { body, mime } = await (0, storage_1.getFile)(msg.media_key);
        res.setHeader("Content-Type", mime || msg.media_mime || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(msg.media_name || "arquivo")}"`);
        body.pipe(res);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/inbox/conversations/:id/send-media ──────────────────────
router.post("/conversations/:id/send-media", mediaUpload.single("file"), async (req, res) => {
    const file = req.file;
    const caption = req.body?.caption || "";
    if (!file) {
        res.status(400).json({ error: "Arquivo obrigatório" });
        return;
    }
    try {
        const conv = await prisma_1.default.whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
        if (!conv) {
            res.status(404).json({ error: "Conversa não encontrada" });
            return;
        }
        // Permite forçar o tipo (ex.: enviar vídeo/imagem como "document")
        const mediatype = (req.body?.mediatype && ["image", "video", "audio", "document"].includes(req.body.mediatype)) ? req.body.mediatype : mediatypeFromMime(file.mimetype);
        const key = `whatsapp/${conv.instance}/${Date.now()}-out-${file.originalname.replace(/[^\w.\-]+/g, "_")}`;
        await (0, storage_1.uploadFile)(key, file.buffer, file.mimetype);
        // Envia via Evolution (base64)
        const sent = await (0, whatsapp_1.sendWhatsappMedia)(conv.instance, conv.chat_jid, mediatype, file.buffer.toString("base64"), { caption, fileName: file.originalname });
        const waId = sent?.key?.id || sent?.message?.key?.id || null;
        const me = await prisma_1.default.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        await (0, whatsapp_1.recordMessage)({
            instance: conv.instance, chatJid: conv.chat_jid, text: caption, fromMe: true,
            waMessageId: waId, authorName: me?.name || null, authorUserId: req.user.id,
            mediaType: mediatype, mediaKey: key, mediaMime: file.mimetype, mediaName: file.originalname,
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message });
    }
});
// ── POST /api/inbox/conversations/:id/send-audio ── (mensagem de voz) ─
router.post("/conversations/:id/send-audio", mediaUpload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "Áudio obrigatório" });
        return;
    }
    try {
        const conv = await prisma_1.default.whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
        if (!conv) {
            res.status(404).json({ error: "Conversa não encontrada" });
            return;
        }
        const key = `whatsapp/${conv.instance}/${Date.now()}-out-audio.ogg`;
        await (0, storage_1.uploadFile)(key, file.buffer, file.mimetype || "audio/ogg");
        await (0, whatsapp_1.sendWhatsappAudio)(conv.instance, conv.chat_jid, file.buffer.toString("base64"));
        const me = await prisma_1.default.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        await (0, whatsapp_1.recordMessage)({
            instance: conv.instance, chatJid: conv.chat_jid, text: "", fromMe: true,
            authorName: me?.name || null, authorUserId: req.user.id,
            mediaType: "audio", mediaKey: key, mediaMime: file.mimetype || "audio/ogg", mediaName: "audio.ogg",
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message });
    }
});
// ── Tags ──────────────────────────────────────────────────────────────
router.get("/tags", async (_req, res) => {
    const tags = await prisma_1.default.whatsappTag.findMany({ orderBy: { name: "asc" } });
    res.json({ tags });
});
router.post("/tags", async (req, res) => {
    const { name, color } = req.body;
    if (!name) {
        res.status(400).json({ error: "Nome obrigatório" });
        return;
    }
    const tag = await prisma_1.default.whatsappTag.create({ data: { name: String(name).trim(), color: color || "#10b981" } });
    res.status(201).json({ tag });
});
router.delete("/tags/:id", async (req, res) => {
    const id = String(req.params.id);
    await prisma_1.default.whatsappTag.delete({ where: { id } }).catch(() => { });
    // remove a tag das conversas
    const convs = await prisma_1.default.whatsappConversation.findMany({ where: { tag_ids: { has: id } }, select: { id: true, tag_ids: true } });
    for (const c of convs)
        await prisma_1.default.whatsappConversation.update({ where: { id: c.id }, data: { tag_ids: c.tag_ids.filter((t) => t !== id) } }).catch(() => { });
    res.json({ ok: true });
});
// Define as tags de uma conversa
router.post("/conversations/:id/tags", async (req, res) => {
    const { tag_ids } = req.body;
    try {
        const conv = await prisma_1.default.whatsappConversation.update({ where: { id: String(req.params.id) }, data: { tag_ids: Array.isArray(tag_ids) ? tag_ids : [] } });
        res.json({ conversation: conv });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=inbox.js.map