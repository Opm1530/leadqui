import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { firestoreService } from "@/lib/firestore";
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  X,
  MapPin,
  Instagram,
  PenLine,
  Phone,
  User,
  Kanban,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LeadEditModal from "@/components/LeadEditModal";
import TagBadge from "@/components/TagBadge";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLUMN_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#10b981",
  "#06b6d4","#3b82f6","#64748b","#a16207",
];

const ORIGIN_BADGES: Record<string, { label: string; cls: string }> = {
  google_maps: { label: "Google Maps", cls: "bg-blue-500/20 text-blue-400" },
  instagram:   { label: "Instagram",   cls: "bg-purple-500/20 text-purple-400" },
  manual:      { label: "Manual",      cls: "bg-gray-500/20 text-gray-400" },
};

// ─── Sortable Card Component ───────────────────────────────────────────────────
const SortableCard = ({
  card,
  lead,
  leadTags,
  onClick,
}: {
  card: any;
  lead: any;
  leadTags: any[];
  onClick: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const origin = lead?.origem || "";
  const badge = ORIGIN_BADGES[origin];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="glass-card p-3 cursor-grab active:cursor-grabbing hover:bg-secondary/40 transition-colors select-none touch-none"
      onClick={onClick}
    >
      <div className="flex items-start gap-2 pointer-events-none">
        <div className="mt-0.5 text-muted-foreground/40 flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{lead?.nome || "—"}</p>
          {lead?.telefone && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {lead.telefone}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            {leadTags.map((t) => (
              <TagBadge key={t.id} nome={t.nome} cor={t.cor} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Droppable Column Component ───────────────────────────────────────────────
const DroppableColumn = ({ col, children, isActive = false }: any) => {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    data: {
      type: "Column",
      col,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-all duration-200 ${
        isOver ? "ring-2 ring-primary bg-primary/5" : isActive ? "ring-1 ring-primary/20" : ""
      }`}
      id={col.id}
    >
      {children}
    </div>
  );
};

// ─── CRM Component ────────────────────────────────────────────────────────────
const CRM = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [columns, setColumns] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [leadsMap, setLeadsMap] = useState<Record<string, any>>({});
  const [leadTagsMap, setLeadTagsMap] = useState<Record<string, any[]>>({});

  // Modal estados
  const [colModal, setColModal] = useState(false);
  const [colNome, setColNome] = useState("");
  const [colCor, setColCor] = useState(COLUMN_COLORS[0]);
  const [savingCol, setSavingCol] = useState(false);

  // Renomear coluna
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColNome, setEditingColNome] = useState("");

  // Add lead modal
  const [addLeadColId, setAddLeadColId] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [addingLead, setAddingLead] = useState(false);

  // Drawer
  const [drawerCard, setDrawerCard] = useState<any | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);

  // DnD
  const [activeCard, setActiveCard] = useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Ref sync to fix closure stale state in handleDragEnd 
  const cardsRef = useRef(cards);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [cols, cds] = await Promise.all([
        firestoreService.list("crm_colunas", user.uid, [], "posicao"),
        firestoreService.list("crm_cards", user.uid, [], "posicao"),
      ]);
      const sortedCols = [...cols].sort((a: any, b: any) => (a.posicao ?? 0) - (b.posicao ?? 0));
      setColumns(sortedCols);
      setCards(cds);

      // Fetch leads data
      const leadIds = [...new Set(cds.map((c: any) => c.lead_id))] as string[];
      if (leadIds.length > 0) {
        const leadsData: Record<string, any> = {};
        for (let i = 0; i < leadIds.length; i += 30) {
          const chunk = leadIds.slice(i, i + 30);
          const q = query(collection(db, "leads"), where("__name__", "in", chunk));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => { leadsData[d.id] = { id: d.id, ...d.data() }; });
        }
        setLeadsMap(leadsData);

        // Fetch tags
        const tagsData: Record<string, any[]> = {};
        for (let i = 0; i < leadIds.length; i += 30) {
          const chunk = leadIds.slice(i, i + 30);
          const q = query(collection(db, "lead_tags"), where("lead_id", "in", chunk));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            const { lead_id, tag_id } = d.data();
            const tagSnap = await getDocs(query(collection(db, "tags"), where("__name__", "in", [tag_id])));
            if (!tagsData[lead_id]) tagsData[lead_id] = [];
            tagSnap.docs.forEach((td) => tagsData[lead_id].push({ id: td.id, ...td.data() }));
          }
        }
        setLeadTagsMap(tagsData);
      }
    } catch (error) {
      console.error("Error fetching CRM data:", error);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Columns CRUD ─────────────────────────────────────────────────────────────
  const handleCreateColumn = async () => {
    if (!user || !colNome.trim()) return;
    setSavingCol(true);
    try {
      await addDoc(collection(db, "crm_colunas"), {
        nome: colNome.trim(),
        cor: colCor,
        posicao: columns.length,
        user_id: user.uid,
        created_at: serverTimestamp(),
      });
      toast({ title: "Coluna criada!" });
      setColModal(false);
      setColNome("");
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSavingCol(false);
    }
  };

  const handleDeleteColumn = async (col: any) => {
    const colCards = cards.filter((c) => c.coluna_id === col.id);
    if (!confirm(`Excluir a coluna "${col.nome}"${colCards.length > 0 ? ` e seus ${colCards.length} card(s)` : ""}?`)) return;
    try {
      await Promise.all(colCards.map((c) => deleteDoc(doc(db, "crm_cards", c.id))));
      await deleteDoc(doc(db, "crm_colunas", col.id));
      toast({ title: "Coluna excluída!" });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleRenameColumn = async (col: any) => {
    if (!editingColNome.trim() || editingColNome === col.nome) {
      setEditingColId(null);
      return;
    }
    try {
      await updateDoc(doc(db, "crm_colunas", col.id), { nome: editingColNome.trim() });
      setColumns((prev) => prev.map((c) => c.id === col.id ? { ...c, nome: editingColNome.trim() } : c));
    } catch (error: any) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    } finally {
      setEditingColId(null);
    }
  };

  // ── Add lead to column ────────────────────────────────────────────────────────
  const openAddLead = async (colId: string) => {
    setAddLeadColId(colId);
    setLeadSearch("");
    // Leads que ainda NÃO têm crm_card
    const cardLeadIds = new Set(cards.map((c) => c.lead_id));
    const allLeads = await firestoreService.list("leads", user?.uid, [], "", 500);
    setAvailableLeads(allLeads.filter((l: any) => !cardLeadIds.has(l.id)));
  };

  const handleAddLead = async (lead: any) => {
    if (!user || !addLeadColId) return;
    setAddingLead(true);
    try {
      const colCards = cards.filter((c) => c.coluna_id === addLeadColId);
      await addDoc(collection(db, "crm_cards"), {
        lead_id: lead.id,
        coluna_id: addLeadColId,
        posicao: colCards.length,
        user_id: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      toast({ title: `${lead.nome} adicionado ao CRM!` });
      setAddLeadColId(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setAddingLead(false);
    }
  };

  const handleRemoveCard = async (card: any) => {
    if (!confirm("Remover este lead do CRM?")) return;
    try {
      await deleteDoc(doc(db, "crm_cards", card.id));
      toast({ title: "Lead removido do CRM." });
      setDrawerCard(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  };

  // Helper to find column ID from card ID or directly if it's already a column
  const findContainer = (id: string) => {
    if (columns.some(col => col.id === id)) return id;
    const card = cards.find(c => c.id === id);
    return card?.coluna_id;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (activeContainer && overContainer && activeContainer !== overContainer) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === active.id ? { ...c, coluna_id: overContainer } : c
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    // Utilize o estado mais recente em vez do closure original
    const latestCards = cardsRef.current;
    const activeCard = latestCards.find((c) => c.id === active.id);
    if (!activeCard) return;

    try {
      // Persist column change made by handleDragOver
      await updateDoc(doc(db, "crm_cards", activeCard.id), {
        coluna_id: activeCard.coluna_id,
        updated_at: serverTimestamp(),
      });

      // Reorder within the latest column assigned
      const colCards = latestCards
        .filter((c) => c.coluna_id === activeCard.coluna_id)
        .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0));

      const oldIndex = colCards.findIndex((c) => c.id === active.id);
      let newIndex = colCards.findIndex((c) => c.id === over.id);

      // Se dropou fora de um card (ex: no header ou container vazio), tenta achar a nova coluna
      if (newIndex === -1) {
        // Se 'over' for o ID da coluna
        if (columns.some(c => c.id === over.id)) {
           newIndex = colCards.length > 0 ? colCards.length - 1 : 0;
        } else {
           // Se não achou posição, não reordena
           return;
        }
      }

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colCards, oldIndex, newIndex);
        await Promise.all(
          reordered.map((c, idx) =>
            updateDoc(doc(db, "crm_cards", c.id), { posicao: idx })
          )
        );
        setCards((prev) => {
          const others = prev.filter((c) => c.coluna_id !== activeCard.coluna_id);
          const updated = reordered.map((c, idx) => ({ ...c, posicao: idx }));
          return [...others, ...updated];
        });
      }
    } catch (error) {
      console.error("Error saving drag result:", error);
      fetchAll();
    }
  };

  const filteredAvailableLeads = availableLeads.filter((l) =>
    !leadSearch ||
    l.nome?.toLowerCase().includes(leadSearch.toLowerCase()) ||
    l.telefone?.includes(leadSearch)
  );

  const drawerLead = drawerCard ? leadsMap[drawerCard.lead_id] : null;

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Kanban className="w-6 h-6 text-primary" />
            CRM
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organize seus leads em colunas personalizadas
          </p>
        </div>
        <button
          onClick={() => { setColNome(""); setColCor(COLUMN_COLORS[0]); setColModal(true); }}
          className="gradient-button px-4 py-2 flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Coluna
        </button>
      </div>

      {/* Board */}
      {columns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <Kanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nenhuma coluna criada ainda. Clique em <strong>+ Nova Coluna</strong> para começar.
          </p>
        </motion.div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
            {columns.map((col) => {
              const colCards = cards
                .filter((c) => c.coluna_id === col.id)
                .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0));

              return (
                <DroppableColumn key={col.id} col={col} isActive={activeCard?.coluna_id === col.id}>
                  {/* Column header */}
                  <div
                    className="rounded-t-xl p-3 flex items-center justify-between"
                    style={{ backgroundColor: `${col.cor}25`, borderBottom: `2px solid ${col.cor}` }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.cor }} />
                      {editingColId === col.id ? (
                        <input
                          autoFocus
                          value={editingColNome}
                          onChange={(e) => setEditingColNome(e.target.value)}
                          onBlur={() => handleRenameColumn(col)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameColumn(col);
                            if (e.key === "Escape") setEditingColId(null);
                          }}
                          className="bg-transparent border-b border-foreground/30 text-sm font-semibold text-foreground outline-none flex-1 min-w-0"
                        />
                      ) : (
                        <span
                          className="text-sm font-semibold text-foreground truncate cursor-pointer hover:opacity-75"
                          onDoubleClick={() => { setEditingColId(col.id); setEditingColNome(col.nome); }}
                          title="Duplo clique para renomear"
                        >
                          {col.nome}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                        {colCards.length}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteColumn(col)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cards list */}
                  <div className="flex-1 rounded-b-xl bg-secondary/20 p-2 space-y-2 min-h-[100px]">
                    <SortableContext
                      items={colCards.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {colCards.map((card) => (
                        <SortableCard
                          key={card.id}
                          card={card}
                          lead={leadsMap[card.lead_id]}
                          leadTags={leadTagsMap[card.lead_id] || []}
                          onClick={() => setDrawerCard(card)}
                        />
                      ))}
                    </SortableContext>

                    {/* Add lead button */}
                    <button
                      onClick={() => openAddLead(col.id)}
                      className="w-full p-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar lead
                    </button>
                  </div>
                </DroppableColumn>
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeCard && (
              <div className="glass-card p-3 shadow-xl rotate-2 opacity-90 w-72">
                <p className="text-sm font-medium text-foreground">
                  {leadsMap[activeCard.lead_id]?.nome || "—"}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal Nova Coluna */}
      <Dialog open={colModal} onOpenChange={(v) => !v && setColModal(false)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome</Label>
              <Input
                value={colNome}
                onChange={(e) => setColNome(e.target.value)}
                placeholder="Ex: Em Negociação"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cor</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLUMN_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColCor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${colCor === color ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div
              className="h-1.5 w-full rounded-full"
              style={{ backgroundColor: colCor }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setColModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={handleCreateColumn}
                disabled={savingCol || !colNome.trim()}
                className="gradient-button px-6 py-2 text-sm disabled:opacity-50"
              >
                {savingCol ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Lead */}
      <Dialog open={!!addLeadColId} onOpenChange={(v) => !v && setAddLeadColId(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Adicionar Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="bg-secondary border-border"
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredAvailableLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {availableLeads.length === 0
                    ? "Todos os leads já estão no CRM."
                    : "Nenhum lead encontrado."}
                </p>
              ) : (
                filteredAvailableLeads.slice(0, 50).map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => handleAddLead(lead)}
                    disabled={addingLead}
                    className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">{lead.telefone || "—"} · {lead.origem || "—"}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer lateral — detalhes do lead */}
      <Sheet open={!!drawerCard} onOpenChange={(v) => !v && setDrawerCard(null)}>
        <SheetContent className="bg-card border-l border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Detalhes do Lead
            </SheetTitle>
          </SheetHeader>

          {drawerLead && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome</p>
                <p className="text-lg font-semibold text-foreground mt-0.5">{drawerLead.nome}</p>
              </div>
              {drawerLead.telefone && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</p>
                  <p className="text-sm text-foreground mt-0.5">{drawerLead.telefone}</p>
                </div>
              )}
              {drawerLead.cidade && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cidade</p>
                  <p className="text-sm text-foreground mt-0.5">{drawerLead.cidade}</p>
                </div>
              )}
              {drawerLead.origem && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Origem</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ORIGIN_BADGES[drawerLead.origem]?.cls || "bg-primary/10 text-primary"}`}>
                    {ORIGIN_BADGES[drawerLead.origem]?.label || drawerLead.origem}
                  </span>
                </div>
              )}
              {drawerLead.status && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {drawerLead.status}
                  </span>
                </div>
              )}
              {(leadTagsMap[drawerLead.id] || []).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {(leadTagsMap[drawerLead.id] || []).map((t) => (
                      <TagBadge key={t.id} nome={t.nome} cor={t.cor} />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <button
                  onClick={() => setEditingLead(drawerLead)}
                  className="gradient-button py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar Lead
                </button>
                <button
                  onClick={() => drawerCard && handleRemoveCard(drawerCard)}
                  className="py-2.5 text-sm border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Remover do CRM
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lead Edit Modal */}
      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={() => { fetchAll(); setEditingLead(null); }}
      />
    </div>
  );
};

export default CRM;
