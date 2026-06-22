"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendApprovalToGroup = sendApprovalToGroup;
exports.onClientApproved = onClientApproved;
exports.onClientRejected = onClientRejected;
exports.sendTextToClientGroup = sendTextToClientGroup;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("./prisma"));
const companySettings_1 = require("./companySettings");
const trello_1 = require("./trello");
// Carrega os ids de lista configurados no Trello (fluxo de colunas).
async function trelloFlowLists() {
    const ownerId = await (0, companySettings_1.getCompanySettingsUserId)();
    if (!ownerId)
        return {};
    return (await prisma_1.default.techQuiSettings.findUnique({ where: { user_id: ownerId } })) || {};
}
// Resolve URL/key do Evolution + o id da instância vinculada ao cliente.
async function evolutionForClient(client) {
    if (!client?.wa_instance_id || !client?.wa_group_id)
        return null;
    const settings = await (0, companySettings_1.getCompanySettings)();
    if (!settings?.evolution_api_url || !settings?.evolution_api_key)
        return null;
    const instance = await prisma_1.default.instance.findUnique({ where: { id: client.wa_instance_id } });
    if (!instance)
        return null;
    return {
        baseUrl: settings.evolution_api_url.replace(/\/$/, ""),
        apiKey: settings.evolution_api_key,
        instance: instance.evolution_instance_id,
    };
}
const TIPO_LABEL = {
    POST: "Post", STORY: "Story", REEL: "Reels", CARROSSEL: "Carrossel", AD: "Anúncio",
};
// Envia a arte + legenda + enquete de aprovação para o grupo do cliente.
// Retorna true se enviou.
async function sendApprovalToGroup(postId) {
    const post = await prisma_1.default.calendarPost.findUnique({
        where: { id: postId },
        include: { client: true },
    });
    if (!post)
        throw new Error("Post não encontrado");
    const ev = await evolutionForClient(post.client);
    if (!ev)
        throw new Error("Cliente sem grupo de WhatsApp vinculado ou Evolution não configurado.");
    const grupo = post.client.wa_group_id;
    const dataBR = new Date(post.scheduled_date).toLocaleDateString("pt-BR");
    const legenda = `*${TIPO_LABEL[post.type] || post.type}* — ${dataBR}\n\n${post.title || "(sem título)"}\n\n${post.content || ""}`.trim();
    let medias = [];
    try {
        medias = post.media_urls ? JSON.parse(post.media_urls) : [];
    }
    catch { }
    const headers = { apikey: ev.apiKey, "Content-Type": "application/json" };
    // 1. Envia a arte (primeira mídia) com a legenda; se não houver, manda texto.
    try {
        if (medias.length) {
            const url = medias[0];
            const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
            await axios_1.default.post(`${ev.baseUrl}/message/sendMedia/${ev.instance}`, {
                number: grupo,
                mediatype: isVideo ? "video" : "image",
                media: url,
                caption: legenda,
            }, { headers });
        }
        else {
            await axios_1.default.post(`${ev.baseUrl}/message/sendText/${ev.instance}`, {
                number: grupo, text: legenda,
            }, { headers });
        }
    }
    catch (e) {
        console.error("[Aprovação] erro ao enviar mídia:", e.response?.data || e.message);
        throw new Error("Falha ao enviar a arte no grupo.");
    }
    // 2. Envia a enquete Sim/Não.
    try {
        await axios_1.default.post(`${ev.baseUrl}/message/sendPoll/${ev.instance}`, {
            number: grupo,
            name: "Aprova este conteúdo?",
            selectableCount: 1,
            values: ["✅ Aprovar", "❌ Reprovar"],
        }, { headers });
    }
    catch (e) {
        // Fallback: instrução por texto, caso enquete não seja suportada.
        console.warn("[Aprovação] enquete falhou, usando texto:", e.response?.data || e.message);
        await axios_1.default.post(`${ev.baseUrl}/message/sendText/${ev.instance}`, {
            number: grupo,
            text: "Responda *APROVADO* para aprovar ou *REPROVADO* (com o motivo) para ajustes.",
        }, { headers });
    }
    await prisma_1.default.calendarPost.update({
        where: { id: postId },
        data: { status: "AGUARDANDO_APROVACAO", approval_sent_at: new Date(), awaiting_reason: false },
    });
    // O card já está na coluna "Em Aprovação" (o designer o moveu para lá).
    return true;
}
// Move o card e comenta conforme a decisão do cliente (chamado pelo webhook).
async function onClientApproved(post) {
    if (!post?.trello_card_id)
        return;
    const lists = await trelloFlowLists();
    if (lists.trello_approved_list_id)
        await (0, trello_1.moveCardToList)(post.trello_card_id, lists.trello_approved_list_id);
    await (0, trello_1.addCardComment)(post.trello_card_id, "✅ Cliente aprovou a arte.");
}
async function onClientRejected(post, motivo) {
    if (!post?.trello_card_id)
        return;
    const lists = await trelloFlowLists();
    // Volta para a coluna de produção/design
    if (lists.trello_list_id)
        await (0, trello_1.moveCardToList)(post.trello_card_id, lists.trello_list_id);
    await (0, trello_1.addCardComment)(post.trello_card_id, `❌ Cliente pediu ajuste:\n${motivo}`);
}
// Envia uma mensagem de texto simples para o grupo de um cliente.
async function sendTextToClientGroup(client, text) {
    const ev = await evolutionForClient(client);
    if (!ev)
        return;
    try {
        await axios_1.default.post(`${ev.baseUrl}/message/sendText/${ev.instance}`, { number: client.wa_group_id, text }, { headers: { apikey: ev.apiKey, "Content-Type": "application/json" } });
    }
    catch (e) {
        console.warn("[Aprovação] erro ao enviar texto:", e.response?.data || e.message);
    }
}
//# sourceMappingURL=approval.js.map