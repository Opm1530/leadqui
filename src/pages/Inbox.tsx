import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Users, User, MessageCircle, Search, Archive, ArchiveRestore, Paperclip, Tag as TagIcon, Plus, Mic, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import InboxMedia from "@/components/InboxMedia";

const TAG_COLORS = ["#10b981", "#3b82f6", "#f97316", "#ef4444", "#a855f7", "#eab308", "#ec4899", "#14b8a6", "#64748b"];

const convName = (c: any) => c?.name || (c?.is_group ? "Grupo" : (c?.chat_jid || "").replace(/@.*/, "")) || "Conversa";
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const Inbox = () => {
  const navigate = useNavigate();
  const [convs, setConvs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [fTag, setFTag] = useState("all");
  const [tagMenu, setTagMenu] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachMenu, setAttachMenu] = useState(false);
  const [attachMode, setAttachMode] = useState<"media" | "document">("media");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const recTimerRef = useRef<number | null>(null);
  const [tagModal, setTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const loadConvs = useCallback(() => {
    const qs = new URLSearchParams();
    if (showArchived) qs.set("archived", "1");
    if (fTag !== "all") qs.set("tag", fTag);
    return api.get(`/api/inbox/conversations${qs.toString() ? "?" + qs.toString() : ""}`).then(d => setConvs(d.conversations || [])).catch(() => {});
  }, [showArchived, fTag]);
  const loadMessages = useCallback((id: string) => api.get(`/api/inbox/conversations/${id}/messages`).then(d => setMessages(d.messages || [])).catch(() => {}), []);

  useEffect(() => { setLoading(true); loadConvs().finally(() => setLoading(false)); }, [loadConvs]);
  // Poll das conversas
  useEffect(() => { const t = setInterval(loadConvs, 6000); return () => clearInterval(t); }, [loadConvs]);
  // Poll das mensagens da conversa aberta
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const t = setInterval(() => loadMessages(selected.id), 4000);
    return () => clearInterval(t);
  }, [selected?.id, loadMessages]);
  // Rola pro fim quando chegam mensagens
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages]);

  const abrir = async (c: any) => {
    setSelected(c);
    setMessages([]);
    setTagMenu(false);
    if (c.unread > 0) {
      setConvs(p => p.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
      api.post(`/api/inbox/conversations/${c.id}/read`, {}).catch(() => {});
    }
  };

  const enviar = async () => {
    if (!text.trim() || !selected) return;
    const t = text.trim();
    setText(""); setSending(true);
    try {
      await api.post(`/api/inbox/conversations/${selected.id}/send`, { text: t });
      await loadMessages(selected.id);
      loadConvs();
    } catch (e: any) {
      setText(t); // devolve o texto se falhar
    } finally { setSending(false); }
  };

  const arquivar = async (c: any, archived: boolean) => {
    setConvs(p => p.filter(x => x.id !== c.id));
    if (selected?.id === c.id) setSelected(null);
    await api.post(`/api/inbox/conversations/${c.id}/archive`, { archived }).catch(() => loadConvs());
  };

  const pickAttach = (mode: "media" | "document") => { setAttachMode(mode); setAttachMenu(false); setTimeout(() => fileRef.current?.click(), 0); };
  const enviarMidia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !selected) return;
    setSending(true);
    try {
      const fd = new FormData(); fd.append("file", f); if (text.trim()) fd.append("caption", text.trim());
      if (attachMode === "document") fd.append("mediatype", "document");
      await api.post(`/api/inbox/conversations/${selected.id}/send-media`, fd);
      setText("");
      await loadMessages(selected.id); loadConvs();
    } catch { /* */ } finally { setSending(false); }
  };

  // Gravação de áudio (mensagem de voz)
  const startRec = async () => {
    if (!selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = []; discardRef.current = false;
      mr.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/ogg" });
        if (blob.size === 0) return;
        setSending(true);
        try { const fd = new FormData(); fd.append("file", blob, "audio.ogg"); await api.post(`/api/inbox/conversations/${selected.id}/send-audio`, fd); await loadMessages(selected.id); loadConvs(); }
        catch { /* */ } finally { setSending(false); }
      };
      mr.start(); recRef.current = mr; setRecording(true);
      setRecSecs(0);
      recTimerRef.current = window.setInterval(() => setRecSecs(s => s + 1), 1000);
    } catch { /* microfone negado */ }
  };
  const stopRec = (discard: boolean) => {
    discardRef.current = discard;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    recRef.current?.stop(); setRecording(false);
  };
  const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const salvarTag = async () => {
    if (!newTagName.trim()) return;
    const d = await api.post("/api/inbox/tags", { name: newTagName.trim(), color: newTagColor }).catch(() => null);
    if (d?.tag) setTags(p => [...p, d.tag]);
    setNewTagName(""); setNewTagColor(TAG_COLORS[0]); setTagModal(false);
  };

  // Tags
  useEffect(() => { api.get("/api/inbox/tags").then(d => setTags(d.tags || [])).catch(() => {}); }, []);
  const toggleTag = async (tagId: string) => {
    if (!selected) return;
    const cur: string[] = selected.tag_ids || [];
    const next = cur.includes(tagId) ? cur.filter(t => t !== tagId) : [...cur, tagId];
    const sel = { ...selected, tag_ids: next, tags: tags.filter(t => next.includes(t.id)) };
    setSelected(sel);
    setConvs(p => p.map(c => c.id === selected.id ? sel : c));
    await api.post(`/api/inbox/conversations/${selected.id}/tags`, { tag_ids: next }).catch(() => {});
  };

  const filtered = convs.filter(c => !search || convName(c).toLowerCase().includes(search.toLowerCase()) || (c.client_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conversas (WhatsApp)</h1>
          <p className="text-muted-foreground text-sm">Central de atendimento — toda a equipe responde por aqui.</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Lista de conversas */}
        <div className="w-80 shrink-0 flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..." className="pl-8 h-9 bg-secondary border-border text-sm" />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setFTag("all")} className={`text-[10px] px-2 py-0.5 rounded-full border ${fTag === "all" ? "bg-white/10 text-foreground border-white/20" : "border-border text-muted-foreground"}`}>Todas</button>
                {tags.map(t => (
                  <button key={t.id} onClick={() => setFTag(t.id)} className={`text-[10px] px-2 py-0.5 rounded-full border ${fTag === t.id ? "text-white" : "text-muted-foreground border-border"}`} style={fTag === t.id ? { backgroundColor: t.color, borderColor: t.color } : {}}>{t.name}</button>
                ))}
              </div>
            )}
            <button onClick={() => { setShowArchived(v => !v); setSelected(null); }} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Archive className="w-3 h-3" /> {showArchived ? "← Ver ativas" : "Ver arquivadas"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-10 text-center px-4">Nenhuma conversa ainda. As mensagens recebidas nos grupos/números conectados aparecem aqui.</p>
            : filtered.map(c => (
              <button key={c.id} onClick={() => abrir(c)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-border/50 hover:bg-white/[0.03] transition ${selected?.id === c.id ? "bg-white/[0.05]" : ""}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c.is_group ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {c.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{convName(c)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtDay(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground truncate">{c.client_name ? `${c.client_name} · ` : ""}{c.last_message_text || ""}</p>
                    {c.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>}
                  </div>
                  {(c.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.tags.map((t: any) => <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Selecione uma conversa</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                {selected.is_group ? <Users className="w-4 h-4 text-blue-300" /> : <User className="w-4 h-4 text-emerald-300" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{convName(selected)}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.client_name ? `${selected.client_name} · ` : ""}via {selected.instance}</p>
                </div>
                <div className="relative shrink-0">
                  <button onClick={() => setTagMenu(v => !v)} title="Tags" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"><TagIcon className="w-4 h-4" /></button>
                  {tagMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-border bg-card shadow-2xl z-20 p-2 space-y-1">
                      {tags.length === 0 && <p className="text-[11px] text-muted-foreground px-2 py-1">Nenhuma tag ainda.</p>}
                      {tags.map(t => {
                        const on = (selected.tag_ids || []).includes(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTag(t.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                            <span className="text-xs text-foreground flex-1">{t.name}</span>
                            {on && <span className="text-[10px] text-green-400">✓</span>}
                          </button>
                        );
                      })}
                      <button onClick={() => { setTagMenu(false); setTagModal(true); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left text-xs text-primary"><Plus className="w-3.5 h-3.5" /> Nova tag</button>
                    </div>
                  )}
                </div>
                <button onClick={() => arquivar(selected, !showArchived)} title={showArchived ? "Desarquivar" : "Arquivar conversa"}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0">
                  {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
              </div>
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.from_me ? "bg-emerald-600/20 border border-emerald-600/30" : "bg-secondary/60 border border-border"}`}>
                      {!m.from_me && selected.is_group && m.author_name && <p className="text-[10px] font-bold text-blue-300 mb-0.5">{m.author_name}</p>}
                      {m.from_me && m.author_name && <p className="text-[10px] font-bold text-emerald-300 mb-0.5">{m.author_name}</p>}
                      {m.media_type && (m.media_key ? <div className="mb-1"><InboxMedia messageId={m.id} type={m.media_type} name={m.media_name} /></div> : <p className="text-xs italic text-muted-foreground mb-1">[{m.media_type}]</p>)}
                      {m.text && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.text}</p>}
                      <p className="text-[9px] text-muted-foreground text-right mt-0.5">{fmtTime(m.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={enviarMidia} />
                {recording ? (
                  <>
                    <button onClick={() => stopRec(true)} title="Cancelar" className="h-10 w-10 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 shrink-0"><Trash2 className="w-5 h-5" /></button>
                    <div className="flex-1 h-10 rounded-full bg-secondary border border-border flex items-center gap-3 px-4">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-sm text-foreground tabular-nums font-medium">{fmtRec(recSecs)}</span>
                      <div className="flex-1 flex items-center gap-[3px] h-5 overflow-hidden">
                        {Array.from({ length: 28 }).map((_, i) => (
                          <span key={i} className="w-[3px] rounded-full bg-emerald-400/70 rec-wave" style={{ animationDelay: `${(i % 7) * 0.12}s` }} />
                        ))}
                      </div>
                    </div>
                    <button onClick={() => stopRec(false)} title="Enviar áudio" className="h-10 w-10 rounded-full gradient-button flex items-center justify-center shrink-0"><Send className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <button onClick={() => setAttachMenu(v => !v)} disabled={sending} title="Anexar" className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      </button>
                      {attachMenu && (
                        <div className="absolute left-0 bottom-full mb-1 w-48 rounded-xl border border-border bg-card shadow-2xl z-20 p-1">
                          <button onClick={() => pickAttach("media")} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left text-xs text-foreground"><ImageIcon className="w-4 h-4 text-emerald-400" /> Foto / Vídeo (mídia)</button>
                          <button onClick={() => pickAttach("document")} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left text-xs text-foreground"><FileText className="w-4 h-4 text-blue-400" /> Enviar como documento</button>
                        </div>
                      )}
                    </div>
                    <Input
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Escreva uma mensagem..."
                      className="flex-1 bg-secondary border-border"
                    />
                    {text.trim() ? (
                      <button onClick={enviar} disabled={sending} className="h-10 w-10 rounded-lg gradient-button flex items-center justify-center disabled:opacity-50">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    ) : (
                      <button onClick={startRec} disabled={sending} title="Gravar áudio" className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-emerald-400 disabled:opacity-50">
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de criação de tag */}
      <Dialog open={tagModal} onOpenChange={setTagModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex.: Urgente" onKeyDown={e => { if (e.key === "Enter") salvarTag(); }} autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)} style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-transform ${newTagColor === c ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : "hover:scale-105"}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagModal(false)}>Cancelar</Button>
            <Button onClick={salvarTag} disabled={!newTagName.trim()}>Criar tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inbox;
