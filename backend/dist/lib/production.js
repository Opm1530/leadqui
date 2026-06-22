"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPostToProduction = sendPostToProduction;
const prisma_1 = __importDefault(require("./prisma"));
const trello_1 = require("./trello");
// Envia um post do calendário para produção:
// 1. status -> PRODUZINDO
// 2. cria card no Trello (lista/membros/etiquetas)
// 3. cria tarefa no Tasqui vinculada
async function sendPostToProduction(postId, opts = {}) {
    const post = await prisma_1.default.calendarPost.findUnique({
        where: { id: postId },
        include: { client: { select: { name: true } } },
    });
    if (!post)
        throw new Error("Post não encontrado");
    const titulo = post.title || `${post.type} ${post.platform}`;
    const dataISO = new Date(post.scheduled_date).toISOString();
    const dataBR = new Date(post.scheduled_date).toLocaleDateString("pt-BR");
    // 1. Card no Trello
    let trello = null;
    try {
        trello = await (0, trello_1.createTrelloCard)({
            name: `${post.client?.name || "Cliente"} — ${titulo}`,
            desc: `Tipo: ${post.type} · Plataforma: ${post.platform}\nData: ${dataBR}\n\n${post.content || ""}`,
            dueISO: dataISO,
            idList: opts.trello_list_id,
            idMembers: opts.trello_member_ids,
            idLabels: opts.trello_label_ids,
        });
    }
    catch (e) {
        console.warn("[Produção] Trello falhou:", e.message);
    }
    // 2. Tarefa no Tasqui (direto no cliente, sem projeto)
    let task = null;
    try {
        task = await prisma_1.default.task.create({
            data: {
                project_id: post.project_id || null,
                client_id: post.client_id,
                responsible_id: opts.responsible_id || null,
                title: `Produzir: ${titulo}`,
                description: `${post.type} · ${post.platform} · ${dataBR}\n\n${post.content || ""}${trello?.shortUrl ? `\n\nTrello: ${trello.shortUrl}` : ""}`,
                status: "EM_ANDAMENTO",
                priority: "MEDIA",
                due_date: post.scheduled_date,
            },
        });
    }
    catch (e) {
        console.warn("[Produção] Criação de tarefa falhou:", e.message);
    }
    // 3. Atualiza o post
    const updated = await prisma_1.default.calendarPost.update({
        where: { id: postId },
        data: {
            status: "PRODUZINDO",
            trello_card_id: trello?.id || null,
            trello_card_url: trello?.shortUrl || null,
            task_id: task?.id || null,
        },
        include: { client: { select: { name: true } } },
    });
    return { post: updated, trello, task };
}
//# sourceMappingURL=production.js.map