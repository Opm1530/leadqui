import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { firestoreService } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Instagram, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  em_andamento: { icon: Loader2, color: "text-primary", label: "Em andamento" },
  concluida: { icon: CheckCircle, color: "text-success", label: "Concluída" },
  erro: { icon: AlertCircle, color: "text-destructive", label: "Erro" },
};

const ExtractionHistory = () => {
  const { user } = useAuth();
  const [extracoes, setExtracoes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "extracoes"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: (doc.data() as any).created_at?.toDate?.()?.toISOString() || (doc.data() as any).created_at
      }));

      // Sort client-side since we removed orderBy to avoid index requirement
      const sortedData = [...data].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setExtracoes(sortedData);
    }, (error) => {
      console.error("Error in ExtractionHistory onSnapshot:", error);
    });

    return () => unsubscribe();
  }, [user]);

  if (extracoes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Histórico de Extrações</h3>
      {extracoes.map((ext, i) => {
        const cfg = statusConfig[ext.status] || statusConfig.em_andamento;
        const StatusIcon = cfg.icon;
        const params = ext.parametros || {};
        return (
          <motion.div
            key={ext.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {ext.tipo === "google_maps" ? (
                  <MapPin className="w-4 h-4 text-primary" />
                ) : (
                  <Instagram className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {ext.tipo === "google_maps"
                    ? `${params.categoria || ""} - ${params.cidade || ""}`
                    : `#${params.tag || ""}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ext.total_leads} leads · {new Date(ext.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${cfg.color} ${ext.status === "em_andamento" ? "animate-spin" : ""}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ExtractionHistory;
