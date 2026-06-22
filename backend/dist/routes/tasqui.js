"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const production_1 = require("../lib/production");
const approval_1 = require("../lib/approval");
const dates_1 = require("../lib/dates");
const router = (0, express_1.Router)();
// ── GET /api/tasqui/tasks ─────────────────────────────────────────────
router.get("/tasks", auth_1.authenticateJWT, async (req, res) => {
    const { clientId, projectId, status, archived } = req.query;
    try {
        const where = {};
        // Filtro básico de permissões
        if (req.user?.role === "CLIENT") {
            const client = await prisma_1.default.client.findFirst({ where: { login_user_id: req.user.id } });
            if (!client) {
                res.json([]);
                return;
            }
            where.client_id = client.id;
        }
        if (clientId)
            where.client_id = clientId;
        if (projectId)
            where.project_id = projectId;
        if (status)
            where.status = status;
        // Por padrão esconde arquivadas; ?archived=true mostra só as arquivadas
        where.archived = archived === "true";
        const tasks = await prisma_1.default.task.findMany({
            where,
            include: {
                project: { select: { name: true, type: true } },
                client: { select: { name: true } },
                responsible: { select: { name: true, id: true } }
            },
            orderBy: { due_date: "asc" }
        });
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
});
// ── POST /api/tasqui/tasks ────────────────────────────────────────────
router.post("/tasks", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role === "CLIENT") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { title, description, client_id, project_id, responsible_id, due_date, priority } = req.body;
    if (!title || !client_id) {
        res.status(400).json({ error: "Título e Cliente são obrigatórios" });
        return;
    }
    try {
        const task = await prisma_1.default.task.create({
            data: {
                title,
                description,
                client_id,
                project_id: project_id || null,
                responsible_id,
                due_date: (0, dates_1.dayDate)(due_date),
                priority: priority || "MEDIA"
            },
            include: {
                client: { select: { name: true } },
                project: { select: { name: true } }
            }
        });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar tarefa" });
    }
});
// ── PATCH /api/tasqui/tasks/:id ───────────────────────────────────────
router.patch("/tasks/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const taskId = String(id);
    const { status, responsible_id, title, description, due_date, priority, archived } = req.body;
    try {
        // Clientes só podem atualizar status das próprias tarefas
        if (req.user?.role === "CLIENT") {
            const client = await prisma_1.default.client.findFirst({ where: { login_user_id: req.user.id } });
            if (!client) {
                res.status(403).json({ error: "Acesso negado" });
                return;
            }
            const existing = await prisma_1.default.task.findFirst({ where: { id: taskId, client_id: client.id } });
            if (!existing) {
                res.status(404).json({ error: "Tarefa não encontrada" });
                return;
            }
            // Cliente só pode alterar status (não título, responsável, etc.)
            const task = await prisma_1.default.task.update({
                where: { id: taskId },
                data: {
                    ...(status && { status }),
                    ...(status === "CONCLUIDO" && { completed_at: new Date() }),
                },
            });
            res.json(task);
            return;
        }
        // Equipe interna: dados compartilhados pela empresa — qualquer staff edita.
        const existing = await prisma_1.default.task.findFirst({ where: { id: taskId } });
        if (!existing) {
            res.status(404).json({ error: "Tarefa não encontrada" });
            return;
        }
        const task = await prisma_1.default.task.update({
            where: { id: taskId },
            data: {
                status,
                responsible_id,
                title,
                description,
                priority,
                due_date: due_date ? (0, dates_1.dayDate)(due_date) : undefined,
                completed_at: status === "CONCLUIDO" ? new Date() : undefined,
                ...(archived !== undefined && { archived: !!archived }),
            },
        });
        res.json(task);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar tarefa" });
    }
});
// ── GET /api/tasqui/projects ──────────────────────────────────────────
router.get("/projects", auth_1.authenticateJWT, async (req, res) => {
    const { clientId, status } = req.query;
    try {
        const where = {};
        if (clientId)
            where.client_id = clientId;
        if (status && status !== "TODOS")
            where.status = status;
        const projects = await prisma_1.default.project.findMany({
            where,
            include: {
                client: { select: { name: true } },
                _count: { select: { tasks: true } }
            }
        });
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar projetos" });
    }
});
// ── POST /api/tasqui/projects ─────────────────────────────────────────
router.post("/projects", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role === "CLIENT") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { client_id, name, description, type, status } = req.body;
    if (!client_id || !name) {
        res.status(400).json({ error: "client_id e name são obrigatórios" });
        return;
    }
    try {
        const project = await prisma_1.default.project.create({
            data: { client_id, name, description: description || null, type: type || "UNICO", status: status || "ATIVO" },
            include: { client: { select: { name: true } }, _count: { select: { tasks: true } } },
        });
        res.status(201).json(project);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar projeto" });
    }
});
// ── PATCH /api/tasqui/projects/:id ────────────────────────────────────
router.patch("/projects/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { status, name, description } = req.body;
    try {
        const project = await prisma_1.default.project.update({
            where: { id: String(id) },
            data: {
                status,
                name,
                description
            }
        });
        // Se o projeto for concluído, podemos concluir as tarefas pendentes também
        if (status === "CONCLUIDO") {
            await prisma_1.default.task.updateMany({
                where: { project_id: String(id), status: { not: "CONCLUIDO" } },
                data: {
                    status: "CONCLUIDO",
                    completed_at: new Date()
                }
            });
        }
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar projeto" });
    }
});
// ── GET /api/tasqui/stats ─────────────────────────────────────────────
router.get("/stats", auth_1.authenticateJWT, async (req, res) => {
    try {
        const [tasks, projectsCount] = await Promise.all([
            prisma_1.default.task.findMany({
                select: {
                    status: true,
                    created_at: true,
                    responsible_id: true,
                    client_id: true,
                    responsible: { select: { name: true } },
                    client: { select: { name: true } },
                },
            }),
            prisma_1.default.project.count({ where: { status: "ATIVO" } }),
        ]);
        // ── Totais simples ──────────────────────────────────────────────
        const totalTasks = tasks.length;
        const completed = tasks.filter((t) => t.status === "CONCLUIDO").length;
        const inProgress = tasks.filter((t) => t.status === "EM_ANDAMENTO").length;
        const pending = tasks.filter((t) => t.status === "PENDENTE").length;
        const completionRate = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;
        // ── Por membro ─────────────────────────────────────────────────
        const memberMap = {};
        for (const t of tasks) {
            if (!t.responsible_id)
                continue;
            if (!memberMap[t.responsible_id]) {
                memberMap[t.responsible_id] = {
                    name: t.responsible?.name || "Sem nome",
                    total: 0, concluido: 0, em_andamento: 0, pendente: 0,
                };
            }
            memberMap[t.responsible_id].total++;
            if (t.status === "CONCLUIDO")
                memberMap[t.responsible_id].concluido++;
            else if (t.status === "EM_ANDAMENTO")
                memberMap[t.responsible_id].em_andamento++;
            else if (t.status === "PENDENTE")
                memberMap[t.responsible_id].pendente++;
        }
        const tasksByMember = Object.values(memberMap).sort((a, b) => b.total - a.total);
        // ── Por cliente (top 8) ────────────────────────────────────────
        const clientMap = {};
        for (const t of tasks) {
            if (!t.client_id)
                continue;
            if (!clientMap[t.client_id]) {
                clientMap[t.client_id] = { name: t.client?.name || "Sem nome", total: 0, concluido: 0 };
            }
            clientMap[t.client_id].total++;
            if (t.status === "CONCLUIDO")
                clientMap[t.client_id].concluido++;
        }
        const tasksByClient = Object.values(clientMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);
        // ── Evolução mensal (últimos 6 meses) ──────────────────────────
        const now = new Date();
        const monthlyCompletion = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
            const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "") + "/" + String(d.getFullYear()).slice(2);
            const inMonth = tasks.filter((t) => new Date(t.created_at) >= d && new Date(t.created_at) <= end);
            return {
                month: label,
                criadas: inMonth.length,
                concluidas: inMonth.filter((t) => t.status === "CONCLUIDO").length,
            };
        });
        // ── Distribuição por status ────────────────────────────────────
        const statusDist = [
            { status: "Pendente", value: pending, fill: "#eab308" },
            { status: "Em Andamento", value: inProgress, fill: "#3b82f6" },
            { status: "Revisão", value: tasks.filter((t) => t.status === "REVISAO").length, fill: "#f97316" },
            { status: "Concluído", value: completed, fill: "#22c55e" },
            { status: "Cancelado", value: tasks.filter((t) => t.status === "CANCELADO").length, fill: "#6b7280" },
        ].filter(s => s.value > 0);
        res.json({
            totalTasks, pending, inProgress, completed, activeProjects: projectsCount, completionRate,
            tasksByMember, tasksByClient, monthlyCompletion, statusDist,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao calcular estatísticas" });
    }
});
// ── GET /api/tasqui/calendar ──────────────────────────────────────────
router.get("/calendar", auth_1.authenticateJWT, async (req, res) => {
    const { client_id, month, year } = req.query;
    try {
        const where = {};
        if (req.user?.role === "CLIENT") {
            const client = await prisma_1.default.client.findFirst({ where: { login_user_id: req.user.id } });
            if (!client) {
                res.json([]);
                return;
            }
            where.client_id = client.id;
        }
        else if (client_id) {
            where.client_id = client_id;
        }
        if (month && year) {
            const start = new Date(Number(year), Number(month) - 1, 1);
            const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
            where.scheduled_date = { gte: start, lte: end };
        }
        const posts = await prisma_1.default.calendarPost.findMany({
            where,
            include: { client: { select: { name: true } } },
            orderBy: { scheduled_date: "asc" },
        });
        res.json(posts);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar calendário" });
    }
});
// ── POST /api/tasqui/calendar ─────────────────────────────────────────
router.post("/calendar", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role === "CLIENT") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { client_id, project_id, title, content, type, platform, scheduled_date, status } = req.body;
    // Card vazio: exige só cliente + formato + dia. Título e conteúdo são opcionais.
    if (!client_id || !scheduled_date) {
        res.status(400).json({ error: "client_id e scheduled_date são obrigatórios" });
        return;
    }
    try {
        const post = await prisma_1.default.calendarPost.create({
            data: {
                client_id,
                project_id: project_id || null,
                title: title || null,
                content: content || null,
                type: type || "POST",
                platform: platform || "INSTAGRAM",
                scheduled_date: (0, dates_1.dayDate)(scheduled_date),
                status: status || "PLANEJADO",
            },
            include: { client: { select: { name: true } } },
        });
        res.status(201).json(post);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar post" });
    }
});
// ── PATCH /api/tasqui/calendar/:id ────────────────────────────────────
router.patch("/calendar/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { title, content, type, platform, scheduled_date, status } = req.body;
    try {
        const post = await prisma_1.default.calendarPost.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(content !== undefined && { content }),
                ...(type && { type }),
                ...(platform && { platform }),
                ...(scheduled_date && { scheduled_date: (0, dates_1.dayDate)(scheduled_date) }),
                ...(status && { status }),
            },
            include: { client: { select: { name: true } } },
        });
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar post" });
    }
});
// ── DELETE /api/tasqui/calendar/:id ──────────────────────────────────
router.delete("/calendar/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.calendarPost.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao deletar post" });
    }
});
// ── POST /api/tasqui/calendar/:id/send-production ─────────────────────
// Envia para produção: status PRODUZINDO + card Trello + tarefa Tasqui
router.post("/calendar/:id/send-production", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { trello_list_id, trello_member_ids, trello_label_ids, responsible_id } = req.body || {};
    try {
        const { post, trello, task } = await (0, production_1.sendPostToProduction)(String(id), {
            trello_list_id,
            trello_member_ids,
            trello_label_ids,
            responsible_id,
        });
        res.json({ success: true, post, trello, task, trello_url: trello?.shortUrl || null });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/tasqui/calendar/:id/send-approval ───────────────────────
// Envia a arte + legenda + enquete para o grupo do cliente no WhatsApp
router.post("/calendar/:id/send-approval", auth_1.authenticateJWT, async (req, res) => {
    try {
        await (0, approval_1.sendApprovalToGroup)(String(req.params.id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── GET /api/tasqui/traffic ───────────────────────────────────────────
router.get("/traffic", auth_1.authenticateJWT, async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (req.user?.role === "CLIENT") {
            const client = await prisma_1.default.client.findFirst({ where: { login_user_id: req.user.id } });
            if (!client) {
                res.json([]);
                return;
            }
            where.client_id = client.id;
        }
        else if (client_id) {
            where.client_id = client_id;
        }
        const campaigns = await prisma_1.default.trafficCampaign.findMany({
            where,
            include: { client: { select: { name: true } }, project: { select: { name: true } } },
            orderBy: { created_at: "desc" },
        });
        res.json(campaigns);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar campanhas de tráfego" });
    }
});
// ── POST /api/tasqui/traffic ──────────────────────────────────────────
router.post("/traffic", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role === "CLIENT") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { client_id, project_id, name, objective, budget, status, start_date, end_date } = req.body;
    if (!client_id || !name) {
        res.status(400).json({ error: "client_id e name são obrigatórios" });
        return;
    }
    try {
        const campaign = await prisma_1.default.trafficCampaign.create({
            data: {
                client_id,
                project_id: project_id || null,
                name,
                objective: objective || null,
                budget: budget ? parseFloat(budget) : null,
                status: status || "ATIVO",
                start_date: (0, dates_1.dayDate)(start_date),
                end_date: (0, dates_1.dayDate)(end_date),
            },
            include: { client: { select: { name: true } } },
        });
        res.status(201).json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao criar campanha" });
    }
});
// ── PATCH /api/tasqui/traffic/:id ────────────────────────────────────
router.patch("/traffic/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { name, objective, budget, status, start_date, end_date } = req.body;
    try {
        const campaign = await prisma_1.default.trafficCampaign.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(objective !== undefined && { objective }),
                ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
                ...(status && { status }),
                ...(start_date !== undefined && { start_date: (0, dates_1.dayDate)(start_date) }),
                ...(end_date !== undefined && { end_date: (0, dates_1.dayDate)(end_date) }),
            },
            include: { client: { select: { name: true } } },
        });
        res.json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao atualizar campanha" });
    }
});
// ── DELETE /api/tasqui/traffic/:id ───────────────────────────────────
router.delete("/traffic/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.trafficCampaign.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao deletar campanha" });
    }
});
// ── Meta Ads: métricas de uma campanha vinculada ──────────────────────
router.get("/traffic/:id/meta-metrics", auth_1.authenticateJWT, async (req, res) => {
    const id = String(req.params.id);
    const { date_preset = "last_7d" } = req.query;
    try {
        const campaign = await prisma_1.default.trafficCampaign.findUnique({
            where: { id },
            include: { client: { include: { meta_connection: true } } },
        });
        if (!campaign?.meta_campaign_id) {
            res.status(400).json({ error: "Campanha não vinculada ao Meta Ads" });
            return;
        }
        const conn = campaign.client?.meta_connection;
        if (!conn?.access_token) {
            res.status(400).json({ error: "Cliente sem conexão Meta configurada" });
            return;
        }
        const fields = `id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(${date_preset}){spend,impressions,clicks,ctr,cpc,reach,frequency,actions,purchase_roas}`;
        const resp = await axios_1.default.get(`https://graph.facebook.com/v20.0/${campaign.meta_campaign_id}`, {
            params: { fields, access_token: conn.access_token },
        });
        res.json(resp.data);
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
});
// ── Meta Ads: listar campanhas disponíveis para vincular ──────────────
router.get("/traffic/meta-campaigns/:clientId", auth_1.authenticateJWT, async (req, res) => {
    const clientId = String(req.params.clientId);
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { client_id: clientId } });
        if (!conn?.ad_account_id || !conn?.access_token) {
            res.status(400).json({ error: "Cliente sem Ad Account configurado" });
            return;
        }
        const resp = await axios_1.default.get(`https://graph.facebook.com/v20.0/${conn.ad_account_id}/campaigns`, {
            params: { fields: "id,name,status,objective", access_token: conn.access_token, limit: 50 },
        });
        res.json(resp.data);
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
});
// ── Calendário: publicar post no Instagram ────────────────────────────
router.post("/calendar/:id/publish-instagram", auth_1.authenticateJWT, async (req, res) => {
    if (req.user?.role === "CLIENT") {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    const { scheduled_at, media_urls, media_type } = req.body;
    if (!scheduled_at || !media_urls?.length) {
        res.status(400).json({ error: "scheduled_at e media_urls são obrigatórios" });
        return;
    }
    try {
        const post = await prisma_1.default.calendarPost.findUnique({
            where: { id },
            include: { client: { include: { meta_connection: true } } },
        });
        if (!post) {
            res.status(404).json({ error: "Post não encontrado" });
            return;
        }
        const conn = post.client?.meta_connection;
        if (!conn?.id) {
            res.status(400).json({ error: "Cliente sem conta Instagram conectada. Configure em TechQui → Conexões." });
            return;
        }
        // Criar InstagramScheduledPost
        const igPost = await prisma_1.default.instagramScheduledPost.create({
            data: {
                connection_id: conn.id,
                client_id: post.client_id,
                caption: post.content || post.title || null,
                media_urls: JSON.stringify(media_urls),
                media_type: media_type || (post.type === "REEL" ? "REELS" : post.type === "CARROSSEL" ? "CAROUSEL" : "IMAGE"),
                scheduled_at: new Date(scheduled_at),
                status: "AGENDADO",
            },
        });
        // Vincular ao CalendarPost + salvar media_urls + marcar como agendado
        await prisma_1.default.calendarPost.update({
            where: { id },
            data: {
                instagram_post_id: igPost.id,
                media_urls: JSON.stringify(media_urls),
                status: "PUBLICADO", // Agendado para publicação
            },
        });
        res.status(201).json({ instagram_post: igPost });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=tasqui.js.map