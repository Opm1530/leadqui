import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Wrench, CheckCircle2, Clock, PauseCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const STATUS_CFG: Record<string, { label: string; icon: any; color: string }> = {
  ATIVO:     { label: "Em andamento", icon: Clock,         color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  PAUSADO:   { label: "Pausado",      icon: PauseCircle,   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  CONCLUIDO: { label: "Concluído",    icon: CheckCircle2,  color: "text-green-400 bg-green-500/10 border-green-500/20" },
};

const Projects = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ATIVO");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ client_id: "", name: "", description: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [proj, cli] = await Promise.all([
        api.get(`/api/tasqui/projects?status=${filterStatus}`),
        api.get("/api/clients"),
      ]);
      // Filtrar apenas jobs únicos
      const uniqueJobs = (Array.isArray(proj) ? proj : []).filter((p: any) => p.type === "UNICO");
      setJobs(uniqueJobs);
      setClients(cli.clients || []);
    } catch {
      toast({ title: "Erro ao carregar jobs", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("tasqui");
  }, []);

  useEffect(() => { load(); }, [filterStatus]);

  const handleCreate = async () => {
    if (!form.client_id || !form.name) {
      toast({ title: "Cliente e nome são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/tasqui/projects", { ...form, type: "UNICO", status: "ATIVO" });
      toast({ title: "Job criado!" });
      setModalOpen(false);
      setForm({ client_id: "", name: "", description: "" });
      load();
    } catch {
      toast({ title: "Erro ao criar job", variant: "destructive" });
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/tasqui/projects/${id}`, { status });
      toast({ title: "Status atualizado!" });
      load();
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">Entregas únicas e pontuais para clientes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
            {["ATIVO", "PAUSADO", "CONCLUIDO"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === s ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white"
                }`}
              >
                {STATUS_CFG[s].label}
              </button>
            ))}
          </div>
          <Button onClick={() => setModalOpen(true)} className="gradient-button gap-2 h-9">
            <Plus className="w-4 h-4" /> Novo Job
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum job encontrado</p>
          <p className="text-sm mt-1">Jobs são entregas únicas como sites, identidade visual, vídeos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job, i) => {
            const cfg = STATUS_CFG[job.status] || STATUS_CFG.ATIVO;
            const Icon = cfg.icon;
            const completedTasks = job.tasks?.filter((t: any) => t.status === "CONCLUIDO").length || 0;
            const totalTasks = job._count?.tasks || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">{job.client?.name}</p>
                  <h3 className="font-black text-foreground mt-0.5">{job.name}</h3>
                  {job.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{job.description}</p>}
                </div>

                {totalTasks > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground font-bold">
                      <span>Progresso</span>
                      <span>{completedTasks}/{totalTasks} tarefas · {progress}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ações rápidas de status */}
                {job.status === "ATIVO" && (
                  <div className="flex gap-2 pt-1 border-t border-border/50">
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(job.id, "PAUSADO")}
                      className="flex-1 text-yellow-400 hover:bg-yellow-500/10 text-xs h-8">
                      Pausar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(job.id, "CONCLUIDO")}
                      className="flex-1 text-green-400 hover:bg-green-500/10 text-xs h-8">
                      Concluir
                    </Button>
                  </div>
                )}
                {job.status === "PAUSADO" && (
                  <div className="flex gap-2 pt-1 border-t border-border/50">
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(job.id, "ATIVO")}
                      className="flex-1 text-blue-400 hover:bg-blue-500/10 text-xs h-8">
                      Retomar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(job.id, "CONCLUIDO")}
                      className="flex-1 text-green-400 hover:bg-green-500/10 text-xs h-8">
                      Concluir
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Novo Job</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Nome do Job *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Identidade Visual, Landing Page..." className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder="Escopo do trabalho..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
