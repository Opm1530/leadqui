"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAdsAnalysis = runAdsAnalysis;
exports.handleIncomingComment = handleIncomingComment;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const axios_1 = __importDefault(require("axios"));
const openai_1 = __importDefault(require("openai"));
const companySettings_1 = require("../lib/companySettings");
const trello_1 = require("../lib/trello");
// Escolhe a API/token corretos para operações de Instagram numa conexão.
// Prioriza Instagram Login (ig_access_token / graph.instagram.com);
// senão usa Facebook Page token (graph.facebook.com).
function igContext(conn) {
    if (conn?.ig_access_token) {
        return { base: "https://graph.instagram.com/v21.0", token: conn.ig_access_token };
    }
    return { base: "https://graph.facebook.com/v20.0", token: conn?.page_access_token || conn?.access_token || null };
}
const router = (0, express_1.Router)();
// ── Webhook Trello (público) ──────────────────────────────────────────
// Trello faz um HEAD/GET para validar a URL na criação do webhook.
router.head("/webhook/trello", (_req, res) => { res.sendStatus(200); });
router.get("/webhook/trello", (_req, res) => { res.sendStatus(200); });
router.post("/webhook/trello", async (req, res) => {
    res.sendStatus(200); // responde imediatamente ao Trello
    try {
        const action = req.body?.action;
        if (action?.type !== "updateCard")
            return;
        const listAfter = action.data?.listAfter?.id;
        const cardId = action.data?.card?.id;
        if (!listAfter || !cardId)
            return;
        // Descobre a lista "Concluído" configurada
        const ownerId = await (0, companySettings_1.getCompanySettingsUserId)();
        if (!ownerId)
            return;
        const tq = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id: ownerId } });
        if (!tq?.trello_done_list_id || tq.trello_done_list_id !== listAfter)
            return;
        // Acha o post pelo trello_card_id
        const post = await prisma_1.default.calendarPost.findFirst({ where: { trello_card_id: cardId } });
        if (!post)
            return;
        // Puxa a arte anexada ao card
        let medias = [];
        try {
            medias = await (0, trello_1.getCardMediaUrls)(cardId);
        }
        catch { }
        await prisma_1.default.calendarPost.update({
            where: { id: post.id },
            data: {
                status: "ARTE_PRONTA",
                ...(medias.length ? { media_urls: JSON.stringify(medias) } : {}),
            },
        });
        console.log(`[Webhook Trello] Card ${cardId} concluído → post ${post.id} ARTE_PRONTA (${medias.length} mídia(s))`);
    }
    catch (e) {
        console.error("[Webhook Trello] erro:", e.message);
    }
});
// Registra (ou atualiza) o webhook do Trello apontando para nosso callback.
router.post("/trello/register-webhook", auth_1.authenticateJWT, async (req, res) => {
    try {
        const creds = await (0, trello_1.getTrelloCreds)();
        if (!creds) {
            res.status(400).json({ error: "Trello não configurado." });
            return;
        }
        if (!creds.settings.trello_board_id) {
            res.status(400).json({ error: "Selecione o quadro do Trello primeiro." });
            return;
        }
        const base = process.env.PUBLIC_URL || `https://${req.get("host")}`;
        const callbackURL = `${base.replace(/\/$/, "")}/api/techqui/webhook/trello`;
        const webhookId = await (0, trello_1.ensureTrelloWebhook)(callbackURL, creds.settings.trello_board_id);
        const ownerId = await (0, companySettings_1.getCompanySettingsUserId)();
        await prisma_1.default.techQuiSettings.update({
            where: { user_id: ownerId }, data: { trello_webhook_id: webhookId },
        });
        res.json({ success: true, webhook_id: webhookId, callbackURL, message: "Webhook ativo." });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data || e.message });
    }
});
// ── Webhook Instagram (público — sem auth JWT) ────────────────────────
router.get("/webhook/instagram", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || "pequi_webhook_2026";
    if (mode === "subscribe" && token === expected) {
        res.status(200).send(challenge);
    }
    else {
        res.status(403).send("Forbidden");
    }
});
router.post("/webhook/instagram", express_json_raw, async (req, res) => {
    res.sendStatus(200); // responder imediatamente à Meta
    try {
        const body = req.body;
        console.log("[Webhook Instagram] Recebido:", JSON.stringify(body));
        if (body.object !== "instagram")
            return;
        for (const entry of body.entry || []) {
            const accountId = entry.id; // ID da conta que recebeu o comentário
            for (const change of entry.changes || []) {
                if (change.field !== "comments")
                    continue;
                const value = change.value;
                if (!value?.id)
                    continue;
                // Anti-loop: ignorar comentários feitos pela própria conta (ex: nossas respostas)
                if (value.from?.id && String(value.from.id) === String(accountId))
                    continue;
                await handleIncomingComment({
                    comment_id: value.id,
                    post_id: value.media?.id || "",
                    text: value.text || "",
                    username: value.from?.username || "",
                    account_id: String(accountId),
                });
            }
        }
    }
    catch (err) {
        console.error("[Webhook Instagram] Erro:", err);
    }
});
function express_json_raw(req, res, next) {
    next();
}
// ── OAuth Meta ────────────────────────────────────────────────────────
// Permissões para Facebook Login (produto diferente do Instagram Business Login)
// Os escopos instagram_business_* são apenas para Instagram Business Login (outro OAuth)
const META_SCOPES = [
    "business_management",
    "ads_management",
    "ads_read",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_manage_comments",
    "instagram_content_publish",
].join(",");
// GET /api/techqui/oauth/start?client_id=xxx&user_id=xxx
// Gera a URL de autorização Meta e retorna para o frontend abrir em popup
router.get("/oauth/start", auth_1.authenticateJWT, async (req, res) => {
    const clientId = String(req.query.client_id || "");
    if (!clientId) {
        res.status(400).json({ error: "client_id obrigatório" });
        return;
    }
    try {
        const settings = await prisma_1.default.techQuiSettings.findUnique({
            where: { user_id: req.user.id },
        });
        if (!settings?.meta_app_id) {
            res.status(400).json({ error: "Configure o App ID da Meta em TechQui → Configurações antes de conectar." });
            return;
        }
        // State codifica: client_id + user_id (para recuperar no callback)
        const state = Buffer.from(JSON.stringify({ client_id: clientId, user_id: req.user.id })).toString("base64url");
        const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
        const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${settings.meta_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(META_SCOPES)}&state=${state}&response_type=code`;
        res.json({ url: oauthUrl });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Sessões OAuth temporárias em memória (expiram em 10 min)
const oauthSessions = new Map();
// GET /api/techqui/oauth/callback
router.get("/oauth/callback", async (req, res) => {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const error = String(req.query.error || "");
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:8080";
    if (error) {
        res.redirect(`${frontendBase}/techqui?oauth=denied`);
        return;
    }
    if (!code || !state) {
        res.redirect(`${frontendBase}/techqui?oauth=error&msg=parametros_invalidos`);
        return;
    }
    try {
        const { client_id, user_id } = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        const settings = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id } });
        if (!settings?.meta_app_id || !settings?.meta_app_secret) {
            res.redirect(`${frontendBase}/techqui?oauth=error&msg=app_nao_configurado`);
            return;
        }
        const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
        // 1. Token curto → token longo
        const tokenRes = await axios_1.default.get("https://graph.facebook.com/v20.0/oauth/access_token", {
            params: { client_id: settings.meta_app_id, client_secret: settings.meta_app_secret, redirect_uri: redirectUri, code },
        });
        const shortToken = tokenRes.data.access_token;
        const longTokenRes = await axios_1.default.get("https://graph.facebook.com/v20.0/oauth/access_token", {
            params: { grant_type: "fb_exchange_token", client_id: settings.meta_app_id, client_secret: settings.meta_app_secret, fb_exchange_token: shortToken },
        });
        const longToken = longTokenRes.data.access_token;
        const expiresIn = longTokenRes.data.expires_in || 5184000;
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        // 2a. Páginas do Facebook com Instagram vinculado
        const pagesRes = await axios_1.default.get("https://graph.facebook.com/v20.0/me/accounts", {
            params: { access_token: longToken, fields: "id,name,access_token,instagram_business_account{id,username,name}", limit: 50 },
        });
        const rawPages = pagesRes.data.data || [];
        const pages = rawPages.map((p) => ({
            page_id: p.id,
            page_name: p.name,
            page_access_token: p.access_token || null,
            instagram_account_id: p.instagram_business_account?.id || null,
            instagram_username: p.instagram_business_account?.username || p.instagram_business_account?.name || null,
            source: "page",
        }));
        // 2b. Contas de Instagram direto na BM (sem Página vinculada)
        // Busca via /me/businesses → instagram_accounts
        try {
            const bizRes = await axios_1.default.get("https://graph.facebook.com/v20.0/me/businesses", {
                params: { access_token: longToken, fields: "id,name", limit: 10 },
            });
            const businesses = bizRes.data.data || [];
            for (const biz of businesses) {
                try {
                    const igRes = await axios_1.default.get(`https://graph.facebook.com/v20.0/${biz.id}/instagram_accounts`, {
                        params: { access_token: longToken, fields: "id,username,name", limit: 50 },
                    });
                    const bmIgAccounts = igRes.data.data || [];
                    for (const ig of bmIgAccounts) {
                        // Evitar duplicatas com contas já capturadas via Página
                        const alreadyAdded = pages.some(p => p.instagram_account_id === ig.id);
                        if (!alreadyAdded) {
                            pages.push({
                                page_id: null,
                                page_name: `${biz.name} (BM)`,
                                page_access_token: null,
                                instagram_account_id: ig.id,
                                instagram_username: ig.username || ig.name || null,
                                source: "bm",
                            });
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        // 3. Contas de Anúncios
        let adAccounts = [];
        try {
            const adRes = await axios_1.default.get("https://graph.facebook.com/v20.0/me/adaccounts", {
                params: { access_token: longToken, fields: "id,name,account_status", limit: 50 },
            });
            adAccounts = (adRes.data.data || []).map((a) => ({
                id: a.id,
                name: a.name,
                active: a.account_status === 1,
            }));
        }
        catch { }
        // 4. Salvar sessão temporária (10 min)
        const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        oauthSessions.set(sessionId, {
            data: { client_id, user_id, longToken, tokenExpiresAt, pages, adAccounts },
            expiresAt: Date.now() + 10 * 60 * 1000,
        });
        // 5. Redirecionar para seleção no frontend
        res.redirect(`${frontendBase}/techqui?oauth=select&session=${sessionId}&client_id=${client_id}`);
    }
    catch (e) {
        console.error("[OAuth Callback] Erro:", e.response?.data || e.message);
        const msg = encodeURIComponent(e.response?.data?.error?.message || e.message);
        res.redirect(`${frontendBase}/techqui?oauth=error&msg=${msg}`);
    }
});
// GET /api/techqui/oauth/session/:sessionId — buscar opções da sessão
router.get("/oauth/session/:sessionId", auth_1.authenticateJWT, async (req, res) => {
    const sessionId = String(req.params.sessionId);
    const session = oauthSessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        res.status(404).json({ error: "Sessão expirada ou inválida" });
        return;
    }
    const { pages, adAccounts, client_id } = session.data;
    res.json({ pages, adAccounts, client_id });
});
// POST /api/techqui/oauth/finalize — salvar a seleção do usuário
router.post("/oauth/finalize", auth_1.authenticateJWT, async (req, res) => {
    const { session_id, page_id, ad_account_id } = req.body;
    if (!session_id) {
        res.status(400).json({ error: "session_id obrigatório" });
        return;
    }
    const session = oauthSessions.get(session_id);
    if (!session || Date.now() > session.expiresAt) {
        res.status(400).json({ error: "Sessão expirada. Clique em Conectar com Meta novamente." });
        return;
    }
    const { client_id, longToken, tokenExpiresAt, pages, adAccounts } = session.data;
    // Encontrar página selecionada
    const selectedPage = pages.find((p) => p.page_id === page_id) || pages[0] || {};
    try {
        // Se já há conexão Instagram Login (ig_access_token), não sobrescrever os dados do IG
        const existing = await prisma_1.default.clientMetaConnection.findUnique({ where: { client_id } });
        const hasIgLogin = !!existing?.ig_access_token;
        const igFields = hasIgLogin ? {} : {
            instagram_account_id: selectedPage.instagram_account_id || existing?.instagram_account_id || null,
            instagram_username: selectedPage.instagram_username || existing?.instagram_username || null,
        };
        await prisma_1.default.clientMetaConnection.upsert({
            where: { client_id },
            create: {
                client_id,
                instagram_account_id: selectedPage.instagram_account_id || null,
                instagram_username: selectedPage.instagram_username || null,
                ad_account_id: ad_account_id || null,
                page_id: selectedPage.page_id || null,
                page_name: selectedPage.page_name || null,
                access_token: longToken,
                page_access_token: selectedPage.page_access_token || null,
                token_expires_at: tokenExpiresAt,
            },
            update: {
                ...igFields,
                ad_account_id: ad_account_id || null,
                page_id: selectedPage.page_id || null,
                page_name: selectedPage.page_name || null,
                access_token: longToken,
                page_access_token: selectedPage.page_access_token || null,
                token_expires_at: tokenExpiresAt,
                updated_at: new Date(),
            },
        });
        oauthSessions.delete(session_id);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── OAuth Instagram Business Login (sem Página do Facebook) ────────────
const IG_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
].join(",");
// GET /api/techqui/oauth/instagram/start?client_id=xxx
router.get("/oauth/instagram/start", auth_1.authenticateJWT, async (req, res) => {
    const clientId = String(req.query.client_id || "");
    if (!clientId) {
        res.status(400).json({ error: "client_id obrigatório" });
        return;
    }
    try {
        const settings = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id: req.user.id } });
        if (!settings?.instagram_app_id) {
            res.status(400).json({ error: "Configure o Instagram App ID em TechQui → Configurações." });
            return;
        }
        const state = Buffer.from(JSON.stringify({ client_id: clientId, user_id: req.user.id })).toString("base64url");
        const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
        const url = `https://www.instagram.com/oauth/authorize?client_id=${settings.instagram_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(IG_SCOPES)}&state=${state}`;
        res.json({ url });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/techqui/oauth/instagram/callback
router.get("/oauth/instagram/callback", async (req, res) => {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const error = String(req.query.error || "");
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:8080";
    if (error) {
        res.redirect(`${frontendBase}/techqui?oauth=denied`);
        return;
    }
    if (!code || !state) {
        res.redirect(`${frontendBase}/techqui?oauth=error&msg=parametros_invalidos`);
        return;
    }
    try {
        const { client_id, user_id } = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        const settings = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id } });
        if (!settings?.instagram_app_id || !settings?.instagram_app_secret) {
            res.redirect(`${frontendBase}/techqui?oauth=error&msg=instagram_app_nao_configurado`);
            return;
        }
        const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
        // 1. Trocar code por token curto (form-urlencoded)
        const form = new URLSearchParams({
            client_id: settings.instagram_app_id,
            client_secret: settings.instagram_app_secret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code: code.replace(/#_$/, ""), // Instagram às vezes anexa "#_"
        });
        const tokenRes = await axios_1.default.post("https://api.instagram.com/oauth/access_token", form.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        const shortToken = tokenRes.data.access_token;
        // 2. Trocar por token de longa duração (60 dias)
        const longRes = await axios_1.default.get("https://graph.instagram.com/access_token", {
            params: { grant_type: "ig_exchange_token", client_secret: settings.instagram_app_secret, access_token: shortToken },
        });
        const longToken = longRes.data.access_token;
        const expiresIn = longRes.data.expires_in || 5184000;
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        // 3. Buscar o ID correto para publicação via /me (o user_id do token é app-scoped e NÃO serve)
        let igUserId;
        let username = null;
        try {
            const meRes = await axios_1.default.get("https://graph.instagram.com/v21.0/me", {
                params: { fields: "user_id,username", access_token: longToken },
            });
            igUserId = String(meRes.data.user_id);
            username = meRes.data.username || null;
        }
        catch (e) {
            // fallback ao user_id do token se /me falhar
            igUserId = String(tokenRes.data.user_id);
        }
        // 4. Salvar/mesclar conexão — preenche só a parte Instagram, preserva a do Facebook
        await prisma_1.default.clientMetaConnection.upsert({
            where: { client_id },
            create: {
                client_id,
                connection_type: "INSTAGRAM",
                instagram_account_id: igUserId,
                instagram_username: username,
                ig_access_token: longToken,
                token_expires_at: tokenExpiresAt,
            },
            update: {
                instagram_account_id: igUserId,
                instagram_username: username,
                ig_access_token: longToken,
                updated_at: new Date(),
            },
        });
        // 5. Inscrever a conta nos webhooks de comentários
        try {
            await axios_1.default.post(`https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps`, null, {
                params: { subscribed_fields: "comments", access_token: longToken },
            });
            console.log(`[Instagram OAuth] Conta ${igUserId} inscrita nos webhooks de comentários`);
        }
        catch (subErr) {
            console.warn("[Instagram OAuth] Falha ao inscrever webhooks:", subErr.response?.data || subErr.message);
        }
        res.redirect(`${frontendBase}/techqui?oauth=success&client_id=${client_id}`);
    }
    catch (e) {
        console.error("[Instagram OAuth] Erro:", e.response?.data || e.message);
        const msg = encodeURIComponent(e.response?.data?.error_message || e.response?.data?.error?.message || e.message);
        res.redirect(`${frontendBase}/techqui?oauth=error&msg=${msg}`);
    }
});
// ── TechQui Settings ─────────────────────────────────────────────────
router.get("/settings", auth_1.authenticateJWT, async (req, res) => {
    try {
        const settings = await prisma_1.default.techQuiSettings.findUnique({
            where: { user_id: req.user.id },
        });
        const masked = settings ? {
            ...settings,
            meta_app_secret: settings.meta_app_secret ? "••••••••" : null,
            meta_system_token: settings.meta_system_token ? "••••••••" : null,
            openai_api_key: settings.openai_api_key ? "••••••••" : null,
            instagram_app_secret: settings.instagram_app_secret ? "••••••••" : null,
            trello_token: settings.trello_token ? "••••••••" : null,
        } : null;
        res.json({ settings: masked });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put("/settings", auth_1.authenticateJWT, async (req, res) => {
    try {
        const data = { ...req.body };
        Object.keys(data).forEach(k => { if (data[k] === "••••••••")
            delete data[k]; });
        const settings = await prisma_1.default.techQuiSettings.upsert({
            where: { user_id: req.user.id },
            create: { user_id: req.user.id, ...data },
            update: data,
        });
        res.json({ settings });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Trello — leitura para dropdowns ───────────────────────────────────
router.get("/trello/boards", auth_1.authenticateJWT, async (_req, res) => {
    try {
        res.json({ boards: await (0, trello_1.getTrelloBoards)() });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data || e.message });
    }
});
router.get("/trello/lists", auth_1.authenticateJWT, async (req, res) => {
    try {
        res.json({ lists: await (0, trello_1.getTrelloLists)(req.query.board_id) });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data || e.message });
    }
});
router.get("/trello/labels", auth_1.authenticateJWT, async (req, res) => {
    try {
        res.json({ labels: await (0, trello_1.getTrelloLabels)(req.query.board_id) });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data || e.message });
    }
});
router.get("/trello/members", auth_1.authenticateJWT, async (req, res) => {
    try {
        res.json({ members: await (0, trello_1.getTrelloMembers)(req.query.board_id) });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data || e.message });
    }
});
// ── Client Meta Connections ───────────────────────────────────────────
router.get("/connections", auth_1.authenticateJWT, async (req, res) => {
    try {
        const connections = await prisma_1.default.clientMetaConnection.findMany({
            include: { client: { select: { name: true, id: true } } },
            orderBy: { connected_at: "desc" },
        });
        // Ocultar tokens
        const safe = connections.map((c) => ({
            ...c,
            access_token: c.access_token ? "••••••••" : null,
            page_access_token: c.page_access_token ? "••••••••" : null,
            ig_access_token: c.ig_access_token ? "••••••••" : null,
            has_facebook: !!c.page_id || !!c.ad_account_id,
            has_instagram: !!c.ig_access_token || (!!c.page_access_token && !!c.instagram_account_id),
        }));
        res.json({ connections: safe });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/connections", auth_1.authenticateJWT, async (req, res) => {
    const { client_id, instagram_account_id, instagram_username, ad_account_id, page_id, page_name, access_token } = req.body;
    if (!client_id) {
        res.status(400).json({ error: "client_id obrigatório" });
        return;
    }
    try {
        // Verificar ownership do cliente
        const client = await prisma_1.default.client.findFirst({ where: { id: client_id, user_id: req.user.id } });
        if (!client) {
            res.status(404).json({ error: "Cliente não encontrado" });
            return;
        }
        const conn = await prisma_1.default.clientMetaConnection.upsert({
            where: { client_id },
            create: { client_id, instagram_account_id, instagram_username, ad_account_id, page_id, page_name, access_token },
            update: {
                ...(instagram_account_id && { instagram_account_id }),
                ...(instagram_username && { instagram_username }),
                ...(ad_account_id && { ad_account_id }),
                ...(page_id && { page_id }),
                ...(page_name && { page_name }),
                ...(access_token && access_token !== "••••••••" && { access_token }),
                updated_at: new Date(),
            },
            include: { client: { select: { name: true } } },
        });
        res.json({ connection: { ...conn, access_token: "••••••••" } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/connections/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.clientMetaConnection.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Instagram: Posts Agendados ────────────────────────────────────────
router.get("/instagram/posts", auth_1.authenticateJWT, async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = client_id;
        const posts = await prisma_1.default.instagramScheduledPost.findMany({
            where,
            orderBy: { scheduled_at: "asc" },
        });
        res.json({ posts });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/instagram/posts", auth_1.authenticateJWT, async (req, res) => {
    const { connection_id, client_id, caption, media_urls, media_type, scheduled_at } = req.body;
    if (!connection_id || !media_urls?.length || !scheduled_at) {
        res.status(400).json({ error: "connection_id, media_urls e scheduled_at são obrigatórios" });
        return;
    }
    try {
        // Validar que a conexão pode publicar (Instagram Login OU Página do Facebook com IG)
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connection_id } });
        const canPublish = !!conn?.ig_access_token
            || (!!conn?.page_access_token && !!conn?.instagram_account_id);
        if (!canPublish) {
            res.status(400).json({
                error: "Esta conta não pode publicar. Use 'Conectar via Instagram' (para contas sem Página) ou selecione uma conta vinculada a uma Página do Facebook.",
            });
            return;
        }
        const post = await prisma_1.default.instagramScheduledPost.create({
            data: {
                connection_id,
                client_id,
                caption: caption || null,
                media_urls: JSON.stringify(media_urls),
                media_type: media_type || "IMAGE",
                scheduled_at: new Date(scheduled_at),
                status: "AGENDADO",
            },
        });
        res.status(201).json({ post });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/instagram/posts/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { caption, scheduled_at, status, media_urls, media_type } = req.body;
    try {
        const post = await prisma_1.default.instagramScheduledPost.update({
            where: { id },
            data: {
                ...(caption !== undefined && { caption }),
                ...(scheduled_at && { scheduled_at: new Date(scheduled_at) }),
                ...(status && { status }),
                ...(media_urls && { media_urls: JSON.stringify(media_urls) }),
                ...(media_type && { media_type }),
            },
        });
        res.json({ post });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/instagram/posts/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.instagramScheduledPost.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Ads: Análises ─────────────────────────────────────────────────────
router.get("/ads/analyses", auth_1.authenticateJWT, async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = client_id;
        const analyses = await prisma_1.default.metaAdsAnalysis.findMany({
            where,
            include: { suggestions: true },
            orderBy: { created_at: "desc" },
            take: 20,
        });
        res.json({ analyses });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/ads/analyze/:connectionId", auth_1.authenticateJWT, async (req, res) => {
    const connectionId = String(req.params.connectionId);
    res.json({ message: "Análise iniciada em background" });
    runAdsAnalysis(connectionId, req.user.id, "MANUAL").catch(console.error);
});
// ── Ads: Sugestões ────────────────────────────────────────────────────
router.get("/ads/suggestions", auth_1.authenticateJWT, async (req, res) => {
    const { client_id, status } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = client_id;
        if (status)
            where.status = status;
        const suggestions = await prisma_1.default.metaAgentSuggestion.findMany({
            where,
            include: { analysis: { select: { created_at: true, triggered_by: true } } },
            orderBy: { created_at: "desc" },
        });
        res.json({ suggestions });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/ads/suggestions/:id", auth_1.authenticateJWT, async (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body;
    try {
        if (status === "APROVADO") {
            // Executar ação via Meta API
            res.json({ message: "Aprovado — executando..." });
            executeSuggestion(id).catch(console.error);
            return;
        }
        const suggestion = await prisma_1.default.metaAgentSuggestion.update({
            where: { id },
            data: { status },
        });
        res.json({ suggestion });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Ads: Métricas em tempo real ───────────────────────────────────────
router.get("/ads/campaigns/:connectionId", auth_1.authenticateJWT, async (req, res) => {
    const { connectionId } = req.params;
    const { date_preset = "last_7d" } = req.query;
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connectionId } });
        if (!conn?.ad_account_id || !conn?.access_token) {
            res.status(400).json({ error: "Conta de anúncios ou token não configurados" });
            return;
        }
        const fields = "id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(" + date_preset + "){spend,impressions,clicks,ctr,cpc,reach,frequency,actions,cost_per_action_type,purchase_roas}";
        const url = `https://graph.facebook.com/v20.0/${conn.ad_account_id}/campaigns`;
        const resp = await axios_1.default.get(url, {
            params: { fields, access_token: conn.access_token, limit: 50 },
        });
        res.json(resp.data);
    }
    catch (e) {
        const metaErr = e.response?.data?.error?.message || e.message;
        res.status(500).json({ error: metaErr });
    }
});
// ── Comentários: Regras ───────────────────────────────────────────────
router.get("/comments/rules", auth_1.authenticateJWT, async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = client_id;
        const rules = await prisma_1.default.instagramCommentRule.findMany({ where, orderBy: { created_at: "desc" } });
        res.json({ rules });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/techqui/comments/subscribe/:connectionId ────────────────
// Inscreve manualmente uma conta já conectada nos webhooks de comentários
router.post("/comments/subscribe/:connectionId", auth_1.authenticateJWT, async (req, res) => {
    const connectionId = String(req.params.connectionId);
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connectionId } });
        const { base, token } = igContext(conn);
        if (!conn?.instagram_account_id || !token) {
            res.status(400).json({ error: "Conexão Instagram inválida" });
            return;
        }
        const r = await axios_1.default.post(`${base}/${conn.instagram_account_id}/subscribed_apps`, null, {
            params: { subscribed_fields: "comments", access_token: token },
        });
        res.json({ success: true, result: r.data });
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
});
// ── GET /api/techqui/comments/diagnose/:connectionId ──────────────────
// Diagnóstico: mostra o que a Meta tem registrado sobre a inscrição da conta
router.get("/comments/diagnose/:connectionId", auth_1.authenticateJWT, async (req, res) => {
    const connectionId = String(req.params.connectionId);
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connectionId } });
        if (!conn?.instagram_account_id) {
            res.status(400).json({ error: "Conexão inválida" });
            return;
        }
        const { base, token } = igContext(conn);
        const out = {
            connection_type: conn.connection_type,
            instagram_account_id: conn.instagram_account_id,
            instagram_username: conn.instagram_username,
        };
        // 1. Inscrição da conta nos webhooks
        try {
            const sub = await axios_1.default.get(`${base}/${conn.instagram_account_id}/subscribed_apps`, {
                params: { access_token: token },
            });
            out.subscribed_apps = sub.data;
        }
        catch (e) {
            out.subscribed_apps_error = e.response?.data?.error?.message || e.message;
        }
        // 2. Permissões do token
        try {
            const me = await axios_1.default.get(`${base}/me`, {
                params: { fields: "user_id,username", access_token: token },
            });
            out.me = me.data;
        }
        catch (e) {
            out.me_error = e.response?.data?.error?.message || e.message;
        }
        res.json(out);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/comments/rules", auth_1.authenticateJWT, async (req, res) => {
    const { connection_id, client_id, name, reply_type, fixed_reply, keywords, apply_to, post_ids } = req.body;
    if (!connection_id || !name || !reply_type) {
        res.status(400).json({ error: "connection_id, name e reply_type são obrigatórios" });
        return;
    }
    try {
        const rule = await prisma_1.default.instagramCommentRule.create({
            data: {
                connection_id,
                client_id,
                name,
                reply_type,
                fixed_reply: fixed_reply || null,
                keywords: keywords?.length ? JSON.stringify(keywords) : null,
                apply_to: apply_to || "TODOS",
                post_ids: post_ids?.length ? JSON.stringify(post_ids) : null,
                active: true,
            },
        });
        res.status(201).json({ rule });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/comments/rules/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { name, reply_type, fixed_reply, keywords, apply_to, post_ids, active } = req.body;
    try {
        const rule = await prisma_1.default.instagramCommentRule.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(reply_type !== undefined && { reply_type }),
                ...(fixed_reply !== undefined && { fixed_reply }),
                ...(keywords !== undefined && { keywords: keywords?.length ? JSON.stringify(keywords) : null }),
                ...(apply_to !== undefined && { apply_to }),
                ...(post_ids !== undefined && { post_ids: post_ids?.length ? JSON.stringify(post_ids) : null }),
                ...(active !== undefined && { active }),
            },
        });
        res.json({ rule });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/comments/rules/:id", auth_1.authenticateJWT, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma_1.default.instagramCommentRule.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get("/comments/logs", auth_1.authenticateJWT, async (req, res) => {
    const { client_id } = req.query;
    try {
        const where = {};
        if (client_id)
            where.client_id = client_id;
        const logs = await prisma_1.default.instagramCommentLog.findMany({
            where,
            orderBy: { created_at: "desc" },
            take: 100,
        });
        res.json({ logs });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Instagram: listar posts publicados (para vincular regras) ─────────
router.get("/instagram/media/:connectionId", auth_1.authenticateJWT, async (req, res) => {
    const { connectionId } = req.params;
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connectionId } });
        const { base, token: igToken } = igContext(conn);
        if (!conn?.instagram_account_id || !igToken) {
            res.status(400).json({ error: "Conta Instagram ou token não configurados" });
            return;
        }
        const resp = await axios_1.default.get(`${base}/${conn.instagram_account_id}/media`, { params: { fields: "id,caption,media_type,thumbnail_url,media_url,timestamp,permalink", limit: 50, access_token: igToken } });
        res.json(resp.data);
    }
    catch (e) {
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
});
exports.default = router;
// ── Helpers internos ──────────────────────────────────────────────────
async function runAdsAnalysis(connectionId, userId, triggeredBy) {
    try {
        const conn = await prisma_1.default.clientMetaConnection.findUnique({ where: { id: connectionId } });
        if (!conn?.ad_account_id || !conn?.access_token)
            return;
        const tqSettings = await prisma_1.default.techQuiSettings.findUnique({ where: { user_id: userId } });
        const companySettings = await (0, companySettings_1.getCompanySettings)();
        const openaiKey = tqSettings?.openai_api_key || companySettings?.openai_api_key;
        if (!openaiKey) {
            console.warn("[AdsAnalyzer] OpenAI key não configurada");
            return;
        }
        // 1. Buscar campanhas + métricas últimos 7 dias via Meta Marketing API
        const fields = "id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(last_7d){spend,impressions,clicks,ctr,cpc,reach,frequency,actions,purchase_roas}";
        const campResp = await axios_1.default.get(`https://graph.facebook.com/v20.0/${conn.ad_account_id}/campaigns`, {
            params: { fields, access_token: conn.access_token, limit: 50 },
        });
        const campaigns = campResp.data.data || [];
        if (!campaigns.length)
            return;
        const rawData = JSON.stringify(campaigns);
        // 2. Analisar com Claude/OpenAI
        const openai = new openai_1.default({ apiKey: openaiKey });
        const prompt = `Você é um especialista em tráfego pago do Facebook Ads. Analise as campanhas abaixo e gere sugestões de otimização com base nas métricas dos últimos 7 dias. Para cada sugestão, informe: título curto, descrição detalhada do porquê, e a ação a tomar (PAUSE_CAMPAIGN, INCREASE_BUDGET, DECREASE_BUDGET, PAUSE_ADSET, UPDATE_BID) com os parâmetros necessários. Responda APENAS em JSON no formato: {"analysis": "texto resumo da análise", "suggestions": [{"title": "...", "description": "...", "action_type": "PAUSE_CAMPAIGN", "action_payload": {"campaign_id": "..."}, "priority": "alta|media|baixa"}]}. Campanhas: ${rawData}`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0].message.content || "{}");
        const analysisText = parsed.analysis || "Análise concluída.";
        const suggestionsRaw = parsed.suggestions || [];
        // 3. Salvar análise + sugestões
        const analysis = await prisma_1.default.metaAdsAnalysis.create({
            data: {
                connection_id: connectionId,
                client_id: conn.client_id,
                triggered_by: triggeredBy,
                raw_data: rawData,
                analysis_text: analysisText,
            },
        });
        for (const s of suggestionsRaw) {
            await prisma_1.default.metaAgentSuggestion.create({
                data: {
                    analysis_id: analysis.id,
                    client_id: conn.client_id,
                    title: s.title || "Sugestão",
                    description: s.description || "",
                    action_type: s.action_type || "PAUSE_CAMPAIGN",
                    action_payload: JSON.stringify(s.action_payload || {}),
                    status: "PENDENTE",
                },
            });
        }
        console.log(`[AdsAnalyzer] Análise concluída para connection ${connectionId} — ${suggestionsRaw.length} sugestão(ões)`);
    }
    catch (err) {
        console.error("[AdsAnalyzer] Erro:", err.message);
    }
}
async function executeSuggestion(suggestionId) {
    try {
        const sug = await prisma_1.default.metaAgentSuggestion.findUnique({
            where: { id: suggestionId },
            include: { analysis: { include: { connection: true } } },
        });
        if (!sug)
            return;
        const conn = sug.analysis.connection;
        const payload = JSON.parse(sug.action_payload || "{}");
        const token = conn.access_token;
        let result = "Executado com sucesso";
        try {
            switch (sug.action_type) {
                case "PAUSE_CAMPAIGN":
                    await axios_1.default.post(`https://graph.facebook.com/v20.0/${payload.campaign_id}`, { status: "PAUSED", access_token: token });
                    break;
                case "INCREASE_BUDGET":
                case "DECREASE_BUDGET":
                    await axios_1.default.post(`https://graph.facebook.com/v20.0/${payload.campaign_id}`, { daily_budget: payload.new_budget, access_token: token });
                    break;
                case "PAUSE_ADSET":
                    await axios_1.default.post(`https://graph.facebook.com/v20.0/${payload.adset_id}`, { status: "PAUSED", access_token: token });
                    break;
                case "UPDATE_BID":
                    await axios_1.default.post(`https://graph.facebook.com/v20.0/${payload.adset_id}`, { bid_amount: payload.bid_amount, access_token: token });
                    break;
            }
        }
        catch (apiErr) {
            result = apiErr.response?.data?.error?.message || apiErr.message;
            await prisma_1.default.metaAgentSuggestion.update({
                where: { id: suggestionId },
                data: { status: "ERRO", result, executed_at: new Date() },
            });
            return;
        }
        await prisma_1.default.metaAgentSuggestion.update({
            where: { id: suggestionId },
            data: { status: "EXECUTADO", result, executed_at: new Date() },
        });
    }
    catch (err) {
        console.error("[ExecuteSuggestion] Erro:", err.message);
    }
}
async function handleIncomingComment(comment) {
    try {
        // Evitar duplicata
        const already = await prisma_1.default.instagramCommentLog.findUnique({ where: { comment_id: comment.comment_id } });
        if (already)
            return;
        // Encontrar a conexão dona da conta que recebeu o comentário
        const conn = comment.account_id
            ? await prisma_1.default.clientMetaConnection.findFirst({
                where: { instagram_account_id: comment.account_id },
                include: { comment_rules: { where: { active: true } } },
            })
            : null;
        if (!conn) {
            console.warn("[CommentHandler] Conexão não encontrada para conta", comment.account_id);
            return;
        }
        const { base, token: igToken } = igContext(conn);
        if (!igToken)
            return;
        const rules = conn.comment_rules || [];
        if (!rules.length)
            return;
        // Encontrar regra aplicável
        const rule = findMatchingRule(rules, comment.post_id, comment.text);
        if (!rule)
            return;
        let replyText = null;
        if (rule.reply_type === "FIXO") {
            replyText = rule.fixed_reply;
        }
        else {
            const settings = await (0, companySettings_1.getCompanySettings)();
            const openaiKey = settings?.openai_api_key;
            if (openaiKey) {
                const openai = new openai_1.default({ apiKey: openaiKey });
                const resp = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Você é o assistente da conta de Instagram. Responda ao comentário de forma amigável, natural, em português, em no máximo 2 frases." },
                        { role: "user", content: `Comentário de @${comment.username}: "${comment.text}"` },
                    ],
                });
                replyText = resp.choices[0].message.content || null;
            }
        }
        if (!replyText)
            return;
        let status = "RESPONDIDO";
        try {
            await axios_1.default.post(`${base}/${comment.comment_id}/replies`, null, {
                params: { message: replyText, access_token: igToken },
            });
        }
        catch (e) {
            status = "ERRO";
            replyText = e.response?.data?.error?.message || e.message;
        }
        await prisma_1.default.instagramCommentLog.create({
            data: {
                connection_id: conn.id,
                client_id: conn.client_id,
                rule_id: rule.id,
                comment_id: comment.comment_id,
                post_id: comment.post_id,
                commenter_username: comment.username,
                comment_text: comment.text,
                reply_text: replyText,
                replied_at: new Date(),
                status,
            },
        });
    }
    catch (err) {
        console.error("[CommentHandler] Erro:", err.message);
    }
}
function findMatchingRule(rules, postId, commentText) {
    // Prioridade: regras com post específico antes das abertas
    const sorted = [...rules].sort((a, b) => {
        const aSpecific = a.apply_to === "ESPECIFICOS" ? -1 : 1;
        const bSpecific = b.apply_to === "ESPECIFICOS" ? -1 : 1;
        return aSpecific - bSpecific;
    });
    for (const rule of sorted) {
        // Checar se o post está no escopo
        if (rule.apply_to === "ESPECIFICOS") {
            const postIds = JSON.parse(rule.post_ids || "[]");
            if (!postIds.includes(postId))
                continue;
        }
        // Checar palavras-chave
        const keywords = JSON.parse(rule.keywords || "[]");
        if (keywords.length > 0) {
            const lower = commentText.toLowerCase();
            const matches = keywords.some((kw) => lower.includes(kw.toLowerCase()));
            if (!matches)
                continue;
        }
        return rule;
    }
    return null;
}
//# sourceMappingURL=techqui.js.map