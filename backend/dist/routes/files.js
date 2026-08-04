"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const os_1 = __importDefault(require("os"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const storage_1 = require("../lib/storage");
const router = (0, express_1.Router)();
// Grava em disco temporário (RAM baixa) e sobe por streaming — suporta arquivos grandes (1GB)
const upload = (0, multer_1.default)({ dest: os_1.default.tmpdir(), limits: { fileSize: 1024 * 1024 * 1024 } });
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireStaff);
// Status do armazenamento
router.get("/status", async (_req, res) => {
    res.json({ configured: await (0, storage_1.isStorageConfigured)() });
});
// Pastas de um cliente
router.get("/folders", async (req, res) => {
    const client_id = String(req.query.client_id || "");
    if (!client_id) {
        res.status(400).json({ error: "client_id obrigatório" });
        return;
    }
    const folders = await prisma_1.default.clientFolder.findMany({ where: { client_id }, orderBy: { name: "asc" } });
    res.json({ folders });
});
router.post("/folders", async (req, res) => {
    const { client_id, name } = req.body;
    if (!client_id || !name?.trim()) {
        res.status(400).json({ error: "client_id e nome obrigatórios" });
        return;
    }
    const folder = await prisma_1.default.clientFolder.create({ data: { client_id, name: name.trim() } });
    res.status(201).json({ folder });
});
router.delete("/folders/:id", async (req, res) => {
    const id = String(req.params.id);
    // Move arquivos da pasta para a raiz antes de excluir
    await prisma_1.default.clientFile.updateMany({ where: { folder_id: id }, data: { folder_id: null } });
    await prisma_1.default.clientFolder.delete({ where: { id } }).catch(() => { });
    res.json({ success: true });
});
// Lista arquivos de um cliente
router.get("/", async (req, res) => {
    const client_id = req.query.client_id ? String(req.query.client_id) : undefined;
    const task_id = req.query.task_id ? String(req.query.task_id) : undefined;
    const folder_id = req.query.folder_id ? String(req.query.folder_id) : undefined;
    if (!client_id && !task_id) {
        res.status(400).json({ error: "client_id ou task_id obrigatório" });
        return;
    }
    const where = {};
    if (task_id)
        where.task_id = task_id;
    else {
        where.client_id = client_id;
        where.task_id = null;
        where.folder_id = folder_id || null;
    }
    const files = await prisma_1.default.clientFile.findMany({ where, orderBy: { created_at: "desc" } });
    res.json({ files });
});
// Upload (multipart) → envia ao R2 e salva metadados
router.post("/", upload.single("file"), async (req, res) => {
    const client_id = String(req.body.client_id || "");
    const task_id = req.body.task_id ? String(req.body.task_id) : null;
    const folder_id = req.body.folder_id ? String(req.body.folder_id) : null;
    const file = req.file;
    if (!client_id || !file) {
        res.status(400).json({ error: "client_id e arquivo obrigatórios" });
        return;
    }
    try {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `clients/${client_id}/${Date.now()}-${safe}`;
        await (0, storage_1.uploadTempFile)(key, file.path, file.mimetype, file.size);
        const saved = await prisma_1.default.clientFile.create({
            data: { client_id, task_id, folder_id, user_id: req.user.id, name: file.originalname, key, size: file.size, mime: file.mimetype },
        });
        res.status(201).json({ file: saved });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Download (stream do R2)
router.get("/:id/download", async (req, res) => {
    try {
        const f = await prisma_1.default.clientFile.findUnique({ where: { id: String(req.params.id) } });
        if (!f) {
            res.status(404).json({ error: "Arquivo não encontrado" });
            return;
        }
        const { body, mime } = await (0, storage_1.getFile)(f.key);
        res.setHeader("Content-Type", mime || f.mime || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
        body.pipe(res);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Excluir
router.delete("/:id", async (req, res) => {
    try {
        const f = await prisma_1.default.clientFile.findUnique({ where: { id: String(req.params.id) } });
        if (!f) {
            res.status(404).json({ error: "Arquivo não encontrado" });
            return;
        }
        await (0, storage_1.deleteFile)(f.key).catch(() => { });
        await prisma_1.default.clientFile.delete({ where: { id: f.id } });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=files.js.map