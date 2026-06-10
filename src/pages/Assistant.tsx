import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
  Sparkles, Send, Loader2, CheckCircle, XCircle, Terminal, Bot, User as UserIcon, ArrowLeft, Trash2,
} from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; proposals?: any[]; }

const STORAGE_KEY = "pequi_assistant_chat";

const SUGESTOES = [
  "Buscar o cliente Up Fit",
  "Cria um Reels sobre treino de pernas para o cliente X no dia 15",
  "Mostra o calendário do cliente X em junho",
  "Manda o post de dia 15 para produção",
];

const Assistant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [doneProposals, setDoneProposals] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Persiste a conversa no navegador (sobrevive a trocar de aba / recarregar)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  const limparConversa = () => {
    setMessages([]);
    setDoneProposals(new Set());
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const payload = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const d = await api.post("/api/assistant/chat", { messages: payload });
      setMessages(m => [...m, { role: "assistant", content: d.reply || "", proposals: d.proposals || [] }]);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setMessages(m => [...m, { role: "assistant", content: "⚠️ " + e.message }]);
    } finally { setLoading(false); }
  };

  const confirmar = async (proposal: any) => {
    setExecuting(proposal.id);
    try {
      const d = await api.post("/api/assistant/execute", { type: proposal.type, payload: proposal.payload });
      setDoneProposals(s => new Set(s).add(proposal.id));
      setMessages(m => [...m, { role: "assistant", content: "✅ " + (d.message || "Feito!") + (d.trello_url ? `\n🔗 ${d.trello_url}` : "") }]);
    } catch (e: any) {
      toast({ title: "Erro ao executar", description: e.message, variant: "destructive" });
    } finally { setExecuting(null); }
  };

  const rejeitar = (proposal: any) => {
    setDoneProposals(s => new Set(s).add(proposal.id));
    setMessages(m => [...m, { role: "assistant", content: "Ação cancelada." }]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto px-6 py-6">
      {/* Voltar ao Hub */}
      <button
        onClick={() => navigate("/hub")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Assistente</h1>
          <p className="text-muted-foreground text-sm">Fale o que precisa — o agente executa no ecossistema</p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={limparConversa}
            className="h-8 text-xs border-border text-muted-foreground hover:text-foreground">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Conversa */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <Terminal className="w-12 h-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm text-muted-foreground mb-3">Comece com um comando:</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGESTOES.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] ${m.role === "user" ? "order-1" : ""}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}>
                {m.content}
              </div>

              {/* Cards de proposta para confirmar */}
              {m.proposals?.map((p: any) => (
                <div key={p.id} className="mt-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <p className="text-xs text-foreground mb-2">⚡ {p.label}</p>
                  {doneProposals.has(p.id) ? (
                    <p className="text-[11px] text-muted-foreground">Resolvido</p>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmar(p)} disabled={executing === p.id}
                        className="h-7 text-xs bg-green-600 hover:bg-green-700">
                        {executing === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejeitar(p)}
                        className="h-7 text-xs border-red-500/30 text-red-400">
                        <XCircle className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 order-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-secondary rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ex: cria o calendário do cliente Up Fit para junho..."
          className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} className="gradient-button px-5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default Assistant;
