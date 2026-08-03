import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, CheckCircle2, XCircle, Send, ExternalLink, FileText, Trash2, Link2, Paperclip } from "lucide-react";
import { confirm, alertDialog } from "@/components/ConfirmDialog";
import { CONTENT_STATUS, typeLabel, platformLabel, openEditorialFile } from "@/lib/editorial";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import api from "@/lib/api";

interface Props {
  content: any;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: (c: any) => void;
}

export default function EditorialDetailModal({ content, isOpen, onClose, onChanged, onEdit }: Props) {
  const { user } = useAuth();
  const { isAdmin, role } = useRole();
  const canManage = isAdmin || role === "MANAGER";
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega os anexos da tarefa vinculada (a arte pode ter sido anexada pela tarefa)
  useEffect(() => {
    if (isOpen && content?.task_id) {
      api.get(`/api/files?task_id=${content.task_id}`).then(d => setTaskFiles(d.files || [])).catch(() => setTaskFiles([]));
    } else setTaskFiles([]);
  }, [isOpen, content?.task_id]);

  const baixarAnexo = (af: any) => {
    const token = localStorage.getItem("pequi_token");
    fetch(`/api/files/${af.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), "_blank")).catch(() => {});
  };

  if (!content) return null;
  const st = CONTENT_STATUS[content.status] || CONTENT_STATUS.IDEIA;
  const isResponsible = content.responsible_id === user?.id;
  const canSubmit = (canManage || isResponsible) && ["EM_PRODUCAO", "AJUSTES"].includes(content.status);

  const submit = async (file?: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      await api.post(`/api/editorial/${content.id}/submit`, fd);
      onChanged();
    } finally { setBusy(false); }
  };

  const act = async (path: string, body?: any) => {
    setBusy(true);
    try {
      const d = await api.post(`/api/editorial/${content.id}/${path}`, body || {});
      setRejecting(false); setFeedback("");
      if (path === "approve") {
        if (d?.schedule_warning) await alertDialog(`Aprovado, mas: ${d.schedule_warning}`);
        else if (content.auto_schedule) await alertDialog("Aprovado e agendado! Será publicado automaticamente na data prevista.");
      }
      onChanged();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Excluir conteúdo", description: "Excluir este conteúdo e a tarefa vinculada? Não pode ser desfeito.", danger: true }))) return;
    setBusy(true);
    try { await api.delete(`/api/editorial/${content.id}`); onChanged(); onClose(); }
    finally { setBusy(false); }
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{typeLabel(content.content_type)}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{platformLabel(content.platform)}</span>
            {content.auto_schedule && <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">⏰ Agendada</span>}
          </div>
          <DialogTitle className="text-left mt-2">{content.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><b className="text-foreground">Cliente:</b> {content.client?.name || "—"}</span>
            <span><b className="text-foreground">Responsável:</b> {content.responsible?.name || "—"}</span>
            <span><b className="text-foreground">Publicação:</b> {fmt(content.scheduled_date)}</span>
          </div>

          {content.description && (
            <div><p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Descrição / Briefing</p><p className="text-foreground whitespace-pre-wrap">{content.description}</p></div>
          )}

          {content.reference_url && /^https?:\/\//i.test(content.reference_url.trim()) && (
            <a href={content.reference_url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
              <Link2 className="w-4 h-4" /> Abrir referência
            </a>
          )}

          {content.caption && (
            <div><p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Legenda</p><p className="text-foreground whitespace-pre-wrap">{content.caption}</p></div>
          )}
          {content.hashtags && (
            <div><p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Hashtags</p><p className="text-blue-300">{content.hashtags}</p></div>
          )}

          {content.status === "AJUSTES" && content.feedback && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-[11px] uppercase tracking-widest text-red-300 mb-1">Ajustes solicitados</p>
              <p className="text-red-200 whitespace-pre-wrap">{content.feedback}</p>
            </div>
          )}

          {content.produced_key && (
            <button onClick={() => openEditorialFile(content.id)} className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm">
              <FileText className="w-4 h-4" /> Ver conteúdo produzido ({content.produced_name}) <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* Arte anexada pela tarefa vinculada */}
          {taskFiles.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Arquivos da tarefa</p>
              <div className="space-y-1.5">
                {taskFiles.map(af => (
                  <button key={af.id} onClick={() => baixarAnexo(af)} className="w-full text-left flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-1.5 hover:bg-secondary/60 transition">
                    <FileText className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span className="text-xs text-foreground truncate flex-1">{af.name}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="border-t border-border pt-4 space-y-3">
            {canSubmit && (
              <div>
                <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) submit(f); }} />
                <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gradient-button gap-2 w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {content.produced_key ? "Reenviar conteúdo para aprovação" : "Subir conteúdo para aprovação"}
                </Button>
                <button onClick={() => submit()} disabled={busy} className="text-[11px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 mx-auto">
                  <Send className="w-3 h-3" /> enviar para aprovação sem anexar arquivo
                </button>
              </div>
            )}

            {canManage && content.status === "EM_APROVACAO" && !rejecting && (
              <div className="flex gap-2">
                <Button onClick={() => act("approve")} disabled={busy} className="gap-2 flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="w-4 h-4" /> Aprovar
                </Button>
                <Button onClick={() => setRejecting(true)} disabled={busy} variant="outline" className="gap-2 flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10">
                  <XCircle className="w-4 h-4" /> Pedir ajustes
                </Button>
              </div>
            )}

            {canManage && rejecting && (
              <div className="space-y-2">
                <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} placeholder="O que precisa ser ajustado?" className="bg-secondary border-border resize-none" />
                <div className="flex gap-2">
                  <Button onClick={() => act("reject", { feedback })} disabled={busy || !feedback.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Enviar ajustes</Button>
                  <Button onClick={() => setRejecting(false)} variant="outline" className="border-border">Cancelar</Button>
                </div>
              </div>
            )}

            {canManage && content.status === "AGUARDANDO_POSTAR" && (
              <Button onClick={() => act("post")} disabled={busy} className="gradient-button gap-2 w-full">
                <CheckCircle2 className="w-4 h-4" /> Marcar como postado
              </Button>
            )}

            {canManage && (
              <div className="flex items-center justify-between pt-1">
                {onEdit && <button onClick={() => onEdit(content)} className="text-xs text-muted-foreground hover:text-foreground">Editar conteúdo</button>}
                <button onClick={remove} className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3" /> Excluir</button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
