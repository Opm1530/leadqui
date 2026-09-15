import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Download, X, FileIcon, ExternalLink } from "lucide-react";

export interface ViewFile {
  name: string;
  url: string;      // endpoint para buscar o arquivo (com auth via token)
  mime?: string | null;
}

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();
const isHeic = (f: ViewFile) => /heic|heif/i.test(f.mime || "") || /^(heic|heif)$/.test(ext(f.name));
const kind = (f: ViewFile) => {
  const e = ext(f.name);
  const m = f.mime || "";
  if (isHeic(f)) return "image"; // convertido para JPEG antes de exibir
  if (m.startsWith("image/") || /^(jpe?g|png|gif|webp|svg|bmp|avif)$/.test(e)) return "image";
  if (m.startsWith("video/") || /^(mp4|mov|webm|m4v|ogv)$/.test(e)) return "video";
  if (m.startsWith("audio/") || /^(mp3|wav|ogg|m4a|aac)$/.test(e)) return "audio";
  if (m === "application/pdf" || e === "pdf") return "pdf";
  return "other";
};

export default function FileViewerModal({ file, onClose }: { file: ViewFile | null; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string>("");   // usado para exibição (HEIC → JPEG)
  const [origUrl, setOrigUrl] = useState<string>("");   // arquivo original, usado no download
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) { setBlobUrl(""); setOrigUrl(""); setError(""); return; }
    const urls: string[] = [];
    setLoading(true); setError(""); setBlobUrl(""); setOrigUrl("");
    const token = localStorage.getItem("pequi_token");
    (async () => {
      try {
        const r = await fetch(file.url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("Falha ao carregar o arquivo");
        const b = await r.blob();
        const ou = URL.createObjectURL(b); urls.push(ou); setOrigUrl(ou);
        if (isHeic(file)) {
          // HEIC (fotos do iPhone) não renderiza no navegador — converte para JPEG.
          try {
            const heic2any = (await import("heic2any")).default as any;
            const out = await heic2any({ blob: b, toType: "image/jpeg", quality: 0.9 });
            const jpg = (Array.isArray(out) ? out[0] : out) as Blob;
            const du = URL.createObjectURL(jpg); urls.push(du); setBlobUrl(du);
          } catch {
            setError("Não foi possível gerar a pré-visualização deste HEIC. Você ainda pode baixá-lo.");
          }
        } else {
          setBlobUrl(ou);
        }
      } catch (e: any) {
        setError(e.message || "Não foi possível abrir o arquivo");
      } finally { setLoading(false); }
    })();
    return () => { urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [file?.url]);

  if (!file) return null;
  const k = kind(file);

  const baixar = () => {
    const url = origUrl || blobUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-4xl w-[95vw] p-0 overflow-hidden [&>button]:hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={baixar} disabled={!origUrl && !blobUrl} title="Baixar" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-40"><Download className="w-4 h-4" /></button>
            <button onClick={onClose} title="Fechar" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-black/40 flex items-center justify-center" style={{ minHeight: "50vh", maxHeight: "80vh" }}>
          {loading ? (
            <div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" /></div>
          ) : error ? (
            <div className="py-20 text-center px-6 space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              {origUrl && <button onClick={baixar} className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><Download className="w-4 h-4" /> Baixar arquivo</button>}
            </div>
          ) : !blobUrl ? null : k === "image" ? (
            <img src={blobUrl} alt={file.name} className="max-h-[80vh] max-w-full object-contain" />
          ) : k === "video" ? (
            <video src={blobUrl} controls autoPlay className="max-h-[80vh] max-w-full" />
          ) : k === "audio" ? (
            <div className="py-16 px-6 w-full"><audio src={blobUrl} controls className="w-full" /></div>
          ) : k === "pdf" ? (
            <iframe src={blobUrl} title={file.name} className="w-full" style={{ height: "80vh" }} />
          ) : (
            <div className="py-20 text-center px-6 space-y-3">
              <FileIcon className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
              <p className="text-sm text-muted-foreground">Este tipo de arquivo não pode ser visualizado aqui.</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={baixar} className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><Download className="w-4 h-4" /> Baixar arquivo</button>
                <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" /> Abrir em nova aba</a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
