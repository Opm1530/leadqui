import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Instagram, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  PENDENTE: { icon: Clock, color: "text-warning", label: "Pendente" },
  EM_ANDAMENTO: { icon: Loader2, color: "text-primary", label: "Em andamento" },
  CONCLUIDA: { icon: CheckCircle, color: "text-success", label: "Concluída" },
  ERRO: { icon: AlertCircle, color: "text-destructive", label: "Erro" },
};

const ExtractionHistory = () => {
  const { user } = useAuth();
  const [extracoes, setExtracoes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/extractions?limit=20")
      .then((d) => setExtracoes(d.extractions || []))
      .catch(console.error);
  }, [user]);

  if (extracoes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Histórico de Extrações</h3>
      {extracoes.map((ext, i) => {
        const cfg = statusConfig[ext.status] || statusConfig.PENDENTE;
        const StatusIcon = cfg.icon;
        const params = ext.parametros ? JSON.parse(ext.parametros) : {};
        return (
          <motion.div key={ext.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {ext.tipo === "GOOGLE_MAPS" ? <MapPin className="w-4 h-4 text-primary" /> : <Instagram className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {ext.tipo === "GOOGLE_MAPS" ? `${params.categoria || ""} - ${params.cidade || ""}` : `#${params.tag || ""}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ext.total_leads} leads · {new Date(ext.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${cfg.color} ${ext.status === "EM_ANDAMENTO" ? "animate-spin" : ""}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ExtractionHistory;
