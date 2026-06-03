import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useModule } from "@/contexts/ModuleContext";
import {
  BarChart3,
  Settings,
  Users,
  Hash,
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Share2,
  Database,
  ArrowLeft,
  Kanban,
  Rocket,
  ShieldAlert,
  Zap,
  DollarSign,
  Receipt,
  TrendingDown,
  LineChart,
  CalendarDays,
  MousePointerClick,
  Wrench,
  Bell,
  Landmark,
  LayoutTemplate,
  Instagram,
  BarChart2,
  Link2,
  Lock,
} from "lucide-react";

const leadquiItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/crm", icon: MessageSquare, label: "CRM" },
  { to: "/tags", icon: Hash, label: "Tags" },
  { to: "/clients", icon: Briefcase, label: "Clientes" },
  { to: "/extractions", icon: Database, label: "Extração de Leads" },
  { to: "/campaigns", icon: Share2, label: "Campanhas" },
  { to: "/instances", icon: Zap,  label: "Instâncias"        },
  { to: "/vault",     icon: Lock, label: "Cofre de Senhas"   },
  { to: "/settings",  icon: Settings, label: "Configurações" },
];

const tasquiItems = [
  { to: "/tasqui", icon: Kanban, label: "Operações" },
  { to: "/tasqui/calendar", icon: CalendarDays, label: "Calendário Editorial" },
  { to: "/tasqui/traffic", icon: MousePointerClick, label: "Tráfego Pago" },
  { to: "/tasqui/jobs", icon: Wrench, label: "Jobs" },
  { to: "/tasqui/templates", icon: LayoutTemplate, label: "Templates" },
  { to: "/tasqui-stats", icon: BarChart3, label: "Estatísticas" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const teamquiItems = [
  { to: "/teamqui", icon: Users, label: "Membros da Equipe" },
  { to: "/roles", icon: ShieldAlert, label: "Cargos e Permissões" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const techquiItems = [
  { to: "/techqui",          icon: Link2,        label: "Conexões Meta"    },
  { to: "/techqui/instagram",icon: Instagram,    label: "Instagram"        },
  { to: "/techqui/ads",      icon: BarChart2,    label: "Meta Ads"         },
  { to: "/techqui/comments", icon: MessageSquare,label: "Auto-reply"       },
  { to: "/techqui/settings", icon: Settings,     label: "Configurações"    },
];

const cashquiItems = [
  { to: "/cashqui", icon: DollarSign, label: "Dashboard Financeiro" },
  { to: "/cashqui/invoices", icon: Receipt, label: "Faturas" },
  { to: "/cashqui/expenses", icon: TrendingDown, label: "Despesas" },
  { to: "/cashqui/fixed-expenses", icon: Bell, label: "Despesas Fixas" },
  { to: "/cashqui/inter", icon: Landmark, label: "Banco Inter" },
  { to: "/cashqui/report", icon: LineChart, label: "Relatório" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeModule } = useModule();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isOperator = user?.role === "OPERATOR";

  const getModuleTitle = () => {
    switch (activeModule) {
      case "tasqui": return "Tasqui";
      case "teamqui": return "Teamqui";
      case "cashqui": return "CashQui";
      case "techqui": return "TechQui";
      default: return "Leadqui";
    }
  };

  const getMenuItems = () => {
    let items = [];
    switch (activeModule) {
      case "tasqui":  items = [...tasquiItems];  break;
      case "teamqui": items = [...teamquiItems]; break;
      case "cashqui": items = [...cashquiItems]; break;
      case "techqui": items = [...techquiItems]; break;
      default: items = [...leadquiItems]; break;
    }
    
    // Filtrar configurações para operadores
    if (isOperator) {
      return items.filter(item => item.to !== "/settings");
    }
    
    return items;
  };

  const menuItems = getMenuItems();

  return (
    <div className="w-64 bg-sidebar border-r border-border h-screen sticky top-0 flex flex-col shadow-2xl">
      <div className="p-6">
        <div className="flex flex-col gap-1 mb-8">
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground opacity-50">Ecossistema Pequi</span>
          <h2 className="text-xl font-black tracking-tighter text-foreground flex items-center gap-2">
            <div className={`w-2 h-6 rounded-full ${activeModule === 'tasqui' ? 'bg-blue-500' : activeModule === 'teamqui' ? 'bg-purple-500' : activeModule === 'cashqui' ? 'bg-green-500' : 'bg-orange-500'}`} />
            {getModuleTitle()}
          </h2>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                    isActive
                      ? "bg-white/10 text-white shadow-lg"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? (activeModule === 'tasqui' ? 'text-blue-500' : activeModule === 'teamqui' ? 'text-purple-500' : activeModule === 'cashqui' ? 'text-green-500' : 'text-orange-500') : ""}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-white/5 space-y-2">
        <button
          onClick={() => navigate("/hub")}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-white transition-all transform hover:-translate-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Hub
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
