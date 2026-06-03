import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/settings/global ──────────────────────────────────────────
router.get("/global", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  try {
    let settings = await (prisma as any).globalSettings.findFirst();
    
    if (!settings) {
      settings = await (prisma as any).globalSettings.create({
        data: {}
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar configurações" });
  }
});

// ── PATCH /api/settings/global ────────────────────────────────────────
router.patch("/global", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const { central_wi_id, central_wi_name } = req.body;

  try {
    const settings = await (prisma as any).globalSettings.findFirst();
    
    if (!settings) {
      const newSettings = await (prisma as any).globalSettings.create({
        data: { central_wi_id, central_wi_name }
      });
      res.json(newSettings);
      return;
    }

    const updated = await (prisma as any).globalSettings.update({
      where: { id: settings.id },
      data: { central_wi_id, central_wi_name }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar configurações" });
  }
});

export default router;
