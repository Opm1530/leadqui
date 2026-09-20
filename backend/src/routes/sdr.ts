import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettingsUserId } from "../lib/companySettings";
import { generateFirstContact } from "../lib/sdrAgent";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// Playbook padrão (pré-preenchida com o foco da Pequi: restaurantes/delivery).
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

// GET /api/sdr/playbook → devolve a playbook (cria com padrões se não existir)
router.get("/playbook", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = await getCompanySettingsUserId();
    let playbook = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } });
    if (!playbook) playbook = await (prisma as any).sdrPlaybook.create({ data: { user_id, ...DEFAULTS } });
    res.json({ playbook });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sdr/playbook → salva a playbook
router.put("/playbook", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = await getCompanySettingsUserId();
    const { icp, offer, tone, qualifying, first_msg_guidance, followup_guidance, goal, daily_limit, active } = req.body;
    const data: any = {};
    for (const [k, v] of Object.entries({ icp, offer, tone, qualifying, first_msg_guidance, followup_guidance, goal })) {
      if (v !== undefined) data[k] = v || null;
    }
    if (daily_limit !== undefined) data.daily_limit = Math.max(1, Math.min(200, parseInt(String(daily_limit)) || 10));
    if (active !== undefined) data.active = !!active;
    const playbook = await (prisma as any).sdrPlaybook.upsert({
      where: { user_id }, create: { user_id, ...DEFAULTS, ...data }, update: data,
    });
    res.json({ playbook });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/sdr/preview { lead_id? } → gera uma mensagem de 1º contato pra testar a voz
router.post("/preview", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = await getCompanySettingsUserId();
    const pb = (await (prisma as any).sdrPlaybook.findUnique({ where: { user_id } })) || DEFAULTS;

    let lead: any = null;
    if (req.body.lead_id) {
      lead = await prisma.lead.findUnique({ where: { id: String(req.body.lead_id) } });
    }
    // Lead de exemplo se nenhum for informado (pra testar a voz)
    if (!lead) lead = { nome: req.body.nome || "Restaurante do João", categoria: "Restaurante / Delivery", cidade: req.body.cidade || "sua cidade", telefone: "", observacao: "" };

    const message = await generateFirstContact(lead, pb);
    res.json({ message, lead: { nome: lead.nome, cidade: lead.cidade } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
