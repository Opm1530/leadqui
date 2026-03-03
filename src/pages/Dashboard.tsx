import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, MessageSquare, Rocket, TrendingUp } from "lucide-react";
import { firestoreService } from "@/lib/firestore";
import { where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsHoje, setLeadsHoje] = useState(0);
  const [campanhasAtivas, setCampanhasAtivas] = useState(0);
  const [disparosHoje, setDisparosHoje] = useState(0);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fetchData = async () => {
      try {
        const [totalCount, hojeCount, ativasCount, recentL, recentC] = await Promise.all([
          firestoreService.count("leads"),
          firestoreService.count("leads", undefined, [where("created_at", ">=", today)]),
          firestoreService.count("campanhas", undefined, [where("status", "==", "em andamento")]),
          firestoreService.list("leads", undefined, [], null, 20),
          firestoreService.list("campanhas", undefined, [], null, 20)
        ]);

        // Sort client-side
        const sortedLeads = [...recentL].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ).slice(0, 5);

        const sortedCampaigns = [...recentC].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ).slice(0, 5);

        setTotalLeads(totalCount);
        setLeadsHoje(hojeCount);
        setCampanhasAtivas(ativasCount);
        setRecentLeads(sortedLeads);
        setRecentCampaigns(sortedCampaigns);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchData();
  }, [user]);

  const stats = [
    { label: "Total de Leads", value: totalLeads.toLocaleString(), icon: Users },
    { label: "Leads Hoje", value: leadsHoje.toString(), icon: TrendingUp },
    { label: "Disparos Hoje", value: disparosHoje.toString(), icon: MessageSquare },
    { label: "Campanhas Ativas", value: campanhasAtivas.toString(), icon: Rocket },
  ];

  const statusColors: Record<string, string> = {
    novo: "bg-primary/20 text-primary",
    contatado: "bg-warning/20 text-warning",
    respondeu: "bg-success/20 text-success",
    convertido: "bg-success/20 text-success",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das suas métricas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
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
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === "finalizada" ? "bg-success/20 text-success" : "bg-primary/20 text-primary"
                  }`}>
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
