import prisma from "./prisma";
import { getCompanySettingsUserId } from "./companySettings";
import { generateFirstContact } from "./sdrAgent";

// Telefone do lead → número Evolution (DDI 55 quando faltar).
export function leadNumber(lead: any): string | null {
  const digits = String(lead?.telefone_limpo || lead?.telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

// Coloca leads no funil do SDR e gera o rascunho de 1º contato (fila do copiloto).
// Retorna quantos foram enfileirados. `limit` corta a geração (respeita orçamento diário).
export async function enrollLeads(leadIds: string[], limit?: number): Promise<number> {
  const user_id = await getCompanySettingsUserId();
  const pb = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } });
  if (!pb) return 0;
  let created = 0;
  for (const lead_id of leadIds) {
    if (limit != null && created >= limit) break;
    const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
    if (!lead || !leadNumber(lead)) continue;
    const existing = await (prisma as any).sdrConversation.findUnique({ where: { lead_id } });
    if (existing) continue;
    const conv = await (prisma as any).sdrConversation.create({
      data: { lead_id, instance: pb.instance || null, chat_jid: `${leadNumber(lead)}@s.whatsapp.net`, stage: "NOVO" },
    });
    const text = await generateFirstContact(lead, pb).catch(() => "");
    if (!text) continue;
    await (prisma as any).sdrDraft.create({ data: { conversation_id: conv.id, lead_id, kind: "FIRST_CONTACT", text } });
    created++;
  }
  return created;
}
