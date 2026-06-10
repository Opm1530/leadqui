import axios from "axios";
import { getCompanySettingsUserId } from "./companySettings";
import prisma from "./prisma";

// Cria um card no Trello na lista configurada. Retorna o card ou null se não configurado.
export async function createTrelloCard(name: string, desc: string, dueISO?: string): Promise<any | null> {
  const ownerId = await getCompanySettingsUserId();
  if (!ownerId) return null;
  const settings = await (prisma as any).techQuiSettings.findUnique({ where: { user_id: ownerId } });
  if (!settings?.trello_api_key || !settings?.trello_token || !settings?.trello_list_id) {
    return null; // Trello não configurado — gancho pronto, sem erro
  }

  const resp = await axios.post("https://api.trello.com/1/cards", null, {
    params: {
      key:    settings.trello_api_key,
      token:  settings.trello_token,
      idList: settings.trello_list_id,
      name,
      desc,
      ...(dueISO ? { due: dueISO } : {}),
    },
  });
  return resp.data;
}

export async function isTrelloConfigured(): Promise<boolean> {
  const ownerId = await getCompanySettingsUserId();
  if (!ownerId) return false;
  const s = await (prisma as any).techQuiSettings.findUnique({ where: { user_id: ownerId } });
  return !!(s?.trello_api_key && s?.trello_token && s?.trello_list_id);
}
