import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);

// ── GET /api/templates ────────────────────────────────────────────────
// Lista todos os templates do usuário com seus itens
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await (prisma as any).taskTemplate.findMany({
      where:   { user_id: req.user!.id },
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { created_at: "desc" },
    });
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/templates ───────────────────────────────────────────────
// Cria um novo template (conjunto) com itens opcionais
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, service, items = [] } = req.body;
  if (!name) { res.status(400).json({ error: "Nome é obrigatório" }); return; }

  try {
    const template = await (prisma as any).taskTemplate.create({
      data: {
        user_id:     req.user!.id,
        name,
        description: description || null,
        service:     service || null,
        items: {
          create: items.map((item: any, idx: number) => ({
            title:           item.title,
            description:     item.description || null,
            priority:        item.priority || "MEDIA",
            due_days_offset: item.due_days_offset ?? 0,
            order:           item.order ?? idx,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
    res.status(201).json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/templates/:id ────────────────────────────────────────────
// Atualiza metadados do template (nome, descrição, serviço)
router.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, description, service } = req.body;
  try {
    const existing = await (prisma as any).taskTemplate.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!existing) { res.status(404).json({ error: "Template não encontrado" }); return; }

    const template = await (prisma as any).taskTemplate.update({
      where:   { id },
      data:    { name: name ?? existing.name, description: description ?? existing.description, service: service ?? existing.service },
      include: { items: { orderBy: { order: "asc" } } },
    });
    res.json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/templates/:id ─────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await (prisma as any).taskTemplate.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!existing) { res.status(404).json({ error: "Template não encontrado" }); return; }
    await (prisma as any).taskTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/templates/:id/items ─────────────────────────────────────
// Adiciona uma tarefa ao template
router.post("/:id/items", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, priority, due_days_offset, order } = req.body;
  if (!title) { res.status(400).json({ error: "Título é obrigatório" }); return; }

  try {
    const template = await (prisma as any).taskTemplate.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado" }); return; }

    // Próxima ordem
    const lastItem = await (prisma as any).taskTemplateItem.findFirst({
      where:   { template_id: id },
      orderBy: { order: "desc" },
    });
    const nextOrder = order ?? ((lastItem?.order ?? -1) + 1);

    const item = await (prisma as any).taskTemplateItem.create({
      data: {
        template_id:     id,
        title,
        description:     description || null,
        priority:        priority || "MEDIA",
        due_days_offset: due_days_offset ?? 0,
        order:           nextOrder,
      },
    });
    res.status(201).json({ item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/templates/:id/items/:itemId ──────────────────────────────
// Edita um item do template
router.put("/:id/items/:itemId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, itemId } = req.params;
  const { title, description, priority, due_days_offset, order } = req.body;

  try {
    // verifica ownership via template
    const template = await (prisma as any).taskTemplate.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado" }); return; }

    const item = await (prisma as any).taskTemplateItem.update({
      where: { id: itemId },
      data: {
        ...(title           !== undefined && { title }),
        ...(description     !== undefined && { description }),
        ...(priority        !== undefined && { priority }),
        ...(due_days_offset !== undefined && { due_days_offset }),
        ...(order           !== undefined && { order }),
      },
    });
    res.json({ item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/templates/:id/items/:itemId ───────────────────────────
router.delete("/:id/items/:itemId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, itemId } = req.params;
  try {
    const template = await (prisma as any).taskTemplate.findFirst({
      where: { id, user_id: req.user!.id },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado" }); return; }

    await (prisma as any).taskTemplateItem.delete({ where: { id: itemId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/templates/:id/apply ─────────────────────────────────────
// Aplica um template a um cliente existente (cria projeto + tarefas)
router.post("/:id/apply", async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { client_id, project_name, project_type } = req.body;
  if (!client_id) { res.status(400).json({ error: "client_id é obrigatório" }); return; }

  try {
    const template = await (prisma as any).taskTemplate.findFirst({
      where:   { id, user_id: req.user!.id },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado" }); return; }

    const client = await (prisma as any).client.findFirst({
      where: { id: client_id, user_id: req.user!.id },
    });
    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    // Criar projeto para este template
    const project = await (prisma as any).project.create({
      data: {
        client_id,
        name:   project_name || template.name,
        status: "ATIVO",
        type:   project_type || "RECORRENTE",
      },
    });

    // Criar tarefas com offset de data
    const now = new Date();
    const createdTasks = [];
    for (const item of template.items) {
      const dueDate = item.due_days_offset > 0
        ? new Date(now.getTime() + item.due_days_offset * 86400000)
        : null;

      const task = await (prisma as any).task.create({
        data: {
          client_id,
          project_id:  project.id,
          title:       item.title,
          description: item.description || null,
          priority:    item.priority,
          due_date:    dueDate,
          status:      "PENDENTE",
        },
      });
      createdTasks.push(task);
    }

    res.status(201).json({
      success: true,
      project,
      tasks_created: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
