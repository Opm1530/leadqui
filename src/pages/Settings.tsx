import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { firestoreService } from "@/lib/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { Settings as SettingsIcon, Save, Link, Key, Receipt } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/integrations/firebase/functions";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [webhookGoogleMaps, setWebhookGoogleMaps] = useState("");
  const [webhookInstagram, setWebhookInstagram] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [serperApiKey, setSerperApiKey] = useState("");
  const [apifyApiKey, setApifyApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");

  const [serperCreditsRemaining, setSerperCreditsRemaining] = useState<number | null>(null);
  const [serperCreditsUpdatedAt, setSerperCreditsUpdatedAt] = useState<string | null>(null);

  const [apifyUsage, setApifyUsage] = useState<{ usedUsd: number, totalCreditsUsd: number, remainingUsd: number } | null>(null);
  const [loadingApify, setLoadingApify] = useState(false);

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
          setSerperApiKey(data.serper_api_key || "");
          setApifyApiKey(data.apify_api_key || "");
          setOpenaiApiKey(data.openai_api_key || "");
          
          setSerperCreditsRemaining(data.serper_credits_remaining ?? null);
          setSerperCreditsUpdatedAt(data.serper_credits_updated_at?.toDate?.()?.toISOString() || null);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [user]);

  const saveApiKey = async (field: string, value: string) => {
    if (!user || !value.trim()) return;
    try {
      await setDoc(doc(db, "configuracoes", user.uid), { [field]: value.trim(), user_id: user.uid }, { merge: true });
      toast({ title: "Chave salva com segurança!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar chave", description: error.message, variant: "destructive" });
    }
  };

  const checkApifyUsage = async () => {
    if (!user) return;
    setLoadingApify(true);
    try {
      const fn = httpsCallable(functions, "getApifyUsage");
      const res = await fn({ userId: user.uid }) as any;
      setApifyUsage(res.data);
    } catch (err: any) {
      toast({ title: "Erro ao consultar saldo Apify", description: err.message, variant: "destructive" });
    } finally {
      setLoadingApify(false);
    }
  };

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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">APIs de Extração</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">
            As chaves são salvas diretamente no servidor (Firestore) e nunca expostas no frontend.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Serper API Key</Label>
              <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Documentação ↗
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Insira a Serper API Key"
                className="bg-secondary border-border flex-1"
                id="serper-key-input"
                defaultValue={serperApiKey}
              />
              <button
                type="button"
                className="px-4 py-2 text-sm gradient-button"
                onClick={() => {
                  const el = document.getElementById("serper-key-input") as HTMLInputElement;
                  if (el?.value) saveApiKey("serper_api_key", el.value);
                }}
              >
                Salvar
              </button>
            </div>
            
            {serperCreditsRemaining !== null ? (
              <div className="mt-2 text-xs flex items-center justify-between bg-primary/5 p-2 rounded-md border border-primary/20">
                <span className="text-muted-foreground">
                  Última consulta: <strong className="text-foreground">{serperCreditsRemaining} queries restantes</strong> · Data: {new Date(serperCreditsUpdatedAt!).toLocaleDateString("pt-BR")}
                </span>
                {(() => {
                  const pct = serperCreditsRemaining / 2500;
                  let colorClass = "bg-green-500/20 text-green-500 border-green-500/30";
                  if (pct <= 0.2) colorClass = "bg-red-500/20 text-red-500 border-red-500/30";
                  else if (pct <= 0.5) colorClass = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
                  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${colorClass}`}>Saldo</span>;
                })()}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Receipt className="w-3 h-3" /> Faça sua primeira extração para ver o saldo do Serper.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Apify API Key</Label>
              <a href="https://apify.com/apify/instagram-hashtag-scraper" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Documentação ↗
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Insira a Apify API Key"
                className="bg-secondary border-border flex-1"
                id="apify-key-input"
                defaultValue={apifyApiKey}
              />
              <button
                type="button"
                className="px-4 py-2 text-sm gradient-button"
                onClick={() => {
                  const el = document.getElementById("apify-key-input") as HTMLInputElement;
                  if (el?.value) saveApiKey("apify_api_key", el.value);
                }}
              >
                Salvar
              </button>
            </div>
            
            <div className="flex justify-start mt-2">
              <button 
                type="button" 
                onClick={checkApifyUsage} 
                disabled={loadingApify || !apifyApiKey} 
                className="text-xs bg-secondary hover:bg-secondary/80 text-foreground border border-border px-3 py-1 rounded-md disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Receipt className="w-3 h-3" />
                {loadingApify ? "Consultando..." : "Ver saldo Apify"}
              </button>
            </div>

            {apifyUsage && (
              <div className="mt-2 text-xs flex items-center justify-between bg-primary/5 p-2 rounded-md border border-primary/20">
                <span className="text-muted-foreground">
                  Usado: <strong className="text-foreground">${apifyUsage.usedUsd.toFixed(2)}</strong> / ${apifyUsage.totalCreditsUsd.toFixed(2)} — Restante: <strong className="text-foreground">${apifyUsage.remainingUsd.toFixed(2)}</strong>
                </span>
                {(() => {
                  const pct = apifyUsage.totalCreditsUsd > 0 ? Math.max(0, apifyUsage.remainingUsd / apifyUsage.totalCreditsUsd) : 0;
                  let colorClass = "bg-green-500/20 text-green-500 border-green-500/30";
                  if (pct <= 0.2) colorClass = "bg-red-500/20 text-red-500 border-red-500/30";
                  else if (pct <= 0.5) colorClass = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
                  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${colorClass}`}>Status</span>;
                })()}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">OpenAI API Key</Label>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Obter Chave ↗
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Insira a OpenAI API Key (sk-...)"
                className="bg-secondary border-border flex-1"
                id="openai-key-input"
                defaultValue={openaiApiKey}
              />
              <button
                type="button"
                className="px-4 py-2 text-sm gradient-button"
                onClick={() => {
                  const el = document.getElementById("openai-key-input") as HTMLInputElement;
                  if (el?.value) saveApiKey("openai_api_key", el.value);
                }}
              >
                Salvar
              </button>
            </div>
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
