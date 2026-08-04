import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type UploadItem = {
  id: string;
  label: string;
  progress: number;              // 0-100
  status: "uploading" | "done" | "error";
  error?: string;
};

type Ctx = {
  uploads: UploadItem[];
  // Sobe um arquivo em background (com progresso). Resolve com o JSON da resposta.
  startUpload: (url: string, formData: FormData, label: string) => Promise<any>;
  dismiss: (id: string) => void;
};

const UploadCtx = createContext<Ctx>({ uploads: [], startUpload: async () => ({}), dismiss: () => {} });
export const useUploads = () => useContext(UploadCtx);

let counter = 0;
const genId = () => `up_${Date.now()}_${counter++}`;

// Implementação registrada pelo provider — permite usar fora de componentes React (libs).
let _impl: ((url: string, fd: FormData, label: string) => Promise<any>) | null = null;

// Upload em background com indicador flutuante. Use em qualquer lugar (com ou sem React).
export function backgroundUpload(url: string, formData: FormData, label: string): Promise<any> {
  if (_impl) return _impl(url, formData, label);
  // Fallback (sem provider montado): upload simples, sem barra de progresso.
  const token = localStorage.getItem("pequi_token");
  return fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    .then(r => { if (!r.ok) throw new Error(`Erro ${r.status}`); return r.json().catch(() => ({})); });
}

export const UploadProvider = ({ children }: { children: ReactNode }) => {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const dismiss = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const startUpload = useCallback((url: string, formData: FormData, label: string) => {
    const id = genId();
    setUploads(prev => [...prev, { id, label, progress: 0, status: "uploading" }]);
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      const token = localStorage.getItem("pequi_token");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(id, { progress: Math.min(99, Math.round((e.loaded / e.total) * 100)) });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          update(id, { status: "done", progress: 100 });
          let data: any = {};
          try { data = JSON.parse(xhr.responseText); } catch { /* */ }
          setTimeout(() => dismiss(id), 2500); // some sozinho após concluir
          resolve(data);
        } else {
          let msg = `Erro ${xhr.status}`;
          try { msg = JSON.parse(xhr.responseText)?.error || msg; } catch { /* */ }
          update(id, { status: "error", error: msg });
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => { update(id, { status: "error", error: "Falha de rede" }); reject(new Error("Falha de rede")); };
      xhr.send(formData);
    });
  }, [update, dismiss]);

  // Registra a implementação para uso fora do React (backgroundUpload).
  _impl = startUpload;

  return <UploadCtx.Provider value={{ uploads, startUpload, dismiss }}>{children}</UploadCtx.Provider>;
};
