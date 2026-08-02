import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, Trash2, FileIcon, Download, Folder, FolderPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function ClientFiles({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null); // pasta atual (null = raiz)
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    const q = current ? `client_id=${clientId}&folder_id=${current.id}` : `client_id=${clientId}`;
    api.get(`/api/files?${q}`).then(d => setFiles(d.files || [])).catch(() => {}).finally(() => setLoading(false));
  };
  const loadFolders = () => api.get(`/api/files/folders?client_id=${clientId}`).then(d => setFolders(d.folders || [])).catch(() => {});
  useEffect(() => {
    api.get("/api/files/status").then(d => setConfigured(d.configured)).catch(() => setConfigured(false));
    loadFolders();
  }, [clientId]);
  useEffect(() => { load(); }, [clientId, current]);

  const criarPasta = async () => {
    if (!newFolder.trim()) return;
    try {
      const d = await api.post("/api/files/folders", { client_id: clientId, name: newFolder.trim() });
      setFolders(p => [...p, d.folder]); setNewFolder(""); setShowNewFolder(false);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };
  const delPasta = async (f: any) => {
    if (!confirm(`Excluir a pasta "${f.name}"? Os arquivos voltam para a raiz.`)) return;
    await api.delete(`/api/files/folders/${f.id}`).catch(() => {});
    setFolders(p => p.filter(x => x.id !== f.id));
    if (current?.id === f.id) setCurrent(null);
  };

  const onPick = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_id", clientId);
      if (current) fd.append("folder_id", current.id);
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
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {current && <button onClick={() => setCurrent(null)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></button>}
          <h2 className="text-sm font-semibold text-foreground truncate">{current ? current.name : "Arquivos do cliente"}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!current && (
            <Button onClick={() => setShowNewFolder(v => !v)} size="sm" variant="outline" className="border-border gap-1.5"><FolderPlus className="w-4 h-4" /> Pasta</Button>
          )}
          <input ref={inputRef} type="file" onChange={onFile} className="hidden" />
          <Button onClick={onPick} disabled={uploading} size="sm" className="gradient-button gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar
          </Button>
        </div>
      </div>

      {showNewFolder && !current && (
        <div className="flex gap-2 mb-3">
          <Input value={newFolder} onChange={e => setNewFolder(e.target.value)} onKeyDown={e => { if (e.key === "Enter") criarPasta(); }} placeholder="Nome da pasta" className="bg-secondary border-border text-sm" />
          <Button onClick={criarPasta} size="sm" className="gradient-button">Criar</Button>
        </div>
      )}

      {/* Pastas (só na raiz) */}
      {!current && folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {folders.map(f => (
            <div key={f.id} className="group flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 hover:bg-secondary/60">
              <button onClick={() => setCurrent(f)} className="flex items-center gap-2 flex-1 min-w-0">
                <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{f.name}</span>
              </button>
              <button onClick={() => delPasta(f)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      : files.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum arquivo {current ? "nesta pasta" : "na raiz"}.</p>
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
