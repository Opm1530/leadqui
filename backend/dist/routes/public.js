"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const storage_1 = require("../lib/storage");
const editorialMedia_1 = require("../lib/editorialMedia");
const router = (0, express_1.Router)();
// GET /api/public/media/:token — serve a arte do conteúdo publicamente (para a Meta baixar).
// Protegido por token HMAC (sem login, mas só quem tem o token assinado acessa).
router.get("/media/:token", async (req, res) => {
    const id = (0, editorialMedia_1.verifyMedia)(String(req.params.token));
    if (!id) {
        res.status(403).json({ error: "Token inválido" });
        return;
    }
    try {
        const content = await prisma_1.default.editorialContent.findUnique({ where: { id } });
        if (!content) {
            res.status(404).json({ error: "Conteúdo não encontrado" });
            return;
        }
        const media = await (0, editorialMedia_1.resolveContentMedia)(content);
        if (!media) {
            res.status(404).json({ error: "Sem mídia" });
            return;
        }
        const { body, mime } = await (0, storage_1.getFile)(media.key);
        res.setHeader("Content-Type", mime || media.mime || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=3600");
        body.pipe(res);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=public.js.map