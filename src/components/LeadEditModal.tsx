import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, Plus, Trash2, Check } from "lucide-react";
import api from "@/lib/api";
import TagManager from "./TagManager";

interface LeadEditModalProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const LeadEditModal = ({ lead, open, onClose, onSaved }: LeadEditModalProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Lembretes
  const [reminders, setReminders] = useState<any[]>([]);
  const [remMsg, setRemMsg] = useState("");
  const [remDate, setRemDate] = useState("");
  const [remSaving, setRemSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({ ...lead });
      api.get(`/api/leads/${lead.id}/reminders`).then(d => setReminders(d.reminders || [])).catch(() => setReminders([]));
    }
  }, [lead]);

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }));

  const addReminder = async () => {
    if (!remMsg.trim() || !remDate) return;
    setRemSaving(true);
    try {
      const d = await api.post(`/api/leads/${lead.id}/reminders`, { message: remMsg.trim(), remind_on: remDate });
      setReminders(p => [...p, d.reminder].sort((a, b) => a.remind_on.localeCompare(b.remind_on)));
      setRemMsg(""); setRemDate("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setRemSaving(false); }
  };

  const toggleReminder = async (r: any) => {
    try {
      await api.patch(`/api/leads/reminders/${r.id}`, { done: !r.done });
      setReminders(p => p.map(x => x.id === r.id ? { ...x, done: !x.done } : x));
    } catch { /* */ }
  };

  const delReminder = async (r: any) => {
    try {
      await api.delete(`/api/leads/reminders/${r.id}`);
      setReminders(p => p.filter(x => x.id !== r.id));
    } catch { /* */ }
  };

  const handleSave = async () => {
    if (!lead || !form.nome?.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/leads/${lead.id}`, {
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
        cidade: form.cidade || null,
        endereco: form.endereco || null,
        status: form.status,
        origem: form.origem,
        perfil_url: form.perfil_url || null,
        maps_url: form.maps_url || null,
        observacao: form.observacao || null,
      });
      toast({ title: "Lead atualizado!" });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription className="sr-only">Formulário para editar as informações do lead selecionado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {[
            { label: "Nome", key: "nome", type: "text" },
            { label: "Telefone", key: "telefone", type: "tel" },
            { label: "E-mail", key: "email", type: "email" },
            { label: "Cidade", key: "cidade", type: "text" },
            { label: "Endereço", key: "endereco", type: "text" },
            { label: "Link Perfil (Instagram)", key: "perfil_url", type: "url" },
            { label: "Link Google Maps", key: "maps_url", type: "url" },
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{field.label}</Label>
              <Input
                type={field.type}
                value={form[field.key] || ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
            <Select value={form.status || "NOVO"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NOVO">Novo</SelectItem>
                <SelectItem value="CONTATADO">Contatado</SelectItem>
                <SelectItem value="QUALIFICADO">Qualificado</SelectItem>
                <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                <SelectItem value="PERDIDO">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Origem</Label>
            <Select value={form.origem || "MANUAL"} onValueChange={(v) => set("origem", v)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="GOOGLE_MAPS">Google Maps</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Observação</Label>
            <Textarea
              value={form.observacao || ""}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Anotações sobre o lead, contexto da conversa..."
              className="bg-secondary border-border resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gerenciar Tags</Label>
            <TagManager
              leadId={lead.id}
              assignedTagIds={(lead.tags || []).map((lt: any) => lt.tag_id)}
              onChange={() => onSaved()}
            />
          </div>

          {/* Lembretes */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" /> Lembretes
            </Label>
            <div className="space-y-1.5">
              {reminders.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lembrete. O lembrete é enviado ao grupo da equipe no dia marcado.</p>}
              {reminders.map(r => (
                <div key={r.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-2 py-1.5">
                  <button onClick={() => toggleReminder(r)} className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${r.done ? "bg-green-600 border-green-600" : "border-muted-foreground/40"}`}>
                    {r.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${r.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{r.message}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.remind_on).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <button onClick={() => delReminder(r)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={remMsg} onChange={e => setRemMsg(e.target.value)} placeholder="Ex: Ligar para retorno" className="bg-secondary border-border text-sm" />
              <Input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} className="bg-secondary border-border text-sm w-40" />
              <button onClick={addReminder} disabled={remSaving || !remMsg.trim() || !remDate} className="px-3 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
                {remSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="gradient-button px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEditModal;
