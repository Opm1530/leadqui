import { Router, Response } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { uploadFile, getFile, deleteFile, isStorageConfigured } from "../lib/storage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB

router.use(authenticateJWT);
router.use(requireStaff);

// Status do armazenamento
router.get("/status", async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ configured: await isStorageConfigured() });
});

// Pastas de um cliente
router.get("/folders", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.query.client_id || "");
  if (!client_id) { res.status(400).json({ error: "client_id obrigatório" }); return; }
  const folders = await (prisma as any).clientFolder.findMany({ where: { client_id }, orderBy: { name: "asc" } });
  res.json({ folders });
});

router.post("/folders", async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, name } = req.body;
  if (!client_id || !name?.trim()) { res.status(400).json({ error: "client_id e nome obrigatórios" }); return; }
  const folder = await (prisma as any).clientFolder.create({ data: { client_id, name: name.trim() } });
  res.status(201).json({ folder });
});

router.delete("/folders/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  // Move arquivos da pasta para a raiz antes de excluir
  await (prisma as any).clientFile.updateMany({ where: { folder_id: id }, data: { folder_id: null } });
  await (prisma as any).clientFolder.delete({ where: { id } }).catch(() => {});
  res.json({ success: true });
});

// Lista arquivos de um cliente
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = req.query.client_id ? String(req.query.client_id) : undefined;
  const task_id = req.query.task_id ? String(req.query.task_id) : undefined;
  const folder_id = req.query.folder_id ? String(req.query.folder_id) : undefined;
  if (!client_id && !task_id) { res.status(400).json({ error: "client_id ou task_id obrigatório" }); return; }
  const where: any = {};
  if (task_id) where.task_id = task_id;
  else { where.client_id = client_id; where.task_id = null; where.folder_id = folder_id || null; }
  const files = await (prisma as any).clientFile.findMany({ where, orderBy: { created_at: "desc" } });
  res.json({ files });
});

// Upload (multipart) → envia ao R2 e salva metadados
router.post("/", upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.body.client_id || "");
  const task_id = req.body.task_id ? String(req.body.task_id) : null;
  const folder_id = req.body.folder_id ? String(req.body.folder_id) : null;
  const file = (req as any).file;
  if (!client_id || !file) { res.status(400).json({ error: "client_id e arquivo obrigatórios" }); return; }
  try {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clients/${client_id}/${Date.now()}-${safe}`;
    await uploadFile(key, file.buffer, file.mimetype);
    const saved = await (prisma as any).clientFile.create({
      data: { client_id, task_id, folder_id, user_id: req.user!.id, name: file.originalname, key, size: file.size, mime: file.mimetype },
    });
    res.status(201).json({ file: saved });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Download (stream do R2)
router.get("/:id/download", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const f = await (prisma as any).clientFile.findUnique({ where: { id: String(req.params.id) } });
    if (!f) { res.status(404).json({ error: "Arquivo não encontrado" }); return; }
    const { body, mime } = await getFile(f.key);
    res.setHeader("Content-Type", mime || f.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
    (body as any).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Excluir
router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const f = await (prisma as any).clientFile.findUnique({ where: { id: String(req.params.id) } });
    if (!f) { res.status(404).json({ error: "Arquivo não encontrado" }); return; }
    await deleteFile(f.key).catch(() => {});
    await (prisma as any).clientFile.delete({ where: { id: f.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
