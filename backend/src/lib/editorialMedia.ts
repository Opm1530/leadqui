import crypto from "crypto";
import prisma from "./prisma";

const SECRET = process.env.JWT_SECRET || "dev-secret";

// Assina um token opaco para servir a mídia de um conteúdo publicamente (sem login)
export function signMedia(id: string): string {
  const payload = Buffer.from(id).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMedia(token: string): string | null {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return Buffer.from(payload, "base64url").toString("utf8"); } catch { return null; }
}

// Base pública do backend (para a Meta baixar a mídia)
export function publicApiBase(): string {
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  try { return new URL(process.env.META_OAUTH_REDIRECT_URI!).origin; } catch { return ""; }
}

export function guessMime(name?: string): string | undefined {
  const ext = (name || "").toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
    mp4: "video/mp4", mov: "video/quicktime",
  };
  return map[ext];
}

// Resolve a arte de um conteúdo: arquivo produzido OU o anexo (imagem/vídeo) mais recente da tarefa
export async function resolveContentMedia(content: any): Promise<{ key: string; name: string; mime?: string } | null> {
  if (content.produced_key) {
    return { key: content.produced_key, name: content.produced_name || "arte", mime: guessMime(content.produced_name) };
  }
  if (content.task_id) {
    const files = await (prisma as any).clientFile.findMany({ where: { task_id: content.task_id }, orderBy: { created_at: "desc" } });
    const isMedia = (f: any) => (f.mime || "").startsWith("image/") || (f.mime || "").startsWith("video/") || /\.(jpe?g|png|gif|webp|mp4|mov)$/i.test(f.name || "");
    const media = files.find(isMedia);
    if (media) return { key: media.key, name: media.name, mime: media.mime || guessMime(media.name) };
  }
  return null;
}

export function mediaTypeFor(content: any): "IMAGE" | "REELS" {
  return content.content_type === "REELS" ? "REELS" : "IMAGE";
}
