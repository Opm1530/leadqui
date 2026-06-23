import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ListTodo, CalendarClock, TrendingUp, TrendingDown, Wallet, Check } from "lucide-react";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DashQui = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState(false);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [filterUser, setFilterUser] = useState("all");

  useEffect(() => {
    api.get("/api/dashqui").then(d => { setData(d); setAllTasks(d.tasks || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Admin vê todas + filtra; não-admin vê só as próprias
  const visibleTasks = allTasks.filter((t: any) => {
    if (!isAdmin) return t.responsible?.id === user?.id;
    if (filterUser === "all") return true;
    if (filterUser === "none") return !t.responsible?.id;
    return t.responsible?.id === filterUser;
  });

  const responsaveis = Array.from(new Map(allTasks.filter((t: any) => t.responsible?.id).map((t: any) => [t.responsible.id, t.responsible])).values());

  const concluir = async (t: any) => {
    setAllTasks(p => p.map(x => x.id === t.id ? { ...x, status: x.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO" } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status: t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO" }).catch(() => {});
  };

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">DashQui</h1>
          <p className="text-muted-foreground text-sm capitalize">{hoje}</p>
        </div>
        <button onClick={() => setTaskModal(true)} title="Tarefas do dia"
          className="relative p-2.5 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
          <ListTodo className="w-5 h-5" />
          {visibleTasks.filter(t => t.status !== "CONCLUIDO").length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {visibleTasks.filter(t => t.status !== "CONCLUIDO").length}
            </span>
          )}
        </button>
      </div>

      {/* Modal tarefas do dia */}
      <Dialog open={taskModal} onOpenChange={setTaskModal}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tarefas do dia</DialogTitle></DialogHeader>
          {isAdmin && (
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                <SelectItem value="none">Sem responsável</SelectItem>
                {responsaveis.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="space-y-1.5 pt-2">
            {visibleTasks.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa para hoje. 🎉</p>}
            {visibleTasks.map((t: any) => {
              const done = t.status === "CONCLUIDO";
              return (
                <div key={t.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                  <button onClick={() => concluir(t)} className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${done ? "bg-green-600 border-green-600" : "border-muted-foreground/40 hover:border-green-500"}`}>
                    {done && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{t.client?.name || "—"}{t.responsible?.name ? ` · ${t.responsible.name}` : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
