import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Copy, Trash2, Code2, RefreshCw, Loader2, Webhook, Power, Check, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Base pública da API (em prod VITE_API_URL="" → usa a origem do site)
const API_BASE = (import.meta.env.VITE_API_URL as string) || window.location.origin;
const urlFor = (token: string) => `${API_BASE}/api/forms/${token}`;

const snippetFor = (token: string) => `<form action="${urlFor(token)}" method="POST">
  <input type="text"  name="nome"     placeholder="Seu nome"   required />
  <input type="email" name="email"    placeholder="Seu e-mail" />
  <input type="tel"   name="telefone" placeholder="WhatsApp"   />
  <textarea name="mensagem" placeholder="Mensagem"></textarea>
  <!-- anti-spam: não remova, mantenha escondido -->
  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Enviar</button>
</form>`;

const Formularios = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState("");
  const [snippet, setSnippet] = useState<any>(null); // endpoint aberto no modal
  const [editing, setEditing] = useState<any>(null); // endpoint em edição

  const load = () => api.get("/api/form-endpoints").then(d => setEndpoints(d.endpoints || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => {
    load();
    api.get("/api/tags").then(d => setTags(d.tags || d || [])).catch(() => {});
    api.get("/api/teamqui").then(d => setTeam(Array.isArray(d) ? d : (d.team || []))).catch(() => {});
  }, []);

  const criar = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/form-endpoints", { name: newName.trim() });
      setNewName("");
      await load();
      toast({ title: "Formulário criado!" });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const toggle = async (ep: any) => {
    setEndpoints(p => p.map(x => x.id === ep.id ? { ...x, active: !x.active } : x));
    await api.patch(`/api/form-endpoints/${ep.id}`, { active: !ep.active }).catch(() => load());
  };

  const excluir = async (ep: any) => {
    if (!confirm(`Excluir o formulário "${ep.name}"? As submissões também serão removidas.`)) return;
    setEndpoints(p => p.filter(x => x.id !== ep.id));
    await api.delete(`/api/form-endpoints/${ep.id}`).catch(() => load());
  };

  const rotate = async (ep: any) => {
    if (!confirm("Gerar um novo link? O link antigo deixa de funcionar imediatamente.")) return;
    const d = await api.post(`/api/form-endpoints/${ep.id}/rotate`, {}).catch(() => null);
    if (d?.endpoint) { setEndpoints(p => p.map(x => x.id === ep.id ? d.endpoint : x)); toast({ title: "Novo link gerado!" }); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(""), 1500);
  };

  const salvarEdicao = async () => {
    if (!editing) return;
    const d = await api.patch(`/api/form-endpoints/${editing.id}`, {
      name: editing.name,
      default_tag_ids: editing.default_tag_ids || [],
      default_responsavel: editing.default_responsavel || null,
      redirect_url: editing.redirect_url || null,
    }).catch(() => null);
    if (d?.endpoint) { setEndpoints(p => p.map(x => x.id === editing.id ? d.endpoint : x)); setEditing(null); toast({ title: "Salvo!" }); }
  };

  const toggleEditTag = (tagId: string) => {
    setEditing((e: any) => {
      const cur: string[] = e.default_tag_ids || [];
      return { ...e, default_tag_ids: cur.includes(tagId) ? cur.filter(t => t !== tagId) : [...cur, tagId] };
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Webhook className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Formulários & Webhooks</h1>
            <p className="text-sm text-muted-foreground">Receba contatos de landing pages e formulários direto na sua lista de Leads.</p>
          </div>
        </div>

        {/* Criar */}
        <div className="glass-card p-4 mt-6 flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") criar(); }}
            placeholder="Nome do formulário (ex.: LP Black Friday)" className="flex-1 bg-secondary border-border" />
          <Button onClick={criar} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Criar</>}
          </Button>
        </div>

        {/* Lista */}
        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : endpoints.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">Nenhum formulário ainda. Crie o primeiro acima.</p>
          ) : endpoints.map(ep => (
            <div key={ep.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ep.active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <h3 className="font-semibold text-foreground truncate">{ep.name}</h3>
                    <span className="text-[11px] text-muted-foreground">· {ep.submissions_count || 0} envios</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-xs text-muted-foreground bg-secondary rounded px-2 py-1 truncate max-w-full">{urlFor(ep.token)}</code>
                    <button onClick={() => copy(urlFor(ep.token), ep.id)} title="Copiar URL" className="text-muted-foreground hover:text-foreground shrink-0">
                      {copied === ep.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSnippet(ep)}><Code2 className="w-4 h-4 mr-1" /> Código</Button>
                <Button variant="secondary" size="sm" onClick={() => setEditing({ ...ep })}>Configurar</Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(ep)}><Power className="w-4 h-4 mr-1" /> {ep.active ? "Desativar" : "Ativar"}</Button>
                <Button variant="ghost" size="sm" onClick={() => rotate(ep)}><RefreshCw className="w-4 h-4 mr-1" /> Novo link</Button>
                <Button variant="ghost" size="sm" onClick={() => excluir(ep)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: código/snippet */}
      <Dialog open={!!snippet} onOpenChange={o => !o && setSnippet(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Como usar — {snippet?.name}</DialogTitle></DialogHeader>
          {snippet && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">URL do webhook (POST — JSON ou form)</span>
                  <button onClick={() => copy(urlFor(snippet.token), "u")} className="text-xs text-primary flex items-center gap-1">
                    {copied === "u" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} copiar
                  </button>
                </div>
                <code className="block text-xs bg-secondary rounded-lg p-2 break-all">{urlFor(snippet.token)}</code>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Formulário HTML pronto (cole na sua landing)</span>
                  <button onClick={() => copy(snippetFor(snippet.token), "s")} className="text-xs text-primary flex items-center gap-1">
                    {copied === "s" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} copiar
                  </button>
                </div>
                <pre className="text-[11px] bg-secondary rounded-lg p-3 overflow-x-auto whitespace-pre">{snippetFor(snippet.token)}</pre>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Também aceita JSON (Zapier, Make, Elementor Webhook): mande <code>{"{ nome, email, telefone, mensagem }"}</code> via POST.
                Campos aceitos incluem variações como name/phone/whatsapp/celular.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: configurar */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configurar formulário</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Tags padrão (aplicadas em todo lead que entrar)</label>
                <div className="flex flex-wrap gap-2">
                  {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</span>}
                  {tags.map((t: any) => {
                    const on = (editing.default_tag_ids || []).includes(t.id);
                    return (
                      <button key={t.id} onClick={() => toggleEditTag(t.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "border-transparent text-white" : "border-border text-muted-foreground"}`}
                        style={on ? { backgroundColor: t.color || "#10b981" } : {}}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsável padrão</label>
                <select value={editing.default_responsavel || ""} onChange={e => setEditing({ ...editing, default_responsavel: e.target.value })}
                  className="w-full h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground">
                  <option value="">— nenhum —</option>
                  {team.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">Redirecionar após enviar <ExternalLink className="w-3 h-3" /></label>
                <Input value={editing.redirect_url || ""} onChange={e => setEditing({ ...editing, redirect_url: e.target.value })} placeholder="https://seusite.com/obrigado (opcional)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Formularios;
