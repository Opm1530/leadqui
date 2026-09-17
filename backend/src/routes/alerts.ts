import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { listAlerts } from "../lib/alerts";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// GET /api/alerts → alertas ativos (persistidos + ao vivo)
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alerts = await listAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/alerts/:id/resolve → dispensa um alerta persistido (os ao vivo somem sozinhos)
router.post("/:id/resolve", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (id.includes(":")) { res.json({ ok: true, dynamic: true }); return; } // alerta ao vivo, não persiste
    await (prisma as any).alert.update({ where: { id }, data: { resolved: true, resolved_at: new Date() } }).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
