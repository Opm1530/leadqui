"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const storage_1 = require("../lib/storage");
const dates_1 = require("../lib/dates");
const editorialMedia_1 = require("../lib/editorialMedia");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const isStaff = (r) => ["ADMIN", "MANAGER", "OPERATOR"].includes(r || "");
const canManage = (r) => ["ADMIN", "MANAGER"].includes(r || "");
// Mapeia o status do conteúdo para o status da tarefa vinculada
function taskStatusFor(contentStatus) {
    switch (contentStatus) {
        case "EM_APROVACAO": return "REVISAO";
        case "AGUARDANDO_POSTAR":
        case "POSTADO": return "CONCLUIDO";
        case "AJUSTES":
        case "EM_PRODUCAO":
        default: return "PENDENTE";
    }
}
async function syncTask(contentId) {
    const c = await prisma_1.default.editorialContent.findUnique({ where: { id: contentId } });
    if (!c?.task_id)
        return;
    await prisma_1.default.task.update({
        where: { id: c.task_id },
        data: {
            status: taskStatusFor(c.status),
            responsible_id: c.responsible_id,
            ...(c.status === "AGUARDANDO_POSTAR" || c.status === "POSTADO" ? { completed_at: new Date() } : { completed_at: null }),
        },
    }).catch(() => { });
}
async function notify(userId, title, message, refId) {
    if (!userId)
        return;
    await prisma_1.default.notification.create({
        data: { user_id: userId, type: "EDITORIAL", title, message, link: "/editorial", reference_id: refId },
    }).catch(() => { });
}
const include = {
    client: { select: { id: true, name: true } },
    responsible: { select: { id: true, name: true } },
    creator: { select: { id: true, name: true } },
};
// Anexa o status do post agendado (AGENDADO/PUBLICADO/ERRO) a cada conteúdo
async function attachScheduleStatus(items) {
    const ids = items.map(i => i.id);
    if (!ids.length)
        return;
    const posts = await prisma_1.default.instagramScheduledPost.findMany({
        where: { editorial_content_id: { in: ids } },
        orderBy: { created_at: "desc" },
        select: { editorial_content_id: true, status: true, error_message: true, scheduled_at: true, published_at: true },
    });
    const byContent = {};
    for (const p of posts)
        if (!byContent[p.editorial_content_id])
            byContent[p.editorial_content_id] = p;
    for (const it of items) {
        const p = byContent[it.id];
        it.schedule_status = p?.status || null;
        it.schedule_error = p?.error_message || null;
        it.schedule_published_at = p?.published_at || null;
    }
}
// Verifica se o cliente tem uma conexão ativa do Instagram (para agendar publicação)
async function clientHasActiveConnection(clientId) {
    const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { client_id: clientId } });
    if (!conn)
        return false;
    const hasIg = !!conn.ig_access_token || (!!conn.instagram_account_id && (!!conn.page_access_token || !!conn.access_token));
    return hasIg;
}
// Cria (ou atualiza) o post agendado no Instagram a partir de um conteúdo aprovado.
// Retorna um aviso quando não foi possível agendar (sem quebrar a aprovação).
async function scheduleContentPost(content) {
    if (!content.auto_schedule || !content.scheduled_date)
        return null;
    const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { client_id: content.client_id } });
    const canPublish = !!conn && (!!conn.ig_access_token || (!!conn.page_access_token && !!conn.instagram_account_id));
    if (!conn || !canPublish)
        return "Cliente sem conexão ativa do Instagram — publicação automática não agendada.";
    const media = await (0, editorialMedia_1.resolveContentMedia)(content);
    if (!media)
        return "Nenhuma arte encontrada (anexe o conteúdo produzido) — publicação automática não agendada.";
    const base = (0, editorialMedia_1.publicApiBase)();
    if (!base)
        return "URL pública do sistema não configurada — publicação automática não agendada.";
    const url = `${base}/api/public/media/${(0, editorialMedia_1.signMedia)(content.id)}`;
    const caption = [content.caption, content.hashtags].filter(Boolean).join("\n\n") || null;
    const data = {
        connection_id: conn.id,
        client_id: content.client_id,
        caption,
        media_urls: JSON.stringify([url]),
        media_type: (0, editorialMedia_1.mediaTypeFor)(content),
        scheduled_at: content.scheduled_date,
        editorial_content_id: content.id,
        status: "AGENDADO",
    };
    const existing = await prisma_1.default.instagramScheduledPost.findFirst({
        where: { editorial_content_id: content.id, status: { in: ["AGENDADO", "ERRO"] } },
    });
    if (existing)
        await prisma_1.default.instagramScheduledPost.update({ where: { id: existing.id }, data });
    else
        await prisma_1.default.instagramScheduledPost.create({ data });
    return null;
}
// ── GET /api/editorial ─────────────────────────────────────────────────
// Filtros opcionais: clientId, responsibleId, status, from, to (data de publicação)
router.get("/", auth_1.authenticateJWT, async (req, res) => {
    if (!isStaff(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { clientId, responsibleId, status, from, to } = req.query;
    const where = {};
    if (clientId)
        where.client_id = String(clientId);
    if (responsibleId)
        where.responsible_id = String(responsibleId);
    if (status)
        where.status = String(status);
    if (from || to) {
        where.scheduled_date = {};
        if (from)
            where.scheduled_date.gte = new Date(String(from));
        if (to)
            where.scheduled_date.lte = new Date(String(to));
    }
    try {
        const items = await prisma_1.default.editorialContent.findMany({
            where, include, orderBy: [{ scheduled_date: "asc" }, { created_at: "desc" }],
        });
        await attachScheduleStatus(items);
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/editorial ── (cria conteúdo + tarefa vinculada) ──────────
router.post("/", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const { title, description, client_id, responsible_id, reference_url, caption, hashtags, content_type, platform, scheduled_date, priority, auto_schedule } = req.body;
    if (!title || !client_id) {
        res.status(400).json({ error: "Título e cliente são obrigatórios" });
        return;
    }
    // Validação do agendamento de publicação
    if (auto_schedule) {
        if (!scheduled_date) {
            res.status(400).json({ error: "Defina a data de publicação para agendar." });
            return;
        }
        if (!(await clientHasActiveConnection(client_id))) {
            res.status(400).json({ error: "Este cliente não tem uma conexão ativa do Instagram. Conecte em Meta → Conexões antes de agendar." });
            return;
        }
    }
    try {
        // Cria a tarefa vinculada para o responsável (se houver)
        let task_id = null;
        if (responsible_id) {
            const task = await prisma_1.default.task.create({
                data: {
                    title: `Produzir: ${title}`,
                    description: description || null,
                    client_id,
                    responsible_id,
                    due_date: (0, dates_1.dayDate)(scheduled_date),
                    priority: priority || "MEDIA",
                    status: "PENDENTE",
                },
            });
            task_id = task.id;
        }
        const content = await prisma_1.default.editorialContent.create({
            data: {
                user_id: req.user.id,
                client_id,
                responsible_id: responsible_id || null,
                task_id,
                title,
                description: description || null,
                reference_url: reference_url || null,
                caption: caption || null,
                hashtags: hashtags || null,
                content_type: content_type || "POST",
                platform: platform || "INSTAGRAM",
                scheduled_date: scheduled_date ? (0, dates_1.dayDate)(scheduled_date) : null,
                auto_schedule: !!auto_schedule,
                status: responsible_id ? "EM_PRODUCAO" : "IDEIA",
            },
            include,
        });
        if (responsible_id)
            await notify(responsible_id, "Novo conteúdo para produzir", `${title} — ${content.client?.name || ""}`, content.id);
        res.status(201).json(content);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── PATCH /api/editorial/:id ── (edita campos / troca responsável / status) ─
router.patch("/:id", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    const b = req.body;
    const data = {};
    for (const f of ["title", "description", "reference_url", "caption", "hashtags", "content_type", "platform", "status"]) {
        if (b[f] !== undefined)
            data[f] = b[f];
    }
    if (b.scheduled_date !== undefined)
        data.scheduled_date = b.scheduled_date ? (0, dates_1.dayDate)(b.scheduled_date) : null;
    if (b.responsible_id !== undefined)
        data.responsible_id = b.responsible_id || null;
    if (b.auto_schedule !== undefined)
        data.auto_schedule = !!b.auto_schedule;
    try {
        const prev = await prisma_1.default.editorialContent.findUnique({ where: { id } });
        // Valida agendamento (precisa de data + conexão ativa do cliente)
        if (b.auto_schedule) {
            const cliId = prev?.client_id;
            const schedDate = data.scheduled_date !== undefined ? data.scheduled_date : prev?.scheduled_date;
            if (!schedDate) {
                res.status(400).json({ error: "Defina a data de publicação para agendar." });
                return;
            }
            if (cliId && !(await clientHasActiveConnection(cliId))) {
                res.status(400).json({ error: "Este cliente não tem uma conexão ativa do Instagram. Conecte em Meta → Conexões antes de agendar." });
                return;
            }
        }
        const content = await prisma_1.default.editorialContent.update({ where: { id }, data, include });
        // Se ganhou responsável e ainda não tinha tarefa, cria uma
        if (content.responsible_id && !content.task_id) {
            const task = await prisma_1.default.task.create({
                data: {
                    title: `Produzir: ${content.title}`,
                    description: content.description || null,
                    client_id: content.client_id,
                    responsible_id: content.responsible_id,
                    due_date: content.scheduled_date || null,
                    status: taskStatusFor(content.status),
                },
            });
            await prisma_1.default.editorialContent.update({ where: { id }, data: { task_id: task.id } });
        }
        else {
            await syncTask(id);
        }
        // Mantém título/prazo da tarefa em dia
        if (content.task_id && (b.title !== undefined || b.scheduled_date !== undefined)) {
            await prisma_1.default.task.update({
                where: { id: content.task_id },
                data: { ...(b.title !== undefined ? { title: `Produzir: ${content.title}` } : {}), ...(b.scheduled_date !== undefined ? { due_date: content.scheduled_date } : {}) },
            }).catch(() => { });
        }
        if (b.responsible_id !== undefined && content.responsible_id && content.responsible_id !== prev?.responsible_id) {
            await notify(content.responsible_id, "Conteúdo atribuído a você", `${content.title} — ${content.client?.name || ""}`, content.id);
        }
        res.json(content);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/editorial/:id/submit ── (responsável sobe o conteúdo → Aprovação) ─
router.post("/:id/submit", auth_1.authenticateJWT, upload.single("file"), async (req, res) => {
    if (!isStaff(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    try {
        const c = await prisma_1.default.editorialContent.findUnique({ where: { id } });
        if (!c) {
            res.status(404).json({ error: "Conteúdo não encontrado" });
            return;
        }
        // Operador só pode subir no que é responsável
        if (req.user.role === "OPERATOR" && c.responsible_id !== req.user.id) {
            res.status(403).json({ error: "Você não é o responsável por este conteúdo" });
            return;
        }
        const data = { status: "EM_APROVACAO", feedback: null };
        if (req.file) {
            // remove arquivo anterior
            if (c.produced_key)
                await (0, storage_1.deleteFile)(c.produced_key).catch(() => { });
            const safe = (req.file.originalname || "arquivo").replace(/[^\w.\-]+/g, "_");
            const key = `editorial/${id}/${Date.now()}-${safe}`;
            await (0, storage_1.uploadFile)(key, req.file.buffer, req.file.mimetype);
            data.produced_key = key;
            data.produced_name = req.file.originalname;
        }
        const content = await prisma_1.default.editorialContent.update({ where: { id }, data, include });
        await syncTask(id);
        // Notifica quem criou (manager) para aprovar
        await notify(content.user_id, "Conteúdo aguardando aprovação", `${content.title} — ${content.client?.name || ""}`, content.id);
        res.json(content);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/editorial/:id/approve ── (→ Aguardando Postar) ───────────
router.post("/:id/approve", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    try {
        const content = await prisma_1.default.editorialContent.update({
            where: { id }, data: { status: "AGUARDANDO_POSTAR", approved_at: new Date(), feedback: null }, include,
        });
        await syncTask(id);
        await notify(content.responsible_id, "Conteúdo aprovado ✅", `${content.title} — pronto para postar`, content.id);
        // Se estiver marcado para agendar, cria o post automático
        let scheduleWarning = null;
        try {
            scheduleWarning = await scheduleContentPost(content);
        }
        catch (e) {
            scheduleWarning = e.message;
        }
        res.json({ ...content, schedule_warning: scheduleWarning });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/editorial/:id/reject ── (→ Ajustes, com feedback) ────────
router.post("/:id/reject", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    const { feedback } = req.body;
    try {
        const content = await prisma_1.default.editorialContent.update({
            where: { id }, data: { status: "AJUSTES", feedback: feedback || null }, include,
        });
        await syncTask(id);
        // Registra o ajuste como comentário na tarefa vinculada, para o responsável ver
        if (content.task_id && feedback && String(feedback).trim()) {
            await prisma_1.default.taskComment.create({
                data: { task_id: content.task_id, user_id: req.user.id, body: `🔧 Ajuste solicitado: ${String(feedback).trim()}` },
            }).catch(() => { });
        }
        await notify(content.responsible_id, "Conteúdo precisa de ajustes", feedback || content.title, content.id);
        res.json(content);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/editorial/:id/post ── (→ Postado) ────────────────────────
router.post("/:id/post", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    try {
        const content = await prisma_1.default.editorialContent.update({
            where: { id }, data: { status: "POSTADO", posted_at: new Date() }, include,
        });
        await syncTask(id);
        res.json(content);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── GET /api/editorial/:id/file ── (abre o conteúdo produzido) ─────────
router.get("/:id/file", auth_1.authenticateJWT, async (req, res) => {
    try {
        const c = await prisma_1.default.editorialContent.findUnique({ where: { id: String(req.params.id) } });
        if (!c?.produced_key) {
            res.status(404).json({ error: "Sem arquivo" });
            return;
        }
        const { body, mime } = await (0, storage_1.getFile)(c.produced_key);
        res.setHeader("Content-Type", mime || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(c.produced_name || "conteudo")}"`);
        body.pipe(res);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── DELETE /api/editorial/:id ──────────────────────────────────────────
router.delete("/:id", auth_1.authenticateJWT, async (req, res) => {
    if (!canManage(req.user?.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
    }
    const id = String(req.params.id);
    try {
        const c = await prisma_1.default.editorialContent.findUnique({ where: { id } });
        if (c?.produced_key)
            await (0, storage_1.deleteFile)(c.produced_key).catch(() => { });
        await prisma_1.default.editorialContent.delete({ where: { id } });
        if (c?.task_id)
            await prisma_1.default.task.delete({ where: { id: c.task_id } }).catch(() => { });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=editorial.js.map