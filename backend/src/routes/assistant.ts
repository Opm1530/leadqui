import { Router, Response } from "express";
import OpenAI from "openai";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettings } from "../lib/companySettings";
import { createTrelloCard, isTrelloConfigured } from "../lib/trello";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── Definição das ferramentas (tools) do agente ───────────────────────
const TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "buscar_cliente",
      description: "Busca clientes pelo nome (ou parte do nome) para obter o ID. Use sempre antes de criar conteúdo.",
      parameters: {
        type: "object",
        properties: { nome: { type: "string", description: "Nome ou parte do nome do cliente" } },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_calendario",
      description: "Lista os posts já existentes no calendário editorial de um cliente em um mês/ano.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          mes:  { type: "integer", description: "1-12" },
          ano:  { type: "integer" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_card",
      description: "Propõe criar um card VAZIO no calendário editorial — só define cliente, formato e dia. O conteúdo é preenchido depois. Use quando o usuário quer reservar/planejar dias do calendário. Aceita vários dias de uma vez.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          tipo:      { type: "string", enum: ["POST", "STORY", "REEL", "CARROSSEL", "AD"], description: "Formato do conteúdo" },
          plataforma:{ type: "string", enum: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"] },
          datas:     { type: "array", items: { type: "string" }, description: "Lista de datas YYYY-MM-DD para criar um card em cada" },
        },
        required: ["client_id", "tipo", "datas"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_conteudo",
      description: "Propõe adicionar um conteúdo JÁ COMPLETO (com título e legenda) no calendário de um cliente numa data. Use quando o usuário já dá o conteúdo pronto. NÃO executa direto — gera proposta para confirmar.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          titulo:    { type: "string" },
          legenda:   { type: "string", description: "Legenda/briefing do conteúdo" },
          tipo:      { type: "string", enum: ["POST", "STORY", "REEL", "CARROSSEL", "AD"] },
          plataforma:{ type: "string", enum: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"] },
          data:      { type: "string", description: "Data no formato YYYY-MM-DD" },
        },
        required: ["client_id", "titulo", "tipo", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preencher_card",
      description: "Propõe preencher um card existente (vazio ou não) com título e legenda. Use listar_calendario antes para obter o post_id do card.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "ID do card a preencher" },
          titulo:  { type: "string" },
          legenda: { type: "string" },
        },
        required: ["post_id", "titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_para_producao",
      description: "Propõe enviar um post do calendário para produção (muda status para PRODUZINDO e cria um card no Trello). NÃO executa direto — gera proposta para confirmar.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "ID do post do calendário (obtido via listar_calendario)" },
        },
        required: ["post_id"],
      },
    },
  },
];

const SYSTEM_PROMPT = `Você é o assistente operacional da agência Pequi Digital, integrado ao ecossistema.
Você ajuda a gerenciar o calendário editorial de mídia dos clientes.

Regras:
- Sempre use buscar_cliente para obter o client_id antes de criar conteúdo. Nunca invente IDs.
- Para datas, use o formato YYYY-MM-DD. O ano atual é ${new Date().getFullYear()}.
- Ações que modificam dados (adicionar_conteudo, enviar_para_producao) geram uma PROPOSTA que o usuário confirma na interface. Após chamá-las, explique de forma curta o que será feito e diga que aguarda a confirmação.
- Seja conciso e direto, em português do Brasil.
- Se o usuário pedir "criar calendário de X para o mês Y", confirme o cliente e pergunte quais conteúdos ele quer, ou adicione os que ele listar.`;

// ── Executores das tools de LEITURA ───────────────────────────────────
async function execReadTool(name: string, args: any, userId: string): Promise<any> {
  if (name === "buscar_cliente") {
    const clients = await prisma.client.findMany({
      where: { name: { contains: String(args.nome), mode: "insensitive" } },
      select: { id: true, name: true, status: true },
      take: 10,
    });
    return { clientes: clients };
  }
  if (name === "listar_calendario") {
    const where: any = { client_id: args.client_id };
    if (args.mes && args.ano) {
      where.scheduled_date = {
        gte: new Date(args.ano, args.mes - 1, 1),
        lte: new Date(args.ano, args.mes, 0, 23, 59, 59),
      };
    }
    const posts = await (prisma as any).calendarPost.findMany({
      where, orderBy: { scheduled_date: "asc" },
      select: { id: true, title: true, type: true, platform: true, scheduled_date: true, status: true },
    });
    return { posts };
  }
  return { error: "tool de leitura desconhecida" };
}

// Tools de escrita viram propostas (não executam aqui)
const WRITE_TOOLS = ["criar_card", "adicionar_conteudo", "preencher_card", "enviar_para_producao"];

// ── POST /api/assistant/chat ──────────────────────────────────────────
router.post("/chat", async (req: AuthRequest, res: Response): Promise<void> => {
  const { messages } = req.body; // histórico [{role, content}]
  if (!Array.isArray(messages)) { res.status(400).json({ error: "messages deve ser array" }); return; }

  try {
    const settings = await getCompanySettings();
    const apiKey = (settings as any)?.openai_api_key;
    if (!apiKey) { res.status(400).json({ error: "OpenAI API Key não configurada nas Configurações." }); return; }

    const openai = new OpenAI({ apiKey });
    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    const proposals: any[] = [];

    // Loop de tool calling (máx 6 iterações para segurança)
    for (let i = 0; i < 6; i++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: convo,
        tools: TOOLS,
        tool_choice: "auto",
      });
      const msg = completion.choices[0].message;
      convo.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // Resposta final
        res.json({ reply: msg.content || "", proposals });
        return;
      }

      // Processar cada tool call
      for (const tc of msg.tool_calls as any[]) {
        const fnName = tc.function.name;
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}

        if (WRITE_TOOLS.includes(fnName)) {
          // Gera proposta — não executa
          const proposal = await buildProposal(fnName, args);
          proposals.push(proposal);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ status: "proposta_criada_aguardando_confirmacao", resumo: proposal.label }),
          });
        } else {
          const result = await execReadTool(fnName, args, req.user!.id);
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
    }

    res.json({ reply: "Não consegui concluir — muitas etapas. Tente reformular.", proposals });
  } catch (e: any) {
    console.error("[Assistant] Erro:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Monta a proposta legível + payload resolvido
async function buildProposal(fnName: string, args: any): Promise<any> {
  if (fnName === "criar_card") {
    const client = await prisma.client.findUnique({ where: { id: args.client_id }, select: { name: true } });
    const datas: string[] = Array.isArray(args.datas) ? args.datas : [args.datas].filter(Boolean);
    return {
      id: Math.random().toString(36).slice(2),
      type: "criar_card",
      label: `Criar ${datas.length} card(s) de ${args.tipo} para ${client?.name || "cliente"} (${datas.join(", ")})`,
      payload: {
        client_id: args.client_id,
        type: args.tipo,
        platform: args.plataforma || "INSTAGRAM",
        datas,
      },
    };
  }
  if (fnName === "preencher_card") {
    const post = await (prisma as any).calendarPost.findUnique({ where: { id: args.post_id }, select: { scheduled_date: true } });
    const quando = post ? new Date(post.scheduled_date).toLocaleDateString("pt-BR") : "";
    return {
      id: Math.random().toString(36).slice(2),
      type: "preencher_card",
      label: `Preencher card de ${quando} com "${args.titulo}"`,
      payload: { post_id: args.post_id, title: args.titulo, content: args.legenda || null },
    };
  }
  if (fnName === "adicionar_conteudo") {
    const client = await prisma.client.findUnique({ where: { id: args.client_id }, select: { name: true } });
    return {
      id: Math.random().toString(36).slice(2),
      type: "adicionar_conteudo",
      label: `Adicionar ${args.tipo} "${args.titulo}" para ${client?.name || "cliente"} em ${args.data}`,
      payload: {
        client_id: args.client_id,
        title: args.titulo,
        content: args.legenda || null,
        type: args.tipo,
        platform: args.plataforma || "INSTAGRAM",
        scheduled_date: args.data,
      },
    };
  }
  if (fnName === "enviar_para_producao") {
    const post = await (prisma as any).calendarPost.findUnique({
      where: { id: args.post_id }, select: { title: true },
    });
    const trelloOn = await isTrelloConfigured();
    return {
      id: Math.random().toString(36).slice(2),
      type: "enviar_para_producao",
      label: `Enviar "${post?.title || args.post_id}" para produção${trelloOn ? " + criar card no Trello" : ""}`,
      payload: { post_id: args.post_id },
    };
  }
  return { id: Math.random().toString(36).slice(2), type: fnName, label: "Ação", payload: args };
}

// ── POST /api/assistant/execute ───────────────────────────────────────
// Executa uma ação previamente confirmada pelo usuário
router.post("/execute", async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, payload } = req.body;
  try {
    if (type === "criar_card") {
      const datas: string[] = payload.datas || [];
      const created = await Promise.all(datas.map((d: string) =>
        (prisma as any).calendarPost.create({
          data: {
            client_id: payload.client_id,
            title: null,
            type: payload.type || "POST",
            platform: payload.platform || "INSTAGRAM",
            scheduled_date: new Date(d),
            status: "PLANEJADO",
          },
        })
      ));
      res.json({ success: true, message: `${created.length} card(s) criado(s) no calendário. Agora é só preencher o conteúdo.` });
      return;
    }

    if (type === "preencher_card") {
      const post = await (prisma as any).calendarPost.update({
        where: { id: payload.post_id },
        data: { title: payload.title, content: payload.content || null },
      });
      res.json({ success: true, message: `Card preenchido com "${post.title}".` });
      return;
    }

    if (type === "adicionar_conteudo") {
      const post = await (prisma as any).calendarPost.create({
        data: {
          client_id: payload.client_id,
          title: payload.title,
          content: payload.content || null,
          type: payload.type || "POST",
          platform: payload.platform || "INSTAGRAM",
          scheduled_date: new Date(payload.scheduled_date),
          status: "PLANEJADO",
        },
        include: { client: { select: { name: true } } },
      });
      res.json({ success: true, message: `Conteúdo "${post.title}" adicionado ao calendário.`, post });
      return;
    }

    if (type === "enviar_para_producao") {
      const post = await (prisma as any).calendarPost.update({
        where: { id: payload.post_id },
        data: { status: "PRODUZINDO" },
        include: { client: { select: { name: true } } },
      });
      // Criar card no Trello (se configurado)
      let trello = null;
      try {
        trello = await createTrelloCard(
          `${post.client?.name || "Cliente"} — ${post.title}`,
          `Tipo: ${post.type} · Plataforma: ${post.platform}\nData: ${new Date(post.scheduled_date).toLocaleDateString("pt-BR")}\n\n${post.content || ""}`,
          new Date(post.scheduled_date).toISOString(),
        );
      } catch (e: any) {
        console.warn("[Assistant] Trello falhou:", e.message);
      }
      res.json({
        success: true,
        message: `"${post.title}" enviado para produção${trello ? " e card criado no Trello" : " (Trello não configurado)"}.`,
        trello_url: trello?.shortUrl || null,
      });
      return;
    }

    res.status(400).json({ error: "Tipo de ação desconhecido" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
