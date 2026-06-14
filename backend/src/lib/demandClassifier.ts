import Anthropic from "@anthropic-ai/sdk";
import { getCompanySettings } from "./companySettings";

export interface DemandResult {
  is_demand: boolean;
  summary: string;
  category: string; // ARTE, SITE, TRAFEGO, ATENDIMENTO, FINANCEIRO, OUTRO
}

const SYSTEM = `Você é o filtro de demandas de uma agência de marketing. Recebe UMA mensagem
enviada por um cliente no grupo de WhatsApp dele. Sua tarefa: decidir se a mensagem
contém uma DEMANDA/SOLICITAÇÃO acionável para a agência (algo a fazer, ajustar, criar,
responder ou resolver) ou se é apenas conversa/ruído (saudação, agradecimento, emoji,
piada, confirmação simples como "ok", "obrigado").

Responda SOMENTE com um JSON válido, sem texto extra, no formato:
{"is_demand": true|false, "summary": "frase curta no imperativo do que precisa ser feito", "category": "ARTE|SITE|TRAFEGO|ATENDIMENTO|FINANCEIRO|OUTRO"}

Se não for demanda, use is_demand=false e summary "".
Exemplos de demanda: "podem trocar o telefone no site?", "preciso de um post pro dia das mães",
"a campanha tá gastando muito, dá uma olhada", "manda o relatório do mês".
Exemplos de NÃO demanda: "bom dia!", "kkkk", "valeu", "ok", "perfeito", "👍".`;

// Classifica uma mensagem. Retorna null se não houver chave de API.
export async function classifyDemand(text: string): Promise<DemandResult | null> {
  const settings = await getCompanySettings();
  const apiKey = (settings as any)?.anthropic_api_key;
  if (!apiKey) return null;
  if (!text || text.trim().length < 4) return { is_demand: false, summary: "", category: "OUTRO" };

  const anthropic = new Anthropic({ apiKey });
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    });
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text).join("").trim();
    const json = raw.replace(/^```json?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(json);
    return {
      is_demand: !!parsed.is_demand,
      summary: String(parsed.summary || "").trim(),
      category: String(parsed.category || "OUTRO").toUpperCase(),
    };
  } catch (e: any) {
    console.warn("[Demanda] classificação falhou:", e.message);
    return null;
  }
}
