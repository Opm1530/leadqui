import { useState, useRef } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle, Eye, Loader2, Clapperboard } from "lucide-react";
import { backgroundUpload } from "@/contexts/UploadContext";
import { CONTENT_STATUS, typeLabel } from "@/lib/editorial";

interface Props {
  items: any[];
  userId?: string;
  onChanged: () => void;
  onOpen: (c: any) => void;
}

const fmt = (d?: string) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

export default function MinhaProducao({ items, userId, onChanged, onOpen }: Props) {
  const mine = items.filter(i => i.responsible_id === userId);
  const precisa = mine.filter(i => ["EM_PRODUCAO", "AJUSTES"].includes(i.status));
  const aprovacao = mine.filter(i => i.status === "EM_APROVACAO");
  const prontos = mine.filter(i => ["AGUARDANDO_POSTAR", "POSTADO"].includes(i.status));

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (mine.length === 0) return null;

  const pick = (it: any) => { setPending(it); fileRef.current?.click(); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; const it = pending; e.target.value = ""; setPending(null);
    if (!f || !it) return;
    setBusyId(it.id);
    try {
      const fd = new FormData(); fd.append("file", f);
      await backgroundUpload(`/api/editorial/${it.id}/submit`, fd, f.name);
      onChanged();
    } finally { setBusyId(null); }
  };

  const Meta = ({ it }: { it: any }) => (
    <span className="text-[11px] text-muted-foreground">
      {it.client?.name || "—"} · {typeLabel(it.content_type)}{fmt(it.scheduled_date) ? ` · ${fmt(it.scheduled_date)}` : ""}
    </span>
  );

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 mb-5">
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
      <div className="flex items-center gap-2 mb-3">
        <Clapperboard className="w-4 h-4 text-fuchsia-400" />
        <h2 className="text-sm font-bold text-foreground">Minha produção</h2>
      </div>

      {/* Precisa da sua arte */}
      {precisa.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-2 flex items-center gap-1"><Upload className="w-3 h-3" /> Precisa da sua arte ({precisa.length})</p>
          <div className="space-y-2">
            {precisa.map(it => {
              const isAjuste = it.status === "AJUSTES";
              return (
                <div key={it.id} className={`rounded-xl border p-3 ${isAjuste ? "border-red-500/20 bg-red-500/5" : "border-blue-500/20 bg-blue-500/5"}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onOpen(it)} className="text-left"><p className="text-sm font-medium text-foreground truncate hover:underline">{it.title}</p></button>
                      <div><Meta it={it} /></div>
                    </div>
                    <button onClick={() => pick(it)} disabled={busyId === it.id}
                      className="flex items-center gap-2 px-3 h-9 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90 disabled:opacity-60 shrink-0">
                      {busyId === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {isAjuste ? "Reenviar arte" : "Subir arte"}
                    </button>
                  </div>
                  {isAjuste && it.feedback && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-200 bg-red-500/10 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="whitespace-pre-wrap">Ajuste pedido: {it.feedback}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aguardando aprovação */}
      {aprovacao.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-purple-300 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Enviado — aguardando aprovação ({aprovacao.length})</p>
          <div className="space-y-2">
            {aprovacao.map(it => (
              <button key={it.id} onClick={() => onOpen(it)} className="w-full text-left flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2.5 hover:bg-purple-500/10 transition">
                <CheckCircle2 className="w-4 h-4 text-purple-300 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{it.title}</p><Meta it={it} /></div>
                <span className="text-[11px] text-purple-300 flex items-center gap-1 shrink-0"><Eye className="w-3.5 h-3.5" /> ver arte</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prontos / postados */}
      {prontos.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-green-300 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Aprovados ({prontos.length})</p>
          <div className="space-y-1.5">
            {prontos.map(it => {
              const st = CONTENT_STATUS[it.status];
              return (
                <button key={it.id} onClick={() => onOpen(it)} className="w-full text-left flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2 hover:bg-secondary/60 transition">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{it.title}</p><Meta it={it} /></div>
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
