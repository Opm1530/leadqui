"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTrelloConfigured = isTrelloConfigured;
exports.getTrelloBoards = getTrelloBoards;
exports.getTrelloLists = getTrelloLists;
exports.getTrelloLabels = getTrelloLabels;
exports.getTrelloMembers = getTrelloMembers;
exports.getCardAttachments = getCardAttachments;
exports.getCardMediaUrls = getCardMediaUrls;
exports.getTrelloCreds = getTrelloCreds;
exports.moveCardToList = moveCardToList;
exports.addCardComment = addCardComment;
exports.ensureTrelloWebhook = ensureTrelloWebhook;
exports.createTrelloCard = createTrelloCard;
const axios_1 = __importDefault(require("axios"));
const companySettings_1 = require("./companySettings");
const prisma_1 = __importDefault(require("./prisma"));
// Retorna as credenciais do Trello da empresa, ou null se não configurado.
async function trelloCreds() {
    const ownerId = await (0, companySettings_1.getCompanySettingsUserId)();
    if (!ownerId)
        return null;
    const settings = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id: ownerId } });
    if (!settings?.trello_api_key || !settings?.trello_token)
        return null;
    return { key: settings.trello_api_key, token: settings.trello_token, settings };
}
async function isTrelloConfigured() {
    const c = await trelloCreds();
    return !!(c && (c.settings.trello_list_id || c.settings.trello_board_id));
}
// ── Leitura de dados do Trello (para popular dropdowns) ──────────────
async function getTrelloBoards() {
    const c = await trelloCreds();
    if (!c)
        return [];
    const resp = await axios_1.default.get("https://api.trello.com/1/members/me/boards", {
        params: { key: c.key, token: c.token, fields: "id,name", filter: "open" },
    });
    return resp.data || [];
}
async function getTrelloLists(boardId) {
    const c = await trelloCreds();
    if (!c)
        return [];
    const board = boardId || c.settings.trello_board_id;
    if (!board)
        return [];
    const resp = await axios_1.default.get(`https://api.trello.com/1/boards/${board}/lists`, {
        params: { key: c.key, token: c.token, fields: "id,name", filter: "open" },
    });
    return resp.data || [];
}
async function getTrelloLabels(boardId) {
    const c = await trelloCreds();
    if (!c)
        return [];
    const board = boardId || c.settings.trello_board_id;
    if (!board)
        return [];
    const resp = await axios_1.default.get(`https://api.trello.com/1/boards/${board}/labels`, {
        params: { key: c.key, token: c.token, fields: "id,name,color", limit: 100 },
    });
    return resp.data || [];
}
async function getTrelloMembers(boardId) {
    const c = await trelloCreds();
    if (!c)
        return [];
    const board = boardId || c.settings.trello_board_id;
    if (!board)
        return [];
    const resp = await axios_1.default.get(`https://api.trello.com/1/boards/${board}/members`, {
        params: { key: c.key, token: c.token, fields: "id,fullName,username" },
    });
    return resp.data || [];
}
// Busca os anexos de um card (a arte enviada pelo designer).
async function getCardAttachments(cardId) {
    const c = await trelloCreds();
    if (!c)
        return [];
    const resp = await axios_1.default.get(`https://api.trello.com/1/cards/${cardId}/attachments`, {
        params: { key: c.key, token: c.token, fields: "id,name,url,mimeType,isUpload" },
    });
    return resp.data || [];
}
// Retorna só as URLs de anexos que são imagem/vídeo.
async function getCardMediaUrls(cardId) {
    const atts = await getCardAttachments(cardId);
    return atts
        .filter(a => a.url && (/\.(jpg|jpeg|png|gif|mp4|mov|webp)(\?|$)/i.test(a.url) || /^image|^video/.test(a.mimeType || "")))
        .map(a => a.url);
}
// Lista raw de credenciais para uso externo (registrar webhook etc.)
async function getTrelloCreds() {
    return trelloCreds();
}
// Move um card para outra lista (coluna).
async function moveCardToList(cardId, listId) {
    const c = await trelloCreds();
    if (!c || !cardId || !listId)
        return;
    try {
        await axios_1.default.put(`https://api.trello.com/1/cards/${cardId}`, null, {
            params: { key: c.key, token: c.token, idList: listId },
        });
    }
    catch (e) {
        console.warn("[Trello] mover card falhou:", e.response?.data || e.message);
    }
}
// Adiciona um comentário ao card.
async function addCardComment(cardId, text) {
    const c = await trelloCreds();
    if (!c || !cardId || !text)
        return;
    try {
        await axios_1.default.post(`https://api.trello.com/1/cards/${cardId}/actions/comments`, null, {
            params: { key: c.key, token: c.token, text },
        });
    }
    catch (e) {
        console.warn("[Trello] comentar card falhou:", e.response?.data || e.message);
    }
}
// Registra o webhook de forma idempotente: se já existir um com o mesmo
// callbackURL + idModel, reaproveita; senão cria. Retorna o id.
async function ensureTrelloWebhook(callbackURL, idModel) {
    const c = await trelloCreds();
    if (!c)
        return null;
    // Procura webhooks existentes do token
    try {
        const existing = await axios_1.default.get(`https://api.trello.com/1/tokens/${c.token}/webhooks`, {
            params: { key: c.key, token: c.token },
        });
        const match = (existing.data || []).find((w) => w.callbackURL === callbackURL && w.idModel === idModel);
        if (match)
            return match.id;
    }
    catch { /* segue para criar */ }
    const resp = await axios_1.default.post("https://api.trello.com/1/webhooks", null, {
        params: { key: c.key, token: c.token, callbackURL, idModel, description: "Leadqui — aprovação de conteúdo" },
    });
    return resp.data.id;
}
// Cria um card no Trello. Retorna o card ou null se não configurado.
async function createTrelloCard(opts) {
    const c = await trelloCreds();
    if (!c)
        return null;
    const idList = opts.idList || c.settings.trello_list_id;
    if (!idList)
        return null; // sem lista de destino — gancho pronto, sem erro
    const resp = await axios_1.default.post("https://api.trello.com/1/cards", null, {
        params: {
            key: c.key,
            token: c.token,
            idList,
            name: opts.name,
            desc: opts.desc,
            ...(opts.dueISO ? { due: opts.dueISO } : {}),
            ...(opts.idMembers?.length ? { idMembers: opts.idMembers.join(",") } : {}),
            ...(opts.idLabels?.length ? { idLabels: opts.idLabels.join(",") } : {}),
        },
    });
    return resp.data;
}
//# sourceMappingURL=trello.js.map