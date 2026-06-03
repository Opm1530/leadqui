import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Settings as SettingsIcon, Save, Key, Link2, Lock, Globe, Bell } from "lucide-react";
import api from "@/lib/api";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useRole();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [serperApiKey, setSerperApiKey] = useState("");
  const [apifyApiKey, setApifyApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [notificationPhone, setNotificationPhone] = useState("");
  const [notificationInstance, setNotificationInstance] = useState("");

  // Global Settings (Admin only)
  const [centralWiId, setCentralWiId] = useState("");
  const [centralWiName, setCentralWiName] = useState("");

  // Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchSettings();
  }, [user, isAdmin]);

  const fetchSettings = async () => {
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
        const global = await api.get("/api/settings/global");
        setCentralWiId(global.central_wi_id || "");
        setCentralWiName(global.central_wi_name || "");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/settings", {
        evolution_api_url:      evolutionApiUrl      || null,
        evolution_api_key:      evolutionApiKey      || null,
        serper_api_key:         serperApiKey         || null,
        apify_api_key:          apifyApiKey          || null,
        openai_api_key:         openaiApiKey         || null,
        notification_phone:     notificationPhone    || null,
        notification_instance:  notificationInstance || null,
      });

      if (isAdmin) {
        await api.patch("/api/settings/global", {
          central_wi_id: centralWiId || null,
          central_wi_name: centralWiName || null
        });
      }

      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await api.put("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast({ title: "Senha alterada com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie integrações e sua conta</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5 border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-foreground">Configurações Globais (Pequi Digital)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">WhatsApp Central ID (Instância)</Label>
                <Input value={centralWiId} onChange={(e) => setCentralWiId(e.target.value)} placeholder="Ex: CentralAgencia" className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome da Instância</Label>
                <Input value={centralWiName} onChange={(e) => setCentralWiName(e.target.value)} placeholder="Ex: WhatsApp Matriz" className="bg-secondary border-border" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              * Este WhatsApp será utilizado pelo sistema para notificações de tarefas do Tasqui.
            </p>
          </motion.div>
        )}

        {/* Evolution API */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Evolution API Individual</h3>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL da API</Label>
            <Input value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} placeholder="https://evolution.seudominio.com" className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label>
            <Input type="password" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} placeholder="Sua chave da Evolution API" className="bg-secondary border-border" />
          </div>
        </motion.div>

        {/* Alertas WhatsApp */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-foreground">Alertas por WhatsApp</h3>
          </div>
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs leading-relaxed">
            Configure para receber alertas automáticos de faturas atrasadas, tarefas vencidas, despesas fixas e posts pendentes de aprovação.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Número para Alertas</Label>
              <Input
                value={notificationPhone}
                onChange={e => setNotificationPhone(e.target.value)}
                placeholder="5511999999999 (com DDI e DDD)"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instância Evolution</Label>
              <Input
                value={notificationInstance}
                onChange={e => setNotificationInstance(e.target.value)}
                placeholder="Nome da instância para envio"
                className="bg-secondary border-border"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Usa a Evolution API configurada acima. Deixe em branco para receber apenas notificações in-app.
          </p>
        </motion.div>

        {/* APIs de Extração */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">APIs de Extração</h3>
          </div>
          {[
            { label: "Serper API Key", value: serperApiKey, set: setSerperApiKey, placeholder: "Chave do Serper (Google Maps)" },
            { label: "Apify API Key", value: apifyApiKey, set: setApifyApiKey, placeholder: "Chave do Apify (Instagram)" },
            { label: "OpenAI API Key", value: openaiApiKey, set: setOpenaiApiKey, placeholder: "sk-..." },
          ].map((field) => (
            <div key={field.label} className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{field.label}</Label>
              <Input type="password" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} className="bg-secondary border-border" />
            </div>
          ))}
        </motion.div>

        <button type="submit" disabled={saving} className="gradient-button px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>

      {/* Alterar Senha */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-2xl">
        <form onSubmit={handleChangePassword} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Alterar Senha</h3>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Senha Atual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="bg-secondary border-border" required />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nova Senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} className="bg-secondary border-border" required />
          </div>
          <button type="submit" disabled={changingPassword} className="gradient-button px-6 py-3 text-sm disabled:opacity-50">
            {changingPassword ? "Alterando..." : "Alterar Senha"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Settings;
