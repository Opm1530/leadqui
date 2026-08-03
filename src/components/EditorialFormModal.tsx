import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, CalendarClock, CheckCircle2, AlertCircle } from "lucide-react";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/editorial";
import api from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clients: any[];
  team: any[];
  editing?: any | null;      // conteúdo em edição (ou null para criar)
  defaultClientId?: string;
  defaultDate?: string;      // yyyy-mm-dd ao criar clicando num dia
}

const empty = {
  title: "", description: "", client_id: "", responsible_id: "", reference_url: "",
  caption: "", hashtags: "", content_type: "POST", platform: "INSTAGRAM", scheduled_date: "", priority: "MEDIA",
  auto_schedule: false,
};

// ISO (UTC) → valor local "yyyy-mm-ddThh:mm" para o input datetime-local
const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
// "yyyy-mm-dd" (do calendário) → "yyyy-mm-ddT09:00"
const withDefaultTime = (v?: string) => (v && v.length === 10 ? `${v}T09:00` : (v || ""));

export default function EditorialFormModal({ open, onClose, onSaved, clients, team, editing, defaultClientId, defaultDate }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setError("");
    api.get("/api/techqui/connections").then(d => setConnections(d.connections || [])).catch(() => setConnections([]));
    if (editing) {
      setForm({
        title: editing.title || "", description: editing.description || "", client_id: editing.client_id || "",
        responsible_id: editing.responsible_id || "", reference_url: editing.reference_url || "",
        caption: editing.caption || "", hashtags: editing.hashtags || "",
        content_type: editing.content_type || "POST", platform: editing.platform || "INSTAGRAM",
        scheduled_date: toLocalInput(editing.scheduled_date), priority: "MEDIA",
        auto_schedule: !!editing.auto_schedule,
      });
    } else {
      setForm({ ...empty, client_id: defaultClientId || "", scheduled_date: withDefaultTime(defaultDate) });
    }
  }, [open, editing, defaultClientId, defaultDate]);

  const conn = connections.find((c: any) => c.client_id === form.client_id);
  const clientConnected = !!conn && !!conn.has_instagram;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.client_id) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        responsible_id: form.responsible_id || null,
        // envia instante exato (ISO/UTC) quando há data+hora
        scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
      };
      if (editing) await api.patch(`/api/editorial/${editing.id}`, payload);
      else await api.post("/api/editorial", payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar conteúdo" : "Novo conteúdo"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} className="bg-secondary border-border" placeholder="Ex: Reels dicas de skincare" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => set("client_id", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável (produção)</Label>
              <Select value={form.responsible_id} onValueChange={v => set("responsible_id", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                <SelectContent>{team.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Tipo</Label>
              <Select value={form.content_type} onValueChange={v => set("content_type", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Plataforma</Label>
              <Select value={form.platform} onValueChange={v => set("platform", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data e horário da publicação</Label>
            <Input type="datetime-local" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição / Briefing</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} className="bg-secondary border-border resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Link de referência (drive, canva...)</Label>
            <Input value={form.reference_url} onChange={e => set("reference_url", e.target.value)} className="bg-secondary border-border" placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Legenda</Label>
            <Textarea value={form.caption} onChange={e => set("caption", e.target.value)} rows={2} className="bg-secondary border-border resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Hashtags</Label>
            <Input value={form.hashtags} onChange={e => set("hashtags", e.target.value)} className="bg-secondary border-border" placeholder="#marketing #social" />
          </div>

          {/* Agendamento de publicação */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-fuchsia-400" />
                <span className="text-sm font-medium text-foreground">Agendar publicação automática</span>
              </div>
              <Switch checked={form.auto_schedule} onCheckedChange={(v: boolean) => set("auto_schedule", v)} />
            </div>
            {form.auto_schedule && (
              <div className="space-y-1.5 pt-1">
                {!form.scheduled_date && (
                  <p className="text-[11px] text-amber-300 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Defina a data de publicação acima para agendar.</p>
                )}
                {form.client_id && (
                  clientConnected
                    ? <p className="text-[11px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cliente com conexão ativa{conn?.instagram_username ? ` (@${conn.instagram_username})` : ""}.</p>
                    : <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cliente sem conexão ativa do Instagram — conecte em Meta → Conexões.</p>
                )}
                <p className="text-[10px] text-muted-foreground">A publicação automática só ocorre após o conteúdo ser aprovado e depende da conta conectada.</p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.client_id || (form.auto_schedule && (!form.scheduled_date || !clientConnected))} className="gradient-button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Salvar" : "Criar conteúdo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
