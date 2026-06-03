import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import api from "@/lib/api";

const TYPES = ["POST", "STORY", "REEL", "CARROSSEL", "AD"];
const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANEJADO:  { label: "Planejado",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  PRODUZINDO: { label: "Produzindo", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  APROVADO:   { label: "Aprovado",   color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  PUBLICADO:  { label: "Publicado",  color: "bg-green-500/20 text-green-300 border-green-500/30" },
};

const TYPE_COLOR: Record<string, string> = {
  POST:      "bg-blue-500",
  STORY:     "bg-pink-500",
  REEL:      "bg-purple-500",
  CARROSSEL: "bg-orange-500",
  AD:        "bg-red-500",
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_LABEL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TasquiCalendar = () => {
  const { setActiveModule } = useModule();
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [form, setForm] = useState({
    client_id: "", title: "", content: "", type: "POST",
    platform: "INSTAGRAM", scheduled_date: "", status: "PLANEJADO",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [postsData, clientsData] = await Promise.all([
        api.get(`/api/tasqui/calendar?month=${month + 1}&year=${year}`),
        api.get("/api/clients"),
      ]);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setClients(clientsData.clients || []);
    } catch {
      toast({ title: "Erro ao carregar calendário", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setActiveModule("tasqui");
    load();
  }, [month, year]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Construir grade do calendário
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const filteredPosts = filterClient === "all" ? posts : posts.filter(p => p.client_id === filterClient);

  const postsForDay = (day: number) => {
    return filteredPosts.filter(p => new Date(p.scheduled_date).getDate() === day);
  };

  const openCreate = (day?: number) => {
    const d = day || new Date().getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setForm(f => ({ ...f, scheduled_date: dateStr, client_id: filterClient === "all" ? "" : filterClient }));
    setSelectedDay(day || null);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.client_id || !form.title || !form.scheduled_date) {
      toast({ title: "Preencha cliente, título e data.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/tasqui/calendar", form);
      toast({ title: "Post adicionado ao calendário!" });
      setModalOpen(false);
      setForm({ client_id: "", title: "", content: "", type: "POST", platform: "INSTAGRAM", scheduled_date: "", status: "PLANEJADO" });
      load();
    } catch {
      toast({ title: "Erro ao criar post", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/api/tasqui/calendar/${id}`, { status });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      if (detailPost?.id === id) setDetailPost((p: any) => ({ ...p, status }));
      toast({ title: "Status atualizado!" });
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/tasqui/calendar/${id}`);
      toast({ title: "Post removido." });
      setDetailPost(null);
      load();
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Calendário Editorial</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredPosts.length} post(s) em {MONTHS_LABEL[month]}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44 bg-secondary border-border h-9">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => openCreate()} className="gradient-button gap-2 h-9">
            <Plus className="w-4 h-4" /> Novo Post
          </Button>
        </div>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-black text-foreground min-w-40 text-center">
          {MONTHS_LABEL[month]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Grade */}
      {loading ? (
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header dias da semana */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>

          {/* Células */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayPosts = day ? postsForDay(day) : [];
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              return (
                <div
                  key={i}
                  onClick={() => day && openCreate(day)}
                  className={`min-h-[100px] p-2 border-b border-r border-border/50 transition-colors cursor-pointer group ${
                    day ? "hover:bg-white/5" : "opacity-30 pointer-events-none"
                  }`}
                >
                  {day && (
                    <>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black mb-1 ${
                        isToday ? "bg-blue-500 text-white" : "text-muted-foreground group-hover:text-white"
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map(post => (
                          <div
                            key={post.id}
                            onClick={e => { e.stopPropagation(); setDetailPost(post); }}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 border ${STATUS_CONFIG[post.status]?.color}`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${TYPE_COLOR[post.type]}`} />
                            {post.title}
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="text-[9px] text-muted-foreground font-bold pl-1">+{dayPosts.length - 3} mais</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda tipos */}
      <div className="flex flex-wrap gap-3">
        {TYPES.map(t => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span className={`w-2 h-2 rounded-full ${TYPE_COLOR[t]}`} />
            {t}
          </span>
        ))}
      </div>

      {/* Modal criar post */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Novo Post no Calendário</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Post Dia das Mães" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Plataforma</Label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data *</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="bg-secondary border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Legenda / Briefing</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder="Descreva o conteúdo do post..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe do post */}
      <AnimatePresence>
        {detailPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setDetailPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${TYPE_COLOR[detailPost.type]}`} />
                    <span className="text-xs font-bold text-muted-foreground">{detailPost.type} · {detailPost.platform}</span>
                  </div>
                  <h3 className="text-lg font-black text-foreground">{detailPost.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{detailPost.client?.name} · {new Date(detailPost.scheduled_date).toLocaleDateString("pt-BR")}</p>
                </div>
                <button onClick={() => setDetailPost(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {detailPost.content && (
                <p className="text-sm text-muted-foreground bg-secondary/50 rounded-xl p-3">{detailPost.content}</p>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(detailPost.id, key)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        detailPost.status === key ? cfg.color : "border-border text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => handleDelete(detailPost.id)}
                className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                Remover Post
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TasquiCalendar;
