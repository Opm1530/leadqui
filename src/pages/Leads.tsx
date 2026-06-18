import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Search, Plus, Trash2, Edit2, Download, MapPin, Instagram, PenLine, Loader2, Kanban
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LeadEditModal from "@/components/LeadEditModal";
import api from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-primary/20 text-primary",
  CONTATADO: "bg-warning/20 text-warning",
  QUALIFICADO: "bg-blue-500/20 text-blue-400",
  CONVERTIDO: "bg-success/20 text-success",
  PERDIDO: "bg-destructive/20 text-destructive",
};

const ORIGIN_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  GOOGLE_MAPS: { label: "Google Maps", cls: "bg-blue-500/20 text-blue-400", icon: MapPin },
  INSTAGRAM: { label: "Instagram", cls: "bg-purple-500/20 text-purple-400", icon: Instagram },
  MANUAL: { label: "Manual", cls: "bg-gray-500/20 text-gray-400", icon: PenLine },
};

const OriginBadge = ({ origem }: { origem: string }) => {
  const cfg = ORIGIN_CONFIG[origem?.toUpperCase()] || ORIGIN_CONFIG.MANUAL;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const ITEMS_PER_PAGE = 15;

const LEAD_SERVICES = ["Gestão de Tráfego", "Social Media", "CRM", "Automação", "Design", "Landing Page"];

const Leads = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<any[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tagFilter, setTagFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [crmColumns, setCrmColumns] = useState<any[]>([]);

  // Modals
  const [editingLead, setEditingLead] = useState<any>(null);
  const [newLeadModal, setNewLeadModal] = useState(false);
  const emptyLeadForm = {
    nome: "", telefone: "", cidade: "", email: "", endereco: "", website: "", categoria: "",
    status: "NOVO", observacao: "",
    valor_proposto: "", duracao_proposta: "", responsavel_proposto: "", servicos_propostos: [] as string[],
  };
  const [newForm, setNewForm] = useState({ ...emptyLeadForm });
  const [savingNew, setSavingNew] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String((page - 1) * ITEMS_PER_PAGE),
      });
      if (statusFilter !== "todos") params.set("status", statusFilter);
      if (searchTerm) params.set("search", searchTerm);
      if (tagFilter !== "todos") params.set("tag_id", tagFilter);

      const data = await api.get(`/api/leads?${params}`);
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      toast({ title: "Erro ao carregar leads", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, tagFilter, toast]);

  const fetchTags = async () => {
    try {
      const data = await api.get("/api/tags");
      setTags(data.tags || []);
    } catch {}
  };

  const fetchCrmColumns = async () => {
    try {
      const data = await api.get("/api/crm/columns");
      setCrmColumns(data.columns || []);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    fetchTags();
    fetchCrmColumns();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setCurrentPage(1);
    fetchLeads(1);
  }, [user, statusFilter, tagFilter]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => { setCurrentPage(1); fetchLeads(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchLeads(page);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lead?")) return;
    try {
      await api.delete(`/api/leads/${id}`);
      toast({ title: "Lead excluído!" });
      fetchLeads(currentPage);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selectedIds.size} lead(s)?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/api/leads/${id}`)));
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} lead(s) excluídos` });
      fetchLeads(1);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateLead = async () => {
    if (!newForm.nome.trim()) return;
    setSavingNew(true);
    try {
      await api.post("/api/leads", {
        nome: newForm.nome.trim(),
        telefone: newForm.telefone || null,
        cidade: newForm.cidade || null,
        email: newForm.email || null,
        endereco: newForm.endereco || null,
        website: newForm.website || null,
        categoria: newForm.categoria || null,
        status: newForm.status,
        observacao: newForm.observacao || null,
        valor_proposto: newForm.valor_proposto || null,
        duracao_proposta: newForm.duracao_proposta || null,
        responsavel_proposto: newForm.responsavel_proposto || null,
        servicos_propostos: newForm.servicos_propostos,
        origem: "MANUAL",
      });
      toast({ title: "Lead criado!" });
      setNewLeadModal(false);
      setNewForm({ ...emptyLeadForm });
      fetchLeads(1);
    } catch (error: any) {
      toast({ title: "Erro ao criar lead", description: error.message, variant: "destructive" });
    } finally {
      setSavingNew(false);
    }
  };

  const handleSendToCRM = async (leadId: string) => {
    if (crmColumns.length === 0) {
      toast({ title: "Erro", description: "Crie ao menos uma coluna no CRM primeiro.", variant: "destructive" });
      return;
    }
    try {
      await api.post("/api/crm/cards", { lead_id: leadId, coluna_id: crmColumns[0].id });
      toast({ title: "Lead enviado ao CRM!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const exportCSV = () => {
    const header = "Nome,Telefone,Cidade,Status,Origem,Criado em";
    const rows = leads.map((l) =>
      `"${l.nome}","${l.telefone || ""}","${l.cidade || ""}","${l.status}","${l.origem}","${new Date(l.created_at).toLocaleDateString("pt-BR")}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      leads.forEach((l) => next.delete(l.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      leads.forEach((l) => next.add(l.id));
      setSelectedIds(next);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total: <span className="text-primary font-bold">{total}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-4 py-2 border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground rounded-lg flex items-center gap-2 text-sm transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={() => setNewLeadModal(true)} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Lead
          </button>
        </div>
      </div>

      {/* Seleção em massa */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card p-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado(s)</span>
            <button onClick={handleDeleteSelected} className="px-3 py-1.5 text-sm rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Excluir selecionados
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">Cancelar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros */}
      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="NOVO">Novo</SelectItem>
            <SelectItem value="CONTATADO">Contatado</SelectItem>
            <SelectItem value="QUALIFICADO">Qualificado</SelectItem>
            <SelectItem value="CONVERTIDO">Convertido</SelectItem>
            <SelectItem value="PERDIDO">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as tags</SelectItem>
            {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum lead encontrado com os filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cidade</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <motion.tr key={lead.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleOne(lead.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                          {lead.perfil_url && (
                            <a href={lead.perfil_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors" title="Ver Instagram">
                              <Instagram className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.maps_url && (
                            <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" title="Ver Google Maps">
                              <MapPin className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{lead.telefone || "—"}</td>
                    <td className="p-3 text-sm text-muted-foreground">{lead.cidade || "—"}</td>
                    <td className="p-3"><OriginBadge origem={lead.origem} /></td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || "bg-gray-500/20 text-gray-400"}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags || []).slice(0, 3).map((lt: any) => (
                          <span key={`${lead.id}-${lt.tag_id}`} className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: lt.tag?.cor || "#6366f1" }}>
                            {lt.tag?.nome}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleSendToCRM(lead.id)} className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors" title="Enviar para o CRM">
                          <Kanban className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingLead(lead)} className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(lead.id)} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="px-3 py-1.5 text-sm rounded-md bg-secondary border border-border disabled:opacity-40 hover:bg-secondary/80">← Anterior</button>
          <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="px-3 py-1.5 text-sm rounded-md bg-secondary border border-border disabled:opacity-40 hover:bg-secondary/80">Próxima →</button>
        </div>
      )}

      {/* Modal Novo Lead */}
      <Dialog open={newLeadModal} onOpenChange={(v) => !v && setNewLeadModal(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription className="sr-only">Preencha os dados do lead. Campos do contrato são opcionais e pré-carregam a conversão em cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nome *", key: "nome", placeholder: "Nome completo", col: 2 },
                { label: "Telefone", key: "telefone", placeholder: "11999999999" },
                { label: "E-mail", key: "email", placeholder: "contato@empresa.com" },
                { label: "Cidade", key: "cidade", placeholder: "São Paulo" },
                { label: "Categoria", key: "categoria", placeholder: "Ex: Restaurante" },
                { label: "Endereço", key: "endereco", placeholder: "Rua...", col: 2 },
                { label: "Website", key: "website", placeholder: "https://...", col: 2 },
              ].map((field) => (
                <div key={field.key} className={`space-y-1.5 ${field.col === 2 ? "col-span-2" : ""}`}>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">{field.label}</Label>
                  <Input value={(newForm as any)[field.key]} onChange={(e) => setNewForm({ ...newForm, [field.key]: e.target.value })} placeholder={field.placeholder} className="bg-secondary border-border" />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={newForm.status} onValueChange={(v) => setNewForm({ ...newForm, status: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="CONTATADO">Contatado</SelectItem>
                  <SelectItem value="QUALIFICADO">Qualificado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Observação</Label>
              <Textarea
                value={newForm.observacao}
                onChange={(e) => setNewForm({ ...newForm, observacao: e.target.value })}
                placeholder="Anotações sobre o lead, contexto da conversa..."
                className="bg-secondary border-border resize-none"
                rows={2}
              />
            </div>

            {/* Proposta (opcional) — pré-carrega a conversão em cliente */}
            <div className="rounded-xl border border-dashed border-border/60 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposta (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
                  <Input type="number" value={newForm.valor_proposto} onChange={(e) => setNewForm({ ...newForm, valor_proposto: e.target.value })} placeholder="0,00" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Duração (meses)</Label>
                  <Input type="number" value={newForm.duracao_proposta} onChange={(e) => setNewForm({ ...newForm, duracao_proposta: e.target.value })} placeholder="12" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Responsável interno</Label>
                  <Input value={newForm.responsavel_proposto} onChange={(e) => setNewForm({ ...newForm, responsavel_proposto: e.target.value })} className="bg-secondary border-border" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Serviços</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LEAD_SERVICES.map((svc) => {
                    const checked = newForm.servicos_propostos.includes(svc);
                    return (
                      <button key={svc} type="button"
                        onClick={() => setNewForm({ ...newForm, servicos_propostos: checked ? newForm.servicos_propostos.filter(s => s !== svc) : [...newForm.servicos_propostos, svc] })}
                        className={`text-xs px-2 py-1.5 rounded-lg border transition-colors text-left ${checked ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {svc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setNewLeadModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={handleCreateLead} disabled={savingNew || !newForm.nome.trim()} className="gradient-button px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                {savingNew && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Lead
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Lead */}
      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={() => fetchLeads(currentPage)}
      />
    </div>
  );
};

export default Leads;
