import prisma from "./prisma";
import { getCompanySettingsUserId } from "./companySettings";
import { generateReply } from "./sdrAgent";
import { createAlert } from "./alerts";

// Avança o estágio do funil de forma monotônica (nunca volta, exceto opt-out/perdido).
const ORDER = ["NOVO", "ABORDADO", "EM_CONVERSA", "QUALIFICADO", "REUNIAO"];
function bestStage(current: string, suggested: string): string {
  if (suggested === "PERDIDO") return current; // opt-out tratado à parte
  const a = ORDER.indexOf(current), b = ORDER.indexOf(suggested);
  return b > a ? suggested : current;
}

// Chamado pelo webhook quando chega uma mensagem 1:1. Se for um lead do SDR,
// registra, gera o rascunho de resposta (copiloto) e atualiza o funil.
export async function handleSdrIncoming(chatJid: string, text: string): Promise<void> {
  if (!chatJid || chatJid.endsWith("@g.us") || !text) return;
  const conv = await (prisma as any).sdrConversation.findFirst({ where: { chat_jid: chatJid } });
  if (!conv || conv.status !== "ACTIVE") return;

  // Registra a mensagem do lead
  await (prisma as any).sdrMessage.create({ data: { conversation_id: conv.id, sender: "lead", text } });

  const user_id = await getCompanySettingsUserId();
  const pb = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } });
  await (prisma as any).sdrConversation.update({ where: { id: conv.id }, data: { last_message_at: new Date() } });
  if (!pb?.active) return; // agente desligado → só registra, não gera rascunho

  const lead = await prisma.lead.findUnique({ where: { id: conv.lead_id } });
  const msgs = await (prisma as any).sdrMessage.findMany({ where: { conversation_id: conv.id }, orderBy: { created_at: "asc" }, take: 40 });
  const history = msgs.map((m: any) => ({ from: m.sender === "lead" ? "lead" : "sdr", text: m.text }));

  const result = await generateReply(pb, lead, history).catch(() => null);
  if (!result) return;

  // Opt-out: encerra com educação (sem gerar rascunho automático)
  if (result.opt_out) {
    await (prisma as any).sdrConversation.update({ where: { id: conv.id }, data: { status: "OPTOUT", stage: "PERDIDO", qualification: result.note || "Lead pediu para parar." } });
    return;
  }

  const stage = bestStage(conv.stage, result.stage);
  await (prisma as any).sdrConversation.update({
    where: { id: conv.id },
    data: { stage, qualification: result.note || conv.qualification },
  });

  // Handoff: lead quente → alerta pra você marcar a reunião
  if (result.wants_meeting || result.qualified) {
    const exists = await (prisma as any).alert.findFirst({ where: { type: "SDR_HOT_LEAD", client_id: conv.lead_id, resolved: false } });
    if (!exists) {
      await createAlert({
        type: "SDR_HOT_LEAD", severity: "WARNING",
        title: `🔥 Lead quente — ${lead?.nome || "prospecção"}`,
        message: result.wants_meeting ? "Demonstrou interesse em reunião. Assuma a conversa." : "Lead qualificado pelo SDR.",
        link: "/prospeccao",
      });
    }
  }

  // Rascunho de resposta (copiloto): substitui um pendente, se houver
  if (result.reply?.trim()) {
    await (prisma as any).sdrDraft.updateMany({ where: { conversation_id: conv.id, status: "PENDING" }, data: { status: "DISCARDED" } });
    await (prisma as any).sdrDraft.create({ data: { conversation_id: conv.id, lead_id: conv.lead_id, kind: "REPLY", text: result.reply.trim() } });
  }
}
