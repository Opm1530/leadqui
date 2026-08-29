"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.denyRoles = exports.requireClientAdmin = exports.requireClientUser = exports.requireStaff = exports.requireAdmin = exports.authenticateJWT = void 0;
exports.getScopeClientId = getScopeClientId;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
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
    const staffRoles = ["ADMIN", "MANAGER", "OPERATOR", "DESIGNER"];
    if (!req.user || !staffRoles.includes(req.user.role)) {
        res.status(403).json({ error: "Acesso restrito à equipe interna" });
        return;
    }
    next();
};
exports.requireStaff = requireStaff;
// Resolve o "tenant" (client_id) do usuário para isolamento de dados.
// Retorna string (cliente) ou null (usuário da agência). Faz fallback ao banco
// para tokens antigos (emitidos antes do campo entrar no JWT).
async function getScopeClientId(req) {
    if (!req.user)
        return null;
    if (req.user.client_id !== undefined)
        return req.user.client_id ?? null;
    const u = await prisma_1.default.user.findUnique({
        where: { id: req.user.id },
        select: { member_of_client_id: true, is_client_admin: true },
    });
    const cid = u?.member_of_client_id ?? null;
    req.user.client_id = cid;
    req.user.is_client_admin = !!u?.is_client_admin;
    return cid;
}
// Exige que o usuário seja de um cliente (produto CRM). Bloqueia agência.
const requireClientUser = async (req, res, next) => {
    const cid = await getScopeClientId(req);
    if (!cid) {
        res.status(403).json({ error: "Acesso restrito a usuários de cliente." });
        return;
    }
    next();
};
exports.requireClientUser = requireClientUser;
// Exige que o usuário seja o admin do próprio cliente (gerencia a equipe dele).
const requireClientAdmin = async (req, res, next) => {
    const cid = await getScopeClientId(req);
    if (!cid || !req.user?.is_client_admin) {
        res.status(403).json({ error: "Acesso restrito ao administrador do cliente." });
        return;
    }
    next();
};
exports.requireClientAdmin = requireClientAdmin;
// Bloqueia cargos específicos (ex.: DESIGNER não acessa cofre/financeiro).
const denyRoles = (...roles) => (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
        res.status(403).json({ error: "Seu cargo não tem acesso a este recurso." });
        return;
    }
    next();
};
exports.denyRoles = denyRoles;
//# sourceMappingURL=auth.js.map