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
import { Plus, Search } from "lucide-react";
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

const Tasqui = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
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
    if (!newTask.title || !newTask.client_id || !newTask.project_id) {
      toast({ title: "Preencha título, cliente e projeto.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.post("/api/tasqui/tasks", newTask);
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

  const filtered = useMemo(() => tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.client?.name?.toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient === "all" || t.client_id === filterClient;
    return matchSearch && matchClient;
  }), [tasks, search, filterClient]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Operações</h1>
          <p className="text-sm text-muted-foreground mt-1">Tarefas internas da equipe</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gradient-button gap-2">
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
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 bg-secondary border-border h-9">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(c => <div key={c.id} className="h-64 rounded-2xl bg-card border border-border animate-pulse" />)}
        </div>
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
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Projeto *</Label>
                <Select value={newTask.project_id} onValueChange={v => setNewTask(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
