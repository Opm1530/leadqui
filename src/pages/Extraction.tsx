import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { firestoreService } from "@/lib/firestore";
import { MapPin, Instagram, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import ExtractionHistory from "@/components/ExtractionHistory";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

type ExtractionType = "google_maps" | "instagram";

const Extraction = () => {
  const { user } = useAuth();
  const [type, setType] = useState<ExtractionType>("google_maps");
  const [categoria, setCategoria] = useState("");
  const [cidade, setCidade] = useState("");
  const [tag, setTag] = useState("");
  const [quantidade, setQuantidade] = useState("50");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      try {
        const q = query(collection(db, "configuracoes"), where("user_id", "==", user.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setConfig(snap.docs[0].data());
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      }
    };
    fetchConfig();
  }, [user]);

  const getWebhookUrl = () => {
    if (type === "google_maps") return config?.webhook_google_maps;
    return config?.webhook_instagram;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      toast({
        title: "Webhook não configurado",
        description: "Configure os webhooks na página de Configurações.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const parametros =
      type === "google_maps"
        ? { categoria, cidade, quantidade: Number(quantidade) }
        : { tag, quantidade: Number(quantidade) };

    try {
      const docRef = await firestoreService.add("extracoes", user.uid, {
        tipo: type,
        parametros,
        status: "em_andamento",
        total_leads: 0
      });

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: type,
          extracao_id: docRef.id,
          user_id: user.uid,
          ...parametros,
        }),
      });
      toast({
        title: "Extração iniciada!",
        description: "Os leads serão processados e aparecerão automaticamente.",
      });
    } catch (error: any) {
      toast({
        title: "Extração registrada com aviso",
        description: "A extração foi salva no banco, mas pode haver erro no webhook: " + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const webhookConfigured = !!getWebhookUrl();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Extração de Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">Capture leads do Google Maps ou Instagram</p>
      </div>

      {config !== null && !config?.webhook_google_maps && !config?.webhook_instagram && (
        <div className="glass-card p-4 flex items-center gap-3 border-warning/30">
          <AlertCircle className="w-5 h-5 text-warning shrink-0" />
          <div className="text-sm">
            <p className="text-foreground font-medium">Webhooks não configurados</p>
            <p className="text-muted-foreground">
              Configure os webhooks do n8n em{" "}
              <Link to="/settings" className="text-primary hover:underline">Configurações</Link>
              {" "}para iniciar extrações.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-foreground text-center mb-6">Buscar Leads</h3>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setType("google_maps")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${type === "google_maps"
                  ? "gradient-button"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
            >
              <MapPin className="w-4 h-4" />
              Google Maps
            </button>
            <button
              type="button"
              onClick={() => setType("instagram")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${type === "instagram"
                  ? "gradient-button"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
            >
              <Instagram className="w-4 h-4" />
              Instagram Tags
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {type === "google_maps" ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Categoria:</Label>
                  <Input
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Digite a categoria"
                    className="bg-secondary border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cidade:</Label>
                  <Input
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Digite a cidade"
                    className="bg-secondary border-border"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tag do Instagram:</Label>
                <Input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Digite a tag (ex: veganfood)"
                  className="bg-secondary border-border"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantidade:</Label>
              <Input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="50"
                className="bg-secondary border-border"
                min={1}
                max={500}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !webhookConfigured}
              className="w-full py-3 gradient-button rounded-lg disabled:opacity-50"
            >
              {loading ? "Enviando..." : "ENVIAR"}
            </button>
          </form>
        </motion.div>
      </div>

      <ExtractionHistory />
    </div>
  );
};

export default Extraction;
