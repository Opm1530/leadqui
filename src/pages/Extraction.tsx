import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Instagram, CheckCircle, Clock, XCircle, History, Tag as TagIcon, Loader2, Trash2 } from "lucide-react";
import api from "@/lib/api";

type ExtractionType = "GOOGLE_MAPS" | "INSTAGRAM";

const STATUS_BADGES: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  PENDENTE:     { label: "Pendente",     cls: "bg-blue-500/20 text-blue-400",   icon: Clock },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-yellow-500/20 text-yellow-400", icon: Loader2 },
  CONCLUIDO:    { label: "Concluído",    cls: "bg-green-500/20 text-green-400", icon: CheckCircle },
  ERRO:         { label: "Erro",         cls: "bg-red-500/20 text-red-400",     icon: XCircle },
  PARADO:       { label: "Interrompido", cls: "bg-gray-500/20 text-gray-400",   icon: XCircle },
};

const COLORS = [
  "#3B82F6","#EF4444","#10B981","#F59E0B","#8B5CF6","#EC4899",
  "#06B6D4","#F97316","#14B8A6","#6366F1","#A855F7","#EAB308",
];

const Extraction = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<ExtractionType>("GOOGLE_MAPS");

  // Form fields
  const [categoria, setCategoria] = useState("");
  const [cidade, setCidade] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [quantidade, setQuantidade] = useState("50");
  const [loading, setLoading] = useState(false);

  // API keys check
  const [hasSerperKey, setHasSerperKey] = useState<boolean | null>(null);
  const [hasApifyKey, setHasApifyKey] = useState<boolean | null>(null);

  // Tags
  const [tags, setTags] = useState<any[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(COLORS[0]);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState<any>(null);
  const HISTORY_PER_PAGE = 5;

  // ── Fetch settings & tags ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    api.get("/api/settings").then((d) => {
      setHasSerperKey(!!d.settings?.serper_api_key);
      setHasApifyKey(!!d.settings?.apify_api_key);
    }).catch(() => { setHasSerperKey(false); setHasApifyKey(false); });

    api.get("/api/tags").then((d) => setTags(d.tags || [])).catch(console.error);
  }, [user]);

  // ── Fetch history ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.get("/api/extractions?limit=20");
      setHistory(data.extractions || []);
    } catch {}
  }, []);

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Excluir esta extração do histórico?")) return;
    try {
      await api.delete(`/api/extractions/${id}`);
      setHistory((prev) => prev.filter((ex) => ex.id !== id));
      toast({ title: "Extração excluída!" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => { if (user) fetchHistory(); }, [user, fetchHistory]);

  // ── Poll active extraction ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/api/extractions/${activeId}`);
        const ext = data.extraction;
        setActiveProgress(ext);
        setHistory((prev) => prev.map((h) => h.id === ext.id ? ext : h));
        if (ext.status !== "EM_ANDAMENTO" && ext.status !== "PENDENTE") {
          clearInterval(interval);
          setLoading(false);
          setActiveId(null);
          setActiveProgress(null);
          if (ext.status === "CONCLUIDO") {
            toast({ title: "Extração concluída!", description: `${ext.total_leads || 0} leads processados.` });
          } else if (ext.status === "ERRO") {
            toast({ title: "Erro na extração", description: ext.erro || "Falha", variant: "destructive" });
          }
          fetchHistory();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeId, toast, fetchHistory]);

  // ── Create tag ──────────────────────────────────────────────────────────────
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const data = await api.post("/api/tags", { nome: newTagName.trim(), cor: newTagColor });
      setTags((prev) => [...prev, data.tag]);
      setSelectedTagId(data.tag.id);
      setIsCreatingTag(false);
      setNewTagName("");
      toast({ title: "Tag criada!" });
    } catch (error: any) {
      toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" });
    }
  };

  // ── Submit extraction ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (type === "GOOGLE_MAPS" && hasSerperKey === false) {
      toast({ title: "Configuração ausente", description: "Configure a Serper API Key primeiro em Configurações.", variant: "destructive" });
      return;
    }
    if (type === "INSTAGRAM" && hasApifyKey === false) {
      toast({ title: "Configuração ausente", description: "Configure a Apify API Key primeiro em Configurações.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = type === "GOOGLE_MAPS"
        ? { tipo: "GOOGLE_MAPS", categoria, cidade, quantidade: Number(quantidade), tag_id: selectedTagId || null }
        : { tipo: "INSTAGRAM", hashtag: hashtag.replace(/^#/, ""), quantidade: Number(quantidade), tag_id: selectedTagId || null };

      const data = await api.post("/api/extractions", payload);
      setActiveId(data.extraction.id);
      setHistory((prev) => [data.extraction, ...prev]);
      toast({ title: "Extração iniciada!" });
    } catch (error: any) {
      toast({ title: "Erro ao iniciar", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeId) return;
    try {
      await api.put(`/api/extractions/${activeId}`, { status: "PARADO" });
      setLoading(false);
      setActiveId(null);
      setActiveProgress(null);
      fetchHistory();
    } catch {}
  };

  const totalPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);
  const currentKeyMissing = type === "GOOGLE_MAPS" ? hasSerperKey === false : hasApifyKey === false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Extração de Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">Capture leads do Google Maps ou Instagram</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          {/* Type toggle */}
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl mb-6">
            {(["GOOGLE_MAPS", "INSTAGRAM"] as ExtractionType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${type === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "GOOGLE_MAPS" ? <><MapPin className="w-4 h-4" /> Google Maps</> : <><Instagram className="w-4 h-4" /> Instagram</>}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {type === "GOOGLE_MAPS" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Categoria</Label>
                  <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Restaurante" className="bg-secondary/50" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: São Paulo" className="bg-secondary/50" required />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Hashtag (sem #)</Label>
                <Input value={hashtag} onChange={(e) => setHashtag(e.target.value.replace(/^#/, ""))} placeholder="Ex: fitness" className="bg-secondary/50" required />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Quantidade (1–100)</Label>
              <Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min={1} max={100} className="bg-secondary/50" />
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> Tag da extração (opcional)
              </Label>
              {!isCreatingTag ? (
                <select value={selectedTagId} onChange={(e) => e.target.value === "new" ? setIsCreatingTag(true) : setSelectedTagId(e.target.value)} className="w-full bg-secondary/50 rounded-md border-border h-10 px-3 text-sm outline-none text-foreground">
                  <option value="">Sem tag</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  <option value="new">+ Criar nova tag</option>
                </select>
              ) : (
                <div className="glass-card p-3 space-y-3 border-primary/20">
                  <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da tag..." className="h-8 text-sm" autoFocus />
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map((c) => <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full ${newTagColor === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`} style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreateTag} disabled={!newTagName.trim()} className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md disabled:opacity-50">Salvar</button>
                    <button type="button" onClick={() => setIsCreatingTag(false)} className="flex-1 bg-secondary text-xs py-1.5 rounded-md">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Progress */}
            {loading && activeProgress && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0" />
                  <p className="text-sm text-yellow-400 font-medium">{activeProgress.step_message || "Processando..."}</p>
                </div>
                {activeProgress.total_leads > 0 && (
                  <p className="text-xs text-muted-foreground">{activeProgress.total_leads} leads capturados</p>
                )}
              </div>
            )}

            {currentKeyMissing && (
              <p className="text-xs text-destructive">⚠️ Configure a chave de API necessária em Configurações para usar este extrator.</p>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={loading || currentKeyMissing === true} className="flex-1 py-3 gradient-button rounded-lg disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Processando..." : "Iniciar Extração"}
              </button>
              {loading && (
                <button type="button" onClick={handleStop} className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium">
                  Parar
                </button>
              )}
            </div>
          </form>
        </motion.div>

        {/* History */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Histórico</h3>
          </div>
          <div className="space-y-2">
            {paginatedHistory.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">Nenhuma extração realizada ainda.</div>
            ) : (
              paginatedHistory.map((ex, i) => {
                const badge = STATUS_BADGES[ex.status] || STATUS_BADGES.PENDENTE;
                const BadgeIcon = badge.icon;
                const params = typeof ex.parametros === "string" ? JSON.parse(ex.parametros) : (ex.parametros || {});
                return (
                  <motion.div key={ex.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        {ex.tipo === "GOOGLE_MAPS" ? <MapPin className="w-5 h-5 text-blue-400" /> : <Instagram className="w-5 h-5 text-purple-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {ex.tipo === "GOOGLE_MAPS" ? `${params.categoria || "—"} em ${params.cidade || "—"}` : `#${params.hashtag || "—"}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ex.total_leads || 0} leads · {ex.created_at ? new Date(ex.created_at).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                        <BadgeIcon className={`w-3 h-3 ${ex.status === "EM_ANDAMENTO" ? "animate-spin" : ""}`} /> {badge.label}
                      </div>
                      <button onClick={() => handleDeleteHistory(ex.id)} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" title="Excluir do histórico">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <button disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)} className="p-1 px-3 bg-secondary rounded-md text-xs disabled:opacity-30">Anterior</button>
                <span className="text-xs text-muted-foreground flex items-center">{historyPage} / {totalPages}</span>
                <button disabled={historyPage === totalPages} onClick={() => setHistoryPage((p) => p + 1)} className="p-1 px-3 bg-secondary rounded-md text-xs disabled:opacity-30">Próximo</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Extraction;
