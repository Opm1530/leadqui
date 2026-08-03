"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Todos os membros da agência (ADMIN, MANAGER, OPERATOR)
const AGENCY_ROLES = ["ADMIN", "MANAGER", "OPERATOR"];
// ── GET /api/teamqui ──────────────────────────────────────────────────
// Listar todos os membros da equipe (disponível para ADMIN, MANAGER e OPERATOR)
router.get("/", auth_1.authenticateJWT, async (req, res) => {
    const allowedRoles = ["ADMIN", "MANAGER", "OPERATOR"];
    if (!allowedRoles.includes(req.user?.role || "")) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    try {
        const team = await prisma_1.default.user.findMany({
            where: {
                role: { in: ["ADMIN", "MANAGER", "OPERATOR"] }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                position: true,
                gender: true,
                created_at: true,
            },
            orderBy: { name: "asc" }
        });
        res.json(team);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar equipe" });
    }
});
// ── POST /api/teamqui ─────────────────────────────────────────────────
// Adicionar novo membro à equipe
router.post("/", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { name, email, password, role, position, gender } = req.body;
    if (!name || !email || !password || !role) {
        res.status(400).json({ error: "Todos os campos são obrigatórios" });
        return;
    }
    if (!AGENCY_ROLES.includes(role)) {
        res.status(400).json({ error: "Cargo inválido para equipe" });
        return;
    }
    try {
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: "E-mail já cadastrado" });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.default.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password_hash,
                role: role,
                position,
                gender,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                position: true,
                gender: true,
            }
        });
        res.status(201).json(newUser);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar membro" });
    }
});
// ── PATCH /api/teamqui/:id ── (atualiza cargo/posição) ────────────────
router.patch("/:id", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    const { role, position, name, gender } = req.body;
    if (role && !AGENCY_ROLES.includes(role)) {
        res.status(400).json({ error: "Cargo inválido para equipe" });
        return;
    }
    if (id === req.user.id && role && role !== "ADMIN") {
        res.status(400).json({ error: "Você não pode rebaixar o próprio cargo." });
        return;
    }
    try {
        const user = await prisma_1.default.user.update({
            where: { id },
            data: {
                ...(role && { role: role }),
                ...(position !== undefined && { position }),
                ...(name !== undefined && name !== "" && { name }),
                ...(gender !== undefined && { gender }),
            },
            select: { id: true, name: true, email: true, role: true, position: true, gender: true },
        });
        res.json(user);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── DELETE /api/teamqui/:id ───────────────────────────────────────────
router.delete("/:id", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { id } = req.params;
    try {
        if (id === req.user?.id) {
            res.status(400).json({ error: "Você não pode remover a si mesmo" });
            return;
        }
        const userId = String(id);
        await prisma_1.default.user.delete({ where: { id: userId } });
        res.json({ message: "Membro removido com sucesso" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao remover membro" });
    }
});
exports.default = router;
//# sourceMappingURL=teamqui.js.map