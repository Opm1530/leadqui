import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// Início/fim do dia atual em São Paulo (container roda em UTC)
function hojeSP() {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return { start: new Date(`${dia}T00:00:00-03:00`), end: new Date(`${dia}T23:59:59-03:00`) };
}

// ── GET /api/dashqui ──────────────────────────────────────────────────
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = hojeSP();

    // Tarefas do dia (prazo até hoje, não concluídas, não arquivadas)
    const tasks = await (prisma as any).task.findMany({
      where: { archived: false, status: { not: "CONCLUIDO" }, due_date: { lte: end } },
      include: { client: { select: { name: true } }, responsible: { select: { id: true, name: true } } },
      orderBy: { due_date: "asc" },
      take: 200,
    });

    // Posts agendados (do dia em diante, ainda não publicados)
    const posts = await (prisma as any).calendarPost.findMany({
      where: { status: { not: "PUBLICADO" }, scheduled_date: { gte: start } },
      include: { client: { select: { name: true } } },
      orderBy: { scheduled_date: "asc" },
      take: 30,
    });

    // Movimentações financeiras do dia
    const invoicesDue = await (prisma as any).invoice.findMany({
      where: { due_date: { gte: start, lte: end } },
      include: { client: { select: { name: true } } },
    });
    const invoicesPaid = await (prisma as any).invoice.findMany({
      where: { paid_date: { gte: start, lte: end } },
      include: { client: { select: { name: true } } },
    });
    const expenses = await (prisma as any).expense.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const totalRecebidoHoje = invoicesPaid.reduce((a: number, i: any) => a + (i.amount || 0), 0);
    const totalAReceberHoje = invoicesDue.filter((i: any) => i.status !== "PAGO").reduce((a: number, i: any) => a + (i.amount || 0), 0);
    const totalDespesasHoje = expenses.reduce((a: number, e: any) => a + (e.amount || 0), 0);

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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
