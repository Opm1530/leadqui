import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Building2, Search, ListTodo, Plus } from "lucide-react";

const ClientesGrid = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Criar tarefa
  const [team, setTeam] = useState<any[]>([]);
  const [taskModal, setTaskModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyTask = { title: "", description: "", client_id: "", responsible_id: "", priority: "MEDIA", due_date: "" };
  const [form, setForm] = useState(emptyTask);

  useEffect(() => {
    api.get("/api/clients").then(d => setClients(d.clients || [])).catch(() => {}).finally(() => setLoading(false));
    api.get("/api/teamqui").then(d => setTeam(d.users || d || [])).catch(() => {});
  }, []);

  const criarTarefa = async () => {
    if (!form.title.trim() || !form.client_id) { toast({ title: "Preencha título e cliente.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.post("/api/tasqui/tasks", {
        title: form.title.trim(), description: form.description || null, client_id: form.client_id,
        responsible_id: form.responsible_id || null, priority: form.priority, due_date: form.due_date || null,
      });
      toast({ title: "Tarefa criada!" });
      setForm(emptyTask); setTaskModal(false);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const filtered = clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground text-sm">Selecione um cliente para acessar tudo dele</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
              className="pl-9 pr-3 h-10 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/50 w-48" />
          </div>
          <Button onClick={() => { setForm(emptyTask); setTaskModal(true); }} className="gradient-button gap-2 h-10"><ListTodo className="w-4 h-4" /> Tarefas</Button>
        </div>
      </div>

      {/* Modal criar tarefa */}
      <Dialog open={taskModal} onOpenChange={setTaskModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="bg-secondary border-border resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável</Label>
                <Select value={form.responsible_id} onValueChange={v => setForm(f => ({ ...f, responsible_id: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                  <SelectContent>{team.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIXA">Baixa</SelectItem><SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem><SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskModal(false)} className="border-border">Cancelar</Button>
            <Button onClick={criarTarefa} disabled={saving || !form.title.trim() || !form.client_id} className="gradient-button gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/cliente/${c.id}`)}
              className="group text-left rounded-2xl border border-border bg-card/40 p-5 hover:bg-card/80 hover:border-primary/30 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <span className="text-white font-black text-lg">{(c.name || "?").charAt(0).toUpperCase()}</span>
              </div>
              <p className="font-semibold text-foreground truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === "ATIVO" ? "bg-green-500/20 text-green-300" : "bg-secondary text-muted-foreground"}`}>{c.status}</span>
                {c.contract?.value != null && <span className="text-[11px] text-muted-foreground">{Number(c.contract.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês</span>}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientesGrid;
