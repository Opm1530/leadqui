import { Router, Response } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticateJWT, AuthRequest } from "../middlewares/auth";
import { uploadFile, getFile, deleteFile } from "../lib/storage";
import { dayDate } from "../lib/dates";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const isStaff = (r?: string) => ["ADMIN", "MANAGER", "OPERATOR"].includes(r || "");
const canManage = (r?: string) => ["ADMIN", "MANAGER"].includes(r || "");

// Mapeia o status do conteúdo para o status da tarefa vinculada
function taskStatusFor(contentStatus: string): string {
  switch (contentStatus) {
    case "EM_APROVACAO": return "REVISAO";
    case "AGUARDANDO_POSTAR":
    case "POSTADO": return "CONCLUIDO";
    case "AJUSTES":
    case "EM_PRODUCAO":
    default: return "PENDENTE";
  }
}

async function syncTask(contentId: string) {
  const c = await (prisma as any).editorialContent.findUnique({ where: { id: contentId } });
  if (!c?.task_id) return;
  await (prisma as any).task.update({
    where: { id: c.task_id },
    data: {
      status: taskStatusFor(c.status),
      responsible_id: c.responsible_id,
      ...(c.status === "AGUARDANDO_POSTAR" || c.status === "POSTADO" ? { completed_at: new Date() } : { completed_at: null }),
    },
  }).catch(() => {});
}

async function notify(userId: string | null | undefined, title: string, message: string, refId: string) {
  if (!userId) return;
  await (prisma as any).notification.create({
    data: { user_id: userId, type: "EDITORIAL", title, message, link: "/editorial", reference_id: refId },
  }).catch(() => {});
}

const include = {
  client: { select: { id: true, name: true } },
  responsible: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
};

// ── GET /api/editorial ─────────────────────────────────────────────────
// Filtros opcionais: clientId, responsibleId, status, from, to (data de publicação)
router.get("/", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isStaff(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const { clientId, responsibleId, status, from, to } = req.query as any;
  const where: any = {};
  if (clientId) where.client_id = String(clientId);
  if (responsibleId) where.responsible_id = String(responsibleId);
  if (status) where.status = String(status);
  if (from || to) {
    where.scheduled_date = {};
    if (from) where.scheduled_date.gte = new Date(String(from));
    if (to) where.scheduled_date.lte = new Date(String(to));
  }
  try {
    const items = await (prisma as any).editorialContent.findMany({
      where, include, orderBy: [{ scheduled_date: "asc" }, { created_at: "desc" }],
    });
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/editorial ── (cria conteúdo + tarefa vinculada) ──────────
router.post("/", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const { title, description, client_id, responsible_id, reference_url, caption, hashtags, content_type, platform, scheduled_date, priority } = req.body;
  if (!title || !client_id) { res.status(400).json({ error: "Título e cliente são obrigatórios" }); return; }
  try {
    // Cria a tarefa vinculada para o responsável (se houver)
    let task_id: string | null = null;
    if (responsible_id) {
      const task = await (prisma as any).task.create({
        data: {
          title: `Produzir: ${title}`,
          description: description || null,
          client_id,
          responsible_id,
          due_date: dayDate(scheduled_date),
          priority: priority || "MEDIA",
          status: "PENDENTE",
        },
      });
      task_id = task.id;
    }
    const content = await (prisma as any).editorialContent.create({
      data: {
        user_id: req.user!.id,
        client_id,
        responsible_id: responsible_id || null,
        task_id,
        title,
        description: description || null,
        reference_url: reference_url || null,
        caption: caption || null,
        hashtags: hashtags || null,
        content_type: content_type || "POST",
        platform: platform || "INSTAGRAM",
        scheduled_date: scheduled_date ? dayDate(scheduled_date) : null,
        status: responsible_id ? "EM_PRODUCAO" : "IDEIA",
      },
      include,
    });
    if (responsible_id) await notify(responsible_id, "Novo conteúdo para produzir", `${title} — ${content.client?.name || ""}`, content.id);
    res.status(201).json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/editorial/:id ── (edita campos / troca responsável / status) ─
router.patch("/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  const b = req.body;
  const data: any = {};
  for (const f of ["title", "description", "reference_url", "caption", "hashtags", "content_type", "platform", "status"]) {
    if (b[f] !== undefined) data[f] = b[f];
  }
  if (b.scheduled_date !== undefined) data.scheduled_date = b.scheduled_date ? dayDate(b.scheduled_date) : null;
  if (b.responsible_id !== undefined) data.responsible_id = b.responsible_id || null;
  try {
    const prev = await (prisma as any).editorialContent.findUnique({ where: { id } });
    const content = await (prisma as any).editorialContent.update({ where: { id }, data, include });

    // Se ganhou responsável e ainda não tinha tarefa, cria uma
    if (content.responsible_id && !content.task_id) {
      const task = await (prisma as any).task.create({
        data: {
          title: `Produzir: ${content.title}`,
          description: content.description || null,
          client_id: content.client_id,
          responsible_id: content.responsible_id,
          due_date: content.scheduled_date || null,
          status: taskStatusFor(content.status),
        },
      });
      await (prisma as any).editorialContent.update({ where: { id }, data: { task_id: task.id } });
    } else {
      await syncTask(id);
    }
    // Mantém título/prazo da tarefa em dia
    if (content.task_id && (b.title !== undefined || b.scheduled_date !== undefined)) {
      await (prisma as any).task.update({
        where: { id: content.task_id },
        data: { ...(b.title !== undefined ? { title: `Produzir: ${content.title}` } : {}), ...(b.scheduled_date !== undefined ? { due_date: content.scheduled_date } : {}) },
      }).catch(() => {});
    }
    if (b.responsible_id !== undefined && content.responsible_id && content.responsible_id !== prev?.responsible_id) {
      await notify(content.responsible_id, "Conteúdo atribuído a você", `${content.title} — ${content.client?.name || ""}`, content.id);
    }
    res.json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/editorial/:id/submit ── (responsável sobe o conteúdo → Aprovação) ─
router.post("/:id/submit", authenticateJWT, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isStaff(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  try {
    const c = await (prisma as any).editorialContent.findUnique({ where: { id } });
    if (!c) { res.status(404).json({ error: "Conteúdo não encontrado" }); return; }
    // Operador só pode subir no que é responsável
    if (req.user!.role === "OPERATOR" && c.responsible_id !== req.user!.id) {
      res.status(403).json({ error: "Você não é o responsável por este conteúdo" }); return;
    }
    const data: any = { status: "EM_APROVACAO", feedback: null };
    if (req.file) {
      // remove arquivo anterior
      if (c.produced_key) await deleteFile(c.produced_key).catch(() => {});
      const safe = (req.file.originalname || "arquivo").replace(/[^\w.\-]+/g, "_");
      const key = `editorial/${id}/${Date.now()}-${safe}`;
      await uploadFile(key, req.file.buffer, req.file.mimetype);
      data.produced_key = key;
      data.produced_name = req.file.originalname;
    }
    const content = await (prisma as any).editorialContent.update({ where: { id }, data, include });
    await syncTask(id);
    // Notifica quem criou (manager) para aprovar
    await notify(content.user_id, "Conteúdo aguardando aprovação", `${content.title} — ${content.client?.name || ""}`, content.id);
    res.json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/editorial/:id/approve ── (→ Aguardando Postar) ───────────
router.post("/:id/approve", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  try {
    const content = await (prisma as any).editorialContent.update({
      where: { id }, data: { status: "AGUARDANDO_POSTAR", approved_at: new Date(), feedback: null }, include,
    });
    await syncTask(id);
    await notify(content.responsible_id, "Conteúdo aprovado ✅", `${content.title} — pronto para postar`, content.id);
    res.json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/editorial/:id/reject ── (→ Ajustes, com feedback) ────────
router.post("/:id/reject", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  const { feedback } = req.body;
  try {
    const content = await (prisma as any).editorialContent.update({
      where: { id }, data: { status: "AJUSTES", feedback: feedback || null }, include,
    });
    await syncTask(id);
    await notify(content.responsible_id, "Conteúdo precisa de ajustes", feedback || content.title, content.id);
    res.json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/editorial/:id/post ── (→ Postado) ────────────────────────
router.post("/:id/post", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  try {
    const content = await (prisma as any).editorialContent.update({
      where: { id }, data: { status: "POSTADO", posted_at: new Date() }, include,
    });
    await syncTask(id);
    res.json(content);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/editorial/:id/file ── (abre o conteúdo produzido) ─────────
router.get("/:id/file", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const c = await (prisma as any).editorialContent.findUnique({ where: { id: String(req.params.id) } });
    if (!c?.produced_key) { res.status(404).json({ error: "Sem arquivo" }); return; }
    const { body, mime } = await getFile(c.produced_key);
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(c.produced_name || "conteudo")}"`);
    (body as any).pipe(res);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/editorial/:id ──────────────────────────────────────────
router.delete("/:id", authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManage(req.user?.role)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const id = String(req.params.id);
  try {
    const c = await (prisma as any).editorialContent.findUnique({ where: { id } });
    if (c?.produced_key) await deleteFile(c.produced_key).catch(() => {});
    await (prisma as any).editorialContent.delete({ where: { id } });
    if (c?.task_id) await (prisma as any).task.delete({ where: { id: c.task_id } }).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
