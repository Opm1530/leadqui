import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Settings as SettingsIcon, Save, Key, Link2, Lock, Globe, Bell, Target, Instagram, LayoutGrid, Loader2, Smartphone, ArrowLeft } from "lucide-react";
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
  const [notificationPhone, setNotificationPhone] = useState("");
  const [notificationInstance, setNotificationInstance] = useState("");
  const [centralWiId, setCentralWiId] = useState("");
  const [centralWiName, setCentralWiName] = useState("");

  // ── Meta / Instagram / Trello (TechQuiSettings) ────────────────────
  const [meta, setMeta] = useState<any>({
    meta_app_id: "", meta_app_secret: "", meta_business_id: "", meta_system_token: "",
    instagram_app_id: "", instagram_app_secret: "",
    trello_api_key: "", trello_token: "", trello_list_id: "",
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
      setNotificationPhone(s.notification_phone || "");
      setNotificationInstance(s.notification_instance || "");

      if (isAdmin) {
        const global = await api.get("/api/settings/global").catch(() => ({}));
        setCentralWiId(global.central_wi_id || "");
        setCentralWiName(global.central_wi_name || "");
      }

      const tq = await api.get("/api/techqui/settings").then(d => d.settings).catch(() => null);
      if (tq) setMeta((m: any) => ({
        ...m,
        meta_app_id: tq.meta_app_id || "", meta_app_secret: tq.meta_app_secret || "",
        meta_business_id: tq.meta_business_id || "", meta_system_token: tq.meta_system_token || "",
        instagram_app_id: tq.instagram_app_id || "", instagram_app_secret: tq.instagram_app_secret || "",
        trello_api_key: tq.trello_api_key || "", trello_token: tq.trello_token || "", trello_list_id: tq.trello_list_id || "",
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
        notification_phone: notificationPhone || null,
        notification_instance: notificationInstance || null,
      });
      if (isAdmin) {
        await api.patch("/api/settings/global", { central_wi_id: centralWiId || null, central_wi_name: centralWiName || null });
      }
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
            {isAdmin && (
              <div className="glass-card p-6 space-y-5 border-orange-500/20">
                <div className="flex items-center gap-2 mb-2"><Globe className="w-5 h-5 text-orange-500" /><h3 className="text-lg font-semibold text-foreground">Configurações Globais</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">WhatsApp Central ID</Label><Input value={centralWiId} onChange={e => setCentralWiId(e.target.value)} className="bg-secondary border-border" /></div>
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Instância</Label><Input value={centralWiName} onChange={e => setCentralWiName(e.target.value)} className="bg-secondary border-border" /></div>
                </div>
              </div>
            )}

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
                { label: "OpenAI API Key (IA / Assistente)", value: openaiApiKey, set: setOpenaiApiKey },
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
              <p className="text-xs text-muted-foreground">Usada pelo Assistente para criar cards quando um conteúdo vai para produção. Pegue as chaves em <span className="text-primary">trello.com/app-key</span>.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label><Input value={meta.trello_api_key} onChange={e => setM("trello_api_key", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Token</Label><Input type="password" value={meta.trello_token} onChange={e => setM("trello_token", e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2 col-span-2"><Label className="text-xs text-muted-foreground uppercase tracking-wider">ID da Lista (coluna de produção)</Label><Input value={meta.trello_list_id} onChange={e => setM("trello_list_id", e.target.value)} className="bg-secondary border-border" /></div>
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
