import { useState, useEffect } from "react";
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
import { Calendar, Trash2, User, Briefcase, Tag, Archive, Send, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import FileViewerModal, { ViewFile } from "@/components/FileViewerModal";
import { backgroundUpload } from "@/contexts/UploadContext";

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
  const { user } = useAuth();
  const { role } = useRole();
  const isDesigner = role === "DESIGNER";

  // Sincroniza o formulário sempre que a tarefa aberta muda (evita modal vazio)
  useEffect(() => {
    if (!task) return;
    setFormData({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "PENDENTE",
      priority: task.priority || "MEDIA",
      responsible_id: task.responsible_id || "",
      due_date: task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "",
    });
  }, [task?.id, isOpen]); // eslint-disable-line

  // Anexos da tarefa
  const [files, setFiles] = useState<any[]>([]);
  const [viewFile, setViewFile] = useState<ViewFile | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (task?.id && isOpen) api.get(`/api/files?task_id=${task.id}`).then(d => setFiles(d.files || [])).catch(() => setFiles([]));
  }, [task?.id, isOpen]);

  // Comentários da tarefa
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (task?.id && isOpen) api.get(`/api/tasqui/tasks/${task.id}/comments`).then(d => setComments(d.comments || [])).catch(() => setComments([]));
    else { setComments([]); setNewComment(""); }
  }, [task?.id, isOpen]);
  const enviarComentario = async () => {
    if (!newComment.trim() || !task) return;
    setSending(true);
    try {
      const d = await api.post(`/api/tasqui/tasks/${task.id}/comments`, { body: newComment.trim() });
      setComments(p => [...p, d.comment]);
      setNewComment("");
    } catch { toast({ title: "Erro ao comentar", variant: "destructive" }); }
    finally { setSending(false); }
  };
  const uploadAnexo = async (e: any) => {
    const f = e.target.files?.[0]; if (!f || !task) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("client_id", task.client_id); fd.append("task_id", task.id);
      const d = await backgroundUpload("/api/files", fd, f.name);
      if (d?.file) setFiles(p => [d.file, ...p]);
    } catch { toast({ title: "Erro ao anexar", variant: "destructive" }); }
    finally { setUploading(false); e.target.value = ""; }
  };
  const baixarAnexo = (af: any) => setViewFile({ name: af.name, mime: af.mime, url: `/api/files/${af.id}/download` });
  const delAnexo = async (af: any) => {
    await api.delete(`/api/files/${af.id}`).catch(() => {});
    setFiles(p => p.filter(x => x.id !== af.id));
  };

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

  const handleArchive = async () => {
    setEditing(true);
    try {
      await api.patch(`/api/tasqui/tasks/${task.id}`, { archived: true });
      toast({ title: "Tarefa arquivada", description: "Ela some do quadro, mas não foi excluída." });
      onUpdate();
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível arquivar.", variant: "destructive" });
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
                value={formData.status}
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
                value={formData.priority}
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
                value={formData.responsible_id || "unassigned"}
                onValueChange={(val) => setFormData({...formData, responsible_id: val === "unassigned" ? null : val})}
                disabled={isDesigner}
              >
                <SelectTrigger className="bg-white/5 border-white/10 disabled:opacity-100 disabled:cursor-default">
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

          {/* Anexos */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Anexos</label>
              <label className="text-xs text-primary hover:underline cursor-pointer">
                {uploading ? "enviando..." : "+ anexar"}
                <input type="file" onChange={uploadAnexo} disabled={uploading} className="hidden" />
              </label>
            </div>
            {files.length === 0 ? <p className="text-xs text-gray-500">Nenhum anexo.</p> : (
              <div className="space-y-1.5">
                {files.map(af => (
                  <div key={af.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                    <button onClick={() => baixarAnexo(af)} className="flex-1 min-w-0 text-left text-xs text-foreground truncate hover:text-primary">{af.name}</button>
                    <button onClick={() => delAnexo(af)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comentários */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Comentários</label>
            {comments.length === 0 ? <p className="text-xs text-gray-500">Nenhum comentário ainda.</p> : (
              <div className="space-y-2">
                {comments.map(c => (
                  <div key={c.id} className="bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[11px] font-bold text-foreground">{c.user?.name || "—"}</span>
                      <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }}
                placeholder="Escreva um comentário..."
                className="bg-white/5 border-white/10 flex-1"
              />
              <button onClick={enviarComentario} disabled={sending || !newComment.trim()} className="p-2.5 rounded-lg gradient-button disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-8 border-t border-white/5 gap-3 flex-col sm:flex-row">
          <button
            type="button"
            onClick={handleArchive}
            disabled={editing}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 text-gray-400 font-bold hover:bg-white/5 disabled:opacity-50"
            title="Arquivar — some do quadro sem excluir"
          >
            <Archive className="w-4 h-4" /> ARQUIVAR
          </button>
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
      <FileViewerModal file={viewFile} onClose={() => setViewFile(null)} />
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
