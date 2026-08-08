import { confirm } from "@/components/ConfirmDialog";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { backgroundUpload } from "@/contexts/UploadContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Search, Check, Trash2, ListTodo, Rows3, LayoutList, Plus, Archive } from "lucide-react";
import { TaskDetailModal } from "@/components/TaskDetailModal";

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
  const { user } = useAuth();
  const { isAdmin, role } = useRole();
  // Quem não gere (designer/operador) vê só as próprias tarefas
  const mineOnly = !(isAdmin || role === "MANAGER");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fClient, setFClient] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [view, setView] = useState<"lista" | "status">("lista");

  const [clientsAll, setClientsAll] = useState<any[]>([]);
  const [teamAll, setTeamAll] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm = { title: "", description: "", client_id: "", responsible_id: "", priority: "MEDIA", due_date: "" };
  const [form, setForm] = useState(emptyForm);
  const [attach, setAttach] = useState<File[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [arquivoOpen, setArquivoOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/api/tasqui/tasks").then(setTasks).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get("/api/clients").then(d => setClientsAll(d.clients || [])).catch(() => {});
    api.get("/api/teamqui").then(d => setTeamAll(d.users || d || [])).catch(() => {});
  }, []);

  const criar = async () => {
    if (!form.title.trim() || !form.client_id) { toast({ title: "Preencha título e cliente.", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const t = await api.post("/api/tasqui/tasks", {
        title: form.title.trim(), description: form.description || null, client_id: form.client_id,
        responsible_id: form.responsible_id || null, priority: form.priority, due_date: form.due_date || null,
      });
      for (const f of attach) {
        const fd = new FormData(); fd.append("file", f); fd.append("client_id", form.client_id); fd.append("task_id", t.id);
        backgroundUpload("/api/files", fd, f.name).catch(() => {});
      }
      toast({ title: "Tarefa criada!" });
      setForm(emptyForm); setAttach([]); setModal(false); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const clientes = useMemo(() => Array.from(new Map(tasks.filter(t => t.client).map(t => [t.client_id, t.client])).values()), [tasks]);
  const responsaveis = useMemo(() => Array.from(new Map(tasks.filter(t => t.responsible?.id).map(t => [t.responsible.id, t.responsible])).values()), [tasks]);

  const filtered = tasks.filter(t => {
    if (mineOnly && t.responsible_id !== user?.id) return false;
    const s = search.toLowerCase();
    const mS = !s || t.title.toLowerCase().includes(s) || t.client?.name?.toLowerCase().includes(s);
    const mC = fClient === "all" || t.client_id === fClient;
    const mR = fResp === "all" || (fResp === "none" ? !t.responsible_id : t.responsible_id === fResp);
    const mSt = fStatus === "all" || t.status === fStatus;
    return mS && mC && mR && mSt;
  });

  // Concluídas vão para a "caixinha" (arquivo); a lista principal só mostra as ativas.
  const ativas = filtered.filter(t => t.status !== "CONCLUIDO");
  const concluidas = useMemo(() => {
    const list = tasks.filter(t => t.status === "CONCLUIDO" && (!mineOnly || t.responsible_id === user?.id));
    // agrupa por dia de conclusão
    const groups: { key: string; label: string; items: any[] }[] = [];
    const sorted = [...list].sort((a, b) => +new Date(b.completed_at || b.updated_at || 0) - +new Date(a.completed_at || a.updated_at || 0));
    for (const t of sorted) {
      const d = new Date(t.completed_at || t.updated_at || Date.now());
      const key = d.toDateString();
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, label: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }), items: [] }; groups.push(g); }
      g.items.push(t);
    }
    return groups;
  }, [tasks, mineOnly, user?.id]);
  const concluidasCount = concluidas.reduce((n, g) => n + g.items.length, 0);

  const toggle = async (t: any) => {
    const status = t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO";
    setTasks(p => p.map(x => x.id === t.id ? { ...x, status } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status }).catch(() => load());
  };
  const remover = async (t: any) => {
    if (!(await confirm(`Excluir "${t.title}"?`))) return;
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
        <button onClick={() => setSelected(t)} className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {t.client?.name || "—"}{t.responsible?.name ? ` · ${t.responsible.name}` : ""}
            {t.due_date && <span className={atrasada ? "text-red-400" : ""}> · {new Date(t.due_date).toLocaleDateString("pt-BR")}{atrasada ? " (atrasada)" : ""}</span>}
          </p>
        </button>
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
          <h1 className="text-2xl font-bold text-foreground">{mineOnly ? "Minhas tarefas" : "Todas as tarefas"}</h1>
          <p className="text-muted-foreground text-sm">{ativas.filter(t => t.status !== "CONCLUIDO").length} ativa(s){concluidasCount > 0 ? ` · ${concluidasCount} concluída(s) no arquivo` : ""}</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView("lista")} className={`px-2.5 h-9 ${view === "lista" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}><LayoutList className="w-4 h-4" /></button>
          <button onClick={() => setView("status")} className={`px-2.5 h-9 ${view === "status" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}><Rows3 className="w-4 h-4" /></button>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm, responsible_id: mineOnly ? (user?.id || "") : "" }); setAttach([]); setModal(true); }} className="gradient-button gap-2 h-9"><Plus className="w-4 h-4" /> Nova Tarefa</Button>
      </div>

      {/* Modal criar tarefa */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="bg-secondary border-border resize-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientsAll.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável</Label>
                <Select value={form.responsible_id} onValueChange={v => setForm(f => ({ ...f, responsible_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                  <SelectContent>{teamAll.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="BAIXA">Baixa</SelectItem><SelectItem value="MEDIA">Média</SelectItem><SelectItem value="ALTA">Alta</SelectItem><SelectItem value="URGENTE">Urgente</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary border-border" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Anexos / referências</Label>
              <input type="file" multiple onChange={e => setAttach(Array.from(e.target.files || []))} className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:text-xs" />
              {attach.length > 0 && <p className="text-[11px] text-muted-foreground">{attach.length} arquivo(s) selecionado(s)</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-border">Cancelar</Button>
            <Button onClick={criar} disabled={creating || !form.title.trim() || !form.client_id} className="gradient-button gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <SelectContent><SelectItem value="all">Todos status</SelectItem>{Object.entries(STATUS).filter(([k]) => k !== "CONCLUIDO").map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
        {/* Caixinha de concluídas (arquivo) */}
        <button type="button" onClick={() => setArquivoOpen(true)} title="Tarefas concluídas"
          className="relative h-9 w-9 flex items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70">
          <Archive className="w-4 h-4" />
          {concluidasCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center">{concluidasCount}</span>
          )}
        </button>
      </div>

      {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      : ativas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa ativa com esses filtros.</p>
      : view === "lista" ? (
        <div className="space-y-1.5">{ativas.map(Row)}</div>
      ) : (
        <div className="space-y-5">
          {Object.keys(STATUS).filter(st => st !== "CONCLUIDO").map(st => {
            const list = ativas.filter(t => t.status === st);
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

      {/* Caixinha de concluídas */}
      <Dialog open={arquivoOpen} onOpenChange={setArquivoOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Archive className="w-4 h-4 text-green-400" /> Tarefas concluídas ({concluidasCount})</DialogTitle>
          </DialogHeader>
          {concluidasCount === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa concluída ainda.</p>
          ) : (
            <div className="space-y-4 pt-1">
              {concluidas.map(g => (
                <div key={g.key}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 capitalize">{g.label} <span className="text-muted-foreground/60">· {g.items.length}</span></p>
                  <div className="space-y-1.5">
                    {g.items.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
                        <button onClick={() => toggle(t)} title="Reabrir" className="w-5 h-5 rounded-md bg-green-600 border border-green-600 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button onClick={() => { setArquivoOpen(false); setSelected(t); }} className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-muted-foreground line-through truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground/70">{t.client?.name || "—"}{t.responsible?.name ? ` · ${t.responsible.name}` : ""}</p>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TaskDetailModal task={selected} isOpen={!!selected} onClose={() => setSelected(null)} onUpdate={load} team={teamAll} />
    </div>
  );
};

export default Tarefas;
