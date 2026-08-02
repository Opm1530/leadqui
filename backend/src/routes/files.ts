import { Router, Response } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { uploadFile, getFile, deleteFile, isStorageConfigured } from "../lib/storage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB

router.use(authenticateJWT);
router.use(requireStaff);

// Status do armazenamento
router.get("/status", async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ configured: await isStorageConfigured() });
});

// Lista arquivos de um cliente
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.query.client_id || "");
  if (!client_id) { res.status(400).json({ error: "client_id obrigatório" }); return; }
  const files = await (prisma as any).clientFile.findMany({ where: { client_id }, orderBy: { created_at: "desc" } });
  res.json({ files });
});

// Upload (multipart) → envia ao R2 e salva metadados
router.post("/", upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  const client_id = String(req.body.client_id || "");
  const file = (req as any).file;
  if (!client_id || !file) { res.status(400).json({ error: "client_id e arquivo obrigatórios" }); return; }
  try {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clients/${client_id}/${Date.now()}-${safe}`;
    await uploadFile(key, file.buffer, file.mimetype);
    const saved = await (prisma as any).clientFile.create({
      data: { client_id, user_id: req.user!.id, name: file.originalname, key, size: file.size, mime: file.mimetype },
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
