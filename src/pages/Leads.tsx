import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Filter, Trash2, Edit2, Download, ArrowRight, Check, X, User, ExternalLink, MapPin, Instagram, Kanban, CheckSquare, PenLine } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import { firestoreService } from "@/lib/firestore";
import { collection, query, where, onSnapshot, limit, addDoc, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TagBadge from "@/components/TagBadge";
import LeadEditModal from "@/components/LeadEditModal";
import TagManager from "@/components/TagManager";

// ─── Status / Origin helpers ──────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  novo:       "bg-primary/20 text-primary",
  contatado:  "bg-warning/20 text-warning",
  respondeu:  "bg-info/20 text-info",
  convertido: "bg-success/20 text-success",
};

const ORIGIN_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  google_maps: { label: "Google Maps", cls: "bg-blue-500/20 text-blue-400",   icon: MapPin    },
  instagram:   { label: "Instagram",   cls: "bg-purple-500/20 text-purple-400", icon: Instagram },
  manual:      { label: "Manual",      cls: "bg-gray-500/20 text-gray-400",   icon: PenLine   },
};

// ─── Origin Badge ─────────────────────────────────────────────────────────────
const OriginBadge = ({ origem }: { origem: string }) => {
  const cfg = ORIGIN_CONFIG[origem];
  if (!cfg) return <span className="text-xs text-muted-foreground">{origem || "—"}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Leads Page ───────────────────────────────────────────────────────────────
const Leads = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [originFilter, setOriginFilter] = useState("todos");
  const [tagFilter, setTagFilter] = useState("todos");
  const [tags, setTags] = useState<any[]>([]);
  const [leadTags, setLeadTags] = useState<Record<string, any[]>>({});
  const [editingLead, setEditingLead] = useState<any>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // New lead modal
  const [newLeadModal, setNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ nome: "", telefone: "", cidade: "", status: "novo" });
  const [savingNew, setSavingNew] = useState(false);
  const [newLeadTagIds, setNewLeadTagIds] = useState<string[]>([]);

  // CRM column modal
  const [crmModal, setCrmModal] = useState(false);
  const [crmColumns, setCrmColumns] = useState<any[]>([]);
  const [crmTargetLeadIds, setCrmTargetLeadIds] = useState<string[]>([]);
  const [movingToCrm, setMovingToCrm] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTags = async () => {
      const data = await firestoreService.list("tags", user.uid);
      setTags(data);
    };
    fetchTags();
    setLoading(true);
    const q = query(collection(db, "leads"), limit(1000));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        created_at: (doc.data() as any).created_at?.toDate?.()?.toISOString() || (doc.data() as any).created_at,
        updated_at: (doc.data() as any).updated_at?.toDate?.()?.toISOString() || (doc.data() as any).updated_at,
      }));
      const sorted = [...data].sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setLeads(sorted);
      setLoading(false);
      const leadIds = data.map((l) => l.id);
      if (leadIds.length > 0) {
        try {
          const lTags = await firestoreService.getLeadTags(leadIds);
          setLeadTags(lTags);
        } catch (err) {
          console.error("Error fetching lead tags:", err);
        }
      }
    }, (error) => {
      console.error("Error fetching leads:", error);
      toast({ title: "Erro ao carregar leads", description: error.message, variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredLeads = leads.filter((lead) => {
    const lowSearch = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      lead.nome?.toLowerCase().includes(lowSearch) ||
      lead.telefone?.toLowerCase().includes(lowSearch) ||
      lead.username?.toLowerCase().includes(lowSearch);
    const matchesTag = tagFilter === "todos" ||
      (leadTags[lead.id] || []).some((t: any) => t.id === tagFilter);
    const matchesStatus = statusFilter === "todos" ||
      lead.status?.toLowerCase() === statusFilter.toLowerCase();
    const normalizedOrigin = originFilter === "Google Maps" ? "google_maps" :
      originFilter === "Instagram" ? "instagram" : originFilter;
    const matchesOrigin = originFilter === "todos" ||
      lead.origem?.toLowerCase() === normalizedOrigin.toLowerCase() ||
      lead.origem?.toLowerCase() === originFilter.toLowerCase();
    return matchesSearch && matchesTag && matchesStatus && matchesOrigin;
  });

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, originFilter, tagFilter]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Selection ─────────────────────────────────────────────────────────────
  const allVisibleSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      // Remove all visible from selection
      const newSelected = new Set(selectedIds);
      paginatedLeads.forEach(l => newSelected.delete(l.id));
      setSelectedIds(newSelected);
    } else {
      // Add all visible to selection
      const newSelected = new Set(selectedIds);
      paginatedLeads.forEach(l => newSelected.add(l.id));
      setSelectedIds(newSelected);
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteLeadAndRelations = async (id: string) => {
    // Delete orphan CRM cards
    const cardsSnap = await getDocs(query(collection(db, "crm_cards"), where("lead_id", "==", id)));
    const removeCards = cardsSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(removeCards);

    // Delete orphan Lead Tags pivot rows
    const tagsSnap = await getDocs(query(collection(db, "lead_tags"), where("lead_id", "==", id)));
    const removeTags = tagsSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(removeTags);

    // Finally delete Lead
    await firestoreService.delete("leads", id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead e todos os seus vínculos no CRM e Tags?")) return;
    try {
      await deleteLeadAndRelations(id);
      toast({ title: "Lead excluído com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro na exclusão", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir permanentemente ${selectedIds.size} lead(s) e seus vínculos?`)) return;
    try {
      await Promise.all([...selectedIds].map(deleteLeadAndRelations));
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} lead(s) apagado(s)` });
    } catch (error: any) {
      toast({ title: "Erro ao excluir em massa", description: error.message, variant: "destructive" });
    }
  };

  // ── New Lead ─────────────────────────────────────────────────────────────
  const handleCreateLead = async () => {
    if (!user || !newLeadForm.nome.trim()) return;
    setSavingNew(true);
    try {
      const phoneClean = newLeadForm.telefone ? newLeadForm.telefone.replace(/\D/g, "") : "";
      
      // 1. Verificar duplicidade por NOME
      if (newLeadForm.nome.trim()) {
        const qName = query(
          collection(db, "leads"),
          where("user_id", "==", user.uid),
          where("nome", "==", newLeadForm.nome.trim()),
          limit(1)
        );
        const snapName = await getDocs(qName);
        if (!snapName.empty) {
          toast({
            title: "Lead já existe",
            description: "Um lead com este nome já está cadastrado.",
            variant: "destructive"
          });
          setSavingNew(false);
          return;
        }
      }

      // 2. Verificar duplicidade por telefone
      if (phoneClean) {
        // Verificar duplicidade extendida (telefone_limpo ou telefone original)
        const qClean = query(
          collection(db, "leads"), 
          where("user_id", "==", user.uid), 
          where("telefone_limpo", "==", phoneClean),
          limit(1)
        );
        const qOriginal = query(
          collection(db, "leads"), 
          where("user_id", "==", user.uid), 
          where("telefone", "==", newLeadForm.telefone),
          limit(1)
        );

        const [snapClean, snapOriginal] = await Promise.all([
          getDocs(qClean),
          getDocs(qOriginal)
        ]);

        if (!snapClean.empty || !snapOriginal.empty) {
          toast({ 
            title: "Lead já existe", 
            description: "Um lead com este telefone já está cadastrado.",
            variant: "destructive"
          });
          setSavingNew(false);
          return;
        }
      }

      const docRef = await firestoreService.add("leads", user.uid, {
        nome: newLeadForm.nome.trim(),
        telefone: newLeadForm.telefone || null,
        telefone_limpo: phoneClean || null,
        cidade: newLeadForm.cidade || null,
        status: newLeadForm.status || "novo",
        origem: "manual",
      });
      // Assign tags
      for (const tagId of newLeadTagIds) {
        await addDoc(collection(db, "lead_tags"), {
          lead_id: (docRef as any).id,
          tag_id: tagId,
          created_at: serverTimestamp(),
        });
      }
      toast({ title: "Lead criado!" });
      setNewLeadModal(false);
      setNewLeadForm({ nome: "", telefone: "", cidade: "", status: "novo" });
      setNewLeadTagIds([]);
    } catch (error: any) {
      toast({ title: "Erro ao criar lead", description: error.message, variant: "destructive" });
    } finally {
      setSavingNew(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (!user || leads.length === 0) return;
    if (!confirm("Isso irá remover todos os leads com nomes ou contatos repetidos, mantendo apenas o registro mais antigo de cada um. Deseja continuar?")) return;
    
    setCleaning(true);
    try {
      const seenNames = new Set<string>();
      const seenPhones = new Set<string>();
      const toDelete: string[] = [];

      // Identificar duplicados mantendo o MAIS ANTIGO
      const sortedByDate = [...leads].sort((a, b) => 
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );

      for (const lead of sortedByDate) {
        const nameKey = (lead.nome || "").toLowerCase().trim();
        const phoneKey = lead.telefone_limpo || "";

        let isDup = false;
        if (nameKey && seenNames.has(nameKey)) isDup = true;
        if (phoneKey && seenPhones.has(phoneKey)) isDup = true;

        if (isDup) {
          toDelete.push(lead.id);
        } else {
          if (nameKey) seenNames.add(nameKey);
          if (phoneKey) seenPhones.add(phoneKey);
        }
      }

      if (toDelete.length === 0) {
        toast({ title: "Nenhum duplicado encontrado", description: "Seu banco de leads já está limpo!" });
        setCleaning(false);
        return;
      }

      // Executar deleções
      await Promise.all(toDelete.map((id) => deleteLeadAndRelations(id)));

      toast({ 
        title: "Limpeza concluída!", 
        description: `${toDelete.length} lead(s) duplicado(s) foram removidos.`
      });
    } catch (error: any) {
      toast({ title: "Erro na limpeza", description: error.message, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  // ── Move to CRM ───────────────────────────────────────────────────────────
  const openCrmModal = async (leadIds: string[]) => {
    setCrmTargetLeadIds(leadIds);
    const cols = await firestoreService.list("crm_colunas", user?.uid, [], "posicao");
    setCrmColumns([...cols].sort((a: any, b: any) => (a.posicao ?? 0) - (b.posicao ?? 0)));
    setCrmModal(true);
  };

  const handleMoveToColumn = async (colId: string) => {
    if (!user) return;
    setMovingToCrm(true);
    try {
      // 1. Verificar quais leads já existem em QUALQUER coluna do CRM do usuário
      const existingCardsSnap = await getDocs(query(
        collection(db, "crm_cards"), 
        where("user_id", "==", user.uid)
      ));
      const existingLeadIds = new Set(existingCardsSnap.docs.map(d => d.data().lead_id));
      
      const toAdd = crmTargetLeadIds.filter(id => !existingLeadIds.has(id));

      if (toAdd.length === 0) {
        toast({ title: "Aviso", description: "Todos os leads selecionados já estão no CRM." });
        setCrmModal(false);
        return;
      }

      // 2. Obter posição final da coluna alvo
      const targetSnap = await getDocs(query(
        collection(db, "crm_cards"), 
        where("coluna_id", "==", colId)
      ));
      let pos = targetSnap.size;

      // 3. Adicionar novos leads
      await Promise.all(toAdd.map((leadId) =>
        addDoc(collection(db, "crm_cards"), {
          lead_id: leadId,
          coluna_id: colId,
          posicao: pos++,
          user_id: user.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      ));
      toast({ title: `${toAdd.length} lead(s) movido(s) para o CRM!` });
      setCrmModal(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setMovingToCrm(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Leads</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">
              Total: <span className="text-primary font-bold">{leads.length}</span>
            </p>
            <span className="text-muted-foreground/30">|</span>
            <p className="text-muted-foreground text-sm">
              Filtrados: <span className="text-success font-bold">{filteredLeads.length}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanDuplicates}
            disabled={cleaning || leads.length === 0}
            className="px-4 py-2 border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground rounded-lg flex items-center gap-2 text-sm transition-colors"
            title="Remove leads com nomes ou telefones repetidos"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
            {cleaning ? "Limpando..." : "Limpar Duplicados"}
          </button>
          <button
            onClick={() => setNewLeadModal(true)}
            className="gradient-button px-4 py-2 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-secondary border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="contatado">Contatado</SelectItem>
              <SelectItem value="respondeu">Respondeu</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[160px] bg-secondary border-border">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas origens</SelectItem>
              <SelectItem value="Google Maps">Google Maps</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[150px] bg-secondary border-border">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {leads.length === 0
              ? "Nenhum lead encontrado. Comece extraindo leads na aba Extração."
              : "Nenhum lead corresponde aos filtros selecionados."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cidade</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${selectedIds.has(lead.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="p-4 text-sm text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        {lead.nome}
                        <div className="flex gap-1">
                          {lead.perfil_url && (
                            <a href={lead.perfil_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-80" title="Ver Perfil">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.post_url && (
                            <a href={lead.post_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:opacity-80" title="Ver Post">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.maps_url && (
                            <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:opacity-80" title="Ver no Maps">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{lead.telefone || "—"}</td>
                    <td className="p-4"><OriginBadge origem={lead.origem} /></td>
                    <td className="p-4 text-sm text-muted-foreground">{lead.cidade || "—"}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(leadTags[lead.id] || []).map((t: any) => (
                          <TagBadge key={t.id} nome={t.nome} cor={t.cor} />
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status] || ""}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openCrmModal([lead.id])}
                          className="p-1.5 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                          title="Mover para CRM"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingLead(lead)}
                          className="p-1.5 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {/* Controles de Paginação */}
            {totalPages > 1 && (
              <div className="p-4 flex items-center justify-between border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-secondary text-sm rounded-md disabled:opacity-50 hover:bg-secondary/80 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-secondary text-sm rounded-md disabled:opacity-50 hover:bg-secondary/80 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating selection bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card px-6 py-3 flex items-center gap-4 shadow-2xl border border-border/50 rounded-2xl"
          >
            <span className="text-sm text-foreground font-medium">
              <CheckSquare className="w-4 h-4 inline mr-1 text-primary" />
              {selectedIds.size} lead(s) selecionado(s)
            </span>
            <button
              onClick={() => openCrmModal([...selectedIds])}
              className="gradient-button px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Kanban className="w-3.5 h-3.5" />
              Mover para CRM
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-1.5 text-xs border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Novo Lead */}
      <Dialog open={newLeadModal} onOpenChange={(v) => !v && setNewLeadModal(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Novo Lead Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome *</Label>
                <Input
                  value={newLeadForm.nome}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome do lead"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</Label>
                <Input
                  value={newLeadForm.telefone}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cidade</Label>
                <Input
                  value={newLeadForm.cidade}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, cidade: e.target.value }))}
                  placeholder="São Paulo"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                <Select value={newLeadForm.status} onValueChange={(v) => setNewLeadForm((p) => ({ ...p, status: v }))}>
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
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setNewLeadModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={handleCreateLead}
                disabled={savingNew || !newLeadForm.nome.trim()}
                className="gradient-button px-6 py-2 text-sm disabled:opacity-50"
              >
                {savingNew ? "Salvando..." : "Criar Lead"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Mover para CRM */}
      <Dialog open={crmModal} onOpenChange={(v) => !v && setCrmModal(false)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Selecionar Coluna CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {crmColumns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Crie uma coluna no CRM primeiro antes de mover leads.
              </p>
            ) : (
              crmColumns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleMoveToColumn(col.id)}
                  disabled={movingToCrm}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                >
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: col.cor }} />
                  <span className="text-sm font-medium text-foreground">{col.nome}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={() => { }}
      />
    </div>
  );
};

export default Leads;
