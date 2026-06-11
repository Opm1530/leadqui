import axios from "axios";
import { getCompanySettingsUserId } from "./companySettings";
import prisma from "./prisma";

// Retorna as credenciais do Trello da empresa, ou null se não configurado.
async function trelloCreds(): Promise<{ key: string; token: string; settings: any } | null> {
  const ownerId = await getCompanySettingsUserId();
  if (!ownerId) return null;
  const settings = await (prisma as any).techQuiSettings.findUnique({ where: { user_id: ownerId } });
  if (!settings?.trello_api_key || !settings?.trello_token) return null;
  return { key: settings.trello_api_key, token: settings.trello_token, settings };
}

export async function isTrelloConfigured(): Promise<boolean> {
  const c = await trelloCreds();
  return !!(c && (c.settings.trello_list_id || c.settings.trello_board_id));
}

// ── Leitura de dados do Trello (para popular dropdowns) ──────────────
export async function getTrelloBoards(): Promise<any[]> {
  const c = await trelloCreds();
  if (!c) return [];
  const resp = await axios.get("https://api.trello.com/1/members/me/boards", {
    params: { key: c.key, token: c.token, fields: "id,name", filter: "open" },
  });
  return resp.data || [];
}

export async function getTrelloLists(boardId?: string): Promise<any[]> {
  const c = await trelloCreds();
  if (!c) return [];
  const board = boardId || c.settings.trello_board_id;
  if (!board) return [];
  const resp = await axios.get(`https://api.trello.com/1/boards/${board}/lists`, {
    params: { key: c.key, token: c.token, fields: "id,name", filter: "open" },
  });
  return resp.data || [];
}

export async function getTrelloLabels(boardId?: string): Promise<any[]> {
  const c = await trelloCreds();
  if (!c) return [];
  const board = boardId || c.settings.trello_board_id;
  if (!board) return [];
  const resp = await axios.get(`https://api.trello.com/1/boards/${board}/labels`, {
    params: { key: c.key, token: c.token, fields: "id,name,color", limit: 100 },
  });
  return resp.data || [];
}

export async function getTrelloMembers(boardId?: string): Promise<any[]> {
  const c = await trelloCreds();
  if (!c) return [];
  const board = boardId || c.settings.trello_board_id;
  if (!board) return [];
  const resp = await axios.get(`https://api.trello.com/1/boards/${board}/members`, {
    params: { key: c.key, token: c.token, fields: "id,fullName,username" },
  });
  return resp.data || [];
}

// Busca os anexos de um card (a arte enviada pelo designer).
export async function getCardAttachments(cardId: string): Promise<any[]> {
  const c = await trelloCreds();
  if (!c) return [];
  const resp = await axios.get(`https://api.trello.com/1/cards/${cardId}/attachments`, {
    params: { key: c.key, token: c.token, fields: "id,name,url,mimeType,isUpload" },
  });
  return resp.data || [];
}

// Retorna só as URLs de anexos que são imagem/vídeo.
export async function getCardMediaUrls(cardId: string): Promise<string[]> {
  const atts = await getCardAttachments(cardId);
  return atts
    .filter(a => a.url && (/\.(jpg|jpeg|png|gif|mp4|mov|webp)(\?|$)/i.test(a.url) || /^image|^video/.test(a.mimeType || "")))
    .map(a => a.url);
}

// Lista raw de credenciais para uso externo (registrar webhook etc.)
export async function getTrelloCreds() {
  return trelloCreds();
}

// ── Criação de card ──────────────────────────────────────────────────
interface CreateCardOpts {
  name: string;
  desc: string;
  dueISO?: string;
  idList?: string;          // sobrescreve a lista padrão
  idMembers?: string[];     // membros do Trello
  idLabels?: string[];      // etiquetas do Trello
}

// Cria um card no Trello. Retorna o card ou null se não configurado.
export async function createTrelloCard(opts: CreateCardOpts): Promise<any | null> {
  const c = await trelloCreds();
  if (!c) return null;
  const idList = opts.idList || c.settings.trello_list_id;
  if (!idList) return null; // sem lista de destino — gancho pronto, sem erro

  const resp = await axios.post("https://api.trello.com/1/cards", null, {
    params: {
      key:    c.key,
      token:  c.token,
      idList,
      name:   opts.name,
      desc:   opts.desc,
      ...(opts.dueISO ? { due: opts.dueISO } : {}),
      ...(opts.idMembers?.length ? { idMembers: opts.idMembers.join(",") } : {}),
      ...(opts.idLabels?.length ? { idLabels: opts.idLabels.join(",") } : {}),
    },
  });
  return resp.data;
}
