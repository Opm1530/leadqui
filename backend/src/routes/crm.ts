import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, getScopeClientId, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
// Sem requireStaff: tanto a equipe da agência (scope null) quanto os usuários de
// um cliente (scope = client_id) usam o CRM — cada um vê apenas o próprio quadro.

// ── GET /api/crm/columns ─────────────────────────────────────────────
router.get("/columns", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = await getScopeClientId(req);
  const columns = await prisma.cRMColumn.findMany({
    where: { client_id } as any,
    orderBy: { posicao: "asc" },
  });
  res.json({ columns });
});

// ── POST /api/crm/columns ────────────────────────────────────────────
router.post("/columns", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, cor = "#6366f1" } = req.body;
  if (!nome) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const client_id = await getScopeClientId(req);

  const count = await prisma.cRMColumn.count({ where: { client_id } as any });
  const column = await prisma.cRMColumn.create({
    data: { user_id: req.user!.id, client_id, nome, cor, posicao: count } as any,
  });
  res.status(201).json({ column });
});

// ── PUT /api/crm/columns/:id ─────────────────────────────────────────
router.put("/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { nome, cor, posicao } = req.body;
  const client_id = await getScopeClientId(req);
  const existing = await prisma.cRMColumn.findFirst({ where: { id, client_id } as any });
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

// ── PUT /api/crm/columns-reorder ─────────────────────────────────────
// Recebe array de ids na nova ordem e atualiza posicao de cada uma
router.put("/columns-reorder", async (req: AuthRequest, res: Response): Promise<void> => {
  const { order } = req.body; // string[] de ids
  if (!Array.isArray(order)) { res.status(400).json({ error: "order deve ser um array" }); return; }
  const client_id = await getScopeClientId(req);
  try {
    await Promise.all(order.map((colId: string, idx: number) =>
      prisma.cRMColumn.updateMany({ where: { id: colId, client_id } as any, data: { posicao: idx } })
    ));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/crm/columns/:id ──────────────────────────────────────
router.delete("/columns/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const client_id = await getScopeClientId(req);
  const existing = await prisma.cRMColumn.findFirst({ where: { id, client_id } as any });
  if (!existing) { res.status(404).json({ error: "Coluna não encontrada" }); return; }
  // Cards são deletados em cascade (pelo schema)
  await prisma.cRMColumn.delete({ where: { id } });
  res.json({ message: "Coluna excluída" });
});

// ── GET /api/crm/cards ───────────────────────────────────────────────
router.get("/cards", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = await getScopeClientId(req);
  const cards = await prisma.cRMCard.findMany({
    where: { client_id } as any,
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
  const client_id = await getScopeClientId(req);

  // A coluna precisa ser do mesmo tenant. O lead: cliente só usa os seus;
  // a agência (client_id null) pode usar qualquer lead da agência.
  const leadWhere: any = client_id ? { id: lead_id, client_id } : { id: lead_id };
  const lead = await prisma.lead.findFirst({ where: leadWhere, select: { id: true } });
  if (!lead) { res.status(404).json({ error: "Lead não encontrado" }); return; }
  const col = await prisma.cRMColumn.findFirst({ where: { id: coluna_id, client_id } as any, select: { id: true } });
  if (!col) { res.status(404).json({ error: "Coluna não encontrada" }); return; }

  // Verificar se já existe
  const existing = await prisma.cRMCard.findFirst({ where: { lead_id, client_id } as any });
  if (existing) { res.status(409).json({ error: "Lead já está no CRM" }); return; }

  const count = await prisma.cRMCard.count({ where: { coluna_id } });
  const card = await prisma.cRMCard.create({
    data: { user_id: req.user!.id, client_id, lead_id, coluna_id, posicao: count } as any,
    include: { lead: { include: { tags: { include: { tag: true } } } } },
  });
  res.status(201).json({ card });
});

// ── PUT /api/crm/cards/:id ───────────────────────────────────────────
router.put("/cards/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { coluna_id, posicao } = req.body;
  const client_id = await getScopeClientId(req);
  const existing = await prisma.cRMCard.findFirst({ where: { id, client_id } as any });
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
  const client_id = await getScopeClientId(req);
  const existing = await prisma.cRMCard.findFirst({ where: { id, client_id } as any });
  if (!existing) { res.status(404).json({ error: "Card não encontrado" }); return; }
  await prisma.cRMCard.delete({ where: { id } });
  res.json({ message: "Card removido" });
});

export default router;
