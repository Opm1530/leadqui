import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";
import {
  Zap, Settings, Instagram, BarChart2, MessageCircle, Plus, Trash2, Edit2,
  CheckCircle, XCircle, Clock, Loader2, RefreshCw, CalendarDays, Link2,
  TrendingUp, TrendingDown, DollarSign, Eye, MousePointerClick, Target,
  ChevronDown, ChevronUp, Play, Pause, AlertTriangle, Send, Image, Video,
  LayoutGrid, Bot, History, Users, Unlink,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (v: number, style: "currency" | "percent" | "decimal" = "decimal") =>
  v.toLocaleString("pt-BR", style === "currency" ? { style, currency: "BRL", minimumFractionDigits: 2 } : style === "percent" ? { style, minimumFractionDigits: 2 } : { minimumFractionDigits: 2 });

const statusBadge: Record<string, string> = {
  PENDENTE:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  APROVADO:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  REJEITADO: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  EXECUTADO: "bg-green-500/20 text-green-400 border-green-500/30",
  ERRO:      "bg-red-500/20 text-red-400 border-red-500/30",
  AGENDADO:  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PUBLICADO: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELADO: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  ATIVO:     "bg-green-500/20 text-green-400 border-green-500/30",
  PAUSED:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DELETED:   "bg-red-500/20 text-red-400 border-red-500/30",
};

// ── Componente principal ──────────────────────────────────────────────
const routeToTab: Record<string, string> = {
  "/techqui":           "connections",
  "/techqui/instagram": "instagram",
  "/techqui/ads":       "ads",
  "/techqui/comments":  "comments",
  "/techqui/settings":  "settings",
};

const TechQui = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = routeToTab[location.pathname] ?? "connections";
  const [clients, setClients] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [oauthSelectModal, setOauthSelectModal] = useState<{ sessionId: string; clientId: string } | null>(null);

  const loadBase = useCallback(async () => {
    const [cli, conn, sett] = await Promise.all([
      api.get("/api/clients").then(d => d.clients || []).catch(() => []),
      api.get("/api/techqui/connections").then(d => d.connections || []).catch(() => []),
      api.get("/api/techqui/settings").then(d => d.settings).catch(() => null),
    ]);
    setClients(cli);
    setConnections(conn);
    setSettings(sett);
  }, []);

  useEffect(() => {
    setActiveModule("techqui");
    loadBase();
  }, []);

  // Tratar retorno do OAuth
  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (!oauth) return;

    if (oauth === "select") {
      const sessionId = searchParams.get("session") || "";
      const clientId  = searchParams.get("client_id") || "";
      setOauthSelectModal({ sessionId, clientId });
    } else if (oauth === "success") {
      toast({ title: "Conta Meta conectada!", description: "Instagram e Ads configurados automaticamente." });
      loadBase();
    } else if (oauth === "denied") {
      toast({ title: "Autorização negada", description: "O usuário não autorizou o acesso.", variant: "destructive" });
    } else if (oauth === "error") {
      const msg = searchParams.get("msg") || "Erro desconhecido";
      toast({ title: "Erro ao conectar", description: decodeURIComponent(msg), variant: "destructive" });
    }
    setSearchParams({});
  }, [searchParams]);

  const connForClient = (cid: string) => connections.find(c => c.client_id === cid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">TechQui</h1>
            <p className="text-muted-foreground text-sm">Meta Ads · Instagram · Auto-reply</p>
          </div>
        </div>
        {/* Seletor de cliente */}
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-52 bg-secondary border-border">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab}>
        <TabsList className="sr-only" />

        <TabsContent value="connections">
          <ConnectionsTab clients={clients} connections={connections} onRefresh={loadBase} toast={toast} />
        </TabsContent>
        <TabsContent value="instagram">
          <InstagramTab connections={connections} clients={clients} selectedClient={selectedClient} toast={toast} />
        </TabsContent>
        <TabsContent value="ads">
          <AdsTab connections={connections} clients={clients} selectedClient={selectedClient} toast={toast} />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsTab connections={connections} clients={clients} selectedClient={selectedClient} toast={toast} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab settings={settings} onSaved={loadBase} toast={toast} />
        </TabsContent>
      </Tabs>

      {/* Modal de seleção de conta após OAuth */}
      {oauthSelectModal && (
        <OAuthSelectModal
          sessionId={oauthSelectModal.sessionId}
          clientId={oauthSelectModal.clientId}
          clients={clients}
          onClose={() => setOauthSelectModal(null)}
          onSaved={() => { setOauthSelectModal(null); loadBase(); }}
          toast={toast}
        />
      )}
    </div>
  );
};

// ── Modal de seleção de Página/AdAccount após OAuth ───────────────────
const OAuthSelectModal = ({ sessionId, clientId, clients, onClose, onSaved, toast }: any) => {
  const [data, setData]             = useState<any>(null);
  const [selectedPage, setSelectedPage]   = useState("");
  const [selectedAd, setSelectedAd]       = useState("");
  const [saving, setSaving]               = useState(false);

  const clientName = clients.find((c: any) => c.id === clientId)?.name || clientId;

  useEffect(() => {
    api.get(`/api/techqui/oauth/session/${sessionId}`)
      .then(d => {
        setData(d);
        // Pré-selecionar a primeira opção de cada
        if (d.pages?.length)      setSelectedPage(d.pages[0].page_id);
        const activeAd = d.adAccounts?.find((a: any) => a.active) || d.adAccounts?.[0];
        if (activeAd) setSelectedAd(activeAd.id);
      })
      .catch(() => toast({ title: "Sessão expirada. Conecte novamente.", variant: "destructive" }));
  }, [sessionId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/api/techqui/oauth/finalize", {
        session_id:     sessionId,
        page_id:        selectedPage,
        ad_account_id:  selectedAd,
      });
      toast({ title: "Conta Meta conectada!", description: `${clientName} vinculado com sucesso.` });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Selecionar contas para <span className="text-primary ml-1">{clientName}</span>
          </DialogTitle>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="space-y-5 py-2 overflow-y-auto flex-1 pr-1">
            {/* Páginas / Instagram */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Página do Facebook + Instagram
              </Label>
              {data.pages?.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma página encontrada nesta conta.</p>
              ) : (
                <div className="space-y-2">
                  {data.pages?.map((p: any) => {
                    const isBM = p.source === "bm" || !p.page_id;
                    const canPublish = !isBM && p.instagram_username;
                    return (
                      <button key={p.page_id || p.instagram_account_id} type="button"
                        onClick={() => setSelectedPage(p.page_id)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${selectedPage === p.page_id ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/50"} ${isBM ? "opacity-60" : ""}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${selectedPage === p.page_id ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{p.page_name}</p>
                          {p.instagram_username
                            ? <p className="text-xs text-pink-400 flex items-center gap-1 mt-0.5"><Instagram className="w-3 h-3" /> @{p.instagram_username}</p>
                            : <p className="text-xs text-muted-foreground mt-0.5">Sem Instagram vinculado</p>}
                          {isBM && (
                            <p className="text-[10px] text-yellow-400 mt-1">⚠ Conta da BM — não permite publicar/comentar (só leitura)</p>
                          )}
                          {canPublish && (
                            <p className="text-[10px] text-green-400 mt-1">✓ Pode publicar e responder comentários</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contas de Anúncios */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Conta de Anúncios (Ad Account)
              </Label>
              {data.adAccounts?.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma conta de anúncios encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {data.adAccounts?.map((a: any) => (
                    <button key={a.id} type="button" onClick={() => setSelectedAd(a.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${selectedAd === a.id ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/50"}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${selectedAd === a.id ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{a.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{a.id}</p>
                        {a.active
                          ? <span className="text-[10px] text-green-400">● Ativa</span>
                          : <span className="text-[10px] text-yellow-400">● Inativa</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 border-t border-border pt-4 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !data} className="gradient-button">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Tab: Conexões ─────────────────────────────────────────────────────
const ConnectionsTab = ({ clients, connections, onRefresh, toast }: any) => {
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const startOAuth = async (clientId: string, via: "facebook" | "instagram" = "facebook") => {
    setConnectingId(clientId);
    try {
      const endpoint = via === "instagram"
        ? `/api/techqui/oauth/instagram/start?client_id=${clientId}`
        : `/api/techqui/oauth/start?client_id=${clientId}`;
      const d = await api.get(endpoint);
      const w = 600, h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top  = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(d.url, "meta_oauth", `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);

      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnectingId(null);
          onRefresh();
        }
      }, 800);
    } catch (e: any) {
      toast({ title: "Erro ao iniciar conexão", description: e.message, variant: "destructive" });
      setConnectingId(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Desvincular a conta Meta de "${name}"?`)) return;
    try {
      await api.delete(`/api/techqui/connections/${id}`);
      toast({ title: "Conta desvinculada" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const connectedMap = Object.fromEntries(connections.map((c: any) => [c.client_id, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{connections.length} conta(s) Meta vinculada(s)</p>
      </div>

      {/* Instrução */}
      <div className="glass-card p-4 border border-blue-500/20 flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-blue-400">i</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong className="text-blue-400">Facebook</strong> — para contas com Página do Facebook. Captura Instagram, Página e Conta de Anúncios (necessário para o módulo de Ads).</p>
          <p><strong className="text-pink-400">Instagram</strong> — para contas que estão só no Instagram (sem Página do Facebook). Permite publicar e responder comentários, mas não acessa Ads.</p>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="glass-card p-10 text-center text-muted-foreground text-sm">
          Nenhum cliente cadastrado. Cadastre clientes em Leadqui → Clientes.
        </div>
      )}

      <div className="space-y-3">
        {clients.map((client: any) => {
          const conn = connectedMap[client.id];
          const isConnecting = connectingId === client.id;

          return (
            <motion.div key={client.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{client.name[0]}</span>
              </div>

              {/* Info do cliente */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{client.name}</p>
                {conn ? (
                  <div className="flex flex-wrap gap-3 mt-1">
                    {conn.instagram_username && (
                      <span className="flex items-center gap-1 text-[11px] text-pink-400">
                        <Instagram className="w-3 h-3" /> @{conn.instagram_username}
                      </span>
                    )}
                    {conn.page_name && (
                      <span className="flex items-center gap-1 text-[11px] text-green-400">
                        <Users className="w-3 h-3" /> {conn.page_name}
                      </span>
                    )}
                    {conn.ad_account_id && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-400">
                        <Target className="w-3 h-3" /> {conn.ad_account_id}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Sem conta Meta vinculada</p>
                )}
              </div>

              {/* Ações — Facebook e Instagram independentes */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Facebook */}
                <Button
                  onClick={() => startOAuth(client.id, "facebook")}
                  disabled={isConnecting}
                  size="sm"
                  title={conn?.has_facebook ? "Reconectar Facebook" : "Conectar Facebook (Ads + Página)"}
                  className={`h-8 text-xs border-0 text-white ${conn?.has_facebook
                    ? "bg-blue-600/40 hover:bg-blue-600/60"
                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"}`}
                >
                  {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : (
                    <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  )}
                  {conn?.has_facebook ? "✓ Facebook" : "Facebook"}
                </Button>
                {/* Instagram */}
                <Button
                  onClick={() => startOAuth(client.id, "instagram")}
                  disabled={isConnecting}
                  size="sm"
                  title={conn?.has_instagram ? "Reconectar Instagram" : "Conectar Instagram (publicar + comentários)"}
                  className={`h-8 text-xs border-0 text-white ${conn?.has_instagram
                    ? "bg-pink-600/40 hover:bg-pink-600/60"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"}`}
                >
                  <Instagram className="w-3.5 h-3.5 mr-1.5" />
                  {conn?.has_instagram ? "✓ Instagram" : "Instagram"}
                </Button>
                {/* Desvincular tudo */}
                {conn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(conn.id, client.name)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Desvincular tudo"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ── Tab: Instagram Scheduler ──────────────────────────────────────────
const InstagramTab = ({ connections, clients, selectedClient, toast }: any) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ connection_id: "", client_id: "", caption: "", media_urls: [""], media_type: "IMAGE", scheduled_at: "" });

  const load = async () => {
    setLoading(true);
    const p = await api.get(`/api/techqui/instagram/posts${selectedClient !== "all" ? `?client_id=${selectedClient}` : ""}`).then(d => d.posts || []).catch(() => []);
    setPosts(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedClient]);

  const save = async () => {
    if (!form.connection_id || !form.scheduled_at || !form.media_urls[0]) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    try {
      await api.post("/api/techqui/instagram/posts", { ...form, media_urls: form.media_urls.filter(Boolean) });
      toast({ title: "Post agendado!" });
      setModalOpen(false);
      load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/api/techqui/instagram/posts/${id}`); load(); } catch {}
  };

  const mediaTypeIcon: Record<string, any> = { IMAGE: Image, CAROUSEL: LayoutGrid, REELS: Video };

  const filteredPosts = selectedClient !== "all" ? posts.filter(p => p.client_id === selectedClient) : posts;
  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{filteredPosts.filter(p => p.status === "AGENDADO").length} post(s) agendado(s)</p>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm" className="gradient-button">
          <Plus className="w-4 h-4 mr-1" /> Agendar Post
        </Button>
      </div>

      {loading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>}

      {!loading && filteredPosts.length === 0 && (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum post agendado.</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredPosts.map((post: any) => {
          const MIcon = mediaTypeIcon[post.media_type] || Image;
          const isPast = new Date(post.scheduled_at) < now;
          const mediaList: string[] = JSON.parse(post.media_urls || "[]");
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex items-start gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg bg-secondary flex-shrink-0 overflow-hidden relative">
                {mediaList[0] && /\.(jpg|jpeg|png|gif|webp)/i.test(mediaList[0]) ? (
                  <img src={mediaList[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-1 right-1">
                  <span className="text-[9px] bg-black/60 text-white px-1 rounded">{post.media_type}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">{post.caption || <span className="italic text-muted-foreground">Sem legenda</span>}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(post.scheduled_at).toLocaleString("pt-BR")}
                  </span>
                  {mediaList.length > 1 && <span className="text-xs text-muted-foreground">{mediaList.length} mídias</span>}
                </div>
                {post.error_message && <p className="text-xs text-destructive mt-1">{post.error_message}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge[post.status] || ""}`}>{post.status}</span>
                {post.status === "AGENDADO" && (
                  <Button variant="ghost" size="sm" onClick={() => remove(post.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Agendar Post no Instagram</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Conta</Label>
                <Select value={form.connection_id} onValueChange={v => {
                  const conn = connections.find((c: any) => c.id === v);
                  setForm(f => ({ ...f, connection_id: v, client_id: conn?.client_id || "" }));
                }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {connections.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client?.name} {c.instagram_username ? `(@${c.instagram_username})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo de Mídia</Label>
                <Select value={form.media_type} onValueChange={v => setForm(f => ({ ...f, media_type: v, media_urls: v === "CAROUSEL" ? ["", ""] : [""] }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMAGE"><span className="flex items-center gap-2"><Image className="w-3.5 h-3.5" />Imagem</span></SelectItem>
                    <SelectItem value="CAROUSEL"><span className="flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5" />Carrossel</span></SelectItem>
                    <SelectItem value="REELS"><span className="flex items-center gap-2"><Video className="w-3.5 h-3.5" />Reels</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Data e Hora</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                {form.media_type === "CAROUSEL" ? "URLs das Mídias (uma por linha)" : form.media_type === "REELS" ? "URL do Vídeo (MP4)" : "URL da Imagem"}
              </Label>
              {form.media_urls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={url} onChange={e => {
                    const arr = [...form.media_urls]; arr[i] = e.target.value; setForm(f => ({ ...f, media_urls: arr }));
                  }} placeholder={form.media_type === "REELS" ? "https://example.com/video.mp4" : "https://example.com/image.jpg"} className="bg-secondary border-border text-xs" />
                  {form.media_type === "CAROUSEL" && (
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={() => {
                      if (i === form.media_urls.length - 1) {
                        setForm(f => ({ ...f, media_urls: [...f.media_urls, ""] }));
                      } else {
                        const arr = form.media_urls.filter((_, j) => j !== i);
                        setForm(f => ({ ...f, media_urls: arr }));
                      }
                    }}>
                      {i === form.media_urls.length - 1 ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">As URLs devem ser publicamente acessíveis. {form.media_type === "CAROUSEL" && "Mínimo 2, máximo 10 itens."}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Legenda</Label>
              <Textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Escreva a legenda do post..." className="bg-secondary border-border" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="gradient-button"><CalendarDays className="w-4 h-4 mr-1" /> Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Tab: Meta Ads ─────────────────────────────────────────────────────
const AdsTab = ({ connections, clients, selectedClient, toast }: any) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingCamp, setLoadingCamp] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [activeConn, setActiveConn] = useState<string>("");

  const availableConns = selectedClient !== "all"
    ? connections.filter((c: any) => c.client_id === selectedClient)
    : connections;

  useEffect(() => {
    if (availableConns.length > 0 && !activeConn) setActiveConn(availableConns[0].id);
  }, [availableConns]);

  useEffect(() => {
    if (activeConn) { loadCampaigns(); loadAnalyses(); }
  }, [activeConn, datePreset]);

  const loadCampaigns = async () => {
    setLoadingCamp(true);
    try {
      const d = await api.get(`/api/techqui/ads/campaigns/${activeConn}?date_preset=${datePreset}`);
      setCampaigns(d.data || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar campanhas", description: e.message, variant: "destructive" });
    }
    setLoadingCamp(false);
  };

  const loadAnalyses = async () => {
    setLoadingAnalysis(true);
    const connObj = connections.find((c: any) => c.id === activeConn);
    const cid = connObj?.client_id;
    const [an, sug] = await Promise.all([
      api.get(`/api/techqui/ads/analyses${cid ? `?client_id=${cid}` : ""}`).then(d => d.analyses || []).catch(() => []),
      api.get(`/api/techqui/ads/suggestions${cid ? `?client_id=${cid}&status=PENDENTE` : "&status=PENDENTE"}`).then(d => d.suggestions || []).catch(() => []),
    ]);
    setAnalyses(an);
    setSuggestions(sug);
    setLoadingAnalysis(false);
  };

  const runAnalysis = async () => {
    if (!activeConn) return;
    setAnalyzing(true);
    try {
      await api.post(`/api/techqui/ads/analyze/${activeConn}`, {});
      toast({ title: "Análise iniciada!", description: "O agente está analisando suas campanhas. Aguarde alguns instantes." });
      setTimeout(() => { loadAnalyses(); setAnalyzing(false); }, 15000);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setAnalyzing(false);
    }
  };

  const handleSuggestion = async (id: string, status: "APROVADO" | "REJEITADO") => {
    try {
      await api.patch(`/api/techqui/ads/suggestions/${id}`, { status });
      toast({ title: status === "APROVADO" ? "Aprovado! Executando..." : "Sugestão rejeitada" });
      loadAnalyses();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getInsights = (camp: any) => {
    const ins = camp.insights?.data?.[0] || {};
    return {
      spend:       parseFloat(ins.spend || "0"),
      impressions: parseInt(ins.impressions || "0"),
      clicks:      parseInt(ins.clicks || "0"),
      ctr:         parseFloat(ins.ctr || "0"),
      cpc:         parseFloat(ins.cpc || "0"),
      reach:       parseInt(ins.reach || "0"),
      roas:        parseFloat(ins.purchase_roas?.[0]?.value || ins.roas?.[0]?.value || "0"),
    };
  };

  const actionTypeLabel: Record<string, string> = {
    PAUSE_CAMPAIGN:   "Pausar Campanha",
    INCREASE_BUDGET:  "Aumentar Orçamento",
    DECREASE_BUDGET:  "Reduzir Orçamento",
    PAUSE_ADSET:      "Pausar Conjunto",
    UPDATE_BID:       "Ajustar Lance",
  };
  const actionTypeColor: Record<string, string> = {
    PAUSE_CAMPAIGN:  "text-red-400",
    INCREASE_BUDGET: "text-green-400",
    DECREASE_BUDGET: "text-yellow-400",
    PAUSE_ADSET:     "text-orange-400",
    UPDATE_BID:      "text-blue-400",
  };

  return (
    <div className="space-y-6">
      {/* Seletor de conexão + controles */}
      <div className="flex flex-wrap items-center gap-3">
        {availableConns.length > 1 && (
          <Select value={activeConn} onValueChange={setActiveConn}>
            <SelectTrigger className="w-52 bg-secondary border-border">
              <SelectValue placeholder="Selecionar conta" />
            </SelectTrigger>
            <SelectContent>
              {availableConns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client?.name} {c.instagram_username ? `(@${c.instagram_username})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-40 bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
            <SelectItem value="last_14d">Últimos 14 dias</SelectItem>
            <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="last_month">Mês passado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadCampaigns}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar</Button>
        <Button onClick={runAnalysis} disabled={analyzing || !activeConn} size="sm" className="gradient-button ml-auto">
          {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Bot className="w-4 h-4 mr-1" />}
          {analyzing ? "Analisando..." : "Analisar com IA"}
        </Button>
      </div>

      {/* Sugestões pendentes */}
      {suggestions.length > 0 && (
        <div className="glass-card p-4 border border-yellow-500/20">
          <p className="text-sm font-semibold text-yellow-400 flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4" /> {suggestions.length} sugestão(ões) do agente aguardando aprovação
          </p>
          <div className="space-y-3">
            {suggestions.map((s: any) => (
              <div key={s.id} className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold ${actionTypeColor[s.action_type]}`}>{actionTypeLabel[s.action_type]}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" onClick={() => handleSuggestion(s.id, "APROVADO")} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSuggestion(s.id, "REJEITADO")} className="h-7 text-xs border-red-500/30 text-red-400">
                    <XCircle className="w-3 h-3 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campanhas */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" /> Campanhas
        </h3>
        {loadingCamp && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>}
        {!loadingCamp && !activeConn && (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">Selecione uma conta com Ad Account configurado</div>
        )}
        {!loadingCamp && activeConn && campaigns.length === 0 && (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">Nenhuma campanha encontrada</div>
        )}
        <div className="space-y-3">
          {campaigns.map((camp: any) => {
            const ins = getInsights(camp);
            const budget = camp.daily_budget ? `R$ ${fmt(parseFloat(camp.daily_budget) / 100)}/dia` : camp.lifetime_budget ? `R$ ${fmt(parseFloat(camp.lifetime_budget) / 100)} total` : "—";
            return (
              <motion.div key={camp.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge[camp.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>{camp.status}</span>
                    <p className="text-sm font-semibold text-foreground">{camp.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{budget}</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: "Gasto", value: `R$ ${fmt(ins.spend)}`, icon: DollarSign, color: "text-orange-400" },
                    { label: "Impressões", value: ins.impressions.toLocaleString("pt-BR"), icon: Eye, color: "text-blue-400" },
                    { label: "Cliques", value: ins.clicks.toLocaleString("pt-BR"), icon: MousePointerClick, color: "text-purple-400" },
                    { label: "CTR", value: `${fmt(ins.ctr)}%`, icon: Target, color: ins.ctr >= 1 ? "text-green-400" : "text-red-400" },
                    { label: "CPC", value: `R$ ${fmt(ins.cpc)}`, icon: DollarSign, color: "text-yellow-400" },
                    { label: "ROAS", value: ins.roas > 0 ? `${fmt(ins.roas)}x` : "—", icon: ins.roas >= 2 ? TrendingUp : TrendingDown, color: ins.roas >= 2 ? "text-green-400" : "text-red-400" },
                  ].map(metric => (
                    <div key={metric.label} className="bg-secondary/40 rounded-lg p-2.5 text-center">
                      <metric.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${metric.color}`} />
                      <p className="text-sm font-bold text-foreground">{metric.value}</p>
                      <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Histórico de análises */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-primary" /> Histórico de Análises
        </h3>
        {loadingAnalysis && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>}
        {!loadingAnalysis && analyses.length === 0 && (
          <div className="glass-card p-6 text-center text-muted-foreground text-sm">Nenhuma análise realizada ainda. Clique em "Analisar com IA" para começar.</div>
        )}
        <div className="space-y-2">
          {analyses.map((a: any) => (
            <div key={a.id} className="glass-card p-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedAnalysis(expandedAnalysis === a.id ? null : a.id)}>
                <div className="flex items-center gap-3">
                  <Bot className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {a.triggered_by === "MANUAL" ? "Análise Manual" : "Análise Automática"}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")} · {a.suggestions?.length || 0} sugestão(ões)</p>
                  </div>
                </div>
                {expandedAnalysis === a.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
              {expandedAnalysis === a.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.analysis_text}</p>
                  {a.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      {a.suggestions.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg p-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge[s.status]}`}>{s.status}</span>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-foreground">{s.title}</p>
                            {s.result && <p className="text-[10px] text-muted-foreground">{s.result}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Tab: Comentários ──────────────────────────────────────────────────
const CommentsTab = ({ connections, clients, selectedClient, toast }: any) => {
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [media, setMedia] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState<"rules" | "logs">("rules");
  const [form, setForm] = useState<any>({
    connection_id: "", client_id: "", name: "", reply_type: "FIXO",
    fixed_reply: "", keywords: [], apply_to: "TODOS", post_ids: [], active: true,
  });
  const [kwInput, setKwInput] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const igConnections = connections.filter((c: any) => c.instagram_account_id &&
    (selectedClient === "all" || c.client_id === selectedClient));

  const activateWebhooks = async () => {
    if (igConnections.length === 0) { toast({ title: "Nenhuma conta Instagram conectada", variant: "destructive" }); return; }
    setSubscribing(true);
    let ok = 0;
    for (const conn of igConnections) {
      try { await api.post(`/api/techqui/comments/subscribe/${conn.id}`, {}); ok++; } catch {}
    }
    setSubscribing(false);
    toast({ title: `${ok} conta(s) ativada(s)`, description: "Comentários novos serão respondidos pelas regras ativas." });
  };

  const load = async () => {
    const cid = selectedClient !== "all" ? selectedClient : undefined;
    const [r, l] = await Promise.all([
      api.get(`/api/techqui/comments/rules${cid ? `?client_id=${cid}` : ""}`).then(d => d.rules || []).catch(() => []),
      api.get(`/api/techqui/comments/logs${cid ? `?client_id=${cid}` : ""}`).then(d => d.logs || []).catch(() => []),
    ]);
    setRules(r);
    setLogs(l);
  };

  useEffect(() => { load(); }, [selectedClient]);

  const loadMedia = async (connId: string) => {
    try {
      const d = await api.get(`/api/techqui/instagram/media/${connId}`);
      setMedia(d.data || []);
    } catch { setMedia([]); }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ connection_id: "", client_id: "", name: "", reply_type: "FIXO", fixed_reply: "", keywords: [], apply_to: "TODOS", post_ids: [], active: true });
    setKwInput("");
    setMedia([]);
    setModalOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setForm({
      ...rule,
      keywords: JSON.parse(rule.keywords || "[]"),
      post_ids: JSON.parse(rule.post_ids || "[]"),
    });
    setKwInput("");
    if (rule.connection_id) loadMedia(rule.connection_id);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.connection_id || !form.name || !form.reply_type) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return;
    }
    if (form.reply_type === "FIXO" && !form.fixed_reply) {
      toast({ title: "Informe a resposta fixa", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/techqui/comments/rules/${editing.id}`, form);
        toast({ title: "Regra atualizada!" });
      } else {
        await api.post("/api/techqui/comments/rules", form);
        toast({ title: "Regra criada!" });
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleActive = async (rule: any) => {
    try {
      await api.patch(`/api/techqui/comments/rules/${rule.id}`, { active: !rule.active });
      load();
    } catch {}
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta regra?")) return;
    try { await api.delete(`/api/techqui/comments/rules/${id}`); load(); } catch {}
  };

  const addKeyword = () => {
    if (!kwInput.trim()) return;
    setForm((f: any) => ({ ...f, keywords: [...f.keywords, kwInput.trim()] }));
    setKwInput("");
  };

  const removeKeyword = (kw: string) => setForm((f: any) => ({ ...f, keywords: f.keywords.filter((k: string) => k !== kw) }));

  const togglePost = (postId: string) => {
    setForm((f: any) => ({
      ...f,
      post_ids: f.post_ids.includes(postId) ? f.post_ids.filter((id: string) => id !== postId) : [...f.post_ids, postId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={activeView === "rules" ? "default" : "outline"} size="sm" onClick={() => setActiveView("rules")}>Regras</Button>
          <Button variant={activeView === "logs" ? "default" : "outline"} size="sm" onClick={() => setActiveView("logs")}>Histórico</Button>
        </div>
        {activeView === "rules" && (
          <div className="flex gap-2">
            <Button onClick={activateWebhooks} disabled={subscribing} size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10">
              {subscribing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Ativar Recebimento
            </Button>
            <Button onClick={openNew} size="sm" className="gradient-button">
              <Plus className="w-4 h-4 mr-1" /> Nova Regra
            </Button>
          </div>
        )}
      </div>

      {activeView === "rules" && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="glass-card p-10 text-center text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma regra de auto-reply configurada.</p>
            </div>
          )}
          {rules.map((rule: any) => {
            const kws: string[] = JSON.parse(rule.keywords || "[]");
            const pids: string[] = JSON.parse(rule.post_ids || "[]");
            return (
              <motion.div key={rule.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{rule.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${rule.reply_type === "IA" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                        {rule.reply_type === "IA" ? "IA" : "Fixo"}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${rule.apply_to === "ESPECIFICOS" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                        {rule.apply_to === "ESPECIFICOS" ? `${pids.length} post(s)` : "Todos os posts"}
                      </span>
                    </div>
                    {rule.reply_type === "FIXO" && rule.fixed_reply && (
                      <p className="text-xs text-muted-foreground italic">"{rule.fixed_reply}"</p>
                    )}
                    {kws.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {kws.map((kw: string) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.active} onCheckedChange={() => toggleActive(rule)} />
                    <Button variant="ghost" size="sm" onClick={() => openEdit(rule)} className="h-7 w-7 p-0"><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(rule.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {activeView === "logs" && (
        <div className="space-y-2">
          {logs.length === 0 && (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">Nenhum comentário respondido ainda.</div>
          )}
          {logs.map((log: any) => (
            <div key={log.id} className="glass-card p-3 flex gap-3 items-start">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">@{log.commenter_username}</span>: {log.comment_text}
                </p>
                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                  <Send className="w-3 h-3" /> {log.reply_text}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge[log.status] || ""}`}>{log.status}</span>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de regra */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Regra" : "Nova Regra de Auto-reply"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Regra</Label>
                <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ex: Resposta sobre preço" className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Conta Instagram</Label>
                <Select value={form.connection_id} onValueChange={v => {
                  const conn = connections.find((c: any) => c.id === v);
                  setForm((f: any) => ({ ...f, connection_id: v, client_id: conn?.client_id || "" }));
                  loadMedia(v);
                }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {connections.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client?.name} {c.instagram_username ? `(@${c.instagram_username})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo de Resposta</Label>
                <Select value={form.reply_type} onValueChange={v => setForm((f: any) => ({ ...f, reply_type: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXO">Resposta Fixa</SelectItem>
                    <SelectItem value="IA">IA (Claude gera a resposta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Aplicar em</Label>
                <Select value={form.apply_to} onValueChange={v => setForm((f: any) => ({ ...f, apply_to: v, post_ids: [] }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os posts</SelectItem>
                    <SelectItem value="ESPECIFICOS">Posts específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.reply_type === "FIXO" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Resposta Fixa</Label>
                <Textarea value={form.fixed_reply} onChange={e => setForm((f: any) => ({ ...f, fixed_reply: e.target.value }))} placeholder="Olá! Para saber mais, envie uma mensagem direta 😊" className="bg-secondary border-border" rows={3} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Palavras-chave (deixe vazio para responder todos)</Label>
              <div className="flex gap-2">
                <Input value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())} placeholder="Ex: preço, valor, quanto custa" className="bg-secondary border-border" />
                <Button type="button" variant="outline" size="sm" onClick={addKeyword}>Adicionar</Button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.keywords.map((kw: string) => (
                    <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                      {kw} <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {form.apply_to === "ESPECIFICOS" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Selecionar Posts ({form.post_ids.length} selecionados)</Label>
                {media.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Selecione uma conta para carregar os posts.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {media.map((m: any) => (
                      <button key={m.id} type="button" onClick={() => togglePost(m.id)}
                        className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all ${form.post_ids.includes(m.id) ? "border-primary" : "border-transparent"}`}>
                        {(m.thumbnail_url || m.media_url) ? (
                          <img src={m.thumbnail_url || m.media_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center"><Image className="w-5 h-5 text-muted-foreground" /></div>
                        )}
                        {form.post_ids.includes(m.id) && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white p-0.5 text-center">{m.media_type}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gradient-button">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? "Salvar" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Tab: Configurações ────────────────────────────────────────────────
const SettingsTab = ({ settings, onSaved, toast }: any) => {
  const [form, setForm] = useState({
    meta_app_id: "", meta_app_secret: "", meta_business_id: "", meta_system_token: "", openai_api_key: "",
    instagram_app_id: "", instagram_app_secret: "",
    trello_api_key: "", trello_token: "", trello_list_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm({
      meta_app_id:          settings.meta_app_id      || "",
      meta_app_secret:      settings.meta_app_secret  || "",
      meta_business_id:     settings.meta_business_id || "",
      meta_system_token:    settings.meta_system_token || "",
      openai_api_key:       settings.openai_api_key   || "",
      instagram_app_id:     settings.instagram_app_id || "",
      instagram_app_secret: settings.instagram_app_secret || "",
      trello_api_key: settings.trello_api_key || "",
      trello_token:   settings.trello_token || "",
      trello_list_id: settings.trello_list_id || "",
    });
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/techqui/settings", form);
      toast({ title: "Configurações salvas!" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center"><Target className="w-3.5 h-3.5 text-blue-400" /></div>
          Meta for Developers
        </h3>
        <p className="text-xs text-muted-foreground">Crie um App em <span className="text-primary">developers.facebook.com</span> com permissões <code className="bg-secondary px-1 rounded text-[10px]">instagram_basic</code>, <code className="bg-secondary px-1 rounded text-[10px]">instagram_content_publish</code>, <code className="bg-secondary px-1 rounded text-[10px]">instagram_manage_comments</code>, <code className="bg-secondary px-1 rounded text-[10px]">ads_management</code>.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">App ID</Label>
            <Input value={form.meta_app_id} onChange={e => setForm(f => ({ ...f, meta_app_id: e.target.value }))} placeholder="123456789" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">App Secret</Label>
            <Input value={form.meta_app_secret} onChange={e => setForm(f => ({ ...f, meta_app_secret: e.target.value }))} type="password" placeholder="••••••••" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Business ID</Label>
            <Input value={form.meta_business_id} onChange={e => setForm(f => ({ ...f, meta_business_id: e.target.value }))} placeholder="123456789" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">System User Token (Ads MCP)</Label>
            <Input value={form.meta_system_token} onChange={e => setForm(f => ({ ...f, meta_system_token: e.target.value }))} type="password" placeholder="EAAxxxxxxxx" className="bg-secondary border-border" />
            <p className="text-[10px] text-muted-foreground">Business Manager → Configurações → Usuários do Sistema → Token</p>
          </div>
        </div>
      </div>

      {/* Instagram Business Login */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center"><Instagram className="w-3.5 h-3.5 text-pink-400" /></div>
          Instagram Business Login
        </h3>
        <p className="text-xs text-muted-foreground">Permite conectar contas que estão <strong>só no Instagram</strong> (sem Página do Facebook). Encontre em: App → Casos de uso → "Gerenciar conteúdo no Instagram" → Configuração da API com login do Instagram.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instagram App ID</Label>
            <Input value={form.instagram_app_id} onChange={e => setForm(f => ({ ...f, instagram_app_id: e.target.value }))} placeholder="123456789" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instagram App Secret</Label>
            <Input value={form.instagram_app_secret} onChange={e => setForm(f => ({ ...f, instagram_app_secret: e.target.value }))} type="password" placeholder="••••••••" className="bg-secondary border-border" />
          </div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Registre este Redirect URI nas configurações do Instagram Login:</p>
          <code className="block text-[10px] font-mono text-primary break-all">https://leadqui.vps.pequi.digital/api/techqui/oauth/instagram/callback</code>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-purple-400" /></div>
          Agente de IA (OpenAI)
        </h3>
        <p className="text-xs text-muted-foreground">Usada para análise de campanhas e respostas automáticas inteligentes. Se você já configurou em Configurações → OpenAI, pode reutilizar a mesma chave.</p>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">OpenAI API Key</Label>
          <Input value={form.openai_api_key} onChange={e => setForm(f => ({ ...f, openai_api_key: e.target.value }))} type="password" placeholder="sk-••••••••" className="bg-secondary border-border" />
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center"><Send className="w-3.5 h-3.5 text-green-400" /></div>
          Webhook do Instagram
        </h3>
        <p className="text-xs text-muted-foreground">Configure este URL no seu App Meta → Webhooks → Instagram → campo <code className="bg-secondary px-1 rounded text-[10px]">comments</code>:</p>
        <code className="block bg-secondary rounded-lg p-3 text-xs font-mono text-primary break-all">
          https://leadqui.vps.pequi.digital/api/techqui/webhook/instagram
        </code>
        <p className="text-xs text-muted-foreground">Token de verificação:</p>
        <code className="block bg-secondary rounded-lg p-2 text-xs font-mono text-primary">pequi_webhook_2026</code>
      </div>

      {/* Trello (usado pelo Assistente) */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-sky-500/20 flex items-center justify-center"><LayoutGrid className="w-3.5 h-3.5 text-sky-400" /></div>
          Integração Trello
        </h3>
        <p className="text-xs text-muted-foreground">Usada pelo Assistente para criar cards quando um conteúdo vai para produção. Pegue a API Key e Token em <span className="text-primary">trello.com/power-ups/admin</span> ou <span className="text-primary">trello.com/app-key</span>.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Trello API Key</Label>
            <Input value={form.trello_api_key} onChange={e => setForm(f => ({ ...f, trello_api_key: e.target.value }))} placeholder="abc123..." className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Trello Token</Label>
            <Input value={form.trello_token} onChange={e => setForm(f => ({ ...f, trello_token: e.target.value }))} type="password" placeholder="••••••••" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">ID da Lista (coluna de produção)</Label>
            <Input value={form.trello_list_id} onChange={e => setForm(f => ({ ...f, trello_list_id: e.target.value }))} placeholder="Ex: 5f2a3b..." className="bg-secondary border-border" />
            <p className="text-[10px] text-muted-foreground">O ID da lista aparece na URL do Trello ou via API. Os cards serão criados nessa lista.</p>
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="gradient-button w-full">
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default TechQui;
