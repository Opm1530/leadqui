import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, LogOut, CheckCircle2, Clock, AlertCircle, Calendar, MousePointerClick,
  Receipt, ThumbsUp, ChevronRight, Loader2, RefreshCw, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const TASK_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  PENDENTE:     { label: "Pendente",      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  EM_ANDAMENTO: { label: "Em Andamento",  color: "text-blue-400 bg-blue-500/10 border-blue-500/20",      icon: RefreshCw },
  REVISAO:      { label: "Em Revisão",    color: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: AlertCircle },
  CONCLUIDO:    { label: "Concluído",     color: "text-green-400 bg-green-500/10 border-green-500/20",   icon: CheckCircle2 },
  CANCELADO:    { label: "Cancelado",     color: "text-gray-500 bg-gray-500/10 border-gray-500/20",      icon: XCircle },
};

const POST_TYPE_COLOR: Record<string, string> = {
  POST:       "bg-blue-500",
  STORY:      "bg-pink-500",
  REEL:       "bg-purple-500",
  CARROSSEL:  "bg-orange-500",
  AD:         "bg-yellow-500",
};

const POST_STATUS: Record<string, { label: string; color: string }> = {
  PLANEJADO:   { label: "Planejado",   color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
  PRODUZINDO:  { label: "Produzindo",  color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  APROVADO:    { label: "Aprovado",    color: "text-green-400 bg-green-500/10 border-green-500/20" },
  PUBLICADO:   { label: "Publicado",   color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  PENDENTE:   { label: "Pendente",   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  PAGO:       { label: "Pago",       color: "text-green-400 bg-green-500/10 border-green-500/20" },
  ATRASADO:   { label: "Atrasado",   color: "text-red-400 bg-red-500/10 border-red-500/20" },
  CANCELADO:  { label: "Cancelado",  color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const ViewQui = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("tasks");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/viewqui/dashboard");
      setData(res);
    } catch (err: any) {
      const msg = err?.message || "Erro ao carregar portal";
      setError(msg);
      toast({ title: "Erro ao carregar portal", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (postId: string) => {
    try {
      await api.patch(`/api/viewqui/calendar/${postId}/approve`, {});
      toast({ title: "Post aprovado!" });
      load();
    } catch {
      toast({ title: "Erro ao aprovar post", variant: "destructive" });
    }
  };

  // Dados com fallback seguro — evita crash quando data é null
  const tasks            = data?.tasks            ?? [];
  const calendarPosts    = data?.calendarPosts    ?? [];
  const trafficCampaigns = data?.trafficCampaigns ?? [];
  const invoices         = data?.invoices         ?? [];

  const sections = [
    { id: "tasks",    label: "Tarefas",       icon: CheckCircle2,     count: tasks.length },
    { id: "calendar", label: "Calendário",    icon: Calendar,          count: calendarPosts.length },
    { id: "traffic",  label: "Tráfego Pago",  icon: MousePointerClick, count: trafficCampaigns.length },
    { id: "invoices", label: "Faturas",       icon: Receipt,           count: invoices.length },
  ];

  const pendingApproval = calendarPosts.filter(
    (p: any) => p.status === "PLANEJADO" || p.status === "PRODUZINDO"
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">Portal do Cliente</span>
            <p className="text-sm font-bold text-white leading-none">
              {loading ? "Carregando..." : data?.client?.name || user?.email || "Meu Portal"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/hub")}
            className="text-xs text-gray-500 hover:text-white transition-colors hidden sm:block"
          >
            Hub
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-gray-500 hover:text-white gap-2 h-8"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </Button>
        </div>
      </header>

      {/* Estado: carregando */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-gray-500 font-medium animate-pulse">Carregando seu portal...</p>
        </div>
      )}

      {/* Estado: erro */}
      {!loading && error && (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-black text-white">Não foi possível carregar o portal</h2>
          <p className="text-sm text-gray-500">{error}</p>
          <Button onClick={load} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Estado: carregado */}
      {!loading && !error && (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

          {/* Alerta de posts pendentes de aprovação */}
          {pendingApproval.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium cursor-pointer hover:bg-indigo-500/15 transition-colors"
              onClick={() => setActiveSection("calendar")}
            >
              <ThumbsUp className="w-5 h-5 shrink-0 text-indigo-400" />
              <span>
                <strong>{pendingApproval.length}</strong> post(s) aguardando sua aprovação no Calendário Editorial
              </span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </motion.div>
          )}

          {/* Navegação entre seções */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${
                  activeSection === s.id
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    : "text-gray-500 border-white/5 hover:border-white/15 hover:text-gray-300"
                }`}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
                {s.count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    activeSection === s.id ? "bg-indigo-500/30 text-indigo-300" : "bg-white/5 text-gray-500"
                  }`}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TAREFAS ── */}
          {activeSection === "tasks" && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">Suas Tarefas</h2>
              {tasks.length === 0 ? (
                <EmptyState icon={CheckCircle2} msg="Nenhuma tarefa encontrada" />
              ) : (
                <div className="space-y-4">
                  {(["EM_ANDAMENTO", "PENDENTE", "REVISAO", "CONCLUIDO", "CANCELADO"] as string[]).map(status => {
                    const group = tasks.filter((t: any) => t.status === status);
                    if (!group.length) return null;
                    const cfg = TASK_STATUS[status];
                    const Icon = cfg?.icon ?? Clock;
                    return (
                      <div key={status} className="space-y-2">
                        <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest px-1 ${cfg?.color.split(" ")[0]}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg?.label} ({group.length})
                        </div>
                        {group.map((task: any, i: number) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-white truncate">{task.title}</p>
                              <p className="text-xs text-gray-500">
                                {task.project?.name}
                                {task.due_date && <span> · vence {fmtDate(task.due_date)}</span>}
                                {task.responsible?.name && <span> · {task.responsible.name}</span>}
                              </p>
                            </div>
                            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg?.color}`}>
                              {cfg?.label}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CALENDÁRIO EDITORIAL ── */}
          {activeSection === "calendar" && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">Calendário Editorial — Este Mês</h2>
              {calendarPosts.length === 0 ? (
                <EmptyState icon={Calendar} msg="Nenhum post agendado este mês" />
              ) : (
                <div className="space-y-2">
                  {calendarPosts.map((post: any, i: number) => {
                    const statusCfg = POST_STATUS[post.status] ?? POST_STATUS.PLANEJADO;
                    const canApprove = post.status === "PLANEJADO" || post.status === "PRODUZINDO";
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${POST_TYPE_COLOR[post.type] ?? "bg-gray-500"}`} />
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-white truncate">{post.title}</p>
                            <p className="text-xs text-gray-500">
                              {fmtDate(post.scheduled_date)} · {post.type} · {post.platform}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          {canApprove && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(post.id)}
                              className="h-8 gap-1 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30"
                            >
                              <ThumbsUp className="w-3 h-3" />
                              Aprovar
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TRÁFEGO PAGO ── */}
          {activeSection === "traffic" && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">Campanhas de Tráfego Pago</h2>
              {trafficCampaigns.length === 0 ? (
                <EmptyState icon={MousePointerClick} msg="Nenhuma campanha ativa" />
              ) : (
                <div className="space-y-2">
                  {trafficCampaigns.map((c: any, i: number) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="bg-white/3 border border-white/5 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{c.name}</p>
                          <p className="text-xs text-gray-500">
                            {c.start_date && <span>{fmtDate(c.start_date)}</span>}
                            {c.end_date && <span> até {fmtDate(c.end_date)}</span>}
                            {!c.start_date && !c.end_date && <span>Sem período definido</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {c.budget != null && (
                            <p className="font-black text-sm text-green-400">{fmt(c.budget)}</p>
                          )}
                          <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            Ativo
                          </span>
                        </div>
                      </div>
                      {c.objective && (
                        <p className="text-xs text-gray-600 mt-2 truncate">{c.objective}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FATURAS ── */}
          {activeSection === "invoices" && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">Suas Faturas</h2>
              {invoices.length === 0 ? (
                <EmptyState icon={Receipt} msg="Nenhuma fatura encontrada" />
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv: any, i: number) => {
                    const statusCfg = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.PENDENTE;
                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">
                            {inv.description || "Mensalidade"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Vence em {fmtDate(inv.due_date)}
                            {inv.paid_date && <span> · Pago em {fmtDate(inv.paid_date)}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="font-black text-base text-white">{fmt(inv.amount)}</p>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, msg }: { icon: any; msg: string }) => (
  <div className="text-center py-16 text-gray-600">
    <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
    <p className="font-medium">{msg}</p>
  </div>
);

export default ViewQui;
