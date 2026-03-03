import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { firestoreService } from "@/lib/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { Settings as SettingsIcon, Save, Link, Key } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [webhookGoogleMaps, setWebhookGoogleMaps] = useState("");
  const [webhookInstagram, setWebhookInstagram] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "configuracoes", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWebhookGoogleMaps(data.webhook_google_maps || "");
          setWebhookInstagram(data.webhook_instagram || "");
          setEvolutionApiUrl(data.evolution_api_url || "");
          setEvolutionApiKey(data.evolution_api_key || "");
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.uid,
      webhook_google_maps: webhookGoogleMaps || null,
      webhook_instagram: webhookInstagram || null,
      evolution_api_url: evolutionApiUrl || null,
      evolution_api_key: evolutionApiKey || null,
    };

    try {
      await setDoc(doc(db, "configuracoes", user.uid), payload, { merge: true });
      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seus webhooks e integrações</p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Link className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Webhooks n8n</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Webhook Google Maps</Label>
            <Input
              value={webhookGoogleMaps}
              onChange={(e) => setWebhookGoogleMaps(e.target.value)}
              placeholder="https://n8n.example.com/webhook/google-maps"
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Webhook Instagram</Label>
            <Input
              value={webhookInstagram}
              onChange={(e) => setWebhookInstagram(e.target.value)}
              placeholder="https://n8n.example.com/webhook/instagram"
              className="bg-secondary border-border"
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Evolution API</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL da API</Label>
            <Input
              value={evolutionApiUrl}
              onChange={(e) => setEvolutionApiUrl(e.target.value)}
              placeholder="https://evolution.example.com"
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label>
            <Input
              type="password"
              value={evolutionApiKey}
              onChange={(e) => setEvolutionApiKey(e.target.value)}
              placeholder="Sua chave da API Evolution"
              className="bg-secondary border-border"
            />
          </div>
        </motion.div>

        <button type="submit" disabled={saving} className="gradient-button px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>
    </div>
  );
};

export default Settings;
