import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { encrypt } from "../lib/vault";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

// ── GET /api/onboarding/:clientId ─────────────────────────────────────
router.get("/:clientId", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.params.clientId);
  const ob = await (prisma as any).onboarding.findUnique({ where: { client_id } });
  res.json({
    onboarding: ob ? {
      ...ob,
      credentials: parseJson(ob.credentials, []),
      checklist: parseJson(ob.checklist, []),
    } : null,
  });
});

// ── PUT /api/onboarding/:clientId ─────────────────────────────────────
// Salva o formulário e distribui: senhas→Cofre, checklist→Tarefas, público→Tráfego
router.put("/:clientId", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.params.clientId);
  const userId = req.user!.id;
  const {
    store_name, store_link, audience,
    drive_url, identidade_url, investimento, concorrentes, objetivos,
    faturamento, produtos, influenciadores, prazo_reposicao, expectativas,
  } = req.body;
  let credentials: any[] = Array.isArray(req.body.credentials) ? req.body.credentials : [];
  let checklist: any[] = Array.isArray(req.body.checklist) ? req.body.checklist : [];

  try {
    const client = await prisma.client.findUnique({ where: { id: client_id } });
    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    const existing = await (prisma as any).onboarding.findUnique({ where: { client_id } });
    let trafficCampaignId: string | null = existing?.traffic_campaign_id || null;

    let criadasSenhas = 0, criadasTarefas = 0;

    // 1. Senhas → Cofre (só as que ainda não foram para o cofre)
    for (const cred of credentials) {
      if (cred.vault_id) continue;
      if (!cred.password) continue;
      const { enc, iv, tag } = encrypt(String(cred.password));
      const v = await (prisma as any).vaultCredential.create({
        data: {
          client_id, user_id: userId,
          title: cred.label || "Acesso (onboarding)",
          category: "OUTROS",
          username: cred.email || null,
          password_enc: enc, password_iv: iv, password_tag: tag,
        },
      });
      cred.vault_id = v.id;
      criadasSenhas++;
    }

    // 2. Checklist → Tarefas no quadro do cliente (só novas, não concluídas)
    for (const item of checklist) {
      if (item.task_id || !item.text) continue;
      if (item.done) continue; // não cria tarefa para item já marcado como feito
      const t = await prisma.task.create({
        data: {
          client_id, project_id: null, title: item.text,
          description: "Criada pelo onboarding do cliente",
          status: "PENDENTE", priority: "MEDIA",
        },
      });
      item.task_id = t.id;
      criadasTarefas++;
    }

    // 3. Público → anotação no Tráfego (cria/atualiza um "briefing")
    if (audience && audience.trim()) {
      if (trafficCampaignId) {
        await (prisma as any).trafficCampaign.update({
          where: { id: trafficCampaignId }, data: { objective: audience.trim() },
        }).catch(() => { trafficCampaignId = null; });
      }
      if (!trafficCampaignId) {
        const tc = await (prisma as any).trafficCampaign.create({
          data: { client_id, name: "Briefing de Público (Onboarding)", objective: audience.trim(), status: "ATIVO" },
        });
        trafficCampaignId = tc.id;
      }
    }

    // 4. Salva o onboarding
    const data = {
      store_name: store_name || null,
      store_link: store_link || null,
      audience: audience || null,
      credentials: JSON.stringify(credentials),
      checklist: JSON.stringify(checklist),
      traffic_campaign_id: trafficCampaignId,
      drive_url: drive_url || null,
      identidade_url: identidade_url || null,
      investimento: investimento || null,
      concorrentes: concorrentes || null,
      objetivos: objetivos || null,
      faturamento: faturamento || null,
      produtos: produtos || null,
      influenciadores: influenciadores || null,
      prazo_reposicao: prazo_reposicao || null,
      expectativas: expectativas || null,
    };

    // Sincroniza o link do Drive no cadastro do cliente
    if (drive_url !== undefined) {
      await prisma.client.update({ where: { id: client_id }, data: { drive_url: drive_url || null } }).catch(() => {});
    }
    const ob = await (prisma as any).onboarding.upsert({
      where: { client_id }, create: { client_id, ...data }, update: data,
    });

    res.json({
      onboarding: { ...ob, credentials, checklist },
      aplicado: { senhas: criadasSenhas, tarefas: criadasTarefas },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
