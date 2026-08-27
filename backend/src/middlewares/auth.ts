import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    client_id?: string | null;      // cliente (tenant) do usuário; null/undefined = agência
    is_client_admin?: boolean;
  };
}

export const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      role: string;
      client_id?: string | null;
      is_client_admin?: boolean;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }
  next();
};

// Permite apenas equipe interna (ADMIN, MANAGER, OPERATOR).
// Bloqueia clientes externos (CLIENT) de acessar dados compartilhados da empresa.
export const requireStaff = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const staffRoles = ["ADMIN", "MANAGER", "OPERATOR", "DESIGNER"];
  if (!req.user || !staffRoles.includes(req.user.role)) {
    res.status(403).json({ error: "Acesso restrito à equipe interna" });
    return;
  }
  next();
};

// Resolve o "tenant" (client_id) do usuário para isolamento de dados.
// Retorna string (cliente) ou null (usuário da agência). Faz fallback ao banco
// para tokens antigos (emitidos antes do campo entrar no JWT).
export async function getScopeClientId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;
  if (req.user.client_id !== undefined) return req.user.client_id ?? null;
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { member_of_client_id: true, is_client_admin: true },
  });
  const cid = (u as any)?.member_of_client_id ?? null;
  req.user.client_id = cid;
  req.user.is_client_admin = !!(u as any)?.is_client_admin;
  return cid;
}

// Exige que o usuário seja de um cliente (produto CRM). Bloqueia agência.
export const requireClientUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const cid = await getScopeClientId(req);
  if (!cid) { res.status(403).json({ error: "Acesso restrito a usuários de cliente." }); return; }
  next();
};

// Bloqueia cargos específicos (ex.: DESIGNER não acessa cofre/financeiro).
export const denyRoles = (...roles: string[]) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && roles.includes(req.user.role)) {
    res.status(403).json({ error: "Seu cargo não tem acesso a este recurso." });
    return;
  }
  next();
};
