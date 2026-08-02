import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, Trash2, FileIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function ClientFiles({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.get(`/api/files?client_id=${clientId}`).then(d => setFiles(d.files || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    api.get("/api/files/status").then(d => setConfigured(d.configured)).catch(() => setConfigured(false));
    load();
  }, [clientId]);

  const onPick = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_id", clientId);
      const d = await api.post("/api/files", fd);
      setFiles(p => [d.file, ...p]);
      toast({ title: "Arquivo enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const baixar = (f: any) => {
    const token = localStorage.getItem("pequi_token");
    // abre em nova aba com o token via fetch → blob
    fetch(`/api/files/${f.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(b => { const url = URL.createObjectURL(b); window.open(url, "_blank"); })
      .catch(() => toast({ title: "Erro ao baixar", variant: "destructive" }));
  };

  const remover = async (f: any) => {
    if (!confirm(`Excluir "${f.name}"?`)) return;
    try { await api.delete(`/api/files/${f.id}`); setFiles(p => p.filter(x => x.id !== f.id)); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  if (configured === false) {
    return <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center text-sm text-yellow-300">
      Configure o armazenamento (Cloudflare R2) em Configurações → Geral & APIs para enviar arquivos.
    </div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Arquivos do cliente</h2>
        <input ref={inputRef} type="file" onChange={onFile} className="hidden" />
        <Button onClick={onPick} disabled={uploading} size="sm" className="gradient-button gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar arquivo
        </Button>
      </div>
      {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      : files.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum arquivo ainda.</p>
      : (
        <div className="space-y-1.5">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <button onClick={() => baixar(f)} className="flex-1 min-w-0 text-left">
                <p className="text-sm text-foreground truncate hover:text-primary">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{fmtSize(f.size)} · {new Date(f.created_at).toLocaleDateString("pt-BR")}</p>
              </button>
              <button onClick={() => baixar(f)} className="p-1.5 text-muted-foreground hover:text-foreground"><Download className="w-4 h-4" /></button>
              <button onClick={() => remover(f)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
