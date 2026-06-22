"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middlewares/auth");
const extractionService_1 = require("../lib/extractionService");
const companySettings_1 = require("../lib/companySettings");
const teamDigest_1 = require("../lib/teamDigest");
const dates_1 = require("../lib/dates");
// Helper para automação do Tasqui
// Cria projetos por serviço e aplica template de tarefas se fornecido
async function createOperationalFlow(clientId, services, isUniqueJob = false, uniqueJobName, templateId, userId) {
    try {
        const servicesToProcess = isUniqueJob && uniqueJobName ? [uniqueJobName] : services;
        for (const serviceName of servicesToProcess) {
            // 1. Criar/buscar projeto para este serviço
            let project = await prisma_1.default.project.findFirst({
                where: { client_id: clientId, name: serviceName },
            });
            if (!project) {
                project = await prisma_1.default.project.create({
                    data: {
                        client_id: clientId,
                        name: serviceName,
                        status: "ATIVO",
                        type: isUniqueJob ? "UNICO" : "RECORRENTE",
                    },
                });
            }
            // 2. Se templateId informado E pertence ao usuário → usar itens do template
            if (templateId && userId) {
                const template = await prisma_1.default.taskTemplate.findFirst({
                    where: { id: templateId },
                    include: { items: { orderBy: { order: "asc" } } },
                });
                if (template && template.items.length > 0) {
                    const now = new Date();
                    for (const item of template.items) {
                        const alreadyExists = await prisma_1.default.task.findFirst({
                            where: { project_id: project.id, title: item.title },
                        });
                        if (alreadyExists)
                            continue;
                        const dueDate = item.due_days_offset > 0
                            ? new Date(now.getTime() + item.due_days_offset * 86400000)
                            : null;
                        await prisma_1.default.task.create({
                            data: {
                                client_id: clientId,
                                project_id: project.id,
                                title: item.title,
                                description: item.description || null,
                                priority: item.priority,
                                due_date: dueDate,
                                status: "PENDENTE",
                            },
                        });
                    }
                    continue; // template aplicado, pular auto-templates legados
                }
            }
            // 3. Fallback: buscar templates auto-associados ao nome do serviço (legado)
            if (userId) {
                const autoTemplates = await prisma_1.default.taskTemplate.findMany({
                    where: { service: serviceName },
                    include: { items: { orderBy: { order: "asc" } } },
                });
                const now = new Date();
                for (const tpl of autoTemplates) {
                    for (const item of tpl.items) {
                        const alreadyExists = await prisma_1.default.task.findFirst({
                            where: { project_id: project.id, title: item.title },
                        });
                        if (alreadyExists)
                            continue;
                        const dueDate = item.due_days_offset > 0
                            ? new Date(now.getTime() + item.due_days_offset * 86400000)
                            : null;
                        await prisma_1.default.task.create({
                            data: {
                                client_id: clientId,
                                project_id: project.id,
                                title: item.title,
                                description: item.description || null,
                                priority: item.priority,
                                due_date: dueDate,
                                status: "PENDENTE",
                            },
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Erro ao criar fluxo operacional:", error);
    }
}
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
// Dados compartilhados pela equipe (bloqueia CLIENT), exceto rotas pessoais
router.use((req, res, next) => {
    if (req.path === "/settings" || req.path === "/me/client-profile")
        return next();
    return (0, auth_1.requireStaff)(req, res, next);
});
// ─── TAGS ─────────────────────────────────────────────────────────────
router.get("/tags", async (req, res) => {
    try {
        const tags = await prisma_1.default.tag.findMany({
            orderBy: { nome: "asc" },
        });
        res.json({ tags });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar tags" });
    }
});
router.post("/tags", async (req, res) => {
    const { nome, cor } = req.body;
    if (!nome) {
        res.status(400).json({ error: "Nome é obrigatório" });
        return;
    }
    try {
        const tag = await prisma_1.default.tag.create({
            data: {
                user_id: req.user.id,
                nome,
                cor: cor || "#6366f1",
            },
        });
        res.status(201).json({ tag });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar tag" });
    }
});
router.put("/tags/:id", async (req, res) => {
    const id = String(req.params.id);
    const { nome, cor } = req.body;
    try {
        const existing = await prisma_1.default.tag.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Tag não encontrada" });
            return;
        }
        const tag = await prisma_1.default.tag.update({
            where: { id },
            data: { nome: nome || existing.nome, cor: cor || existing.cor },
        });
        res.json({ tag });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar tag" });
    }
});
router.delete("/tags/:id", async (req, res) => {
    const id = String(req.params.id);
    try {
        const existing = await prisma_1.default.tag.findFirst({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Tag não encontrada" });
            return;
        }
        await prisma_1.default.tag.delete({ where: { id } });
        res.json({ message: "Tag excluída" });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao excluir tag" });
    }
});
// ─── CLIENTS ──────────────────────────────────────────────────────────
router.get("/clients", async (req, res) => {
    const { search } = req.query;
    const where = {};
    if (search)
        where.name = { contains: String(search) };
    const clients = await prisma_1.default.client.findMany({
        where,
        include: { contract: true, services: true, projects: true },
        orderBy: { created_at: "desc" },
    });
    res.json({ clients });
});
router.post("/clients", async (req, res) => {
    const { name, email, origin_lead_id, contract, services = [], initial_password, isUniqueJob, uniqueJobName, template_id } = req.body;
    if (!name) {
        res.status(400).json({ error: "Nome é obrigatório" });
        return;
    }
    try {
        let login_user_id = null;
        if (email && initial_password) {
            const existingUser = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
            if (existingUser) {
                login_user_id = existingUser.id;
            }
            else {
                const hash = await bcryptjs_1.default.hash(initial_password, 12);
                const newUser = await prisma_1.default.user.create({
                    data: {
                        name,
                        email: email.toLowerCase().trim(),
                        password_hash: hash,
                        role: "CLIENT"
                    }
                });
                login_user_id = newUser.id;
            }
        }
        const client = await prisma_1.default.client.create({
            data: {
                user_id: req.user.id,
                login_user_id,
                name,
                email: email || null,
                initial_password: initial_password || null,
                status: "ATIVO",
                ...(contract && {
                    contract: {
                        create: {
                            value: parseFloat(contract.value),
                            start_date: contract.start_date,
                            duration: parseInt(contract.duration || "0"),
                            responsible: contract.responsible || null,
                        },
                    },
                }),
                ...(services.length > 0 && !isUniqueJob && {
                    services: {
                        create: services.map((s) => ({ service: s, status: "ATIVO" })),
                    },
                }),
            },
            include: { contract: true, services: true },
        });
        // Update lead status if origin_lead_id
        if (origin_lead_id) {
            await prisma_1.default.lead.update({
                where: { id: origin_lead_id },
                data: { status: "CONVERTIDO", client_id: client.id },
            }).catch(() => { }); // ignore if lead doesn't exist
        }
        // (Removido) Automação Tasqui de criar projetos/tarefas por serviço.
        // As tarefas agora nascem manualmente no Tasqui (um único lugar), por cliente.
        // Automação CashQui — gerar primeira fatura automaticamente
        if (contract && contract.value) {
            const dueDate = (0, dates_1.dayDate)(contract.start_date) || new Date();
            dueDate.setDate(dueDate.getDate() + (isUniqueJob ? 0 : 30));
            const description = isUniqueJob
                ? (uniqueJobName || "Job único")
                : `Mensalidade — ${new Date(dueDate).toLocaleString("pt-BR", { month: "long", year: "numeric" })}`;
            await prisma_1.default.invoice.create({
                data: {
                    client_id: client.id,
                    description,
                    amount: parseFloat(contract.value),
                    due_date: dueDate,
                    status: "PENDENTE",
                },
            }).catch(() => { }); // não bloquear se falhar
        }
        res.status(201).json({ client });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── POST /api/clients/:id/nova-venda ─────────────────────────────────
// Adiciona uma nova venda (projeto + fatura) a um cliente já existente
router.post("/clients/:id/nova-venda", async (req, res) => {
    const clientId = String(req.params.id);
    const { isUniqueJob, jobName, value, due_date, template_id } = req.body;
    if (!value || !jobName) {
        res.status(400).json({ error: "Valor e nome do serviço são obrigatórios" });
        return;
    }
    try {
        // Verifica ownership do cliente
        const client = await prisma_1.default.client.findFirst({
            where: { id: clientId },
        });
        if (!client) {
            res.status(404).json({ error: "Cliente não encontrado" });
            return;
        }
        // 1. Criar projeto
        const project = await prisma_1.default.project.create({
            data: {
                client_id: clientId,
                name: jobName,
                status: "ATIVO",
                type: isUniqueJob ? "UNICO" : "RECORRENTE",
            },
        });
        // 2. Aplicar template se informado
        if (template_id) {
            const template = await prisma_1.default.taskTemplate.findFirst({
                where: { id: template_id },
                include: { items: { orderBy: { order: "asc" } } },
            });
            if (template?.items?.length) {
                const now = new Date();
                for (const item of template.items) {
                    const dueDate = item.due_days_offset > 0
                        ? new Date(now.getTime() + item.due_days_offset * 86400000)
                        : null;
                    await prisma_1.default.task.create({
                        data: {
                            client_id: clientId,
                            project_id: project.id,
                            title: item.title,
                            description: item.description || null,
                            priority: item.priority,
                            due_date: dueDate,
                            status: "PENDENTE",
                        },
                    });
                }
            }
        }
        // 3. Gerar fatura
        const invoiceDue = due_date ? new Date(due_date) : new Date();
        const invoice = await prisma_1.default.invoice.create({
            data: {
                client_id: clientId,
                description: jobName,
                amount: parseFloat(value),
                due_date: invoiceDue,
                status: "PENDENTE",
            },
        });
        // 4. Reativar cliente se estava inativo
        if (client.status === "INATIVO") {
            await prisma_1.default.client.update({
                where: { id: clientId },
                data: { status: "ATIVO" },
            });
        }
        res.status(201).json({ success: true, project, invoice });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put("/clients/:id", async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma_1.default.client.findFirst({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
    }
    try {
        const { name, email, status, contract, services, initial_password, wa_instance_id, wa_group_id, wa_group_name, drive_url } = req.body;
        // Sincronizar usuário de acesso se houver e-mail
        let login_user_id = existing.login_user_id;
        if (email && email !== existing.email) {
            const userWithEmail = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
            if (userWithEmail) {
                login_user_id = userWithEmail.id;
            }
            else if (existing.login_user_id) {
                // Atualizar e-mail do usuário de acesso atual
                await prisma_1.default.user.update({ where: { id: existing.login_user_id }, data: { email: email.toLowerCase().trim() } });
            }
        }
        if (initial_password && initial_password !== existing.initial_password && login_user_id) {
            const hash = await bcryptjs_1.default.hash(initial_password, 12);
            await prisma_1.default.user.update({ where: { id: login_user_id }, data: { password_hash: hash } });
        }
        const client = await prisma_1.default.client.update({
            where: { id },
            data: {
                name: name || existing.name,
                email: email !== undefined ? email : existing.email,
                initial_password: initial_password !== undefined ? initial_password : existing.initial_password,
                status: status || existing.status,
                login_user_id,
                ...(wa_instance_id !== undefined && { wa_instance_id: wa_instance_id || null }),
                ...(wa_group_id !== undefined && { wa_group_id: wa_group_id || null }),
                ...(wa_group_name !== undefined && { wa_group_name: wa_group_name || null }),
                ...(drive_url !== undefined && { drive_url: drive_url || null }),
            },
            include: { contract: true, services: true }
        });
        if (contract) {
            await prisma_1.default.contract.upsert({
                where: { client_id: id },
                create: { client_id: id, value: parseFloat(contract.value), start_date: contract.start_date, duration: parseInt(contract.duration), responsible: contract.responsible },
                update: { value: parseFloat(contract.value), start_date: contract.start_date, duration: parseInt(contract.duration), responsible: contract.responsible },
            });
        }
        if (services !== undefined) {
            await prisma_1.default.clientService.deleteMany({ where: { client_id: id } });
            if (services.length > 0) {
                await prisma_1.default.clientService.createMany({
                    data: services.map((s) => ({ client_id: id, service: s, status: "ATIVO" })),
                });
                // (Removido) automação de projetos/tarefas — tasks nascem manualmente no Tasqui.
            }
        }
        const updated = await prisma_1.default.client.findUnique({ where: { id }, include: { contract: true, services: true } });
        res.json({ client: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete("/clients/:id", async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma_1.default.client.findFirst({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
    }
    try {
        // 1. Preservar histórico de faturas: salvar nome do cliente e desligar a FK
        await prisma_1.default.invoice.updateMany({
            where: { client_id: id },
            data: { client_name_snapshot: existing.name, client_id: null },
        });
        // 2. Desvincular leads (mantém o lead, só remove a referência ao cliente)
        await prisma_1.default.lead.updateMany({
            where: { client_id: id },
            data: { client_id: null },
        });
        // 3. Excluir dados operacionais em ordem segura
        // Tarefas
        await prisma_1.default.task.deleteMany({ where: { client_id: id } });
        // Posts do calendário
        await prisma_1.default.calendarPost.deleteMany({ where: { client_id: id } });
        // Campanhas de tráfego
        await prisma_1.default.trafficCampaign.deleteMany({ where: { client_id: id } });
        // Projetos (tasks já foram removidas acima)
        await prisma_1.default.project.deleteMany({ where: { client_id: id } });
        // Cofre de senhas
        await prisma_1.default.vaultCredential.deleteMany({ where: { client_id: id } });
        // Sugestões do agente de Ads
        await prisma_1.default.metaAgentSuggestion.deleteMany({ where: { client_id: id } });
        // Análises de Ads
        await prisma_1.default.metaAdsAnalysis.deleteMany({ where: { client_id: id } });
        // Regras de comentários
        await prisma_1.default.instagramCommentRule.deleteMany({ where: { client_id: id } });
        // Logs de comentários
        await prisma_1.default.instagramCommentLog.deleteMany({ where: { client_id: id } });
        // Posts agendados
        await prisma_1.default.instagramScheduledPost.deleteMany({ where: { client_id: id } });
        // Conexão Meta (cascade cuida dos filhos restantes)
        await prisma_1.default.clientMetaConnection.deleteMany({ where: { client_id: id } });
        // Serviços e contrato
        await prisma_1.default.clientService.deleteMany({ where: { client_id: id } });
        await prisma_1.default.contract.deleteMany({ where: { client_id: id } });
        // Cards do CRM que referenciam leads deste cliente
        await prisma_1.default.cRMCard.deleteMany({
            where: { lead: { client_id: null } },
        });
        // 4. Excluir o usuário de acesso do cliente (login ViewQui)
        if (existing.login_user_id) {
            await prisma_1.default.user.delete({ where: { id: existing.login_user_id } }).catch(() => { });
        }
        // 5. Excluir o cliente
        await prisma_1.default.client.delete({ where: { id } });
        res.json({ message: "Cliente excluído com sucesso" });
    }
    catch (error) {
        console.error("Delete client error:", error);
        res.status(500).json({ error: "Erro ao excluir cliente: " + error.message });
    }
});
// ─── SETTINGS ─────────────────────────────────────────────────────────
router.get("/settings", async (req, res) => {
    // Configurações compartilhadas pela empresa (registro do admin fundador)
    const ownerId = (await (0, companySettings_1.getCompanySettingsUserId)()) || req.user.id;
    const settings = await prisma_1.default.userSettings.findUnique({ where: { user_id: ownerId } });
    const masked = settings ? {
        ...settings,
        serper_api_key: settings.serper_api_key ? "••••••••" : null,
        apify_api_key: settings.apify_api_key ? "••••••••" : null,
        openai_api_key: settings.openai_api_key ? "••••••••" : null,
        anthropic_api_key: settings.anthropic_api_key ? "••••••••" : null,
        evolution_api_key: settings.evolution_api_key ? "••••••••" : null,
    } : null;
    res.json({ settings: masked });
});
router.put("/settings", async (req, res) => {
    const data = req.body;
    Object.keys(data).forEach((k) => { if (data[k] === "••••••••")
        delete data[k]; });
    // Grava sempre no registro compartilhado da empresa
    const ownerId = (await (0, companySettings_1.getCompanySettingsUserId)()) || req.user.id;
    const settings = await prisma_1.default.userSettings.upsert({
        where: { user_id: ownerId },
        create: { user_id: ownerId, ...data },
        update: data,
    });
    res.json({ settings: { ...settings, serper_api_key: settings.serper_api_key ? "••••••••" : null } });
});
// Dispara uma notificação de teste no grupo da equipe
router.post("/settings/test-notification", async (_req, res) => {
    try {
        const result = await (0, teamDigest_1.sendTeamDigestTest)();
        res.json({ success: true, ...result });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ─── DASHBOARD STATS ──────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
    const userId = req.user.id;
    const [totalLeads, totalClients, totalCampaigns, leadsThisMonth] = await Promise.all([
        prisma_1.default.lead.count(),
        prisma_1.default.client.count(),
        prisma_1.default.campaign.count(),
        prisma_1.default.lead.count({
            where: {
                created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
        }),
    ]);
    res.json({ totalLeads, totalClients, totalCampaigns, leadsThisMonth });
});
// ─── EXTRACTIONS ───────────────────────────────────────────────────────
router.get("/extractions", async (req, res) => {
    const limit = parseInt(String(req.query.limit || "20"));
    const extractions = await prisma_1.default.extraction.findMany({
        orderBy: { created_at: "desc" },
        take: limit,
    });
    res.json({ extractions });
});
router.get("/extractions/:id", async (req, res) => {
    const id = String(req.params.id);
    const extraction = await prisma_1.default.extraction.findFirst({ where: { id } });
    if (!extraction) {
        res.status(404).json({ error: "Extração não encontrada" });
        return;
    }
    res.json({ extraction });
});
router.post("/extractions", async (req, res) => {
    const { tipo, categoria, cidade, hashtag, quantidade, tag_id } = req.body;
    if (!tipo) {
        res.status(400).json({ error: "Tipo é obrigatório" });
        return;
    }
    const parametros = tipo === "GOOGLE_MAPS"
        ? JSON.stringify({ categoria, cidade, quantidade })
        : JSON.stringify({ hashtag, quantidade });
    const extraction = await prisma_1.default.extraction.create({
        data: {
            user_id: req.user.id,
            tipo: tipo,
            parametros,
            status: "PENDENTE",
            total_leads: 0,
        },
    });
    // Disparar o processo em segundo plano (background)
    if (tipo === "GOOGLE_MAPS") {
        (0, extractionService_1.startGoogleMapsExtraction)(extraction.id, req.user.id, { categoria, cidade, quantidade, tag_id });
    }
    else if (tipo === "INSTAGRAM") {
        (0, extractionService_1.startInstagramExtraction)(extraction.id, req.user.id, { hashtag, quantidade, tag_id });
    }
    res.status(201).json({ extraction });
});
router.put("/extractions/:id", async (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body;
    const existing = await prisma_1.default.extraction.findFirst({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: "Extração não encontrada" });
        return;
    }
    const extraction = await prisma_1.default.extraction.update({
        where: { id },
        data: { status: status || existing.status },
    });
    res.json({ extraction });
});
router.delete("/extractions/:id", async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma_1.default.extraction.findFirst({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: "Extração não encontrada" });
        return;
    }
    await prisma_1.default.extraction.delete({ where: { id } });
    res.json({ message: "Extração excluída do histórico" });
});
// ─── CLIENT PROFILE FOR HUB ───────────────────────────────────────────
router.get("/me/client-profile", async (req, res) => {
    try {
        if (req.user?.role === "CLIENT") {
            const client = await prisma_1.default.client.findFirst({
                where: { login_user_id: req.user.id },
                include: { services: true }
            });
            res.json({ client });
        }
        else {
            res.status(403).json({ error: "Acesso negado" });
        }
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar perfil" });
    }
});
exports.default = router;
//# sourceMappingURL=resources.js.map