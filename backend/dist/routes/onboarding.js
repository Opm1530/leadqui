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
function parseJson(s, fallback) {
    try {
        return s ? JSON.parse(s) : fallback;
    }
    catch {
        return fallback;
    }
}
// ── GET /api/onboarding/:clientId ─────────────────────────────────────
router.get("/:clientId", async (req, res) => {
    const client_id = String(req.params.clientId);
    const ob = await prisma_1.default.onboarding.findUnique({ where: { client_id } });
    res.json({
        onboarding: ob ? {
            ...ob,
            credentials: parseJson(ob.credentials, []),
            checklist: parseJson(ob.checklist, []),
        } : null,
    });
});
// ── PUT /api/onboarding/:clientId ─────────────────────────────────────
// Salva o formulário e distribui: senhas→Cofre, checklist→Tarefas, público→Tráfego
router.put("/:clientId", async (req, res) => {
    const client_id = String(req.params.clientId);
    const userId = req.user.id;
    const { store_name, store_link, audience } = req.body;
    let credentials = Array.isArray(req.body.credentials) ? req.body.credentials : [];
    let checklist = Array.isArray(req.body.checklist) ? req.body.checklist : [];
    try {
        const client = await prisma_1.default.client.findUnique({ where: { id: client_id } });
        if (!client) {
            res.status(404).json({ error: "Cliente não encontrado" });
            return;
        }
        const existing = await prisma_1.default.onboarding.findUnique({ where: { client_id } });
        let trafficCampaignId = existing?.traffic_campaign_id || null;
        let criadasSenhas = 0, criadasTarefas = 0;
        // 1. Senhas → Cofre (só as que ainda não foram para o cofre)
        for (const cred of credentials) {
            if (cred.vault_id)
                continue;
            if (!cred.password)
                continue;
            const { enc, iv, tag } = (0, vault_1.encrypt)(String(cred.password));
            const v = await prisma_1.default.vaultCredential.create({
                data: {
                    client_id, user_id: userId,
                    title: cred.label || "Acesso (onboarding)",
                    category: "OUTROS",
                    username: cred.email || null,
                    password_enc: enc, password_iv: iv, password_tag: tag,
                },
            });
            cred.vault_id = v.id;
            criadasSenhas++;
        }
        // 2. Checklist → Tarefas no quadro do cliente (só novas, não concluídas)
        for (const item of checklist) {
            if (item.task_id || !item.text)
                continue;
            if (item.done)
                continue; // não cria tarefa para item já marcado como feito
            const t = await prisma_1.default.task.create({
                data: {
                    client_id, project_id: null, title: item.text,
                    description: "Criada pelo onboarding do cliente",
                    status: "PENDENTE", priority: "MEDIA",
                },
            });
            item.task_id = t.id;
            criadasTarefas++;
        }
        // 3. Público → anotação no Tráfego (cria/atualiza um "briefing")
        if (audience && audience.trim()) {
            if (trafficCampaignId) {
                await prisma_1.default.trafficCampaign.update({
                    where: { id: trafficCampaignId }, data: { objective: audience.trim() },
                }).catch(() => { trafficCampaignId = null; });
            }
            if (!trafficCampaignId) {
                const tc = await prisma_1.default.trafficCampaign.create({
                    data: { client_id, name: "Briefing de Público (Onboarding)", objective: audience.trim(), status: "ATIVO" },
                });
                trafficCampaignId = tc.id;
            }
        }
        // 4. Salva o onboarding
        const data = {
            store_name: store_name || null,
            store_link: store_link || null,
            audience: audience || null,
            credentials: JSON.stringify(credentials),
            checklist: JSON.stringify(checklist),
            traffic_campaign_id: trafficCampaignId,
        };
        const ob = await prisma_1.default.onboarding.upsert({
            where: { client_id }, create: { client_id, ...data }, update: data,
        });
        res.json({
            onboarding: { ...ob, credentials, checklist },
            aplicado: { senhas: criadasSenhas, tarefas: criadasTarefas },
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=onboarding.js.map