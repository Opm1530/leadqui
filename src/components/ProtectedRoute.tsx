import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Se true, bloqueia usuários com role CLIENT (redireciona para /viewqui) */
  staffOnly?: boolean;
}

const ProtectedRoute = ({ children, staffOnly = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Clientes não acessam rotas internas da agência
  if (staffOnly && user.role === "CLIENT") {
    return <Navigate to="/viewqui" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
