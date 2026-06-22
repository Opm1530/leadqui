import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [novo, setNovo] = useState("");
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const criar = async () => {
    if (!novo.trim()) return;
    setCreating(true);
    try {
      const t = await api.post("/api/tasqui/tasks", { title: novo.trim(), client_id: clientId, priority: "MEDIA" });
      setTasks((p: any[]) => [...p, t]); setNovo("");
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
      <div className="flex gap-2 mb-4 max-w-md">
        <Input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") criar(); }} placeholder="Nova tarefa..." className="bg-secondary border-border text-sm" />
        <Button onClick={criar} disabled={creating} className="gradient-button">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button>
      </div>

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
