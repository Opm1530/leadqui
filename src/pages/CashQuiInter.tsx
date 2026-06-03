import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Settings, Link2, EyeOff, ArrowDownCircle, ArrowUpCircle, Loader2, CheckCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDENTE:  { label: "Pendente",  color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  VINCULADO: { label: "Vinculado", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  IGNORADO:  { label: "Ignorado",  color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const CashQuiInter = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const [configured, setConfigured] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("PENDENTE");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [hasCert, setHasCert] = useState(false);
  const [creds, setCreds] = useState({
    client_id: "", client_secret: "", account_number: "",
    cert_content: "", key_content: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [credData, txData, invData] = await Promise.all([
        api.get("/api/cashqui/inter/credentials"),
        api.get(`/api/cashqui/inter/transactions?status=${filterStatus}`),
        api.get("/api/cashqui/invoices?status=PENDENTE"),
      ]);
      setConfigured(credData.configured);
      setLastSync(credData.credentials?.last_sync || null);
      setHasCert(!!credData.credentials?.has_cert);
      setTransactions(txData.transactions || []);
      setInvoices(invData.invoices || []);
    } catch {
      toast({ title: "Erro ao carregar dados Inter", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("cashqui");
    load();
  }, [filterStatus]);

  const handleSaveCredentials = async () => {
    if (!creds.client_id || !creds.client_secret) {
      toast({ title: "Client ID e Client Secret são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      await api.post("/api/cashqui/inter/credentials", creds);
      toast({ title: "Credenciais salvas!" });
      setSettingsOpen(false);
      load();
    } catch {
      toast({ title: "Erro ao salvar credenciais", variant: "destructive" });
    }
  };

  const handleSync = async () => {
    if (!hasCert) {
      toast({ title: "Certificado mTLS não configurado", description: "Adicione o .crt e .key nas configurações antes de sincronizar.", variant: "destructive" });
      setSettingsOpen(true);
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post("/api/cashqui/inter/sync", {});
      toast({ title: `Sincronizado! ${res.imported} nova(s), ${res.skipped} já existia(m).` });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const handleLink = async () => {
    if (!selectedInvoice) { toast({ title: "Selecione uma fatura.", variant: "destructive" }); return; }
    try {
      await api.patch(`/api/cashqui/inter/transactions/${linkModal.id}/link`, {
        status: "VINCULADO",
        linked_invoice_id: selectedInvoice,
      });
      toast({ title: "Transação vinculada e fatura marcada como paga!" });
      setLinkModal(null);
      setSelectedInvoice("");
      load();
    } catch {
      toast({ title: "Erro ao vincular", variant: "destructive" });
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      await api.patch(`/api/cashqui/inter/transactions/${id}/link`, { status: "IGNORADO" });
      toast({ title: "Transação ignorada." });
      load();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const filtered = transactions;
  const pendingCount = transactions.filter(t => t.status === "PENDENTE").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Banco Inter</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {lastSync ? `Última sincronização: ${fmtDate(lastSync)}` : "Nunca sincronizado"}
            </p>
            {configured && (
              <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                hasCert
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : "text-orange-400 bg-orange-500/10 border-orange-500/20"
              }`}>
                {hasCert ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {hasCert ? "mTLS configurado" : "Certificado pendente"}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-yellow-400 text-xs font-bold">{pendingCount} pendente(s) para reconciliar</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)} className="border-border gap-2 h-9">
            <Settings className="w-4 h-4" /> Configurar
          </Button>
          {configured && (
            <Button onClick={handleSync} disabled={syncing} className="gradient-button gap-2 h-9">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar
            </Button>
          )}
        </div>
      </div>

      {!configured ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
            <Settings className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-lg font-black text-foreground">Configure as credenciais do Inter</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Acesse o portal Inter Empresas → Configurações → API Banking e gere seu Client ID e Client Secret.
          </p>
          <Button onClick={() => setSettingsOpen(true)} className="gradient-button gap-2">
            <Settings className="w-4 h-4" /> Configurar Agora
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex gap-2">
            {["PENDENTE", "VINCULADO", "IGNORADO"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  filterStatus === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {STATUS_CFG[s].label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma transação {STATUS_CFG[filterStatus]?.label.toLowerCase()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === "CREDITO" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {tx.type === "CREDITO"
                        ? <ArrowDownCircle className="w-4 h-4" />
                        : <ArrowUpCircle className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{tx.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(tx.date)} · {tx.category || tx.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <p className={`text-base font-black ${tx.type === "CREDITO" ? "text-green-400" : "text-red-400"}`}>
                      {tx.type === "DEBITO" ? "-" : "+"}{fmt(tx.amount)}
                    </p>
                    <span className={`hidden md:inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_CFG[tx.status]?.color}`}>
                      {STATUS_CFG[tx.status]?.label}
                    </span>
                    {tx.status === "PENDENTE" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setLinkModal(tx)} className="text-xs h-8 border-border gap-1">
                          <Link2 className="w-3 h-3" /> Vincular
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleIgnore(tx.id)} className="text-xs h-8 text-muted-foreground hover:text-white">
                          <EyeOff className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Configurações */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configurar Inter Empresas</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs leading-relaxed">
              Inter Empresas → Configurações → Integrações → API Banking → Criar aplicação.<br />
              Baixe o <strong>certificado (.crt)</strong> e a <strong>chave privada (.key)</strong> gerados no portal.
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Client ID *</Label>
              <Input
                value={creds.client_id}
                onChange={e => setCreds(c => ({ ...c, client_id: e.target.value }))}
                className="bg-secondary border-border font-mono text-sm"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Client Secret *</Label>
              <Input
                type="password"
                value={creds.client_secret}
                onChange={e => setCreds(c => ({ ...c, client_secret: e.target.value }))}
                className="bg-secondary border-border font-mono text-sm"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Número da Conta Corrente</Label>
              <Input
                value={creds.account_number}
                onChange={e => setCreds(c => ({ ...c, account_number: e.target.value }))}
                placeholder="Ex: 382003730"
                className="bg-secondary border-border font-mono"
              />
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                Certificado mTLS — obrigatório para autenticar na API Inter
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                  Conteúdo do Certificado (.crt)
                  {hasCert && <span className="ml-2 text-green-400 normal-case font-normal">✓ já configurado</span>}
                </Label>
                <Textarea
                  value={creds.cert_content}
                  onChange={e => setCreds(c => ({ ...c, cert_content: e.target.value }))}
                  className="bg-secondary border-border font-mono text-xs h-28 resize-none"
                  placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                  Conteúdo da Chave Privada (.key)
                  {hasCert && <span className="ml-2 text-green-400 normal-case font-normal">✓ já configurado</span>}
                </Label>
                <Textarea
                  value={creds.key_content}
                  onChange={e => setCreds(c => ({ ...c, key_content: e.target.value }))}
                  className="bg-secondary border-border font-mono text-xs h-28 resize-none"
                  placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveCredentials} className="gradient-button">Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Vincular transação */}
      <Dialog open={!!linkModal} onOpenChange={() => { setLinkModal(null); setSelectedInvoice(""); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Vincular Transação</DialogTitle></DialogHeader>
          {linkModal && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-secondary/50 border border-border text-sm">
                <p className="font-bold text-foreground">{linkModal.title}</p>
                <p className="text-muted-foreground">{fmtDate(linkModal.date)} · {fmt(linkModal.amount)}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Vincular a qual fatura?</Label>
                <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a fatura..." /></SelectTrigger>
                  <SelectContent>
                    {invoices.map((inv: any) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.client?.name} — {fmt(inv.amount)} · vence {fmtDate(inv.due_date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">A fatura vinculada será marcada como <strong>Paga</strong> automaticamente.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkModal(null)} className="border-border">Cancelar</Button>
            <Button onClick={handleLink} className="gradient-button">Vincular e Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashQuiInter;
