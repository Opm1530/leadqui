import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";
import { encrypt, decrypt } from "../lib/vault";

const router = Router();
router.use(authenticateJWT);

// Roles que podem revelar senhas
const CAN_REVEAL = ["ADMIN", "MANAGER"];

// ── GET /api/vault?client_id=xxx ──────────────────────────────────────
// Retorna todas as credenciais do cliente (sem a senha)
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id } = req.query;

  try {
    const where: any = { user_id: req.user!.id };
    if (client_id) where.client_id = String(client_id);

    const credentials = await (prisma as any).vaultCredential.findMany({
      where,
      select: {
        id:         true,
        client_id:  true,
        title:      true,
        category:   true,
        username:   true,
        url:        true,
        notes:      true,
        created_at: true,
        updated_at: true,
        // senha NUNCA retornada aqui
        client: { select: { name: true } },
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    res.json({ credentials });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/vault ───────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, title, category, username, url, notes, password } = req.body;

  if (!client_id || !title || !password) {
    res.status(400).json({ error: "client_id, title e password são obrigatórios" });
    return;
  }

  try {
    // Verificar ownership do cliente
    const client = await prisma.client.findFirst({
      where: { id: client_id, user_id: req.user!.id },
    });
    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    const { enc, iv, tag } = encrypt(password);

    const credential = await (prisma as any).vaultCredential.create({
      data: {
        client_id,
        user_id:      req.user!.id,
        title,
        category:     category || "OUTROS",
        username:     username || null,
        url:          url      || null,
        notes:        notes    || null,
        password_enc: enc,
        password_iv:  iv,
        password_tag: tag,
      },
      select: {
        id: true, client_id: true, title: true, category: true,
        username: true, url: true, notes: true, created_at: true,
      },
    });

    // Audit log de criação
    await logAction(credential.id, req.user!, req, "CREATE");

    res.status(201).json({ credential });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/vault/:id ────────────────────────────────────────────────
router.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { title, category, username, url, notes, password } = req.body;

  try {
    const existing = await (prisma as any).vaultCredential.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!existing) { res.status(404).json({ error: "Credencial não encontrada" }); return; }

    const updateData: any = {
      ...(title    !== undefined && { title }),
      ...(category !== undefined && { category }),
      ...(username !== undefined && { username }),
      ...(url      !== undefined && { url }),
      ...(notes    !== undefined && { notes }),
    };

    // Se nova senha foi enviada, re-criptografar com novo IV
    if (password) {
      const { enc, iv, tag } = encrypt(password);
      updateData.password_enc = enc;
      updateData.password_iv  = iv;
      updateData.password_tag = tag;
    }

    const credential = await (prisma as any).vaultCredential.update({
      where: { id },
      data:  updateData,
      select: {
        id: true, client_id: true, title: true, category: true,
        username: true, url: true, notes: true, updated_at: true,
      },
    });

    await logAction(id, req.user!, req, "UPDATE");

    res.json({ credential });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/vault/:id ─────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const existing = await (prisma as any).vaultCredential.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!existing) { res.status(404).json({ error: "Credencial não encontrada" }); return; }

    await logAction(id, req.user!, req, "DELETE");
    await (prisma as any).vaultCredential.delete({ where: { id } });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/vault/:id/reveal ────────────────────────────────────────
// Único endpoint que descriptografa e retorna a senha
// Restrito a ADMIN e MANAGER
router.post("/:id/reveal", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  if (!CAN_REVEAL.includes(req.user!.role)) {
    res.status(403).json({ error: "Apenas ADMIN e MANAGER podem revelar senhas" });
    return;
  }

  try {
    const credential = await (prisma as any).vaultCredential.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!credential) { res.status(404).json({ error: "Credencial não encontrada" }); return; }

    const password = decrypt(
      credential.password_enc,
      credential.password_iv,
      credential.password_tag,
    );

    // Audit log — registra SEMPRE que uma senha é revelada
    await logAction(id, req.user!, req, "REVEAL");

    res.json({ password });
  } catch (e: any) {
    res.status(500).json({ error: "Erro ao descriptografar: " + e.message });
  }
});

// ── GET /api/vault/:id/audit ──────────────────────────────────────────
// Histórico de acessos de uma credencial (só ADMIN/MANAGER)
router.get("/:id/audit", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  if (!CAN_REVEAL.includes(req.user!.role)) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  try {
    const logs = await (prisma as any).vaultAuditLog.findMany({
      where:   { credential_id: id },
      orderBy: { created_at: "desc" },
      take:    50,
    });
    res.json({ logs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/vault/audit/all ──────────────────────────────────────────
// Log geral de todas as operações (só ADMIN)
router.get("/audit/all", async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Apenas ADMIN pode ver o log completo" });
    return;
  }

  try {
    const logs = await (prisma as any).vaultAuditLog.findMany({
      orderBy: { created_at: "desc" },
      take:    100,
      include: { credential: { select: { title: true, client: { select: { name: true } } } } },
    });
    res.json({ logs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

// ── Helper interno ────────────────────────────────────────────────────
async function logAction(
  credentialId: string,
  user: { id: string; email: string; role: string },
  req: AuthRequest,
  action: string,
) {
  try {
    await (prisma as any).vaultAuditLog.create({
      data: {
        credential_id: credentialId,
        user_id:       user.id,
        user_email:    user.email,
        user_role:     user.role,
        ip_address:    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket?.remoteAddress || null,
        action,
      },
    });
  } catch {
    // log nunca bloqueia a operação principal
  }
}
