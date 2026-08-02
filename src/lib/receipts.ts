import { confirm } from "@/components/ConfirmDialog";
import api from "@/lib/api";

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

// Pergunta e anexa o comprovante de uma fatura na pasta "Comprovantes" do cliente.
// Retorna true se um comprovante foi enviado.
export async function askInvoiceReceipt(clientId?: string | null): Promise<boolean> {
  if (!clientId) return false;
  const ok = await confirm({ title: "Comprovante", description: "Deseja adicionar o comprovante de pagamento?" });
  if (!ok) return false;
  const file = await pickFile();
  if (!file) return false;
  const d = await api.get(`/api/files/folders?client_id=${clientId}`).catch(() => ({ folders: [] }));
  let folder = (d.folders || []).find((x: any) => x.name === "Comprovantes");
  if (!folder) { const r = await api.post("/api/files/folders", { client_id: clientId, name: "Comprovantes" }).catch(() => null); folder = r?.folder; }
  const fd = new FormData();
  fd.append("file", file); fd.append("client_id", clientId);
  if (folder) fd.append("folder_id", folder.id);
  await api.post("/api/files", fd);
  return true;
}
