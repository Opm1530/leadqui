import { confirm } from "@/components/ConfirmDialog";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, TrendingDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { backgroundUpload } from "@/contexts/UploadContext";
import { useModule } from "@/contexts/ModuleContext";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  FERRAMENTAS:    { label: "Ferramentas",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  ANUNCIOS:       { label: "Anúncios",       color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  PESSOAL:        { label: "Pessoal",        color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  INFRAESTRUTURA: { label: "Infraestrutura", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  OUTROS:         { label: "Outros",         color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const now = new Date();

const CashQuiExpenses = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [form, setForm] = useState({ description: "", amount: "", category: "OUTROS", date: new Date().toISOString().split("T")[0] });

  const [pending, setPending] = useState<any[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  const loadPending = () => api.get("/api/cashqui/fixed-expenses/pending").then(d => setPending(d.pending || [])).catch(() => {});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/cashqui/expenses?month=${month}&year=${year}`);
      setExpenses(data.expenses || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("cashqui");
    loadPending();
  }, []);

  useEffect(() => { load(); }, [month, year]);

  const receiptRef = useRef<HTMLInputElement>(null);
  const [pendingExpense, setPendingExpense] = useState<string | null>(null);
  const askReceipt = async (expenseId: string) => {
    if (await confirm("Deseja adicionar o comprovante deste pagamento?")) { setPendingExpense(expenseId); receiptRef.current?.click(); }
  };
  const enviarComprovante = async (e: any) => {
    const file = e.target.files?.[0]; const id = pendingExpense;
    e.target.value = ""; setPendingExpense(null);
    if (!file || !id) return;
    try {
      const fd = new FormData(); fd.append("file", file);
      await backgroundUpload(`/api/cashqui/expenses/${id}/receipt`, fd, file.name);
      toast({ title: "Comprovante anexado!" }); load();
    } catch (err: any) { toast({ title: "Erro ao anexar", description: err.message, variant: "destructive" }); }
  };

  const marcarPaga = async (fixa: any) => {
    setPaying(fixa.id);
    try {
      const d = await api.post(`/api/cashqui/fixed-expenses/${fixa.id}/pay`, {});
      toast({ title: "Pago!", description: `${fixa.description} registrada como despesa.` });
      setPending(p => p.filter(x => x.id !== fixa.id));
      load();
      if (d.expense?.id) askReceipt(d.expense.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setPaying(null); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/cashqui/expenses/${id}`);
      toast({ title: "Despesa removida." });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.description || !form.amount || !form.date) {
      toast({ title: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const d = await api.post("/api/cashqui/expenses", form);
      toast({ title: "Despesa registrada!" });
      setModalOpen(false);
      setForm({ description: "", amount: "", category: "OUTROS", date: new Date().toISOString().split("T")[0] });
      load();
      if (d.expense?.id) askReceipt(d.expense.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = Object.entries(
    expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="p-6 space-y-6">
      <input ref={receiptRef} type="file" onChange={enviarComprovante} className="hidden" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Despesas</h1>
          <p className="text-sm text-muted-foreground mt-1">Total: <span className="text-red-400 font-bold">{fmt(total)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-28 bg-secondary border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 bg-secondary border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setModalOpen(true)} className="gradient-button gap-2 h-9">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </div>

      {/* Despesas fixas a pagar */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4">
          <p className="text-sm font-semibold text-yellow-300 mb-2 flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Contas fixas a pagar</p>
          <div className="space-y-2">
            {pending.map(f => {
              const cfg = CATEGORIES[f.category] || CATEGORIES.OUTROS;
              return (
                <div key={f.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{f.description}</p>
                    <p className="text-[11px] text-muted-foreground">Vence dia {f.due_day}</p>
                  </div>
                  <span className="text-sm font-bold text-red-400">{fmt(f.amount)}</span>
                  <Button onClick={() => marcarPaga(f)} disabled={paying === f.id} size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1">
                    {paying === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Marcar paga"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo por categoria */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {byCategory.map(([cat, val]) => {
            const cfg = CATEGORIES[cat] || CATEGORIES.OUTROS;
            return (
              <div key={cat} className={`rounded-xl border p-3 ${cfg.color}`}>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">{cfg.label}</p>
                <p className="text-base font-black mt-1">{fmt(val)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma despesa neste período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp, i) => {
            const cfg = CATEGORIES[exp.category] || CATEGORIES.OUTROS;
            return (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                  <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-xs text-muted-foreground hidden sm:block">{fmtDate(exp.date)}</p>
                  <p className="text-base font-black text-red-400">{fmt(exp.amount)}</p>
                  {exp.receipt_key
                    ? <button onClick={() => { const t = localStorage.getItem("pequi_token"); fetch(`/api/cashqui/expenses/${exp.id}/receipt`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), "_blank")); }} title="Ver comprovante" className="text-green-400 hover:text-green-300"><Paperclip className="w-4 h-4" /></button>
                    : <button onClick={() => askReceipt(exp.id)} title="Anexar comprovante" className="text-muted-foreground hover:text-foreground"><Paperclip className="w-4 h-4" /></button>}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(exp.id)} className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0">
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
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Assinatura Google Workspace" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Valor (R$) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashQuiExpenses;
