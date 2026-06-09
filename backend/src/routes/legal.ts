import { Router, Request, Response } from "express";

const router = Router();

const EMPRESA = "Pequi Digital";
const CONTATO = "ginannymoreira@gmail.com";
const DOMINIO = "https://leadqui.vps.pequi.digital";
const ATUALIZADO = "09 de junho de 2026";

const layout = (titulo: string, conteudo: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo} — ${EMPRESA}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0a0a0a; color: #1a1a1a;
    }
    .wrap { max-width: 760px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 56px 40px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom: 32px; }
    .brand .dot { width: 14px; height: 28px; border-radius: 99px; background: linear-gradient(135deg,#f97316,#eab308); }
    .brand h1 { font-size: 20px; margin: 0; color:#111; }
    h2 { font-size: 26px; margin: 0 0 6px; color:#111; }
    .updated { color:#888; font-size: 13px; margin-bottom: 32px; }
    h3 { font-size: 16px; margin: 28px 0 8px; color:#111; }
    p, li { font-size: 14px; line-height: 1.7; color:#333; }
    ul { padding-left: 20px; }
    a { color:#f97316; }
    .footer { margin-top: 48px; padding-top: 20px; border-top:1px solid #eee; font-size:12px; color:#999; }
    @media (max-width: 600px) { .wrap { padding: 32px 20px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><div class="dot"></div><h1>🍈 ${EMPRESA}</h1></div>
    ${conteudo}
    <div class="footer">
      ${EMPRESA} · Contato: <a href="mailto:${CONTATO}">${CONTATO}</a><br/>
      ${DOMINIO}
    </div>
  </div>
</body>
</html>`;

// ── Política de Privacidade ───────────────────────────────────────────
router.get("/privacidade", (_req: Request, res: Response) => {
  const html = layout("Política de Privacidade", `
    <h2>Política de Privacidade</h2>
    <p class="updated">Última atualização: ${ATUALIZADO}</p>

    <p>Esta Política de Privacidade descreve como a ${EMPRESA} ("nós") coleta, usa e protege as
    informações ao utilizar nossa plataforma de gestão de marketing digital e suas integrações com
    as APIs da Meta (Facebook e Instagram).</p>

    <h3>1. Informações que coletamos</h3>
    <ul>
      <li><strong>Dados de conta Meta/Instagram:</strong> ao conectar uma conta, coletamos identificadores
      da conta, nome de usuário, tokens de acesso e dados de páginas e contas de anúncios autorizadas.</li>
      <li><strong>Conteúdo:</strong> publicações, legendas, comentários e métricas de desempenho das contas conectadas.</li>
      <li><strong>Dados operacionais:</strong> informações de clientes, leads e campanhas inseridas por nossos usuários.</li>
    </ul>

    <h3>2. Como usamos as informações</h3>
    <ul>
      <li>Publicar e agendar conteúdo no Instagram em nome das contas conectadas;</li>
      <li>Responder automaticamente a comentários conforme regras configuradas pelo usuário;</li>
      <li>Exibir métricas e relatórios de campanhas de anúncios;</li>
      <li>Gerar análises e sugestões de otimização.</li>
    </ul>

    <h3>3. Compartilhamento de dados</h3>
    <p>Não vendemos nem compartilhamos seus dados com terceiros, exceto provedores estritamente
    necessários ao funcionamento do serviço (ex: Meta Platforms, provedores de IA para geração de
    respostas) e quando exigido por lei.</p>

    <h3>4. Armazenamento e segurança</h3>
    <p>Os dados são armazenados em servidores seguros. Tokens de acesso e credenciais sensíveis são
    protegidos com criptografia. Aplicamos controles de acesso por função de usuário.</p>

    <h3>5. Retenção e exclusão de dados</h3>
    <p>Mantemos os dados enquanto a conta estiver conectada. Você pode desconectar uma conta a qualquer
    momento, o que remove os tokens e interrompe o acesso. Para solicitar a exclusão completa dos seus
    dados, entre em contato pelo e-mail <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>

    <h3>6. Seus direitos</h3>
    <p>Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais a qualquer momento,
    conforme a Lei Geral de Proteção de Dados (LGPD).</p>

    <h3>7. Alterações</h3>
    <p>Esta política pode ser atualizada periodicamente. A data da última atualização é indicada no topo.</p>

    <h3>8. Contato</h3>
    <p>Dúvidas sobre privacidade: <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>
  `);
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
});

// ── Termos de Serviço ─────────────────────────────────────────────────
router.get("/termos", (_req: Request, res: Response) => {
  const html = layout("Termos de Serviço", `
    <h2>Termos de Serviço</h2>
    <p class="updated">Última atualização: ${ATUALIZADO}</p>

    <p>Ao utilizar a plataforma ${EMPRESA}, você concorda com estes Termos de Serviço.</p>

    <h3>1. Uso do serviço</h3>
    <p>A plataforma oferece ferramentas de gestão de leads, clientes, agendamento de conteúdo no
    Instagram, gestão de campanhas de anúncios e automação de respostas a comentários.</p>

    <h3>2. Responsabilidades do usuário</h3>
    <ul>
      <li>Conectar apenas contas que você tem autorização para gerenciar;</li>
      <li>Usar o serviço em conformidade com as políticas da Meta e leis aplicáveis;</li>
      <li>Manter a confidencialidade de suas credenciais de acesso.</li>
    </ul>

    <h3>3. Integrações com a Meta</h3>
    <p>Ao conectar contas do Facebook e Instagram, você autoriza a plataforma a acessar e gerenciar
    o conteúdo conforme as permissões concedidas. O uso segue os Termos da Plataforma Meta.</p>

    <h3>4. Limitação de responsabilidade</h3>
    <p>O serviço é fornecido "como está". Não nos responsabilizamos por indisponibilidades de APIs
    de terceiros ou por uso indevido da plataforma.</p>

    <h3>5. Exclusão de dados</h3>
    <p>Para excluir seus dados, desconecte as contas na plataforma ou solicite por
    <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>

    <h3>6. Contato</h3>
    <p><a href="mailto:${CONTATO}">${CONTATO}</a></p>
  `);
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
});

// ── Exclusão de dados (instruções) ────────────────────────────────────
router.get("/exclusao-de-dados", (_req: Request, res: Response) => {
  const html = layout("Exclusão de Dados", `
    <h2>Solicitação de Exclusão de Dados</h2>
    <p class="updated">Última atualização: ${ATUALIZADO}</p>

    <p>Você pode solicitar a exclusão de todos os dados associados à sua conta a qualquer momento.</p>

    <h3>Como solicitar</h3>
    <ul>
      <li><strong>Pela plataforma:</strong> acesse TechQui → Conexões e desvincule a conta. Isso remove
      imediatamente os tokens de acesso e dados relacionados àquela conta.</li>
      <li><strong>Por e-mail:</strong> envie um pedido para <a href="mailto:${CONTATO}">${CONTATO}</a>
      com o assunto "Exclusão de Dados", informando a conta a ser removida.</li>
    </ul>
    <p>Processaremos a exclusão em até 30 dias e confirmaremos por e-mail.</p>
  `);
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
});

export default router;
