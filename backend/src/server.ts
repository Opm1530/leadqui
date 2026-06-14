import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth";
import leadsRoutes from "./routes/leads";
import instancesRoutes from "./routes/instances";
import campaignsRoutes from "./routes/campaigns";
import resourcesRoutes from "./routes/resources";
import crmRoutes from "./routes/crm";
import teamquiRoutes from "./routes/teamqui";
import tasquiRoutes from "./routes/tasqui";
import cashquiRoutes from "./routes/cashqui";
import viewquiRoutes from "./routes/viewqui";
import templatesRoutes from "./routes/templates";
import notificationsRoutes from "./routes/notifications";
import { startRecurringInvoicesJob } from "./lib/recurringInvoices";
import { startNotificationChecker } from "./lib/notificationChecker";
import { startDemandDigest } from "./lib/demandDigest";
import techquiRoutes from "./routes/techqui";
import vaultRoutes from "./routes/vault";
import legalRoutes from "./routes/legal";
import assistantRoutes from "./routes/assistant";
import whatsappRoutes from "./routes/whatsapp";
import demandsRoutes from "./routes/demands";
import { startInstagramScheduler } from "./lib/instagramScheduler";
import { startAdsAnalyzerJob } from "./lib/adsAnalyzerJob";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & Parsing ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // compatibilidade com uploads de imagem
}));

// Rate limiting simples para rotas de auth (proteção contra brute-force)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
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
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith("http://localhost") || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error("Bloqueado pelo CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Pequi Digital API", timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/instances", instancesRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/teamqui", teamquiRoutes);
app.use("/api/tasqui", tasquiRoutes);
app.use("/api/cashqui", cashquiRoutes);
app.use("/api/viewqui", viewquiRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/techqui", techquiRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/legal", legalRoutes); // páginas públicas (privacidade, termos, exclusão)
app.use("/api/assistant", assistantRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/demands", demandsRoutes);
app.use("/api", resourcesRoutes);

// ── 404 ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// ── Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍈 Pequi Digital API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
  startRecurringInvoicesJob();
  startNotificationChecker();
  startInstagramScheduler();
  startAdsAnalyzerJob();
  startDemandDigest();
});

export default app;
