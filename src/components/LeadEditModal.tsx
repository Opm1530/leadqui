import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth } from "@/integrations/firebase/client";
import { firestoreService } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import TagManager from "./TagManager";
import { Plus, Trash2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

interface LeadEditModalProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const LeadEditModal = ({ lead, open, onClose, onSaved }: LeadEditModalProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const [camposExtras, setCamposExtras] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({ ...lead });
      setCamposExtras(lead.campos_extras || {});
      fetchTags();
    }
  }, [lead]);

  const fetchTags = async () => {
    if (!lead) return;
    try {
      const q = query(collection(db, "lead_tags"), where("lead_id", "==", lead.id));
      const querySnapshot = await getDocs(q);
      setAssignedTagIds(querySnapshot.docs.map((d: any) => d.data().tag_id));
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }));

  const addExtra = () => {
    if (!newKey.trim()) return;
    setCamposExtras((p) => ({ ...p, [newKey.trim()]: newValue }));
    setNewKey("");
    setNewValue("");
  };

  const removeExtra = (key: string) => {
    setCamposExtras((p) => {
      const copy = { ...p };
      delete copy[key];
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await firestoreService.update("leads", lead.id, {
        nome: form.nome || null,
        telefone: form.telefone || null,
        username: form.username || null,
        cidade: form.cidade || null,
        status: form.status || "novo",
        categoria: form.categoria || null,
        perfil_url: form.perfil_url || null,
        post_url: form.post_url || null,
        tag_origem: form.tag_origem || null,
        campos_extras: camposExtras || {},
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
          <DialogTitle className="text-foreground">Editar Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Username</Label>
              <Input value={form.username || ""} onChange={(e) => set("username", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cidade</Label>
              <Input value={form.cidade || ""} onChange={(e) => set("cidade", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Input value={form.categoria || ""} onChange={(e) => set("categoria", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status || "novo"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="contatado">Contatado</SelectItem>
                  <SelectItem value="respondeu">Respondeu</SelectItem>
                  <SelectItem value="convertido">Convertido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL do Perfil</Label>
            <Input value={form.perfil_url || ""} onChange={(e) => set("perfil_url", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL do Post</Label>
            <Input value={form.post_url || ""} onChange={(e) => set("post_url", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tag de Origem</Label>
            <Input value={form.tag_origem || ""} onChange={(e) => set("tag_origem", e.target.value)} className="bg-secondary border-border" />
          </div>

          {/* Campos Extras */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Campos Extras</p>
            {Object.entries(camposExtras).map(([k, v]) => (
              <div key={k} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground min-w-[80px]">{k}:</span>
                <Input
                  value={v}
                  onChange={(e) => setCamposExtras((p) => ({ ...p, [k]: e.target.value }))}
                  className="bg-secondary border-border h-8 text-sm flex-1"
                />
                <button onClick={() => removeExtra(k)} className="p-1 text-destructive hover:opacity-70">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Chave" className="bg-secondary border-border h-8 text-sm" />
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Valor" className="bg-secondary border-border h-8 text-sm" />
              <button onClick={addExtra} className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tags */}
          <TagManager leadId={lead.id} assignedTagIds={assignedTagIds} onTagsChanged={fetchTags} />

          <button onClick={handleSave} disabled={saving} className="w-full gradient-button py-2.5 text-sm disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEditModal;
