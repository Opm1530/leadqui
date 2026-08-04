import { confirm } from "@/components/ConfirmDialog";
import api from "@/lib/api";
import { backgroundUpload } from "@/contexts/UploadContext";

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

// Pergunta e anexa o comprovante DIRETO na fatura. Retorna o nome do arquivo se enviado.
export async function askInvoiceReceipt(invoiceId?: string | null): Promise<string | null> {
  if (!invoiceId) return null;
  const ok = await confirm({ title: "Comprovante", description: "Deseja adicionar o comprovante de pagamento?" });
  if (!ok) return null;
  const file = await pickFile();
  if (!file) return null;
  const fd = new FormData();
  fd.append("file", file);
  const d = await backgroundUpload(`/api/cashqui/invoices/${invoiceId}/receipt`, fd, file.name);
  return d.invoice?.receipt_name || file.name;
}

// Abre o comprovante da fatura em nova aba.
export function openInvoiceReceipt(invoiceId: string) {
  const token = localStorage.getItem("pequi_token");
  fetch(`/api/cashqui/invoices/${invoiceId}/receipt`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), "_blank")).catch(() => {});
}
