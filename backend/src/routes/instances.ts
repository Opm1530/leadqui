import { Router, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettings } from "../lib/companySettings";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// Helper: busca configs da Evolution API compartilhadas da empresa
const getEvolutionConfig = async (_userId?: string) => {
  const settings = await getCompanySettings();
  if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
    throw new Error("Evolution API não configurada. Configure nas Configurações.");
  }
  return {
    baseUrl: settings.evolution_api_url.replace(/\/$/, ""),
    apiKey: settings.evolution_api_key,
  };
};

// ── GET /api/instances ────────────────────────────────────────────────
// Mostra SOMENTE as instâncias criadas no sistema (do banco), mas atualiza o
// status real consultando a Evolution. Não importa instâncias externas.
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dbInstances = await prisma.instance.findMany({ orderBy: { created_at: "desc" } });

    // Estado real na Evolution (uma chamada só), casado por nome da instância
    let evoByName = new Map<string, { connected: boolean; phone: string | null }>();
    try {
      const { baseUrl, apiKey } = await getEvolutionConfig();
      const r = await axios.get(`${baseUrl}/instance/fetchInstances`, { headers: { apikey: apiKey }, timeout: 15000 });
      const list: any[] = Array.isArray(r.data) ? r.data : (r.data?.instances || []);
      for (const raw of list) {
        const i = raw.instance || raw;
        const name = i.instanceName || i.name;
        if (!name) continue;
        const stateRaw = i.connectionStatus || i.state || i.status || "";
        const jid = i.owner || i.number || i.ownerJid || null;
        evoByName.set(name, { connected: ["open", "connected", "CONNECTED"].includes(stateRaw), phone: jid ? String(jid).replace(/@.*/, "") : null });
      }
    } catch { /* Evolution indisponível → mantém o status do banco */ }

    const instances = [] as any[];
    for (const d of dbInstances) {
      const real = evoByName.get(d.evolution_instance_id);
      const gone = evoByName.size > 0 && !real; // sumiu da Evolution
      const status = real ? (real.connected ? "CONECTADO" : "DESCONECTADO") : d.status;
      if (real && status !== d.status) await prisma.instance.update({ where: { id: d.id }, data: { status } }).catch(() => {});
      instances.push({ ...d, status, phone: real?.phone || null, gone });
    }
    res.json({ instances });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar instâncias" });
  }
});

// ── POST /api/instances ────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome } = req.body;
  if (!nome) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  try {
    const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);
    const instanceId = nome.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");

    const evoRes = await axios.post(
      `${baseUrl}/instance/create`,
      {
        instanceName: instanceId,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      },
      { headers: { apikey: apiKey } }
    );

    const instance = await prisma.instance.create({
      data: {
        user_id: req.user!.id,
        nome: nome.trim(),
        evolution_instance_id: instanceId,
        status: "DESCONECTADO",
      },
    });

    const qrcode = evoRes.data?.qrcode?.base64 || null;
    res.status(201).json({ instance, qrcode });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/instances/:id/set-webhook ───────────────────────────────
// Configura o webhook da instância no Evolution apontando para nós.
router.post("/:id/set-webhook", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instance = await prisma.instance.findUnique({ where: { id: String(req.params.id) } });
    if (!instance) { res.status(404).json({ error: "Instância não encontrada" }); return; }
    const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);

    const base = process.env.PUBLIC_URL || `https://${req.get("host")}`;
    const url = `${base.replace(/\/$/, "")}/api/whatsapp/webhook`;
    const events = ["MESSAGES_UPSERT"];

    // Evolution v2: { webhook: { enabled, url, events, byEvents, base64 } }
    let ok = false; let lastErr: any = null;
    try {
      await axios.post(`${baseUrl}/webhook/set/${instance.evolution_instance_id}`,
        { webhook: { enabled: true, url, events, byEvents: false, base64: false } },
        { headers: { apikey: apiKey, "Content-Type": "application/json" } });
      ok = true;
    } catch (e: any) { lastErr = e; }

    // Fallback Evolution v1: { url, webhook_by_events, events }
    if (!ok) {
      try {
        await axios.post(`${baseUrl}/webhook/set/${instance.evolution_instance_id}`,
          { url, webhook_by_events: false, events },
          { headers: { apikey: apiKey, "Content-Type": "application/json" } });
        ok = true;
      } catch (e: any) { lastErr = e; }
    }

    if (!ok) throw lastErr || new Error("Falha ao configurar webhook");
    res.json({ success: true, url });
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message || e.response?.data || e.message });
  }
});

// ── GET /api/instances/:id/qrcode ─────────────────────────────────────
router.get("/:id/qrcode", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const instance = await prisma.instance.findFirst({ where: { id } });
    if (!instance) {
      res.status(404).json({ error: "Instância não encontrada" });
      return;
    }

    const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);

    const evoRes = await axios.get(
      `${baseUrl}/instance/connect/${instance.evolution_instance_id}`,
      { headers: { apikey: apiKey } }
    );

    // Na v2 o connect retorna base64 diretamente (ou dentro de qrcode se for via create)
    const qrcode = evoRes.data?.base64 || evoRes.data?.qrcode?.base64 || null;
    res.json({ qrcode });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/instances/:id/status ─────────────────────────────────────
router.get("/:id/status", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const instance = await prisma.instance.findFirst({ where: { id } });
    if (!instance) {
      res.status(404).json({ error: "Instância não encontrada" });
      return;
    }

    const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);

    const evoRes = await axios.get(
      `${baseUrl}/instance/connectionState/${instance.evolution_instance_id}`,
      { headers: { apikey: apiKey } }
    );

    const state = evoRes.data?.instance?.state || evoRes.data?.state;
    console.log(`[Status WhatsApp] Instância ${instance.evolution_instance_id}:`, state);
    
    // Na v2, o estado pode ser 'open' ou 'connected'
    const isConnected = ["open", "connected", "CONNECTED"].includes(state);
    const newStatus = isConnected ? "CONECTADO" : "DESCONECTADO";

    await prisma.instance.update({ where: { id }, data: { status: newStatus } });

    res.json({ status: newStatus, raw_state: state });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/instances/:id/groups ─────────────────────────────────────
// Lista os grupos de WhatsApp da instância (via Evolution). Com cache (5min).
const groupsCache = new Map<string, { groups: any[]; at: number }>();
const GROUPS_TTL = 5 * 60 * 1000;

router.get("/:id/groups", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const forceRefresh = req.query.refresh === "1";
  try {
    const instance = await prisma.instance.findFirst({ where: { id } });
    if (!instance) { res.status(404).json({ error: "Instância não encontrada" }); return; }

    const cacheKey = instance.evolution_instance_id;
    const cached = groupsCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.at < GROUPS_TTL) {
      res.json({ groups: cached.groups, cached: true });
      return;
    }

    const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);
    const evoRes = await axios.get(
      `${baseUrl}/group/fetchAllGroups/${instance.evolution_instance_id}`,
      { headers: { apikey: apiKey }, params: { getParticipants: "false" }, timeout: 90000 }
    );
    const raw: any[] = Array.isArray(evoRes.data) ? evoRes.data : (evoRes.data?.groups || []);
    const groups = raw
      .map((g: any) => ({ id: g.id || g.jid, name: g.subject || g.name || g.id }))
      .filter((g: any) => g.id)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    groupsCache.set(cacheKey, { groups, at: Date.now() });
    res.json({ groups });
  } catch (error: any) {
    if (error.code === "ECONNABORTED") {
      res.status(504).json({ error: "A Evolution demorou demais para responder. Tente novamente em instantes." });
      return;
    }
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// ── DELETE /api/instances/:id ─────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const instance = await prisma.instance.findFirst({ where: { id } });
    if (!instance) {
      res.status(404).json({ error: "Instância não encontrada" });
      return;
    }

    // Try to delete from Evolution API (best-effort)
    try {
      const { baseUrl, apiKey } = await getEvolutionConfig(req.user!.id);
      await axios.delete(`${baseUrl}/instance/delete/${instance.evolution_instance_id}`, {
        headers: { apikey: apiKey },
      });
    } catch { /* ignore if Evolution fails */ }

    await prisma.instance.delete({ where: { id } });
    res.json({ message: "Instância excluída" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir instância" });
  }
});

export default router;
