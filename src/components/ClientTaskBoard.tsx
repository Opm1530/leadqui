import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import api from "@/lib/api";

const COLUMNS = [
  { id: "PENDENTE",     label: "Pendente",     color: "text-yellow-400" },
  { id: "EM_ANDAMENTO", label: "Em Andamento", color: "text-blue-400" },
  { id: "REVISAO",      label: "Revisão",      color: "text-purple-400" },
  { id: "CONCLUIDO",    label: "Concluído",    color: "text-green-400" },
];

function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`h-12 rounded-xl border-2 border-dashed transition-all ${isOver ? "border-blue-500/50 bg-blue-500/5" : "border-transparent"}`} />;
}

interface Props {
  clientId: string;
  tasks: any[];
  setTasks: (fn: any) => void;
  team?: any[];
  reload: () => void;
}

export default function ClientTaskBoard({ clientId, tasks, setTasks, team = [], reload }: Props) {
  const [activeTask, setActiveTask] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm = { title: "", description: "", responsible_id: "", priority: "MEDIA", due_date: "" };
  const [form, setForm] = useState(emptyForm);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const criar = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const t = await api.post("/api/tasqui/tasks", {
        title: form.title.trim(),
        description: form.description || null,
        client_id: clientId,
        responsible_id: form.responsible_id || null,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setTasks((p: any[]) => [...p, t]);
      setForm(emptyForm); setModalOpen(false);
    } finally { setCreating(false); }
  };

  const onDragEnd = async (e: any) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const newStatus = over.id;
    if (!COLUMNS.find(c => c.id === newStatus)) return;
    const task = tasks.find(t => t.id === active.id);
    if (task && task.status !== newStatus) {
      setTasks((p: any[]) => p.map(t => t.id === active.id ? { ...t, status: newStatus } : t));
      await api.patch(`/api/tasqui/tasks/${active.id}`, { status: newStatus }).catch(() => reload());
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Button onClick={() => { setForm(emptyForm); setModalOpen(true); }} className="gradient-button gap-2"><Plus className="w-4 h-4" /> Nova Tarefa</Button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="bg-secondary border-border resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável</Label>
                <Select value={form.responsible_id} onValueChange={v => setForm(f => ({ ...f, responsible_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                  <SelectContent>{team.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
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
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={criar} disabled={creating || !form.title.trim()} className="gradient-button">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveTask(tasks.find(t => t.id === e.active.id))} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${col.color}`}>{col.label}</span>
                  <Badge variant="outline" className="text-[9px] font-black bg-white/5 border-white/10">{colTasks.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[120px]">
                  <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {colTasks.map(task => <TaskCard key={task.id} task={task} onClick={setSelected} />)}
                  </SortableContext>
                  <DropZone id={col.id} />
                </div>
              </div>
            );
          })}
        </div>
        <DragOverlay>{activeTask && <div className="scale-105 opacity-80"><TaskCard task={activeTask} onClick={() => {}} /></div>}</DragOverlay>
      </DndContext>

      <TaskDetailModal task={selected} isOpen={!!selected} onClose={() => setSelected(null)} onUpdate={reload} team={team} />
    </div>
  );
}
