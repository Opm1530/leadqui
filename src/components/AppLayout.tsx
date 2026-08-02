import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import AppHeader from "./AppHeader";
import { useModule } from "@/contexts/ModuleContext";

const AppLayout = () => {
  const location = useLocation();
  const { setActiveModule } = useModule();

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
        <AppHeader extra={<NotificationBell />} />
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
