"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const approval_1 = require("../lib/approval");
const demandClassifier_1 = require("../lib/demandClassifier");
const router = (0, express_1.Router)();
// Extrai texto de um payload de mensagem do Evolution (vários formatos possíveis).
function extractText(data) {
    const m = data?.message || {};
    return (m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        // voto de enquete: nome da opção selecionada
        m.pollUpdateMessage?.vote?.selectedOptions?.[0] ||
        data?.pollVote?.selectedOptions?.[0] ||
        "").toString();
}
function isApprove(t) {
    const s = t.toLowerCase();
    return /aprov|✅|👍|pode postar|ok\b|perfeito|ficou (bom|ótimo|otimo)/.test(s);
}
function isReject(t) {
    const s = t.toLowerCase();
    return /reprov|❌|👎|n[ãa]o\b|ajust|trocar|mudar|corrig|refaz|refazer/.test(s);
}
// ── POST /api/whatsapp/webhook ────────────────────────────────────────
// Recebe eventos do Evolution. Configurado para o evento messages.upsert.
router.post("/webhook", async (req, res) => {
    res.sendStatus(200); // responde já
    try {
        const body = req.body || {};
        const data = body.data || body;
        // Ignora mensagens enviadas por nós mesmos
        if (data?.key?.fromMe)
            return;
        const groupJid = data?.key?.remoteJid || "";
        if (!groupJid.endsWith("@g.us"))
            return; // só grupos
        const text = extractText(data).trim();
        if (!text)
            return;
        // Acha o cliente vinculado a esse grupo
        const client = await prisma_1.default.client.findFirst({ where: { wa_group_id: groupJid } });
        if (!client)
            return;
        // Post mais recente aguardando aprovação desse cliente
        const post = await prisma_1.default.calendarPost.findFirst({
            where: { client_id: client.id, status: "AGUARDANDO_APROVACAO" },
            orderBy: { approval_sent_at: "desc" },
        });
        // ── A) Contexto de aprovação de post ──────────────────────────────
        if (post) {
            // 1. Já estávamos aguardando o MOTIVO da reprovação → esta msg é o motivo
            if (post.awaiting_reason) {
                await prisma_1.default.calendarPost.update({
                    where: { id: post.id },
                    data: { status: "PRODUZINDO", rejection_reason: text, awaiting_reason: false },
                });
                await (0, approval_1.onClientRejected)(post, text);
                await (0, approval_1.sendTextToClientGroup)(client, "Anotado! Vamos ajustar e te enviar de novo. 🙏");
                console.log(`[WhatsApp] Post ${post.id} reprovado. Motivo: ${text}`);
                return;
            }
            // 2. Decisão de aprovação
            if (isApprove(text) && !isReject(text)) {
                await prisma_1.default.calendarPost.update({
                    where: { id: post.id }, data: { status: "APROVADO" },
                });
                await (0, approval_1.onClientApproved)(post);
                await (0, approval_1.sendTextToClientGroup)(client, "Aprovado! ✅ Vamos agendar a publicação.");
                console.log(`[WhatsApp] Post ${post.id} APROVADO`);
                return;
            }
            if (isReject(text)) {
                const semKeyword = text.replace(/reprov\w*|n[ãa]o|❌|👎/gi, "").trim();
                if (semKeyword.length > 4) {
                    await prisma_1.default.calendarPost.update({
                        where: { id: post.id },
                        data: { status: "PRODUZINDO", rejection_reason: semKeyword, awaiting_reason: false },
                    });
                    await (0, approval_1.onClientRejected)(post, semKeyword);
                    await (0, approval_1.sendTextToClientGroup)(client, "Anotado! Vamos ajustar e te enviar de novo. 🙏");
                    console.log(`[WhatsApp] Post ${post.id} reprovado. Motivo: ${semKeyword}`);
                }
                else {
                    await prisma_1.default.calendarPost.update({
                        where: { id: post.id }, data: { awaiting_reason: true },
                    });
                    await (0, approval_1.sendTextToClientGroup)(client, "Sem problema! Pode me dizer o que você gostaria de ajustar? ✍️");
                    console.log(`[WhatsApp] Post ${post.id} reprovado, aguardando motivo`);
                }
                return;
            }
        }
        // ── B) Captação de demandas (bot atendente silencioso) ────────────
        // Mensagem não consumida pela aprovação → IA decide se é demanda.
        const sender = data?.pushName || data?.key?.participant || "";
        // Dedup: ignora reenvios do Evolution (mesmo texto do mesmo cliente nos últimos 30 min)
        const recente = await prisma_1.default.demand.findFirst({
            where: {
                client_id: client.id,
                original_text: text.slice(0, 2000),
                created_at: { gte: new Date(Date.now() - 30 * 60 * 1000) },
            },
            select: { id: true },
        });
        if (recente)
            return;
        const result = await (0, demandClassifier_1.classifyDemand)(text);
        if (result?.is_demand && result.summary) {
            await prisma_1.default.demand.create({
                data: {
                    client_id: client.id,
                    group_jid: groupJid,
                    sender: String(sender).slice(0, 80),
                    original_text: text.slice(0, 2000),
                    summary: result.summary.slice(0, 500),
                    category: result.category || "OUTRO",
                    status: "NOVA",
                },
            });
            console.log(`[Demanda] ${client.name}: ${result.summary}`);
        }
    }
    catch (e) {
        console.error("[WhatsApp Webhook] erro:", e.message);
    }
});
exports.default = router;
//# sourceMappingURL=whatsapp.js.map