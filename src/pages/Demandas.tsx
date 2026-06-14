import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Inbox, ArrowLeft, Loader2, CheckCircle, Trash2, ListTodo, MessageSquare } from "lucide-react";

interface Demand {
  id: string; summary: string; original_text: string; category: string;
  status: string; sender?: string; created_at: string;
  client?: { id: string; name: string };
}

const STATUS = [
  { key: "NOVA", label: "Novas", color: "text-amber-300" },
  { key: "EM_ANDAMENTO", label: "Em andamento", color: "text-blue-300" },
  { key: "RESOLVIDA", label: "Resolvidas", color: "text-green-300" },
];

const CAT_COLOR: Record<string, string> = {
  ARTE: "bg-purple-500/20 text-purple-300",
  SITE: "bg-sky-500/20 text-sky-300",
  TRAFEGO: "bg-red-500/20 text-red-300",
  ATENDIMENTO: "bg-amber-500/20 text-amber-300",
  FINANCEIRO: "bg-green-500/20 text-green-300",
  OUTRO: "bg-secondary text-muted-foreground",
};

const Demandas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("NOVA");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/demands?status=${filter}`);
      setDemands(d.demands || []);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const virarTarefa = async (dem: Demand) => {
    setActing(dem.id);
    try {
      await api.post(`/api/demands/${dem.id}/to-task`, {});
      toast({ title: "Virou tarefa no Tasqui! ✅", description: dem.summary });
      setDemands(p => p.filter(x => x.id !== dem.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  const marcar = async (dem: Demand, status: string) => {
    setActing(dem.id);
    try {
      await api.patch(`/api/demands/${dem.id}`, { status });
      setDemands(p => p.filter(x => x.id !== dem.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  const descartar = async (dem: Demand) => {
    setActing(dem.id);
    try {
      await api.delete(`/api/demands/${dem.id}`);
      setDemands(p => p.filter(x => x.id !== dem.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Inbox className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa de Demandas</h1>
          <p className="text-muted-foreground text-sm">Captadas pela IA nos grupos de WhatsApp dos clientes</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {STATUS.map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === s.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : demands.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma demanda {STATUS.find(s => s.key === filter)?.label.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {demands.map(dem => (
            <div key={dem.id} className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLOR[dem.category] || CAT_COLOR.OUTRO}`}>{dem.category}</span>
                    <span className="text-xs font-semibold text-foreground">{dem.client?.name}</span>
                    {dem.sender && <span className="text-[11px] text-muted-foreground">· {dem.sender}</span>}
                  </div>
                  <p className="text-sm text-foreground font-medium">{dem.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="italic">"{dem.original_text}"</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {filter !== "RESOLVIDA" && (
                  <Button size="sm" onClick={() => virarTarefa(dem)} disabled={acting === dem.id}
                    className="h-7 text-xs gradient-button gap-1">
                    {acting === dem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListTodo className="w-3 h-3" />}
                    Virar tarefa
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => marcar(dem, "RESOLVIDA")} disabled={acting === dem.id}
                  className="h-7 text-xs border-green-500/30 text-green-400 gap-1">
                  <CheckCircle className="w-3 h-3" /> Resolvida
                </Button>
                <Button size="sm" variant="ghost" onClick={() => descartar(dem)} disabled={acting === dem.id}
                  className="h-7 text-xs text-muted-foreground gap-1">
                  <Trash2 className="w-3 h-3" /> Descartar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Demandas;
