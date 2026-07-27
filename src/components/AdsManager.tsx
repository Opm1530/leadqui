import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Play, Pause, Sparkles, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: any) => Number(n || 0);
const PERIODS = [
  { v: "today", l: "Hoje" }, { v: "yesterday", l: "Ontem" },
  { v: "last_7d", l: "7 dias" }, { v: "last_14d", l: "14 dias" }, { v: "last_30d", l: "30 dias" },
];

function insight(c: any) { return c.insights?.data?.[0] || {}; }
function roas(c: any) { const r = insight(c).purchase_roas; return r?.[0]?.value ? num(r[0].value) : 0; }

export default function AdsManager({ clientId, connection }: { clientId: string; connection: any }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState("last_7d");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [editBudget, setEditBudget] = useState<string | null>(null);
  const [budgetVal, setBudgetVal] = useState("");

  const loadCampaigns = () => {
    if (!connection) return;
    setLoading(true); setErr(null);
    api.get(`/api/techqui/ads/campaigns/${connection.id}?date_preset=${period}`)
      .then(d => setCampaigns(d.data || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  const loadAnalysis = () => {
    api.get(`/api/techqui/ads/analyses?client_id=${clientId}`).then(d => setAnalysis((d.analyses || [])[0] || null)).catch(() => {});
    api.get(`/api/techqui/ads/suggestions?client_id=${clientId}&status=PENDENTE`).then(d => setSuggestions(d.suggestions || [])).catch(() => {});
  };
  useEffect(() => { loadCampaigns(); }, [connection, period]);
  useEffect(() => { loadAnalysis(); }, [clientId]);

  const acao = async (c: any, action: string, budget?: string) => {
    try {
      await api.post(`/api/techqui/ads/campaigns/${connection.id}/action`, { campaign_id: c.id, action, daily_budget: budget });
      toast({ title: "Feito!", description: action === "budget" ? "Orçamento atualizado." : action === "pause" ? "Campanha pausada." : "Campanha ativada." });
      setEditBudget(null); loadCampaigns();
    } catch (e: any) {
      toast({ title: "Erro na Meta", description: e.message, variant: "destructive" });
    }
  };

  const analisar = async () => {
    setAnalyzing(true);
    try { await api.post(`/api/techqui/ads/analyze/${connection.id}`, {}); toast({ title: "Análise iniciada", description: "O agente vai gerar recomendações em instantes." }); setTimeout(loadAnalysis, 8000); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setAnalyzing(false); }
  };

  const decidir = async (s: any, status: string) => {
    try {
      await api.patch(`/api/techqui/ads/suggestions/${s.id}`, { status });
      setSuggestions(p => p.filter(x => x.id !== s.id));
      toast({ title: status === "APROVADO" ? "Aprovado — executando na Meta" : "Sugestão rejeitada" });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  if (!connection) return <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">Conecte a conta Meta na aba Conexões para gerenciar os anúncios.</div>;

  const totSpend = campaigns.reduce((a, c) => a + num(insight(c).spend), 0);
  const roasVals = campaigns.map(roas).filter(r => r > 0);
  const avgRoas = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : 0;

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={loadCampaigns} variant="outline" size="sm" className="border-border gap-1"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>
        <Button onClick={analisar} disabled={analyzing} size="sm" className="gradient-button gap-1 ml-auto">
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analisar com IA
        </Button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/40 p-3"><p className="text-[11px] text-muted-foreground">Gasto no período</p><p className="text-lg font-bold text-foreground">{brl(totSpend)}</p></div>
        <div className="rounded-xl border border-border bg-card/40 p-3"><p className="text-[11px] text-muted-foreground">ROAS médio</p><p className="text-lg font-bold text-green-400">{avgRoas.toFixed(2)}x</p></div>
        <div className="rounded-xl border border-border bg-card/40 p-3"><p className="text-[11px] text-muted-foreground">Campanhas</p><p className="text-lg font-bold text-foreground">{campaigns.length}</p></div>
      </div>

      {/* Sugestões da IA */}
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-yellow-400" /> Recomendações do agente ({suggestions.length})</p>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.id} className="bg-secondary/40 rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                <div className="flex gap-2">
                  <Button onClick={() => decidir(s, "APROVADO")} size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"><Check className="w-3 h-3" /> Aprovar e executar</Button>
                  <Button onClick={() => decidir(s, "REJEITADO")} size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 gap-1"><X className="w-3 h-3" /> Rejeitar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de campanhas */}
      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        : err ? <p className="text-sm text-red-400 py-8 text-center px-4">{err}</p>
        : campaigns.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma campanha nesse período.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left p-3">Campanha</th><th className="p-3">Orçamento/dia</th><th className="p-3">Gasto</th><th className="p-3">ROAS</th><th className="p-3">CTR</th><th className="p-3">CPC</th><th className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const ins = insight(c);
                  const active = c.status === "ACTIVE";
                  const budget = c.daily_budget ? num(c.daily_budget) / 100 : 0;
                  return (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="p-3">
                        <p className="text-foreground font-medium truncate max-w-[180px]">{c.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-green-500/20 text-green-300" : "bg-secondary text-muted-foreground"}`}>{c.status}</span>
                      </td>
                      <td className="p-3 text-center">
                        {editBudget === c.id ? (
                          <div className="flex items-center gap-1">
                            <Input value={budgetVal} onChange={e => setBudgetVal(e.target.value)} type="number" className="h-7 w-20 bg-secondary border-border text-xs" />
                            <button onClick={() => acao(c, "budget", budgetVal)} className="text-green-400"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditBudget(null)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditBudget(c.id); setBudgetVal(String(budget || "")); }} className="text-foreground hover:text-primary flex items-center gap-1 mx-auto">
                            {budget ? brl(budget) : "—"} <Pencil className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-center text-foreground">{brl(num(ins.spend))}</td>
                      <td className="p-3 text-center font-bold text-green-400">{roas(c) ? `${roas(c).toFixed(2)}x` : "—"}</td>
                      <td className="p-3 text-center text-muted-foreground">{ins.ctr ? `${num(ins.ctr).toFixed(2)}%` : "—"}</td>
                      <td className="p-3 text-center text-muted-foreground">{ins.cpc ? brl(num(ins.cpc)) : "—"}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => acao(c, active ? "pause" : "activate")} title={active ? "Pausar" : "Ativar"} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground">
                          {active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Última análise */}
      {analysis && (
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Última análise · {new Date(analysis.created_at).toLocaleString("pt-BR")}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.analysis_text}</p>
        </div>
      )}
    </div>
  );
}
