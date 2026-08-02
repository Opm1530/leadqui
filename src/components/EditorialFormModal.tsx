import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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
};

export default function EditorialFormModal({ open, onClose, onSaved, clients, team, editing, defaultClientId, defaultDate }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title || "", description: editing.description || "", client_id: editing.client_id || "",
        responsible_id: editing.responsible_id || "", reference_url: editing.reference_url || "",
        caption: editing.caption || "", hashtags: editing.hashtags || "",
        content_type: editing.content_type || "POST", platform: editing.platform || "INSTAGRAM",
        scheduled_date: editing.scheduled_date ? editing.scheduled_date.slice(0, 10) : "", priority: "MEDIA",
      });
    } else {
      setForm({ ...empty, client_id: defaultClientId || "", scheduled_date: defaultDate || "" });
    }
  }, [open, editing, defaultClientId, defaultDate]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.client_id) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        responsible_id: form.responsible_id || null,
        scheduled_date: form.scheduled_date || null,
      };
      if (editing) await api.patch(`/api/editorial/${editing.id}`, payload);
      else await api.post("/api/editorial", payload);
      onSaved();
      onClose();
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
          <div className="grid grid-cols-3 gap-4">
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Publicação</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} className="bg-secondary border-border" />
            </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.client_id} className="gradient-button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Salvar" : "Criar conteúdo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
