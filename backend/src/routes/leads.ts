import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff); // dados compartilhados pela equipe — bloqueia CLIENT

// ── GET /api/leads ────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, origem, search, tag_id, limit = "100", offset = "0" } = req.query;

  try {
    const where: any = {};

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
  const {
    nome, telefone, email, endereco, cidade, website, categoria, observacao,
    origem = "MANUAL", status = "NOVO",
    valor_proposto, duracao_proposta, responsavel_proposto, servicos_propostos,
  } = req.body;

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
        website: website || null,
        categoria: categoria || null,
        observacao: observacao || null,
        origem,
        status,
        valor_proposto: valor_proposto != null && valor_proposto !== "" ? Number(valor_proposto) : null,
        duracao_proposta: duracao_proposta != null && duracao_proposta !== "" ? parseInt(String(duracao_proposta)) : null,
        responsavel_proposto: responsavel_proposto || null,
        servicos_propostos: Array.isArray(servicos_propostos) ? JSON.stringify(servicos_propostos) : (servicos_propostos || null),
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
  const { tags, tag_ids, ...data } = req.body;

  try {
    const existing = await prisma.lead.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    if (data.telefone) {
      data.telefone_limpo = data.telefone.replace(/\D/g, "");
    }
    delete data.id;

    const lead = await prisma.lead.update({ where: { id }, data });

    // Atualizar tags se enviadas junto com o update
    const incomingTagIds: string[] | null =
      Array.isArray(tag_ids) ? tag_ids :
      Array.isArray(tags)    ? tags.map((t: any) => (typeof t === "string" ? t : t.tag_id ?? t.id)).filter(Boolean) :
      null;

    if (incomingTagIds !== null) {
      await prisma.leadTag.deleteMany({ where: { lead_id: id } });
      if (incomingTagIds.length > 0) {
        await prisma.leadTag.createMany({
          data: incomingTagIds.map((tag_id) => ({ lead_id: id, tag_id })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.lead.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });
    res.json({ lead: updated });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({ error: "Erro ao atualizar lead" });
  }
});

// ── DELETE /api/leads/:id ─────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const existing = await prisma.lead.findFirst({ where: { id } });
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
    const lead = await prisma.lead.findFirst({ where: { id } });
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
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "NOVO" } }),
      prisma.lead.count({ where: { status: "CONTATADO" } }),
      prisma.lead.count({ where: { status: "QUALIFICADO" } }),
      prisma.lead.count({ where: { status: "CONVERTIDO" } }),
    ]);

    res.json({ total, novo, contatado, qualificado, convertido });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

export default router;
