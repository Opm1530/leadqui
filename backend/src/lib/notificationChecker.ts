import prisma from "./prisma";
import axios from "axios";
import { getCompanySettings } from "./companySettings";

// ── Tipos de notificação ──────────────────────────────────────────────
export const NOTIF_TYPES = {
  FATURA_ATRASADA:        "FATURA_ATRASADA",
  TAREFA_VENCIDA:         "TAREFA_VENCIDA",
  DESPESA_FIXA_VENCENDO:  "DESPESA_FIXA_VENCENDO",
  POST_APROVACAO:         "POST_APROVACAO",
} as const;

// ── Helper: criar notificação com deduplicação ───────────────────────
// Não cria se já existe uma notificação não lida com mesmo type + reference_id hoje
async function createNotif(
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  referenceId: string,
) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await (prisma as any).notification.findFirst({
    where: {
      user_id:      userId,
      type,
      reference_id: referenceId,
      created_at:   { gte: todayStart },
    },
  });
  if (existing) return null; // já foi criada hoje

  const notif = await (prisma as any).notification.create({
    data: { user_id: userId, type, title, message, link, reference_id: referenceId, read: false },
  });
  return notif;
}

// ── Helper: enviar alerta WhatsApp via Evolution API (config da empresa) ──
async function sendWhatsApp(message: string) {
  try {
    const settings = await getCompanySettings();
    if (!settings?.evolution_api_url || !settings?.notification_phone || !settings?.notification_instance) return;

    await axios.post(
      `${settings.evolution_api_url}/message/sendText/${settings.notification_instance}`,
      { number: settings.notification_phone, text: message },
      {
        headers: { apikey: settings.evolution_api_key || "", "Content-Type": "application/json" },
        timeout: 8000,
      }
    );
  } catch {
    // WhatsApp opcional — nunca bloqueia o checker
  }
}

// ── Checker principal ─────────────────────────────────────────────────
// Empresa única: eventos são da empresa inteira, notifica todos os staff,
// e dispara WhatsApp uma única vez por evento novo.
export async function checkNotifications() {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] } },
      select: { id: true },
    });
    if (staff.length === 0) return;

    const today    = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Cria a notificação para todos os staff; retorna true se foi nova para algum
    const notifyAll = async (type: string, title: string, message: string, link: string, refId: string): Promise<boolean> => {
      let isNew = false;
      for (const u of staff) {
        const n = await createNotif(u.id, type, title, message, link, refId);
        if (n) isNew = true;
      }
      return isNew;
    };

    // ── 1. Faturas atrasadas (empresa toda) ───────────────────────────
    const overdueInvoices = await (prisma as any).invoice.findMany({
      where: { status: "PENDENTE", due_date: { lt: today } },
      include: { client: { select: { name: true } } },
    });
    for (const inv of overdueInvoices) {
      const clientName = inv.client?.name || inv.client_name_snapshot || "Cliente";
      const daysLate = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
      const valor = Number(inv.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const isNew = await notifyAll(
        NOTIF_TYPES.FATURA_ATRASADA,
        `Fatura atrasada — ${clientName}`,
        `R$ ${valor} com ${daysLate} dia${daysLate > 1 ? "s" : ""} de atraso`,
        "/cashqui/invoices",
        inv.id,
      );
      if (isNew) await sendWhatsApp(`🔴 *Fatura Atrasada* — ${clientName}\nR$ ${valor} · ${daysLate} dia${daysLate > 1 ? "s" : ""} de atraso`);
    }

    // ── 2. Tarefas vencidas ───────────────────────────────────────────
    const overdueTasks = await (prisma as any).task.findMany({
      where: { status: { notIn: ["CONCLUIDO"] }, due_date: { lt: today } },
      include: { client: { select: { name: true } } },
    });
    for (const task of overdueTasks) {
      const daysLate = Math.floor((today.getTime() - new Date(task.due_date).getTime()) / 86400000);
      await notifyAll(
        NOTIF_TYPES.TAREFA_VENCIDA,
        `Tarefa vencida — ${task.title}`,
        `${task.client?.name || ""} · venceu há ${daysLate} dia${daysLate > 1 ? "s" : ""}`,
        "/tasqui",
        task.id,
      );
    }

    // ── 3. Despesas fixas vencendo nos próximos 3 dias ────────────────
    const currentDay = today.getDate();
    const fixedExpenses = await (prisma as any).fixedExpense.findMany({
      where: { active: true, due_day: { gte: currentDay, lte: currentDay + 3 } },
    });
    for (const exp of fixedExpenses) {
      const daysUntil = exp.due_day - currentDay;
      const refId = `${exp.id}-${todayStr}`;
      const valor = Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const isNew = await notifyAll(
        NOTIF_TYPES.DESPESA_FIXA_VENCENDO,
        `Despesa fixa vencendo${daysUntil === 0 ? " hoje" : ` em ${daysUntil} dia${daysUntil > 1 ? "s" : ""}`}`,
        `${exp.description} · R$ ${valor}`,
        "/cashqui/fixed-expenses",
        refId,
      );
      if (isNew && daysUntil === 0) await sendWhatsApp(`🟡 *Despesa Fixa Hoje* — ${exp.description}\nR$ ${valor}`);
    }

    // ── 4. Posts aguardando aprovação ─────────────────────────────────
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const pendingPosts = await (prisma as any).calendarPost.findMany({
      where: { status: { in: ["PLANEJADO", "PRODUZINDO"] }, scheduled_date: { lte: tomorrow } },
      include: { client: { select: { name: true } } },
    });
    for (const post of pendingPosts) {
      const clientName = post.client?.name || "Cliente";
      const isNew = await notifyAll(
        NOTIF_TYPES.POST_APROVACAO,
        `Post aguardando aprovação — ${clientName}`,
        `"${post.title}" · ${post.type} · ${post.platform}`,
        "/tasqui/calendar",
        post.id,
      );
      if (isNew) await sendWhatsApp(`📅 *Post Aguardando Aprovação* — ${clientName}\n"${post.title}" · ${post.type} · ${post.platform}`);
    }
  } catch (error) {
    console.error("Erro no notificationChecker:", error);
  }
}

// ── Inicia job periódico ──────────────────────────────────────────────
export function startNotificationChecker() {
  checkNotifications(); // roda imediatamente no boot
  setInterval(checkNotifications, 6 * 60 * 60 * 1000); // a cada 6 horas
  console.log("🔔 Notification checker iniciado (6h)");
}
