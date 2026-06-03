import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (lead) setForm({ ...lead });
  }, [lead]);

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }));

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

          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gerenciar Tags</Label>
            <TagManager 
              leadId={lead.id} 
              assignedTagIds={(lead.tags || []).map((lt: any) => lt.tag_id)} 
              onChange={() => onSaved()} 
            />
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
