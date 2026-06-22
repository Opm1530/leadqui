import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { useModule } from "@/contexts/ModuleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Settings, LogOut } from "lucide-react";

const AppLayout = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { setActiveModule } = useModule();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/tasqui") || path.startsWith("/projects")) {
      setActiveModule("tasqui");
    } else if (path.startsWith("/teamqui") || path.startsWith("/roles")) {
      setActiveModule("teamqui");
    } else if (path.startsWith("/cashqui")) {
      setActiveModule("cashqui");
    } else if (
      path.startsWith("/dashboard") ||
      path.startsWith("/leads") ||
      path.startsWith("/crm") ||
      path.startsWith("/tags") ||
      path.startsWith("/clients") ||
      path.startsWith("/campaigns") ||
      path.startsWith("/instances")
    ) {
      setActiveModule("leadqui");
    }
  }, [location.pathname, setActiveModule]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-x-hidden min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md">
          <button
            onClick={() => navigate("/hub")}
            className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black tracking-widest uppercase text-muted-foreground">Pequi Digital</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.name || user?.email}</span>
            <NotificationBell />
            <button onClick={() => navigate("/settings")} title="Configurações"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => signOut()} title="Sair"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
