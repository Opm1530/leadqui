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
// Início/fim do dia atual em São Paulo (container roda em UTC)
function hojeSP() {
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return { start: new Date(`${dia}T00:00:00-03:00`), end: new Date(`${dia}T23:59:59-03:00`) };
}
// ── GET /api/dashqui ──────────────────────────────────────────────────
router.get("/", async (_req, res) => {
    try {
        const { start, end } = hojeSP();
        // Tarefas do dia (prazo até hoje, não concluídas, não arquivadas)
        const tasks = await prisma_1.default.task.findMany({
            where: { archived: false, status: { not: "CONCLUIDO" }, due_date: { lte: end } },
            include: { client: { select: { name: true } }, responsible: { select: { name: true } } },
            orderBy: { due_date: "asc" },
            take: 50,
        });
        // Posts agendados (do dia em diante, ainda não publicados)
        const posts = await prisma_1.default.calendarPost.findMany({
            where: { status: { not: "PUBLICADO" }, scheduled_date: { gte: start } },
            include: { client: { select: { name: true } } },
            orderBy: { scheduled_date: "asc" },
            take: 30,
        });
        // Movimentações financeiras do dia
        const invoicesDue = await prisma_1.default.invoice.findMany({
            where: { due_date: { gte: start, lte: end } },
            include: { client: { select: { name: true } } },
        });
        const invoicesPaid = await prisma_1.default.invoice.findMany({
            where: { paid_date: { gte: start, lte: end } },
            include: { client: { select: { name: true } } },
        });
        const expenses = await prisma_1.default.expense.findMany({
            where: { date: { gte: start, lte: end } },
        });
        const totalRecebidoHoje = invoicesPaid.reduce((a, i) => a + (i.amount || 0), 0);
        const totalAReceberHoje = invoicesDue.filter((i) => i.status !== "PAGO").reduce((a, i) => a + (i.amount || 0), 0);
        const totalDespesasHoje = expenses.reduce((a, e) => a + (e.amount || 0), 0);
        res.json({
            tasks,
            posts,
            finance: {
                recebido_hoje: totalRecebidoHoje,
                a_receber_hoje: totalAReceberHoje,
                despesas_hoje: totalDespesasHoje,
                invoices_due: invoicesDue,
                invoices_paid: invoicesPaid,
                expenses,
            },
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=dashqui.js.map