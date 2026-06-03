import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, CheckCircle2, Clock, AlertCircle, XCircle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { useModule } from "@/contexts/ModuleContext";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDENTE: { label: "Pendente", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  PAGO:     { label: "Pago",     color: "text-green-400 bg-green-500/10 border-green-500/20",   icon: CheckCircle2 },
  ATRASADO: { label: "Atrasado", color: "text-red-400 bg-red-500/10 border-red-500/20",         icon: AlertCircle },
  CANCELADO:{ label: "Cancelado",color: "text-gray-400 bg-gray-500/10 border-gray-500/20",      icon: XCircle },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const CashQuiInvoices = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ client_id: "", description: "", amount: "", due_date: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [invData, cliData] = await Promise.all([
        api.get("/api/cashqui/invoices"),
        api.get("/api/clients"),
      ]);
      setInvoices(invData.invoices || []);
      setClients(cliData.clients || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("cashqui");
    load();
  }, []);

  const markPaid = async (id: string) => {
    try {
      await api.put(`/api/cashqui/invoices/${id}`, { status: "PAGO", paid_date: new Date().toISOString() });
      toast({ title: "Fatura marcada como paga!" });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await api.delete(`/api/cashqui/invoices/${id}`);
      toast({ title: "Fatura removida." });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.client_id || !form.amount || !form.due_date) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/cashqui/invoices", form);
      toast({ title: "Fatura criada!" });
      setModalOpen(false);
      setForm({ client_id: "", description: "", amount: "", due_date: "" });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const filtered = filterStatus === "all" ? invoices : invoices.filter(i => i.status === filterStatus);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Faturas</h1>
          <p className="text-sm text-muted-foreground mt-1">{invoices.length} fatura(s) no total</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gradient-button gap-2">
          <Plus className="w-4 h-4" /> Nova Fatura
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {["all", "PENDENTE", "PAGO", "ATRASADO", "CANCELADO"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              filterStatus === s
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s === "all" ? "Todas" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma fatura encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv, i) => {
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.PENDENTE;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{inv.client?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{inv.description || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="text-sm font-bold text-foreground">{fmtDate(inv.due_date)}</p>
                  </div>
                  <p className="text-base font-black text-foreground w-28 text-right">{fmt(inv.amount)}</p>
                  <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <div className="flex gap-1">
                    {inv.status === "PENDENTE" || inv.status === "ATRASADO" ? (
                      <Button size="sm" variant="outline" onClick={() => markPaid(inv.id)} className="text-green-400 border-green-500/30 hover:bg-green-500/10 text-xs h-8">
                        Marcar pago
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => deleteInvoice(inv.id)} className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Fatura */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Mensalidade Abril" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Valor (R$) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Vencimento *</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Fatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashQuiInvoices;
