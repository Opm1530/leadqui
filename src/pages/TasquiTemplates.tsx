import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical,
  LayoutTemplate, Clock, Save, X, Loader2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  BAIXA:   { label: "Baixa",   color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
  MEDIA:   { label: "Média",   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  ALTA:    { label: "Alta",    color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  URGENTE: { label: "Urgente", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const SERVICES = ["Gestão de Tráfego", "Social Media", "CRM", "Automação", "Design", "Landing Page"];

const emptyItem = () => ({ title: "", description: "", priority: "MEDIA", due_days_offset: 0 });

const TasquiTemplates = ({ embedded = false }: { embedded?: boolean }) => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Modal criar/editar template
  const [templateModal, setTemplateModal] = useState<"create" | "edit" | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [tForm, setTForm] = useState({ name: "", description: "", service: "" });
  const [saving, setSaving] = useState(false);

  // Modal adicionar/editar item
  const [itemModal, setItemModal] = useState<{ templateId: string; item?: any } | null>(null);
  const [iForm, setIForm] = useState(emptyItem());
  const [savingItem, setSavingItem] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/templates");
      setTemplates(data.templates || []);
    } catch {
      toast({ title: "Erro ao carregar templates", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!embedded) setActiveModule("tasqui");
    load();
  }, []);

  // ── Template CRUD ───────────────────────────────────────────────────

  const openCreateTemplate = () => {
    setTForm({ name: "", description: "", service: "" });
    setTemplateModal("create");
  };

  const openEditTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTForm({ name: tpl.name, description: tpl.description || "", service: tpl.service || "" });
    setTemplateModal("edit");
  };

  const handleSaveTemplate = async () => {
    if (!tForm.name.trim()) {
      toast({ title: "Nome do template é obrigatório.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (templateModal === "create") {
        const data = await api.post("/api/templates", tForm);
        setTemplates(prev => [data.template, ...prev]);
        setExpanded(data.template.id);
        toast({ title: "Template criado!" });
      } else if (editingTemplate) {
        const data = await api.put(`/api/templates/${editingTemplate.id}`, tForm);
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? data.template : t));
        toast({ title: "Template atualizado!" });
      }
      setTemplateModal(null);
    } catch {
      toast({ title: "Erro ao salvar template", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteTemplate = async (tpl: any) => {
    if (!confirm(`Excluir template "${tpl.name}"? Isso não pode ser desfeito.`)) return;
    try {
      await api.delete(`/api/templates/${tpl.id}`);
      setTemplates(prev => prev.filter(t => t.id !== tpl.id));
      toast({ title: "Template excluído." });
    } catch {
      toast({ title: "Erro ao excluir template", variant: "destructive" });
    }
  };

  // ── Item CRUD ───────────────────────────────────────────────────────

  const openAddItem = (templateId: string) => {
    setIForm(emptyItem());
    setItemModal({ templateId });
  };

  const openEditItem = (templateId: string, item: any) => {
    setIForm({
      title:           item.title,
      description:     item.description || "",
      priority:        item.priority,
      due_days_offset: item.due_days_offset,
    });
    setItemModal({ templateId, item });
  };

  const handleSaveItem = async () => {
    if (!iForm.title.trim()) {
      toast({ title: "Título da tarefa é obrigatório.", variant: "destructive" });
      return;
    }
    if (!itemModal) return;
    setSavingItem(true);
    try {
      if (itemModal.item) {
        // editar
        await api.put(`/api/templates/${itemModal.templateId}/items/${itemModal.item.id}`, iForm);
      } else {
        // criar
        await api.post(`/api/templates/${itemModal.templateId}/items`, iForm);
      }
      await load();
      setItemModal(null);
      toast({ title: itemModal.item ? "Tarefa atualizada!" : "Tarefa adicionada!" });
    } catch {
      toast({ title: "Erro ao salvar tarefa", variant: "destructive" });
    }
    setSavingItem(false);
  };

  const handleDeleteItem = async (templateId: string, itemId: string) => {
    try {
      await api.delete(`/api/templates/${templateId}/items/${itemId}`);
      setTemplates(prev => prev.map(t =>
        t.id === templateId ? { ...t, items: t.items.filter((i: any) => i.id !== itemId) } : t
      ));
      toast({ title: "Tarefa removida." });
    } catch {
      toast({ title: "Erro ao remover tarefa", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-blue-400" />
            Templates de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conjuntos de tarefas aplicados automaticamente ao converter um lead em cliente.
          </p>
        </div>
        <Button onClick={openCreateTemplate} className="gradient-button gap-2">
          <Plus className="w-4 h-4" /> Novo Template
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <LayoutTemplate className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-black text-foreground">Nenhum template criado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Crie um template com as tarefas padrão do seu onboarding e aplique automaticamente ao converter um lead.
          </p>
          <Button onClick={openCreateTemplate} className="gradient-button gap-2">
            <Plus className="w-4 h-4" /> Criar Primeiro Template
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl, i) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* Template header */}
              <div className="flex items-center justify-between px-5 py-4 gap-4">
                <button
                  onClick={() => setExpanded(expanded === tpl.id ? null : tpl.id)}
                  className="flex items-center gap-3 text-left min-w-0 flex-1 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <LayoutTemplate className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-foreground text-sm">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tpl.items.length} tarefa{tpl.items.length !== 1 ? "s" : ""}
                      {tpl.service && <span className="ml-2 text-blue-400">· {tpl.service}</span>}
                      {tpl.description && <span className="ml-2">· {tpl.description}</span>}
                    </p>
                  </div>
                  {expanded === tpl.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />}
                </button>

                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEditTemplate(tpl)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-white">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(tpl)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Items */}
              <AnimatePresence>
                {expanded === tpl.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-5 py-4 space-y-2">
                      {tpl.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma tarefa ainda. Adicione a primeira abaixo.
                        </p>
                      ) : (
                        tpl.items.map((item: any, idx: number) => {
                          const pCfg = PRIORITY_CFG[item.priority] || PRIORITY_CFG.MEDIA;
                          return (
                            <div key={item.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50 group"
                            >
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                              <span className="text-xs font-black text-muted-foreground/40 w-5 shrink-0">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-foreground">{item.title}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.due_days_offset > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />{item.due_days_offset}d
                                  </span>
                                )}
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pCfg.color}`}>
                                  {pCfg.label}
                                </span>
                                <button onClick={() => openEditItem(tpl.id, item)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteItem(tpl.id, item.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <Button variant="outline" size="sm" onClick={() => openAddItem(tpl.id)}
                        className="w-full mt-2 border-dashed border-border text-muted-foreground hover:text-white gap-2 h-9">
                        <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal Template ── */}
      <Dialog open={!!templateModal} onOpenChange={(o) => !o && setTemplateModal(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{templateModal === "create" ? "Novo Template" : "Editar Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs leading-relaxed">
              Templates são conjuntos de tarefas criados automaticamente quando um lead é convertido em cliente.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Nome do Template *</Label>
              <Input
                value={tForm.name}
                onChange={e => setTForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Onboarding Social Media"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Input
                value={tForm.description}
                onChange={e => setTForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrição do template..."
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                Serviço Vinculado
                <span className="ml-1 normal-case font-normal text-muted-foreground/60">(auto-aplica para este serviço)</span>
              </Label>
              <Select value={tForm.service} onValueChange={v => setTForm(f => ({ ...f, service: v === "none" ? "" : v }))}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Nenhum (aplicar manualmente)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateModal(null)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={saving} className="gradient-button gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Item ── */}
      <Dialog open={!!itemModal} onOpenChange={(o) => !o && setItemModal(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{itemModal?.item ? "Editar Tarefa" : "Adicionar Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input
                value={iForm.title}
                onChange={e => setIForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Briefing com o cliente"
                className="bg-secondary border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea
                value={iForm.description}
                onChange={e => setIForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes da tarefa..."
                className="bg-secondary border-border h-20 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select value={iForm.priority} onValueChange={v => setIForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CFG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                  Prazo (dias após início)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={iForm.due_days_offset}
                  onChange={e => setIForm(f => ({ ...f, due_days_offset: parseInt(e.target.value) || 0 }))}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <Clock className="w-3 h-3 inline mr-1" />
              {iForm.due_days_offset === 0
                ? "Sem prazo definido"
                : `Vence ${iForm.due_days_offset} dia${iForm.due_days_offset > 1 ? "s" : ""} após a criação do cliente`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModal(null)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={savingItem} className="gradient-button gap-2">
              {savingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {itemModal?.item ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasquiTemplates;
