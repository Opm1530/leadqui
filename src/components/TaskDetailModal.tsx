import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trash2, User, Briefcase, Tag } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TaskDetailModalProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  team: any[];
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, team }: TaskDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "",
    priority: task?.priority || "MEDIA",
    responsible_id: task?.responsible_id || "",
    due_date: task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : "",
  });
  const { toast } = useToast();

  if (!task) return null;

  const handleSave = async () => {
    setEditing(true);
    try {
      await api.patch(`/api/tasqui/tasks/${task.id}`, formData);
      toast({ title: "Sucesso", description: "Tarefa atualizada com sucesso!" });
      onUpdate();
      onClose();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card border-white/10 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
             <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] uppercase font-black">
                {task.client?.name}
             </Badge>
             <span className="text-gray-500">/</span>
             <span className="text-xs text-gray-400 font-bold">{task.project?.name}</span>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white mb-4">
             {formData.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Tag className="w-3 h-3" /> Status
              </Label>
              <Select 
                defaultValue={formData.status} 
                onValueChange={(val) => setFormData({...formData, status: val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Execução</SelectItem>
                  <SelectItem value="REVISAO">Revisão</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" /> Prioridade
              </Label>
              <Select 
                defaultValue={formData.priority} 
                onValueChange={(val) => setFormData({...formData, priority: val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <User className="w-3 h-3" /> Responsável
              </Label>
              <Select 
                defaultValue={formData.responsible_id || "unassigned"} 
                onValueChange={(val) => setFormData({...formData, responsible_id: val === "unassigned" ? null : val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {team.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Prazo Final
              </Label>
              <Input 
                type="date" 
                value={formData.due_date} 
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className="bg-white/5 border-white/10" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-gray-500 tracking-widest">Título da Tarefa</Label>
            <Input 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="bg-white/5 border-white/10" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-gray-500 tracking-widest">Descrição Completa</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Descreva os entregáveis e detalhes da tarefa..." 
              className="bg-white/5 border-white/10 min-h-[120px]" 
            />
          </div>
        </div>

        <DialogFooter className="pt-8 border-t border-white/5 gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold hover:bg-white/5"
          >
            CANCELAR
          </button>
          <button 
            onClick={handleSave} 
            disabled={editing}
            className="flex-1 gradient-button py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            {editing ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
