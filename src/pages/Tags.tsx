import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { firestoreService } from "@/lib/firestore";
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  Plus,
  Search,
  Tag as TagIcon,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#10b981",
  "#06b6d4","#3b82f6","#64748b","#a16207",
];

const Tags = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<any[]>([]);
  const [tagLeadCounts, setTagLeadCounts] = useState<Record<string, number>>({});
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("mais_usadas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formCor, setFormCor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const fetchTags = async () => {
    if (!user) return;
    try {
      const data = await firestoreService.list("tags", user.uid, [], "created_at");
      setTags(data);
      await fetchLeadCounts(data);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchLeadCounts = async (tagList: any[]) => {
    const counts: Record<string, number> = {};
    for (const tag of tagList) {
      const q = query(collection(db, "lead_tags"), where("tag_id", "==", tag.id));
      const snap = await getDocs(q);
      counts[tag.id] = snap.size;
    }
    setTagLeadCounts(counts);
  };

  useEffect(() => {
    fetchTags();
  }, [user]);

  const handleExpand = async (tagId: string) => {
    if (expandedTag === tagId) {
      setExpandedTag(null);
      return;
    }
    setExpandedTag(tagId);
    if (expandedLeads[tagId]) return;

    try {
      const q = query(collection(db, "lead_tags"), where("tag_id", "==", tagId));
      const snap = await getDocs(q);
      const leadIds = snap.docs.map((d) => d.data().lead_id);
      if (leadIds.length === 0) {
        setExpandedLeads((prev) => ({ ...prev, [tagId]: [] }));
        return;
      }
      // Fetch leads in chunks of 30
      const leads: any[] = [];
      for (let i = 0; i < leadIds.length; i += 30) {
        const chunk = leadIds.slice(i, i + 30);
        const leadsQ = query(collection(db, "leads"), where("__name__", "in", chunk));
        const leadsSnap = await getDocs(leadsQ);
        leadsSnap.docs.forEach((d) => leads.push({ id: d.id, ...d.data() }));
      }
      setExpandedLeads((prev) => ({ ...prev, [tagId]: leads }));
    } catch (error) {
      console.error("Error fetching leads for tag:", error);
    }
  };

  const openCreate = () => {
    setEditingTag(null);
    setFormNome("");
    setFormCor(COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (tag: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(tag);
    setFormNome(tag.nome);
    setFormCor(tag.cor || COLORS[0]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formNome.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        await firestoreService.update("tags", editingTag.id, {
          nome: formNome.trim(),
          cor: formCor,
        });
        toast({ title: "Tag atualizada!" });
      } else {
        await firestoreService.add("tags", user.uid, {
          nome: formNome.trim(),
          cor: formCor,
        });
        toast({ title: "Tag criada!" });
      }
      setModalOpen(false);
      fetchTags();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const count = tagLeadCounts[tag.id] || 0;
    if (!confirm(`Excluir a tag "${tag.nome}"? Ela será removida de ${count} lead(s).`)) return;
    try {
      // Delete all lead_tags associated
      const q = query(collection(db, "lead_tags"), where("tag_id", "==", tag.id));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "lead_tags", d.id))));
      // Delete the tag itself
      await firestoreService.delete("tags", tag.id);
      toast({ title: "Tag excluída!" });
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const filteredTags = tags
    .filter((t) => t.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "mais_usadas") return (tagLeadCounts[b.id] || 0) - (tagLeadCounts[a.id] || 0);
      if (sortBy === "alfabetica") return (a.nome || "").localeCompare(b.nome || "");
      // recentes
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tags</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as tags dos seus leads</p>
        </div>
        <button onClick={openCreate} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Nova Tag
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mais_usadas">Mais usadas</SelectItem>
            <SelectItem value="alfabetica">Alfabética</SelectItem>
            <SelectItem value="recentes">Mais recentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags Grid */}
      {filteredTags.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          {searchTerm ? "Nenhuma tag encontrada." : "Nenhuma tag criada ainda. Clique em 'Nova Tag' para começar."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map((tag, i) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card overflow-hidden"
            >
              {/* Card Header */}
              <div
                className="cursor-pointer"
                onClick={() => handleExpand(tag.id)}
              >
                {/* Color bar */}
                <div className="h-2 w-full" style={{ backgroundColor: tag.cor || COLORS[0] }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tag.cor || COLORS[0]}20` }}
                      >
                        <TagIcon className="w-5 h-5" style={{ color: tag.cor || COLORS[0] }} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{tag.nome}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" />
                          {tagLeadCounts[tag.id] || 0} lead(s) vinculado(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => openEdit(tag, e)}
                        className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(tag, e)}
                        className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedTag === tag.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expand: leads list */}
              <AnimatePresence>
                {expandedTag === tag.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-4 space-y-2">
                      {!expandedLeads[tag.id] ? (
                        <div className="flex justify-center py-2">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : expandedLeads[tag.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum lead vinculado.</p>
                      ) : (
                        expandedLeads[tag.id].map((lead) => (
                          <div
                            key={lead.id}
                            className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                              <p className="text-xs text-muted-foreground">{lead.telefone || "—"}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {lead.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Cliente VIP"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cor</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormCor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formCor === color ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: formCor }}
                >
                  {formNome || "Preview"}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formNome.trim()}
                className="gradient-button px-6 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingTag ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tags;
