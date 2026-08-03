// Config compartilhada do Editorial (status, tipos, plataformas)

export const CONTENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  IDEIA:             { label: "Ideia",             color: "text-slate-300 bg-slate-500/10 border-slate-500/20",   dot: "bg-slate-400" },
  EM_PRODUCAO:       { label: "Em Produção",       color: "text-blue-300 bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-400" },
  AJUSTES:           { label: "Ajustes",           color: "text-red-300 bg-red-500/10 border-red-500/20",         dot: "bg-red-400" },
  EM_APROVACAO:      { label: "Em Aprovação",      color: "text-purple-300 bg-purple-500/10 border-purple-500/20", dot: "bg-purple-400" },
  AGUARDANDO_POSTAR: { label: "Aguardando Postar", color: "text-amber-300 bg-amber-500/10 border-amber-500/20",   dot: "bg-amber-400" },
  POSTADO:           { label: "Postado",           color: "text-green-300 bg-green-500/10 border-green-500/20",   dot: "bg-green-500" },
};

export const STATUS_ORDER = ["IDEIA", "EM_PRODUCAO", "AJUSTES", "EM_APROVACAO", "AGUARDANDO_POSTAR", "POSTADO"];

// Status do agendamento automático (post no Instagram)
export const SCHEDULE_STATUS: Record<string, { label: string; color: string }> = {
  AGENDADO:  { label: "Agendado",  color: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20" },
  PUBLICADO: { label: "Publicado", color: "text-green-300 bg-green-500/10 border-green-500/20" },
  ERRO:      { label: "Erro ao publicar", color: "text-red-300 bg-red-500/10 border-red-500/20" },
  CANCELADO: { label: "Cancelado", color: "text-slate-300 bg-slate-500/10 border-slate-500/20" },
};

export const CONTENT_TYPES = [
  { id: "REELS", label: "Reels" },
  { id: "POST", label: "Post" },
  { id: "CAROUSEL", label: "Carrossel" },
  { id: "STORY", label: "Story" },
  { id: "OUTRO", label: "Outro" },
];

export const PLATFORMS = [
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "TIKTOK", label: "TikTok" },
  { id: "FACEBOOK", label: "Facebook" },
  { id: "YOUTUBE", label: "YouTube" },
  { id: "OUTRO", label: "Outro" },
];

export function typeLabel(id?: string) { return CONTENT_TYPES.find(t => t.id === id)?.label || id || "—"; }
export function platformLabel(id?: string) { return PLATFORMS.find(p => p.id === id)?.label || id || "—"; }

export function openEditorialFile(id: string) {
  const token = localStorage.getItem("pequi_token");
  fetch(`/api/editorial/${id}/file`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), "_blank")).catch(() => {});
}
