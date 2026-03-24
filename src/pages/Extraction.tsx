import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { firestoreService } from "@/lib/firestore";
import { MapPin, Instagram, AlertCircle, CheckCircle, Clock, XCircle, History, Tag as TagIcon, Plus } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import { functions } from "@/integrations/firebase/functions";
import TagBadge from "@/components/TagBadge";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type ExtractionType = "google_maps" | "instagram";

const STATUS_BADGES: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  em_andamento: { label: "Em andamento", cls: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  concluido:    { label: "Concluído",    cls: "bg-green-500/20 text-green-400",   icon: CheckCircle },
  erro:         { label: "Erro",         cls: "bg-red-500/20 text-red-400",       icon: XCircle },
  parado:       { label: "Interrompido", cls: "bg-gray-500/20 text-gray-400",      icon: XCircle },
};

const Extraction = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<ExtractionType>("google_maps");

  // Google Maps fields
  const [categoria, setCategoria] = useState("");
  const [cidade, setCidade] = useState("");

  // Instagram fields
  const [hashtag, setHashtag] = useState("");

  const [quantidade, setQuantidade] = useState("50");
  const [loading, setLoading] = useState(false);
  const [activeExtracaoId, setActiveExtracaoId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  // Config check
  const [hasSerperKey, setHasSerperKey] = useState<boolean | null>(null);
  const [hasApifyKey, setHasApifyKey] = useState<boolean | null>(null);

  // Tags
  const [tags, setTags] = useState<{id: string, nome: string, cor: string}[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");

  const COLORS = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899",
    "#06B6D4", "#F97316", "#14B8A6", "#6366F1", "#A855F7", "#EAB308"
  ];

  // History Pagination
  const [history, setHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 3;

  // Check API keys
  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      const q = query(collection(db, "configuracoes"), where("user_id", "==", user.uid), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setHasSerperKey(!!data.serper_api_key);
        setHasApifyKey(!!data.apify_api_key);
      } else {
        setHasSerperKey(false);
        setHasApifyKey(false);
      }
    };
    fetchConfig();
  }, [user]);

  // Fetch Tags
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tags"), where("user_id", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      setTags(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsub();
  }, [user]);

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !user) return;
    try {
      const docRef = await addDoc(collection(db, "tags"), {
        nome: newTagName.trim(),
        cor: newTagColor,
        user_id: user.uid,
        created_at: serverTimestamp(),
      });
      setSelectedTagId(docRef.id);
      setIsCreatingTag(false);
      setNewTagName("");
      toast({ title: "Tag criada com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao criar tag", variant: "destructive" });
    }
  };

  // Real-time history
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "extracoes"),
      where("user_id", "==", user.uid),
      orderBy("created_at", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        created_at: d.data().created_at?.toDate?.()?.toISOString() || d.data().created_at,
      })));
    });
    return () => unsub();
  }, [user]);

  const totalHistoryPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);

  // Re-attach to active extraction
  useEffect(() => {
    if (history.length > 0 && !activeExtracaoId) {
      const active = history.find(ex => ex.status === "em_andamento");
      if (active) {
        setActiveExtracaoId(active.id);
        setLoading(true);
      }
    }
  }, [history, activeExtracaoId]);

  // Watch active extraction document
  useEffect(() => {
    if (!activeExtracaoId) return;
    const unsub = onSnapshot(doc(db, "extracoes", activeExtracaoId), (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        setActiveExtracaoId(null);
        return;
      }
      const data = snap.data();
      setActiveStatus(data.status);
      
      if (data.status !== "em_andamento") {
        setLoading(false);
        setActiveExtracaoId(null);
        
        if (data.status === "concluido") {
             toast({ title: "Extração concluída!", description: `${data.total_leads || 0} leads processados.` });
        } else if (data.status === "erro") {
             toast({ title: "Erro na extração", description: data.erro || "Falha técnica", variant: "destructive" });
        }
      }
    });
    return () => unsub();
  }, [activeExtracaoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (type === "google_maps" && !hasSerperKey) {
      toast({ title: "Configuração ausente", description: "Configure a Serper API Key primeiro.", variant: "destructive" });
      return;
    }
    if (type === "instagram" && !hasApifyKey) {
      toast({ title: "Configuração ausente", description: "Configure a Apify API Key primeiro.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = type === "google_maps" 
        ? { categoria, cidade, quantidade: Number(quantidade) } 
        : { hashtag: hashtag.replace(/^#/, ""), quantidade: Number(quantidade) };

      const exRef = await addDoc(collection(db, "extracoes"), {
        user_id: user.uid,
        tipo: type,
        status: "em_andamento",
        parametros: payload,
        total: Number(quantidade),
        progresso: 0,
        total_leads: 0,
        tag_id: selectedTagId || null,
        step_message: "Iniciando...",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      setActiveExtracaoId(exRef.id);

      const fn = httpsCallable(functions, type === "google_maps" ? "extractGoogleMaps" : "extractInstagram");
      fn({ ...payload, userId: user.uid, extracaoId: exRef.id, tagId: selectedTagId || null }).catch(err => {
        console.error("Cloud Function failed:", err);
      });

      toast({ title: "Extração iniciada!" });
    } catch (error: any) {
      toast({ title: "Erro ao iniciar", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const currentKeyMissing = type === "google_maps" ? hasSerperKey === false : hasApifyKey === false;

  const RenderProgress = () => {
    const [snapData, setSnapData] = useState<any>(null);

    useEffect(() => {
      if (!activeExtracaoId) return;
      return onSnapshot(doc(db, "extracoes", activeExtracaoId), (d) => setSnapData(d.data()));
    }, [activeExtracaoId]);

    if (!snapData || snapData.status !== "em_andamento") return null;

    const prog = snapData.progresso || 0;
    const tot = snapData.total || 0;
    const percent = tot > 0 ? Math.min(Math.round((prog / tot) * 100), 100) : 0;

    return (
      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-yellow-400 font-medium">{snapData.step_message || "Processando..."}</p>
        </div>
        {tot > 0 && (
          <div className="space-y-1">
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground text-right">{percent}% concluído</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extração de Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Capture leads do Google Maps ou Instagram</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl mb-6">
            <button onClick={() => setType("google_maps")} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${type === "google_maps" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
              <MapPin className="w-4 h-4" /> Google Maps
            </button>
            <button onClick={() => setType("instagram")} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${type === "instagram" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
              <Instagram className="w-4 h-4" /> Instagram
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {type === "google_maps" ? (
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
                <TagIcon className="w-3 h-3" /> Tag da extração (Opcional)
              </Label>
              {!isCreatingTag ? (
                <select value={selectedTagId} onChange={(e) => e.target.value === "new" ? setIsCreatingTag(true) : setSelectedTagId(e.target.value)} className="w-full bg-secondary/50 rounded-md border-border h-10 px-3 text-sm outline-none">
                  <option value="">Sem tag</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  <option value="new">+ Criar nova tag</option>
                </select>
              ) : (
                <div className="glass-card p-3 space-y-3 border-primary/20">
                  <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da tag..." className="h-8 text-sm" autoFocus />
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map(c => <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full ${newTagColor === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`} style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreateTag} disabled={!newTagName.trim()} className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md">Salvar</button>
                    <button type="button" onClick={() => setIsCreatingTag(false)} className="flex-1 bg-secondary text-xs py-1.5 rounded-md">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {loading && <RenderProgress />}

            <div className="flex gap-2">
              <button type="submit" disabled={loading || currentKeyMissing} className="flex-1 py-3 gradient-button rounded-lg disabled:opacity-50 text-sm font-medium">
                {loading ? "Processando..." : "Iniciar Extração"}
              </button>
              {loading && activeExtracaoId && (
                <button type="button" onClick={async () => { await updateDoc(doc(db, "extracoes", activeExtracaoId), { status: "parado" }); setLoading(false); }} className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium">Interromper</button>
              )}
            </div>
          </form>
        </motion.div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Histórico</h3>
          </div>

          <div className="space-y-2">
            {paginatedHistory.map((ex, i) => {
              const badge = STATUS_BADGES[ex.status] || STATUS_BADGES["em_andamento"];
              const BadgeIcon = badge.icon;
              return (
                <motion.div key={ex.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      {ex.tipo === "google_maps" ? <MapPin className="w-5 h-5 text-blue-400" /> : <Instagram className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{ex.tipo === "google_maps" ? `${ex.parametros?.categoria} em ${ex.parametros?.cidade}` : `#${ex.parametros?.hashtag}`}</p>
                      <p className="text-xs text-muted-foreground">{ex.total_leads || 0} leads · {ex.created_at ? new Date(ex.created_at).toLocaleDateString("pt-BR") : "—"}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                    <BadgeIcon className="w-3 h-3" /> {badge.label}
                  </div>
                </motion.div>
              );
            })}
            {totalHistoryPages > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <button disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)} className="p-1 px-3 bg-secondary rounded-md text-xs disabled:opacity-30">Anterior</button>
                <span className="text-xs text-muted-foreground flex items-center">{historyPage} / {totalHistoryPages}</span>
                <button disabled={historyPage === totalHistoryPages} onClick={() => setHistoryPage(p => p + 1)} className="p-1 px-3 bg-secondary rounded-md text-xs disabled:opacity-30">Próximo</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Extraction;
