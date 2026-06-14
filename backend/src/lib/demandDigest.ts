import axios from "axios";
import prisma from "./prisma";
import { getCompanySettings } from "./companySettings";

// Envia o resumo diário de demandas em aberto para o WhatsApp de alertas.
export async function sendDemandDigest(): Promise<void> {
  try {
    const settings = await getCompanySettings();
    const s = settings as any;
    if (!s?.evolution_api_url || !s?.notification_phone || !s?.notification_instance) return;

    const abertas = await (prisma as any).demand.findMany({
      where: { status: { in: ["NOVA", "EM_ANDAMENTO"] } },
      include: { client: { select: { name: true } } },
      orderBy: { created_at: "asc" },
    });
    if (!abertas.length) return;

    // Agrupa por cliente
    const porCliente: Record<string, string[]> = {};
    for (const d of abertas) {
      const nome = d.client?.name || "Sem cliente";
      (porCliente[nome] = porCliente[nome] || []).push(`• ${d.summary}${d.status === "EM_ANDAMENTO" ? " _(em andamento)_" : ""}`);
    }

    let msg = `☀️ *Bom dia! Demandas em aberto (${abertas.length})*\n`;
    for (const [cliente, itens] of Object.entries(porCliente)) {
      msg += `\n*${cliente}*\n${itens.join("\n")}\n`;
    }
    msg += `\n_Veja tudo na Caixa de Demandas._`;

    await axios.post(
      `${s.evolution_api_url.replace(/\/$/, "")}/message/sendText/${s.notification_instance}`,
      { number: s.notification_phone, text: msg },
      { headers: { apikey: s.evolution_api_key || "", "Content-Type": "application/json" }, timeout: 8000 },
    );
    console.log(`[Demandas] Resumo diário enviado (${abertas.length} demandas).`);
  } catch (e: any) {
    console.warn("[Demandas] erro no resumo diário:", e.message);
  }
}

// Agendador simples: verifica de hora em hora; às 9h (horário do servidor)
// dispara o resumo, no máximo uma vez por dia.
let lastSentDay = "";
export function startDemandDigest() {
  const tick = () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (now.getHours() === 9 && lastSentDay !== day) {
      lastSentDay = day;
      sendDemandDigest();
    }
  };
  tick();
  setInterval(tick, 60 * 60 * 1000); // a cada hora
}
