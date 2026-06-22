"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
// GET /api/notifications — lista notificações do usuário
router.get("/", async (req, res) => {
    try {
        const { unread_only } = req.query;
        const where = { user_id: req.user.id };
        if (unread_only === "true")
            where.read = false;
        const notifications = await prisma_1.default.notification.findMany({
            where,
            orderBy: { created_at: "desc" },
            take: 50,
        });
        const unreadCount = await prisma_1.default.notification.count({
            where: { user_id: req.user.id, read: false },
        });
        res.json({ notifications, unreadCount });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PATCH /api/notifications/:id/read — marca uma como lida
router.patch("/:id/read", async (req, res) => {
    try {
        const notif = await prisma_1.default.notification.findFirst({
            where: { id: req.params.id, user_id: req.user.id },
        });
        if (!notif) {
            res.status(404).json({ error: "Não encontrada" });
            return;
        }
        await prisma_1.default.notification.update({
            where: { id: req.params.id },
            data: { read: true },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PATCH /api/notifications/read-all — marca todas como lidas
router.patch("/read-all", async (req, res) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { user_id: req.user.id, read: false },
            data: { read: true },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/notifications/:id
router.delete("/:id", async (req, res) => {
    try {
        const notif = await prisma_1.default.notification.findFirst({
            where: { id: req.params.id, user_id: req.user.id },
        });
        if (!notif) {
            res.status(404).json({ error: "Não encontrada" });
            return;
        }
        await prisma_1.default.notification.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/notifications/clear-all — limpa todas lidas
router.delete("/clear-all", async (req, res) => {
    try {
        await prisma_1.default.notification.deleteMany({
            where: { user_id: req.user.id, read: true },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map