import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { askInvoiceReceipt, openInvoiceReceipt } from "@/lib/receipts";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ListTodo, CalendarClock, TrendingUp, TrendingDown, Wallet, Check, Paperclip, Clapperboard, Plus, AlertTriangle, X, ChevronRight } from "lucide-react";
import { confirm } from "@/components/ConfirmDialog";
import { CONTENT_STATUS, typeLabel } from "@/lib/editorial";
import { TaskDetailModal } from "@/components/TaskDetailModal";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DashQui = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, role } = useRole();
  const canSeeAll = isAdmin || role === "MANAGER";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const loadAlerts = () => api.get("/api/alerts").then(d => setAlerts(d.alerts || [])).catch(() => {});
  const reloadTasks = () => api.get("/api/dashqui").then(d => setAllTasks(d.tasks || [])).catch(() => {});
  useEffect(() => {
    api.get("/api/dashqui").then(d => { setData(d); setAllTasks(d.tasks || []); }).catch(() => {}).finally(() => setLoading(false));
    api.get("/api/teamqui").then(d => setTeam(Array.isArray(d) ? d : (d.team || []))).catch(() => {});
    loadAlerts();
  }, []);

  const dispensarAlerta = async (a: any) => {
    setAlerts(p => p.filter(x => x.id !== a.id));
    if (!a.dynamic) await api.post(`/api/alerts/${a.id}/resolve`, {}).catch(() => {});
  };

  // Minhas tarefas (checklist do dashboard, para qualquer responsável)
  const myTasks = allTasks.filter((t: any) => t.responsible?.id === user?.id);

  const concluir = async (t: any) => {
    setAllTasks(p => p.map(x => x.id === t.id ? { ...x, status: x.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO" } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status: t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO" }).catch(() => {});
  };

  // Tarefa rápida do dia: só o título → responsável = você, prazo = hoje, sem cliente.
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const addQuick = async () => {
    const title = quickTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const t = await api.post("/api/tasqui/tasks", { title, quick: true });
      setAllTasks(p => [{ ...t, responsible: { id: user?.id, name: user?.name }, status: "PENDENTE" }, ...p]);
      setQuickTitle("");
    } catch { /* */ } finally { setAdding(false); }
  };

  const reloadFinance = () => api.get("/api/dashqui").then(setData).catch(() => {});
  const marcarPago = async (inv: any) => {
    try {
      await api.put(`/api/cashqui/invoices/${inv.id}`, { status: "PAGO" });
      await askInvoiceReceipt(inv.id).catch(() => {});
      reloadFinance();
    } catch { /* */ }
  };
  const desmarcarPago = async (inv: any) => {
    const aviso = inv.receipt_key ? "Ao desmarcar, o comprovante anexado será EXCLUÍDO. Continuar?" : "Desmarcar esta fatura como paga?";
    if (!(await confirm({ title: "Desmarcar pagamento", description: aviso, danger: !!inv.receipt_key }))) return;
    if (inv.receipt_key) await api.delete(`/api/cashqui/invoices/${inv.id}/receipt`).catch(() => {});
    await api.put(`/api/cashqui/invoices/${inv.id}`, { status: "PENDENTE", paid_date: null }).catch(() => {});
    reloadFinance();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const posts = data?.posts || [];
  const editorial = data?.editorial || [];
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
        {(() => {
          const list = canSeeAll ? allTasks : myTasks;
          const pend = list.filter(t => t.status !== "CONCLUIDO").length;
          return (
          <button onClick={() => navigate("/tarefas")}
            className="flex items-center gap-2 px-3 h-10 rounded-xl bg-secondary border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
            <ListTodo className="w-4 h-4" /> {canSeeAll ? "Todas as tarefas" : "Minhas tarefas"}
            {pend > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">{pend}</span>
            )}
          </button>
          );
        })()}
      </div>

      {/* Central de alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map(a => {
            const sev = a.severity === "CRITICAL"
              ? { ring: "border-red-500/40 bg-red-500/10", dot: "text-red-400" }
              : a.severity === "INFO"
                ? { ring: "border-blue-500/40 bg-blue-500/10", dot: "text-blue-400" }
                : { ring: "border-orange-500/40 bg-orange-500/10", dot: "text-orange-400" };
            return (
              <div key={a.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${sev.ring}`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 ${sev.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
                </div>
                {a.link && (
                  <button onClick={() => navigate(a.link)} title="Abrir" className="shrink-0 text-muted-foreground hover:text-foreground"><ChevronRight className="w-4 h-4" /></button>
                )}
                <button onClick={() => dispensarAlerta(a)} title="Dispensar" className="shrink-0 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}


      {/* Finanças do dia (só admin) */}
      {isAdmin && (
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
      )}

      {/* Recebimentos de hoje — marcar pago (só admin) */}
      {isAdmin && (fin.invoices_due || []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-orange-400" /> Recebimentos de hoje
          </h2>
          <div className="space-y-1.5">
            {fin.invoices_due.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{inv.client?.name || inv.client_name_snapshot || "Cliente"}</p>
                  <p className="text-[11px] text-muted-foreground">{inv.description || "Fatura"}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{brl(inv.amount)}</span>
                {inv.status === "PAGO" ? (
                  <div className="flex items-center gap-1">
                    {inv.receipt_key && <button onClick={() => openInvoiceReceipt(inv.id)} title="Ver comprovante" className="text-green-400 hover:text-green-300 p-1"><Paperclip className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => desmarcarPago(inv)} className="text-[10px] px-2 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground">Desmarcar</button>
                  </div>
                ) : (
                  <button onClick={() => marcarPago(inv)} className="text-[10px] px-2 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-green-400">Cliente pagou</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Minhas tarefas do dia (checklist) */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <ListTodo className="w-4 h-4 text-blue-400" /> Minhas tarefas do dia ({myTasks.filter(t => t.status !== "CONCLUIDO").length})
          </h2>
          {/* Adicionar tarefa rápida (só título) */}
          <div className="flex items-center gap-2 mb-2">
            <input
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addQuick(); }}
              placeholder="Adicionar tarefa rápida do dia..."
              className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
            <button onClick={addQuick} disabled={adding || !quickTitle.trim()} title="Adicionar" className="h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-40">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {myTasks.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Nenhuma tarefa sua para hoje. 🎉</p>}
            {myTasks.map((t: any) => {
              const done = t.status === "CONCLUIDO";
              const atrasada = !done && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <div key={t.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                  <button onClick={() => concluir(t)} className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${done ? "bg-green-600 border-green-600" : "border-muted-foreground/40 hover:border-green-500"}`}>
                    {done && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <button onClick={() => setSelectedTask(t)} className="flex-1 min-w-0 text-left" title="Abrir detalhes">
                    <p className={`text-sm hover:text-primary ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{t.client?.name || "—"}{atrasada && <span className="text-red-400"> · atrasada</span>}</p>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conteúdos a postar (Editorial) */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-fuchsia-400" /> Conteúdos a postar ({editorial.length})
            </h2>
            <button onClick={() => navigate("/editorial")} className="text-xs text-primary hover:underline">abrir Editorial</button>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {editorial.length === 0 && posts.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Nenhum conteúdo agendado.</p>}
            {editorial.map((c: any) => {
              const st = CONTENT_STATUS[c.status] || CONTENT_STATUS.IDEIA;
              return (
                <button key={c.id} onClick={() => navigate("/editorial")} className="w-full text-left flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 hover:bg-secondary/60 transition">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.client?.name || "—"} · {typeLabel(c.content_type)}{c.scheduled_date ? ` · ${new Date(c.scheduled_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  </div>
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                </button>
              );
            })}
            {/* Posts do sistema antigo (se houver) */}
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

      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={reloadTasks}
        team={team}
      />
    </div>
  );
};

export default DashQui;
