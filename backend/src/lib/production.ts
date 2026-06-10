import prisma from "./prisma";
import { createTrelloCard } from "./trello";

interface SendOpts {
  trello_list_id?: string;
  trello_member_ids?: string[];
  trello_label_ids?: string[];
  responsible_id?: string | null; // usuário do Tasqui responsável pela tarefa
}

// Garante que exista um projeto de produção de conteúdo para o cliente.
async function getOrCreateContentProject(clientId: string, existingProjectId?: string | null): Promise<string> {
  if (existingProjectId) return existingProjectId;
  const existing = await prisma.project.findFirst({
    where: { client_id: clientId, name: "Produção de Conteúdo" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.project.create({
    data: { client_id: clientId, name: "Produção de Conteúdo", type: "RECORRENTE", status: "ATIVO" },
  });
  return created.id;
}

// Envia um post do calendário para produção:
// 1. status -> PRODUZINDO
// 2. cria card no Trello (lista/membros/etiquetas)
// 3. cria tarefa no Tasqui vinculada
export async function sendPostToProduction(postId: string, opts: SendOpts = {}): Promise<{
  post: any; trello: any | null; task: any | null;
}> {
  const post = await (prisma as any).calendarPost.findUnique({
    where: { id: postId },
    include: { client: { select: { name: true } } },
  });
  if (!post) throw new Error("Post não encontrado");

  const titulo = post.title || `${post.type} ${post.platform}`;
  const dataISO = new Date(post.scheduled_date).toISOString();
  const dataBR = new Date(post.scheduled_date).toLocaleDateString("pt-BR");

  // 1. Card no Trello
  let trello: any = null;
  try {
    trello = await createTrelloCard({
      name: `${post.client?.name || "Cliente"} — ${titulo}`,
      desc: `Tipo: ${post.type} · Plataforma: ${post.platform}\nData: ${dataBR}\n\n${post.content || ""}`,
      dueISO: dataISO,
      idList: opts.trello_list_id,
      idMembers: opts.trello_member_ids,
      idLabels: opts.trello_label_ids,
    });
  } catch (e: any) {
    console.warn("[Produção] Trello falhou:", e.message);
  }

  // 2. Tarefa no Tasqui
  let task: any = null;
  try {
    const projectId = await getOrCreateContentProject(post.client_id, post.project_id);
    task = await prisma.task.create({
      data: {
        project_id: projectId,
        client_id: post.client_id,
        responsible_id: opts.responsible_id || null,
        title: `Produzir: ${titulo}`,
        description: `${post.type} · ${post.platform} · ${dataBR}\n\n${post.content || ""}${trello?.shortUrl ? `\n\nTrello: ${trello.shortUrl}` : ""}`,
        status: "EM_ANDAMENTO",
        priority: "MEDIA",
        due_date: post.scheduled_date,
      },
    });
  } catch (e: any) {
    console.warn("[Produção] Criação de tarefa falhou:", e.message);
  }

  // 3. Atualiza o post
  const updated = await (prisma as any).calendarPost.update({
    where: { id: postId },
    data: {
      status: "PRODUZINDO",
      trello_card_id: trello?.id || null,
      trello_card_url: trello?.shortUrl || null,
      task_id: task?.id || null,
    },
    include: { client: { select: { name: true } } },
  });

  return { post: updated, trello, task };
}
