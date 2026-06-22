import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { ArrowLeft, Loader2, ListTodo, CalendarClock, TrendingUp, TrendingDown, Wallet } from "lucide-react";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DashQui = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/dashqui").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const tasks = data?.tasks || [];
  const posts = data?.posts || [];
  const fin = data?.finance || {};
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">DashQui</h1>
          <p className="text-muted-foreground text-sm capitalize">{hoje}</p>
        </div>
      </div>

      {/* Finanças do dia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
          <p className="text-xl font-bold text-foreground">{brl(fin.recebido_hoje)}</p>
          <p className="text-[11px] text-muted-foreground">Recebido hoje</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <Wallet className="w-5 h-5 text-orange-400 mb-2" />
          <p className="text-xl font-bold text-foreground">{brl(fin.a_receber_hoje)}</p>
          <p className="text-[11px] text-muted-foreground">A receber hoje</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <TrendingDown className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-xl font-bold text-foreground">{brl(fin.despesas_hoje)}</p>
          <p className="text-[11px] text-muted-foreground">Despesas hoje</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tarefas do dia */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <ListTodo className="w-4 h-4 text-blue-400" /> Tarefas do dia ({tasks.length})
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {tasks.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Nada pendente hoje. 🎉</p>}
            {tasks.map((t: any) => {
              const atrasada = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <div key={t.id} className="bg-secondary/40 rounded-lg px-3 py-2">
                  <p className="text-sm text-foreground">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.client?.name || "—"}{t.responsible?.name ? ` · ${t.responsible.name}` : ""}
                    {atrasada && <span className="text-red-400"> · atrasada</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Posts agendados */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-purple-400" /> Próximos posts ({posts.length})
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {posts.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Nenhum post agendado.</p>}
            {posts.map((p: any) => (
              <div key={p.id} className="bg-secondary/40 rounded-lg px-3 py-2">
                <p className="text-sm text-foreground">{p.title || `${p.type} · ${p.platform}`}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.client?.name || "—"} · {new Date(p.scheduled_date).toLocaleDateString("pt-BR")} · {p.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashQui;
