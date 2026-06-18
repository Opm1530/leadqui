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

const LINHA = "━━━━━━━━━━━━━━";

// Envia um texto para o grupo da equipe. Lança erro se não configurado.
async function postToGroup(text: string): Promise<void> {
  const s = (await getCompanySettings()) as any;
  if (!s?.evolution_api_url || !s?.notification_instance || !s?.notification_group_id) {
    throw new Error("Configure a instância e o grupo da equipe nas Configurações.");
  }
  await axios.post(
    `${s.evolution_api_url.replace(/\/$/, "")}/message/sendText/${s.notification_instance}`,
    { number: s.notification_group_id, text },
    { headers: { apikey: s.evolution_api_key || "", "Content-Type": "application/json" }, timeout: 8000 },
  );
}

// Monta a mensagem do boletim. Retorna null se não há nada para enviar.
async function buildDigest(hour: number): Promise<{ text: string; reminders: number; tasks: number } | null> {
  const { start, end, label } = rangeHojeSP();

  const reminders = await (prisma as any).leadReminder.findMany({
    where: { done: false, remind_on: { lte: end } },
    include: { lead: { select: { nome: true } } },
    orderBy: { remind_on: "asc" },
  });

  const tasks = await (prisma as any).task.findMany({
    where: { archived: false, status: { not: "CONCLUIDO" }, due_date: { lte: end } },
    include: { client: { select: { name: true } }, responsible: { select: { name: true } } },
    orderBy: { due_date: "asc" },
  });

  if (!reminders.length && !tasks.length) return null;

  let msg = `${SAUDACAO[hour] || "📋 *Boletim*"}\n📅 ${label}\n`;

  if (reminders.length) {
    msg += `\n${LINHA}\n🔔 *LEMBRETES (${reminders.length})*\n`;
    for (const r of reminders) {
      const atrasado = new Date(r.remind_on) < start ? " ⚠️ _atrasado_" : "";
      msg += `\n☑️ ${r.message}${r.lead?.nome ? `\n     🏷️ ${r.lead.nome}` : ""}${atrasado}\n`;
    }
  }

  if (tasks.length) {
    msg += `\n${LINHA}\n📋 *TAREFAS DE HOJE (${tasks.length})*\n`;
    for (const t of tasks) {
      const atrasado = t.due_date && new Date(t.due_date) < start ? " ⚠️ _atrasada_" : "";
      const quem = t.responsible?.name || "sem responsável";
      msg += `\n✅ ${t.title}${atrasado}\n     👤 ${quem}${t.client?.name ? `   🏢 ${t.client.name}` : ""}\n`;
    }
  }

  return { text: msg, reminders: reminders.length, tasks: tasks.length };
}

export async function sendTeamDigest(hour: number): Promise<void> {
  try {
    const digest = await buildDigest(hour);
    if (digest) {
      await postToGroup(digest.text);
      console.log(`[Boletim ${hour}h] enviado: ${digest.reminders} lembrete(s), ${digest.tasks} tarefa(s).`);
    } else {
      // Sem pendências → ainda assim manda um boletim positivo nos 3 horários
      const label = rangeHojeSP().label;
      await postToGroup(`${SAUDACAO[hour] || "📋 *Boletim*"}\n📅 ${label}\n\n${LINHA}\n🎉 Nenhuma pendência para hoje!\n_Sem lembretes nem tarefas com prazo._`);
      console.log(`[Boletim ${hour}h] enviado: sem pendências.`);
    }
  } catch (e: any) {
    console.warn("[Boletim] erro:", e.message);
  }
}

// Disparo manual (botão nas Configurações): força o boletim do dia AGORA,
// idêntico ao automático (usa a saudação do horário atual). Se não houver
// pendências, manda uma mensagem de confirmação de que o grupo está ok.
function horaAtualSP(): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false,
  }).format(new Date())) % 24;
}

export async function sendTeamDigestTest(): Promise<{ enviou: "boletim" | "teste" }> {
  const digest = await buildDigest(horaAtualSP());
  if (digest) {
    await postToGroup(digest.text);
    return { enviou: "boletim" };
  }
  await postToGroup(
    `✅ *Grupo configurado — Leadqui*\n\n${LINHA}\nOs boletins de lembretes e tarefas chegam aqui às *6h*, *12h* e *18h*.\n_Sem pendências para hoje no momento._`,
  );
  return { enviou: "teste" };
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
