import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import { useModule } from "@/contexts/ModuleContext";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MonthData {
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
}

const CashQuiReport = () => {
  const { setActiveModule } = useModule();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setActiveModule("cashqui"); }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/cashqui/report?year=${year}`)
      .then(d => setData(d.months || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const chartData = data.map(m => ({
    name: MONTHS[m.month - 1],
    Receita: m.revenue,
    Despesas: m.expenses,
    Lucro: m.profit,
  }));

  const totalRevenue = data.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = data.reduce((s, m) => s + m.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const bestMonth = [...data].sort((a, b) => b.profit - a.profit)[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Relatório Anual</h1>
          <p className="text-sm text-muted-foreground mt-1">Receita, despesas e lucro por mês</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28 bg-secondary border-border h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo anual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Receita Total", value: fmt(totalRevenue), color: "text-green-400" },
          { label: "Despesas Total", value: fmt(totalExpenses), color: "text-red-400" },
          { label: "Lucro Total", value: fmt(totalProfit), color: totalProfit >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{card.label}</p>
            <p className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Gráfico */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-card border border-border animate-pulse" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any) => fmt(v)}
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "#fff", fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              <Bar dataKey="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Tabela mensal */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">Mês</th>
              <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">Receita</th>
              <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">Despesas</th>
              <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={m.month} className={`border-b border-border/50 transition-colors hover:bg-white/5 ${bestMonth?.month === m.month ? "bg-green-500/5" : ""}`}>
                <td className="px-5 py-3 font-bold text-foreground">{MONTHS[m.month - 1]}</td>
                <td className="px-5 py-3 text-right text-green-400 font-medium">{fmt(m.revenue)}</td>
                <td className="px-5 py-3 text-right text-red-400 font-medium">{fmt(m.expenses)}</td>
                <td className={`px-5 py-3 text-right font-black ${m.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(m.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashQuiReport;
