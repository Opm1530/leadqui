"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
// ── Gestão dos formulários/endpoints ──────────────────────────────────
// Agência: apenas ADMIN (scope null). Cliente: qualquer usuário do cliente (scope = client_id).
// Sempre isolado por client_id.
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(async (req, res, next) => {
    const scope = await (0, auth_1.getScopeClientId)(req);
    if (!scope && req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Acesso restrito." });
        return;
    }
    next();
});
const genToken = () => "f_" + crypto_1.default.randomBytes(9).toString("hex");
// Lista os endpoints
router.get("/", async (req, res) => {
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const endpoints = await prisma_1.default.formEndpoint.findMany({ where: { client_id }, orderBy: { created_at: "desc" } });
        res.json({ endpoints });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Cria um endpoint
router.post("/", async (req, res) => {
    const { name, default_tag_ids, default_responsavel, redirect_url } = req.body;
    if (!name || !String(name).trim()) {
        res.status(400).json({ error: "Nome obrigatório" });
        return;
    }
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const endpoint = await prisma_1.default.formEndpoint.create({
            data: {
                user_id: req.user.id,
                client_id,
                name: String(name).trim(),
                token: genToken(),
                default_tag_ids: Array.isArray(default_tag_ids) ? default_tag_ids : [],
                default_responsavel: default_responsavel || null,
                redirect_url: redirect_url || null,
            },
        });
        res.status(201).json({ endpoint });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Atualiza um endpoint (nome, ativo, tags, responsável, redirect)
router.patch("/:id", async (req, res) => {
    const { name, active, default_tag_ids, default_responsavel, redirect_url } = req.body;
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const data = {};
        if (name !== undefined)
            data.name = String(name).trim();
        if (active !== undefined)
            data.active = !!active;
        if (default_tag_ids !== undefined)
            data.default_tag_ids = Array.isArray(default_tag_ids) ? default_tag_ids : [];
        if (default_responsavel !== undefined)
            data.default_responsavel = default_responsavel || null;
        if (redirect_url !== undefined)
            data.redirect_url = redirect_url || null;
        const r = await prisma_1.default.formEndpoint.updateMany({ where: { id: String(req.params.id), client_id }, data });
        if (!r.count) {
            res.status(404).json({ error: "Formulário não encontrado" });
            return;
        }
        const endpoint = await prisma_1.default.formEndpoint.findUnique({ where: { id: String(req.params.id) } });
        res.json({ endpoint });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Gera um novo token (invalida o antigo)
router.post("/:id/rotate", async (req, res) => {
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const r = await prisma_1.default.formEndpoint.updateMany({ where: { id: String(req.params.id), client_id }, data: { token: genToken() } });
        if (!r.count) {
            res.status(404).json({ error: "Formulário não encontrado" });
            return;
        }
        const endpoint = await prisma_1.default.formEndpoint.findUnique({ where: { id: String(req.params.id) } });
        res.json({ endpoint });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Últimas submissões de um endpoint
router.get("/:id/submissions", async (req, res) => {
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const ep = await prisma_1.default.formEndpoint.findFirst({ where: { id: String(req.params.id), client_id }, select: { id: true } });
        if (!ep) {
            res.status(404).json({ error: "Formulário não encontrado" });
            return;
        }
        const submissions = await prisma_1.default.formSubmission.findMany({
            where: { endpoint_id: String(req.params.id) },
            orderBy: { created_at: "desc" },
            take: 50,
        });
        res.json({ submissions });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Remove um endpoint
router.delete("/:id", async (req, res) => {
    try {
        const client_id = await (0, auth_1.getScopeClientId)(req);
        const r = await prisma_1.default.formEndpoint.deleteMany({ where: { id: String(req.params.id), client_id } });
        if (!r.count) {
            res.status(404).json({ error: "Formulário não encontrado" });
            return;
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=formEndpoints.js.map