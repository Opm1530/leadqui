import prisma from "./prisma";
import { getCompanySettingsUserId } from "./companySettings";
import { generateFollowup } from "./sdrAgent";

// Estágios que ainda estão "vivos" para follow-up (não qualificados/reunião/perdidos).
const FOLLOWUP_STAGES = ["ABORDADO", "EM_CONVERSA"];

async function tick(): Promise<void> {
  try {
    const user_id = await getCompanySettingsUserId();
    const pb = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } });
    if (!pb?.active) return;

    const hours = pb.followup_hours || 24;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const convs = await (prisma as any).sdrConversation.findMany({
      where: {
        status: "ACTIVE",
        stage: { in: FOLLOWUP_STAGES },
        last_message_at: { lte: cutoff },
      },
      include: { lead: true },
      take: 50,
    });

    for (const conv of convs) {
      // Não gera se já há um rascunho pendente
      const pending = await (prisma as any).sdrDraft.count({ where: { conversation_id: conv.id, status: "PENDING" } });
      if (pending) continue;

      // Só cutuca se estamos esperando o lead (última mensagem foi do SDR)
      const last = await (prisma as any).sdrMessage.findFirst({ where: { conversation_id: conv.id }, orderBy: { created_at: "desc" } });
      if (!last || last.sender !== "sdr") continue;

      const sent = await (prisma as any).sdrDraft.count({ where: { conversation_id: conv.id, kind: "FOLLOWUP", status: "SENT" } });
      if (sent >= (pb.max_followups || 2)) {
        // Esgotou os follow-ups sem resposta → encerra
        await (prisma as any).sdrConversation.update({ where: { id: conv.id }, data: { stage: "PERDIDO", status: "DONE", qualification: "Sem resposta após follow-ups." } }).catch(() => {});
        continue;
      }

      const msgs = await (prisma as any).sdrMessage.findMany({ where: { conversation_id: conv.id }, orderBy: { created_at: "asc" }, take: 40 });
      const history = msgs.map((m: any) => ({ from: m.sender === "lead" ? "lead" : "sdr", text: m.text }));
      const text = await generateFollowup(pb, conv.lead, history, sent + 1).catch(() => "");
      if (!text?.trim()) continue;

      await (prisma as any).sdrDraft.create({ data: { conversation_id: conv.id, lead_id: conv.lead_id, kind: "FOLLOWUP", text: text.trim() } });
    }
  } catch (e: any) {
    console.warn("[SDR follow-up] erro:", e.message);
  }
}

export function startSdrFollowup(): void {
  // Roda a cada 30 min (o cutoff em horas garante o intervalo correto por lead)
  setInterval(tick, 30 * 60 * 1000);
  setTimeout(tick, 60 * 1000); // primeira passada 1 min após subir
}
