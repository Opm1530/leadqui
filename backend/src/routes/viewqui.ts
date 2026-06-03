import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/viewqui/dashboard ───────────────────────────────────────────
// Returns all data for the client portal (CLIENT role only)
router.get("/dashboard", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "CLIENT") {
      res.status(403).json({ error: "Acesso restrito a clientes" });
      return;
    }

    const client = await prisma.client.findFirst({
      where: { login_user_id: req.user.id } as any,
      include: { services: true },
    });

    if (!client) {
      res.status(404).json({ error: "Perfil de cliente não encontrado" });
      return;
    }

    const clientId = client.id;

    // Fetch all relevant data in parallel
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const [tasks, projects, calendarPosts, trafficCampaigns, invoices] = await Promise.all([
      // Active tasks for this client
      prisma.task.findMany({
        where: { client_id: clientId } as any,
        include: {
          project: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true } },
        } as any,
        orderBy: { created_at: "desc" } as any,
        take: 50,
      }),

      // Projects for this client
      prisma.project.findMany({
        where: { client_id: clientId } as any,
        include: {
          tasks: { select: { id: true, status: true } } as any,
        },
        orderBy: { created_at: "desc" } as any,
      }),

      // Calendar posts for current month
      (prisma as any).calendarPost.findMany({
        where: {
          client_id: clientId,
          scheduled_date: {
            gte: new Date(year, month, 1),
            lte: new Date(year, month + 1, 0, 23, 59, 59),
          },
        },
        orderBy: { scheduled_date: "asc" },
      }),

      // Active traffic campaigns
      (prisma as any).trafficCampaign.findMany({
        where: { client_id: clientId, status: "ATIVO" },
        orderBy: { created_at: "desc" },
      }),

      // Pending and recent invoices
      (prisma as any).invoice.findMany({
        where: { client_id: clientId },
        orderBy: { due_date: "desc" },
        take: 10,
      }),
    ]);

    res.json({
      client: {
        id: client.id,
        name: (client as any).name,
        services: (client as any).services,
      },
      tasks,
      projects,
      calendarPosts,
      trafficCampaigns,
      invoices,
    });
  } catch (error) {
    console.error("ViewQui dashboard error:", error);
    res.status(500).json({ error: "Erro ao carregar dados do portal" });
  }
});

// ── PATCH /api/viewqui/calendar/:id/approve ──────────────────────────────
// Allow CLIENT to approve a calendar post (PLANEJADO → APROVADO)
router.patch("/calendar/:id/approve", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "CLIENT") {
      res.status(403).json({ error: "Acesso restrito a clientes" });
      return;
    }

    const client = await prisma.client.findFirst({
      where: { login_user_id: req.user.id } as any,
    });

    if (!client) {
      res.status(404).json({ error: "Perfil de cliente não encontrado" });
      return;
    }

    const post = await (prisma as any).calendarPost.findFirst({
      where: { id: req.params.id, client_id: client.id },
    });

    if (!post) {
      res.status(404).json({ error: "Post não encontrado" });
      return;
    }

    if (post.status !== "PLANEJADO" && post.status !== "PRODUZINDO") {
      res.status(400).json({ error: "Somente posts em planejamento ou produção podem ser aprovados" });
      return;
    }

    const updated = await (prisma as any).calendarPost.update({
      where: { id: req.params.id },
      data: { status: "APROVADO" },
    });

    res.json({ post: updated });
  } catch (error) {
    res.status(500).json({ error: "Erro ao aprovar post" });
  }
});

export default router;
