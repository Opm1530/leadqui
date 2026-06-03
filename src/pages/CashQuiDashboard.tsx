import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useModule } from "@/contexts/ModuleContext";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface DashData {
  mrr: number;
  paid_this_month: number;
  pending_total: number;
  overdue_total: number;
  expenses_this_month: number;
  profit_this_month: number;
  active_clients: number;
  overdue_clients: number;
}

const CashQuiDashboard = () => {
  const { setActiveModule } = useModule();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveModule("cashqui");
    api.get("/api/cashqui/dashboard")
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = data
    ? [
        { label: "MRR", value: fmt(data.mrr), icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10" },
        { label: "Recebido este mês", value: fmt(data.paid_this_month), icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        { label: "A receber", value: fmt(data.pending_total), icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
        { label: "Em atraso", value: fmt(data.overdue_total), icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
        { label: "Despesas do mês", value: fmt(data.expenses_this_month), icon: TrendingDown, color: "text-orange-400", bg: "bg-orange-500/10" },
        { label: "Lucro do mês", value: fmt(data.profit_this_month), icon: TrendingUp, color: data.profit_this_month >= 0 ? "text-green-400" : "text-red-400", bg: data.profit_this_month >= 0 ? "bg-green-500/10" : "bg-red-500/10" },
        { label: "Clientes ativos", value: String(data.active_clients), icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10" },
        { label: "Clientes inadimplentes", value: String(data.overdue_clients), icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral das finanças da agência</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{card.label}</p>
                <p className={`text-xl font-black mt-0.5 ${card.color}`}>{card.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {data && data.overdue_clients > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          Você tem <strong>{data.overdue_clients}</strong> cliente(s) inadimplente(s). Acesse a aba de Faturas para gerenciar.
        </motion.div>
      )}
    </div>
  );
};

export default CashQuiDashboard;
