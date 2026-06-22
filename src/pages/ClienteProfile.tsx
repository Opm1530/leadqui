import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  ArrowLeft, Loader2, Building2, FolderOpen, Kanban, ClipboardList, Plus, Check,
  DollarSign, Lock, Eye, MousePointerClick, Star, ListTodo, Receipt, CalendarClock, Instagram,
} from "lucide-react";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TABS = [
  { id: "geral", label: "Visão Geral", icon: Building2 },
  { id: "tarefas", label: "Tarefas", icon: ListTodo },
  { id: "calendario", label: "Calendário", icon: CalendarClock },
  { id: "trafego", label: "Tráfego", icon: MousePointerClick },
  { id: "social", label: "TechQui", icon: Instagram },
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

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get("/api/clients");
        setClient((d.clients || []).find((c: any) => c.id === id) || null);
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
    if (tab === "social") api.get(`/api/techqui/connections`).then(d => setConnection((d.connections || []).find((c: any) => c.client_id === id) || null)).catch(() => {});
  }, [tab, id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!client) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cliente não encontrado.</div>;

  const openTasks = tasks.filter((t: any) => t.status !== "CONCLUIDO");
  const openInvoices = invoices.filter((i: any) => i.status !== "PAGO");
  const openInvoicesTotal = openInvoices.reduce((a: number, i: any) => a + (i.amount || 0), 0);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/clients")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar aos clientes
      </button>

      {/* Cabeçalho */}
      <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <p className="text-sm text-muted-foreground">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${client.status === "ATIVO" ? "bg-green-500/20 text-green-300" : "bg-secondary text-muted-foreground"}`}>{client.status}</span>
                {client.contract && <span className="ml-2">{brl(client.contract.value)}/mês · Resp: {client.contract.responsible || "—"}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {client.drive_url && (
              <a href={client.drive_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-bold hover:bg-yellow-500/20">
                <FolderOpen className="w-4 h-4" /> Drive
              </a>
            )}
            <button onClick={() => navigate(`/tasqui/cliente/${id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/20">
              <Kanban className="w-4 h-4" /> Quadro
            </button>
            <button onClick={() => navigate(`/onboarding/${id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">
              <ClipboardList className="w-4 h-4" /> Onboarding
            </button>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${tab === t.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={ListTodo} label="Tarefas abertas" value={openTasks.length} color="text-blue-400" />
          <Stat icon={Receipt} label="Faturas em aberto" value={openInvoices.length} color="text-orange-400" />
          <Stat icon={DollarSign} label="Total em aberto" value={brl(openInvoicesTotal)} color="text-green-400" />
          <Stat icon={Star} label="Serviços" value={(client.services || []).length} color="text-pink-400" />
        </div>
      )}

      {tab === "tarefas" && <TarefasTab clientId={id!} tasks={tasks} setTasks={setTasks} navigate={navigate} />}
      {tab === "financas" && <FinancasTab clientId={id!} invoices={invoices} setInvoices={setInvoices} toast={toast} navigate={navigate} />}
      {tab === "senhas" && <SenhasTab vault={vault} navigate={navigate} />}
      {tab === "calendario" && (
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-foreground">Calendário editorial</h2>
            <button onClick={() => navigate("/tasqui/calendar")} className="text-xs text-primary hover:underline">abrir calendário completo</button>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {posts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum post no calendário.</p>}
            {posts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p.type}</span>
                <span className="flex-1 text-sm text-foreground truncate">{p.title || "(a preencher)"}</span>
                <span className="text-[11px] text-muted-foreground">{new Date(p.scheduled_date).toLocaleDateString("pt-BR")}</span>
                <span className="text-[10px] text-muted-foreground">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "social" && (
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Social / TechQui</h2>
          {connection ? (
            <div className="rounded-xl bg-secondary/40 p-3 mb-4">
              <p className="text-sm text-foreground flex items-center gap-2"><Instagram className="w-4 h-4 text-pink-400" /> Conectado</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {connection.instagram_username ? `@${connection.instagram_username}` : ""}
                {connection.page_name ? ` · ${connection.page_name}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 mb-4 text-xs text-yellow-300">
              Este cliente ainda não tem conta Meta/Instagram conectada.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate("/techqui")} className="py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70">Conexões</button>
            <button onClick={() => navigate("/techqui/instagram")} className="py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70">Instagram</button>
            <button onClick={() => navigate("/techqui/ads")} className="py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70">Meta Ads</button>
            <button onClick={() => navigate("/techqui/comments")} className="py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70">Auto-reply</button>
          </div>
        </div>
      )}

      {tab === "trafego" && <ListaSimples itens={traffic} vazio="Nenhuma campanha de tráfego." render={(c: any) => `${c.name}${c.objective ? ` — ${c.objective}` : ""}`} onAbrir={() => navigate("/tasqui/traffic")} />}
      {tab === "influencers" && <ListaSimples itens={partnerships} vazio="Nenhuma parceria." render={(p: any) => `${p.titulo} — ${p.influencer?.nome}`} onAbrir={() => navigate("/influencers")} />}
      {tab === "dados" && (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-center">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-3">Dados do onboarding deste cliente (loja, público, checklist).</p>
          <Button onClick={() => navigate(`/onboarding/${id}`)} className="gradient-button">Abrir Onboarding</Button>
        </div>
      )}
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

// ── Tarefas embutidas ──────────────────────────────────────────────────
const TarefasTab = ({ clientId, tasks, setTasks, navigate }: any) => {
  const [novo, setNovo] = useState("");
  const add = async () => {
    if (!novo.trim()) return;
    const t = await api.post("/api/tasqui/tasks", { title: novo.trim(), client_id: clientId, priority: "MEDIA" });
    setTasks((p: any[]) => [...p, t]); setNovo("");
  };
  const toggle = async (t: any) => {
    const status = t.status === "CONCLUIDO" ? "PENDENTE" : "CONCLUIDO";
    setTasks((p: any[]) => p.map(x => x.id === t.id ? { ...x, status } : x));
    await api.patch(`/api/tasqui/tasks/${t.id}`, { status }).catch(() => {});
  };
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Tarefas</h2>
        <button onClick={() => navigate(`/tasqui/cliente/${clientId}`)} className="text-xs text-primary hover:underline">abrir quadro completo</button>
      </div>
      <div className="space-y-1.5">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa.</p>}
        {tasks.map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-2 py-1.5">
            <button onClick={() => toggle(t)} className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${t.status === "CONCLUIDO" ? "bg-green-600 border-green-600" : "border-muted-foreground/40"}`}>
              {t.status === "CONCLUIDO" && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className={`flex-1 text-sm ${t.status === "CONCLUIDO" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
            {t.responsible?.name && <span className="text-[11px] text-muted-foreground">{t.responsible.name}</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="Nova tarefa..." className="bg-secondary border-border text-sm" />
        <Button onClick={add} className="gradient-button"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

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
