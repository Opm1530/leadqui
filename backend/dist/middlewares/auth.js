"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStaff = exports.requireAdmin = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token não fornecido" });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ error: "Token inválido ou expirado" });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Acesso restrito a administradores" });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
// Permite apenas equipe interna (ADMIN, MANAGER, OPERATOR).
// Bloqueia clientes externos (CLIENT) de acessar dados compartilhados da empresa.
const requireStaff = (req, res, next) => {
    const staffRoles = ["ADMIN", "MANAGER", "OPERATOR"];
    if (!req.user || !staffRoles.includes(req.user.role)) {
        res.status(403).json({ error: "Acesso restrito à equipe interna" });
        return;
    }
    next();
};
exports.requireStaff = requireStaff;
//# sourceMappingURL=auth.js.map