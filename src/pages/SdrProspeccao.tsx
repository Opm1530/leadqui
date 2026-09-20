import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Loader2, Sparkles, Save, Send, X, Check, Users, BarChart3, Inbox } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STAGE_LABEL: Record<string, string> = { NOVO: "Novo", ABORDADO: "Abordado", EM_CONVERSA: "Em conversa", QUALIFICADO: "Qualificado", REUNIAO: "Reunião", PERDIDO: "Perdido" };

const Field = ({ label, hint, value, onChange, rows = 2 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
  </div>
);

const SdrProspeccao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<"playbook" | "fila" | "funil">("playbook");
  const [pb, setPb] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testNome, setTestNome] = useState(""); const [testCidade, setTestCidade] = useState("");
  const [preview, setPreview] = useState(""); const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get("/api/sdr/playbook").then(d => setPb(d.playbook)).catch(() => {}).finally(() => setLoading(false));
    api.get("/api/instances").then(d => setInstances(d.instances || [])).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setPb((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    setSaving(true);
    try { const d = await api.put("/api/sdr/playbook", pb); setPb(d.playbook); toast({ title: "Playbook salva!" }); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const testar = async () => {
    setPreviewing(true); setPreview("");
    try { const d = await api.post("/api/sdr/preview", { nome: testNome || undefined, cidade: testCidade || undefined }); setPreview(d.message || ""); }
    catch (e: any) { toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" }); }
    finally { setPreviewing(false); }
  };

  if (loading || !pb) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center"><Bot className="w-6 h-6 text-white" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Prospecção IA <span className="text-xs font-normal text-muted-foreground">· SDR</span></h1>
          <p className="text-sm text-muted-foreground">Prospecta, conversa e qualifica. No modo copiloto, você aprova cada envio.</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 mb-5 bg-secondary/40 rounded-xl p-1 w-fit">
        {([["playbook", "Playbook", Sparkles], ["fila", "Fila", Inbox], ["funil", "Funil", BarChart3]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${tab === id ? "bg-white/10 text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "playbook" && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-foreground">Agente {pb.active ? "ativo" : "em rascunho"}</p>
              <p className="text-xs text-muted-foreground">Nada é enviado sem a sua aprovação (modo copiloto).</p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Número do SDR</label>
                <select value={pb.instance || ""} onChange={e => set("instance", e.target.value)} className="h-9 rounded-lg bg-secondary border border-border px-2 text-sm text-foreground">
                  <option value="">— escolher —</option>
                  {instances.map(i => <option key={i.id} value={i.evolution_instance_id}>{i.nome}{i.phone ? ` (${i.phone})` : ""}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer"><span className="text-xs text-muted-foreground">Ativar</span><input type="checkbox" checked={!!pb.active} onChange={e => set("active", e.target.checked)} className="w-4 h-4" /></label>
            </div>
          </div>

          <div className="glass-card p-5 space-y-4">
            <Field label="Cliente ideal (ICP)" hint="Quem o SDR vai prospectar." value={pb.icp || ""} onChange={v => set("icp", v)} />
            <Field label="Oferta" value={pb.offer || ""} onChange={v => set("offer", v)} />
            <Field label="Tom de voz" value={pb.tone || ""} onChange={v => set("tone", v)} />
            <Field label="Perguntas de qualificação" hint="O que a IA busca descobrir." value={pb.qualifying || ""} onChange={v => set("qualifying", v)} rows={3} />
            <Field label="Diretrizes do 1º contato" value={pb.first_msg_guidance || ""} onChange={v => set("first_msg_guidance", v)} />
            <Field label="Diretrizes de follow-up" value={pb.followup_guidance || ""} onChange={v => set("followup_guidance", v)} />
            <Field label="Objetivo" value={pb.goal || ""} onChange={v => set("goal", v)} />
            <div className="flex items-end gap-4">
              <div className="w-40"><label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Novos contatos/dia</label><Input type="number" min={1} max={200} value={pb.daily_limit} onChange={e => set("daily_limit", e.target.value)} className="bg-secondary border-border mt-1" /></div>
              <Button onClick={salvar} disabled={saving} className="gradient-button gap-2 ml-auto">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
            </div>
          </div>

          <div className="glass-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Bot className="w-4 h-4 text-fuchsia-400" /> Testar a voz</h2>
            <div className="flex flex-wrap gap-2">
              <Input value={testNome} onChange={e => setTestNome(e.target.value)} placeholder="Nome do restaurante (opcional)" className="flex-1 min-w-[180px] bg-secondary border-border" />
              <Input value={testCidade} onChange={e => setTestCidade(e.target.value)} placeholder="Cidade (opcional)" className="w-40 bg-secondary border-border" />
              <Button onClick={testar} disabled={previewing} variant="outline" className="border-border gap-2">{previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar</Button>
            </div>
            {preview && <div className="rounded-xl bg-[#0b141a] border border-emerald-900/40 p-4"><div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2 text-sm text-gray-100 whitespace-pre-wrap">{preview}</div></div>}
          </div>
        </div>
      )}

      {tab === "fila" && <FilaTab toast={toast} />}
      {tab === "funil" && <FunilTab />}
    </div>
  );
};

// ── Fila de aprovação ─────────────────────────────────────────────────
function FilaTab({ toast }: { toast: any }) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ sentToday: 0, dailyLimit: 10, instance: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Gerar 1º contato
  const [cands, setCands] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(""); const [gen, setGen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/api/sdr/queue").then(d => { setDrafts(d.drafts || []); setMeta({ sentToday: d.sentToday, dailyLimit: d.dailyLimit, instance: d.instance }); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const loadCands = useCallback(() => api.get(`/api/sdr/candidates${search ? `?search=${encodeURIComponent(search)}` : ""}`).then(d => setCands(d.leads || [])).catch(() => {}), [search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCands(); }, [loadCands]);

  const gerar = async () => {
    if (sel.size === 0) return;
    setGen(true);
    try { const d = await api.post("/api/sdr/generate", { lead_ids: [...sel] }); toast({ title: `${d.created} rascunho(s) gerado(s)` }); setSel(new Set()); load(); loadCands(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setGen(false); }
  };
  const aprovar = async (dft: any) => {
    setBusy(dft.id);
    try { await api.post(`/api/sdr/drafts/${dft.id}/approve`, { text: edits[dft.id] ?? dft.text }); setDrafts(p => p.filter(x => x.id !== dft.id)); setMeta((m: any) => ({ ...m, sentToday: m.sentToday + 1 })); }
    catch (e: any) { toast({ title: "Não enviou", description: e.message, variant: "destructive" }); }
    finally { setBusy(""); }
  };
  const descartar = async (dft: any) => { setDrafts(p => p.filter(x => x.id !== dft.id)); await api.post(`/api/sdr/drafts/${dft.id}/discard`, {}).catch(() => {}); };

  return (
    <div className="space-y-4">
      {!meta.instance && <div className="glass-card p-3 text-xs text-orange-400 border border-orange-500/30">⚠️ Defina o <b>Número do SDR</b> na aba Playbook antes de enviar.</div>}

      {/* Gerar 1º contato */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-fuchsia-400" /> Gerar 1º contato</h3>
          <span className="text-[11px] text-muted-foreground">Hoje: {meta.sentToday}/{meta.dailyLimit} enviados</span>
        </div>
        <div className="flex gap-2 mb-2">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead por nome..." className="flex-1 bg-secondary border-border h-9" />
          <Button onClick={gerar} disabled={gen || sel.size === 0} className="gradient-button gap-1.5">{gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar ({sel.size})</Button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {cands.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum lead disponível (precisa ter telefone e ainda não estar no funil).</p>}
          {cands.map(l => (
            <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => setSel(p => { const n = new Set(p); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })} />
              <span className="text-sm text-foreground flex-1 truncate">{l.nome}</span>
              <span className="text-[11px] text-muted-foreground">{l.cidade || l.categoria || ""}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Fila */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Aguardando sua aprovação ({drafts.length})</h3>
        {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        : drafts.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center glass-card">Nada na fila. Gere 1º contatos acima.</p>
        : <div className="space-y-2">
            {drafts.map(dft => {
              const lead = dft.conversation?.lead;
              return (
                <div key={dft.id} className="glass-card p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{lead?.nome || "Lead"} <span className="text-[10px] font-normal text-muted-foreground">· {lead?.cidade || lead?.categoria || ""}</span></span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 uppercase">{dft.kind === "FIRST_CONTACT" ? "1º contato" : dft.kind === "FOLLOWUP" ? "Follow-up" : "Resposta"}</span>
                  </div>
                  <textarea value={edits[dft.id] ?? dft.text} onChange={e => setEdits(s => ({ ...s, [dft.id]: e.target.value }))} rows={3}
                    className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" onClick={() => aprovar(dft)} disabled={busy === dft.id} className="gradient-button gap-1.5">{busy === dft.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Aprovar e enviar</Button>
                    <Button size="sm" variant="ghost" onClick={() => descartar(dft)} className="gap-1.5 text-muted-foreground"><X className="w-4 h-4" /> Descartar</Button>
                  </div>
                </div>
              );
            })}
          </div>}
      </div>
    </div>
  );
}

// ── Funil + métricas ──────────────────────────────────────────────────
function FunilTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/api/sdr/pipeline").then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;
  const m = data.metrics;
  const cards = [
    { label: "No funil", value: m.total }, { label: "Abordados", value: m.abordados },
    { label: "Responderam", value: m.responderam }, { label: "Qualificados", value: m.qualificados },
    { label: "Reuniões", value: m.reunioes }, { label: "Taxa de resposta", value: `${m.taxaResposta}%` },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(c => <div key={c.label} className="glass-card p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</p><p className="text-xl font-bold text-foreground">{c.value}</p></div>)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.stages.map((s: string) => (
          <div key={s} className="glass-card p-3">
            <p className="text-xs font-bold text-foreground mb-2">{STAGE_LABEL[s] || s} <span className="text-muted-foreground">({(data.byStage[s] || []).length})</span></p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {(data.byStage[s] || []).map((c: any) => <div key={c.id} className="text-xs text-muted-foreground truncate bg-secondary/40 rounded px-2 py-1">{c.lead?.nome || "Lead"}</div>)}
              {(data.byStage[s] || []).length === 0 && <p className="text-[11px] text-muted-foreground/60">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SdrProspeccao;
