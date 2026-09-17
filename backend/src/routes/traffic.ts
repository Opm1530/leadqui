import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

// ── Painel de verificação de tráfego pago (por cliente) ───────────────
const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

const COLUMN_TYPES = ["NUMBER", "CURRENCY", "PERCENT", "TEXT"];
const monthOf = (d?: string) => {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

// GET /api/traffic/:clientId?month=YYYY-MM → verba, colunas, verificações e totais do mês
router.get("/:clientId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const month = String(req.query.month || monthOf());

    const [budget, columns, checks] = await Promise.all([
      (prisma as any).trafficBudget.findUnique({ where: { client_id_month: { client_id, month } } }),
      (prisma as any).trafficColumn.findMany({ where: { client_id }, orderBy: { order: "asc" } }),
      (prisma as any).trafficCheck.findMany({ where: { client_id, month }, orderBy: { checked_at: "desc" } }),
    ]);

    const gasto = checks.reduce((s: number, c: any) => s + (c.spend || 0), 0);
    const verba = budget?.amount || 0;
    res.json({
      month,
      budget: verba,
      columns,
      checks,
      totals: { gasto, saldo: verba - gasto, count: checks.length },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/traffic/:clientId/budget { month, amount } → define a verba do mês
router.put("/:clientId/budget", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const month = String(req.body.month || monthOf());
    const amount = Number(req.body.amount) || 0;
    const budget = await (prisma as any).trafficBudget.upsert({
      where: { client_id_month: { client_id, month } },
      create: { client_id, month, amount },
      update: { amount },
    });
    res.json({ budget });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Colunas personalizadas ────────────────────────────────────────────
router.post("/:clientId/columns", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const { name, type } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }
    const count = await (prisma as any).trafficColumn.count({ where: { client_id } });
    const column = await (prisma as any).trafficColumn.create({
      data: { client_id, name: String(name).trim(), type: COLUMN_TYPES.includes(type) ? type : "NUMBER", order: count },
    });
    res.status(201).json({ column });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/:clientId/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const data: any = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.type !== undefined && COLUMN_TYPES.includes(req.body.type)) data.type = req.body.type;
    if (req.body.order !== undefined) data.order = Number(req.body.order);
    const r = await (prisma as any).trafficColumn.updateMany({ where: { id: String(req.params.id), client_id }, data });
    if (!r.count) { res.status(404).json({ error: "Coluna não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:clientId/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const r = await (prisma as any).trafficColumn.deleteMany({ where: { id: String(req.params.id), client_id } });
    if (!r.count) { res.status(404).json({ error: "Coluna não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Verificações (linhas) ─────────────────────────────────────────────
const checkData = (body: any) => ({
  checked_at: body.checked_at ? new Date(body.checked_at) : new Date(),
  campaign_name: body.campaign_name || null,
  campaign_id: body.campaign_id || null,
  adset_name: body.adset_name || null,
  ad_name: body.ad_name || null,
  spend: Number(body.spend) || 0,
  observation: body.observation || null,
  values: body.values && typeof body.values === "object" ? body.values : {},
});

router.post("/:clientId/checks", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const d = checkData(req.body);
    const check = await (prisma as any).trafficCheck.create({
      data: { client_id, month: monthOf(d.checked_at.toISOString()), user_id: req.user!.id, ...d },
    });
    res.status(201).json({ check });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/:clientId/checks/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const d = checkData(req.body);
    const r = await (prisma as any).trafficCheck.updateMany({
      where: { id: String(req.params.id), client_id },
      data: { ...d, month: monthOf(d.checked_at.toISOString()) },
    });
    if (!r.count) { res.status(404).json({ error: "Verificação não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:clientId/checks/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = String(req.params.clientId);
    const r = await (prisma as any).trafficCheck.deleteMany({ where: { id: String(req.params.id), client_id } });
    if (!r.count) { res.status(404).json({ error: "Verificação não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
