import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettingsUserId } from "../lib/companySettings";
import { generateFirstContact } from "../lib/sdrAgent";
import { sendWhatsappText, recordMessage } from "../lib/whatsapp";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

const STAGES = ["NOVO", "ABORDADO", "EM_CONVERSA", "QUALIFICADO", "REUNIAO", "PERDIDO"];

// Playbook padrão (foco Pequi: restaurantes/delivery).
const DEFAULTS = {
  icp: "Donos de restaurante que fazem delivery (a cidade pode variar).",
  offer: "Gestão de tráfego pago para crescer os pedidos e as chamadas no delivery.",
  tone: "Próximo, humano e informal — como uma conversa real no WhatsApp.",
  qualifying: "Já investe em anúncios? Quem cuida do marketing hoje? Faz delivery próprio ou por app? Qual a meta de crescimento de pedidos? Tem interesse em vender mais no delivery?",
  first_msg_guidance: "Abertura curta e humana, deixe claro que é sobre crescer os pedidos/chamadas do delivery, gere curiosidade e termine com uma pergunta leve.",
  followup_guidance: "Se o lead não responder, mande um lembrete leve e sem pressão, agregando um insight rápido sobre delivery.",
  goal: "Agendar uma reunião com o dono para mostrar como crescer o delivery.",
  daily_limit: 10,
};

// Telefone do lead → número no formato da Evolution (com DDI 55 quando faltar).
function leadNumber(lead: any): string | null {
  const digits = String(lead?.telefone_limpo || lead?.telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function getPlaybook() {
  const user_id = await getCompanySettingsUserId();
  let pb = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } });
  if (!pb) pb = await (prisma as any).sdrPlaybook.create({ data: { user_id, ...DEFAULTS } });
  return pb;
}

// ── Playbook ──────────────────────────────────────────────────────────
router.get("/playbook", async (_req: AuthRequest, res: Response): Promise<void> => {
  try { res.json({ playbook: await getPlaybook() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/playbook", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = await getCompanySettingsUserId();
    const { icp, offer, tone, qualifying, first_msg_guidance, followup_guidance, goal, daily_limit, active, instance } = req.body;
    const data: any = {};
    for (const [k, v] of Object.entries({ icp, offer, tone, qualifying, first_msg_guidance, followup_guidance, goal })) {
      if (v !== undefined) data[k] = v || null;
    }
    if (instance !== undefined) data.instance = instance || null;
    if (daily_limit !== undefined) data.daily_limit = Math.max(1, Math.min(200, parseInt(String(daily_limit)) || 10));
    if (active !== undefined) data.active = !!active;
    const playbook = await (prisma as any).sdrPlaybook.upsert({ where: { user_id }, create: { user_id, ...DEFAULTS, ...data }, update: data });
    res.json({ playbook });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Testar a voz (prévia de 1º contato) ───────────────────────────────
router.post("/preview", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pb = await getPlaybook();
    let lead: any = req.body.lead_id ? await prisma.lead.findUnique({ where: { id: String(req.body.lead_id) } }) : null;
    if (!lead) lead = { nome: req.body.nome || "Restaurante do João", categoria: "Restaurante / Delivery", cidade: req.body.cidade || "sua cidade" };
    res.json({ message: await generateFirstContact(lead, pb) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Candidatos: leads com telefone e sem conversa SDR ─────────────────
router.get("/candidates", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const where: any = { telefone: { not: null }, sdr_conversation: null };
    if (search) where.nome = { contains: search };
    const leads = await prisma.lead.findMany({
      where, orderBy: { created_at: "desc" }, take: 100,
      select: { id: true, nome: true, telefone: true, cidade: true, categoria: true },
    });
    res.json({ leads });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Gera rascunhos de 1º contato para os leads escolhidos ─────────────
router.post("/generate", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ids: string[] = Array.isArray(req.body.lead_ids) ? req.body.lead_ids.map(String) : [];
    if (!ids.length) { res.status(400).json({ error: "Selecione ao menos um lead." }); return; }
    const pb = await getPlaybook();
    let created = 0;
    for (const lead_id of ids) {
      const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
      if (!lead || !leadNumber(lead)) continue;
      const existing = await (prisma as any).sdrConversation.findUnique({ where: { lead_id } });
      if (existing) continue; // já está no funil
      const conv = await (prisma as any).sdrConversation.create({
        data: { lead_id, instance: pb.instance || null, chat_jid: `${leadNumber(lead)}@s.whatsapp.net`, stage: "NOVO" },
      });
      const text = await generateFirstContact(lead, pb).catch(() => "");
      if (!text) continue;
      await (prisma as any).sdrDraft.create({ data: { conversation_id: conv.id, lead_id, kind: "FIRST_CONTACT", text } });
      created++;
    }
    res.json({ ok: true, created });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Fila de aprovação ─────────────────────────────────────────────────
router.get("/queue", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drafts = await (prisma as any).sdrDraft.findMany({
      where: { status: "PENDING" }, orderBy: { created_at: "asc" }, take: 200,
      include: { conversation: { include: { lead: { select: { id: true, nome: true, telefone: true, cidade: true, categoria: true } } } } },
    });
    // Contador do limite diário (1º contatos enviados hoje)
    const sentToday = await (prisma as any).sdrDraft.count({ where: { kind: "FIRST_CONTACT", status: "SENT", sent_at: { gte: todayStart() } } });
    const pb = await getPlaybook();
    res.json({ drafts, sentToday, dailyLimit: pb.daily_limit, instance: pb.instance || null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Aprovar (e opcionalmente editar) → envia pelo WhatsApp
router.post("/drafts/:id/approve", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const draft = await (prisma as any).sdrDraft.findUnique({ where: { id: String(req.params.id) }, include: { conversation: { include: { lead: true } } } });
    if (!draft || draft.status !== "PENDING") { res.status(404).json({ error: "Rascunho não encontrado" }); return; }
    const pb = await getPlaybook();
    const instance = draft.conversation.instance || pb.instance;
    if (!instance) { res.status(400).json({ error: "Defina o número (instância) do SDR na playbook." }); return; }
    const number = leadNumber(draft.conversation.lead);
    if (!number) { res.status(400).json({ error: "Lead sem telefone válido." }); return; }

    // Limite diário só para 1º contato
    if (draft.kind === "FIRST_CONTACT") {
      const sentToday = await (prisma as any).sdrDraft.count({ where: { kind: "FIRST_CONTACT", status: "SENT", sent_at: { gte: todayStart() } } });
      if (sentToday >= pb.daily_limit) { res.status(429).json({ error: `Limite diário atingido (${pb.daily_limit} novos contatos).` }); return; }
    }

    const text = (req.body?.text && String(req.body.text).trim()) || draft.text;
    const sent = await sendWhatsappText(instance, number, text);
    const waId = sent?.key?.id || sent?.message?.key?.id || null;

    await (prisma as any).sdrDraft.update({ where: { id: draft.id }, data: { status: "SENT", sent_at: new Date(), text } });
    const nextStage = draft.conversation.stage === "NOVO" ? "ABORDADO" : draft.conversation.stage;
    await (prisma as any).sdrConversation.update({ where: { id: draft.conversation_id }, data: { stage: nextStage, last_message_at: new Date(), instance } });
    // Registra no inbox (best-effort) para o histórico da conversa
    await recordMessage({ instance, chatJid: `${number}@s.whatsapp.net`, text, fromMe: true, waMessageId: waId, authorName: "SDR IA" }).catch(() => {});

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.response?.data?.message || e.message }); }
});

router.post("/drafts/:id/discard", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).sdrDraft.update({ where: { id: String(req.params.id) }, data: { status: "DISCARDED" } }).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Funil + métricas ──────────────────────────────────────────────────
router.get("/pipeline", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const convs = await (prisma as any).sdrConversation.findMany({
      orderBy: { updated_at: "desc" }, take: 500,
      include: { lead: { select: { id: true, nome: true, cidade: true, categoria: true } } },
    });
    const byStage: Record<string, any[]> = {};
    for (const s of STAGES) byStage[s] = [];
    for (const c of convs) (byStage[c.stage] || (byStage[c.stage] = [])).push(c);

    const total = convs.length;
    const abordados = convs.filter((c: any) => c.stage !== "NOVO").length;
    const responderam = convs.filter((c: any) => ["EM_CONVERSA", "QUALIFICADO", "REUNIAO"].includes(c.stage)).length;
    const qualificados = convs.filter((c: any) => ["QUALIFICADO", "REUNIAO"].includes(c.stage)).length;
    const reunioes = convs.filter((c: any) => c.stage === "REUNIAO").length;
    const metrics = {
      total, abordados, responderam, qualificados, reunioes,
      taxaResposta: abordados ? Math.round((responderam / abordados) * 100) : 0,
      taxaQualificacao: responderam ? Math.round((qualificados / responderam) * 100) : 0,
    };
    res.json({ stages: STAGES, byStage, metrics });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
