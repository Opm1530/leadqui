import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { firestoreService } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Smartphone, Plus, Wifi, WifiOff, Trash2, QrCode, RefreshCw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Instances = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);

  const fetchInstances = async () => {
    if (!user) return;
    try {
      const data = await firestoreService.list("instancias", user.uid, [], "");
      setInstances(data);
    } catch (error: any) {
      console.error("Error fetching instances:", error);
      toast({ title: "Erro ao carregar instâncias", description: error.message, variant: "destructive" });
    }
  };

  const checkAllStatuses = useCallback(async (insts: any[]) => {
    for (const inst of insts) {
      try {
        const { data, error } = await supabase.functions.invoke("evolution-api", {
          body: { action: "status", instanceName: inst.evolution_instance_id },
        });
        if (!error && data?.instance?.state) {
          const newStatus = data.instance.state === "open" ? "conectado" : "desconectado";
          setInstances((prev) =>
            prev.map((i) => (i.id === inst.id ? { ...i, status: newStatus } : i))
          );
          // Update status in firestore
          await firestoreService.update("instancias", inst.id, { status: newStatus });
        }
      } catch { }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await firestoreService.list("instancias", user.uid, [], "");
        setInstances(data);
        if (data.length > 0) checkAllStatuses(data);
      } catch (error) {
        console.error("Error loading instances:", error);
      }
    };
    load();
  }, [user, checkAllStatuses]);

  const callEvolutionApi = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("evolution-api", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nome.trim()) return;
    setLoading(true);

    try {
      const data = await callEvolutionApi({ action: "create", instanceName: nome.trim() });

      // Save to Firestore
      await firestoreService.add("instancias", user.uid, {
        nome: nome.trim(),
        evolution_instance_id: nome.trim(),
        status: "desconectado",
      });

      const qrBase64 = data.qrcode?.base64;
      if (qrBase64) {
        setQrCodeData(qrBase64);
        setQrInstanceName(nome.trim());
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

  const handleRefreshQr = async (instanceId: string) => {
    try {
      const data = await callEvolutionApi({ action: "qrcode", instanceName: instanceId });
      const qrBase64 = data.base64;
      if (qrBase64) {
        setQrCodeData(qrBase64);
        setQrInstanceName(instanceId);
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
      const data = await callEvolutionApi({ action: "status", instanceName: inst.evolution_instance_id });
      const newStatus = data.instance?.state === "open" ? "conectado" : "desconectado";
      setInstances((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, status: newStatus } : i))
      );

      // Update status in firestore
      await firestoreService.update("instancias", inst.id, { status: newStatus });

      toast({ title: `Status: ${newStatus}` });

      if (newStatus === "conectado") {
        setQrCodeData(null);
        setQrInstanceName(null);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCheckingStatus(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await firestoreService.delete("instancias", id);
      setInstances((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Instância excluída" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instâncias</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas conexões WhatsApp</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="gradient-button px-4 py-2 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Nova Instância
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

      {/* QR Code Dialog */}
      <Dialog open={!!qrCodeData} onOpenChange={(v) => !v && (setQrCodeData(null), setQrInstanceName(null))}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-center">Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrCodeData && (
              <img src={qrCodeData} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg bg-white p-2" />
            )}
            <p className="text-xs text-muted-foreground text-center">
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
            <div className="flex gap-2">
              {qrInstanceName && (
                <button
                  onClick={() => handleRefreshQr(qrInstanceName)}
                  className="text-xs px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar QR
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {instances.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">Nenhuma instância cadastrada.</p>
        )}
        {instances.map((inst, i) => (
          <motion.div
            key={inst.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
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
                <button
                  onClick={() => handleRefreshQr(inst.evolution_instance_id)}
                  className="p-1.5 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                  title="Gerar QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(inst.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => handleCheckStatus(inst)}
                disabled={checkingStatus === inst.id}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {checkingStatus === inst.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : inst.status === "conectado" ? (
                  <Wifi className="w-4 h-4 text-success" />
                ) : (
                  <WifiOff className="w-4 h-4 text-destructive" />
                )}
                <span className={`text-xs font-medium ${inst.status === "conectado" ? "text-success" : "text-destructive"}`}>
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
