"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prisma_1 = __importDefault(require("../lib/prisma"));
// ── Webhook público de captação de leads (formulários / landing pages) ──
// Montado ANTES do CORS global, com CORS liberado e parsers próprios,
// pra aceitar POST de qualquer domínio (landing pages externas).
const router = (0, express_1.Router)();
router.use((0, cors_1.default)({ origin: true, methods: ["POST", "OPTIONS"] }));
router.use(express_2.default.json({ limit: "512kb" }));
router.use(express_2.default.urlencoded({ extended: true }));
// Rate-limit simples em memória: máx. 30 submissões/min por IP.
const hits = new Map();
function tooMany(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > 30;
}
// Aceita variações comuns de nome de campo (form HTML e ferramentas).
function pick(body, keys) {
    for (const k of keys) {
        const v = body?.[k];
        if (v != null && String(v).trim() !== "")
            return String(v).trim();
    }
    return null;
}
router.options("/:token", (0, cors_1.default)({ origin: true }), (_req, res) => { res.sendStatus(204); });
router.post("/:token", async (req, res) => {
    const token = String(req.params.token);
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
    try {
        if (tooMany(ip)) {
            res.status(429).json({ error: "Muitas requisições. Aguarde um instante." });
            return;
        }
        const ep = await prisma_1.default.formEndpoint.findUnique({ where: { token } });
        if (!ep || !ep.active) {
            res.status(404).json({ error: "Formulário não encontrado ou inativo." });
            return;
        }
        const body = req.body || {};
        // Honeypot: campo escondido que só bot preenche.
        const isSpam = !!pick(body, ["_hp", "_gotcha", "honeypot"]);
        const nome = pick(body, ["nome", "name", "nome_completo", "full_name", "fullname", "seu_nome"]);
        const email = pick(body, ["email", "e-mail", "e_mail", "seu_email"]);
        const telefone = pick(body, ["telefone", "phone", "whatsapp", "celular", "tel", "fone", "seu_telefone"]);
        const cidade = pick(body, ["cidade", "city"]);
        const observacao = pick(body, ["mensagem", "message", "msg", "observacao", "assunto", "duvida"]);
        let leadId = null;
        if (!isSpam && (nome || email || telefone)) {
            const lead = await prisma_1.default.lead.create({
                data: {
                    user_id: ep.user_id,
                    client_id: ep.client_id || null, // isola o lead no tenant do formulário
                    nome: nome || email || telefone || "Contato do formulário",
                    telefone: telefone || null,
                    telefone_limpo: telefone ? telefone.replace(/\D/g, "") : null,
                    email: email || null,
                    cidade: cidade || null,
                    observacao: observacao || null,
                    origem: "FORMULARIO",
                    status: "NOVO",
                    responsavel_proposto: ep.default_responsavel || null,
                },
            });
            leadId = lead.id;
            // Tags padrão do formulário
            if (Array.isArray(ep.default_tag_ids) && ep.default_tag_ids.length) {
                await prisma_1.default.leadTag.createMany({
                    data: ep.default_tag_ids.map((tag_id) => ({ lead_id: lead.id, tag_id })),
                    skipDuplicates: true,
                }).catch(() => { });
            }
            await prisma_1.default.formEndpoint.update({ where: { id: ep.id }, data: { submissions_count: { increment: 1 } } }).catch(() => { });
        }
        await prisma_1.default.formSubmission.create({
            data: { endpoint_id: ep.id, lead_id: leadId, payload: body, ip, spam: isSpam },
        }).catch(() => { });
        if (ep.redirect_url) {
            res.status(303).setHeader("Location", ep.redirect_url);
            res.end();
            return;
        }
        res.json({ ok: true });
    }
    catch (e) {
        console.error("[Forms webhook] erro:", e.message);
        res.status(500).json({ error: "Erro ao processar o formulário." });
    }
});
exports.default = router;
//# sourceMappingURL=forms.js.map