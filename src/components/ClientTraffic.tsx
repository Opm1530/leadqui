import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Edit2, Settings2, TrendingUp, Wallet, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COL_TYPES = [
  { id: "NUMBER", label: "Número" },
  { id: "CURRENCY", label: "Moeda (R$)" },
  { id: "PERCENT", label: "Porcentagem (%)" },
  { id: "TEXT", label: "Texto" },
];
const fmtColVal = (v: any, type: string) => {
  if (v === undefined || v === null || v === "") return "—";
  if (type === "CURRENCY") return brl(Number(v));
  if (type === "PERCENT") return `${v}%`;
  return String(v);
};
const PLATFORMS = [
  { id: "META", label: "Meta Ads" },
  { id: "GOOGLE", label: "Google Ads" },
  { id: "TIKTOK", label: "TikTok Ads" },
];
const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const emptyCheck = () => ({
  id: "", checked_at: new Date().toISOString().slice(0, 16),
  campaign_name: "", campaign_id: "", adset_name: "", ad_name: "", spend: "", observation: "", values: {} as Record<string, any>,
});

export default function ClientTraffic({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("META");
  const [month, setMonth] = useState(nowMonth());
  const [data, setData] = useState<any>({ budget: 0, columns: [], checks: [], totals: { gasto: 0, saldo: 0, count: 0 } });
  const [loading, setLoading] = useState(true);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [colModal, setColModal] = useState(false);
  const [newCol, setNewCol] = useState({ name: "", type: "NUMBER" });
  const [checkModal, setCheckModal] = useState(false);
  const [form, setForm] = useState<any>(emptyCheck());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/traffic/${clientId}?month=${month}&platform=${platform}`)
      .then(d => { setData(d); setBudgetInput(d.budget ? String(d.budget) : ""); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [clientId, month, platform]);
  useEffect(() => { load(); }, [load]);

  const salvarVerba = async () => {
    setSavingBudget(true);
    try { await api.put(`/api/traffic/${clientId}/budget`, { month, platform, amount: Number(budgetInput) || 0 }); load(); toast({ title: "Verba salva!" }); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSavingBudget(false); }
  };

  const addColuna = async () => {
    if (!newCol.name.trim()) return;
    try { await api.post(`/api/traffic/${clientId}/columns`, newCol); setNewCol({ name: "", type: "NUMBER" }); load(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  const delColuna = async (id: string) => {
    if (!confirm("Excluir esta coluna? Os valores dela nas verificações somem.")) return;
    await api.delete(`/api/traffic/${clientId}/columns/${id}`).catch(() => {}); load();
  };
  // Move uma coluna pra cima/baixo trocando a ordem com a vizinha.
  const moverColuna = async (idx: number, dir: -1 | 1) => {
    const cols = data.columns || [];
    const j = idx + dir;
    if (j < 0 || j >= cols.length) return;
    const a = cols[idx], b = cols[j];
    await Promise.all([
      api.patch(`/api/traffic/${clientId}/columns/${a.id}`, { order: j }),
      api.patch(`/api/traffic/${clientId}/columns/${b.id}`, { order: idx }),
    ]).catch(() => {});
    load();
  };

  const abrirNovo = () => { setForm(emptyCheck()); setCheckModal(true); };
  const abrirEdicao = (c: any) => setForm({
    id: c.id, checked_at: new Date(c.checked_at).toISOString().slice(0, 16),
    campaign_name: c.campaign_name || "", campaign_id: c.campaign_id || "", adset_name: c.adset_name || "",
    ad_name: c.ad_name || "", spend: c.spend != null ? String(c.spend) : "", observation: c.observation || "", values: c.values || {},
  });
  useEffect(() => { if (form.id) setCheckModal(true); }, [form.id]);

  const salvarCheck = async () => {
    setSaving(true);
    const payload = { ...form, spend: Number(form.spend) || 0, platform };
    try {
      if (form.id) await api.patch(`/api/traffic/${clientId}/checks/${form.id}`, payload);
      else await api.post(`/api/traffic/${clientId}/checks`, payload);
      setCheckModal(false); setForm(emptyCheck()); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const delCheck = async (id: string) => {
    if (!confirm("Excluir esta verificação?")) return;
    await api.delete(`/api/traffic/${clientId}/checks/${id}`).catch(() => {}); load();
  };

  const columns: any[] = data.columns || [];
  const { gasto = 0, saldo = 0 } = data.totals || {};
  const verba = data.budget || 0;
  const pct = verba > 0 ? Math.min(100, Math.round((gasto / verba) * 100)) : 0;
  const estourou = verba > 0 && gasto > verba;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: mês + verba + saldo */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-foreground">Verificação de Tráfego</h3>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground" />
            <Button variant="outline" size="sm" className="border-border gap-1.5" onClick={() => setColModal(true)}><Settings2 className="w-4 h-4" /> Colunas</Button>
            <Button size="sm" className="gradient-button gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Verificação</Button>
          </div>
        </div>

        {/* Guias de plataforma */}
        <div className="flex items-center gap-1 mb-4 bg-secondary/40 rounded-xl p-1 w-fit">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${platform === p.id ? "bg-white/10 text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Verba do mês (editável) */}
          <div className="rounded-xl bg-secondary/40 border border-border p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1"><Wallet className="w-3 h-3" /> Verba do mês</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">R$</span>
              <input value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="0,00" inputMode="decimal"
                className="flex-1 min-w-0 bg-transparent text-lg font-bold text-foreground focus:outline-none" onKeyDown={e => { if (e.key === "Enter") salvarVerba(); }} />
              <Button size="sm" variant="ghost" onClick={salvarVerba} disabled={savingBudget} className="h-7 text-xs">{savingBudget ? <Loader2 className="w-3 h-3 animate-spin" /> : "salvar"}</Button>
            </div>
          </div>
          {/* Gasto */}
          <div className="rounded-xl bg-secondary/40 border border-border p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Gasto no mês</p>
            <p className="text-lg font-bold text-orange-400">{brl(gasto)}</p>
          </div>
          {/* Saldo */}
          <div className={`rounded-xl border p-3 ${estourou ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Saldo restante</p>
            <p className={`text-lg font-bold ${estourou ? "text-red-400" : "text-emerald-400"}`}>{brl(saldo)}</p>
          </div>
        </div>
        {/* Barra de progresso */}
        {verba > 0 && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full ${estourou ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{pct}% da verba consumida{estourou ? " · verba estourada!" : ""}</p>
          </div>
        )}
      </div>

      {/* Tabela de verificações */}
      <div className="glass-card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (data.checks || []).length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma verificação neste mês. Clique em "Verificação" pra registrar a primeira.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 whitespace-nowrap">Data</th>
                  <th className="p-3 whitespace-nowrap">Campanha</th>
                  <th className="p-3 whitespace-nowrap">Conjunto</th>
                  <th className="p-3 whitespace-nowrap">Anúncio</th>
                  <th className="p-3 whitespace-nowrap">ID</th>
                  <th className="p-3 whitespace-nowrap text-right">Gasto</th>
                  {columns.map(c => <th key={c.id} className="p-3 whitespace-nowrap">{c.name}</th>)}
                  <th className="p-3 whitespace-nowrap">Observação</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data.checks || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(c.checked_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3 whitespace-nowrap text-foreground font-medium">{c.campaign_name || "—"}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{c.adset_name || "—"}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{c.ad_name || "—"}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground text-xs font-mono">{c.campaign_id || "—"}</td>
                    <td className="p-3 whitespace-nowrap text-right text-orange-400 font-semibold">{brl(c.spend || 0)}</td>
                    {columns.map(col => <td key={col.id} className="p-3 whitespace-nowrap text-foreground">{fmtColVal(c.values?.[col.id], col.type)}</td>)}
                    <td className="p-3 max-w-[220px] truncate text-muted-foreground" title={c.observation || ""}>{c.observation || "—"}</td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <button onClick={() => abrirEdicao(c)} className="p-1.5 text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => delCheck(c.id)} className="p-1.5 text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: gerenciar colunas */}
      <Dialog open={colModal} onOpenChange={setColModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Colunas de métricas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              {columns.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma coluna personalizada ainda.</p>}
              {columns.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                  <div className="flex flex-col -my-1">
                    <button onClick={() => moverColuna(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moverColuna(i, 1)} disabled={i === columns.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="flex-1 text-sm text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{COL_TYPES.find(t => t.id === c.type)?.label || c.type}</span>
                  <button onClick={() => delColuna(c.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Adicionar coluna</p>
              <div className="flex gap-2">
                <Input value={newCol.name} onChange={e => setNewCol({ ...newCol, name: e.target.value })} placeholder="Ex.: CPL, CTR, Leads" className="flex-1 bg-secondary border-border" onKeyDown={e => { if (e.key === "Enter") addColuna(); }} />
                <select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value })} className="h-10 rounded-lg bg-secondary border border-border px-2 text-sm text-foreground">
                  {COL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <Button onClick={addColuna}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: nova / editar verificação */}
      <Dialog open={checkModal} onOpenChange={o => { if (!o) { setCheckModal(false); setForm(emptyCheck()); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar verificação" : "Nova verificação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data/hora</label>
                <Input type="datetime-local" value={form.checked_at} onChange={e => setForm({ ...form, checked_at: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gasto no período (R$)</label>
                <Input value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} placeholder="0,00" inputMode="decimal" className="bg-secondary border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Campanha</label><Input value={form.campaign_name} onChange={e => setForm({ ...form, campaign_name: e.target.value })} className="bg-secondary border-border" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">ID da campanha</label><Input value={form.campaign_id} onChange={e => setForm({ ...form, campaign_id: e.target.value })} className="bg-secondary border-border font-mono text-xs" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Conjunto</label><Input value={form.adset_name} onChange={e => setForm({ ...form, adset_name: e.target.value })} className="bg-secondary border-border" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Anúncio</label><Input value={form.ad_name} onChange={e => setForm({ ...form, ad_name: e.target.value })} className="bg-secondary border-border" /></div>
            </div>
            {columns.length > 0 && (
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                {columns.map(col => (
                  <div key={col.id}>
                    <label className="text-xs text-muted-foreground mb-1 block">{col.name}{col.type === "PERCENT" ? " (%)" : col.type === "CURRENCY" ? " (R$)" : ""}</label>
                    <Input value={form.values?.[col.id] ?? ""} onChange={e => setForm({ ...form, values: { ...form.values, [col.id]: e.target.value } })}
                      inputMode={col.type === "TEXT" ? undefined : "decimal"} className="bg-secondary border-border" />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
              <textarea value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} rows={2}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" placeholder="Ex.: CPL subindo, trocar criativo amanhã" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCheckModal(false); setForm(emptyCheck()); }}>Cancelar</Button>
            <Button onClick={salvarCheck} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
