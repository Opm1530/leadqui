"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMedia = signMedia;
exports.verifyMedia = verifyMedia;
exports.publicApiBase = publicApiBase;
exports.guessMime = guessMime;
exports.resolveContentMedia = resolveContentMedia;
exports.mediaTypeFor = mediaTypeFor;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("./prisma"));
const SECRET = process.env.JWT_SECRET || "dev-secret";
// Assina um token opaco para servir a mídia de um conteúdo publicamente (sem login)
function signMedia(id) {
    const payload = Buffer.from(id).toString("base64url");
    const sig = crypto_1.default.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return `${payload}.${sig}`;
}
function verifyMedia(token) {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig)
        return null;
    const expected = crypto_1.default.createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (sig.length !== expected.length || !crypto_1.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
        return null;
    try {
        return Buffer.from(payload, "base64url").toString("utf8");
    }
    catch {
        return null;
    }
}
// Base pública do backend (para a Meta baixar a mídia)
function publicApiBase() {
    if (process.env.PUBLIC_API_URL)
        return process.env.PUBLIC_API_URL.replace(/\/$/, "");
    try {
        return new URL(process.env.META_OAUTH_REDIRECT_URI).origin;
    }
    catch {
        return "";
    }
}
function guessMime(name) {
    const ext = (name || "").toLowerCase().split(".").pop() || "";
    const map = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
        mp4: "video/mp4", mov: "video/quicktime",
    };
    return map[ext];
}
// Resolve a arte de um conteúdo: arquivo produzido OU o anexo (imagem/vídeo) mais recente da tarefa
async function resolveContentMedia(content) {
    if (content.produced_key) {
        return { key: content.produced_key, name: content.produced_name || "arte", mime: guessMime(content.produced_name) };
    }
    if (content.task_id) {
        const files = await prisma_1.default.clientFile.findMany({ where: { task_id: content.task_id }, orderBy: { created_at: "desc" } });
        const isMedia = (f) => (f.mime || "").startsWith("image/") || (f.mime || "").startsWith("video/") || /\.(jpe?g|png|gif|webp|mp4|mov)$/i.test(f.name || "");
        const media = files.find(isMedia);
        if (media)
            return { key: media.key, name: media.name, mime: media.mime || guessMime(media.name) };
    }
    return null;
}
function mediaTypeFor(content) {
    return content.content_type === "REELS" ? "REELS" : "IMAGE";
}
//# sourceMappingURL=editorialMedia.js.map