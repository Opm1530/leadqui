"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
// ── Gestão da equipe do cliente (produto CRM) ─────────────────────────
// Apenas o admin do próprio cliente. Tudo isolado ao client_id do usuário.
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireClientAdmin);
// Lista os usuários do cliente
router.get("/", async (req, res) => {
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const users = await prisma_1.default.user.findMany({
            where: { member_of_client_id: client_id },
            select: { id: true, name: true, email: true, is_client_admin: true, created_at: true },
            orderBy: { created_at: "asc" },
        });
        res.json({ users });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Cria um usuário na equipe do cliente
router.post("/", async (req, res) => {
    const { name, email, password, is_admin } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
        return;
    }
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const mail = String(email).toLowerCase().trim();
        const exists = await prisma_1.default.user.findUnique({ where: { email: mail } });
        if (exists) {
            res.status(409).json({ error: "E-mail já cadastrado" });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(String(password), 12);
        const user = await prisma_1.default.user.create({
            data: {
                name: String(name).trim(),
                email: mail,
                password_hash,
                role: "CLIENT",
                member_of_client_id: client_id,
                is_client_admin: !!is_admin,
            },
            select: { id: true, name: true, email: true, is_client_admin: true, created_at: true },
        });
        res.status(201).json({ user });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Verifica que o usuário-alvo pertence ao mesmo cliente
async function targetInClient(req, targetId) {
    const client_id = await (0, auth_1.getScopeClientId)(req);
    const u = await prisma_1.default.user.findFirst({ where: { id: targetId, member_of_client_id: client_id }, select: { id: true } });
    return !!u;
}
// Atualiza um usuário (nome, admin, senha)
router.patch("/:id", async (req, res) => {
    const id = String(req.params.id);
    const { name, is_admin, password } = req.body;
    try {
        if (!(await targetInClient(req, id))) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        // Não permite o admin remover o próprio status de admin (evita ficar sem admin)
        if (id === req.user.id && is_admin === false) {
            res.status(400).json({ error: "Você não pode remover seu próprio acesso de administrador." });
            return;
        }
        const data = {};
        if (name !== undefined)
            data.name = String(name).trim();
        if (is_admin !== undefined)
            data.is_client_admin = !!is_admin;
        if (password)
            data.password_hash = await bcryptjs_1.default.hash(String(password), 12);
        const user = await prisma_1.default.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, is_client_admin: true, created_at: true },
        });
        res.json({ user });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Remove um usuário da equipe
router.delete("/:id", async (req, res) => {
    const id = String(req.params.id);
    try {
        if (id === req.user.id) {
            res.status(400).json({ error: "Você não pode excluir a si mesmo." });
            return;
        }
        if (!(await targetInClient(req, id))) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        await prisma_1.default.user.delete({ where: { id } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=clientUsers.js.map