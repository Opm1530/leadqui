"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const vault_1 = require("../lib/vault");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireStaff);
// Roles que podem revelar senhas
const CAN_REVEAL = ["ADMIN", "MANAGER"];
// ── GET /api/vault?client_id=xxx ──────────────────────────────────────
// Retorna todas as credenciais do cliente (sem a senha)
router.get("/", async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = String(client_id);
        const credentials = await prisma_1.default.vaultCredential.findMany({
            where,
            select: {
                id: true,
                client_id: true,
                title: true,
                category: true,
                username: true,
                url: true,
                notes: true,
                created_at: true,
                updated_at: true,
                // senha NUNCA retornada aqui
                client: { select: { name: true } },
            },
            orderBy: [{ category: "asc" }, { title: "asc" }],
        });
        res.json({ credentials });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/vault ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { client_id, title, category, username, url, notes, password } = req.body;
    if (!client_id || !title || !password) {
        res.status(400).json({ error: "client_id, title e password são obrigatórios" });
        return;
    }
    try {
        // Verificar ownership do cliente
        const client = await prisma_1.default.client.findFirst({
            where: { id: client_id },
        });
        if (!client) {
            res.status(404).json({ error: "Cliente não encontrado" });
            return;
        }
        const { enc, iv, tag } = (0, vault_1.encrypt)(password);
        const credential = await prisma_1.default.vaultCredential.create({
            data: {
                client_id,
                user_id: req.user.id,
                title,
                category: category || "OUTROS",
                username: username || null,
                url: url || null,
                notes: notes || null,
                password_enc: enc,
                password_iv: iv,
                password_tag: tag,
            },
            select: {
                id: true, client_id: true, title: true, category: true,
                username: true, url: true, notes: true, created_at: true,
            },
        });
        // Audit log de criação
        await logAction(credential.id, req.user, req, "CREATE");
        res.status(201).json({ credential });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── PUT /api/vault/:id ────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
    const id = String(req.params.id);
    const { title, category, username, url, notes, password } = req.body;
    try {
        const existing = await prisma_1.default.vaultCredential.findFirst({
            where: { id },
        });
        if (!existing) {
            res.status(404).json({ error: "Credencial não encontrada" });
            return;
        }
        const updateData = {
            ...(title !== undefined && { title }),
            ...(category !== undefined && { category }),
            ...(username !== undefined && { username }),
            ...(url !== undefined && { url }),
            ...(notes !== undefined && { notes }),
        };
        // Se nova senha foi enviada, re-criptografar com novo IV
        if (password) {
            const { enc, iv, tag } = (0, vault_1.encrypt)(password);
            updateData.password_enc = enc;
            updateData.password_iv = iv;
            updateData.password_tag = tag;
        }
        const credential = await prisma_1.default.vaultCredential.update({
            where: { id },
            data: updateData,
            select: {
                id: true, client_id: true, title: true, category: true,
                username: true, url: true, notes: true, updated_at: true,
            },
        });
        await logAction(id, req.user, req, "UPDATE");
        res.json({ credential });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── DELETE /api/vault/:id ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    const id = String(req.params.id);
    try {
        const existing = await prisma_1.default.vaultCredential.findFirst({
            where: { id },
        });
        if (!existing) {
            res.status(404).json({ error: "Credencial não encontrada" });
            return;
        }
        await logAction(id, req.user, req, "DELETE");
        await prisma_1.default.vaultCredential.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/vault/:id/reveal ────────────────────────────────────────
// Único endpoint que descriptografa e retorna a senha
// Restrito a ADMIN e MANAGER
router.post("/:id/reveal", async (req, res) => {
    const id = String(req.params.id);
    if (!CAN_REVEAL.includes(req.user.role)) {
        res.status(403).json({ error: "Apenas ADMIN e MANAGER podem revelar senhas" });
        return;
    }
    try {
        const credential = await prisma_1.default.vaultCredential.findFirst({
            where: { id },
        });
        if (!credential) {
            res.status(404).json({ error: "Credencial não encontrada" });
            return;
        }
        const password = (0, vault_1.decrypt)(credential.password_enc, credential.password_iv, credential.password_tag);
        // Audit log — registra SEMPRE que uma senha é revelada
        await logAction(id, req.user, req, "REVEAL");
        res.json({ password });
    }
    catch (e) {
        res.status(500).json({ error: "Erro ao descriptografar: " + e.message });
    }
});
// ── GET /api/vault/:id/audit ──────────────────────────────────────────
// Histórico de acessos de uma credencial (só ADMIN/MANAGER)
router.get("/:id/audit", async (req, res) => {
    const id = String(req.params.id);
    if (!CAN_REVEAL.includes(req.user.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    try {
        const logs = await prisma_1.default.vaultAuditLog.findMany({
            where: { credential_id: id },
            orderBy: { created_at: "desc" },
            take: 50,
        });
        res.json({ logs });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── GET /api/vault/audit/all ──────────────────────────────────────────
// Log geral de todas as operações (só ADMIN)
router.get("/audit/all", async (req, res) => {
    if (req.user.role !== "ADMIN") {
        res.status(403).json({ error: "Apenas ADMIN pode ver o log completo" });
        return;
    }
    try {
        const logs = await prisma_1.default.vaultAuditLog.findMany({
            orderBy: { created_at: "desc" },
            take: 100,
            include: { credential: { select: { title: true, client: { select: { name: true } } } } },
        });
        res.json({ logs });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
// ── Helper interno ────────────────────────────────────────────────────
async function logAction(credentialId, user, req, action) {
    try {
        await prisma_1.default.vaultAuditLog.create({
            data: {
                credential_id: credentialId,
                user_id: user.id,
                user_email: user.email,
                user_role: user.role,
                ip_address: req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || null,
                action,
            },
        });
    }
    catch {
        // log nunca bloqueia a operação principal
    }
}
//# sourceMappingURL=vault.js.map