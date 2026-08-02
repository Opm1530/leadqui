import { useState } from "react";
import { Plus, Loader2, Calendar, User, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import api from "@/lib/api";

const STATUS = [
  { id: "PENDENTE",     label: "Pendente",     color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  { id: "EM_ANDAMENTO", label: "Em Andamento", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { id: "REVISAO",      label: "Revisão",      color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { id: "CONCLUIDO",    label: "Concluído",    color: "text-green-400 bg-green-500/10 border-green-500/20" },
];

const PRIORITY: Record<string, { label: string; color: string }> = {
  BAIXA:   { label: "Baixa",   color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  MEDIA:   { label: "Média",   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  ALTA:    { label: "Alta",    color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  URGENTE: { label: "Urgente", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

interface Props {
  clientId: string;
  tasks: any[];
  setTasks: (fn: any) => void;
  team?: any[];
  reload: () => void;
}

export default function ClientTaskBoard({ clientId, tasks, setTasks, team = [], reload }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm = { title: "", description: "", responsible_id: "", priority: "MEDIA", due_date: "" };
  const [form, setForm] = useState(emptyForm);
  const [attachments, setAttachments] = useState<File[]>([]);

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
      for (const f of attachments) {
        const fd = new FormData();
        fd.append("file", f); fd.append("client_id", clientId); fd.append("task_id", t.id);
        await api.post("/api/files", fd).catch(() => {});
      }
      setTasks((p: any[]) => [...p, t]);
      setForm(emptyForm); setAttachments([]); setModalOpen(false);
    } finally { setCreating(false); }
  };

  const changeStatus = async (task: any, newStatus: string) => {
    if (task.status === newStatus) return;
    setTasks((p: any[]) => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await api.patch(`/api/tasqui/tasks/${task.id}`, { status: newStatus }).catch(() => reload());
  };

  const toggleDone = async (task: any) => {
    const newStatus = task.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO";
    await changeStatus(task, newStatus);
  };

  // Ordena: abertas primeiro (por status), concluídas por último
  const order = ["PENDENTE", "EM_ANDAMENTO", "REVISAO", "CONCLUIDO"];
  const sorted = [...tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Anexos / referências</Label>
              <input type="file" multiple onChange={e => setAttachments(Array.from(e.target.files || []))}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:text-xs hover:file:bg-secondary/70" />
              {attachments.length > 0 && <p className="text-[11px] text-muted-foreground">{attachments.length} arquivo(s) selecionado(s)</p>}
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

      {/* Lista de tarefas */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma tarefa para este cliente.</p>
        )}
        {sorted.map(task => {
          const done = task.status === "CONCLUIDO";
          const prio = PRIORITY[task.priority] || PRIORITY.MEDIA;
          const atrasada = !done && task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
          const responsavel = team.find((u: any) => u.id === task.responsible_id) || task.responsible;
          return (
            <div key={task.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <button onClick={() => toggleDone(task)} title={done ? "Reabrir" : "Concluir"} className="flex-shrink-0">
                {done
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-green-500 transition-colors" />}
              </button>

              <button onClick={() => setSelected(task)} className="flex-1 min-w-0 text-left">
                <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                  {responsavel && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {responsavel.name}</span>}
                  {task.due_date && (
                    <span className={`flex items-center gap-1 ${atrasada ? "text-red-400" : ""}`}>
                      <Calendar className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString("pt-BR")}{atrasada && " · atrasada"}
                    </span>
                  )}
                </div>
              </button>

              <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${prio.color}`}>{prio.label}</span>

              <Select value={task.status} onValueChange={(v) => changeStatus(task, v)}>
                <SelectTrigger className="h-8 w-36 bg-secondary border-border text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <TaskDetailModal task={selected} isOpen={!!selected} onClose={() => setSelected(null)} onUpdate={reload} team={team} />
    </div>
  );
}
