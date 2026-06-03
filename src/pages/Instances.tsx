import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Smartphone, Plus, Wifi, WifiOff, Trash2, QrCode, RefreshCw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import api from "@/lib/api";

const Instances = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    try {
      const data = await api.get("/api/instances");
      setInstances(data.instances || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar instâncias", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchInstances();
  }, [user, fetchInstances]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    try {
      const data = await api.post("/api/instances", { nome: nome.trim() });
      if (data.qrcode) {
        setQrCodeData(data.qrcode);
        setQrInstanceId(data.instance.id);
      }
      toast({ title: "Instância criada!", description: "Escaneie o QR Code para conectar." });
      setShowNew(false);
      setNome("");
      fetchInstances();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleRefreshQr = async (id: string) => {
    try {
      const data = await api.get(`/api/instances/${id}/qrcode`);
      if (data.qrcode) {
        setQrCodeData(data.qrcode);
        setQrInstanceId(id);
      } else {
        toast({ title: "Sem QR Code", description: "A instância pode já estar conectada." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCheckStatus = async (inst: any) => {
    setCheckingStatus(inst.id);
    try {
      const data = await api.get(`/api/instances/${inst.id}/status`);
      const newStatus = data.status;
      setInstances((prev) => prev.map((i) => i.id === inst.id ? { ...i, status: newStatus } : i));
      toast({ title: `Status: ${newStatus}` });
      if (newStatus === "CONECTADO") {
        setQrCodeData(null);
        setQrInstanceId(null);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCheckingStatus(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/instances/${id}`);
      setInstances((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Instância excluída" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!qrCodeData || !qrInstanceId) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/api/instances/${qrInstanceId}/status`);
        if (data.status === "CONECTADO") {
          setInstances((prev) => prev.map((i) => i.id === qrInstanceId ? { ...i, status: "CONECTADO" } : i));
          setQrCodeData(null);
          setQrInstanceId(null);
          toast({ title: "WhatsApp Conectado!", description: "Sua instância já está pronta para uso." });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [qrCodeData, qrInstanceId, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instâncias WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas conexões WhatsApp via Evolution API</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Instância
        </button>
      </div>

      {showNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Criar Instância</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Instância</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: WhatsApp Vendas" className="bg-secondary border-border" required />
              <p className="text-xs text-muted-foreground">Será criada automaticamente na Evolution API e o QR Code será exibido.</p>
            </div>
            <button type="submit" disabled={loading} className="gradient-button px-6 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {loading ? "Criando..." : "Criar e Gerar QR Code"}
            </button>
          </form>
        </motion.div>
      )}

      <Dialog open={!!qrCodeData} onOpenChange={(v) => !v && (setQrCodeData(null), setQrInstanceId(null))}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-center">Escaneie o QR Code</DialogTitle>
            <DialogDescription className="sr-only">Aponte a câmera do seu WhatsApp para este QR Code para estabelecer a conexão.</DialogDescription>
          </DialogHeader>
          {qrCodeData && (
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-inner border-2 border-primary/20">
              <img src={qrCodeData} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg bg-white p-2" />
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-primary font-medium animate-pulse">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span>Aguardando leitura do QR Code...</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
                  Abra o WhatsApp no seu celular → Aparelhos conectados → Conectar um aparelho
                </p>
              </div>
            </div>
          )}
          {qrInstanceId && (
            <div className="flex justify-center">
              <button onClick={() => handleRefreshQr(qrInstanceId)} className="text-xs px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Atualizar QR
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {instances.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Nenhuma instância cadastrada.</p>}
        {instances.map((inst, i) => (
          <motion.div key={inst.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{inst.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inst.evolution_instance_id}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleRefreshQr(inst.id)} className="p-1.5 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary" title="Gerar QR Code">
                  <QrCode className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(inst.id)} className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => handleCheckStatus(inst)} disabled={checkingStatus === inst.id} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {checkingStatus === inst.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : inst.status === "CONECTADO" ? (
                  <Wifi className="w-4 h-4 text-success" />
                ) : (
                  <WifiOff className="w-4 h-4 text-destructive" />
                )}
                <span className={`text-xs font-medium ${inst.status === "CONECTADO" ? "text-success" : "text-destructive"}`}>
                  {inst.status}
                </span>
              </button>
              <span className="text-xs text-muted-foreground">{new Date(inst.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Instances;
