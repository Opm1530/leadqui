import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import axios from "axios";
import https from "https";
import { dayDate } from "../lib/dates";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── Dashboard ─────────────────────────────────────────────────────────
router.get("/dashboard", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Atualizar faturas vencidas automaticamente (toda a empresa)
    await (prisma as any).invoice.updateMany({
      where: { status: "PENDENTE", due_date: { lt: now } },
      data: { status: "ATRASADO" },
    });

    const [invoices, expenses, clients, contracts] = await Promise.all([
      (prisma as any).invoice.findMany({
        include: { client: { select: { name: true } } },
      }),
      (prisma as any).expense.findMany(),
      (prisma as any).client.findMany({
        where: { status: "ATIVO" },
        select: { id: true },
      }),
      // MRR real: soma dos contratos ativos
      (prisma as any).contract.findMany({
        where: { client: { status: "ATIVO" } },
        select: { value: true },
      }),
    ]);

    const paidThisMonth = invoices
      .filter((i: any) => i.status === "PAGO" && i.paid_date >= startOfMonth && i.paid_date <= endOfMonth)
      .reduce((sum: number, i: any) => sum + i.amount, 0);

    const pendingTotal = invoices
      .filter((i: any) => i.status === "PENDENTE")
      .reduce((sum: number, i: any) => sum + i.amount, 0);

    const overdueTotal = invoices
      .filter((i: any) => i.status === "ATRASADO")
      .reduce((sum: number, i: any) => sum + i.amount, 0);

    const expensesThisMonth = expenses
      .filter((e: any) => e.date >= startOfMonth && e.date <= endOfMonth)
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    // MRR = soma dos valores de contrato dos clientes ativos
    const mrrTotal = contracts.reduce((sum: number, c: any) => sum + Number(c.value), 0);

    res.json({
      mrr: mrrTotal,
      paid_this_month: paidThisMonth,
      pending_total: pendingTotal,
      overdue_total: overdueTotal,
      expenses_this_month: expensesThisMonth,
      profit_this_month: paidThisMonth - expensesThisMonth,
      active_clients: clients.length,
      overdue_clients: invoices.filter((i: any) => i.status === "ATRASADO").length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Faturas ───────────────────────────────────────────────────────────
router.get("/invoices", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { status, client_id } = req.query;

    // Todas as faturas da empresa (incluindo órfãs de clientes excluídos)
    const where: any = {};
    if (status) where.status = status;
    if (client_id) where.client_id = client_id;

    // Atualizar status de faturas vencidas
    await (prisma as any).invoice.updateMany({
      where: { status: "PENDENTE", due_date: { lt: new Date() } },
      data: { status: "ATRASADO" },
    });

    const invoices = await (prisma as any).invoice.findMany({
      where,
      include: { client: { select: { name: true, email: true } } },
      orderBy: { due_date: "asc" },
    });

    // Injetar nome do snapshot quando o cliente foi excluído
    const normalized = invoices.map((inv: any) => ({
      ...inv,
      client: inv.client ?? (inv.client_name_snapshot ? { name: `${inv.client_name_snapshot} (excluído)`, email: null } : null),
    }));

    res.json({ invoices: normalized });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/invoices", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, description, amount, due_date } = req.body;
  if (!client_id || !amount || !due_date) {
    res.status(400).json({ error: "client_id, amount e due_date são obrigatórios" });
    return;
  }

  try {
    const client = await (prisma as any).client.findFirst({
      where: { id: client_id },
    });
    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    const invoice = await (prisma as any).invoice.create({
      data: {
        client_id,
        description: description || null,
        amount: parseFloat(amount),
        due_date: dayDate(due_date)!,
        status: "PENDENTE",
      },
      include: { client: { select: { name: true } } },
    });

    res.status(201).json({ invoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/invoices/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, paid_date, description, amount, due_date } = req.body;

  try {
    const invoice = await (prisma as any).invoice.findFirst({
      where: { id },
    });
    if (!invoice) { res.status(404).json({ error: "Fatura não encontrada" }); return; }

    const updated = await (prisma as any).invoice.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(paid_date !== undefined && { paid_date: dayDate(paid_date) }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(due_date !== undefined && { due_date: dayDate(due_date)! }),
      },
      include: { client: { select: { name: true } } },
    });

    // Se marcou como pago e não tem data, usar agora
    if (status === "PAGO" && !paid_date) {
      await (prisma as any).invoice.update({
        where: { id },
        data: { paid_date: new Date() },
      });
    }

    // Sincronizar status do cliente
    if (status === "ATRASADO") {
      await (prisma as any).client.update({
        where: { id: invoice.client_id },
        data: { status: "INADIMPLENTE" },
      });
    } else if (status === "PAGO") {
      const hasOtherOverdue = await (prisma as any).invoice.findFirst({
        where: { client_id: invoice.client_id, status: "ATRASADO", id: { not: id } },
      });
      if (!hasOtherOverdue) {
        await (prisma as any).client.update({
          where: { id: invoice.client_id },
          data: { status: "ATIVO" },
        });
      }
    }

    res.json({ invoice: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/invoices/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const invoice = await (prisma as any).invoice.findFirst({
      where: { id },
    });
    if (!invoice) { res.status(404).json({ error: "Fatura não encontrada" }); return; }

    await (prisma as any).invoice.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Despesas ──────────────────────────────────────────────────────────
router.get("/expenses", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const where: any = {};

    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const expenses = await (prisma as any).expense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    res.json({ expenses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/expenses", async (req: AuthRequest, res: Response): Promise<void> => {
  const { description, amount, category, date } = req.body;
  if (!description || !amount || !date) {
    res.status(400).json({ error: "description, amount e date são obrigatórios" });
    return;
  }

  try {
    const expense = await (prisma as any).expense.create({
      data: {
        user_id: req.user!.id,
        description,
        amount: parseFloat(amount),
        category: category || "OUTROS",
        date: dayDate(date)!,
      },
    });

    res.status(201).json({ expense });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/expenses/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { description, amount, category, date } = req.body;

  try {
    const existing = await (prisma as any).expense.findFirst({
      where: { id },
    });
    if (!existing) { res.status(404).json({ error: "Despesa não encontrada" }); return; }

    const expense = await (prisma as any).expense.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(category && { category }),
        ...(date && { date: dayDate(date)! }),
      },
    });

    res.json({ expense });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/expenses/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await (prisma as any).expense.findFirst({
      where: { id },
    });
    if (!existing) { res.status(404).json({ error: "Despesa não encontrada" }); return; }

    await (prisma as any).expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Relatório ─────────────────────────────────────────────────────────
router.get("/report", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { year = new Date().getFullYear() } = req.query;

    const months = [];
    for (let m = 0; m < 12; m++) {
      const start = new Date(Number(year), m, 1);
      const end = new Date(Number(year), m + 1, 0, 23, 59, 59);

      const [invoicesPaid, expensesMonth] = await Promise.all([
        (prisma as any).invoice.findMany({
          where: {
            isNot: undefined,
            status: "PAGO",
            paid_date: { gte: start, lte: end },
          },
        }),
        (prisma as any).expense.findMany({
          where: { date: { gte: start, lte: end } },
        }),
      ]);

      const revenue = invoicesPaid.reduce((sum: number, i: any) => sum + i.amount, 0);
      const expenses = expensesMonth.reduce((sum: number, e: any) => sum + e.amount, 0);

      months.push({
        month: m + 1,
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    res.json({ year: Number(year), months });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Despesas Fixas ────────────────────────────────────────────────────
router.get("/fixed-expenses", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await (prisma as any).fixedExpense.findMany({
      orderBy: { due_day: "asc" },
    });
    res.json({ fixed_expenses: items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/fixed-expenses", async (req: AuthRequest, res: Response): Promise<void> => {
  const { description, amount, category, due_day } = req.body;
  if (!description || !amount || !due_day) {
    res.status(400).json({ error: "description, amount e due_day são obrigatórios" });
    return;
  }
  try {
    const item = await (prisma as any).fixedExpense.create({
      data: {
        user_id: req.user!.id,
        description,
        amount: parseFloat(amount),
        category: category || "OUTROS",
        due_day: parseInt(due_day),
      },
    });
    res.status(201).json({ fixed_expense: item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/fixed-expenses/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { description, amount, category, due_day, active } = req.body;
  try {
    const existing = await (prisma as any).fixedExpense.findFirst({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
    const item = await (prisma as any).fixedExpense.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(category && { category }),
        ...(due_day !== undefined && { due_day: parseInt(due_day) }),
        ...(active !== undefined && { active }),
      },
    });
    res.json({ fixed_expense: item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/fixed-expenses/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await (prisma as any).fixedExpense.findFirst({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
    await (prisma as any).fixedExpense.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Inter Bank ────────────────────────────────────────────────────────

// Salvar / atualizar credenciais Inter
router.post("/inter/credentials", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, client_secret, account_number, cert_content, key_content } = req.body;
  if (!client_id || !client_secret) {
    res.status(400).json({ error: "client_id e client_secret são obrigatórios" });
    return;
  }
  try {
    const creds = await (prisma as any).interCredentials.upsert({
      update: {
        client_id,
        client_secret,
        account_number: account_number || null,
        ...(cert_content ? { cert_content } : {}),
        ...(key_content  ? { key_content  } : {}),
      },
      create: {
        user_id: req.user!.id,
        client_id,
        client_secret,
        account_number: account_number || null,
        cert_content: cert_content || null,
        key_content: key_content || null,
      },
    });
    res.json({ success: true, configured: true, account_number: creds.account_number, has_cert: !!creds.cert_content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar status das credenciais
router.get("/inter/credentials", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const creds = await (prisma as any).interCredentials.findUnique({
      select: { client_id: true, account_number: true, last_sync: true, cert_content: true, key_content: true },
    });
    res.json({
      configured: !!creds,
      credentials: creds ? {
        client_id: creds.client_id,
        account_number: creds.account_number,
        last_sync: creds.last_sync,
        has_cert: !!creds.cert_content,
        has_key: !!creds.key_content,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronizar extrato Inter (mesmo fluxo do n8n: mTLS + x-conta-corrente)
router.post("/inter/sync", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const creds = await (prisma as any).interCredentials.findUnique({
    });
    if (!creds) { res.status(400).json({ error: "Credenciais Inter não configuradas" }); return; }
    if (!creds.cert_content || !creds.key_content) {
      res.status(400).json({ error: "Certificado mTLS não configurado. Adicione o .crt e .key nas configurações do Banco Inter." });
      return;
    }

    // Agente HTTPS com mTLS (igual ao SSL Certificates do n8n)
    const httpsAgent = new https.Agent({
      cert: creds.cert_content,
      key: creds.key_content,
      rejectUnauthorized: true,
    });

    const fmtDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, "0");
      const dd   = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    // 1. OAuth2 token com mTLS
    const tokenRes = await axios.post(
      "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
      new URLSearchParams({
        client_id:     creds.client_id,
        client_secret: creds.client_secret,
        scope:         "extrato.read",
        grant_type:    "client_credentials",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        httpsAgent,
      }
    );
    const token = tokenRes.data.access_token;

    // 2. Buscar extrato (dataInicio = 30 dias atrás, dataFim = hoje)
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);

    const extratoRes = await axios.get(
      "https://cdpj.partners.bancointer.com.br/banking/v2/extrato",
      {
        params: { dataInicio: fmtDate(start), dataFim: fmtDate(today) },
        headers: {
          Authorization:    `Bearer ${token}`,
          "x-conta-corrente": creds.account_number || "",
          "Content-Type":   "application/json",
        },
        httpsAgent,
      }
    );

    // 3. Mapear transações — campos reais da API Inter:
    //    tipoOperacao: 'C' (crédito) | 'D' (débito)
    //    dataEntrada:  "YYYY-MM-DD"
    //    descricao:    descrição
    //    valor:        string com vírgula como separador decimal
    const transactions: any[] = extratoRes.data?.transacoes || [];
    let imported = 0;
    let skipped  = 0;

    for (const tx of transactions) {
      // Monta ID único igual ao n8n: "dataEntrada_valor_descricao"
      const txId = `${tx.dataEntrada}_${tx.valor}_${tx.descricao}`;

      const existing = await (prisma as any).interTransaction.findUnique({
        where: { transaction_id: txId },
      });
      if (existing) { skipped++; continue; }

      // Converte vírgula → ponto e faz parseFloat (exatamente como o n8n)
      const amount   = parseFloat(String(tx.valor).replace(",", "."));
      const isDebit  = tx.tipoOperacao === "D";

      await (prisma as any).interTransaction.create({
        data: {
          credentials_id: creds.id,
          transaction_id: txId,
          date:     new Date(tx.dataEntrada),
          title:    tx.descricao || tx.titulo || "Transação",
          amount:   Math.abs(amount),
          type:     isDebit ? "DEBITO" : "CREDITO",
          category: tx.tipoPagamento || tx.tipoTransacao || null,
          status:   "PENDENTE",
        },
      });
      imported++;
    }

    // 4. Atualizar last_sync
    await (prisma as any).interCredentials.update({
      data:  { last_sync: new Date() },
    });

    res.json({ success: true, imported, skipped, total: transactions.length });
  } catch (error: any) {
    const apiError = error.response?.data;
    const msg = apiError
      ? `${apiError.title || "Erro Inter"}: ${apiError.detail || apiError.message || JSON.stringify(apiError)}`
      : error.message;
    res.status(500).json({ error: `Erro ao sincronizar Inter: ${msg}` });
  }
});

// Listar transações Inter
router.get("/inter/transactions", async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.query;
  try {
    const creds = await (prisma as any).interCredentials.findUnique({ where: { user_id: req.user!.id } });
    if (!creds) { res.json({ transactions: [] }); return; }

    const where: any = { credentials_id: creds.id };
    if (status) where.status = status;

    const transactions = await (prisma as any).interTransaction.findMany({
      where,
      orderBy: { date: "desc" },
    });
    res.json({ transactions, last_sync: creds.last_sync });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vincular transação a uma fatura ou despesa
router.patch("/inter/transactions/:id/link", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, linked_invoice_id, linked_expense_id } = req.body;
  try {
    const tx = await (prisma as any).interTransaction.update({
      where: { id },
      data: {
        status: status || "VINCULADO",
        ...(linked_invoice_id && { linked_invoice_id }),
        ...(linked_expense_id && { linked_expense_id }),
      },
    });

    // Se vinculou a uma fatura, marcar como paga automaticamente
    if (linked_invoice_id) {
      await (prisma as any).invoice.update({
        where: { id: linked_invoice_id },
        data: { status: "PAGO", paid_date: tx.date },
      });
    }

    res.json({ transaction: tx });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
