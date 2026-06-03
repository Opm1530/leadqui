import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellRing, Receipt, CheckCircle2, AlertTriangle,
  Calendar, X, CheckCheck, Trash2,
} from "lucide-react";
import api from "@/lib/api";

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  FATURA_ATRASADA:       { icon: Receipt,       color: "text-red-400",    bg: "bg-red-500/10" },
  TAREFA_VENCIDA:        { icon: CheckCircle2,   color: "text-orange-400", bg: "bg-orange-500/10" },
  DESPESA_FIXA_VENCENDO: { icon: AlertTriangle,  color: "text-yellow-400", bg: "bg-yellow-500/10" },
  POST_APROVACAO:        { icon: Calendar,        color: "text-blue-400",   bg: "bg-blue-500/10" },
};

const fmtTime = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}min atrás`;
  if (hours < 24)  return `${hours}h atrás`;
  return `${days}d atrás`;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await api.get("/api/notifications");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silencioso */ }
  };

  // Polling a cada 60s para manter badge atualizado
  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) load(); // refresh ao abrir
  };

  const markRead = async (id: string, link?: string) => {
    await api.patch(`/api/notifications/${id}/read`, {}).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (link) { setOpen(false); navigate(link); }
  };

  const markAllRead = async () => {
    setLoading(true);
    await api.patch("/api/notifications/read-all", {}).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const deleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.delete(`/api/notifications/${id}`).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => {
      const notif = notifications.find(n => n.id === id);
      return notif && !notif.read ? Math.max(0, prev - 1) : prev;
    });
  };

  const clearRead = async () => {
    await api.delete("/api/notifications/clear-all").catch(() => {});
    setNotifications(prev => prev.filter(n => !n.read));
  };

  const hasRead = notifications.some(n => n.read);

  return (
    <div ref={ref} className="relative">
      {/* Botão sino */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
      >
        {unreadCount > 0
          ? <BellRing className="w-5 h-5 text-orange-400 animate-[wiggle_1s_ease-in-out]" />
          : <Bell className="w-5 h-5" />
        }
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 max-h-[520px] flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-black text-foreground">Notificações</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                  </button>
                )}
                {hasRead && (
                  <button
                    onClick={clearRead}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Bell className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((n, i) => {
                  const cfg = TYPE_CFG[n.type] || TYPE_CFG.FATURA_ATRASADA;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => markRead(n.id, n.link)}
                      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/3 group relative ${
                        !n.read ? "bg-white/3" : "opacity-60"
                      }`}
                    >
                      {/* Dot não lido */}
                      {!n.read && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400" />
                      )}

                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">{fmtTime(n.created_at)}</p>
                      </div>

                      <button
                        onClick={(e) => deleteNotif(e, n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 p-1 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
