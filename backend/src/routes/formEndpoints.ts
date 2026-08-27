import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { authenticateJWT, getScopeClientId, AuthRequest } from "../middlewares/auth";

// ── Gestão dos formulários/endpoints ──────────────────────────────────
// Agência: apenas ADMIN (scope null). Cliente: qualquer usuário do cliente (scope = client_id).
// Sempre isolado por client_id.
const router = Router();
router.use(authenticateJWT);
router.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const scope = await getScopeClientId(req);
  if (!scope && req.user?.role !== "ADMIN") { res.status(403).json({ error: "Acesso restrito." }); return; }
  next();
});

const genToken = () => "f_" + crypto.randomBytes(9).toString("hex");

// Lista os endpoints
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = await getScopeClientId(req);
    const endpoints = await (prisma as any).formEndpoint.findMany({ where: { client_id }, orderBy: { created_at: "desc" } });
    res.json({ endpoints });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cria um endpoint
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, default_tag_ids, default_responsavel, redirect_url } = req.body;
  if (!name || !String(name).trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  try {
    const client_id = await getScopeClientId(req);
    const endpoint = await (prisma as any).formEndpoint.create({
      data: {
        user_id: req.user!.id,
        client_id,
        name: String(name).trim(),
        token: genToken(),
        default_tag_ids: Array.isArray(default_tag_ids) ? default_tag_ids : [],
        default_responsavel: default_responsavel || null,
        redirect_url: redirect_url || null,
      },
    });
    res.status(201).json({ endpoint });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Atualiza um endpoint (nome, ativo, tags, responsável, redirect)
router.patch("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, active, default_tag_ids, default_responsavel, redirect_url } = req.body;
  try {
    const client_id = await getScopeClientId(req);
    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (active !== undefined) data.active = !!active;
    if (default_tag_ids !== undefined) data.default_tag_ids = Array.isArray(default_tag_ids) ? default_tag_ids : [];
    if (default_responsavel !== undefined) data.default_responsavel = default_responsavel || null;
    if (redirect_url !== undefined) data.redirect_url = redirect_url || null;
    const r = await (prisma as any).formEndpoint.updateMany({ where: { id: String(req.params.id), client_id }, data });
    if (!r.count) { res.status(404).json({ error: "Formulário não encontrado" }); return; }
    const endpoint = await (prisma as any).formEndpoint.findUnique({ where: { id: String(req.params.id) } });
    res.json({ endpoint });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Gera um novo token (invalida o antigo)
router.post("/:id/rotate", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = await getScopeClientId(req);
    const r = await (prisma as any).formEndpoint.updateMany({ where: { id: String(req.params.id), client_id }, data: { token: genToken() } });
    if (!r.count) { res.status(404).json({ error: "Formulário não encontrado" }); return; }
    const endpoint = await (prisma as any).formEndpoint.findUnique({ where: { id: String(req.params.id) } });
    res.json({ endpoint });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Últimas submissões de um endpoint
router.get("/:id/submissions", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = await getScopeClientId(req);
    const ep = await (prisma as any).formEndpoint.findFirst({ where: { id: String(req.params.id), client_id }, select: { id: true } });
    if (!ep) { res.status(404).json({ error: "Formulário não encontrado" }); return; }
    const submissions = await (prisma as any).formSubmission.findMany({
      where: { endpoint_id: String(req.params.id) },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    res.json({ submissions });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Remove um endpoint
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = await getScopeClientId(req);
    const r = await (prisma as any).formEndpoint.deleteMany({ where: { id: String(req.params.id), client_id } });
    if (!r.count) { res.status(404).json({ error: "Formulário não encontrado" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
