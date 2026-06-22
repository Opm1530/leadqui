"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const resend_1 = require("resend");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// ── POST /api/auth/login ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "E-mail e senha são obrigatórios" });
        return;
    }
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (!user) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        const passwordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!passwordValid) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
// ── POST /api/auth/register (Admin only) ───────────────────────────
router.post("/register", auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    const { name, email, password, role = "CLIENT" } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
        return;
    }
    try {
        const existing = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (existing) {
            res.status(409).json({ error: "E-mail já cadastrado" });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email: email.toLowerCase().trim(),
                password_hash,
                role: role,
            },
            select: { id: true, name: true, email: true, role: true, created_at: true },
        });
        res.status(201).json({ user });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Erro ao criar usuário" });
    }
});
// ── POST /api/auth/forgot-password ──────────────────────────────────
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ error: "E-mail é obrigatório" });
        return;
    }
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        // Always return success to avoid email enumeration
        if (!user) {
            res.json({ message: "Se o e-mail existir, você receberá as instruções de reset." });
            return;
        }
        const token = (0, uuid_1.v4)();
        const expires = new Date(Date.now() + 3600000); // 1 hora
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { reset_token: token, reset_token_expires: expires },
        });
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: user.email,
            subject: "Redefinição de Senha — Pequi Digital",
            html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #111; color: #f5f5f5; border-radius: 16px;">
          <h2 style="color: #f97316; margin-bottom: 8px;">🍈 Pequi Digital</h2>
          <p>Olá, <strong>${user.name}</strong>!</p>
          <p>Você solicitou a redefinição de senha. Clique no botão abaixo para criar uma nova senha:</p>
          <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 14px 32px; background: linear-gradient(135deg, #f97316, #eab308); color: #000; font-weight: bold; border-radius: 8px; text-decoration: none;">
            Redefinir Senha
          </a>
          <p style="font-size: 12px; color: #888;">Este link expira em 1 hora. Se não foi você, ignore este e-mail.</p>
        </div>
      `,
        });
        res.json({ message: "Se o e-mail existir, você receberá as instruções de reset." });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Erro ao processar solicitação" });
    }
});
// ── POST /api/auth/reset-password ───────────────────────────────────
router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400).json({ error: "Token e nova senha são obrigatórios" });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
        return;
    }
    try {
        const user = await prisma_1.default.user.findUnique({ where: { reset_token: token } });
        if (!user || !user.reset_token_expires || user.reset_token_expires < new Date()) {
            res.status(400).json({ error: "Token inválido ou expirado" });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                password_hash,
                reset_token: null,
                reset_token_expires: null,
            },
        });
        res.json({ message: "Senha redefinida com sucesso!" });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Erro ao redefinir senha" });
    }
});
// ── GET /api/auth/me ─────────────────────────────────────────────────
router.get("/me", auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, created_at: true },
        });
        if (!user) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno" });
    }
});
// ── PUT /api/auth/change-password ────────────────────────────────────
router.put("/change-password", auth_1.authenticateJWT, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
        return;
    }
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        const valid = await bcryptjs_1.default.compare(current_password, user.password_hash);
        if (!valid) {
            res.status(401).json({ error: "Senha atual incorreta" });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(new_password, 12);
        await prisma_1.default.user.update({ where: { id: user.id }, data: { password_hash } });
        res.json({ message: "Senha alterada com sucesso!" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao alterar senha" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map