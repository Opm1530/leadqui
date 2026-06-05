import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Trash2, MousePointerClick, Pencil, BarChart2, Link2, TrendingUp, TrendingDown, DollarSign, Eye, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  ATIVO:     { label: "Ativo",     color: "text-green-400 bg-green-500/10 border-green-500/20" },
  PAUSADO:   { label: "Pausado",   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  FINALIZADO:{ label: "Finalizado",color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const emptyForm = {
  client_id: "", name: "", objective: "", budget: "",
  status: "ATIVO", start_date: "", end_date: "",
};

const TasquiTraffic = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  // Meta metrics
  const [metricsOpen, setMetricsOpen] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<Record<string, any>>({});
  const [metricsLoading, setMetricsLoading] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<any>(null);
  const [metaCampaigns, setMetaCampaigns] = useState<any[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [camp, cli] = await Promise.all([
        api.get("/api/tasqui/traffic"),
        api.get("/api/clients"),
      ]);
      setCampaigns(Array.isArray(camp) ? camp : []);
      setClients(cli.clients || []);
    } catch {
      toast({ title: "Erro ao carregar campanhas", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("tasqui");
    load();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, client_id: filterClient === "all" ? "" : filterClient });
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditTarget(c);
    setForm({
      client_id: c.client_id,
      name: c.name,
      objective: c.objective || "",
      budget: c.budget ? String(c.budget) : "",
      status: c.status,
      start_date: c.start_date ? c.start_date.split("T")[0] : "",
      end_date: c.end_date ? c.end_date.split("T")[0] : "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.client_id || !form.name) {
      toast({ title: "Cliente e nome são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await api.patch(`/api/tasqui/traffic/${editTarget.id}`, form);
        toast({ title: "Campanha atualizada!" });
      } else {
        await api.post("/api/tasqui/traffic", form);
        toast({ title: "Campanha criada!" });
      }
      setModalOpen(false);
      load();
    } catch {
      toast({ title: "Erro ao salvar campanha", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/tasqui/traffic/${id}`);
      toast({ title: "Campanha removida." });
      load();
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const toggleMetrics = async (camp: any) => {
    if (metricsOpen === camp.id) { setMetricsOpen(null); return; }
    if (!camp.meta_campaign_id) { toast({ title: "Vincule esta campanha ao Meta Ads primeiro", variant: "destructive" }); return; }
    setMetricsOpen(camp.id);
    if (metricsData[camp.id]) return; // já carregou
    setMetricsLoading(camp.id);
    try {
      const d = await api.get(`/api/tasqui/traffic/${camp.id}/meta-metrics`);
      setMetricsData(prev => ({ ...prev, [camp.id]: d }));
    } catch (e: any) {
      toast({ title: "Erro ao buscar métricas", description: e.message, variant: "destructive" });
      setMetricsOpen(null);
    } finally { setMetricsLoading(null); }
  };

  const openLinkModal = async (camp: any) => {
    setLinkModal(camp);
    setLinkLoading(true);
    try {
      const d = await api.get(`/api/tasqui/traffic/meta-campaigns/${camp.client_id}`);
      setMetaCampaigns(d.data || []);
    } catch (e: any) {
      toast({ title: "Erro ao buscar campanhas Meta", description: e.message, variant: "destructive" });
      setLinkModal(null);
    } finally { setLinkLoading(false); }
  };

  const handleLink = async (metaCampaignId: string) => {
    if (!linkModal) return;
    try {
      await api.patch(`/api/tasqui/traffic/${linkModal.id}`, { meta_campaign_id: metaCampaignId });
      toast({ title: "Campanha vinculada ao Meta Ads!" });
      setLinkModal(null);
      setMetricsData(prev => { const n = { ...prev }; delete n[linkModal.id]; return n; });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    }
  };

  const filtered = filterClient === "all" ? campaigns : campaigns.filter(c => c.client_id === filterClient);

  const totalBudget = filtered.filter(c => c.status === "ATIVO").reduce((s, c) => s + (c.budget || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Tráfego Pago</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} campanha(s) · Budget ativo: <span className="text-green-400 font-bold">{fmt(totalBudget)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44 bg-secondary border-border h-9">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="gradient-button gap-2 h-9">
            <Plus className="w-4 h-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-2xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MousePointerClick className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma campanha cadastrada</p>
          <p className="text-sm mt-1">Adicione campanhas de tráfego dos seus clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((camp, i) => {
            const cfg = STATUS_CFG[camp.status] || STATUS_CFG.ATIVO;
            return (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">{camp.client?.name}</p>
                    <h3 className="font-black text-foreground mt-0.5 truncate">{camp.name}</h3>
                    {camp.objective && <p className="text-xs text-muted-foreground mt-0.5 truncate">{camp.objective}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ml-2 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Budget</p>
                    <p className="text-base font-black text-green-400 mt-0.5">
                      {camp.budget ? fmt(camp.budget) : "—"}
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Período</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">
                      {fmtDate(camp.start_date)}
                      {camp.end_date && <> → {fmtDate(camp.end_date)}</>}
                    </p>
                  </div>
                </div>

                {/* Métricas Meta */}
                <AnimatePresence>
                  {metricsOpen === camp.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      {metricsLoading === camp.id ? (
                        <div className="py-3 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></div>
                      ) : metricsData[camp.id] ? (() => {
                        const ins = metricsData[camp.id].insights?.data?.[0] || {};
                        const spend = parseFloat(ins.spend || "0");
                        const ctr   = parseFloat(ins.ctr || "0");
                        const cpc   = parseFloat(ins.cpc || "0");
                        const roas  = parseFloat(ins.purchase_roas?.[0]?.value || "0");
                        const impr  = parseInt(ins.impressions || "0");
                        const fmt2  = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                        return (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                            {[
                              { label: "Gasto", value: `R$ ${fmt2(spend)}`, icon: DollarSign, color: "text-orange-400" },
                              { label: "Impressões", value: impr.toLocaleString("pt-BR"), icon: Eye, color: "text-blue-400" },
                              { label: "CTR", value: `${fmt2(ctr)}%`, color: ctr >= 1 ? "text-green-400" : "text-red-400", icon: ctr >= 1 ? TrendingUp : TrendingDown },
                              { label: "CPC", value: `R$ ${fmt2(cpc)}`, icon: DollarSign, color: "text-yellow-400" },
                              { label: "ROAS", value: roas > 0 ? `${fmt2(roas)}x` : "—", icon: roas >= 2 ? TrendingUp : TrendingDown, color: roas >= 2 ? "text-green-400" : "text-red-400" },
                            ].map(m => (
                              <div key={m.label} className="bg-secondary/40 rounded-lg p-2 text-center">
                                <m.icon className={`w-3 h-3 mx-auto mb-0.5 ${m.color}`} />
                                <p className="text-xs font-bold text-foreground">{m.value}</p>
                                <p className="text-[9px] text-muted-foreground">{m.label}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })() : null}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 pt-1 border-t border-border/50">
                  {camp.meta_campaign_id ? (
                    <Button size="sm" variant="ghost" onClick={() => toggleMetrics(camp)}
                      className="flex-1 gap-1.5 text-blue-400 hover:text-blue-300 h-8 text-xs">
                      <BarChart2 className="w-3 h-3" />
                      {metricsOpen === camp.id ? "Ocultar" : "Ver Métricas"}
                      {metricsOpen === camp.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => openLinkModal(camp)}
                      className="flex-1 gap-1.5 text-muted-foreground hover:text-primary h-8 text-xs">
                      <Link2 className="w-3 h-3" /> Vincular ao Meta
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(camp)} className="text-muted-foreground hover:text-white h-8 w-8 p-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(camp.id)} className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal vincular ao Meta */}
      <Dialog open={!!linkModal} onOpenChange={v => !v && setLinkModal(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Vincular ao Meta Ads — {linkModal?.name}
            </DialogTitle>
          </DialogHeader>
          {linkLoading ? (
            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
          ) : metaCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha encontrada no Meta Ads deste cliente.<br />Certifique-se que o cliente tem conexão Meta configurada em TechQui.</p>
          ) : (
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground mb-3">Selecione qual campanha do Meta Ads corresponde a <strong className="text-foreground">"{linkModal?.name}"</strong>:</p>
              {metaCampaigns.map((mc: any) => (
                <button key={mc.id} type="button" onClick={() => handleLink(mc.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:border-primary/50 hover:bg-primary/5 text-left transition-all">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{mc.name}</p>
                    <p className="text-xs text-muted-foreground">{mc.objective} · <span className={mc.status === "ACTIVE" ? "text-green-400" : "text-yellow-400"}>{mc.status}</span></p>
                  </div>
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkModal(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Nome da Campanha *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Campanha Black Friday Meta Ads" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Objetivo</Label>
              <Input value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} placeholder="Ex: Geração de leads, Alcance, Conversão" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Budget (R$)</Label>
                <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PAUSADO">Pausado</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Término</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasquiTraffic;
