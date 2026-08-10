import { useState, useEffect } from "react";
import { FileText, Download, Loader2 } from "lucide-react";

// Exibe a mídia de uma mensagem do inbox (busca com auth → object URL).
export default function InboxMedia({ messageId, type, name }: { messageId: string; type: string; name?: string }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    let revoked = "";
    const token = localStorage.getItem("pequi_token");
    fetch(`/api/inbox/messages/${messageId}/media`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(b => { const u = URL.createObjectURL(b); revoked = u; setUrl(u); })
      .catch(() => setErr(true));
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [messageId]);

  if (err) return <p className="text-[11px] text-muted-foreground italic">Mídia indisponível</p>;
  if (!url) return <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (type === "image" || type === "sticker") return <img src={url} alt={name} className="max-w-[240px] max-h-[280px] rounded-lg object-contain" />;
  if (type === "video") return <video src={url} controls className="max-w-[260px] rounded-lg" />;
  if (type === "audio") return <audio src={url} controls className="max-w-[240px]" />;
  return <a href={url} download={name} className="flex items-center gap-2 text-sm text-primary hover:underline"><FileText className="w-4 h-4" /> {name || "arquivo"} <Download className="w-3.5 h-3.5" /></a>;
}
