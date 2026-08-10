import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Users, User, MessageCircle, Search } from "lucide-react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";

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
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(() => api.get("/api/inbox/conversations").then(d => setConvs(d.conversations || [])).catch(() => {}), []);
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
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..." className="pl-8 h-9 bg-secondary border-border text-sm" />
            </div>
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
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{convName(selected)}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.client_name ? `${selected.client_name} · ` : ""}via {selected.instance}</p>
                </div>
              </div>
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.from_me ? "bg-emerald-600/20 border border-emerald-600/30" : "bg-secondary/60 border border-border"}`}>
                      {!m.from_me && selected.is_group && m.author_name && <p className="text-[10px] font-bold text-blue-300 mb-0.5">{m.author_name}</p>}
                      {m.from_me && m.author_name && <p className="text-[10px] font-bold text-emerald-300 mb-0.5">{m.author_name}</p>}
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="text-[9px] text-muted-foreground text-right mt-0.5">{fmtTime(m.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder="Escreva uma mensagem..."
                  className="flex-1 bg-secondary border-border"
                />
                <button onClick={enviar} disabled={sending || !text.trim()} className="h-10 w-10 rounded-lg gradient-button flex items-center justify-center disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
