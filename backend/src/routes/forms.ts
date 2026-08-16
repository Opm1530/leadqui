import { Router, Request, Response } from "express";
import express from "express";
import cors from "cors";
import prisma from "../lib/prisma";

// ── Webhook público de captação de leads (formulários / landing pages) ──
// Montado ANTES do CORS global, com CORS liberado e parsers próprios,
// pra aceitar POST de qualquer domínio (landing pages externas).
const router = Router();
router.use(cors({ origin: true, methods: ["POST", "OPTIONS"] }));
router.use(express.json({ limit: "512kb" }));
router.use(express.urlencoded({ extended: true }));

// Rate-limit simples em memória: máx. 30 submissões/min por IP.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

// Aceita variações comuns de nome de campo (form HTML e ferramentas).
function pick(body: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = body?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

router.options("/:token", cors({ origin: true }), (_req, res) => { res.sendStatus(204); });

router.post("/:token", async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token);
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  try {
    if (tooMany(ip)) { res.status(429).json({ error: "Muitas requisições. Aguarde um instante." }); return; }

    const ep = await (prisma as any).formEndpoint.findUnique({ where: { token } });
    if (!ep || !ep.active) { res.status(404).json({ error: "Formulário não encontrado ou inativo." }); return; }

    const body = req.body || {};
    // Honeypot: campo escondido que só bot preenche.
    const isSpam = !!pick(body, ["_hp", "_gotcha", "honeypot"]);

    const nome = pick(body, ["nome", "name", "nome_completo", "full_name", "fullname", "seu_nome"]);
    const email = pick(body, ["email", "e-mail", "e_mail", "seu_email"]);
    const telefone = pick(body, ["telefone", "phone", "whatsapp", "celular", "tel", "fone", "seu_telefone"]);
    const cidade = pick(body, ["cidade", "city"]);
    const observacao = pick(body, ["mensagem", "message", "msg", "observacao", "assunto", "duvida"]);

    let leadId: string | null = null;
    if (!isSpam && (nome || email || telefone)) {
      const lead = await prisma.lead.create({
        data: {
          user_id: ep.user_id,
          nome: nome || email || telefone || "Contato do formulário",
          telefone: telefone || null,
          telefone_limpo: telefone ? telefone.replace(/\D/g, "") : null,
          email: email || null,
          cidade: cidade || null,
          observacao: observacao || null,
          origem: "FORMULARIO" as any,
          status: "NOVO",
          responsavel_proposto: ep.default_responsavel || null,
        },
      });
      leadId = lead.id;
      // Tags padrão do formulário
      if (Array.isArray(ep.default_tag_ids) && ep.default_tag_ids.length) {
        await (prisma as any).leadTag.createMany({
          data: ep.default_tag_ids.map((tag_id: string) => ({ lead_id: lead.id, tag_id })),
          skipDuplicates: true,
        }).catch(() => {});
      }
      await (prisma as any).formEndpoint.update({ where: { id: ep.id }, data: { submissions_count: { increment: 1 } } }).catch(() => {});
    }

    await (prisma as any).formSubmission.create({
      data: { endpoint_id: ep.id, lead_id: leadId, payload: body, ip, spam: isSpam },
    }).catch(() => {});

    if (ep.redirect_url) { res.status(303).setHeader("Location", ep.redirect_url); res.end(); return; }
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[Forms webhook] erro:", e.message);
    res.status(500).json({ error: "Erro ao processar o formulário." });
  }
});

export default router;
