import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── GET /api/crm/columns ─────────────────────────────────────────────
router.get("/columns", async (req: AuthRequest, res: Response): Promise<void> => {
  const columns = await prisma.cRMColumn.findMany({
    orderBy: { posicao: "asc" },
  });
  res.json({ columns });
});

// ── POST /api/crm/columns ────────────────────────────────────────────
router.post("/columns", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, cor = "#6366f1" } = req.body;
  if (!nome) { res.status(400).json({ error: "Nome é obrigatório" }); return; }

  const count = await prisma.cRMColumn.count();
  const column = await prisma.cRMColumn.create({
    data: { user_id: req.user!.id, nome, cor, posicao: count },
  });
  res.status(201).json({ column });
});

// ── PUT /api/crm/columns/:id ─────────────────────────────────────────
router.put("/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { nome, cor, posicao } = req.body;
  const existing = await prisma.cRMColumn.findFirst({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Coluna não encontrada" }); return; }
  const column = await prisma.cRMColumn.update({
    where: { id },
    data: {
      nome: nome || existing.nome,
      cor:  cor  || existing.cor,
      ...(posicao !== undefined && { posicao }),
    },
  });
  res.json({ column });
});

// ── PUT /api/crm/columns/reorder ─────────────────────────────────────
// Recebe array de ids na nova ordem e atualiza posicao de cada uma
router.put("/columns-reorder", async (req: AuthRequest, res: Response): Promise<void> => {
  const { order } = req.body; // string[] de ids
  if (!Array.isArray(order)) { res.status(400).json({ error: "order deve ser um array" }); return; }
  try {
    await Promise.all(order.map((colId: string, idx: number) =>
      prisma.cRMColumn.update({ where: { id: colId }, data: { posicao: idx } })
    ));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/crm/columns/:id ──────────────────────────────────────
router.delete("/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.cRMColumn.findFirst({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Coluna não encontrada" }); return; }
  // Cards são deletados em cascade (pelo schema)
  await prisma.cRMColumn.delete({ where: { id } });
  res.json({ message: "Coluna excluída" });
});

// ── GET /api/crm/cards ───────────────────────────────────────────────
router.get("/cards", async (req: AuthRequest, res: Response): Promise<void> => {
  const cards = await prisma.cRMCard.findMany({
    include: {
      lead: {
        include: { tags: { include: { tag: true } } },
      },
    },
    orderBy: { posicao: "asc" },
  });
  res.json({ cards });
});

// ── POST /api/crm/cards ──────────────────────────────────────────────
router.post("/cards", async (req: AuthRequest, res: Response): Promise<void> => {
  const { lead_id, coluna_id } = req.body;
  if (!lead_id || !coluna_id) { res.status(400).json({ error: "lead_id e coluna_id são obrigatórios" }); return; }

  // Verificar se já existe
  const existing = await prisma.cRMCard.findFirst({ where: { lead_id } });
  if (existing) { res.status(409).json({ error: "Lead já está no CRM" }); return; }

  const count = await prisma.cRMCard.count({ where: { coluna_id } });
  const card = await prisma.cRMCard.create({
    data: { user_id: req.user!.id, lead_id, coluna_id, posicao: count },
    include: { lead: { include: { tags: { include: { tag: true } } } } },
  });
  res.status(201).json({ card });
});

// ── PUT /api/crm/cards/:id ───────────────────────────────────────────
router.put("/cards/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { coluna_id, posicao } = req.body;
  const existing = await prisma.cRMCard.findFirst({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Card não encontrado" }); return; }
  const card = await prisma.cRMCard.update({
    where: { id },
    data: {
      coluna_id: coluna_id || existing.coluna_id,
      posicao: posicao !== undefined ? posicao : existing.posicao,
    },
    include: { lead: { include: { tags: { include: { tag: true } } } } },
  });
  res.json({ card });
});

// ── DELETE /api/crm/cards/:id ────────────────────────────────────────
router.delete("/cards/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.cRMCard.findFirst({ where: { id } });
  if (!existing) { res.status(404).json({ error: "Card não encontrado" }); return; }
  await prisma.cRMCard.delete({ where: { id } });
  res.json({ message: "Card removido" });
});

export default router;
