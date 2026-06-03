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
import settingsRoutes from "./routes/settings";
import cashquiRoutes from "./routes/cashqui";
import viewquiRoutes from "./routes/viewqui";
import templatesRoutes from "./routes/templates";
import notificationsRoutes from "./routes/notifications";
import { startRecurringInvoicesJob } from "./lib/recurringInvoices";
import { startNotificationChecker } from "./lib/notificationChecker";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & Parsing ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, curl) e qualquer localhost
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
app.use("/api/settings", settingsRoutes);
app.use("/api/cashqui", cashquiRoutes);
app.use("/api/viewqui", viewquiRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/notifications", notificationsRoutes);
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
});

export default app;
