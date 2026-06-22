"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireStaff);
// ── GET /api/demands ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
    const status = req.query.status;
    const where = {};
    if (status)
        where.status = status;
    const demands = await prisma_1.default.demand.findMany({
        where,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { created_at: "desc" },
        take: 200,
    });
    res.json({ demands });
});
// ── PATCH /api/demands/:id ────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
    const { status, summary } = req.body || {};
    try {
        const demand = await prisma_1.default.demand.update({
            where: { id: String(req.params.id) },
            data: { ...(status && { status }), ...(summary && { summary }) },
        });
        res.json({ demand });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── DELETE /api/demands/:id ───────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    try {
        await prisma_1.default.demand.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── POST /api/demands/:id/to-task ─────────────────────────────────────
// Promove a demanda para uma tarefa no Tasqui
router.post("/:id/to-task", async (req, res) => {
    try {
        const demand = await prisma_1.default.demand.findUnique({ where: { id: String(req.params.id) } });
        if (!demand) {
            res.status(404).json({ error: "Demanda não encontrada" });
            return;
        }
        const task = await prisma_1.default.task.create({
            data: {
                project_id: null,
                client_id: demand.client_id,
                responsible_id: req.body?.responsible_id || null,
                title: demand.summary,
                description: `Demanda captada no WhatsApp${demand.sender ? ` (${demand.sender})` : ""}:\n"${demand.original_text}"`,
                status: "PENDENTE",
                priority: "MEDIA",
            },
        });
        await prisma_1.default.demand.update({
            where: { id: demand.id }, data: { status: "EM_ANDAMENTO", task_id: task.id },
        });
        res.json({ success: true, task });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=demands.js.map