import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Rocket, Plus, Clock, CheckCircle, AlertCircle, Trash2, Edit2, Loader2, StopCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import api from "@/lib/api";

const variables = ["{{nome}}", "{{telefone}}", "{{cidade}}", "{{categoria}}"];

const statusIcons: Record<string, typeof CheckCircle> = {
  FINALIZADA: CheckCircle,
  EM_ANDAMENTO: Clock,
  ERRO: AlertCircle,
};

const Campaigns = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [tags, setTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [campRes, instRes, tagRes, leadRes] = await Promise.all([
        api.get("/api/campaigns"),
        api.get("/api/instances"),
        api.get("/api/tags"),
        api.get("/api/leads?limit=1000"),
      ]);
      setCampaigns(campRes.campaigns || []);
      setInstances(instRes.instances || []);
      setTags(tagRes.tags || []);
      setLeads(leadRes.leads || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const insertVariable = (v: string, isEdit = false) => {
    if (isEdit) {
      setEditingCampaign((prev: any) => ({ ...prev, mensagem: (prev.mensagem || "") + " " + v }));
    } else {
      setMensagem((prev) => prev + " " + v);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/campaigns", {
        nome,
        mensagem,
        instance_id: instanceId || null,
        tag_ids: selectedTagIds,
        lead_ids: selectedLeadIds,
        new_tag_name: newTagName,
      });
      toast({ title: "Campanha iniciada!", description: "Os disparos serão processados em background." });
      fetchData();
      setShowNew(false);
      setNome(""); setMensagem(""); setInstanceId("");
      setSelectedTagIds([]); setSelectedLeadIds([]); setNewTagName("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Parar o disparo desta campanha?")) return;
    try {
      await api.patch(`/api/campaigns/${id}/stop`, {});
      toast({ title: "Campanha parada", description: "O disparo foi interrompido." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao parar campanha", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast({ title: "Campanha excluída" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    setLoading(true);
    try {
      await api.put(`/api/campaigns/${editingCampaign.id}`, {
        nome: editingCampaign.nome,
        mensagem: editingCampaign.mensagem,
        instance_id: editingCampaign.instance_id,
      });
      toast({ title: "Campanha atualizada!" });
      fetchData();
      setEditingCampaign(null);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus disparos em massa</p>
        </div>
        <button onClick={() => { setShowNew(!showNew); fetchData(); }} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      {showNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Criar Campanha</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Campanha</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promo Abril" className="bg-secondary border-border" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância WhatsApp</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecionar instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.length === 0 && <SelectItem value="none" disabled>Nenhuma instância conectada</SelectItem>}
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.nome} ({inst.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Filtrar por Tags (Opcional)</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-secondary/30 rounded-lg border border-border max-h-32 overflow-y-auto">
                  {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>}
                  {tags.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-all ${selectedTagIds.includes(tag.id) ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}>
                      {tag.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tag aos Participantes (Existente ou Nova)</Label>
                <div className="flex flex-wrap gap-2 mb-2 max-h-20 overflow-y-auto p-1">
                  {tags.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => setNewTagName(tag.nome)}
                      className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${newTagName === tag.nome ? "bg-success text-success-foreground border-success" : "bg-transparent text-muted-foreground border-border hover:border-success/50"}`}>
                      {tag.nome}
                    </button>
                  ))}
                </div>
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ex: Campanha_Abril" className="bg-secondary border-border" />
                <p className="text-[10px] text-muted-foreground">O sistema usará a tag selecionada ou criará uma nova com este nome.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Selecionar Leads Específicos ({selectedLeadIds.length} selecionados)</Label>
              <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Buscar por nome ou cidade..." className="bg-secondary border-border mb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-secondary/30 rounded-lg border border-border max-h-48 overflow-y-auto">
                {leads.filter(l => (l.nome?.toLowerCase().includes(leadSearch.toLowerCase()) || l.cidade?.toLowerCase().includes(leadSearch.toLowerCase()))).map((lead) => (
                  <button key={lead.id} type="button" onClick={() => setSelectedLeadIds(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id])}
                    className={`flex flex-col items-start p-2 rounded-md border text-left transition-all ${selectedLeadIds.includes(lead.id) ? "bg-primary/20 border-primary" : "bg-transparent border-border hover:border-primary/30"}`}>
                    <span className="text-xs font-semibold truncate w-full">{lead.nome}</span>
                    <span className="text-[10px] text-muted-foreground">{lead.telefone} {lead.cidade ? `· ${lead.cidade}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Mensagem</Label>
              <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Digite sua mensagem..." className="bg-secondary border-border min-h-[120px]" required />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Variáveis:</span>
                {variables.map((v) => (
                  <button key={v} type="button" onClick={() => insertVariable(v)} className="text-xs px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading} className="gradient-button px-6 py-2.5 text-sm disabled:opacity-50">
              <Rocket className="w-4 h-4 inline mr-2" />
              {loading ? "Criando..." : "Iniciar Campanha"}
            </button>
          </form>
        </motion.div>
      )}

      <div className="space-y-3">
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>}
        {campaigns.map((c, i) => {
          const StatusIcon = statusIcons[c.status] || Clock;
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setEditingCampaign(c)}
              className="glass-card p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.total_leads} leads · {c.sent || 0} enviados</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 mr-4">
                  <StatusIcon className={`w-4 h-4 ${c.status === "FINALIZADA" ? "text-success" : c.status === "ERRO" ? "text-destructive" : "text-primary"}`} />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground capitalize">{c.status?.toLowerCase().replace("_", " ")}</span>
                    {c.status === "ERRO" && c.erro && (
                      <span className="text-[10px] text-destructive leading-tight max-w-[150px]" title={c.erro}>{c.erro}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.status === "EM_ANDAMENTO" && (
                    <button onClick={(e) => handleStop(c.id, e)} title="Parar campanha" className="p-2 rounded-md hover:bg-yellow-500/20 text-muted-foreground hover:text-yellow-400 transition-colors">
                      <StopCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setEditingCampaign(c); }} className="p-2 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => handleDelete(c.id, e)} className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!editingCampaign} onOpenChange={(v) => !v && setEditingCampaign(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-center">Editar Campanha</DialogTitle>
            <DialogDescription className="sr-only">Edite as informações da sua campanha aqui.</DialogDescription>
          </DialogHeader>
          {editingCampaign && (
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome</Label>
                  <Input value={editingCampaign.nome} onChange={(e) => setEditingCampaign({ ...editingCampaign, nome: e.target.value })} className="bg-secondary border-border" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância</Label>
                  <Select value={editingCampaign.instance_id || ""} onValueChange={(v) => setEditingCampaign({ ...editingCampaign, instance_id: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <Textarea value={editingCampaign.mensagem} onChange={(e) => setEditingCampaign({ ...editingCampaign, mensagem: e.target.value })} className="bg-secondary border-border min-h-[150px]" required />
                <div className="flex flex-wrap gap-2 mt-2">
                  {variables.map((v) => <button key={v} type="button" onClick={() => insertVariable(v, true)} className="text-xs px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors">{v}</button>)}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditingCampaign(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                <button type="submit" disabled={loading} className="gradient-button px-6 py-2 text-sm flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campaigns;
