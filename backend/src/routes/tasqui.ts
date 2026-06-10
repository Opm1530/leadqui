import { Router, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/tasqui/tasks ─────────────────────────────────────────────
router.get("/tasks", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { clientId, projectId, status } = req.query;

  try {
    const where: any = {};
    
    // Filtro básico de permissões
    if (req.user?.role === "CLIENT") {
      const client = await prisma.client.findFirst({ where: { login_user_id: req.user.id } as any });
      if (!client) {
        res.json([]);
        return;
      }
      where.client_id = client.id;
    }

    if (clientId) where.client_id = clientId as string;
    if (projectId) where.project_id = projectId as string;
    if (status) where.status = status as any;

    const tasks = await (prisma as any).task.findMany({
      where,
      include: {
        project: { select: { name: true, type: true } },
        client: { select: { name: true } },
        responsible: { select: { name: true, id: true } }
      },
      orderBy: { due_date: "asc" }
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tarefas" });
  }
});

// ── POST /api/tasqui/tasks ────────────────────────────────────────────
router.post("/tasks", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "CLIENT") {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const { title, description, client_id, project_id, responsible_id, due_date, priority } = req.body;

  if (!title || !client_id || !project_id) {
    res.status(400).json({ error: "Título, Cliente e Projeto são obrigatórios" });
    return;
  }

  try {
    const task = await (prisma as any).task.create({
      data: {
        title,
        description,
        client_id,
        project_id,
        responsible_id,
        due_date: due_date ? new Date(due_date) : null,
        priority: priority || "MEDIA"
      },
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } }
      }
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

// ── PATCH /api/tasqui/tasks/:id ───────────────────────────────────────
router.patch("/tasks/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const taskId = String(id);
  const { status, responsible_id, title, description, due_date, priority } = req.body;

  try {
    // Clientes só podem atualizar status das próprias tarefas
    if (req.user?.role === "CLIENT") {
      const client = await prisma.client.findFirst({ where: { login_user_id: req.user.id } as any });
      if (!client) { res.status(403).json({ error: "Acesso negado" }); return; }

      const existing = await (prisma as any).task.findFirst({ where: { id: taskId, client_id: client.id } });
      if (!existing) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }

      // Cliente só pode alterar status (não título, responsável, etc.)
      const task = await (prisma as any).task.update({
        where: { id: taskId },
        data: {
          ...(status && { status }),
          ...(status === "CONCLUIDO" && { completed_at: new Date() }),
        },
      });
      res.json(task);
      return;
    }

    // Usuários internos: verificar que a tarefa pertence a um cliente do usuário
    const existing = await (prisma as any).task.findFirst({
      where: { id: taskId },
      include: { client: { select: { user_id: true } } },
    });
    if (!existing) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }
    if (existing.client?.user_id !== req.user!.id) { res.status(403).json({ error: "Acesso negado" }); return; }

    const task = await (prisma as any).task.update({
      where: { id: taskId },
      data: {
        status,
        responsible_id,
        title,
        description,
        priority,
        due_date: due_date ? new Date(due_date) : undefined,
        completed_at: status === "CONCLUIDO" ? new Date() : undefined,
      },
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});

// ── GET /api/tasqui/projects ──────────────────────────────────────────
router.get("/projects", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { clientId, status } = req.query;

  try {
    const where: any = {};
    if (clientId) where.client_id = clientId as string;
    if (status && status !== "TODOS") where.status = status as any;

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { name: true } },
        _count: { select: { tasks: true } }
      }
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar projetos" });
  }
});

// ── POST /api/tasqui/projects ─────────────────────────────────────────
router.post("/projects", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "CLIENT") { res.status(403).json({ error: "Acesso negado" }); return; }
  const { client_id, name, description, type, status } = req.body;
  if (!client_id || !name) { res.status(400).json({ error: "client_id e name são obrigatórios" }); return; }

  try {
    const project = await prisma.project.create({
      data: { client_id, name, description: description || null, type: type || "UNICO", status: status || "ATIVO" },
      include: { client: { select: { name: true } }, _count: { select: { tasks: true } } },
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar projeto" });
  }
});

// ── PATCH /api/tasqui/projects/:id ────────────────────────────────────
router.patch("/projects/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, name, description } = req.body;

  try {
    const project = await prisma.project.update({
      where: { id: String(id) },
      data: {
        status,
        name,
        description
      }
    });

    // Se o projeto for concluído, podemos concluir as tarefas pendentes também
    if (status === "CONCLUIDO") {
      await prisma.task.updateMany({
        where: { project_id: String(id), status: { not: "CONCLUIDO" } },
        data: { 
          status: "CONCLUIDO",
          completed_at: new Date()
        }
      });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar projeto" });
  }
});

// ── GET /api/tasqui/stats ─────────────────────────────────────────────
router.get("/stats", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [tasks, projectsCount] = await Promise.all([
      (prisma as any).task.findMany({
        select: {
          status: true,
          created_at: true,
          responsible_id: true,
          client_id: true,
          responsible: { select: { name: true } },
          client: { select: { name: true } },
        },
      }),
      prisma.project.count({ where: { status: "ATIVO" } as any }),
    ]);

    // ── Totais simples ──────────────────────────────────────────────
    const totalTasks    = tasks.length;
    const completed     = tasks.filter((t: any) => t.status === "CONCLUIDO").length;
    const inProgress    = tasks.filter((t: any) => t.status === "EM_ANDAMENTO").length;
    const pending       = tasks.filter((t: any) => t.status === "PENDENTE").length;
    const completionRate = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;

    // ── Por membro ─────────────────────────────────────────────────
    const memberMap: Record<string, { name: string; total: number; concluido: number; em_andamento: number; pendente: number }> = {};
    for (const t of tasks) {
      if (!t.responsible_id) continue;
      if (!memberMap[t.responsible_id]) {
        memberMap[t.responsible_id] = {
          name: t.responsible?.name || "Sem nome",
          total: 0, concluido: 0, em_andamento: 0, pendente: 0,
        };
      }
      memberMap[t.responsible_id].total++;
      if (t.status === "CONCLUIDO")    memberMap[t.responsible_id].concluido++;
      else if (t.status === "EM_ANDAMENTO") memberMap[t.responsible_id].em_andamento++;
      else if (t.status === "PENDENTE") memberMap[t.responsible_id].pendente++;
    }
    const tasksByMember = Object.values(memberMap).sort((a: any, b: any) => b.total - a.total);

    // ── Por cliente (top 8) ────────────────────────────────────────
    const clientMap: Record<string, { name: string; total: number; concluido: number }> = {};
    for (const t of tasks) {
      if (!t.client_id) continue;
      if (!clientMap[t.client_id]) {
        clientMap[t.client_id] = { name: t.client?.name || "Sem nome", total: 0, concluido: 0 };
      }
      clientMap[t.client_id].total++;
      if (t.status === "CONCLUIDO") clientMap[t.client_id].concluido++;
    }
    const tasksByClient = Object.values(clientMap)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 8);

    // ── Evolução mensal (últimos 6 meses) ──────────────────────────
    const now = new Date();
    const monthlyCompletion = Array.from({ length: 6 }, (_, i) => {
      const d    = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end  = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "") + "/" + String(d.getFullYear()).slice(2);
      const inMonth   = tasks.filter((t: any) => new Date(t.created_at) >= d && new Date(t.created_at) <= end);
      return {
        month:     label,
        criadas:   inMonth.length,
        concluidas: inMonth.filter((t: any) => t.status === "CONCLUIDO").length,
      };
    });

    // ── Distribuição por status ────────────────────────────────────
    const statusDist = [
      { status: "Pendente",     value: pending,   fill: "#eab308" },
      { status: "Em Andamento", value: inProgress, fill: "#3b82f6" },
      { status: "Revisão",      value: tasks.filter((t: any) => t.status === "REVISAO").length, fill: "#f97316" },
      { status: "Concluído",    value: completed,  fill: "#22c55e" },
      { status: "Cancelado",    value: tasks.filter((t: any) => t.status === "CANCELADO").length, fill: "#6b7280" },
    ].filter(s => s.value > 0);

    res.json({
      totalTasks, pending, inProgress, completed, activeProjects: projectsCount, completionRate,
      tasksByMember, tasksByClient, monthlyCompletion, statusDist,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular estatísticas" });
  }
});

// ── GET /api/tasqui/calendar ──────────────────────────────────────────
router.get("/calendar", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, month, year } = req.query;

  try {
    const where: any = {};

    if (req.user?.role === "CLIENT") {
      const client = await (prisma as any).client.findFirst({ where: { login_user_id: req.user.id } });
      if (!client) { res.json([]); return; }
      where.client_id = client.id;
    } else if (client_id) {
      where.client_id = client_id as string;
    }

    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end   = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.scheduled_date = { gte: start, lte: end };
    }

    const posts = await (prisma as any).calendarPost.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { scheduled_date: "asc" },
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar calendário" });
  }
});

// ── POST /api/tasqui/calendar ─────────────────────────────────────────
router.post("/calendar", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "CLIENT") { res.status(403).json({ error: "Acesso negado" }); return; }

  const { client_id, project_id, title, content, type, platform, scheduled_date, status } = req.body;
  // Card vazio: exige só cliente + formato + dia. Título e conteúdo são opcionais.
  if (!client_id || !scheduled_date) {
    res.status(400).json({ error: "client_id e scheduled_date são obrigatórios" });
    return;
  }

  try {
    const post = await (prisma as any).calendarPost.create({
      data: {
        client_id,
        project_id: project_id || null,
        title: title || null,
        content: content || null,
        type: type || "POST",
        platform: platform || "INSTAGRAM",
        scheduled_date: new Date(scheduled_date),
        status: status || "PLANEJADO",
      },
      include: { client: { select: { name: true } } },
    });
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar post" });
  }
});

// ── PATCH /api/tasqui/calendar/:id ────────────────────────────────────
router.patch("/calendar/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, content, type, platform, scheduled_date, status } = req.body;

  try {
    const post = await (prisma as any).calendarPost.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content }),
        ...(type && { type }),
        ...(platform && { platform }),
        ...(scheduled_date && { scheduled_date: new Date(scheduled_date) }),
        ...(status && { status }),
      },
      include: { client: { select: { name: true } } },
    });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar post" });
  }
});

// ── DELETE /api/tasqui/calendar/:id ──────────────────────────────────
router.delete("/calendar/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await (prisma as any).calendarPost.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar post" });
  }
});

// ── GET /api/tasqui/traffic ───────────────────────────────────────────
router.get("/traffic", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id } = req.query;

  try {
    const where: any = {};

    if (req.user?.role === "CLIENT") {
      const client = await (prisma as any).client.findFirst({ where: { login_user_id: req.user.id } });
      if (!client) { res.json([]); return; }
      where.client_id = client.id;
    } else if (client_id) {
      where.client_id = client_id as string;
    }

    const campaigns = await (prisma as any).trafficCampaign.findMany({
      where,
      include: { client: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    });

    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar campanhas de tráfego" });
  }
});

// ── POST /api/tasqui/traffic ──────────────────────────────────────────
router.post("/traffic", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "CLIENT") { res.status(403).json({ error: "Acesso negado" }); return; }

  const { client_id, project_id, name, objective, budget, status, start_date, end_date } = req.body;
  if (!client_id || !name) {
    res.status(400).json({ error: "client_id e name são obrigatórios" });
    return;
  }

  try {
    const campaign = await (prisma as any).trafficCampaign.create({
      data: {
        client_id,
        project_id: project_id || null,
        name,
        objective: objective || null,
        budget: budget ? parseFloat(budget) : null,
        status: status || "ATIVO",
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
      include: { client: { select: { name: true } } },
    });
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar campanha" });
  }
});

// ── PATCH /api/tasqui/traffic/:id ────────────────────────────────────
router.patch("/traffic/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, objective, budget, status, start_date, end_date } = req.body;

  try {
    const campaign = await (prisma as any).trafficCampaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(objective !== undefined && { objective }),
        ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
        ...(status && { status }),
        ...(start_date !== undefined && { start_date: start_date ? new Date(start_date) : null }),
        ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
      },
      include: { client: { select: { name: true } } },
    });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar campanha" });
  }
});

// ── DELETE /api/tasqui/traffic/:id ───────────────────────────────────
router.delete("/traffic/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await (prisma as any).trafficCampaign.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar campanha" });
  }
});

// ── Meta Ads: métricas de uma campanha vinculada ──────────────────────
router.get("/traffic/:id/meta-metrics", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { date_preset = "last_7d" } = req.query;
  try {
    const campaign = await (prisma as any).trafficCampaign.findUnique({
      where: { id },
      include: { client: { include: { meta_connection: true } } },
    });
    if (!campaign?.meta_campaign_id) {
      res.status(400).json({ error: "Campanha não vinculada ao Meta Ads" }); return;
    }
    const conn = campaign.client?.meta_connection;
    if (!conn?.access_token) {
      res.status(400).json({ error: "Cliente sem conexão Meta configurada" }); return;
    }
    const fields = `id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(${date_preset}){spend,impressions,clicks,ctr,cpc,reach,frequency,actions,purchase_roas}`;
    const resp = await axios.get(`https://graph.facebook.com/v20.0/${campaign.meta_campaign_id}`, {
      params: { fields, access_token: conn.access_token },
    });
    res.json(resp.data);
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// ── Meta Ads: listar campanhas disponíveis para vincular ──────────────
router.get("/traffic/meta-campaigns/:clientId", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = String(req.params.clientId);
  try {
    const conn = await (prisma as any).clientMetaConnection.findUnique({ where: { client_id: clientId } });
    if (!conn?.ad_account_id || !conn?.access_token) {
      res.status(400).json({ error: "Cliente sem Ad Account configurado" }); return;
    }
    const resp = await axios.get(`https://graph.facebook.com/v20.0/${conn.ad_account_id}/campaigns`, {
      params: { fields: "id,name,status,objective", access_token: conn.access_token, limit: 50 },
    });
    res.json(resp.data);
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// ── Calendário: publicar post no Instagram ────────────────────────────
router.post("/calendar/:id/publish-instagram", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "CLIENT") { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  const { scheduled_at, media_urls, media_type } = req.body;

  if (!scheduled_at || !media_urls?.length) {
    res.status(400).json({ error: "scheduled_at e media_urls são obrigatórios" }); return;
  }

  try {
    const post = await (prisma as any).calendarPost.findUnique({
      where: { id },
      include: { client: { include: { meta_connection: true } } },
    });
    if (!post) { res.status(404).json({ error: "Post não encontrado" }); return; }

    const conn = post.client?.meta_connection;
    if (!conn?.id) {
      res.status(400).json({ error: "Cliente sem conta Instagram conectada. Configure em TechQui → Conexões." }); return;
    }

    // Criar InstagramScheduledPost
    const igPost = await (prisma as any).instagramScheduledPost.create({
      data: {
        connection_id: conn.id,
        client_id:     post.client_id,
        caption:       post.content || post.title || null,
        media_urls:    JSON.stringify(media_urls),
        media_type:    media_type || (post.type === "REEL" ? "REELS" : post.type === "CARROSSEL" ? "CAROUSEL" : "IMAGE"),
        scheduled_at:  new Date(scheduled_at),
        status:        "AGENDADO",
      },
    });

    // Vincular ao CalendarPost + salvar media_urls + marcar como agendado
    await (prisma as any).calendarPost.update({
      where: { id },
      data: {
        instagram_post_id: igPost.id,
        media_urls:        JSON.stringify(media_urls),
        status:            "PUBLICADO", // Agendado para publicação
      },
    });

    res.status(201).json({ instagram_post: igPost });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
