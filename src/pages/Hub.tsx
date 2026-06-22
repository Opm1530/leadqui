import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, LayoutDashboard, DollarSign, Rocket, MessageSquare, ChevronRight, LogOut, ShieldAlert, Users, Sparkles, Settings as SettingsIcon, Inbox, Star, Building2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useModule } from "@/contexts/ModuleContext";

const Hub = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role, isAdmin, loading: roleLoading } = useRole();
  const { setActiveModule } = useModule();
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (role === "CLIENT") {
      setLoadingProfile(true);
      api.get("/api/me/client-profile")
        .then(res => setClientProfile(res.client))
        .catch(() => {})
        .finally(() => setLoadingProfile(false));
    }
  }, [role]);

  const allApps = [
    {
      id: "leadqui",
      name: "LeadQui",
      description: "Sistema completo de captação e gestão de leads e CRM.",
      icon: LayoutDashboard,
      color: "from-blue-500 to-indigo-600",
      route: "/dashboard",
      serviceRequired: "CRM",
      adminOnly: false,
    },
    {
      id: "teamqui",
      name: "TeamQui",
      description: "Gestão de equipe, permissões e controle de acessos.",
      icon: Users,
      color: "from-red-500 to-orange-600",
      route: "/teamqui",
      adminOnly: true,
    },
    {
      id: "cashqui",
      name: "CashQui",
      description: "Controle financeiro, faturas e faturamento simplificado.",
      icon: DollarSign,
      color: "from-green-500 to-emerald-600",
      route: "/cashqui",
      serviceRequired: "Finanças",
      adminOnly: false,
    },
    {
      id: "assistente",
      name: "Assistente",
      description: "Agente de IA que executa ações no ecossistema por comando de voz/texto.",
      icon: Sparkles,
      color: "from-violet-500 to-fuchsia-600",
      route: "/assistente",
      adminOnly: false,
    },
    {
      id: "demandas",
      name: "Caixa de Demandas",
      description: "Demandas captadas pela IA nos grupos de WhatsApp dos clientes. Vire tarefa com 1 clique.",
      icon: Inbox,
      color: "from-amber-500 to-orange-600",
      route: "/demandas",
      adminOnly: false,
    },
    {
      id: "influencers",
      name: "Influencers",
      description: "Cadastre influenciadoras, atrele a clientes e acompanhe entregas e vendas geradas.",
      icon: Star,
      color: "from-pink-500 to-rose-600",
      route: "/influencers",
      adminOnly: false,
    },
    {
      id: "clientes",
      name: "Clientes",
      description: "Perfil de cada cliente com tudo centralizado: finanças, tarefas, tráfego, social, senhas e dados.",
      icon: Building2,
      color: "from-orange-500 to-amber-600",
      route: "/clientes",
      adminOnly: false,
    },
    {
      id: "dashqui",
      name: "DashQui",
      description: "Visão geral do dia: tarefas, posts agendados e movimentações financeiras.",
      icon: LayoutDashboard,
      color: "from-teal-500 to-cyan-600",
      route: "/dashqui",
      adminOnly: false,
    },
    {
      id: "viewqui",
      name: "ViewQui",
      description: "Portal exclusivo do cliente: tarefas, calendário, tráfego e faturas.",
      icon: MessageSquare,
      color: "from-indigo-500 to-purple-600",
      route: "/viewqui",
      adminOnly: false,
    },
  ];

  const availableApps = allApps.filter(app => {
    if (isAdmin) return true;
    if (role === "OPERATOR") return ["clientes", "dashqui"].includes(app.id);
    if (app.adminOnly) return false;
    if (!app.serviceRequired) return true;
    
    // Check if client has this service active
    if (role === "CLIENT" && clientProfile) {
      return clientProfile.services?.some((s: any) => s.service === app.serviceRequired && s.status === "ATIVO");
    }
    
    // Show others as preview for now, but they will redirect to coming-soon anyway
    return true; 
  });

  // CLIENT não deve ver o Hub — vai direto ao portal
  if (!roleLoading && role === "CLIENT") {
    return <Navigate to="/viewqui" replace />;
  }

  const loading = roleLoading || loadingProfile;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 overflow-hidden relative font-sans">
      {/* Decorative ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-16 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-400 to-yellow-400 shadow-lg shadow-orange-500/20">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Pequi Digital
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Usuário Logado</p>
            <p className="text-sm text-gray-300 font-medium">{user?.email}</p>
          </div>
          {user?.role !== "CLIENT" && (
            <button
              onClick={() => navigate("/settings")}
              title="Configurações"
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:bg-white/5 transition-all text-gray-400 hover:text-white"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center md:text-left"
        >
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
            Seja bem-vindo, <br className="md:hidden" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-300">
              {user?.name || user?.email?.split('@')[0] || "Usuário"}
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Bem-vindo ao centro de comando da <span className="text-white font-semibold">Pequi Digital</span>. 
            Selecione uma de suas ferramentas disponíveis abaixo para iniciar seu trabalho.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium animate-pulse">Sincronizando permissões...</p>
          </div>
        ) : availableApps.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-md mx-auto text-center p-10 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-xl"
          >
            <ShieldAlert className="w-16 h-16 text-orange-500 mx-auto mb-6" />
            <h3 className="text-2xl font-bold mb-3">Acesso Pendente</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Seu e-mail <strong>{user?.email}</strong> ainda não possui aplicações liberadas. 
              Entre em contato com o suporte para ativar o seu acesso.
            </p>
            <button 
              onClick={signOut}
              className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-bold text-sm"
            >
              Tentar com outra conta
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {availableApps.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => { setActiveModule(app.id as any); navigate(app.route); }}
              className="group relative cursor-pointer"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-blue-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative bg-[#111]/80 backdrop-blur-xl border border-white/10 p-10 rounded-[2rem] h-full flex flex-col justify-between hover:bg-[#151515] transition-all hover:border-white/20 group-active:scale-[0.98]">
                <div>
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/10`}>
                    <app.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-3xl font-bold tracking-tight">{app.name}</h3>
                    {app.adminOnly && (
                      <span className="text-[9px] uppercase font-black py-1 px-2.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        Master
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed mb-8">
                    {app.description}
                  </p>
                </div>
                
                <div className="pt-6 border-t border-white/5 flex items-center justify-between group-hover:text-white text-gray-400 transition-colors">
                  <span className="text-sm font-bold uppercase tracking-wider">Entrar na Ferramenta</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          </div>
        )}
      </main>

      <footer className="mt-24 pb-12 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-medium z-10 relative">
        &copy; 2024 Pequi Digital Hub · Intelligence for business
      </footer>
    </div>
  );
};

export default Hub;
