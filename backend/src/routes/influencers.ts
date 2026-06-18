import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { dayDate } from "../lib/dates";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── Influencers (catálogo) ────────────────────────────────────────────
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  const influencers = await (prisma as any).influencer.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { partnerships: true } } },
  });
  res.json({ influencers });
});

router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, instagram, tiktok, youtube, seguidores, telefone, email, nicho, observacao } = req.body;
  if (!nome) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const influencer = await (prisma as any).influencer.create({
    data: {
      user_id: req.user!.id,
      nome, instagram: instagram || null, tiktok: tiktok || null, youtube: youtube || null,
      seguidores: seguidores ? parseInt(String(seguidores)) : null,
      telefone: telefone || null, email: email || null, nicho: nicho || null, observacao: observacao || null,
    },
  });
  res.status(201).json({ influencer });
});

router.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, instagram, tiktok, youtube, seguidores, telefone, email, nicho, observacao } = req.body;
  try {
    const influencer = await (prisma as any).influencer.update({
      where: { id: String(req.params.id) },
      data: {
        ...(nome && { nome }), instagram, tiktok, youtube,
        seguidores: seguidores != null && seguidores !== "" ? parseInt(String(seguidores)) : null,
        telefone, email, nicho, observacao,
      },
    });
    res.json({ influencer });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).influencer.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Parcerias ─────────────────────────────────────────────────────────
router.get("/partnerships", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, influencer_id } = req.query;
  const where: any = {};
  if (client_id) where.client_id = String(client_id);
  if (influencer_id) where.influencer_id = String(influencer_id);
  const partnerships = await (prisma as any).influencerPartnership.findMany({
    where,
    include: {
      influencer: { select: { id: true, nome: true, instagram: true } },
      client: { select: { id: true, name: true } },
      products: true,
      deliverables: { include: { sales: true } },
    },
    orderBy: { created_at: "desc" },
  });
  res.json({ partnerships });
});

router.post("/partnerships", async (req: AuthRequest, res: Response): Promise<void> => {
  const { influencer_id, client_id, titulo, tipo, cache_value, status, observacao, started_at } = req.body;
  if (!influencer_id || !client_id || !titulo) {
    res.status(400).json({ error: "Influencer, cliente e título são obrigatórios" }); return;
  }
  const partnership = await (prisma as any).influencerPartnership.create({
    data: {
      influencer_id, client_id, titulo,
      tipo: tipo || "PERMUTA",
      cache_value: cache_value ? Number(cache_value) : null,
      status: status || "NEGOCIACAO",
      observacao: observacao || null,
      started_at: dayDate(started_at),
    },
  });
  res.status(201).json({ partnership });
});

router.put("/partnerships/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { titulo, tipo, cache_value, status, observacao, started_at } = req.body;
  try {
    const partnership = await (prisma as any).influencerPartnership.update({
      where: { id: String(req.params.id) },
      data: {
        ...(titulo && { titulo }), ...(tipo && { tipo }), ...(status && { status }),
        cache_value: cache_value != null && cache_value !== "" ? Number(cache_value) : null,
        observacao,
        ...(started_at !== undefined && { started_at: dayDate(started_at) }),
      },
    });
    res.json({ partnership });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/partnerships/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).influencerPartnership.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Produtos da parceria ──────────────────────────────────────────────
router.post("/partnerships/:id/products", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, valor, status } = req.body;
  if (!nome) { res.status(400).json({ error: "Nome do produto é obrigatório" }); return; }
  const product = await (prisma as any).partnershipProduct.create({
    data: { partnership_id: String(req.params.id), nome, valor: valor ? Number(valor) : null, status: status || "A_ENVIAR" },
  });
  res.status(201).json({ product });
});

router.patch("/products/:pid", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, valor, status } = req.body;
  try {
    const product = await (prisma as any).partnershipProduct.update({
      where: { id: String(req.params.pid) },
      data: { ...(nome && { nome }), ...(status && { status }), ...(valor !== undefined && { valor: valor ? Number(valor) : null }) },
    });
    res.json({ product });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/products/:pid", async (req: AuthRequest, res: Response): Promise<void> => {
  try { await (prisma as any).partnershipProduct.delete({ where: { id: String(req.params.pid) } }); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Entregáveis ───────────────────────────────────────────────────────
router.post("/partnerships/:id/deliverables", async (req: AuthRequest, res: Response): Promise<void> => {
  const { tipo, descricao } = req.body;
  if (!tipo) { res.status(400).json({ error: "Tipo é obrigatório" }); return; }
  const deliverable = await (prisma as any).partnershipDeliverable.create({
    data: { partnership_id: String(req.params.id), tipo, descricao: descricao || null },
  });
  res.status(201).json({ deliverable });
});

router.patch("/deliverables/:did", async (req: AuthRequest, res: Response): Promise<void> => {
  const { tipo, descricao, entregue, link } = req.body;
  try {
    const deliverable = await (prisma as any).partnershipDeliverable.update({
      where: { id: String(req.params.did) },
      data: {
        ...(tipo && { tipo }), ...(descricao !== undefined && { descricao }),
        ...(link !== undefined && { link }),
        ...(entregue !== undefined && { entregue: !!entregue, delivered_at: entregue ? new Date() : null }),
      },
    });
    res.json({ deliverable });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/deliverables/:did", async (req: AuthRequest, res: Response): Promise<void> => {
  try { await (prisma as any).partnershipDeliverable.delete({ where: { id: String(req.params.did) } }); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Vendas por material entregue ──────────────────────────────────────
router.post("/deliverables/:did/sales", async (req: AuthRequest, res: Response): Promise<void> => {
  const { valor, quantidade, observacao, sale_date } = req.body;
  const sale = await (prisma as any).deliverableSale.create({
    data: {
      deliverable_id: String(req.params.did),
      valor: valor ? Number(valor) : 0,
      quantidade: quantidade ? parseInt(String(quantidade)) : 1,
      observacao: observacao || null,
      sale_date: dayDate(sale_date) || new Date(),
    },
  });
  res.status(201).json({ sale });
});

router.delete("/sales/:sid", async (req: AuthRequest, res: Response): Promise<void> => {
  try { await (prisma as any).deliverableSale.delete({ where: { id: String(req.params.sid) } }); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
