import Anthropic from "@anthropic-ai/sdk";
import { getCompanySettings } from "./companySettings";

// Modelo usado pelo SDR. Haiku 4.5 dá boa qualidade de copy a baixo custo.
const MODEL = "claude-haiku-4-5";

async function client(): Promise<Anthropic> {
  const s = (await getCompanySettings()) as any;
  if (!s?.anthropic_api_key) throw new Error("Anthropic API Key não configurada nas Configurações.");
  return new Anthropic({ apiKey: s.anthropic_api_key });
}

export interface Playbook {
  icp?: string | null; offer?: string | null; tone?: string | null; qualifying?: string | null;
  first_msg_guidance?: string | null; followup_guidance?: string | null; goal?: string | null;
}

function systemPrompt(pb: Playbook): string {
  return `Você é uma SDR (pré-vendas) brasileira da agência de marketing "Pequi Digital". Você conversa por WhatsApp.
OBJETIVO: ${pb.goal || "iniciar uma conversa e agendar uma reunião com o dono do negócio"}.
CLIENTE IDEAL (ICP): ${pb.icp || "—"}
OFERTA: ${pb.offer || "—"}
TOM DE VOZ: ${pb.tone || "próximo, humano e informal, como uma conversa real no WhatsApp"}
QUALIFICAÇÃO (o que você quer descobrir ao longo da conversa): ${pb.qualifying || "interesse, quem cuida do marketing hoje, se já investe em anúncios, meta de crescimento"}

REGRAS:
- Escreva como um brasileiro real no WhatsApp: curto, natural, sem textão e sem parecer robô.
- Personalize com o que souber do lead (nome, cidade, tipo de negócio). NUNCA invente dados.
- Uma pergunta por vez. Conduza para a reunião sem ser insistente ou apelativo.
- Não prometa resultados garantidos. Nada de emojis em excesso (no máximo 1).
- Se a pessoa pedir para parar ou disser que não tem interesse, agradeça com educação e encerre.`;
}

const leadCtx = (lead: any) =>
  `Dados do lead: nome=${lead?.nome || "?"}; tipo/categoria=${lead?.categoria || "?"}; cidade=${lead?.cidade || "?"}; ` +
  `telefone=${lead?.telefone || "?"}; observação=${lead?.observacao || "—"}.`;

const textOf = (r: any) => r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();

// 1º contato (prospecção fria): gera a mensagem de abertura.
export async function generateFirstContact(lead: any, pb: Playbook): Promise<string> {
  const a = await client();
  const r = await a.messages.create({
    model: MODEL, max_tokens: 400, system: systemPrompt(pb),
    messages: [{ role: "user", content: `${leadCtx(lead)}\n\nEscreva a PRIMEIRA mensagem de abordagem no WhatsApp para esse lead. ${pb.first_msg_guidance || "Abertura curta e humana, deixe claro que é sobre crescer os pedidos/chamadas do delivery, gere curiosidade e termine com uma pergunta leve."}\n\nResponda SOMENTE com o texto da mensagem, sem aspas e sem explicações.` }],
  });
  return textOf(r);
}

export interface ReplyResult {
  reply: string;
  opt_out: boolean;      // pediu para parar / sem interesse
  wants_meeting: boolean; // demonstrou querer reunião / horário
  qualified: boolean;     // parece um lead qualificado
  stage: string;          // NOVO | ABORDADO | EM_CONVERSA | QUALIFICADO | REUNIAO | PERDIDO
  note: string;           // resumo curto do estado da conversa
}

// Resposta a uma mensagem do lead + sinais de qualificação/intenção.
export async function generateReply(pb: Playbook, lead: any, history: { from: "lead" | "sdr"; text: string }[]): Promise<ReplyResult> {
  const a = await client();
  const convo = history.map(h => `${h.from === "lead" ? "LEAD" : "SDR"}: ${h.text}`).join("\n");
  const r = await a.messages.create({
    model: MODEL, max_tokens: 600, system: systemPrompt(pb),
    messages: [{
      role: "user",
      content: `${leadCtx(lead)}\n\nHistórico da conversa:\n${convo}\n\nGere a próxima resposta da SDR e avalie a conversa. Responda em JSON válido, apenas o objeto, no formato:\n{"reply":"<mensagem curta pro WhatsApp>","opt_out":false,"wants_meeting":false,"qualified":false,"stage":"EM_CONVERSA","note":"<resumo curto>"}\nEstágios possíveis: NOVO, ABORDADO, EM_CONVERSA, QUALIFICADO, REUNIAO, PERDIDO. Se o lead pediu para parar, opt_out=true e stage=PERDIDO.`,
    }],
  });
  const raw = textOf(r);
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      reply: String(json.reply || ""),
      opt_out: !!json.opt_out,
      wants_meeting: !!json.wants_meeting,
      qualified: !!json.qualified,
      stage: String(json.stage || "EM_CONVERSA"),
      note: String(json.note || ""),
    };
  } catch {
    return { reply: raw, opt_out: false, wants_meeting: false, qualified: false, stage: "EM_CONVERSA", note: "" };
  }
}
