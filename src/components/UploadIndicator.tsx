import { useUploads } from "@/contexts/UploadContext";
import { CheckCircle2, XCircle, X, Loader2 } from "lucide-react";

// Anel de progresso circular
const Ring = ({ value, status }: { value: number; status: string }) => {
  const r = 13, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color = status === "error" ? "#f87171" : status === "done" ? "#4ade80" : "#fb923c";
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
      <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
      <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 17 17)" style={{ transition: "stroke-dashoffset .2s" }} />
      <text x="17" y="20" textAnchor="middle" className="fill-current text-foreground" style={{ fontSize: 9, fontWeight: 700 }}>
        {status === "uploading" ? `${value}` : ""}
      </text>
    </svg>
  );
};

export default function UploadIndicator() {
  const { uploads, dismiss } = useUploads();
  if (uploads.length === 0) return null;
  const active = uploads.filter(u => u.status === "uploading").length;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-72 max-w-[90vw] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        {active > 0 ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-4 h-4 text-green-400" />}
        <span className="text-xs font-bold text-foreground">
          {active > 0 ? `Enviando ${active} arquivo${active > 1 ? "s" : ""}...` : "Envios concluídos"}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {uploads.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2">
            <Ring value={u.progress} status={u.status} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{u.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {u.status === "uploading" ? `${u.progress}%` : u.status === "done" ? "Concluído ✓" : (u.error || "Erro")}
              </p>
            </div>
            {u.status === "uploading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : u.status === "error" ? (
              <button onClick={() => dismiss(u.id)} className="shrink-0 text-red-400 hover:text-red-300"><XCircle className="w-4 h-4" /></button>
            ) : (
              <button onClick={() => dismiss(u.id)} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
