import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, MessageSquare, Rocket, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalLeads: 0, totalClients: 0, totalCampaigns: 0, leadsThisMonth: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [dashData, leadsData, campaignsData] = await Promise.all([
          api.get("/api/dashboard"),
          api.get("/api/leads?limit=5"),
          api.get("/api/campaigns"),
        ]);
        setStats(dashData);
        setRecentLeads(leadsData.leads || []);
        setRecentCampaigns((campaignsData.campaigns || []).slice(0, 5));
      } catch (error) {
        console.error("Dashboard error:", error);
      }
    };
    load();
  }, [user]);

  const cards = [
    { label: "Total de Leads", value: stats.totalLeads.toLocaleString(), icon: Users },
    { label: "Leads este mês", value: stats.leadsThisMonth.toString(), icon: TrendingUp },
    { label: "Campanhas", value: stats.totalCampaigns.toString(), icon: Rocket },
    { label: "Clientes", value: stats.totalClients.toString(), icon: MessageSquare },
  ];

  const statusColors: Record<string, string> = {
    NOVO: "bg-primary/20 text-primary",
    CONTATADO: "bg-warning/20 text-warning",
    QUALIFICADO: "bg-blue-500/20 text-blue-400",
    CONVERTIDO: "bg-success/20 text-success",
    PERDIDO: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das suas métricas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <card.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Últimos Leads</h3>
          <div className="space-y-3">
            {recentLeads.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda.</p>
            )}
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground">{lead.telefone || "Sem telefone"} · {lead.origem}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[lead.status] || "bg-primary/20 text-primary"}`}>
                  {lead.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Campanhas Recentes</h3>
          <div className="space-y-3">
            {recentCampaigns.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
            )}
            {recentCampaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.total_leads} leads</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === "FINALIZADA" ? "bg-success/20 text-success" : "bg-primary/20 text-primary"}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
