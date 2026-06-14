import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── GET /api/demands ──────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const where: any = {};
  if (status) where.status = status;
  const demands = await (prisma as any).demand.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { created_at: "desc" },
    take: 200,
  });
  res.json({ demands });
});

// ── PATCH /api/demands/:id ────────────────────────────────────────────
router.patch("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, summary } = req.body || {};
  try {
    const demand = await (prisma as any).demand.update({
      where: { id: String(req.params.id) },
      data: { ...(status && { status }), ...(summary && { summary }) },
    });
    res.json({ demand });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/demands/:id ───────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await (prisma as any).demand.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/demands/:id/to-task ─────────────────────────────────────
// Promove a demanda para uma tarefa no Tasqui
router.post("/:id/to-task", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const demand = await (prisma as any).demand.findUnique({ where: { id: String(req.params.id) } });
    if (!demand) { res.status(404).json({ error: "Demanda não encontrada" }); return; }

    // Garante um projeto "Atendimento" para o cliente
    let project = await prisma.project.findFirst({
      where: { client_id: demand.client_id, name: "Atendimento" },
      select: { id: true },
    });
    if (!project) {
      project = await prisma.project.create({
        data: { client_id: demand.client_id, name: "Atendimento", type: "RECORRENTE", status: "ATIVO" },
        select: { id: true },
      });
    }

    const task = await prisma.task.create({
      data: {
        project_id: project.id,
        client_id: demand.client_id,
        responsible_id: req.body?.responsible_id || null,
        title: demand.summary,
        description: `Demanda captada no WhatsApp${demand.sender ? ` (${demand.sender})` : ""}:\n"${demand.original_text}"`,
        status: "PENDENTE",
        priority: "MEDIA",
      },
    });

    await (prisma as any).demand.update({
      where: { id: demand.id }, data: { status: "EM_ANDAMENTO", task_id: task.id },
    });

    res.json({ success: true, task });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
