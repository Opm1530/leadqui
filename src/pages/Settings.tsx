import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Settings as SettingsIcon, Save, Key, Link2, Lock, Bell, Target, Instagram, LayoutGrid, Loader2, Smartphone, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import WhatsAppSettings from "@/components/WhatsAppSettings";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  // ── Geral (UserSettings / Global) ──────────────────────────────────
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [serperApiKey, setSerperApiKey] = useState("");
  const [apifyApiKey, setApifyApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [notificationPhone, setNotificationPhone] = useState("");
  const [notificationInstance, setNotificationInstance] = useState("");

  // ── Meta / Instagram / Trello (TechQuiSettings) ────────────────────
  const [meta, setMeta] = useState<any>({
    meta_app_id: "", meta_app_secret: "", meta_business_id: "", meta_system_token: "",
    instagram_app_id: "", instagram_app_secret: "",
    trello_api_key: "", trello_token: "", trello_board_id: "", trello_list_id: "", trello_done_list_id: "", trello_approval_list_id: "", trello_approved_list_id: "",
  });

  // ── Senha ───────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => { if (user) fetchAll(); }, [user, isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/settings");
      const s = data.settings || {};
      setEvolutionApiUrl(s.evolution_api_url || "");
      setEvolutionApiKey(s.evolution_api_key || "");
      setSerperApiKey(s.serper_api_key || "");
      setApifyApiKey(s.apify_api_key || "");
      setOpenaiApiKey(s.openai_api_key || "");
      setAnthropicApiKey(s.anthropic_api_key || "");
      setNotificationPhone(s.notification_phone || "");
      setNotificationInstance(s.notification_instance || "");

      const tq = await api.get("/api/techqui/settings").then(d => d.settings).catch(() => null);
      if (tq) setMeta((m: any) => ({
        ...m,
        meta_app_id: tq.meta_app_id || "", meta_app_secret: tq.meta_app_secret || "",
        meta_business_id: tq.meta_business_id || "", meta_system_token: tq.meta_system_token || "",
        instagram_app_id: tq.instagram_app_id || "", instagram_app_secret: tq.instagram_app_secret || "",
        trello_api_key: tq.trello_api_key || "", trello_token: tq.trello_token || "", trello_board_id: tq.trello_board_id || "", trello_list_id: tq.trello_list_id || "", trello_done_list_id: tq.trello_done_list_id || "", trello_approval_list_id: tq.trello_approval_list_id || "", trello_approved_list_id: tq.trello_approved_list_id || "",
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveGeral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/settings", {
        evolution_api_url: evolutionApiUrl || null,
        evolution_api_key: evolutionApiKey || null,
        serper_api_key: serperApiKey || null,
        apify_api_key: apifyApiKey || null,
        openai_api_key: openaiApiKey || null,
        anthropic_api_key: anthropicApiKey || null,
        notification_phone: notificationPhone || null,
        notification_instance: notificationInstance || null,
      });
      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await api.put("/api/techqui/settings", meta);
      toast({ title: "Integrações salvas!" });
      fetchAll();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally { setSavingMeta(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await api.put("/api/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      toast({ title: "Senha alterada com sucesso!" });
      setCurrentPassword(""); setNewPassword("");
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally { setChangingPassword(false); }
  };

  const setM = (k: string, v: string) => setMeta((m: any) => ({ ...m, [k]: v }));

  // ── Trello: carregar quadros e listas para dropdowns ────────────────
  const [trelloBoards, setTrelloBoards] = useState<any[]>([]);
  const [trelloLists, setTrelloLists] = useState<any[]>([]);
  const [loadingTrello, setLoadingTrello] = useState(false);

  const carregarQuadros = async () => {
    setLoadingTrello(true);
    try {
      const d = await api.get("/api/techqui/trello/boards");
      setTrelloBoards(d.boards || []);
      if (!d.boards?.length) toast({ title: "Nenhum quadro encontrado", description: "Confirme API Key e Token e salve antes.", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro ao carregar quadros", description: "Salve a API Key e o Token do Trello primeiro.", variant: "destructive" });
    } finally { setLoadingTrello(false); }
  };

  const carregarListas = async (boardId: string) => {
    if (!boardId) { setTrelloLists([]); return; }
    try {
      const d = await api.get(`/api/techqui/trello/lists?board_id=${boardId}`);
      setTrelloLists(d.lists || []);
    } catch { setTrelloLists([]); }
  };

  useEffect(() => { if (meta.trello_board_id) carregarListas(meta.trello_board_id); }, [meta.trello_board_id]);

  const [registrandoWebhook, setRegistrandoWebhook] = useState(false);
  const registrarWebhook = async () => {
    setRegistrandoWebhook(true);
    try {
      const d = await api.post("/api/techqui/trello/register-webhook", {});
      toast({ title: "Webhook registrado! ✅", description: `Trello vai avisar em ${d.callbackURL}` });
    } catch (e: any) {
      toast({ title: "Erro ao registrar webhook", description: e.message, variant: "destructive" });
    } finally { setRegistrandoWebhook(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <button
        onClick={() => navigate("/hub")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm">Todas as integrações e ajustes da ferramenta num só lugar</p>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="geral"><Key className="w-4 h-4 mr-1.5" />Geral & APIs</TabsTrigger>
          <TabsTrigger value="whatsapp"><Smartphone className="w-4 h-4 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="meta"><Target className="w-4 h-4 mr-1.5" />Meta & Instagram</TabsTrigger>
          <TabsTrigger value="trello"><LayoutGrid className="w-4 h-4 mr-1.5" />Trello</TabsTrigger>
          <TabsTrigger value="conta"><Lock className="w-4 h-4 mr-1.5" />Conta</TabsTrigger>
        </TabsList>

        {/* ── GERAL ───────────────────────────────────────────────── */}
        <TabsContent value="geral">
          <form onSubmit={saveGeral} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><Link2 className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Evolution API (WhatsApp)</h3></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">URL da API</Label><Input value={evolutionApiUrl} onChange={e => setEvolutionApiUrl(e.target.value)} placeholder="https://evolution.seudominio.com" className="bg-secondary border-border" /></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label><Input type="password" value={evolutionApiKey} onChange={e => setEvolutionApiKey(e.target.value)} className="bg-secondary border-border" /></div>
            </div>

            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><Bell className="w-5 h-5 text-orange-400" /><h3 className="text-lg font-semibold text-foreground">Alertas por WhatsApp</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Número para Alertas</Label><Input value={notificationPhone} onChange={e => setNotificationPhone(e.target.value)} placeholder="5511999999999" className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância Evolution</Label><Input value={notificationInstance} onChange={e => setNotificationInstance(e.target.value)} className="bg-secondary border-border" /></div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><Key className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">APIs de Extração & IA</h3></div>
              {[
                { label: "Serper API Key (Google Maps)", value: serperApiKey, set: setSerperApiKey },
                { label: "Apify API Key (Instagram)", value: apifyApiKey, set: setApifyApiKey },
                { label: "OpenAI API Key (IA / outras integrações)", value: openaiApiKey, set: setOpenaiApiKey },
                { label: "Anthropic API Key (Claude — Assistente)", value: anthropicApiKey, set: setAnthropicApiKey },
              ].map(f => (
                <div key={f.label} className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">{f.label}</Label><Input type="password" value={f.value} onChange={e => f.set(e.target.value)} className="bg-secondary border-border" /></div>
              ))}
            </div>

            <button type="submit" disabled={saving} className="gradient-button px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Geral"}
            </button>
          </form>
        </TabsContent>

        {/* ── WHATSAPP ────────────────────────────────────────────── */}
        <TabsContent value="whatsapp">
          <WhatsAppSettings />
        </TabsContent>

        {/* ── META & INSTAGRAM ───────────────────────────────────── */}
        <TabsContent value="meta">
          <div className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-foreground">Meta for Developers</h3></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">App ID</Label><Input value={meta.meta_app_id} onChange={e => setM("meta_app_id", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">App Secret</Label><Input type="password" value={meta.meta_app_secret} onChange={e => setM("meta_app_secret", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Business ID</Label><Input value={meta.meta_business_id} onChange={e => setM("meta_business_id", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">System User Token</Label><Input type="password" value={meta.meta_system_token} onChange={e => setM("meta_system_token", e.target.value)} className="bg-secondary border-border" /></div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><Instagram className="w-5 h-5 text-pink-400" /><h3 className="text-lg font-semibold text-foreground">Instagram Business Login</h3></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Instagram App ID</Label><Input value={meta.instagram_app_id} onChange={e => setM("instagram_app_id", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Instagram App Secret</Label><Input type="password" value={meta.instagram_app_secret} onChange={e => setM("instagram_app_secret", e.target.value)} className="bg-secondary border-border" /></div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground">Redirect URI (OAuth):</p>
                <code className="block text-[10px] font-mono text-primary break-all">https://leadqui.vps.pequi.digital/api/techqui/oauth/instagram/callback</code>
                <p className="text-[10px] text-muted-foreground mt-1">Webhook: <code className="font-mono text-primary">.../api/techqui/webhook/instagram</code> · token <code className="font-mono text-primary">pequi_webhook_2026</code></p>
              </div>
            </div>

            <button onClick={saveMeta} disabled={savingMeta} className="gradient-button px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50">
              {savingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Meta & Instagram
            </button>
          </div>
        </TabsContent>

        {/* ── TRELLO ──────────────────────────────────────────────── */}
        <TabsContent value="trello">
          <div className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2"><LayoutGrid className="w-5 h-5 text-sky-400" /><h3 className="text-lg font-semibold text-foreground">Integração Trello</h3></div>
              <p className="text-xs text-muted-foreground">Ao enviar um conteúdo para produção, é criado um card no Trello e uma tarefa no Tasqui. Pegue as chaves em <span className="text-primary">trello.com/app-key</span>. Salve a API Key e o Token, depois carregue os quadros.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label><Input value={meta.trello_api_key} onChange={e => setM("trello_api_key", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Token</Label><Input type="password" value={meta.trello_token} onChange={e => setM("trello_token", e.target.value)} className="bg-secondary border-border" /></div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quadro padrão</Label>
                  <button type="button" onClick={carregarQuadros} disabled={loadingTrello}
                    className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                    {loadingTrello ? <Loader2 className="w-3 h-3 animate-spin" /> : <LayoutGrid className="w-3 h-3" />} Carregar quadros
                  </button>
                </div>
                <Select value={meta.trello_board_id} onValueChange={v => { setM("trello_board_id", v); setM("trello_list_id", ""); }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione um quadro (carregue primeiro)" /></SelectTrigger>
                  <SelectContent>
                    {trelloBoards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Lista padrão (coluna de produção)</Label>
                <Select value={meta.trello_list_id} onValueChange={v => setM("trello_list_id", v)} disabled={!meta.trello_board_id}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a lista padrão" /></SelectTrigger>
                  <SelectContent>
                    {trelloLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Essa é a lista usada por padrão. No momento de enviar para produção você poderá escolher outra lista, o responsável e as etiquetas.</p>

                <Label className="text-xs text-muted-foreground uppercase tracking-wider pt-2">Lista "Em Aprovação" (designer terminou)</Label>
                <Select value={meta.trello_done_list_id} onValueChange={v => setM("trello_done_list_id", v)} disabled={!meta.trello_board_id}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a lista de aprovação" /></SelectTrigger>
                  <SelectContent>
                    {trelloLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Quando o designer terminar e mover o card para esta coluna, o sistema puxa a arte anexada e marca como "Arte pronta", pronta para enviar ao cliente. O card fica aqui enquanto aguarda a aprovação.</p>

                <Label className="text-xs text-muted-foreground uppercase tracking-wider pt-2">Lista "Concluído" (cliente aprovou)</Label>
                <Select value={meta.trello_approved_list_id} onValueChange={v => setM("trello_approved_list_id", v)} disabled={!meta.trello_board_id}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="(opcional) lista de concluído" /></SelectTrigger>
                  <SelectContent>
                    {trelloLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Quando o cliente aprova, o card vai para cá. Se reprovar, ele volta para "A Fazer" com o motivo escrito como comentário.</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div>
                  <p className="text-sm text-foreground font-medium">Webhook do Trello</p>
                  <p className="text-[11px] text-muted-foreground">Registre uma vez para o Trello avisar quando uma arte ficar pronta.</p>
                </div>
                <button type="button" onClick={registrarWebhook} disabled={registrandoWebhook || !meta.trello_board_id}
                  className="text-xs px-3 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1 disabled:opacity-50">
                  {registrandoWebhook ? <Loader2 className="w-3 h-3 animate-spin" /> : "🔗"} Registrar webhook
                </button>
              </div>
            </div>
            <button onClick={saveMeta} disabled={savingMeta} className="gradient-button px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50">
              {savingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Trello
            </button>
          </div>
        </TabsContent>

        {/* ── CONTA ───────────────────────────────────────────────── */}
        <TabsContent value="conta">
          <form onSubmit={handleChangePassword} className="glass-card p-6 space-y-5 max-w-2xl">
            <div className="flex items-center gap-2 mb-2"><Lock className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Alterar Senha</h3></div>
            <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Senha Atual</Label><Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-secondary border-border" required /></div>
            <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Nova Senha</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} className="bg-secondary border-border" required /></div>
            <button type="submit" disabled={changingPassword} className="gradient-button px-6 py-3 text-sm disabled:opacity-50">{changingPassword ? "Alterando..." : "Alterar Senha"}</button>
          </form>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default Settings;
