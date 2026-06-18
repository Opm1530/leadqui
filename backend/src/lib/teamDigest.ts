import axios from "axios";
import prisma from "./prisma";
import { getCompanySettings } from "./companySettings";

// Início/fim do dia atual em horário de São Paulo, convertidos para Date (UTC).
function rangeHojeSP(): { start: Date; end: Date; label: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const hojeSP = fmt.format(new Date()); // YYYY-MM-DD
  // São Paulo = UTC-3 (sem horário de verão atualmente)
  const start = new Date(`${hojeSP}T00:00:00-03:00`);
  const end = new Date(`${hojeSP}T23:59:59-03:00`);
  const label = new Date(`${hojeSP}T12:00:00-03:00`).toLocaleDateString("pt-BR");
  return { start, end, label };
}

const SAUDACAO: Record<number, string> = { 6: "☀️ Bom dia, equipe!", 12: "🌤️ Boa tarde, equipe!", 18: "🌙 Fim de dia, equipe!" };

export async function sendTeamDigest(hour: number): Promise<void> {
  try {
    const s = (await getCompanySettings()) as any;
    if (!s?.evolution_api_url || !s?.notification_instance || !s?.notification_group_id) return;

    const { start, end, label } = rangeHojeSP();

    // Lembretes do dia (e atrasados não concluídos)
    const reminders = await (prisma as any).leadReminder.findMany({
      where: { done: false, remind_on: { lte: end } },
      include: { lead: { select: { nome: true } } },
      orderBy: { remind_on: "asc" },
    });

    // Tarefas com prazo até hoje, não concluídas e não arquivadas
    const tasks = await (prisma as any).task.findMany({
      where: { archived: false, status: { not: "CONCLUIDO" }, due_date: { lte: end } },
      include: { client: { select: { name: true } }, responsible: { select: { name: true } } },
      orderBy: { due_date: "asc" },
    });

    if (!reminders.length && !tasks.length) return;

    let msg = `${SAUDACAO[hour] || "📋 Boletim"} *${label}*\n`;

    if (reminders.length) {
      msg += `\n🔔 *Lembretes (${reminders.length})*\n`;
      for (const r of reminders) {
        const atrasado = new Date(r.remind_on) < start ? " ⚠️_atrasado_" : "";
        msg += `• ${r.message}${r.lead?.nome ? ` _(${r.lead.nome})_` : ""}${atrasado}\n`;
      }
    }

    if (tasks.length) {
      msg += `\n✅ *Tarefas do dia (${tasks.length})*\n`;
      for (const t of tasks) {
        const atrasado = t.due_date && new Date(t.due_date) < start ? " ⚠️_atrasada_" : "";
        const resp = t.responsible?.name ? ` — ${t.responsible.name}` : "";
        msg += `• ${t.title}${t.client?.name ? ` _(${t.client.name})_` : ""}${resp}${atrasado}\n`;
      }
    }

    await axios.post(
      `${s.evolution_api_url.replace(/\/$/, "")}/message/sendText/${s.notification_instance}`,
      { number: s.notification_group_id, text: msg },
      { headers: { apikey: s.evolution_api_key || "", "Content-Type": "application/json" }, timeout: 8000 },
    );
    console.log(`[Boletim ${hour}h] enviado: ${reminders.length} lembrete(s), ${tasks.length} tarefa(s).`);
  } catch (e: any) {
    console.warn("[Boletim] erro:", e.message);
  }
}

// Dispara nos horários 6h, 12h e 18h (São Paulo), uma vez por horário/dia.
const sentKeys = new Set<string>();
export function startTeamDigest() {
  const tick = () => {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false,
    }).format(now)) % 24;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
    if ([6, 12, 18].includes(hour)) {
      const key = `${day}-${hour}`;
      if (!sentKeys.has(key)) {
        sentKeys.add(key);
        sendTeamDigest(hour);
      }
    }
  };
  tick();
  setInterval(tick, 20 * 60 * 1000); // a cada 20 min
}
