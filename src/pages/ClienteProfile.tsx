import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import ClientTaskBoard from "@/components/ClientTaskBoard";
import ClientCalendar from "@/components/ClientCalendar";
import {
  ArrowLeft, Loader2, Building2, FolderOpen, Kanban, ClipboardList, Plus, Check,
  DollarSign, Lock, Eye, Star, ListTodo, Receipt, CalendarClock, Instagram, Facebook, BarChart2, MessageSquare,
} from "lucide-react";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TABS = [
  { id: "geral", label: "Visão Geral", icon: Building2 },
  { id: "tarefas", label: "Tarefas", icon: ListTodo },
  { id: "calendario", label: "Calendário", icon: CalendarClock },
  { id: "conexoes", label: "Conexões", icon: Instagram },
  { id: "ads", label: "Meta Ads", icon: BarChart2 },
  { id: "autoreply", label: "Auto-reply", icon: MessageSquare },
  { id: "financas", label: "Finanças", icon: DollarSign },
  { id: "senhas", label: "Senhas", icon: Lock },
  { id: "influencers", label: "Influencers", icon: Star },
  { id: "dados", label: "Dados", icon: ClipboardList },
];

const ClienteProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("geral");

  const [tasks, setTasks] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vault, setVault] = useState<any[]>([]);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [connection, setConnection] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const reloadTasks = () => api.get(`/api/tasqui/tasks?clientId=${id}`).then(setTasks).catch(() => {});

  const loadConnection = () => api.get(`/api/techqui/connections`).then(d => setConnection((d.connections || []).find((c: any) => c.client_id === id) || null)).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get("/api/clients");
        setClient((d.clients || []).find((c: any) => c.id === id) || null);
        api.get("/api/teamqui").then(t => setTeam(t.users || t || [])).catch(() => {});
      } finally { setLoading(false); }
    })();
  }, [id]);

  // Carregamento sob demanda por aba
  useEffect(() => {
    if (!id) return;
    if (tab === "tarefas" || tab === "geral") api.get(`/api/tasqui/tasks?clientId=${id}`).then(setTasks).catch(() => {});
    if (tab === "financas" || tab === "geral") api.get(`/api/cashqui/invoices?client_id=${id}`).then(d => setInvoices(d.invoices || [])).catch(() => {});
    if (tab === "senhas") api.get(`/api/vault?client_id=${id}`).then(d => setVault(d.credentials || d.vault || [])).catch(() => {});
    if (tab === "trafego") api.get(`/api/tasqui/traffic?clientId=${id}`).then(d => setTraffic(d.campaigns || d || [])).catch(() => {});
    if (tab === "influencers") api.get(`/api/influencers/partnerships?client_id=${id}`).then(d => setPartnerships(d.partnerships || [])).catch(() => {});
    if (tab === "calendario") api.get(`/api/tasqui/calendar?client_id=${id}`).then(d => setPosts(Array.isArray(d) ? d : (d.posts || []))).catch(() => {});
    if (tab === "conexoes" || tab === "ads" || tab === "autoreply") loadConnection();
    if (tab === "autoreply") api.get(`/api/techqui/comments/rules?client_id=${id}`).then(d => setRules(d.rules || [])).catch(() => {});
    if (tab === "ads") api.get(`/api/techqui/ads/analyses?client_id=${id}`).then(d => setAnalyses(d.analyses || [])).catch(() => {});
    if (tab === "dados") api.get(`/api/onboarding/${id}`).then(d => setOnboarding(d.onboarding)).catch(() => {});
  }, [tab, id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!client) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cliente não encontrado.</div>;

  const openTasks = tasks.filter((t: any) => t.status !== "CONCLUIDO");
  const openInvoices = invoices.filter((i: any) => i.status !== "PAGO");
  const openInvoicesTotal = openInvoices.reduce((a: number, i: any) => a + (i.amount || 0), 0);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar do cliente */}
      <aside className="w-64 bg-sidebar border-r border-border min-h-screen sticky top-0 flex flex-col shadow-2xl flex-shrink-0">
        <div className="p-5 border-b border-white/5">
          <button onClick={() => navigate("/clientes")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Clientes
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black">{(client.name || "?").charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{client.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${client.status === "ATIVO" ? "bg-green-500/20 text-green-300" : "bg-secondary text-muted-foreground"}`}>{client.status}</span>
            </div>
          </div>
          {client.contract && <p className="text-[11px] text-muted-foreground mt-2">{brl(client.contract.value)}/mês · {client.contract.responsible || "—"}</p>}
          <div className="flex gap-1.5 mt-3">
            {client.drive_url && (
              <a href={client.drive_url} target="_blank" rel="noreferrer" title="Drive" className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"><FolderOpen className="w-4 h-4" /></a>
            )}
            <button onClick={() => setTab("tarefas")} title="Quadro de tarefas" className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"><Kanban className="w-4 h-4" /></button>
            <button onClick={() => navigate(`/onboarding/${id}`)} title="Onboarding" className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"><ClipboardList className="w-4 h-4" /></button>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all group ${active ? "bg-white/10 text-white shadow-lg" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}>
                <t.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${active ? "text-orange-500" : ""}`} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-6 md:p-8 min-w-0">
      {tab === "geral" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={ListTodo} label="Tarefas abertas" value={openTasks.length} color="text-blue-400" />
          <Stat icon={Receipt} label="Faturas em aberto" value={openInvoices.length} color="text-orange-400" />
          <Stat icon={DollarSign} label="Total em aberto" value={brl(openInvoicesTotal)} color="text-green-400" />
          <Stat icon={Star} label="Serviços" value={(client.services || []).length} color="text-pink-400" />
        </div>
      )}

      {tab === "tarefas" && <ClientTaskBoard clientId={id!} tasks={tasks} setTasks={setTasks} team={team} reload={reloadTasks} />}
      {tab === "financas" && <FinancasTab clientId={id!} invoices={invoices} setInvoices={setInvoices} toast={toast} navigate={navigate} />}
      {tab === "senhas" && <SenhasTab vault={vault} navigate={navigate} />}
      {tab === "calendario" && <ClientCalendar clientId={id!} />}

      {tab === "conexoes" && <ConexoesTab clientId={id!} connection={connection} reload={loadConnection} toast={toast} />}

      {tab === "ads" && (
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-blue-400" /> Meta Ads</h2>
          {!connection ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Conecte a conta Meta na aba Conexões para ver as campanhas.</p>
          ) : analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma análise de campanha ainda. O agente roda automaticamente 6h e 18h.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {analyses.map((a: any) => (
                <div key={a.id} className="bg-secondary/40 rounded-lg px-3 py-2 text-sm text-foreground">
                  <p className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</p>
                  {a.summary || a.resumo || "Análise"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "autoreply" && <AutoReplyTab clientId={id!} connection={connection} rules={rules} setRules={setRules} toast={toast} />}

      {tab === "influencers" && <InfluencersTab clientId={id!} partnerships={partnerships} setPartnerships={setPartnerships} navigate={navigate} toast={toast} />}

      {tab === "dados" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Dados do cliente</h2>
              <button onClick={() => navigate(`/onboarding/${id}`)} className="text-xs text-primary hover:underline">editar onboarding</button>
            </div>
            {onboarding ? (
              <div className="space-y-3 text-sm">
                {onboarding.store_name && <p><span className="text-muted-foreground">Loja:</span> {onboarding.store_name}</p>}
                {onboarding.store_link && <p><span className="text-muted-foreground">Link:</span> <a href={onboarding.store_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{onboarding.store_link}</a></p>}
                {onboarding.identidade_url && <p><span className="text-muted-foreground">Identidade visual:</span> <a href={onboarding.identidade_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">abrir</a></p>}
                {[
                  ["audience", "Público-alvo"],
                  ["investimento", "Investimento"],
                  ["objetivos", "Objetivos"],
                  ["concorrentes", "Concorrentes / referências"],
                  ["faturamento", "Histórico de faturamento"],
                  ["produtos", "Produtos mais vendidos"],
                  ["influenciadores", "Influenciadores que deram resultado"],
                  ["prazo_reposicao", "Prazo de reposição"],
                  ["expectativas", "Expectativas vs Realidade"],
                ].filter(([k]) => onboarding[k]).map(([k, label]) => (
                  <div key={k}>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-foreground whitespace-pre-wrap">{onboarding[k]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Onboarding ainda não preenchido.</p>
                <Button onClick={() => navigate(`/onboarding/${id}`)} className="gradient-button">Preencher Onboarding</Button>
              </div>
            )}
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

// ── Conexões (Instagram + Facebook) ────────────────────────────────────
const ConexoesTab = ({ clientId, connection, reload, toast }: any) => {
  const conectar = async (rede: "facebook" | "instagram") => {
    try {
      const url = rede === "instagram"
        ? `/api/techqui/oauth/instagram/start?client_id=${clientId}`
        : `/api/techqui/oauth/start?client_id=${clientId}`;
      const d = await api.get(url);
      const w = 600, h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(d.url, "meta_oauth", `width=${w},height=${h},left=${left},top=${top}`);
      // Recarrega ao fechar o popup
      const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); reload(); } }, 1000);
    } catch (e: any) {
      toast({ title: "Erro ao iniciar conexão", description: e.message || "Configure o app Meta nas Configurações.", variant: "destructive" });
    }
  };
  const desconectar = async () => {
    if (!connection || !confirm("Desconectar a conta deste cliente?")) return;
    try { await api.delete(`/api/techqui/connections/${connection.id}`); reload(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const igOn = !!connection?.instagram_username || !!connection?.instagram_account_id;
  const fbOn = !!connection?.page_name || !!connection?.page_id;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Instagram */}
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Instagram className="w-6 h-6 text-pink-500" />
          <h3 className="font-semibold text-foreground">Instagram</h3>
        </div>
        {igOn ? (
          <>
            <p className="text-sm text-green-400 mb-1">✓ Conectado</p>
            <p className="text-xs text-muted-foreground">{connection.instagram_username ? `@${connection.instagram_username}` : connection.instagram_account_id}</p>
            <button onClick={desconectar} className="mt-3 text-xs text-red-400 hover:underline">Desconectar</button>
          </>
        ) : (
          <button onClick={() => conectar("instagram")} className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90">
            Conectar Instagram
          </button>
        )}
      </div>
      {/* Facebook / Meta */}
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Facebook className="w-6 h-6 text-blue-500" />
          <h3 className="font-semibold text-foreground">Facebook / Meta</h3>
        </div>
        {fbOn ? (
          <>
            <p className="text-sm text-green-400 mb-1">✓ Conectado</p>
            <p className="text-xs text-muted-foreground">{connection.page_name || connection.page_id}</p>
            <button onClick={desconectar} className="mt-3 text-xs text-red-400 hover:underline">Desconectar</button>
          </>
        ) : (
          <button onClick={() => conectar("facebook")} className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">
            Conectar Facebook
          </button>
        )}
      </div>
    </div>
  );
};

// ── Auto-reply (regras de comentários) ──────────────────────────────────
const AutoReplyTab = ({ clientId, connection, rules, setRules, toast }: any) => {
  const [nome, setNome] = useState("");
  const [resposta, setResposta] = useState("");
  const add = async () => {
    if (!connection) { toast({ title: "Conecte o Instagram primeiro (aba Conexões).", variant: "destructive" }); return; }
    if (!nome.trim() || !resposta.trim()) return;
    try {
      const d = await api.post("/api/techqui/comments/rules", {
        connection_id: connection.id, client_id: clientId, name: nome.trim(),
        reply_type: "FIXA", fixed_reply: resposta.trim(), apply_to: "TODOS",
      });
      setRules((p: any[]) => [...p, d.rule]); setNome(""); setResposta("");
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  const toggle = async (r: any) => {
    await api.patch(`/api/techqui/comments/rules/${r.id}`, { active: !r.active }).catch(() => {});
    setRules((p: any[]) => p.map(x => x.id === r.id ? { ...x, active: !x.active } : x));
  };
  const del = async (r: any) => {
    await api.delete(`/api/techqui/comments/rules/${r.id}`).catch(() => {});
    setRules((p: any[]) => p.filter(x => x.id !== r.id));
  };
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-400" /> Auto-reply de comentários</h2>
      <div className="space-y-1.5">
        {rules.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">Nenhuma regra de resposta automática.</p>}
        {rules.map((r: any) => (
          <div key={r.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
            <button onClick={() => toggle(r)} className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors ${r.active ? "bg-green-600" : "bg-secondary border border-border"}`}>
              <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${r.active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{r.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{r.fixed_reply}</p>
            </div>
            <button onClick={() => del(r)} className="p-1 text-xs text-muted-foreground hover:text-destructive">excluir</button>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
        <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da regra (ex: Saudação)" className="bg-secondary border-border text-sm" />
        <div className="flex gap-2">
          <Input value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Resposta automática" className="bg-secondary border-border text-sm" />
          <Button onClick={add} className="gradient-button"><Plus className="w-4 h-4" /></Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Responde automaticamente todos os comentários com essa mensagem fixa.</p>
      </div>
    </div>
  );
};

// ── Influencers do cliente (parcerias) ──────────────────────────────────
const TIPO_LABEL: Record<string, string> = { PERMUTA: "Permuta", PAGO: "Pago", HIBRIDO: "Híbrido" };
const InfluencersTab = ({ clientId, partnerships, setPartnerships, navigate, toast }: any) => {
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ influencer_id: "", titulo: "", tipo: "PERMUTA", cache_value: "" });
  const [saving, setSaving] = useState(false);

  const abrir = () => {
    setForm({ influencer_id: "", titulo: "", tipo: "PERMUTA", cache_value: "" });
    api.get("/api/influencers").then(d => setCatalogo(d.influencers || [])).catch(() => {});
    setOpen(true);
  };
  const criar = async () => {
    if (!form.influencer_id || !form.titulo.trim()) { toast({ title: "Escolha a influencer e o título.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const d = await api.post("/api/influencers/partnerships", { ...form, client_id: clientId });
      // recarrega a lista do cliente
      const r = await api.get(`/api/influencers/partnerships?client_id=${clientId}`);
      setPartnerships(r.partnerships || [...partnerships, d.partnership]);
      setOpen(false);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Parcerias de Influencer</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate("/influencers")} className="text-xs text-muted-foreground hover:text-foreground">catálogo</button>
          <Button onClick={abrir} size="sm" className="gradient-button gap-1 h-7 text-xs"><Plus className="w-3.5 h-3.5" /> Nova parceria</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {partnerships.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma parceria.</p>}
        {partnerships.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
            <span className="flex-1 text-sm text-foreground">{p.titulo} <span className="text-muted-foreground">— {p.influencer?.nome}</span></span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{TIPO_LABEL[p.tipo]}</span>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Nova parceria de influencer</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Influencer *</Label>
              <Select value={form.influencer_id} onValueChange={v => setForm(f => ({ ...f, influencer_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione (ou cadastre no catálogo)" /></SelectTrigger>
                <SelectContent>{catalogo.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
              {catalogo.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma influencer no catálogo. Cadastre em <button onClick={() => navigate("/influencers")} className="text-primary underline">Influencers</button>.</p>}
            </div>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título (ex: Campanha Verão)" className="bg-secondary border-border" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.tipo !== "PERMUTA" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cachê (R$)</Label>
                  <Input type="number" value={form.cache_value} onChange={e => setForm(f => ({ ...f, cache_value: e.target.value }))} className="bg-secondary border-border" />
                </div>
              )}
            </div>
            <Button onClick={criar} disabled={saving} className="w-full gradient-button">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar parceria"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, color }: any) => (
  <div className="rounded-2xl border border-border bg-card/40 p-4">
    <Icon className={`w-5 h-5 mb-2 ${color}`} />
    <p className="text-xl font-bold text-foreground">{value}</p>
    <p className="text-[11px] text-muted-foreground">{label}</p>
  </div>
);


// ── Finanças embutidas ──────────────────────────────────────────────────
const FinancasTab = ({ invoices, setInvoices, toast, navigate }: any) => {
  const marcarPago = async (inv: any) => {
    try {
      await api.put(`/api/cashqui/invoices/${inv.id}`, { status: "PAGO" });
      setInvoices((p: any[]) => p.map(x => x.id === inv.id ? { ...x, status: "PAGO" } : x));
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Faturas</h2>
        <button onClick={() => navigate("/cashqui/invoices")} className="text-xs text-primary hover:underline">abrir financeiro</button>
      </div>
      <div className="space-y-1.5">
        {invoices.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma fatura.</p>}
        {invoices.map((inv: any) => (
          <div key={inv.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{inv.description || "Fatura"}</p>
              <p className="text-[11px] text-muted-foreground">Venc.: {inv.due_date ? new Date(inv.due_date).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
            <span className="text-sm font-semibold text-foreground">{brl(inv.amount)}</span>
            {inv.status === "PAGO"
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Pago</span>
              : <button onClick={() => marcarPago(inv)} className="text-[10px] px-2 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-green-400">Marcar pago</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Senhas embutidas ────────────────────────────────────────────────────
const SenhasTab = ({ vault, navigate }: any) => {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const reveal = async (v: any) => {
    try { const d = await api.post(`/api/vault/${v.id}/reveal`, {}); setRevealed(p => ({ ...p, [v.id]: d.password })); }
    catch { /* */ }
  };
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Senhas (Cofre)</h2>
        <button onClick={() => navigate("/vault")} className="text-xs text-primary hover:underline">abrir cofre</button>
      </div>
      <div className="space-y-1.5">
        {vault.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma credencial.</p>}
        {vault.map((v: any) => (
          <div key={v.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{v.title}</p>
              {v.username && <p className="text-[11px] text-muted-foreground">{v.username}</p>}
            </div>
            {revealed[v.id]
              ? <span className="text-xs font-mono text-foreground">{revealed[v.id]}</span>
              : <button onClick={() => reveal(v)} className="text-[11px] px-2 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> revelar</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

const ListaSimples = ({ itens, vazio, render, onAbrir }: any) => (
  <div className="rounded-2xl border border-border bg-card/40 p-4">
    <div className="flex justify-end mb-2">
      <button onClick={onAbrir} className="text-xs text-primary hover:underline">abrir módulo</button>
    </div>
    <div className="space-y-1.5">
      {(!itens || itens.length === 0) && <p className="text-sm text-muted-foreground py-4 text-center">{vazio}</p>}
      {(itens || []).map((it: any) => (
        <div key={it.id} className="bg-secondary/40 rounded-lg px-3 py-2 text-sm text-foreground">{render(it)}</div>
      ))}
    </div>
  </div>
);

export default ClienteProfile;
