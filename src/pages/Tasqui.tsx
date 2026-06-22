import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Search, Kanban, List, ArrowLeft, Check } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const COLUMNS = [
  { id: "PENDENTE",    label: "Pendente",     color: "text-yellow-400" },
  { id: "EM_ANDAMENTO",label: "Em Andamento", color: "text-blue-400" },
  { id: "REVISAO",     label: "Revisão",      color: "text-purple-400" },
  { id: "CONCLUIDO",   label: "Concluído",    color: "text-green-400" },
];

function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`h-16 rounded-xl border-2 border-dashed transition-all flex items-center justify-center ${
        isOver ? "border-blue-500/50 bg-blue-500/5" : "border-transparent opacity-0"
      }`}
    >
      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Solte aqui</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDENTE:     { label: "Pendente",     color: "bg-yellow-500/15 text-yellow-300" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-300" },
  REVISAO:      { label: "Revisão",      color: "bg-purple-500/15 text-purple-300" },
  CONCLUIDO:    { label: "Concluído",    color: "bg-green-500/15 text-green-300" },
};
const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  BAIXA:   { label: "Baixa",   color: "text-muted-foreground" },
  MEDIA:   { label: "Média",   color: "text-blue-400" },
  ALTA:    { label: "Alta",    color: "text-orange-400" },
  URGENTE: { label: "Urgente", color: "text-red-400" },
};

// Visualização em lista das tarefas
function TaskListView({ tasks, onClick, onToggleDone }: { tasks: any[]; onClick: (t: any) => void; onToggleDone: (t: any) => void }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa encontrada com os filtros atuais.</p>;
  }
  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <div className="hidden md:grid grid-cols-[28px_1fr_140px_140px_110px_110px] gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
        <span></span><span>Tarefa</span><span>Cliente</span><span>Responsável</span><span>Status</span><span>Prazo</span>
      </div>
      {tasks.map((t) => {
        const done = t.status === "CONCLUIDO";
        return (
          <div key={t.id}
            className="grid grid-cols-[28px_1fr] md:grid-cols-[28px_1fr_140px_140px_110px_110px] gap-1 md:gap-2 px-4 py-3 border-b border-border/50 hover:bg-secondary/40 transition-colors items-center">
            <button onClick={() => onToggleDone(t)} title={done ? "Reabrir" : "Concluir"}
              className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${done ? "bg-green-600 border-green-600" : "border-muted-foreground/40 hover:border-green-500"}`}>
              {done && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
            <button onClick={() => onClick(t)} className="text-left min-w-0">
              <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
              <div className="md:hidden flex flex-wrap gap-2 mt-1 text-[11px] text-muted-foreground">
                <span>{t.client?.name || "—"}</span>
                {t.responsible?.name && <span>· {t.responsible.name}</span>}
              </div>
            </button>
            <span className="hidden md:block text-xs text-muted-foreground truncate">{t.client?.name || "—"}</span>
            <span className="hidden md:block text-xs text-muted-foreground truncate">{t.responsible?.name || "—"}</span>
            <span className="hidden md:block"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[t.status]?.color}`}>{STATUS_LABEL[t.status]?.label}</span></span>
            <span className={`hidden md:block text-xs ${PRIORITY_LABEL[t.priority]?.color}`}>
              {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const Tasqui = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const { clientId } = useParams();   // quando presente, quadro travado nesse cliente
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [activeTask, setActiveTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", client_id: "", project_id: "",
    responsible_id: "", due_date: "", priority: "MEDIA",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = async () => {
    try {
      const [t, p, c, tm] = await Promise.all([
        api.get("/api/tasqui/tasks"),
        api.get("/api/tasqui/projects"),
        api.get("/api/clients"),
        api.get("/api/teamqui"),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setProjects(Array.isArray(p) ? p : []);
      setClients(c.clients || []);
      setTeam(Array.isArray(tm) ? tm : []);
    } catch {
      toast({ title: "Erro ao carregar operações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveModule("tasqui");
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.client_id) {
      toast({ title: "Preencha título e cliente.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.post("/api/tasqui/tasks", { ...newTask, project_id: newTask.project_id || null });
      toast({ title: "Tarefa criada!" });
      setModalOpen(false);
      setNewTask({ title: "", description: "", client_id: "", project_id: "", responsible_id: "", due_date: "", priority: "MEDIA" });
      load();
    } catch {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleDone = async (t: any) => {
    const newStatus = t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO";
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: newStatus } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status: newStatus }).catch(() => load());
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over) { setActiveTask(null); return; }
    const newStatus = over.id;
    if (COLUMNS.find(c => c.id === newStatus)) {
      const task = tasks.find(t => t.id === active.id);
      if (task && task.status !== newStatus) {
        setTasks(prev => prev.map(t => t.id === active.id ? { ...t, status: newStatus } : t));
        await api.patch(`/api/tasqui/tasks/${active.id}`, { status: newStatus }).catch(() => load());
      }
    }
    setActiveTask(null);
  };

  const lockedClient = clientId ? clients.find(c => c.id === clientId) : null;

  const filtered = useMemo(() => tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.client?.name?.toLowerCase().includes(search.toLowerCase());
    const effectiveClient = clientId || filterClient;
    const matchClient = effectiveClient === "all" || t.client_id === effectiveClient;
    const matchResp = filterResponsible === "all"
      || (filterResponsible === "none" ? !t.responsible_id : t.responsible_id === filterResponsible);
    return matchSearch && matchClient && matchResp;
  }), [tasks, search, filterClient, filterResponsible, clientId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {clientId && (
            <button onClick={() => navigate("/tasqui")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Quadro geral
            </button>
          )}
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {clientId ? (lockedClient?.name || "Cliente") : "Operações"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientId ? "Quadro de tarefas deste cliente" : "Tarefas internas da equipe"}
          </p>
        </div>
        <Button onClick={() => { setNewTask(f => ({ ...f, client_id: clientId || "" })); setModalOpen(true); }} className="gradient-button gap-2">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarefa..."
            className="pl-9 bg-secondary border-border w-56 h-9"
          />
        </div>
        {!clientId && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44 bg-secondary border-border h-9">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterResponsible} onValueChange={setFilterResponsible}>
          <SelectTrigger className="w-44 bg-secondary border-border h-9">
            <SelectValue placeholder="Todos responsáveis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {team.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Alternância de visualização */}
        <div className="ml-auto flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setViewMode("board")}
            className={`px-3 h-9 text-xs font-bold flex items-center gap-1 ${viewMode === "board" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            <Kanban className="w-3.5 h-3.5" /> Quadro
          </button>
          <button onClick={() => setViewMode("list")}
            className={`px-3 h-9 text-xs font-bold flex items-center gap-1 ${viewMode === "list" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            <List className="w-3.5 h-3.5" /> Lista
          </button>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(c => <div key={c.id} className="h-64 rounded-2xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : viewMode === "list" ? (
        <TaskListView tasks={filtered} onClick={setSelectedTask} onToggleDone={handleToggleDone} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={e => setActiveTask(tasks.find(t => t.id === e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pb-10">
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${col.color}`}>
                      {col.label}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-black bg-white/5 border-white/10">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {colTasks.map(task => (
                        <TaskCard key={task.id} task={task} onClick={setSelectedTask} />
                      ))}
                    </SortableContext>
                    <DropZone id={col.id} />
                  </div>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="scale-105 opacity-80 pointer-events-none">
                <TaskCard task={activeTask} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal criar tarefa */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
                <Select value={newTask.client_id} onValueChange={v => setNewTask(f => ({ ...f, client_id: v, project_id: "" }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Projeto (opcional)</Label>
                <Select value={newTask.project_id} onValueChange={v => setNewTask(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.client_id === newTask.client_id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável</Label>
                <Select value={newTask.responsible_id} onValueChange={v => setNewTask(f => ({ ...f, responsible_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                  <SelectContent>{team.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select value={newTask.priority} onValueChange={v => setNewTask(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prazo</Label>
              <Input type="date" value={newTask.due_date} onChange={e => setNewTask(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
              <Button type="submit" disabled={creating} className="gradient-button">
                {creating ? "Criando..." : "Criar Tarefa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} onUpdate={load} team={team} />
      )}
    </div>
  );
};

export default Tasqui;
