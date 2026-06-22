"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const auth_1 = __importDefault(require("./routes/auth"));
const leads_1 = __importDefault(require("./routes/leads"));
const instances_1 = __importDefault(require("./routes/instances"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const resources_1 = __importDefault(require("./routes/resources"));
const crm_1 = __importDefault(require("./routes/crm"));
const teamqui_1 = __importDefault(require("./routes/teamqui"));
const tasqui_1 = __importDefault(require("./routes/tasqui"));
const cashqui_1 = __importDefault(require("./routes/cashqui"));
const viewqui_1 = __importDefault(require("./routes/viewqui"));
const templates_1 = __importDefault(require("./routes/templates"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const recurringInvoices_1 = require("./lib/recurringInvoices");
const notificationChecker_1 = require("./lib/notificationChecker");
const demandDigest_1 = require("./lib/demandDigest");
const teamDigest_1 = require("./lib/teamDigest");
const techqui_1 = __importDefault(require("./routes/techqui"));
const vault_1 = __importDefault(require("./routes/vault"));
const legal_1 = __importDefault(require("./routes/legal"));
const assistant_1 = __importDefault(require("./routes/assistant"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const demands_1 = __importDefault(require("./routes/demands"));
const influencers_1 = __importDefault(require("./routes/influencers"));
const onboarding_1 = __importDefault(require("./routes/onboarding"));
const dashqui_1 = __importDefault(require("./routes/dashqui"));
const instagramScheduler_1 = require("./lib/instagramScheduler");
const adsAnalyzerJob_1 = require("./lib/adsAnalyzerJob");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// ── Security & Parsing ────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // compatibilidade com uploads de imagem
}));
// Rate limiting simples para rotas de auth (proteção contra brute-force)
const authAttempts = new Map();
app.use("/api/auth/login", (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const entry = authAttempts.get(ip);
    if (entry && now < entry.resetAt) {
        if (entry.count >= 10) {
            res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos." });
            return;
        }
        entry.count++;
    }
    else {
        authAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }
    next();
});
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith("http://localhost") || origin === process.env.FRONTEND_URL) {
            callback(null, true);
        }
        else {
            callback(new Error("Bloqueado pelo CORS"));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// ── Health Check ──────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "Pequi Digital API", timestamp: new Date().toISOString() });
});
// ── Routes ────────────────────────────────────────────────────────────
app.use("/api/auth", auth_1.default);
app.use("/api/leads", leads_1.default);
app.use("/api/instances", instances_1.default);
app.use("/api/campaigns", campaigns_1.default);
app.use("/api/crm", crm_1.default);
app.use("/api/teamqui", teamqui_1.default);
app.use("/api/tasqui", tasqui_1.default);
app.use("/api/cashqui", cashqui_1.default);
app.use("/api/viewqui", viewqui_1.default);
app.use("/api/templates", templates_1.default);
app.use("/api/notifications", notifications_1.default);
app.use("/api/techqui", techqui_1.default);
app.use("/api/vault", vault_1.default);
app.use("/api/legal", legal_1.default); // páginas públicas (privacidade, termos, exclusão)
app.use("/api/assistant", assistant_1.default);
app.use("/api/whatsapp", whatsapp_1.default);
app.use("/api/demands", demands_1.default);
app.use("/api/influencers", influencers_1.default);
app.use("/api/onboarding", onboarding_1.default);
app.use("/api/dashqui", dashqui_1.default);
app.use("/api", resources_1.default);
// ── 404 ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
});
// ── Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
});
// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🍈 Pequi Digital API rodando na porta ${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
    (0, recurringInvoices_1.startRecurringInvoicesJob)();
    (0, notificationChecker_1.startNotificationChecker)();
    (0, instagramScheduler_1.startInstagramScheduler)();
    (0, adsAnalyzerJob_1.startAdsAnalyzerJob)();
    (0, demandDigest_1.startDemandDigest)();
    (0, teamDigest_1.startTeamDigest)();
});
exports.default = app;
//# sourceMappingURL=server.js.map