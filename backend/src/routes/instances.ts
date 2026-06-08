import { Router, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// Helper: busca configs da Evolution API do usuário
const getEvolutionConfig = async (userId: string) => {
  const settings = await prisma.userSettings.findUnique({ where: { user_id: userId } });
  if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
    throw new Error("Evolution API não configurada. Configure nas Configurações.");
  }
  return {
    baseUrl: settings.evolution_api_url.replace(/\/$/, ""),
    apiKey: settings.evolution_api_key,
  };
};

// ── GET /api/instances ────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instances = await prisma.instance.findMany({
      orderBy: { created_at: "desc" },
    });
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
