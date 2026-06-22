"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const dates_1 = require("../lib/dates");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireStaff);
// ── Influencers (catálogo) ────────────────────────────────────────────
router.get("/", async (_req, res) => {
    const influencers = await prisma_1.default.influencer.findMany({
        orderBy: { nome: "asc" },
        include: { _count: { select: { partnerships: true } } },
    });
    res.json({ influencers });
});
router.post("/", async (req, res) => {
    const { nome, instagram, tiktok, youtube, seguidores, telefone, email, nicho, observacao } = req.body;
    if (!nome) {
        res.status(400).json({ error: "Nome é obrigatório" });
        return;
    }
    const influencer = await prisma_1.default.influencer.create({
        data: {
            user_id: req.user.id,
            nome, instagram: instagram || null, tiktok: tiktok || null, youtube: youtube || null,
            seguidores: seguidores ? parseInt(String(seguidores)) : null,
            telefone: telefone || null, email: email || null, nicho: nicho || null, observacao: observacao || null,
        },
    });
    res.status(201).json({ influencer });
});
router.put("/:id", async (req, res) => {
    const { nome, instagram, tiktok, youtube, seguidores, telefone, email, nicho, observacao } = req.body;
    try {
        const influencer = await prisma_1.default.influencer.update({
            where: { id: String(req.params.id) },
            data: {
                ...(nome && { nome }), instagram, tiktok, youtube,
                seguidores: seguidores != null && seguidores !== "" ? parseInt(String(seguidores)) : null,
                telefone, email, nicho, observacao,
            },
        });
        res.json({ influencer });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        await prisma_1.default.influencer.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Parcerias ─────────────────────────────────────────────────────────
router.get("/partnerships", async (req, res) => {
    const { client_id, influencer_id } = req.query;
    const where = {};
    if (client_id)
        where.client_id = String(client_id);
    if (influencer_id)
        where.influencer_id = String(influencer_id);
    const partnerships = await prisma_1.default.influencerPartnership.findMany({
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
router.post("/partnerships", async (req, res) => {
    const { influencer_id, client_id, titulo, tipo, cache_value, status, observacao, started_at } = req.body;
    if (!influencer_id || !client_id || !titulo) {
        res.status(400).json({ error: "Influencer, cliente e título são obrigatórios" });
        return;
    }
    const partnership = await prisma_1.default.influencerPartnership.create({
        data: {
            influencer_id, client_id, titulo,
            tipo: tipo || "PERMUTA",
            cache_value: cache_value ? Number(cache_value) : null,
            status: status || "NEGOCIACAO",
            observacao: observacao || null,
            started_at: (0, dates_1.dayDate)(started_at),
        },
    });
    res.status(201).json({ partnership });
});
router.put("/partnerships/:id", async (req, res) => {
    const { titulo, tipo, cache_value, status, observacao, started_at } = req.body;
    try {
        const partnership = await prisma_1.default.influencerPartnership.update({
            where: { id: String(req.params.id) },
            data: {
                ...(titulo && { titulo }), ...(tipo && { tipo }), ...(status && { status }),
                cache_value: cache_value != null && cache_value !== "" ? Number(cache_value) : null,
                observacao,
                ...(started_at !== undefined && { started_at: (0, dates_1.dayDate)(started_at) }),
            },
        });
        res.json({ partnership });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/partnerships/:id", async (req, res) => {
    try {
        await prisma_1.default.influencerPartnership.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Produtos da parceria ──────────────────────────────────────────────
router.post("/partnerships/:id/products", async (req, res) => {
    const { nome, valor, status } = req.body;
    if (!nome) {
        res.status(400).json({ error: "Nome do produto é obrigatório" });
        return;
    }
    const product = await prisma_1.default.partnershipProduct.create({
        data: { partnership_id: String(req.params.id), nome, valor: valor ? Number(valor) : null, status: status || "A_ENVIAR" },
    });
    res.status(201).json({ product });
});
router.patch("/products/:pid", async (req, res) => {
    const { nome, valor, status } = req.body;
    try {
        const product = await prisma_1.default.partnershipProduct.update({
            where: { id: String(req.params.pid) },
            data: { ...(nome && { nome }), ...(status && { status }), ...(valor !== undefined && { valor: valor ? Number(valor) : null }) },
        });
        res.json({ product });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/products/:pid", async (req, res) => {
    try {
        await prisma_1.default.partnershipProduct.delete({ where: { id: String(req.params.pid) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Entregáveis ───────────────────────────────────────────────────────
router.post("/partnerships/:id/deliverables", async (req, res) => {
    const { tipo, descricao } = req.body;
    if (!tipo) {
        res.status(400).json({ error: "Tipo é obrigatório" });
        return;
    }
    const deliverable = await prisma_1.default.partnershipDeliverable.create({
        data: { partnership_id: String(req.params.id), tipo, descricao: descricao || null },
    });
    res.status(201).json({ deliverable });
});
router.patch("/deliverables/:did", async (req, res) => {
    const { tipo, descricao, entregue, link } = req.body;
    try {
        const deliverable = await prisma_1.default.partnershipDeliverable.update({
            where: { id: String(req.params.did) },
            data: {
                ...(tipo && { tipo }), ...(descricao !== undefined && { descricao }),
                ...(link !== undefined && { link }),
                ...(entregue !== undefined && { entregue: !!entregue, delivered_at: entregue ? new Date() : null }),
            },
        });
        res.json({ deliverable });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/deliverables/:did", async (req, res) => {
    try {
        await prisma_1.default.partnershipDeliverable.delete({ where: { id: String(req.params.did) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Vendas por material entregue ──────────────────────────────────────
router.post("/deliverables/:did/sales", async (req, res) => {
    const { valor, quantidade, observacao, sale_date } = req.body;
    const sale = await prisma_1.default.deliverableSale.create({
        data: {
            deliverable_id: String(req.params.did),
            valor: valor ? Number(valor) : 0,
            quantidade: quantidade ? parseInt(String(quantidade)) : 1,
            observacao: observacao || null,
            sale_date: (0, dates_1.dayDate)(sale_date) || new Date(),
        },
    });
    res.status(201).json({ sale });
});
router.delete("/sales/:sid", async (req, res) => {
    try {
        await prisma_1.default.deliverableSale.delete({ where: { id: String(req.params.sid) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=influencers.js.map