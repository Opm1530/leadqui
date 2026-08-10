import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { sendWhatsappText, recordMessage } from "../lib/whatsapp";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── GET /api/inbox/conversations ──────────────────────────────────────
// Lista as conversas (mais recentes primeiro), com nome do cliente vinculado.
router.get("/conversations", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const convs = await (prisma as any).whatsappConversation.findMany({
      orderBy: { last_message_at: "desc" },
      take: 200,
    });
    const clientIds = [...new Set(convs.map((c: any) => c.client_id).filter(Boolean))];
    const clients = clientIds.length
      ? await (prisma as any).client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [];
    const cliMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
    const conversations = convs.map((c: any) => ({ ...c, client_name: c.client_id ? cliMap[c.client_id] || null : null }));
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

export default router;
