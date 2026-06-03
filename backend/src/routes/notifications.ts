import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);

// GET /api/notifications — lista notificações do usuário
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { unread_only } = req.query;
    const where: any = { user_id: req.user!.id };
    if (unread_only === "true") where.read = false;

    const notifications = await (prisma as any).notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const unreadCount = await (prisma as any).notification.count({
      where: { user_id: req.user!.id, read: false },
    });

    res.json({ notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/notifications/:id/read — marca uma como lida
router.patch("/:id/read", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notif = await (prisma as any).notification.findFirst({
      where: { id: req.params.id, user_id: req.user!.id },
    });
    if (!notif) { res.status(404).json({ error: "Não encontrada" }); return; }

    await (prisma as any).notification.update({
      where: { id: req.params.id },
      data:  { read: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/notifications/read-all — marca todas como lidas
router.patch("/read-all", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).notification.updateMany({
      where: { user_id: req.user!.id, read: false },
      data:  { read: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/:id
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notif = await (prisma as any).notification.findFirst({
      where: { id: req.params.id, user_id: req.user!.id },
    });
    if (!notif) { res.status(404).json({ error: "Não encontrada" }); return; }

    await (prisma as any).notification.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/clear-all — limpa todas lidas
router.delete("/clear-all", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).notification.deleteMany({
      where: { user_id: req.user!.id, read: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
