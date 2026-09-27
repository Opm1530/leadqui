import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettingsUserId } from "../lib/companySettings";
import { runScheduleById } from "../lib/extractionScheduler";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

const clean = (b: any) => ({
  categoria: b.categoria ? String(b.categoria).trim() : undefined,
  cidades: Array.isArray(b.cidades) ? b.cidades.map((c: any) => String(c).trim()).filter(Boolean) : undefined,
  quantidade: b.quantidade !== undefined ? Math.max(1, Math.min(100, parseInt(String(b.quantidade)) || 20)) : undefined,
  frequency: b.frequency === "WEEKLY" ? "WEEKLY" : b.frequency === "DAILY" ? "DAILY" : undefined,
  auto_sdr: b.auto_sdr !== undefined ? !!b.auto_sdr : undefined,
  active: b.active !== undefined ? !!b.active : undefined,
  tag_id: b.tag_id !== undefined ? (b.tag_id || null) : undefined,
});

router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  const schedules = await (prisma as any).extractionSchedule.findMany({ orderBy: { created_at: "desc" } });
  res.json({ schedules });
});

router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const d = clean(req.body);
    if (!d.categoria) { res.status(400).json({ error: "Informe a categoria (ex.: restaurante delivery)." }); return; }
    const user_id = await getCompanySettingsUserId();
    const schedule = await (prisma as any).extractionSchedule.create({
      data: {
        user_id, tipo: "GOOGLE_MAPS",
        categoria: d.categoria, cidades: d.cidades || [], quantidade: d.quantidade ?? 20,
        frequency: d.frequency || "DAILY", auto_sdr: d.auto_sdr ?? false, active: d.active ?? true,
        tag_id: d.tag_id ?? null, next_run_at: new Date(),
      },
    });
    res.status(201).json({ schedule });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const d = clean(req.body);
    const data: any = {};
    for (const [k, v] of Object.entries(d)) if (v !== undefined) data[k] = v;
    const schedule = await (prisma as any).extractionSchedule.update({ where: { id: String(req.params.id) }, data });
    res.json({ schedule });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  await (prisma as any).extractionSchedule.delete({ where: { id: String(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});

// Rodar agora (dispara em background)
router.post("/:id/run-now", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  runScheduleById(id).catch(() => {}); // background
  res.json({ ok: true, message: "Extração iniciada. Os leads aparecem em instantes." });
});

export default router;
