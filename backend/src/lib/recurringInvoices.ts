import prisma from "./prisma";

/**
 * Gera faturas mensais para todos os clientes com contrato ativo.
 * Roda diariamente — só cria fatura no dia de vencimento definido no contrato.
 */
export async function generateRecurringInvoices() {
  const today = new Date();
  const todayDay = today.getDate();
  const month = today.getMonth();
  const year = today.getFullYear();

  console.log(`[Faturas Recorrentes] Verificando para o dia ${todayDay}/${month + 1}/${year}...`);

  try {
    // Buscar todos os contratos ativos com clientes ATIVO
    const contracts = await (prisma as any).contract.findMany({
      where: {
        client: { status: "ATIVO" },
        payment_day: todayDay,
      },
      include: {
        client: { select: { id: true, name: true, status: true } },
      },
    });

    let created = 0;

    for (const contract of contracts) {
      // Verificar se já existe fatura para este mês/cliente
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const existing = await (prisma as any).invoice.findFirst({
        where: {
          client_id: contract.client_id,
          due_date: { gte: startOfMonth, lte: endOfMonth },
          status: { not: "CANCELADO" },
        },
      });

      if (existing) {
        console.log(`[Faturas Recorrentes] Cliente ${contract.client.name} já tem fatura em ${month + 1}/${year} — pulando.`);
        continue;
      }

      // Verificar se o contrato ainda está dentro da duração
      if (contract.duration > 0) {
        const contractStart = new Date(contract.start_date);
        const monthsElapsed =
          (year - contractStart.getFullYear()) * 12 +
          (month - contractStart.getMonth());
        if (monthsElapsed >= contract.duration) {
          console.log(`[Faturas Recorrentes] Contrato de ${contract.client.name} expirou — pulando.`);
          continue;
        }
      }

      const dueDate = new Date(year, month, todayDay);
      const monthLabel = today.toLocaleString("pt-BR", { month: "long", year: "numeric" });

      await (prisma as any).invoice.create({
        data: {
          client_id: contract.client_id,
          description: `Mensalidade — ${monthLabel}`,
          amount: contract.value,
          due_date: dueDate,
          status: "PENDENTE",
        },
      });

      created++;
      console.log(`[Faturas Recorrentes] Fatura criada para ${contract.client.name} — R$ ${contract.value}`);
    }

    console.log(`[Faturas Recorrentes] ${created} fatura(s) gerada(s).`);
  } catch (error) {
    console.error("[Faturas Recorrentes] Erro:", error);
  }
}

/**
 * Inicia o job diário de geração de faturas.
 * Roda uma vez na inicialização e depois a cada 24h.
 */
export function startRecurringInvoicesJob() {
  console.log("[Faturas Recorrentes] Job iniciado — verificação diária ativa.");

  // Rodar na inicialização
  generateRecurringInvoices();

  // Rodar a cada 24 horas
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(generateRecurringInvoices, TWENTY_FOUR_HOURS);
}
