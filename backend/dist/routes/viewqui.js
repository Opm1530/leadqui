"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// ── GET /api/viewqui/dashboard ───────────────────────────────────────────
// Returns all data for the client portal (CLIENT role only)
router.get("/dashboard", auth_1.authenticateJWT, async (req, res) => {
    try {
        if (req.user?.role !== "CLIENT") {
            res.status(403).json({ error: "Acesso restrito a clientes" });
            return;
        }
        const client = await prisma_1.default.client.findFirst({
            where: { login_user_id: req.user.id },
            include: { services: true },
        });
        if (!client) {
            res.status(404).json({ error: "Perfil de cliente não encontrado" });
            return;
        }
        const clientId = client.id;
        // Fetch all relevant data in parallel
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const [tasks, projects, calendarPosts, trafficCampaigns, invoices] = await Promise.all([
            // Active tasks for this client
            prisma_1.default.task.findMany({
                where: { client_id: clientId },
                include: {
                    project: { select: { id: true, name: true } },
                    responsible: { select: { id: true, name: true } },
                },
                orderBy: { created_at: "desc" },
                take: 50,
            }),
            // Projects for this client
            prisma_1.default.project.findMany({
                where: { client_id: clientId },
                include: {
                    tasks: { select: { id: true, status: true } },
                },
                orderBy: { created_at: "desc" },
            }),
            // Calendar posts for current month
            prisma_1.default.calendarPost.findMany({
                where: {
                    client_id: clientId,
                    scheduled_date: {
                        gte: new Date(year, month, 1),
                        lte: new Date(year, month + 1, 0, 23, 59, 59),
                    },
                },
                orderBy: { scheduled_date: "asc" },
            }),
            // Active traffic campaigns
            prisma_1.default.trafficCampaign.findMany({
                where: { client_id: clientId, status: "ATIVO" },
                orderBy: { created_at: "desc" },
            }),
            // Pending and recent invoices
            prisma_1.default.invoice.findMany({
                where: { client_id: clientId },
                orderBy: { due_date: "desc" },
                take: 10,
            }),
        ]);
        res.json({
            client: {
                id: client.id,
                name: client.name,
                services: client.services,
            },
            tasks,
            projects,
            calendarPosts,
            trafficCampaigns,
            invoices,
        });
    }
    catch (error) {
        console.error("ViewQui dashboard error:", error);
        res.status(500).json({ error: "Erro ao carregar dados do portal" });
    }
});
// ── PATCH /api/viewqui/calendar/:id/approve ──────────────────────────────
// Allow CLIENT to approve a calendar post (PLANEJADO → APROVADO)
router.patch("/calendar/:id/approve", auth_1.authenticateJWT, async (req, res) => {
    try {
        if (req.user?.role !== "CLIENT") {
            res.status(403).json({ error: "Acesso restrito a clientes" });
            return;
        }
        const client = await prisma_1.default.client.findFirst({
            where: { login_user_id: req.user.id },
        });
        if (!client) {
            res.status(404).json({ error: "Perfil de cliente não encontrado" });
            return;
        }
        const post = await prisma_1.default.calendarPost.findFirst({
            where: { id: req.params.id, client_id: client.id },
        });
        if (!post) {
            res.status(404).json({ error: "Post não encontrado" });
            return;
        }
        if (post.status !== "PLANEJADO" && post.status !== "PRODUZINDO") {
            res.status(400).json({ error: "Somente posts em planejamento ou produção podem ser aprovados" });
            return;
        }
        const updated = await prisma_1.default.calendarPost.update({
            where: { id: req.params.id },
            data: { status: "APROVADO" },
        });
        res.json({ post: updated });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao aprovar post" });
    }
});
exports.default = router;
//# sourceMappingURL=viewqui.js.map