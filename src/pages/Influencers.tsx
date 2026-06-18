import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import {
  Star, ArrowLeft, Plus, Loader2, Trash2, Edit2, Instagram, Check, Link2, DollarSign, Package, X,
} from "lucide-react";

const PARTNERSHIP_STATUS: Record<string, { label: string; color: string }> = {
  NEGOCIACAO: { label: "Negociação", color: "bg-yellow-500/20 text-yellow-300" },
  ENVIADO:    { label: "Enviado",    color: "bg-blue-500/20 text-blue-300" },
  PRODUZINDO: { label: "Produzindo", color: "bg-purple-500/20 text-purple-300" },
  CONCLUIDO:  { label: "Concluído",  color: "bg-green-500/20 text-green-300" },
};
const TIPO_LABEL: Record<string, string> = { PERMUTA: "Permuta", PAGO: "Pago", HIBRIDO: "Híbrido" };
const PROD_STATUS: Record<string, string> = { A_ENVIAR: "A enviar", ENVIADO: "Enviado", RECEBIDO: "Recebido" };
const DELIVERABLE_TYPES = ["REEL", "STORY", "POST", "VIDEO", "OUTRO"];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Influencers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<"catalogo" | "parcerias">("parcerias");
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [inf, part, cli] = await Promise.all([
        api.get("/api/influencers"),
        api.get("/api/influencers/partnerships"),
        api.get("/api/clients"),
      ]);
      setInfluencers(inf.influencers || []);
      setPartnerships(part.partnerships || []);
      setClients(cli.clients || []);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // ── Influencer modal ───────────────────────────────────────────────
  const emptyInf = { id: "", nome: "", instagram: "", tiktok: "", youtube: "", seguidores: "", telefone: "", email: "", nicho: "", observacao: "" };
  const [infModal, setInfModal] = useState(false);
  const [infForm, setInfForm] = useState<any>({ ...emptyInf });
  const [savingInf, setSavingInf] = useState(false);

  const saveInfluencer = async () => {
    if (!infForm.nome.trim()) return;
    setSavingInf(true);
    try {
      if (infForm.id) await api.put(`/api/influencers/${infForm.id}`, infForm);
      else await api.post("/api/influencers", infForm);
      toast({ title: "Influencer salva!" });
      setInfModal(false); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSavingInf(false); }
  };

  const delInfluencer = async (inf: any) => {
    if (!confirm(`Excluir ${inf.nome}? As parcerias dela também serão removidas.`)) return;
    try { await api.delete(`/api/influencers/${inf.id}`); load(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  // ── Partnership create modal ────────────────────────────────────────
  const emptyPart = { influencer_id: "", client_id: "", titulo: "", tipo: "PERMUTA", cache_value: "", status: "NEGOCIACAO", observacao: "" };
  const [partModal, setPartModal] = useState(false);
  const [partForm, setPartForm] = useState<any>({ ...emptyPart });
  const [savingPart, setSavingPart] = useState(false);

  const savePartnership = async () => {
    if (!partForm.influencer_id || !partForm.client_id || !partForm.titulo.trim()) {
      toast({ title: "Preencha influencer, cliente e título.", variant: "destructive" }); return;
    }
    setSavingPart(true);
    try {
      await api.post("/api/influencers/partnerships", partForm);
      toast({ title: "Parceria criada!" });
      setPartModal(false); setPartForm({ ...emptyPart }); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSavingPart(false); }
  };

  // ── Partnership detail ──────────────────────────────────────────────
  const [detail, setDetail] = useState<any>(null);
  const refreshDetail = async () => {
    const part = await api.get("/api/influencers/partnerships");
    setPartnerships(part.partnerships || []);
    setDetail((prev: any) => prev ? (part.partnerships || []).find((p: any) => p.id === prev.id) || null : null);
  };

  const filteredPartnerships = partnerships.filter(p => filterClient === "all" || p.client_id === filterClient);

  const partnershipSalesTotal = (p: any) =>
    (p.deliverables || []).reduce((acc: number, d: any) => acc + (d.sales || []).reduce((s: number, x: any) => s + (x.valor || 0), 0), 0);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Influencers</h1>
            <p className="text-muted-foreground text-sm">Gerencie influenciadoras e parcerias por cliente</p>
          </div>
        </div>
        {tab === "catalogo"
          ? <Button onClick={() => { setInfForm({ ...emptyInf }); setInfModal(true); }} className="gradient-button gap-2"><Plus className="w-4 h-4" /> Nova Influencer</Button>
          : <Button onClick={() => { setPartForm({ ...emptyPart }); setPartModal(true); }} className="gradient-button gap-2"><Plus className="w-4 h-4" /> Nova Parceria</Button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[["parcerias", "Parcerias"], ["catalogo", "Catálogo"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${tab === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tab === "catalogo" ? (
        /* ── CATÁLOGO ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {influencers.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-10">Nenhuma influencer cadastrada.</p>}
          {influencers.map(inf => (
            <div key={inf.id} className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{inf.nome}</p>
                  {inf.nicho && <p className="text-xs text-muted-foreground">{inf.nicho}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    {inf.instagram && <span className="flex items-center gap-1"><Instagram className="w-3 h-3" />{inf.instagram}</span>}
                    {inf.seguidores != null && <span>{Number(inf.seguidores).toLocaleString("pt-BR")} seg.</span>}
                  </div>
                  {(inf.telefone || inf.email) && <p className="text-[11px] text-muted-foreground mt-1">{[inf.telefone, inf.email].filter(Boolean).join(" · ")}</p>}
                  <p className="text-[11px] text-primary mt-1">{inf._count?.partnerships || 0} parceria(s)</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setInfForm({ ...emptyInf, ...inf, seguidores: inf.seguidores ?? "" }); setInfModal(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => delInfluencer(inf)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── PARCERIAS ── */
        <>
          <div className="mb-3 w-60">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {filteredPartnerships.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma parceria.</p>}
            {filteredPartnerships.map(p => {
              const total = (p.deliverables || []).length;
              const done = (p.deliverables || []).filter((d: any) => d.entregue).length;
              const vendas = partnershipSalesTotal(p);
              return (
                <button key={p.id} onClick={() => setDetail(p)} className="w-full text-left rounded-2xl border border-border bg-card/40 p-4 hover:bg-card/70 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-foreground">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground">⭐ {p.influencer?.nome} · 🏢 {p.client?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{TIPO_LABEL[p.tipo]}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${PARTNERSHIP_STATUS[p.status]?.color}`}>{PARTNERSHIP_STATUS[p.status]?.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>📦 {(p.products || []).length} produto(s)</span>
                    <span>✅ {done}/{total} entregue</span>
                    {vendas > 0 && <span className="text-green-400">💰 {brl(vendas)} em vendas</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Influencer */}
      <Dialog open={infModal} onOpenChange={(v) => !v && setInfModal(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle>{infForm.id ? "Editar" : "Nova"} Influencer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Field label="Nome *" col2 v={infForm.nome} set={(x) => setInfForm({ ...infForm, nome: x })} />
            <Field label="Instagram" v={infForm.instagram} set={(x) => setInfForm({ ...infForm, instagram: x })} ph="@perfil" />
            <Field label="TikTok" v={infForm.tiktok} set={(x) => setInfForm({ ...infForm, tiktok: x })} ph="@perfil" />
            <Field label="YouTube" v={infForm.youtube} set={(x) => setInfForm({ ...infForm, youtube: x })} />
            <Field label="Seguidores" v={infForm.seguidores} set={(x) => setInfForm({ ...infForm, seguidores: x })} type="number" />
            <Field label="Telefone" v={infForm.telefone} set={(x) => setInfForm({ ...infForm, telefone: x })} />
            <Field label="E-mail" v={infForm.email} set={(x) => setInfForm({ ...infForm, email: x })} />
            <Field label="Nicho" col2 v={infForm.nicho} set={(x) => setInfForm({ ...infForm, nicho: x })} ph="Ex: Moda, Fitness..." />
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Observação</Label>
              <Textarea value={infForm.observacao} onChange={(e) => setInfForm({ ...infForm, observacao: e.target.value })} rows={2} className="bg-secondary border-border resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfModal(false)} className="border-border">Cancelar</Button>
            <Button onClick={saveInfluencer} disabled={savingInf || !infForm.nome.trim()} className="gradient-button">
              {savingInf ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Parceria */}
      <Dialog open={partModal} onOpenChange={(v) => !v && setPartModal(false)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle>Nova Parceria</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Influencer *</Label>
                <Select value={partForm.influencer_id} onValueChange={(v) => setPartForm({ ...partForm, influencer_id: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{influencers.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente *</Label>
                <Select value={partForm.client_id} onValueChange={(v) => setPartForm({ ...partForm, client_id: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Field label="Título *" v={partForm.titulo} set={(x) => setPartForm({ ...partForm, titulo: x })} ph="Ex: Campanha Verão" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <Select value={partForm.tipo} onValueChange={(v) => setPartForm({ ...partForm, tipo: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {partForm.tipo !== "PERMUTA" && (
                <Field label="Cachê (R$)" v={partForm.cache_value} set={(x) => setPartForm({ ...partForm, cache_value: x })} type="number" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartModal(false)} className="border-border">Cancelar</Button>
            <Button onClick={savePartnership} disabled={savingPart} className="gradient-button">
              {savingPart ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe da parceria */}
      {detail && <PartnershipDetail partnership={detail} onClose={() => setDetail(null)} onChange={refreshDetail} />}
    </div>
  );
};

// Campo de input reutilizável
const Field = ({ label, v, set, ph, type, col2 }: any) => (
  <div className={`space-y-1.5 ${col2 ? "col-span-2" : ""}`}>
    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
    <Input type={type || "text"} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="bg-secondary border-border" />
  </div>
);

// ── Detalhe da parceria (produtos, entregáveis, vendas) ───────────────
const PartnershipDetail = ({ partnership, onClose, onChange }: any) => {
  const { toast } = useToast();
  const p = partnership;
  const brlf = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [prodNome, setProdNome] = useState(""); const [prodValor, setProdValor] = useState("");
  const [delTipo, setDelTipo] = useState("REEL"); const [delDesc, setDelDesc] = useState("");
  const [salesFor, setSalesFor] = useState<string | null>(null);
  const [saleVal, setSaleVal] = useState(""); const [saleQtd, setSaleQtd] = useState("1"); const [saleObs, setSaleObs] = useState("");

  const addProduct = async () => {
    if (!prodNome.trim()) return;
    await api.post(`/api/influencers/partnerships/${p.id}/products`, { nome: prodNome.trim(), valor: prodValor || null });
    setProdNome(""); setProdValor(""); onChange();
  };
  const setProductStatus = async (prod: any, status: string) => { await api.patch(`/api/influencers/products/${prod.id}`, { status }); onChange(); };
  const delProduct = async (prod: any) => { await api.delete(`/api/influencers/products/${prod.id}`); onChange(); };

  const addDeliverable = async () => {
    await api.post(`/api/influencers/partnerships/${p.id}/deliverables`, { tipo: delTipo, descricao: delDesc || null });
    setDelDesc(""); onChange();
  };
  const toggleDeliverable = async (d: any) => { await api.patch(`/api/influencers/deliverables/${d.id}`, { entregue: !d.entregue }); onChange(); };
  const setDeliverableLink = async (d: any, link: string) => { await api.patch(`/api/influencers/deliverables/${d.id}`, { link }); onChange(); };
  const delDeliverable = async (d: any) => { await api.delete(`/api/influencers/deliverables/${d.id}`); onChange(); };

  const addSale = async (did: string) => {
    await api.post(`/api/influencers/deliverables/${did}/sales`, { valor: saleVal || 0, quantidade: saleQtd || 1, observacao: saleObs || null });
    setSaleVal(""); setSaleQtd("1"); setSaleObs(""); onChange();
  };
  const delSale = async (sid: string) => { await api.delete(`/api/influencers/sales/${sid}`); onChange(); };

  const updateStatus = async (status: string) => {
    try { await api.put(`/api/influencers/partnerships/${p.id}`, { status }); onChange(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  const delPartnership = async () => {
    if (!confirm("Excluir esta parceria?")) return;
    await api.delete(`/api/influencers/partnerships/${p.id}`); onClose(); onChange();
  };

  const totalVendas = (p.deliverables || []).reduce((a: number, d: any) => a + (d.sales || []).reduce((s: number, x: any) => s + (x.valor || 0), 0), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-pink-400" /> {p.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">⭐ {p.influencer?.nome} · 🏢 {p.client?.name} · {TIPO_LABEL[p.tipo]}{p.cache_value ? ` · cachê ${brlf(p.cache_value)}` : ""}</p>
            <Select value={p.status} onValueChange={updateStatus}>
              <SelectTrigger className="bg-secondary border-border h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PARTNERSHIP_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Produtos recebidos */}
          <section>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2"><Package className="w-4 h-4 text-amber-400" /> Peças / Produtos recebidos</h3>
            <div className="space-y-1.5">
              {(p.products || []).map((prod: any) => (
                <div key={prod.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-2 py-1.5">
                  <span className="flex-1 text-sm text-foreground">{prod.nome}{prod.valor ? ` · ${brlf(prod.valor)}` : ""}</span>
                  <Select value={prod.status} onValueChange={(v) => setProductStatus(prod, v)}>
                    <SelectTrigger className="bg-secondary border-border h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PROD_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <button onClick={() => delProduct(prod)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={prodNome} onChange={(e) => setProdNome(e.target.value)} placeholder="Produto enviado" className="bg-secondary border-border text-sm" />
              <Input value={prodValor} onChange={(e) => setProdValor(e.target.value)} placeholder="Valor" type="number" className="bg-secondary border-border text-sm w-28" />
              <Button onClick={addProduct} disabled={!prodNome.trim()} size="sm" className="gradient-button"><Plus className="w-4 h-4" /></Button>
            </div>
          </section>

          {/* Entregáveis */}
          <section>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2"><Check className="w-4 h-4 text-green-400" /> Entregáveis</h3>
            <div className="space-y-2">
              {(p.deliverables || []).map((d: any) => {
                const vendasD = (d.sales || []).reduce((s: number, x: any) => s + (x.valor || 0), 0);
                return (
                  <div key={d.id} className="rounded-lg border border-border bg-secondary/30 p-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleDeliverable(d)} className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${d.entregue ? "bg-green-600 border-green-600" : "border-muted-foreground/40"}`}>
                        {d.entregue && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{d.tipo}</span>
                      <span className={`flex-1 text-sm ${d.entregue ? "text-foreground" : "text-muted-foreground"}`}>{d.descricao || "—"}</span>
                      <button onClick={() => delDeliverable(d)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pl-6">
                      <Link2 className="w-3 h-3 text-muted-foreground" />
                      <input defaultValue={d.link || ""} onBlur={(e) => e.target.value !== (d.link || "") && setDeliverableLink(d, e.target.value)}
                        placeholder="link da postagem" className="flex-1 bg-transparent border-b border-border/50 text-xs text-foreground outline-none" />
                    </div>
                    {/* Vendas do material */}
                    <div className="mt-2 pl-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-green-400 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Vendas: {brlf(vendasD)} {(d.sales?.length || 0) > 0 && `(${d.sales.length})`}</span>
                        <button onClick={() => setSalesFor(salesFor === d.id ? null : d.id)} className="text-[11px] text-primary hover:underline">{salesFor === d.id ? "fechar" : "+ venda"}</button>
                      </div>
                      {salesFor === d.id && (
                        <div className="mt-1.5 space-y-1.5">
                          {(d.sales || []).map((s: any) => (
                            <div key={s.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="flex-1">{brlf(s.valor)} · {s.quantidade}x{s.observacao ? ` · ${s.observacao}` : ""} · {new Date(s.sale_date).toLocaleDateString("pt-BR")}</span>
                              <button onClick={() => delSale(s.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <div className="flex gap-1.5">
                            <Input value={saleVal} onChange={(e) => setSaleVal(e.target.value)} placeholder="Valor" type="number" className="bg-secondary border-border h-7 text-xs" />
                            <Input value={saleQtd} onChange={(e) => setSaleQtd(e.target.value)} placeholder="Qtd" type="number" className="bg-secondary border-border h-7 text-xs w-16" />
                            <Input value={saleObs} onChange={(e) => setSaleObs(e.target.value)} placeholder="Obs" className="bg-secondary border-border h-7 text-xs" />
                            <Button onClick={() => addSale(d.id)} size="sm" className="gradient-button h-7 px-2"><Plus className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <Select value={delTipo} onValueChange={setDelTipo}>
                <SelectTrigger className="bg-secondary border-border w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{DELIVERABLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={delDesc} onChange={(e) => setDelDesc(e.target.value)} placeholder="Descrição (opcional)" className="bg-secondary border-border text-sm" />
              <Button onClick={addDeliverable} size="sm" className="gradient-button"><Plus className="w-4 h-4" /></Button>
            </div>
          </section>

          {totalVendas > 0 && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total de vendas geradas por esta parceria</p>
              <p className="text-lg font-bold text-green-400">{brlf(totalVendas)}</p>
            </div>
          )}

          <button onClick={delPartnership} className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> Excluir parceria
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Influencers;
