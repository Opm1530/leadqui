import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, Trash2, MousePointerClick, Pencil } from "lucide-react";
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

                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(camp)} className="flex-1 gap-1.5 text-muted-foreground hover:text-white h-8 text-xs">
                    <Pencil className="w-3 h-3" /> Editar
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
