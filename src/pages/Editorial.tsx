import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, CalendarDays, List, ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import api from "@/lib/api";
import { useRole } from "@/hooks/useRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_STATUS, STATUS_ORDER, typeLabel } from "@/lib/editorial";
import EditorialFormModal from "@/components/EditorialFormModal";
import EditorialDetailModal from "@/components/EditorialDetailModal";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const parseDate = (s?: string) => s ? new Date(s) : null;

const Editorial = () => {
  const navigate = useNavigate();
  const { isAdmin, role } = useRole();
  const canManage = isAdmin || role === "MANAGER";

  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [listGroup, setListGroup] = useState<"day" | "week" | "month">("day");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const [fClient, setFClient] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [selected, setSelected] = useState<any>(null);

  const load = () => {
    const qs = new URLSearchParams();
    if (fClient !== "all") qs.set("clientId", fClient);
    if (fResp !== "all") qs.set("responsibleId", fResp);
    if (fStatus !== "all") qs.set("status", fStatus);
    return api.get(`/api/editorial${qs.toString() ? "?" + qs.toString() : ""}`).then(setItems).catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      api.get("/api/clients").then(d => setClients(d.clients || [])).catch(() => {}),
      api.get("/api/teamqui").then(setTeam).catch(() => {}),
    ]).finally(() => {});
  }, []);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [fClient, fResp, fStatus]);

  const refresh = () => { load(); setSelected(null); };
  // Mantém o conteúdo selecionado atualizado após uma ação
  useEffect(() => {
    if (selected) { const fresh = items.find(i => i.id === selected.id); if (fresh) setSelected(fresh); }
  }, [items]); // eslint-disable-line

  const openNew = (date?: string) => { setEditing(null); setDefaultDate(date || ""); setFormOpen(true); };
  const openEdit = (c: any) => { setSelected(null); setEditing(c); setDefaultDate(""); setFormOpen(true); };

  // ── Calendário ──────────────────────────────────────────────────────
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // volta até domingo
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    return days;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const it of items) {
      const d = parseDate(it.scheduled_date);
      if (!d) continue;
      const k = dayKey(d);
      (map[k] ||= []).push(it);
    }
    return map;
  }, [items]);

  const noDate = useMemo(() => items.filter(i => !i.scheduled_date), [items]);

  const moveMonth = (delta: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  // ── Lista agrupada ──────────────────────────────────────────────────
  const groups = useMemo(() => {
    let list = [...items];
    // day/week respeitam o mês do cursor; month agrupa tudo
    if (listGroup !== "month") {
      list = list.filter(i => {
        const d = parseDate(i.scheduled_date);
        return d && d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
      });
    }
    const withDate = list.filter(i => i.scheduled_date).sort((a, b) => +new Date(a.scheduled_date) - +new Date(b.scheduled_date));
    const out: { key: string; label: string; items: any[] }[] = [];
    const push = (key: string, label: string, it: any) => {
      let g = out.find(o => o.key === key);
      if (!g) { g = { key, label, items: [] }; out.push(g); }
      g.items.push(it);
    };
    for (const it of withDate) {
      const d = new Date(it.scheduled_date);
      if (listGroup === "day") push(dayKey(d), d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }), it);
      else if (listGroup === "week") {
        const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        push(dayKey(ws), `Semana de ${ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${we.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`, it);
      } else push(`${d.getFullYear()}-${d.getMonth()}`, `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`, it);
    }
    // itens sem data ao final (só quando não filtra por mês, ou sempre em "month")
    const noDateItems = list.filter(i => !i.scheduled_date);
    if (noDateItems.length) out.push({ key: "no-date", label: "Sem data agendada", items: noDateItems });
    return out;
  }, [items, listGroup, cursor]);

  const filtersBar = (
    <div className="flex flex-wrap gap-2">
      <Select value={fClient} onValueChange={setFClient}>
        <SelectTrigger className="h-9 w-40 bg-secondary border-border text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={fResp} onValueChange={setFResp}>
        <SelectTrigger className="h-9 w-40 bg-secondary border-border text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos responsáveis</SelectItem>{team.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-40 bg-secondary border-border text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos os status</SelectItem>{STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{CONTENT_STATUS[s].label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const Chip = ({ it }: { it: any }) => {
    const st = CONTENT_STATUS[it.status] || CONTENT_STATUS.IDEIA;
    return (
      <button onClick={() => setSelected(it)} className={`w-full text-left px-1.5 py-1 rounded-md border ${st.color} truncate flex items-center gap-1 text-[10px] leading-tight hover:brightness-125 transition`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} /> <span className="truncate">{it.title}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
          <Clapperboard className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Editorial</h1>
          <p className="text-muted-foreground text-sm">Planejamento e produção de conteúdos, sincronizado com as tarefas.</p>
        </div>
        {canManage && (
          <button onClick={() => openNew()} className="flex items-center gap-2 px-4 h-10 rounded-xl gradient-button font-bold text-sm">
            <Plus className="w-4 h-4" /> Novo conteúdo
          </button>
        )}
      </div>

      {/* Barra de controle */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/70"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-foreground capitalize w-40 text-center">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
          <button onClick={() => moveMonth(1)} className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/70"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="text-xs text-muted-foreground hover:text-foreground ml-1">hoje</button>
        </div>

        <div className="flex items-center gap-2">
          {view === "list" && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["day", "week", "month"] as const).map(g => (
                <button key={g} onClick={() => setListGroup(g)} className={`px-3 h-9 ${listGroup === g ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-muted-foreground"}`}>
                  {g === "day" ? "Dia" : g === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          )}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("calendar")} className={`px-3 h-9 flex items-center gap-1 text-xs ${view === "calendar" ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-muted-foreground"}`}><CalendarDays className="w-4 h-4" /> Calendário</button>
            <button onClick={() => setView("list")} className={`px-3 h-9 flex items-center gap-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-muted-foreground"}`}><List className="w-4 h-4" /> Lista</button>
          </div>
        </div>
      </div>

      <div className="mb-4">{filtersBar}</div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : view === "calendar" ? (
        <>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border bg-border">
            {WEEKDAYS.map(w => <div key={w} className="bg-card text-center py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{w}</div>)}
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = dayKey(d) === dayKey(new Date());
              const dayItems = byDay[dayKey(d)] || [];
              return (
                <div key={i} className={`bg-card min-h-[104px] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "opacity-40"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center" : "text-muted-foreground"}`}>{d.getDate()}</span>
                    {canManage && inMonth && (
                      <button onClick={() => openNew(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}
                        className="opacity-0 hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-primary transition"><Plus className="w-3 h-3" /></button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayItems.slice(0, 4).map(it => <Chip key={it.id} it={it} />)}
                    {dayItems.length > 4 && <span className="text-[10px] text-muted-foreground pl-1">+{dayItems.length - 4} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {noDate.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Sem data agendada ({noDate.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">{noDate.map(it => <Chip key={it.id} it={it} />)}</div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {groups.length === 0 && <p className="text-sm text-muted-foreground py-16 text-center">Nenhum conteúdo neste período.</p>}
          {groups.map(g => (
            <div key={g.key}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 capitalize">{g.label} <span className="text-muted-foreground/60">· {g.items.length}</span></p>
              <div className="space-y-2">
                {g.items.map(it => {
                  const st = CONTENT_STATUS[it.status] || CONTENT_STATUS.IDEIA;
                  return (
                    <button key={it.id} onClick={() => setSelected(it)} className="w-full text-left flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:bg-white/[0.02] transition">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{it.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{it.client?.name || "—"} · {typeLabel(it.content_type)}{it.responsible?.name ? ` · ${it.responsible.name}` : ""}</p>
                      </div>
                      {it.scheduled_date && <span className="text-[11px] text-muted-foreground shrink-0">{new Date(it.scheduled_date).toLocaleDateString("pt-BR")}</span>}
                      <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditorialFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} clients={clients} team={team} editing={editing} defaultDate={defaultDate} />
      <EditorialDetailModal content={selected} isOpen={!!selected} onClose={() => setSelected(null)} onChanged={refresh} onEdit={openEdit} />
    </div>
  );
};

export default Editorial;
