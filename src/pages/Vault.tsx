import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import {
  Lock, Plus, Eye, EyeOff, Copy, Check, Trash2, Edit2, Loader2,
  ShieldCheck, Search, Globe, Mail, Megaphone, BarChart2, Building2,
  CreditCard, LayoutDashboard, KeyRound, History, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Config de categorias ──────────────────────────────────────────────
const CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  SOCIAL_MEDIA: { label: "Redes Sociais",   icon: Megaphone,      color: "text-pink-400" },
  HOSTING:      { label: "Hospedagem",      icon: Globe,          color: "text-blue-400" },
  EMAIL:        { label: "E-mail",          icon: Mail,           color: "text-yellow-400" },
  ADS:          { label: "Tráfego / Ads",   icon: BarChart2,      color: "text-orange-400" },
  CRM:          { label: "CRM / Sistema",   icon: LayoutDashboard,color: "text-purple-400" },
  BANCO:        { label: "Banco / Financ.", icon: CreditCard,     color: "text-green-400" },
  DOMINIO:      { label: "Domínio / DNS",   icon: Building2,      color: "text-cyan-400" },
  OUTROS:       { label: "Outros",          icon: KeyRound,       color: "text-gray-400" },
};

const CAN_REVEAL = ["ADMIN", "MANAGER"];

// ── Componente principal ──────────────────────────────────────────────
const Vault = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients]           = useState<any[]>([]);
  const [credentials, setCredentials]   = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [search, setSearch]             = useState("");
  const [filterCat, setFilterCat]       = useState("ALL");
  const [loading, setLoading]           = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [auditOpen, setAuditOpen]       = useState(false);
  const [editing, setEditing]           = useState<any>(null);
  const [auditCred, setAuditCred]       = useState<any>(null);
  const [auditLogs, setAuditLogs]       = useState<any[]>([]);
  const canReveal = CAN_REVEAL.includes(user?.role || "");

  useEffect(() => {
    api.get("/api/clients").then(d => setClients(d.clients || [])).catch(() => {});
    load();
  }, []);

  useEffect(() => { load(); }, [selectedClient]);

  const load = async () => {
    setLoading(true);
    try {
      const params = selectedClient !== "all" ? `?client_id=${selectedClient}` : "";
      const d = await api.get(`/api/vault${params}`);
      setCredentials(d.credentials || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar cofre", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const openAudit = async (cred: any) => {
    setAuditCred(cred);
    try {
      const d = await api.get(`/api/vault/${cred.id}/audit`);
      setAuditLogs(d.logs || []);
    } catch { setAuditLogs([]); }
    setAuditOpen(true);
  };

  // Filtros
  const filtered = credentials.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.username?.toLowerCase().includes(search.toLowerCase()) ||
      c.url?.toLowerCase().includes(search.toLowerCase()) ||
      c.client?.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "ALL" || c.category === filterCat;
    return matchSearch && matchCat;
  });

  // Agrupar por categoria
  const grouped = filtered.reduce((acc: Record<string, any[]>, cred) => {
    const cat = cred.category || "OUTROS";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cred);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center border border-slate-500/30">
            <Lock className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cofre de Senhas</h1>
            <p className="text-muted-foreground text-sm">{credentials.length} credencial(is) armazenada(s) com AES-256</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-button">
          <Plus className="w-4 h-4 mr-1" /> Nova Credencial
        </Button>
      </div>

      {/* Aviso de segurança para OPERATOR */}
      {!canReveal && (
        <div className="glass-card p-4 border border-yellow-500/20 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-300">Você está logado como <strong>{user?.role}</strong>. Apenas ADMIN e MANAGER podem revelar senhas. Você pode visualizar os títulos e usernames.</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, usuário ou URL..." className="pl-9 bg-secondary border-border" />
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada */}
      {loading && <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">Nenhuma credencial encontrada.</p>
          <p className="text-muted-foreground text-xs mt-1">Clique em "Nova Credencial" para adicionar.</p>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => {
        const cfg = CATEGORIES[cat] || CATEGORIES.OUTROS;
        const Icon = cfg.icon;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
              <span className="text-xs text-muted-foreground">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map(cred => (
                <CredentialCard
                  key={cred.id}
                  cred={cred}
                  canReveal={canReveal}
                  onEdit={() => { setEditing(cred); setModalOpen(true); }}
                  onDelete={load}
                  onAudit={() => openAudit(cred)}
                  toast={toast}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Modal criar/editar */}
      <CredentialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        clients={clients}
        onSaved={() => { setModalOpen(false); load(); }}
        toast={toast}
      />

      {/* Modal audit log */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Histórico de Acessos — {auditCred?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {auditLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum acesso registrado.</p>}
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg p-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.action === "REVEAL" ? "bg-yellow-400" : log.action === "DELETE" ? "bg-red-400" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium">{log.user_email} <span className="text-muted-foreground font-normal">({log.user_role})</span></p>
                  <p className="text-[10px] text-muted-foreground">{log.action} {log.ip_address ? `· ${log.ip_address}` : ""}</p>
                </div>
                <p className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Card de credencial ────────────────────────────────────────────────
const CredentialCard = ({ cred, canReveal, onEdit, onDelete, onAudit, toast }: any) => {
  const [revealed, setRevealed]       = useState(false);
  const [password, setPassword]       = useState("");
  const [revealing, setRevealing]     = useState(false);
  const [copied, setCopied]           = useState(false);
  const [showNotes, setShowNotes]     = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const reveal = async () => {
    if (revealed) { hide(); return; }
    setRevealing(true);
    try {
      const d = await api.post(`/api/vault/${cred.id}/reveal`, {});
      setPassword(d.password);
      setRevealed(true);
      // Ocultar automaticamente após 30s
      hideTimer.current = setTimeout(hide, 30000);
    } catch (e: any) {
      toast({ title: "Erro ao revelar", description: e.message, variant: "destructive" });
    } finally { setRevealing(false); }
  };

  const hide = () => {
    setRevealed(false);
    setPassword("");
    clearTimeout(hideTimer.current);
  };

  const copy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remove = async () => {
    if (!confirm(`Excluir "${cred.title}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/vault/${cred.id}`);
      onDelete();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const cfg = CATEGORIES[cred.category] || CATEGORIES.OUTROS;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-start gap-3">
        {/* Ícone categoria */}
        <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Linha 1: título + cliente */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{cred.title}</p>
            {cred.client?.name && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{cred.client.name}</span>
            )}
          </div>

          {/* Linha 2: username + URL */}
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {cred.username && <span className="font-mono">{cred.username}</span>}
            {cred.url && <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs">{cred.url}</a>}
          </div>

          {/* Senha revelada */}
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-2"
              >
                <code className="flex-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg text-sm font-mono tracking-widest select-all">
                  {password}
                </code>
                <button onClick={copy} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Copiar">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <span className="text-[10px] text-yellow-500/70">Oculta em 30s</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notas */}
          {cred.notes && (
            <button onClick={() => setShowNotes(v => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors">
              {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showNotes ? "Ocultar notas" : "Ver notas"}
            </button>
          )}
          {showNotes && cred.notes && (
            <p className="text-xs text-muted-foreground mt-1 bg-secondary/50 rounded p-2 whitespace-pre-wrap">{cred.notes}</p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canReveal && (
            <button
              onClick={reveal}
              disabled={revealing}
              className={`p-2 rounded-lg transition-colors ${revealed ? "bg-yellow-500/20 text-yellow-400" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
              title={revealed ? "Ocultar senha" : "Revelar senha"}
            >
              {revealing ? <Loader2 className="w-4 h-4 animate-spin" /> : revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onAudit} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Histórico de acessos">
            <History className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Editar">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={remove} disabled={deleting} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Modal criar/editar ────────────────────────────────────────────────
const CredentialModal = ({ open, onClose, editing, clients, onSaved, toast }: any) => {
  const [form, setForm] = useState({ client_id: "", title: "", category: "OUTROS", username: "", url: "", notes: "", password: "" });
  const [showPass, setShowPass]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [strength, setStrength]   = useState(0);

  useEffect(() => {
    if (editing) {
      setForm({ client_id: editing.client_id, title: editing.title, category: editing.category, username: editing.username || "", url: editing.url || "", notes: editing.notes || "", password: "" });
    } else {
      setForm({ client_id: "", title: "", category: "OUTROS", username: "", url: "", notes: "", password: "" });
    }
    setShowPass(false);
  }, [editing, open]);

  useEffect(() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8)  s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    setStrength(s);
  }, [form.password]);

  const generate = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 20; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, password: pass }));
  };

  const save = async () => {
    if (!form.client_id || !form.title) {
      toast({ title: "Cliente e título são obrigatórios", variant: "destructive" }); return;
    }
    if (!editing && !form.password) {
      toast({ title: "Senha é obrigatória", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/vault/${editing.id}`, form);
        toast({ title: "Credencial atualizada!" });
      } else {
        await api.post("/api/vault", form);
        toast({ title: "Credencial salva no cofre!" });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const strengthColors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
  const strengthLabels = ["", "Muito fraca", "Fraca", "Média", "Forte", "Muito forte"];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {editing ? "Editar Credencial" : "Nova Credencial"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Instagram Ads — Conta principal" className="bg-secondary border-border" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Usuário / E-mail</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="usuario@email.com" className="bg-secondary border-border" />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://ads.google.com" className="bg-secondary border-border" />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Senha {editing && <span className="normal-case text-muted-foreground">(deixe vazio para manter)</span>}
              </Label>
              <button type="button" onClick={generate} className="text-[10px] text-primary hover:underline">Gerar senha forte</button>
            </div>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "Nova senha (opcional)" : "Digite ou gere uma senha"}
                className="bg-secondary border-border pr-10 font-mono"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Indicador de força */}
            {form.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColors[strength] : "bg-secondary"}`} />
                  ))}
                </div>
                <p className={`text-[10px] ${strengthColors[strength].replace("bg-", "text-")}`}>{strengthLabels[strength]}</p>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notas (opcional)</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Informações adicionais, observações de acesso..." className="bg-secondary border-border" rows={3} />
          </div>

          {/* Aviso de segurança */}
          <div className="flex items-start gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">A senha é criptografada com <strong className="text-foreground">AES-256-GCM</strong> antes de ser salva. A chave fica na VPS e nunca no banco de dados.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gradient-button">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Lock className="w-4 h-4 mr-1" />}
            {editing ? "Salvar" : "Guardar no Cofre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Vault;
