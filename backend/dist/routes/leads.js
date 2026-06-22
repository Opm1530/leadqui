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
router.use(auth_1.requireStaff); // dados compartilhados pela equipe — bloqueia CLIENT
// ── GET /api/leads ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    const { status, origem, search, tag_id, limit = "100", offset = "0" } = req.query;
    try {
        const where = {};
        if (status)
            where.status = status;
        if (origem)
            where.origem = origem;
        if (search) {
            where.OR = [
                { nome: { contains: String(search) } },
                { email: { contains: String(search) } },
                { telefone: { contains: String(search) } },
                { cidade: { contains: String(search) } },
            ];
        }
        if (tag_id) {
            where.tags = { some: { tag_id: String(tag_id) } };
        }
        const [leads, total] = await Promise.all([
            prisma_1.default.lead.findMany({
                where,
                include: { tags: { include: { tag: true } } },
                orderBy: { created_at: "desc" },
                take: parseInt(String(limit)),
                skip: parseInt(String(offset)),
            }),
            prisma_1.default.lead.count({ where }),
        ]);
        res.json({ leads, total });
    }
    catch (error) {
        console.error("Get leads error:", error);
        res.status(500).json({ error: "Erro ao buscar leads" });
    }
});
// ── POST /api/leads ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { nome, telefone, email, endereco, cidade, website, categoria, observacao, origem = "MANUAL", status = "NOVO", valor_proposto, duracao_proposta, responsavel_proposto, servicos_propostos, } = req.body;
    if (!nome) {
        res.status(400).json({ error: "Nome é obrigatório" });
        return;
    }
    try {
        const lead = await prisma_1.default.lead.create({
            data: {
                user_id: req.user.id,
                nome,
                telefone: telefone || null,
                telefone_limpo: telefone ? telefone.replace(/\D/g, "") : null,
                email: email || null,
                endereco: endereco || null,
                cidade: cidade || null,
                website: website || null,
                categoria: categoria || null,
                observacao: observacao || null,
                origem,
                status,
                valor_proposto: valor_proposto != null && valor_proposto !== "" ? Number(valor_proposto) : null,
                duracao_proposta: duracao_proposta != null && duracao_proposta !== "" ? parseInt(String(duracao_proposta)) : null,
                responsavel_proposto: responsavel_proposto || null,
                servicos_propostos: Array.isArray(servicos_propostos) ? JSON.stringify(servicos_propostos) : (servicos_propostos || null),
            },
        });
        res.status(201).json({ lead });
    }
    catch (error) {
        console.error("Create lead error:", error);
        res.status(500).json({ error: "Erro ao criar lead" });
    }
});
// ── PUT /api/leads/:id ────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
    const id = String(req.params.id);
    const { tags, tag_ids, ...data } = req.body;
    try {
        const existing = await prisma_1.default.lead.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Lead não encontrado" });
            return;
        }
        if (data.telefone) {
            data.telefone_limpo = data.telefone.replace(/\D/g, "");
        }
        delete data.id;
        const lead = await prisma_1.default.lead.update({ where: { id }, data });
        // Atualizar tags se enviadas junto com o update
        const incomingTagIds = Array.isArray(tag_ids) ? tag_ids :
            Array.isArray(tags) ? tags.map((t) => (typeof t === "string" ? t : t.tag_id ?? t.id)).filter(Boolean) :
                null;
        if (incomingTagIds !== null) {
            await prisma_1.default.leadTag.deleteMany({ where: { lead_id: id } });
            if (incomingTagIds.length > 0) {
                await prisma_1.default.leadTag.createMany({
                    data: incomingTagIds.map((tag_id) => ({ lead_id: id, tag_id })),
                    skipDuplicates: true,
                });
            }
        }
        const updated = await prisma_1.default.lead.findUnique({
            where: { id },
            include: { tags: { include: { tag: true } } },
        });
        res.json({ lead: updated });
    }
    catch (error) {
        console.error("Update lead error:", error);
        res.status(500).json({ error: "Erro ao atualizar lead" });
    }
});
// ── DELETE /api/leads/:id ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    const id = String(req.params.id);
    try {
        const existing = await prisma_1.default.lead.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Lead não encontrado" });
            return;
        }
        await prisma_1.default.lead.delete({ where: { id } });
        res.json({ message: "Lead excluído com sucesso" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao excluir lead" });
    }
});
// ── POST /api/leads/:id/tags ──────────────────────────────────────────
router.post("/:id/tags", async (req, res) => {
    const id = String(req.params.id);
    const { tag_ids } = req.body;
    try {
        const lead = await prisma_1.default.lead.findFirst({ where: { id } });
        if (!lead) {
            res.status(404).json({ error: "Lead não encontrado" });
            return;
        }
        await prisma_1.default.leadTag.deleteMany({ where: { lead_id: id } });
        if (tag_ids && tag_ids.length > 0) {
            await prisma_1.default.leadTag.createMany({
                data: tag_ids.map((tag_id) => ({ lead_id: id, tag_id })),
                skipDuplicates: true,
            });
        }
        res.json({ message: "Tags atualizadas" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar tags do lead" });
    }
});
// ── GET /api/leads/stats ──────────────────────────────────────────────
router.get("/stats/summary", async (req, res) => {
    try {
        const [total, novo, contatado, qualificado, convertido] = await Promise.all([
            prisma_1.default.lead.count(),
            prisma_1.default.lead.count({ where: { status: "NOVO" } }),
            prisma_1.default.lead.count({ where: { status: "CONTATADO" } }),
            prisma_1.default.lead.count({ where: { status: "QUALIFICADO" } }),
            prisma_1.default.lead.count({ where: { status: "CONVERTIDO" } }),
        ]);
        res.json({ total, novo, contatado, qualificado, convertido });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
});
// ── Lembretes do lead ─────────────────────────────────────────────────
router.get("/:id/reminders", async (req, res) => {
    const reminders = await prisma_1.default.leadReminder.findMany({
        where: { lead_id: String(req.params.id) },
        orderBy: { remind_on: "asc" },
    });
    res.json({ reminders });
});
router.post("/:id/reminders", async (req, res) => {
    const { message, remind_on } = req.body;
    if (!message || !remind_on) {
        res.status(400).json({ error: "Mensagem e data são obrigatórias" });
        return;
    }
    try {
        const reminder = await prisma_1.default.leadReminder.create({
            data: {
                lead_id: String(req.params.id),
                user_id: req.user.id,
                message: String(message).slice(0, 500),
                remind_on: (0, dates_1.dayDate)(remind_on),
            },
        });
        res.status(201).json({ reminder });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/reminders/:rid", async (req, res) => {
    const { done, message, remind_on } = req.body;
    try {
        const reminder = await prisma_1.default.leadReminder.update({
            where: { id: String(req.params.rid) },
            data: {
                ...(done !== undefined && { done: !!done }),
                ...(message && { message: String(message).slice(0, 500) }),
                ...(remind_on && { remind_on: (0, dates_1.dayDate)(remind_on) }),
            },
        });
        res.json({ reminder });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/reminders/:rid", async (req, res) => {
    try {
        await prisma_1.default.leadReminder.delete({ where: { id: String(req.params.rid) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=leads.js.map