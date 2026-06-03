import { Router, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";
import { startGoogleMapsExtraction, startInstagramExtraction } from "../lib/extractionService";

// Helper para automação do Tasqui
// Cria projetos por serviço e aplica template de tarefas se fornecido
async function createOperationalFlow(
  clientId: string,
  services: string[],
  isUniqueJob: boolean = false,
  uniqueJobName?: string,
  templateId?: string,
  userId?: string,
) {
  try {
    const servicesToProcess = isUniqueJob && uniqueJobName ? [uniqueJobName] : services;

    for (const serviceName of servicesToProcess) {
      // 1. Criar/buscar projeto para este serviço
      let project = await (prisma as any).project.findFirst({
        where: { client_id: clientId, name: serviceName },
      });

      if (!project) {
        project = await (prisma as any).project.create({
          data: {
            client_id: clientId,
            name:   serviceName,
            status: "ATIVO",
            type:   isUniqueJob ? "UNICO" : "RECORRENTE",
          },
        });
      }

      // 2. Se templateId informado E pertence ao usuário → usar itens do template
      if (templateId && userId) {
        const template = await (prisma as any).taskTemplate.findFirst({
          where:   { id: templateId, user_id: userId },
          include: { items: { orderBy: { order: "asc" } } },
        });

        if (template && template.items.length > 0) {
          const now = new Date();
          for (const item of template.items) {
            const alreadyExists = await (prisma as any).task.findFirst({
              where: { project_id: project.id, title: item.title },
            });
            if (alreadyExists) continue;

            const dueDate = item.due_days_offset > 0
              ? new Date(now.getTime() + item.due_days_offset * 86400000)
              : null;

            await (prisma as any).task.create({
              data: {
                client_id:   clientId,
                project_id:  project.id,
                title:       item.title,
                description: item.description || null,
                priority:    item.priority,
                due_date:    dueDate,
                status:      "PENDENTE",
              },
            });
          }
          continue; // template aplicado, pular auto-templates legados
        }
      }

      // 3. Fallback: buscar templates auto-associados ao nome do serviço (legado)
      if (userId) {
        const autoTemplates = await (prisma as any).taskTemplate.findMany({
          where:   { service: serviceName, user_id: userId },
          include: { items: { orderBy: { order: "asc" } } },
        });

        const now = new Date();
        for (const tpl of autoTemplates) {
          for (const item of tpl.items) {
            const alreadyExists = await (prisma as any).task.findFirst({
              where: { project_id: project.id, title: item.title },
            });
            if (alreadyExists) continue;

            const dueDate = item.due_days_offset > 0
              ? new Date(now.getTime() + item.due_days_offset * 86400000)
              : null;

            await (prisma as any).task.create({
              data: {
                client_id:   clientId,
                project_id:  project.id,
                title:       item.title,
                description: item.description || null,
                priority:    item.priority,
                due_date:    dueDate,
                status:      "PENDENTE",
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Erro ao criar fluxo operacional:", error);
  }
}

const router = Router();
router.use(authenticateJWT);

// ─── TAGS ─────────────────────────────────────────────────────────────

router.get("/tags", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      where: { user_id: req.user!.id },
      orderBy: { nome: "asc" },
    });
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tags" });
  }
});

router.post("/tags", async (req: AuthRequest, res: Response): Promise<void> => {
  const { nome, cor } = req.body;
  if (!nome) { res.status(400).json({ error: "Nome é obrigatório" }); return; }

  try {
    const tag = await prisma.tag.create({
      data: {
        user_id: req.user!.id,
        nome,
        cor: cor || "#6366f1",
      },
    });
    res.status(201).json({ tag });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar tag" });
  }
});

router.put("/tags/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { nome, cor } = req.body;

  try {
    const existing = await prisma.tag.findFirst({ where: { id, user_id: req.user!.id } });
    if (!existing) { res.status(404).json({ error: "Tag não encontrada" }); return; }

    const tag = await prisma.tag.update({
      where: { id },
      data: { nome: nome || existing.nome, cor: cor || existing.cor },
    });
    res.json({ tag });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar tag" });
  }
});

router.delete("/tags/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  try {
    const existing = await prisma.tag.findFirst({ where: { id, user_id: req.user!.id } });
    if (!existing) { res.status(404).json({ error: "Tag não encontrada" }); return; }

    await prisma.tag.delete({ where: { id } });
    res.json({ message: "Tag excluída" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir tag" });
  }
});

// ─── CLIENTS ──────────────────────────────────────────────────────────

router.get("/clients", async (req: AuthRequest, res: Response): Promise<void> => {
  const { search } = req.query;
  const where: any = { user_id: req.user!.id };
  if (search) where.name = { contains: String(search) };

  const clients = await (prisma as any).client.findMany({
    where,
    include: { contract: true, services: true, projects: true },
    orderBy: { created_at: "desc" },
  });
  res.json({ clients });
});

router.post("/clients", async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, origin_lead_id, contract, services = [], initial_password, isUniqueJob, uniqueJobName, template_id } = req.body;
  if (!name) { res.status(400).json({ error: "Nome é obrigatório" }); return; }

  try {
    let login_user_id: string | null = null;
    
    if (email && initial_password) {
      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (existingUser) {
        login_user_id = existingUser.id;
      } else {
        const hash = await bcrypt.hash(initial_password, 12);
        const newUser = await prisma.user.create({
          data: {
            name,
            email: email.toLowerCase().trim(),
            password_hash: hash,
            role: "CLIENT"
          }
        });
        login_user_id = newUser.id;
      }
    }

    const client = await prisma.client.create({
      data: {
        user_id: req.user!.id,
        login_user_id,
        name,
        email: email || null,
        initial_password: initial_password || null,
        status: "ATIVO",
        ...(contract && {
          contract: {
            create: {
              value: parseFloat(contract.value),
              start_date: contract.start_date,
              duration: parseInt(contract.duration || "0"),
              responsible: contract.responsible || null,
            },
          },
        }),
        ...(services.length > 0 && !isUniqueJob && {
          services: {
            create: services.map((s: string) => ({ service: s, status: "ATIVO" })),
          },
        }),
      },
      include: { contract: true, services: true },
    });

    // Update lead status if origin_lead_id
    if (origin_lead_id) {
      await prisma.lead.update({
        where: { id: origin_lead_id },
        data: { status: "CONVERTIDO", client_id: client.id },
      }).catch(() => {}); // ignore if lead doesn't exist
    }

    // Automação Tasqui — cria projetos + aplica template de tarefas se selecionado
    if (isUniqueJob || (services && services.length > 0) || template_id) {
      await createOperationalFlow(
        client.id,
        services || [],
        isUniqueJob,
        uniqueJobName,
        template_id || undefined,
        req.user!.id,
      );
    }

    // Automação CashQui — gerar primeira fatura automaticamente
    if (contract && contract.value) {
      const dueDate = new Date(contract.start_date || Date.now());
      dueDate.setDate(dueDate.getDate() + (isUniqueJob ? 0 : 30));
      const description = isUniqueJob
        ? (uniqueJobName || "Job único")
        : `Mensalidade — ${new Date(dueDate).toLocaleString("pt-BR", { month: "long", year: "numeric" })}`;

      await (prisma as any).invoice.create({
        data: {
          client_id: client.id,
          description,
          amount: parseFloat(contract.value),
          due_date: dueDate,
          status: "PENDENTE",
        },
      }).catch(() => {}); // não bloquear se falhar
    }

    res.status(201).json({ client });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/clients/:id/nova-venda ─────────────────────────────────
// Adiciona uma nova venda (projeto + fatura) a um cliente já existente
router.post("/clients/:id/nova-venda", async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = String(req.params.id);
  const { isUniqueJob, jobName, value, due_date, template_id } = req.body;

  if (!value || !jobName) {
    res.status(400).json({ error: "Valor e nome do serviço são obrigatórios" });
    return;
  }

  try {
    // Verifica ownership do cliente
    const client = await prisma.client.findFirst({
      where: { id: clientId, user_id: req.user!.id },
    });
    if (!client) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }

    // 1. Criar projeto
    const project = await (prisma as any).project.create({
      data: {
        client_id: clientId,
        name:   jobName,
        status: "ATIVO",
        type:   isUniqueJob ? "UNICO" : "RECORRENTE",
      },
    });

    // 2. Aplicar template se informado
    if (template_id) {
      const template = await (prisma as any).taskTemplate.findFirst({
        where:   { id: template_id, user_id: req.user!.id },
        include: { items: { orderBy: { order: "asc" } } },
      });

      if (template?.items?.length) {
        const now = new Date();
        for (const item of template.items) {
          const dueDate = item.due_days_offset > 0
            ? new Date(now.getTime() + item.due_days_offset * 86400000)
            : null;

          await (prisma as any).task.create({
            data: {
              client_id:   clientId,
              project_id:  project.id,
              title:       item.title,
              description: item.description || null,
              priority:    item.priority,
              due_date:    dueDate,
              status:      "PENDENTE",
            },
          });
        }
      }
    }

    // 3. Gerar fatura
    const invoiceDue = due_date ? new Date(due_date) : new Date();
    const invoice = await (prisma as any).invoice.create({
      data: {
        client_id:   clientId,
        description: jobName,
        amount:      parseFloat(value),
        due_date:    invoiceDue,
        status:      "PENDENTE",
      },
    });

    // 4. Reativar cliente se estava inativo
    if (client.status === "INATIVO") {
      await prisma.client.update({
        where: { id: clientId },
        data:  { status: "ATIVO" },
      });
    }

    res.status(201).json({ success: true, project, invoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/clients/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.client.findFirst({ where: { id, user_id: req.user!.id } });
  if (!existing) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

  try {
    const { name, email, status, contract, services, initial_password } = req.body;
    
    // Sincronizar usuário de acesso se houver e-mail
    let login_user_id = existing.login_user_id;
    if (email && email !== existing.email) {
       const userWithEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
       if (userWithEmail) {
         login_user_id = userWithEmail.id;
       } else if (existing.login_user_id) {
         // Atualizar e-mail do usuário de acesso atual
         await prisma.user.update({ where: { id: existing.login_user_id }, data: { email: email.toLowerCase().trim() } });
       }
    }

    if (initial_password && initial_password !== existing.initial_password && login_user_id) {
      const hash = await bcrypt.hash(initial_password, 12);
      await prisma.user.update({ where: { id: login_user_id }, data: { password_hash: hash } });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: name || existing.name,
        email: email !== undefined ? email : existing.email,
        initial_password: initial_password !== undefined ? initial_password : existing.initial_password,
        status: status || existing.status,
        login_user_id
      },
      include: { contract: true, services: true }
    });

    if (contract) {
      await prisma.contract.upsert({
        where: { client_id: id },
        create: { client_id: id, value: parseFloat(contract.value), start_date: contract.start_date, duration: parseInt(contract.duration), responsible: contract.responsible },
        update: { value: parseFloat(contract.value), start_date: contract.start_date, duration: parseInt(contract.duration), responsible: contract.responsible },
      });
    }

    if (services !== undefined) {
      await prisma.clientService.deleteMany({ where: { client_id: id } });
      if (services.length > 0) {
        await prisma.clientService.createMany({
          data: services.map((s: string) => ({ client_id: id, service: s, status: "ATIVO" })),
        });
        // Disparar automação para novos serviços
        await createOperationalFlow(id, services);
      }
    }

    const updated = await prisma.client.findUnique({ where: { id }, include: { contract: true, services: true } });
    res.json({ client: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/clients/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.client.findFirst({ where: { id, user_id: req.user!.id } });
  if (!existing) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
  
  // Deletar o usuário de acesso também? Vamos manter se ele tiver outros vínculos, 
  // mas aqui o cadastro é 1:1 então faz sentido remover para não poluir
  if ((existing as any).login_user_id) {
    await prisma.user.delete({ where: { id: (existing as any).login_user_id } }).catch(() => {});
  }

  await prisma.client.delete({ where: { id } });
  res.json({ message: "Cliente excluído" });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────

router.get("/settings", async (req: AuthRequest, res: Response): Promise<void> => {
  const settings = await prisma.userSettings.findUnique({ where: { user_id: req.user!.id } });
  // Mask API keys
  const masked = settings ? {
    ...settings,
    serper_api_key: settings.serper_api_key ? "••••••••" : null,
    apify_api_key: settings.apify_api_key ? "••••••••" : null,
    openai_api_key: settings.openai_api_key ? "••••••••" : null,
    evolution_api_key: settings.evolution_api_key ? "••••••••" : null,
  } : null;
  res.json({ settings: masked });
});

router.put("/settings", async (req: AuthRequest, res: Response): Promise<void> => {
  const data = req.body;
  // Remove masked values
  Object.keys(data).forEach((k) => { if (data[k] === "••••••••") delete data[k]; });

  const settings = await prisma.userSettings.upsert({
    where: { user_id: req.user!.id },
    create: { user_id: req.user!.id, ...data },
    update: data,
  });
  res.json({ settings: { ...settings, serper_api_key: settings.serper_api_key ? "••••••••" : null } });
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────

router.get("/dashboard", async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const [totalLeads, totalClients, totalCampaigns, leadsThisMonth] = await Promise.all([
    prisma.lead.count({ where: { user_id: userId } }),
    prisma.client.count({ where: { user_id: userId } }),
    prisma.campaign.count({ where: { user_id: userId } }),
    prisma.lead.count({
      where: {
        user_id: userId,
        created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  res.json({ totalLeads, totalClients, totalCampaigns, leadsThisMonth });
});

// ─── EXTRACTIONS ───────────────────────────────────────────────────────

router.get("/extractions", async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = parseInt(String(req.query.limit || "20"));
  const extractions = await prisma.extraction.findMany({
    where: { user_id: req.user!.id },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  res.json({ extractions });
});

router.get("/extractions/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const extraction = await prisma.extraction.findFirst({ where: { id, user_id: req.user!.id } });
  if (!extraction) { res.status(404).json({ error: "Extração não encontrada" }); return; }
  res.json({ extraction });
});


router.post("/extractions", async (req: AuthRequest, res: Response): Promise<void> => {
  const { tipo, categoria, cidade, hashtag, quantidade, tag_id } = req.body;
  if (!tipo) { res.status(400).json({ error: "Tipo é obrigatório" }); return; }

  const parametros = tipo === "GOOGLE_MAPS"
    ? JSON.stringify({ categoria, cidade, quantidade })
    : JSON.stringify({ hashtag, quantidade });

  const extraction = await prisma.extraction.create({
    data: {
      user_id: req.user!.id,
      tipo: tipo as any,
      parametros,
      status: "PENDENTE",
      total_leads: 0,
    },
  });

  // Disparar o processo em segundo plano (background)
  if (tipo === "GOOGLE_MAPS") {
    startGoogleMapsExtraction(extraction.id, req.user!.id, { categoria, cidade, quantidade, tag_id });
  } else if (tipo === "INSTAGRAM") {
    startInstagramExtraction(extraction.id, req.user!.id, { hashtag, quantidade, tag_id });
  }

  res.status(201).json({ extraction });
});

router.put("/extractions/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { status } = req.body;
  const existing = await prisma.extraction.findFirst({ where: { id, user_id: req.user!.id } });
  if (!existing) { res.status(404).json({ error: "Extração não encontrada" }); return; }
  const extraction = await prisma.extraction.update({
    where: { id },
    data: { status: status || existing.status },
  });
  res.json({ extraction });
});

router.delete("/extractions/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.extraction.findFirst({ where: { id, user_id: req.user!.id } });
  if (!existing) { res.status(404).json({ error: "Extração não encontrada" }); return; }
  await prisma.extraction.delete({ where: { id } });
  res.json({ message: "Extração excluída do histórico" });
});

// ─── CLIENT PROFILE FOR HUB ───────────────────────────────────────────

router.get("/me/client-profile", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role === "CLIENT") {
      const client = await prisma.client.findFirst({ 
        where: { login_user_id: req.user.id } as any,
        include: { services: true }
      });
      res.json({ client });
    } else {
      res.status(403).json({ error: "Acesso negado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
});

export default router;
