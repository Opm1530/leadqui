import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const TYPES = ["POST", "STORY", "REEL", "CARROSSEL", "AD"];
const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"];
const STATUS: Record<string, { label: string; color: string }> = {
  PLANEJADO: { label: "Planejado", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  PRODUZINDO: { label: "Produzindo", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  ARTE_PRONTA: { label: "Arte pronta", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  AGUARDANDO_APROVACAO: { label: "Aguardando cliente", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  APROVADO: { label: "Aprovado", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  PUBLICADO: { label: "Publicado", color: "bg-green-500/20 text-green-300 border-green-500/30" },
};
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function ClientCalendar({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayModal, setDayModal] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get(`/api/tasqui/calendar?client_id=${clientId}&month=${month + 1}&year=${year}`)
      .then(d => setPosts(Array.isArray(d) ? d : (d.posts || [])))
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [clientId, month, year]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const postsOfDay = (d: number) => posts.filter(p => new Date(p.scheduled_date).getUTCDate() === d && new Date(p.scheduled_date).getUTCMonth() === month);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</h2>
        <div className="flex gap-1">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(d => <div key={d} className="text-[10px] font-bold text-muted-foreground text-center py-1">{d}</div>)}
          {cells.map((day, i) => (
            <div key={i} onClick={() => day && setDayModal(day)}
              className={`min-h-[72px] rounded-lg p-1 ${day ? "bg-secondary/30 hover:bg-secondary/50 cursor-pointer" : ""}`}>
              {day && <span className="text-[11px] font-bold text-muted-foreground">{day}</span>}
              <div className="space-y-0.5 mt-0.5">
                {day && postsOfDay(day).slice(0, 3).map(p => (
                  <div key={p.id} onClick={e => { e.stopPropagation(); setDetail(p); }}
                    className={`text-[9px] font-bold px-1 py-0.5 rounded truncate border ${STATUS[p.status]?.color}`}>
                    {p.title || `${p.type}`}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Criar card no dia */}
      {dayModal !== null && (
        <CreatePost clientId={clientId} day={dayModal} month={month} year={year}
          onClose={() => setDayModal(null)} onSaved={() => { setDayModal(null); load(); }} toast={toast} />
      )}

      {/* Detalhe / editar */}
      {detail && (
        <PostDetail post={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load(); }} toast={toast} />
      )}
    </div>
  );
}

function CreatePost({ clientId, day, month, year, onClose, onSaved, toast }: any) {
  const [type, setType] = useState("POST");
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const salvar = async () => {
    setSaving(true);
    try {
      await api.post("/api/tasqui/calendar", { client_id: clientId, title: title || null, content: content || null, type, platform, scheduled_date: dateStr, status: "PLANEJADO" });
      toast({ title: "Card criado!" });
      onSaved();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle>Novo conteúdo · {day}/{month + 1}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Formato</Label>
              <Select value={type} onValueChange={setType}><SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-widest">Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional)" className="bg-secondary border-border" />
          <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Legenda / briefing" rows={3} className="bg-secondary border-border resize-none" />
          <Button onClick={salvar} disabled={saving} className="w-full gradient-button">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PostDetail({ post, onClose, onChanged, toast }: any) {
  const [title, setTitle] = useState(post.title || "");
  const [content, setContent] = useState(post.content || "");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    try { await api.patch(`/api/tasqui/calendar/${post.id}`, { title, content }); toast({ title: "Salvo!" }); onChanged(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const mudarStatus = async (status: string) => {
    try { await api.patch(`/api/tasqui/calendar/${post.id}`, { status }); onChanged(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  const remover = async () => {
    if (!confirm("Remover este post?")) return;
    try { await api.delete(`/api/tasqui/calendar/${post.id}`); onChanged(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle>{post.type} · {new Date(post.scheduled_date).toLocaleDateString("pt-BR")}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" className="bg-secondary border-border" />
          <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Legenda / briefing" rows={4} className="bg-secondary border-border resize-none" />
          <Button onClick={salvar} disabled={saving} size="sm" className="w-full gradient-button">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar conteúdo"}</Button>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">Status</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {Object.entries(STATUS).map(([k, c]) => (
                <button key={k} onClick={() => mudarStatus(k)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${post.status === k ? c.color : "border-border text-muted-foreground hover:border-white/20"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={remover} className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Remover post</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
