import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { authenticateJWT, requireClientAdmin, getScopeClientId, AuthRequest } from "../middlewares/auth";

// ── Gestão da equipe do cliente (produto CRM) ─────────────────────────
// Apenas o admin do próprio cliente. Tudo isolado ao client_id do usuário.
const router = Router();
router.use(authenticateJWT);
router.use(requireClientAdmin);

// Lista os usuários do cliente
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client_id = await getScopeClientId(req);
    const users = await prisma.user.findMany({
      where: { member_of_client_id: client_id } as any,
      select: { id: true, name: true, email: true, is_client_admin: true, created_at: true } as any,
      orderBy: { created_at: "asc" },
    });
    res.json({ users });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cria um usuário na equipe do cliente
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, is_admin } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" }); return; }
  try {
    const client_id = await getScopeClientId(req);
    const mail = String(email).toLowerCase().trim();
    const exists = await prisma.user.findUnique({ where: { email: mail } });
    if (exists) { res.status(409).json({ error: "E-mail já cadastrado" }); return; }

    const password_hash = await bcrypt.hash(String(password), 12);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: mail,
        password_hash,
        role: "CLIENT",
        member_of_client_id: client_id,
        is_client_admin: !!is_admin,
      } as any,
      select: { id: true, name: true, email: true, is_client_admin: true, created_at: true } as any,
    });
    res.status(201).json({ user });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Verifica que o usuário-alvo pertence ao mesmo cliente
async function targetInClient(req: AuthRequest, targetId: string): Promise<boolean> {
  const client_id = await getScopeClientId(req);
  const u = await prisma.user.findFirst({ where: { id: targetId, member_of_client_id: client_id } as any, select: { id: true } });
  return !!u;
}

// Atualiza um usuário (nome, admin, senha)
router.patch("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { name, is_admin, password } = req.body;
  try {
    if (!(await targetInClient(req, id))) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    // Não permite o admin remover o próprio status de admin (evita ficar sem admin)
    if (id === req.user!.id && is_admin === false) { res.status(400).json({ error: "Você não pode remover seu próprio acesso de administrador." }); return; }
    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (is_admin !== undefined) data.is_client_admin = !!is_admin;
    if (password) data.password_hash = await bcrypt.hash(String(password), 12);
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, is_client_admin: true, created_at: true } as any,
    });
    res.json({ user });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Remove um usuário da equipe
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  try {
    if (id === req.user!.id) { res.status(400).json({ error: "Você não pode excluir a si mesmo." }); return; }
    if (!(await targetInClient(req, id))) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
