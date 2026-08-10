import { confirm } from "@/components/ConfirmDialog";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Plus, Wifi, WifiOff, Trash2, QrCode, RefreshCw, Loader2, Link2, MessageCircle } from "lucide-react";
import api from "@/lib/api";

const WhatsAppSettings = () => {
  const { toast } = useToast();
  const [instances, setInstances] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrName, setQrName] = useState("");
  const [qrInstId, setQrInstId] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/api/instances");
      setInstances(d.instances || []);
    } catch (e: any) { toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" }); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    try {
      const d = await api.post("/api/instances", { nome: nome.trim() });
      if (d.qrcode) { setQr(d.qrcode); setQrName(nome.trim()); setQrInstId(d.instance?.id || null); }
      toast({ title: "Instância criada!", description: "Escaneie o QR Code." });
      setShowNew(false); setNome(""); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    setLoading(false);
  };

  const verQr = async (inst: any) => {
    try {
      const d = await api.get(`/api/instances/${inst.id}/qrcode`);
      if (d.qrcode) { setQr(d.qrcode); setQrName(inst.nome); setQrInstId(inst.id); }
      else toast({ title: "Sem QR", description: "A instância já pode estar conectada." });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const fecharQr = () => { setQr(null); setQrInstId(null); };

  // Enquanto o QR está aberto: renova o QR (expira ~30-60s) e detecta a conexão sozinho
  useEffect(() => {
    if (!qrInstId) return;
    let stop = false;
    const refreshQr = async () => {
      try { const d = await api.get(`/api/instances/${qrInstId}/qrcode`); if (!stop && d.qrcode) setQr(d.qrcode); } catch { /* */ }
    };
    const checkStatus = async () => {
      try {
        const d = await api.get(`/api/instances/${qrInstId}/status`);
        if (!stop && d.status === "CONECTADO") {
          setInstances(p => p.map(i => i.id === qrInstId ? { ...i, status: "CONECTADO" } : i));
          stop = true; setQr(null); setQrInstId(null);
          toast({ title: "Conectado! ✅", description: "WhatsApp vinculado com sucesso." });
        }
      } catch { /* */ }
    };
    const qrTimer = setInterval(refreshQr, 25000);  // renova o QR antes de expirar
    const stTimer = setInterval(checkStatus, 4000);  // detecta a conexão
    return () => { stop = true; clearInterval(qrTimer); clearInterval(stTimer); };
  }, [qrInstId]); // eslint-disable-line

  const checarStatus = async (inst: any) => {
    setChecking(inst.id);
    try {
      const d = await api.get(`/api/instances/${inst.id}/status`);
      setInstances(p => p.map(i => i.id === inst.id ? { ...i, status: d.status } : i));
      toast({ title: `Status: ${d.status}` });
      if (d.status === "CONECTADO") fecharQr();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    setChecking(null);
  };

  const remover = async (id: string) => {
    if (!(await confirm("Excluir esta instância?"))) return;
    try { await api.delete(`/api/instances/${id}`); setInstances(p => p.filter(i => i.id !== id)); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const toggleInbox = async (inst: any) => {
    const novo = !inst.inbox_enabled;
    setInstances(p => p.map(i => i.id === inst.id ? { ...i, inbox_enabled: novo } : i));
    try {
      await api.patch(`/api/instances/${inst.id}`, { inbox_enabled: novo });
      toast({ title: novo ? "Inbox ativado para esta instância" : "Inbox desativado", description: novo ? "As conversas deste número passam a aparecer no Hub de Conversas." : undefined });
    } catch (e: any) {
      setInstances(p => p.map(i => i.id === inst.id ? { ...i, inbox_enabled: inst.inbox_enabled } : i));
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const [webhooking, setWebhooking] = useState<string | null>(null);
  const configurarWebhook = async (inst: any) => {
    setWebhooking(inst.id);
    try {
      const d = await api.post(`/api/instances/${inst.id}/set-webhook`, {});
      toast({ title: "Webhook configurado! ✅", description: `Evolution vai avisar em ${d.url}` });
    } catch (e: any) {
      toast({ title: "Erro ao configurar webhook", description: e.message, variant: "destructive" });
    } finally { setWebhooking(null); }
  };

  return (
    <div className="space-y-5">
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-foreground">Instâncias WhatsApp (Evolution)</h3>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm" className="gradient-button"><Plus className="w-4 h-4 mr-1" /> Nova Instância</Button>
        </div>
        <p className="text-xs text-muted-foreground">Conecte números de WhatsApp via Evolution API. Usado para campanhas, alertas e aprovação de posts no grupo do cliente.</p>

        {instances.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma instância. Crie uma e escaneie o QR Code.</p>}

        <div className="space-y-2">
          {instances.map(inst => (
            <div key={inst.id} className="flex items-center justify-between bg-secondary/40 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${inst.status === "CONECTADO" ? "bg-green-500/20" : "bg-red-500/10"}`}>
                  {inst.status === "CONECTADO" ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{inst.nome}</p>
                  <p className={`text-[11px] ${inst.status === "CONECTADO" ? "text-green-400" : "text-muted-foreground"}`}>
                    {inst.status}{inst.phone ? ` · ${inst.phone}` : ""}{inst.gone ? " · (não existe mais na Evolution)" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => toggleInbox(inst)} title="Alimentar o Hub de Conversas com esta instância"
                  className={`h-8 px-2 rounded-md text-[11px] font-bold flex items-center gap-1 ${inst.inbox_enabled ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30" : "bg-secondary text-muted-foreground border border-border"}`}>
                  <MessageCircle className="w-3.5 h-3.5" /> {inst.inbox_enabled ? "Inbox ON" : "Inbox"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => checarStatus(inst)} disabled={checking === inst.id} className="h-8 text-xs">
                  {checking === inst.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
                {inst.status !== "CONECTADO" && (
                  <Button variant="ghost" size="sm" onClick={() => verQr(inst)} className="h-8 text-xs"><QrCode className="w-3.5 h-3.5 mr-1" /> QR</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => configurarWebhook(inst)} disabled={webhooking === inst.id} className="h-8 text-xs" title="Configurar webhook (aprovação/demandas)">
                  {webhooking === inst.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remover(inst.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal criar */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Nova Instância WhatsApp</DialogTitle></DialogHeader>
          <form onSubmit={criar} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Instância</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: WhatsApp Principal" className="bg-secondary border-border" />
            </div>
            <Button type="submit" disabled={loading} className="gradient-button w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar e gerar QR"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal QR */}
      <Dialog open={!!qr} onOpenChange={v => !v && fecharQr()}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Conectar {qrName}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qr && <img src={qr} alt="QR Code" className="w-64 h-64 rounded-xl bg-white p-2" />}
            <p className="text-xs text-muted-foreground text-center">No WhatsApp: Aparelhos conectados → Conectar aparelho → escaneie este código.</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Renovando o código e aguardando a conexão...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppSettings;
