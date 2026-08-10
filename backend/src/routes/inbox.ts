import { Router, Response } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticateJWT, requireAdmin, AuthRequest } from "../middlewares/auth";
import { sendWhatsappText, sendWhatsappMedia, sendWhatsappAudio, recordMessage, syncGroupNames } from "../lib/whatsapp";
import { uploadFile, getFile } from "../lib/storage";

const router = Router();
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } }); // 60MB
router.use(authenticateJWT);
router.use(requireAdmin);

const mediatypeFromMime = (mime?: string): string => {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "document";
};

// ── GET /api/inbox/conversations ──────────────────────────────────────
// Lista as conversas (mais recentes primeiro), com nome do cliente vinculado.
router.get("/conversations", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const showArchived = req.query.archived === "1";
    // Preenche nomes de grupos que ainda não têm (lazy sync, com cache interno)
    const unnamed = await (prisma as any).whatsappConversation.findMany({ where: { is_group: true, name: null }, select: { instance: true }, distinct: ["instance"] });
    if (unnamed.length) await syncGroupNames(unnamed.map((u: any) => u.instance));

    const convs = await (prisma as any).whatsappConversation.findMany({
      where: { archived: showArchived },
      orderBy: { last_message_at: "desc" },
      take: 200,
    });
    const clientIds = [...new Set(convs.map((c: any) => c.client_id).filter(Boolean))];
    const clients = clientIds.length
      ? await (prisma as any).client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [];
    const cliMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
    const allTags = await (prisma as any).whatsappTag.findMany();
    const tagMap = Object.fromEntries(allTags.map((t: any) => [t.id, t]));
    let list = convs;
    if (req.query.tag) list = list.filter((c: any) => (c.tag_ids || []).includes(String(req.query.tag)));
    const conversations = list.map((c: any) => ({
      ...c,
      client_name: c.client_id ? cliMap[c.client_id] || null : null,
      tags: (c.tag_ids || []).map((id: string) => tagMap[id]).filter(Boolean),
    }));
    res.json({ conversations });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/inbox/conversations/:id/messages ─────────────────────────
router.get("/conversations/:id/messages", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await (prisma as any).whatsappMessage.findMany({
      where: { conversation_id: String(req.params.id) },
      orderBy: { timestamp: "asc" },
      take: 500,
    });
    res.json({ messages });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/inbox/conversations/:id/read ────────────────────────────
router.post("/conversations/:id/read", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).whatsappConversation.update({ where: { id: String(req.params.id) }, data: { unread: 0 } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/inbox/conversations/:id/archive ─────────────────────────
router.post("/conversations/:id/archive", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const archived = req.body?.archived !== false; // default true
    await (prisma as any).whatsappConversation.update({ where: { id: String(req.params.id) }, data: { archived } });
    res.json({ ok: true, archived });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/inbox/conversations/:id/send ────────────────────────────
router.post("/conversations/:id/send", async (req: AuthRequest, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text || !String(text).trim()) { res.status(400).json({ error: "Mensagem vazia" }); return; }
  try {
    const conv = await (prisma as any).whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

    const sent = await sendWhatsappText(conv.instance, conv.chat_jid, String(text).trim());
    const waId = sent?.key?.id || sent?.message?.key?.id || null;

    const me = await (prisma as any).user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    await recordMessage({
      instance: conv.instance,
      chatJid: conv.chat_jid,
      text: String(text).trim(),
      fromMe: true,
      waMessageId: waId,
      authorName: me?.name || null,
      authorUserId: req.user!.id,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

// ── GET /api/inbox/messages/:id/media ── (stream do R2) ───────────────
router.get("/messages/:id/media", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await (prisma as any).whatsappMessage.findUnique({ where: { id: String(req.params.id) } });
    if (!msg?.media_key) { res.status(404).json({ error: "Sem mídia" }); return; }
    const { body, mime } = await getFile(msg.media_key);
    res.setHeader("Content-Type", mime || msg.media_mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(msg.media_name || "arquivo")}"`);
    (body as any).pipe(res);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/inbox/conversations/:id/send-media ──────────────────────
router.post("/conversations/:id/send-media", mediaUpload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  const file = (req as any).file;
  const caption = req.body?.caption || "";
  if (!file) { res.status(400).json({ error: "Arquivo obrigatório" }); return; }
  try {
    const conv = await (prisma as any).whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

    // Permite forçar o tipo (ex.: enviar vídeo/imagem como "document")
    const mediatype = (req.body?.mediatype && ["image", "video", "audio", "document"].includes(req.body.mediatype)) ? req.body.mediatype : mediatypeFromMime(file.mimetype);
    const key = `whatsapp/${conv.instance}/${Date.now()}-out-${file.originalname.replace(/[^\w.\-]+/g, "_")}`;
    await uploadFile(key, file.buffer, file.mimetype);

    // Envia via Evolution (base64)
    const sent = await sendWhatsappMedia(conv.instance, conv.chat_jid, mediatype, file.buffer.toString("base64"), { caption, fileName: file.originalname });
    const waId = sent?.key?.id || sent?.message?.key?.id || null;

    const me = await (prisma as any).user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    await recordMessage({
      instance: conv.instance, chatJid: conv.chat_jid, text: caption, fromMe: true,
      waMessageId: waId, authorName: me?.name || null, authorUserId: req.user!.id,
      mediaType: mediatype, mediaKey: key, mediaMime: file.mimetype, mediaName: file.originalname,
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

// ── POST /api/inbox/conversations/:id/send-audio ── (mensagem de voz) ─
router.post("/conversations/:id/send-audio", mediaUpload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ error: "Áudio obrigatório" }); return; }
  try {
    const conv = await (prisma as any).whatsappConversation.findUnique({ where: { id: String(req.params.id) } });
    if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }

    const key = `whatsapp/${conv.instance}/${Date.now()}-out-audio.ogg`;
    await uploadFile(key, file.buffer, file.mimetype || "audio/ogg");
    await sendWhatsappAudio(conv.instance, conv.chat_jid, file.buffer.toString("base64"));

    const me = await (prisma as any).user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    await recordMessage({
      instance: conv.instance, chatJid: conv.chat_jid, text: "", fromMe: true,
      authorName: me?.name || null, authorUserId: req.user!.id,
      mediaType: "audio", mediaKey: key, mediaMime: file.mimetype || "audio/ogg", mediaName: "audio.ogg",
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

// ── Tags ──────────────────────────────────────────────────────────────
router.get("/tags", async (_req: AuthRequest, res: Response): Promise<void> => {
  const tags = await (prisma as any).whatsappTag.findMany({ orderBy: { name: "asc" } });
  res.json({ tags });
});
router.post("/tags", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, color } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  const tag = await (prisma as any).whatsappTag.create({ data: { name: String(name).trim(), color: color || "#10b981" } });
  res.status(201).json({ tag });
});
router.delete("/tags/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await (prisma as any).whatsappTag.delete({ where: { id } }).catch(() => {});
  // remove a tag das conversas
  const convs = await (prisma as any).whatsappConversation.findMany({ where: { tag_ids: { has: id } }, select: { id: true, tag_ids: true } });
  for (const c of convs) await (prisma as any).whatsappConversation.update({ where: { id: c.id }, data: { tag_ids: c.tag_ids.filter((t: string) => t !== id) } }).catch(() => {});
  res.json({ ok: true });
});

// Define as tags de uma conversa
router.post("/conversations/:id/tags", async (req: AuthRequest, res: Response): Promise<void> => {
  const { tag_ids } = req.body;
  try {
    const conv = await (prisma as any).whatsappConversation.update({ where: { id: String(req.params.id) }, data: { tag_ids: Array.isArray(tag_ids) ? tag_ids : [] } });
    res.json({ conversation: conv });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
