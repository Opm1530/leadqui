import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Settings, LogOut, LayoutGrid } from "lucide-react";

// Cabeçalho padrão para páginas fora do AppLayout (Hub, DashQui, Clientes, etc.)
const HubLayout = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
          <Zap className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-black tracking-widest uppercase text-muted-foreground">Pequi Digital</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block mr-1">{user?.name || user?.email}</span>
          <button onClick={() => navigate("/hub")} title="Hub" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/settings")} title="Configurações" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => signOut()} title="Sair" className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
};

export default HubLayout;
