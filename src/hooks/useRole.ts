import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "ADMIN" | "MANAGER" | "OPERATOR" | "CLIENT" | "guest";

// Com JWT, o role já vem no token — sem necessidade de consultar banco
export const useRole = () => {
  const { user, loading } = useAuth();

  const role: UserRole = user?.role ?? "guest";

  return {
    role,
    loading,
    isAdmin: role === "ADMIN",
    isManager: role === "MANAGER",
    isOperator: role === "OPERATOR",
    isClient: role === "CLIENT",
  };
};
