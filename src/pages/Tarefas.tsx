import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Search, Check, Trash2, ListTodo, Rows3, LayoutList } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  PENDENTE:     { label: "Pendente", color: "bg-yellow-500/15 text-yellow-300" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-300" },
  REVISAO:      { label: "Revisão", color: "bg-purple-500/15 text-purple-300" },
  CONCLUIDO:    { label: "Concluído", color: "bg-green-500/15 text-green-300" },
};
const PRIO: Record<string, string> = { BAIXA: "text-muted-foreground", MEDIA: "text-blue-400", ALTA: "text-orange-400", URGENTE: "text-red-400" };

const Tarefas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fClient, setFClient] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [view, setView] = useState<"lista" | "status">("lista");

  const load = () => {
    setLoading(true);
    api.get("/api/tasqui/tasks").then(setTasks).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const clientes = useMemo(() => Array.from(new Map(tasks.filter(t => t.client).map(t => [t.client_id, t.client])).values()), [tasks]);
  const responsaveis = useMemo(() => Array.from(new Map(tasks.filter(t => t.responsible?.id).map(t => [t.responsible.id, t.responsible])).values()), [tasks]);

  const filtered = tasks.filter(t => {
    const s = search.toLowerCase();
    const mS = !s || t.title.toLowerCase().includes(s) || t.client?.name?.toLowerCase().includes(s);
    const mC = fClient === "all" || t.client_id === fClient;
    const mR = fResp === "all" || (fResp === "none" ? !t.responsible_id : t.responsible_id === fResp);
    const mSt = fStatus === "all" || t.status === fStatus;
    return mS && mC && mR && mSt;
  });

  const toggle = async (t: any) => {
    const status = t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO";
    setTasks(p => p.map(x => x.id === t.id ? { ...x, status } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status }).catch(() => load());
  };
  const remover = async (t: any) => {
    if (!confirm(`Excluir "${t.title}"?`)) return;
    setTasks(p => p.filter(x => x.id !== t.id));
    await api.delete(`/api/tasqui/tasks/${t.id}`).catch(() => { toast({ title: "Erro ao excluir", variant: "destructive" }); load(); });
  };

  const Row = (t: any) => {
    const done = t.status === "CONCLUIDO";
    const atrasada = !done && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
    return (
      <div key={t.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2.5">
        <button onClick={() => toggle(t)} className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${done ? "bg-green-600 border-green-600" : "border-muted-foreground/40 hover:border-green-500"}`}>
          {done && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {t.client?.name || "—"}{t.responsible?.name ? ` · ${t.responsible.name}` : ""}
            {t.due_date && <span className={atrasada ? "text-red-400" : ""}> · {new Date(t.due_date).toLocaleDateString("pt-BR")}{atrasada ? " (atrasada)" : ""}</span>}
          </p>
        </div>
        <span className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS[t.status]?.color}`}>{STATUS[t.status]?.label}</span>
        <span className={`hidden md:inline text-[10px] font-bold ${PRIO[t.priority]}`}>{t.priority}</span>
        <button onClick={() => remover(t)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/dashqui")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <ListTodo className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Todas as tarefas</h1>
          <p className="text-muted-foreground text-sm">{filtered.filter(t => t.status !== "CONCLUIDO").length} pendente(s) · {filtered.length} no total</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView("lista")} className={`px-2.5 h-9 ${view === "lista" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}><LayoutList className="w-4 h-4" /></button>
          <button onClick={() => setView("status")} className={`px-2.5 h-9 ${view === "status" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}><Rows3 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar tarefa..." className="pl-9 bg-secondary border-border h-9 w-56" />
        </div>
        <Select value={fClient} onValueChange={setFClient}>
          <SelectTrigger className="w-40 bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos clientes</SelectItem>{clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fResp} onValueChange={setFResp}>
          <SelectTrigger className="w-40 bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos responsáveis</SelectItem><SelectItem value="none">Sem responsável</SelectItem>{responsaveis.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36 bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos status</SelectItem>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      : filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa com esses filtros.</p>
      : view === "lista" ? (
        <div className="space-y-1.5">{filtered.map(Row)}</div>
      ) : (
        <div className="space-y-5">
          {Object.keys(STATUS).map(st => {
            const list = filtered.filter(t => t.status === st);
            if (list.length === 0) return null;
            return (
              <div key={st}>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{STATUS[st].label} ({list.length})</p>
                <div className="space-y-1.5">{list.map(Row)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tarefas;
