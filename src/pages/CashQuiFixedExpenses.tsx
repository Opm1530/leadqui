import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, Trash2, Pencil, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  FERRAMENTAS:    { label: "Ferramentas",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  ANUNCIOS:       { label: "Anúncios",       color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  PESSOAL:        { label: "Pessoal",        color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  INFRAESTRUTURA: { label: "Infraestrutura", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  OUTROS:         { label: "Outros",         color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = new Date().getDate();

const emptyForm = { description: "", amount: "", category: "OUTROS", due_day: "10" };

const CashQuiFixedExpenses = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/cashqui/fixed-expenses");
      setItems(data.fixed_expenses || []);
    } catch {
      toast({ title: "Erro ao carregar despesas fixas", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("cashqui");
    load();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setForm({
      description: item.description,
      amount: String(item.amount),
      category: item.category,
      due_day: String(item.due_day),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.due_day) {
      toast({ title: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/api/cashqui/fixed-expenses/${editTarget.id}`, form);
        toast({ title: "Despesa fixa atualizada!" });
      } else {
        await api.post("/api/cashqui/fixed-expenses", form);
        toast({ title: "Despesa fixa cadastrada!" });
      }
      setModalOpen(false);
      load();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleActive = async (item: any) => {
    try {
      await api.put(`/api/cashqui/fixed-expenses/${item.id}`, { active: !item.active });
      toast({ title: item.active ? "Despesa pausada." : "Despesa reativada." });
      load();
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/cashqui/fixed-expenses/${id}`);
      toast({ title: "Despesa removida." });
      load();
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const total = items.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const dueThisWeek = items.filter(i => i.active && Math.abs(i.due_day - today) <= 3);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Despesas Fixas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total mensal: <span className="text-red-400 font-bold">{fmt(total)}</span>
          </p>
        </div>
        <Button onClick={openCreate} className="gradient-button gap-2 h-9">
          <Plus className="w-4 h-4" /> Nova Despesa Fixa
        </Button>
      </div>

      {/* Alerta de vencimentos próximos */}
      {dueThisWeek.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium"
        >
          <Bell className="w-5 h-5 shrink-0" />
          <span>
            <strong>{dueThisWeek.length}</strong> despesa(s) com vencimento nos próximos 3 dias:{" "}
            {dueThisWeek.map(i => `${i.description} (dia ${i.due_day})`).join(", ")}
          </span>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma despesa fixa cadastrada</p>
          <p className="text-sm mt-1">Cadastre gastos recorrentes como ferramentas, assinaturas e serviços</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const cfg = CATEGORIES[item.category] || CATEGORIES.OUTROS;
            const isDuesSoon = item.active && Math.abs(item.due_day - today) <= 3;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-card border rounded-xl px-5 py-4 flex items-center justify-between gap-4 transition-colors ${
                  isDuesSoon ? "border-yellow-500/30" : "border-border"
                } ${!item.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Todo dia <strong>{item.due_day}</strong>
                      {isDuesSoon && <span className="ml-2 text-yellow-400">— vence em breve!</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-base font-black text-red-400">{fmt(item.amount)}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(item)} className="h-8 w-8 p-0 text-muted-foreground hover:text-white">
                      {item.active ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)} className="h-8 w-8 p-0 text-muted-foreground hover:text-white">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Assinatura Canva, Servidor AWS..." className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Valor (R$) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Dia do vencimento *</Label>
                <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="Ex: 10" className="bg-secondary border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
            <Button onClick={handleSave} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashQuiFixedExpenses;
