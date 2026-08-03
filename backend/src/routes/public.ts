import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getFile } from "../lib/storage";
import { verifyMedia, resolveContentMedia } from "../lib/editorialMedia";

const router = Router();

// GET /api/public/media/:token — serve a arte do conteúdo publicamente (para a Meta baixar).
// Protegido por token HMAC (sem login, mas só quem tem o token assinado acessa).
router.get("/media/:token", async (req: Request, res: Response): Promise<void> => {
  const id = verifyMedia(String(req.params.token));
  if (!id) { res.status(403).json({ error: "Token inválido" }); return; }
  try {
    const content = await (prisma as any).editorialContent.findUnique({ where: { id } });
    if (!content) { res.status(404).json({ error: "Conteúdo não encontrado" }); return; }
    const media = await resolveContentMedia(content);
    if (!media) { res.status(404).json({ error: "Sem mídia" }); return; }
    const { body, mime } = await getFile(media.key);
    res.setHeader("Content-Type", mime || media.mime || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    (body as any).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
