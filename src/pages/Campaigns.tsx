import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { firestoreService } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Rocket, Plus, Clock, CheckCircle, AlertCircle, Trash2, Edit2, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const variables = ["{{nome}}", "{{telefone}}", "{{seguidores}}", "{{cidade}}", "{{categoria}}", "{{perfil}}", "{{tag_origem}}", "{{extras.chave}}"];

const statusIcons: Record<string, typeof CheckCircle> = {
  "finalizada": CheckCircle,
  "em andamento": Clock,
  "erro": AlertCircle,
};

const Campaigns = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [instanciaId, setInstanciaId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = async () => {
    if (!user) return;
    try {
      const campData = await firestoreService.list("campanhas", undefined, [], "");
      setCampaigns(campData);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const [campData, instData] = await Promise.all([
          firestoreService.list("campanhas", undefined, [], ""),
          firestoreService.list("instancias", undefined, [], ""),
        ]);
        setCampaigns(campData);
        setInstances(instData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetch();
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
    if (!user) return;
    setLoading(true);

    try {
      const docRef = await firestoreService.add("campanhas", user.uid, {
        nome,
        mensagem,
        instancia_id: instanciaId || null,
        status: "em andamento",
        total_leads: 0
      });

      toast({ title: "Campanha criada!", description: "Os disparos serão processados pelo n8n." });
      fetchCampaigns();
      setShowNew(false);
      setNome("");
      setMensagem("");
      setInstanciaId("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

    try {
      await firestoreService.delete("campanhas", id);
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
      await firestoreService.update("campanhas", editingCampaign.id, {
        nome: editingCampaign.nome,
        mensagem: editingCampaign.mensagem,
        instancia_id: editingCampaign.instancia_id,
      });
      toast({ title: "Campanha atualizada!" });
      fetchCampaigns();
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
        <button onClick={() => setShowNew(!showNew)} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      {showNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Criar Campanha</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Campanha</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promo Fevereiro" className="bg-secondary border-border" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância</Label>
                <Select value={instanciaId} onValueChange={setInstanciaId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecionar instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite sua mensagem personalizada..."
                className="bg-secondary border-border min-h-[120px]"
                required
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Variáveis:</span>
                {variables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="text-xs px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer"
                  >
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
        {campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
        )}
        {campaigns.map((c, i) => {
          const StatusIcon = statusIcons[c.status] || Clock;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setEditingCampaign(c)}
              className="glass-card p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.total_leads} leads · {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 mr-4">
                  <StatusIcon className={`w-4 h-4 ${c.status === "finalizada" ? "text-success" : c.status === "erro" ? "text-destructive" : "text-primary"}`} />
                  <span className="text-xs text-muted-foreground capitalize">{c.status}</span>
                </div>
                <div className="flex gap-2">
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

      {/* Edit/View Modal */}
      <Dialog open={!!editingCampaign} onOpenChange={(v) => !v && setEditingCampaign(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Campanha</DialogTitle>
          </DialogHeader>
          {editingCampaign && (
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Campanha</Label>
                  <Input
                    value={editingCampaign.nome}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, nome: e.target.value })}
                    className="bg-secondary border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância</Label>
                  <Select
                    value={editingCampaign.instancia_id || ""}
                    onValueChange={(v) => setEditingCampaign({ ...editingCampaign, instancia_id: v })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Selecionar instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <Textarea
                  value={editingCampaign.mensagem}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, mensagem: e.target.value })}
                  className="bg-secondary border-border min-h-[150px]"
                  required
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v, true)}
                      className="text-xs px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditingCampaign(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
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
