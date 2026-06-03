import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);

// ── GET /api/leads ────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, origem, search, tag_id, limit = "100", offset = "0" } = req.query;

  try {
    const where: any = { user_id: req.user!.id };

    if (status) where.status = status;
    if (origem) where.origem = origem;
    if (search) {
      where.OR = [
        { nome: { contains: String(search) } },
        { email: { contains: String(search) } },
        { telefone: { contains: String(search) } },
        { cidade: { contains: String(search) } },
      ];
    }
    if (tag_id) {
      where.tags = { some: { tag_id: String(tag_id) } };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: { created_at: "desc" },
        take: parseInt(String(limit)),
        skip: parseInt(String(offset)),
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ leads, total });
  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({ error: "Erro ao buscar leads" });
  }
});

// ── POST /api/leads ───────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, telefone, email, endereco, cidade, origem = "MANUAL", status = "NOVO", ...rest } = req.body;

  if (!nome) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        user_id: req.user!.id,
        nome,
        telefone: telefone || null,
        telefone_limpo: telefone ? telefone.replace(/\D/g, "") : null,
        email: email || null,
        endereco: endereco || null,
        cidade: cidade || null,
        origem,
        status,
        ...rest,
      },
    });

    res.status(201).json({ lead });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ error: "Erro ao criar lead" });
  }
});

// ── PUT /api/leads/:id ────────────────────────────────────────────────
router.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { tags: _tags, ...data } = req.body;

  try {
    const existing = await prisma.lead.findFirst({ where: { id, user_id: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    if (data.telefone) {
      data.telefone_limpo = data.telefone.replace(/\D/g, "");
    }
    delete data.id;

    const lead = await prisma.lead.update({ where: { id }, data });
    res.json({ lead });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({ error: "Erro ao atualizar lead" });
  }
});

// ── DELETE /api/leads/:id ─────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const existing = await prisma.lead.findFirst({ where: { id, user_id: req.user!.id } });
    if (!existing) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: "Lead excluído com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir lead" });
  }
});

// ── POST /api/leads/:id/tags ──────────────────────────────────────────
router.post("/:id/tags", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { tag_ids } = req.body;

  try {
    const lead = await prisma.lead.findFirst({ where: { id, user_id: req.user!.id } });
    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    await prisma.leadTag.deleteMany({ where: { lead_id: id } });

    if (tag_ids && tag_ids.length > 0) {
      await prisma.leadTag.createMany({
        data: tag_ids.map((tag_id: string) => ({ lead_id: id, tag_id })),
        skipDuplicates: true,
      });
    }

    res.json({ message: "Tags atualizadas" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar tags do lead" });
  }
});

// ── GET /api/leads/stats ──────────────────────────────────────────────
router.get("/stats/summary", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, novo, contatado, qualificado, convertido] = await Promise.all([
      prisma.lead.count({ where: { user_id: req.user!.id } }),
      prisma.lead.count({ where: { user_id: req.user!.id, status: "NOVO" } }),
      prisma.lead.count({ where: { user_id: req.user!.id, status: "CONTATADO" } }),
      prisma.lead.count({ where: { user_id: req.user!.id, status: "QUALIFICADO" } }),
      prisma.lead.count({ where: { user_id: req.user!.id, status: "CONVERTIDO" } }),
    ]);

    res.json({ total, novo, contatado, qualificado, convertido });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

export default router;
