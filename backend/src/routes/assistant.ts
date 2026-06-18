import { Router, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "../lib/prisma";
import { authenticateJWT, requireStaff, AuthRequest } from "../middlewares/auth";
import { getCompanySettings } from "../lib/companySettings";
import { isTrelloConfigured } from "../lib/trello";
import { sendPostToProduction } from "../lib/production";
import { dayDate } from "../lib/dates";

const router = Router();
router.use(authenticateJWT);
router.use(requireStaff);

// ── Definição das ferramentas (tools) do agente — formato Claude ──────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_cliente",
    description: "Busca clientes pelo nome (ou parte do nome) para obter o ID. Use sempre antes de criar conteúdo.",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string", description: "Nome ou parte do nome do cliente" } },
      required: ["nome"],
    },
  },
  {
    name: "listar_calendario",
    description: "Lista os posts já existentes no calendário editorial de um cliente em um mês/ano.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        mes:  { type: "integer", description: "1-12" },
        ano:  { type: "integer" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "criar_card",
    description: "Propõe criar um card VAZIO no calendário editorial — só define cliente, formato e dia. O conteúdo é preenchido depois. Use quando o usuário quer reservar/planejar dias do calendário. Aceita vários dias de uma vez.",
    input_schema: {
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
  {
    name: "adicionar_conteudo",
    description: "Propõe adicionar um conteúdo JÁ COMPLETO (com título e legenda) no calendário de um cliente numa data. Use quando o usuário já dá o conteúdo pronto. NÃO executa direto — gera proposta para confirmar.",
    input_schema: {
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
  {
    name: "preencher_card",
    description: "Propõe preencher um card existente (vazio ou não) com título e legenda. Use listar_calendario antes para obter o post_id do card.",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do card a preencher" },
        titulo:  { type: "string" },
        legenda: { type: "string" },
      },
      required: ["post_id", "titulo"],
    },
  },
  {
    name: "enviar_para_producao",
    description: "Propõe enviar um post do calendário para produção (muda status para PRODUZINDO e cria um card no Trello). NÃO executa direto — gera proposta para confirmar.",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post do calendário (obtido via listar_calendario)" },
      },
      required: ["post_id"],
    },
  },
  {
    name: "remover_card",
    description: "Propõe remover (deletar) um card/post específico do calendário editorial. Use listar_calendario antes para obter o post_id. NÃO executa direto — gera proposta para confirmar.",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post a remover" },
      },
      required: ["post_id"],
    },
  },
  {
    name: "limpar_calendario",
    description: "Propõe APAGAR TODOS os posts do calendário de um cliente dentro de um intervalo de datas. Use quando o usuário quer limpar/zerar o calendário antes de recriar. NÃO executa direto — gera proposta para confirmar. Cuidado: remove vários posts de uma vez.",
    input_schema: {
      type: "object",
      properties: {
        client_id:    { type: "string" },
        data_inicio:  { type: "string", description: "Data inicial YYYY-MM-DD (inclusive). Opcional: se omitir junto com data_fim, apaga TODOS os posts do cliente." },
        data_fim:     { type: "string", description: "Data final YYYY-MM-DD (inclusive). Opcional." },
      },
      required: ["client_id"],
    },
  },
  {
    name: "criar_calendario_recorrente",
    description: "Cria cards VAZIOS no calendário seguindo uma regra semanal recorrente (ex: toda segunda um Reels, toda terça um Carrossel). VOCÊ NÃO PRECISA calcular as datas — informe apenas o dia da semana de cada regra e o período; o sistema calcula automaticamente as datas corretas. SEMPRE prefira esta ferramenta quando o usuário descrever um padrão por dia da semana. NÃO executa direto — gera proposta para confirmar.",
    input_schema: {
      type: "object",
      properties: {
        client_id:   { type: "string" },
        plataforma:  { type: "string", enum: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"], description: "Padrão INSTAGRAM" },
        data_inicio: { type: "string", description: "Início do período YYYY-MM-DD (inclusive)" },
        data_fim:    { type: "string", description: "Fim do período YYYY-MM-DD (inclusive)" },
        regras: {
          type: "array",
          description: "Uma regra por dia da semana desejado",
          items: {
            type: "object",
            properties: {
              dia_semana: { type: "string", enum: ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] },
              tipo:       { type: "string", enum: ["POST", "STORY", "REEL", "CARROSSEL", "AD"] },
            },
            required: ["dia_semana", "tipo"],
          },
        },
      },
      required: ["client_id", "data_inicio", "data_fim", "regras"],
    },
  },
];

// Mapa de dia da semana PT -> índice JS (0=domingo)
const DIA_SEMANA: Record<string, number> = {
  DOMINGO: 0, SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5, SABADO: 6,
};

// Calcula todas as datas (YYYY-MM-DD) entre início e fim que caem nas regras informadas.
// Retorna lista de { data, tipo }. Cálculo feito em UTC para não sofrer com fuso.
function expandirRecorrencia(dataInicio: string, dataFim: string, regras: any[]): { data: string; tipo: string }[] {
  const out: { data: string; tipo: string }[] = [];
  const start = new Date(dataInicio + "T00:00:00Z");
  const end = new Date(dataFim + "T00:00:00Z");
  const porDia: Record<number, string> = {};
  for (const r of regras) {
    const idx = DIA_SEMANA[String(r.dia_semana).toUpperCase()];
    if (idx !== undefined) porDia[idx] = r.tipo;
  }
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (porDia[dow]) {
      out.push({ data: d.toISOString().slice(0, 10), tipo: porDia[dow] });
    }
  }
  return out;
}

const SYSTEM_PROMPT = `Você é o assistente operacional da agência Pequi Digital, integrado ao ecossistema.
Você ajuda a gerenciar o calendário editorial de mídia dos clientes.

Regras:
- NUNCA invente, adivinhe ou crie um client_id ou post_id. IDs só podem vir de uma chamada anterior de buscar_cliente ou listar_calendario.
- SEMPRE chame buscar_cliente ANTES de criar_card ou adicionar_conteudo, e use exatamente o id retornado.
- Se buscar_cliente não retornar nenhum cliente, NÃO crie nada — avise o usuário que o cliente não foi encontrado e peça o nome correto.
- Para datas, use o formato YYYY-MM-DD. A data de hoje é ${new Date().toISOString().slice(0, 10)}.
- NUNCA calcule manualmente quais datas caem em determinado dia da semana — você erra. Quando o usuário descrever um padrão semanal (ex: "toda segunda Reels, toda terça Carrossel, toda quinta Reels, toda sexta Post"), use SEMPRE a ferramenta criar_calendario_recorrente, passando só as regras (dia_semana + tipo) e o período. O sistema calcula as datas certas.
- Para limpar o calendário inteiro de um cliente, chame limpar_calendario só com o client_id (sem datas).
- Ações que modificam dados geram uma PROPOSTA que o usuário confirma na interface. Após chamá-las, explique de forma curta o que será feito e diga que aguarda a confirmação. Não afirme que algo foi feito antes da confirmação.
- Seja conciso e direto, em português do Brasil.`;

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
const WRITE_TOOLS = ["criar_card", "adicionar_conteudo", "preencher_card", "enviar_para_producao", "remover_card", "limpar_calendario", "criar_calendario_recorrente"];

// ── POST /api/assistant/chat ──────────────────────────────────────────
router.post("/chat", async (req: AuthRequest, res: Response): Promise<void> => {
  const { messages } = req.body; // histórico [{role, content}]
  if (!Array.isArray(messages)) { res.status(400).json({ error: "messages deve ser array" }); return; }

  try {
    const settings = await getCompanySettings();
    const apiKey = (settings as any)?.anthropic_api_key;
    if (!apiKey) { res.status(400).json({ error: "Anthropic API Key não configurada nas Configurações." }); return; }

    const anthropic = new Anthropic({ apiKey });
    // Normaliza o histórico para o formato Claude (content como string)
    const convo: Anthropic.MessageParam[] = (messages as any[])
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: String(m.content ?? "") }));
    const proposals: any[] = [];

    // Loop de tool calling (máx 6 iterações para segurança)
    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages: convo,
      });

      // Anexa a resposta do assistente (blocos de conteúdo) ao histórico
      convo.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      if (toolUses.length === 0) {
        // Resposta final — extrai texto
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map(b => b.text)
          .join("\n")
          .trim();
        res.json({ reply, proposals });
        return;
      }

      // Processa cada tool_use e devolve tool_result como mensagem do usuário
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const fnName = tu.name;
        const args: any = tu.input || {};

        if (WRITE_TOOLS.includes(fnName)) {
          // Gera proposta — não executa
          const proposal = await buildProposal(fnName, args);
          proposals.push(proposal);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify({ status: "proposta_criada_aguardando_confirmacao", resumo: proposal.label }),
          });
        } else {
          const result = await execReadTool(fnName, args, req.user!.id);
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
        }
      }
      convo.push({ role: "user", content: toolResults });
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
  if (fnName === "remover_card") {
    const post = await (prisma as any).calendarPost.findUnique({
      where: { id: args.post_id }, select: { title: true, scheduled_date: true, type: true },
    });
    const quando = post ? new Date(post.scheduled_date).toLocaleDateString("pt-BR") : "";
    return {
      id: Math.random().toString(36).slice(2),
      type: "remover_card",
      label: `Remover ${post?.type || "post"} "${post?.title || args.post_id}"${quando ? ` (${quando})` : ""}`,
      payload: { post_id: args.post_id },
    };
  }
  if (fnName === "limpar_calendario") {
    const client = await prisma.client.findUnique({ where: { id: args.client_id }, select: { name: true } });
    const where: any = { client_id: args.client_id };
    let periodo = "(todo o calendário)";
    if (args.data_inicio && args.data_fim) {
      const inicio = new Date(args.data_inicio + "T00:00:00Z");
      const fim = new Date(args.data_fim + "T23:59:59Z");
      where.scheduled_date = { gte: inicio, lte: fim };
      periodo = `entre ${args.data_inicio} e ${args.data_fim}`;
    }
    const count = await (prisma as any).calendarPost.count({ where });
    return {
      id: Math.random().toString(36).slice(2),
      type: "limpar_calendario",
      label: `Apagar ${count} post(s) de ${client?.name || "cliente"} ${periodo}`,
      payload: { client_id: args.client_id, data_inicio: args.data_inicio || null, data_fim: args.data_fim || null },
    };
  }
  if (fnName === "criar_calendario_recorrente") {
    const client = await prisma.client.findUnique({ where: { id: args.client_id }, select: { name: true } });
    const itens = expandirRecorrencia(args.data_inicio, args.data_fim, args.regras || []);
    // Resumo por tipo
    const porTipo: Record<string, number> = {};
    for (const it of itens) porTipo[it.tipo] = (porTipo[it.tipo] || 0) + 1;
    const resumo = (args.regras || [])
      .map((r: any) => `${r.dia_semana.toLowerCase()} → ${r.tipo}`)
      .join(", ");
    const totais = Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(", ");
    return {
      id: Math.random().toString(36).slice(2),
      type: "criar_calendario_recorrente",
      label: `Criar ${itens.length} card(s) para ${client?.name || "cliente"} (${resumo}) — ${totais} — de ${args.data_inicio} a ${args.data_fim}`,
      payload: {
        client_id: args.client_id,
        platform: args.plataforma || "INSTAGRAM",
        itens, // datas já calculadas no backend
      },
    };
  }
  return { id: Math.random().toString(36).slice(2), type: fnName, label: "Ação", payload: args };
}

// ── POST /api/assistant/execute ───────────────────────────────────────
// Executa uma ação previamente confirmada pelo usuário
router.post("/execute", async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, payload } = req.body;
  try {
    // Valida que o cliente existe antes de criar (evita erro cru de FK quando o ID é inválido)
    if ((type === "criar_card" || type === "adicionar_conteudo" || type === "criar_calendario_recorrente")) {
      if (!payload.client_id) {
        res.status(400).json({ error: "Cliente não informado. Peça ao assistente para buscar o cliente primeiro." });
        return;
      }
      const cliente = await prisma.client.findUnique({ where: { id: payload.client_id }, select: { id: true } });
      if (!cliente) {
        res.status(400).json({ error: "Cliente não encontrado. Use 'buscar cliente <nome>' para selecionar um cliente válido antes de criar conteúdo." });
        return;
      }
    }

    if (type === "criar_card") {
      const datas: string[] = payload.datas || [];
      const created = await Promise.all(datas.map((d: string) =>
        (prisma as any).calendarPost.create({
          data: {
            client_id: payload.client_id,
            title: null,
            type: payload.type || "POST",
            platform: payload.platform || "INSTAGRAM",
            scheduled_date: new Date(d + "T12:00:00Z"),
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
          scheduled_date: dayDate(payload.scheduled_date)!,
          status: "PLANEJADO",
        },
        include: { client: { select: { name: true } } },
      });
      res.json({ success: true, message: `Conteúdo "${post.title}" adicionado ao calendário.`, post });
      return;
    }

    if (type === "enviar_para_producao") {
      const { post, trello, task } = await sendPostToProduction(payload.post_id);
      const extras = [
        trello ? "card no Trello" : null,
        task ? "tarefa no Tasqui" : null,
      ].filter(Boolean).join(" + ");
      res.json({
        success: true,
        message: `"${post.title || "Post"}" enviado para produção${extras ? ` (${extras})` : " (Trello não configurado)"}.`,
        trello_url: trello?.shortUrl || null,
      });
      return;
    }

    if (type === "remover_card") {
      const post = await (prisma as any).calendarPost.findUnique({ where: { id: payload.post_id }, select: { title: true } });
      await (prisma as any).calendarPost.delete({ where: { id: payload.post_id } });
      res.json({ success: true, message: `Card "${post?.title || payload.post_id}" removido do calendário.` });
      return;
    }

    if (type === "limpar_calendario") {
      const where: any = { client_id: payload.client_id };
      if (payload.data_inicio && payload.data_fim) {
        const inicio = new Date(payload.data_inicio + "T00:00:00Z");
        const fim = new Date(payload.data_fim + "T23:59:59Z");
        where.scheduled_date = { gte: inicio, lte: fim };
      }
      const result = await (prisma as any).calendarPost.deleteMany({ where });
      res.json({ success: true, message: `${result.count} post(s) removido(s) do calendário.` });
      return;
    }

    if (type === "criar_calendario_recorrente") {
      const itens: { data: string; tipo: string }[] = payload.itens || [];
      if (!itens.length) { res.json({ success: true, message: "Nenhuma data correspondente às regras no período." }); return; }
      const result = await (prisma as any).calendarPost.createMany({
        data: itens.map(it => ({
          client_id: payload.client_id,
          title: null,
          type: it.tipo,
          platform: payload.platform || "INSTAGRAM",
          scheduled_date: new Date(it.data + "T12:00:00Z"),
          status: "PLANEJADO",
        })),
      });
      res.json({ success: true, message: `${result.count} card(s) criado(s) nos dias corretos. Agora é só preencher o conteúdo.` });
      return;
    }

    res.status(400).json({ error: "Tipo de ação desconhecido" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
