import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Rocket,
  Smartphone,
  Search,
  Zap,
  LogOut,
  Settings,
  Kanban,
  Tag,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: Users, label: "Meus Leads" },
  { to: "/tags", icon: Tag, label: "Tags" },
  { to: "/crm", icon: Kanban, label: "CRM" },
  { to: "/campaigns", icon: Rocket, label: "Campanhas" },
  { to: "/instances", icon: Smartphone, label: "Instâncias" },
  { to: "/extraction", icon: Search, label: "Extração" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center gradient-button text-sm">
          <img src="/logo.png" alt="Logo" className="w-6 h-6" />
        </div>
        <span className="text-lg font-bold text-foreground">LeadQui</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={`sidebar-link ${location.pathname === item.to ? "active" : ""}`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button onClick={handleLogout} className="sidebar-link w-full text-destructive hover:text-destructive">
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
