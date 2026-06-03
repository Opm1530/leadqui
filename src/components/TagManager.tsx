import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import api from "@/lib/api";

interface TagManagerProps {
  leadId: string;
  assignedTagIds: string[];
  onChange?: (newTagIds: string[]) => void;
}

const TagManager = ({ leadId, assignedTagIds, onChange }: TagManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>(assignedTagIds);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(assignedTagIds);
  }, [assignedTagIds]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/tags").then((d) => setAllTags(d.tags || [])).catch(console.error);
  }, [user]);

  const toggle = (tagId: string) => {
    setSelected((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/api/leads/${leadId}/tags`, { tag_ids: selected });
      onChange?.(selected);
      setOpen(false);
      toast({ title: "Tags atualizadas!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = allTags.filter((t) => selected.includes(t.id));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {selectedTags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: tag.cor || "#6366f1" }}>
            {tag.nome}
          </span>
        ))}
        <button onClick={() => setOpen(!open)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Tags
        </button>
      </div>

      {open && (
        <div className="mt-2 p-3 bg-secondary rounded-lg border border-border space-y-2">
          <div className="flex flex-wrap gap-2">
            {allTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag criada.</p>}
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggle(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${selected.includes(tag.id) ? "text-white ring-2 ring-white/30" : "opacity-50"}`}
                style={{ backgroundColor: tag.cor || "#6366f1" }}
              >
                {selected.includes(tag.id) && <X className="w-2.5 h-2.5 inline mr-1" />}
                {tag.nome}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="text-xs gradient-button px-3 py-1 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManager;
