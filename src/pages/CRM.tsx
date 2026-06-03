import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext, DragOverlay, rectIntersection,
  PointerSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, DragOverEvent, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, Edit2, GripVertical, X,
  Phone, User, Kanban, Check, Loader2,
  Instagram, MapPin
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LeadEditModal from "@/components/LeadEditModal";
import ConvertLeadModal from "@/components/ConvertLeadModal";
import api from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLUMN_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#10b981",
  "#06b6d4","#3b82f6","#64748b","#a16207",
];

// ── SortableCard ──────────────────────────────────────────────────────────────
const SortableCard = ({ card, onClick }: { card: any; onClick: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const lead = card.lead;
  const tags = lead?.tags?.map((lt: any) => lt.tag).filter(Boolean) || [];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
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
              <Phone className="w-3 h-3" /> {lead.telefone}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((t: any) => (
              <span key={t?.id || t?.tag_id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: t?.cor || "#6366f1" }}>
                {t?.nome}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── DroppableColumn ───────────────────────────────────────────────────────────
const DroppableColumn = ({ col, children, isActive = false }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id, data: { type: "Column", col } });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-all duration-200 ${isOver ? "ring-2 ring-primary bg-primary/5" : isActive ? "ring-1 ring-primary/20" : ""}`}
      id={col.id}
    >
      {children}
    </div>
  );
};

// ── CRM Component ─────────────────────────────────────────────────────────────
const CRM = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [columns, setColumns] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // DnD
  const [activeCard, setActiveCard] = useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const cardsRef = useRef(cards);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [colData, cardData] = await Promise.all([
        api.get("/api/crm/columns"),
        api.get("/api/crm/cards"),
      ]);
      setColumns(colData.columns || []);
      setCards(cardData.cards || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar CRM", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Columns CRUD ─────────────────────────────────────────────────────────────
  const handleCreateColumn = async () => {
    if (!colNome.trim()) return;
    setSavingCol(true);
    try {
      const data = await api.post("/api/crm/columns", { nome: colNome.trim(), cor: colCor });
      setColumns((prev) => [...prev, data.column]);
      toast({ title: "Coluna criada!" });
      setColModal(false);
      setColNome("");
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
      await api.delete(`/api/crm/columns/${col.id}`);
      setColumns((prev) => prev.filter((c) => c.id !== col.id));
      setCards((prev) => prev.filter((c) => c.coluna_id !== col.id));
      toast({ title: "Coluna excluída!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleRenameColumn = async (col: any) => {
    if (!editingColNome.trim() || editingColNome === col.nome) { setEditingColId(null); return; }
    try {
      await api.put(`/api/crm/columns/${col.id}`, { nome: editingColNome.trim() });
      setColumns((prev) => prev.map((c) => c.id === col.id ? { ...c, nome: editingColNome.trim() } : c));
    } catch (error: any) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    } finally {
      setEditingColId(null);
    }
  };

  // ── Add lead ─────────────────────────────────────────────────────────────────
  const openAddLead = async (colId: string) => {
    setAddLeadColId(colId);
    setLeadSearch("");
    try {
      const cardLeadIds = new Set(cards.map((c) => c.lead_id));
      const data = await api.get("/api/leads?limit=200");
      setAvailableLeads((data.leads || []).filter((l: any) => !cardLeadIds.has(l.id)));
    } catch {}
  };

  const handleAddLead = async (lead: any) => {
    if (!addLeadColId) return;
    setAddingLead(true);
    try {
      const data = await api.post("/api/crm/cards", { lead_id: lead.id, coluna_id: addLeadColId });
      setCards((prev) => [...prev, data.card]);
      toast({ title: `${lead.nome} adicionado ao CRM!` });
      setAddLeadColId(null);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setAddingLead(false);
    }
  };

  const handleRemoveCard = async (card: any) => {
    if (!confirm("Remover este lead do CRM?")) return;
    try {
      await api.delete(`/api/crm/cards/${card.id}`);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      toast({ title: "Lead removido do CRM." });
      setDrawerCard(null);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const findContainer = (id: string) => {
    if (columns.some((col) => col.id === id)) return id;
    return cards.find((c) => c.id === id)?.coluna_id;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCard(cards.find((c) => c.id === event.active.id) || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = findContainer(active.id as string);
    const to = findContainer(over.id as string);
    if (from && to && from !== to) {
      setCards((prev) => prev.map((c) => c.id === active.id ? { ...c, coluna_id: to } : c));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const latest = cardsRef.current;
    const moved = latest.find((c) => c.id === active.id);
    if (!moved) return;

    try {
      // Persist coluna_id change
      await api.put(`/api/crm/cards/${moved.id}`, { coluna_id: moved.coluna_id });

      // Reorder within column
      const col = latest.filter((c) => c.coluna_id === moved.coluna_id).sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0));
      const oldIdx = col.findIndex((c) => c.id === active.id);
      let newIdx = col.findIndex((c) => c.id === over.id);
      if (newIdx === -1) newIdx = columns.some((c) => c.id === over.id) ? col.length - 1 : -1;

      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(col, oldIdx, newIdx);
        await Promise.all(reordered.map((c, idx) => api.put(`/api/crm/cards/${c.id}`, { posicao: idx })));
        setCards((prev) => {
          const others = prev.filter((c) => c.coluna_id !== moved.coluna_id);
          return [...others, ...reordered.map((c, idx) => ({ ...c, posicao: idx }))];
        });
      }
    } catch (error) {
      console.error("Drag error:", error);
      fetchAll();
    }
  };

  const filteredAvailableLeads = availableLeads.filter((l) =>
    !leadSearch || l.nome?.toLowerCase().includes(leadSearch.toLowerCase()) || l.telefone?.includes(leadSearch)
  );

  const drawerLead = drawerCard?.lead || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Kanban className="w-6 h-6 text-primary" /> CRM
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Organize seus leads em colunas personalizadas</p>
        </div>
        <button onClick={() => { setColNome(""); setColCor(COLUMN_COLORS[0]); setColModal(true); }} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Coluna
        </button>
      </div>

      {/* Board */}
      {columns.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-12 text-center">
          <Kanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma coluna criada ainda. Clique em <strong>+ Nova Coluna</strong> para começar.</p>
        </motion.div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
            {columns.map((col) => {
              const colCards = cards.filter((c) => c.coluna_id === col.id).sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0));
              return (
                <DroppableColumn key={col.id} col={col} isActive={activeCard?.coluna_id === col.id}>
                  <div className="rounded-t-xl p-3 flex items-center justify-between" style={{ backgroundColor: `${col.cor}25`, borderBottom: `2px solid ${col.cor}` }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.cor }} />
                      {editingColId === col.id ? (
                        <input
                          autoFocus value={editingColNome}
                          onChange={(e) => setEditingColNome(e.target.value)}
                          onBlur={() => handleRenameColumn(col)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameColumn(col); if (e.key === "Escape") setEditingColId(null); }}
                          className="bg-transparent border-b border-foreground/30 text-sm font-semibold text-foreground outline-none flex-1 min-w-0"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-foreground truncate cursor-pointer hover:opacity-75" onDoubleClick={() => { setEditingColId(col.id); setEditingColNome(col.nome); }} title="Duplo clique para renomear">
                          {col.nome}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">{colCards.length}</span>
                    </div>
                    <button onClick={() => handleDeleteColumn(col)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 rounded-b-xl bg-secondary/20 p-2 space-y-2 min-h-[100px]">
                    <SortableContext items={colCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      {colCards.map((card) => (
                        <SortableCard key={card.id} card={card} onClick={() => setDrawerCard(card)} />
                      ))}
                    </SortableContext>
                    <button onClick={() => openAddLead(col.id)} className="w-full p-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar lead
                    </button>
                  </div>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="glass-card p-3 shadow-xl rotate-2 opacity-90 w-72">
                <p className="text-sm font-medium text-foreground">{activeCard.lead?.nome || "—"}</p>
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
            <DialogDescription className="sr-only">Crie uma nova coluna para organizar seus leads no funil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome</Label>
              <Input value={colNome} onChange={(e) => setColNome(e.target.value)} placeholder="Ex: Em Negociação" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cor</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLUMN_COLORS.map((color) => (
                  <button key={color} type="button" onClick={() => setColCor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${colCor === color ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : ""}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: colCor }} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setColModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={handleCreateColumn} disabled={savingCol || !colNome.trim()} className="gradient-button px-6 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                {savingCol && <Loader2 className="w-4 h-4 animate-spin" />}
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
            <DialogTitle>Adicionar Lead ao CRM</DialogTitle>
            <DialogDescription className="sr-only">Selecione um lead da lista para adicionar a esta coluna do CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Buscar por nome ou telefone..." value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} className="bg-secondary border-border" />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredAvailableLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {availableLeads.length === 0 ? "Todos os leads já estão no CRM." : "Nenhum lead encontrado."}
                </p>
              ) : (
                filteredAvailableLeads.slice(0, 50).map((lead) => (
                  <button key={lead.id} onClick={() => handleAddLead(lead)} disabled={addingLead} className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors disabled:opacity-50">
                    <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">{lead.telefone || "—"} · {lead.status}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer lateral */}
      <Sheet open={!!drawerCard} onOpenChange={(v) => !v && setDrawerCard(null)}>
        <SheetContent className="bg-card border-l border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Detalhes do Lead
            </SheetTitle>
            <SheetDescription className="sr-only">Informações detalhadas sobre o lead selecionado no CRM.</SheetDescription>
          </SheetHeader>
          {drawerLead && (
            <div className="mt-6 space-y-4">
              {[
                { label: "Nome", value: drawerLead.nome },
                { label: "Telefone", value: drawerLead.telefone },
                { label: "Cidade", value: drawerLead.cidade },
                { label: "E-mail", value: drawerLead.email },
                { label: "Status", value: drawerLead.status },
                { label: "Origem", value: drawerLead.origem },
                { label: "Link Perfil (Instagram)", value: drawerLead.perfil_url, isLink: true, icon: Instagram },
                { label: "Link Google Maps", value: drawerLead.maps_url, isLink: true, icon: MapPin },
              ].filter((f) => f.value).map((f: any) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{f.label}</p>
                  {f.isLink ? (
                    <a href={f.value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-0.5 font-medium flex items-center gap-2">
                       {f.icon && <f.icon className="w-3.5 h-3.5" />} {f.value}
                    </a>
                  ) : (
                    <p className="text-sm text-foreground mt-0.5 font-medium">{f.value}</p>
                  )}
                </div>
              ))}
              {(drawerLead.tags || []).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {drawerLead.tags.map((lt: any) => (
                      <span key={lt.tag?.id || lt.tag_id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: lt.tag?.cor || "#6366f1" }}>
                        {lt.tag?.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <button onClick={() => setEditingLead(drawerLead)} className="gradient-button py-2.5 text-sm flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4" /> Editar Lead
                </button>
                {drawerLead.status !== "CONVERTIDO" && (
                  <button onClick={() => setConvertModalOpen(true)} className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors border border-green-500/20">
                    <Check className="w-4 h-4" /> Converter em Cliente
                  </button>
                )}
                <button onClick={() => drawerCard && handleRemoveCard(drawerCard)} className="py-2.5 text-sm border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 flex items-center justify-center gap-2 transition-colors">
                  <X className="w-4 h-4" /> Remover do CRM
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <LeadEditModal lead={editingLead} open={!!editingLead} onClose={() => setEditingLead(null)} onSaved={() => { fetchAll(); setEditingLead(null); }} />
      <ConvertLeadModal lead={drawerLead} open={convertModalOpen} onClose={() => setConvertModalOpen(false)} onConverted={() => { fetchAll(); setDrawerCard(null); setConvertModalOpen(false); }} userId={""} />
    </div>
  );
};

export default CRM;
