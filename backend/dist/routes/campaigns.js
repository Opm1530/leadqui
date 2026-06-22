"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const companySettings_1 = require("../lib/companySettings");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireStaff);
// ── GET /api/campaigns ─────────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const campaigns = await prisma_1.default.campaign.findMany({
            include: { instance: { select: { id: true, nome: true } } },
            orderBy: { created_at: "desc" },
        });
        res.json({ campaigns });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar campanhas" });
    }
});
// ── POST /api/campaigns ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { nome, mensagem, instance_id, tag_ids = [], lead_ids = [], new_tag_name } = req.body;
    if (!nome || !mensagem) {
        res.status(400).json({ error: "Nome e mensagem são obrigatórios" });
        return;
    }
    try {
        // Count leads that will receive this campaign
        const leadFilter = { telefone_limpo: { not: null } };
        if (lead_ids.length > 0) {
            leadFilter.id = { in: lead_ids };
        }
        else if (tag_ids.length > 0) {
            leadFilter.tags = { some: { tag_id: { in: tag_ids } } };
        }
        const totalLeads = await prisma_1.default.lead.count({ where: leadFilter });
        const campaign = await prisma_1.default.campaign.create({
            data: {
                user_id: req.user.id,
                nome,
                mensagem,
                instance_id: instance_id || null,
                status: "PENDENTE",
                total_leads: totalLeads,
            },
        });
        // Start campaign in background if instance is configured
        if (instance_id) {
            startCampaign(campaign.id, req.user.id, mensagem, instance_id, tag_ids, lead_ids, new_tag_name).catch((err) => console.error("Campaign background error:", err));
        }
        res.status(201).json({ campaign });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar campanha: " + error.message });
    }
});
// ── PUT /api/campaigns/:id ─────────────────────────────────────────────
router.put("/:id", async (req, res) => {
    const id = String(req.params.id);
    const { nome, mensagem, instance_id } = req.body;
    try {
        const existing = await prisma_1.default.campaign.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Campanha não encontrada" });
            return;
        }
        const campaign = await prisma_1.default.campaign.update({
            where: { id },
            data: { nome, mensagem, instance_id: instance_id || null },
        });
        res.json({ campaign });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar campanha" });
    }
});
// ── PATCH /api/campaigns/:id/stop ─────────────────────────────────────
router.patch("/:id/stop", async (req, res) => {
    const id = String(req.params.id);
    try {
        const existing = await prisma_1.default.campaign.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Campanha não encontrada" });
            return;
        }
        if (existing.status !== "EM_ANDAMENTO") {
            res.status(400).json({ error: "Só é possível parar campanhas em andamento" });
            return;
        }
        const campaign = await prisma_1.default.campaign.update({
            where: { id },
            data: { status: "ERRO", erro: "Cancelada pelo usuário" },
        });
        res.json({ campaign });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao parar campanha" });
    }
});
// ── DELETE /api/campaigns/:id ──────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    const id = String(req.params.id);
    try {
        const existing = await prisma_1.default.campaign.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Campanha não encontrada" });
            return;
        }
        await prisma_1.default.campaign.delete({ where: { id } });
        res.json({ message: "Campanha excluída" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao excluir campanha" });
    }
});
// ── Background: Campaign Sender ─────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function startCampaign(campaignId, userId, mensagem, instanceId, tagIds = [], leadIds = [], newTagName) {
    try {
        await prisma_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: "EM_ANDAMENTO", erro: null },
        });
        const settings = await (0, companySettings_1.getCompanySettings)();
        if (!settings?.evolution_api_url || !settings?.evolution_api_key)
            throw new Error("Evolution API não configurada");
        const instance = await prisma_1.default.instance.findUnique({ where: { id: instanceId } });
        if (!instance)
            throw new Error("Instância não encontrada");
        // Verificar se a instância está conectada antes de começar
        try {
            const evoRes = await axios_1.default.get(`${settings.evolution_api_url.replace(/\/$/, "")}/instance/connectionState/${instance.evolution_instance_id}`, { headers: { apikey: settings.evolution_api_key } });
            const state = evoRes.data?.instance?.state || evoRes.data?.state;
            if (!["open", "connected", "CONNECTED"].includes(state)) {
                throw new Error(`WhatsApp desconectado (Status: ${state})`);
            }
        }
        catch (e) {
            throw new Error("Erro ao verificar conexão ou WhatsApp desconectado: " + (e.message || "Unknown error"));
        }
        // Prepare filter
        const leadFilter = { telefone_limpo: { not: null } };
        if (leadIds.length > 0) {
            leadFilter.id = { in: leadIds };
        }
        else if (tagIds.length > 0) {
            leadFilter.tags = { some: { tag_id: { in: tagIds } } };
        }
        const leads = await prisma_1.default.lead.findMany({
            where: leadFilter,
            select: { id: true, nome: true, telefone_limpo: true, telefone: true, cidade: true },
        });
        // Create or find the participate tag if requested
        let participantTagId = null;
        if (newTagName && newTagName.trim()) {
            const sanitizedName = newTagName.trim();
            let tag = await prisma_1.default.tag.findFirst({
                where: { nome: { equals: sanitizedName, mode: 'insensitive' } }
            });
            if (!tag) {
                tag = await prisma_1.default.tag.create({
                    data: { user_id: userId, nome: sanitizedName, cor: "#10b981" }
                });
            }
            participantTagId = tag.id;
        }
        let sent = 0;
        let failed = 0;
        for (const lead of leads) {
            // Check cancellation — pára se o usuário cancelou ou se houve erro externo
            const camp = await prisma_1.default.campaign.findUnique({ where: { id: campaignId } });
            if (!camp || camp.status === "ERRO")
                break;
            try {
                const msg = mensagem
                    .replace(/\{\{nome\}\}/g, lead.nome || "")
                    .replace(/\{\{telefone\}\}/g, lead.telefone || "")
                    .replace(/\{\{cidade\}\}/g, lead.cidade || "");
                await axios_1.default.post(`${settings.evolution_api_url.replace(/\/$/, "")}/message/sendText/${instance.evolution_instance_id}`, { number: lead.telefone_limpo, text: msg }, { headers: { apikey: settings.evolution_api_key } });
                sent++;
                // Add tag to lead if requested
                if (participantTagId) {
                    await prisma_1.default.leadTag.upsert({
                        where: { lead_id_tag_id: { lead_id: lead.id, tag_id: participantTagId } },
                        create: { lead_id: lead.id, tag_id: participantTagId },
                        update: {},
                    }).catch(() => { });
                }
            }
            catch (err) {
                console.error(`Failed to send to ${lead.telefone_limpo}:`, err.response?.data || err.message);
                failed++;
            }
            await prisma_1.default.campaign.update({
                where: { id: campaignId },
                data: { sent, failed },
            });
            // Delay 3–6s
            await sleep(Math.floor(Math.random() * 3000) + 3000);
        }
        await prisma_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: "FINALIZADA", sent, failed },
        });
    }
    catch (error) {
        await prisma_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: "ERRO", erro: error.message },
        });
        console.error("Campaign failed:", error.message);
    }
}
exports.default = router;
//# sourceMappingURL=campaigns.js.map