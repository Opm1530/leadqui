# Fluxo completo — do Lead à Arte Postada

Jornada de ponta a ponta no ecossistema Pequi Digital / Leadqui, do primeiro
contato (lead) até o post publicado na rede social, com os módulos, status e
endpoints envolvidos em cada etapa.

```
LEAD ─► CRM ─► CLIENTE ─► CALENDÁRIO ─► PRODUÇÃO ─► ARTE ─► APROVAÇÃO ─► AGENDAMENTO ─► PUBLICADO
(Leadqui)     (conversão)  (Tasqui)     (Trello+Tasqui)(Trello)(WhatsApp)   (Instagram)
```

---

## 1. Captação do Lead — *Leadqui*
- **Como entra:** extração automática (Google Maps via Serper, Instagram via Apify)
  ou cadastro manual. Campo de **descrição/observação** disponível.
- **Onde:** página *Leads*. Dedup global por telefone/empresa.
- **Status do lead:** `NOVO → CONTATADO → QUALIFICADO → CONVERTIDO`.
- **Endpoints:** `POST /api/leads`, `POST /api/extractions`.

## 2. Qualificação no funil — *CRM*
- Lead vira **card no CRM**, arrastável entre colunas (kanban) com reordenação.
- **Endpoints:** `POST /api/crm/cards`, colunas configuráveis.

## 3. Conversão em Cliente — *Leadqui → Teamqui/Tasqui*
- Ao converter, o lead vira **Cliente**:
  - cria o registro de `Client` + **contrato** (valor, duração, responsável) + serviços;
  - opcionalmente cria um **login CLIENT** (acesso ao ViewQui) com senha inicial;
  - marca o lead de origem como `CONVERTIDO` (`origin_lead_id`);
  - dispara a **automação operacional** (`createOperationalFlow`): cria projetos
    e aplica template de tarefas conforme os serviços contratados.
  - vincula o **grupo de WhatsApp** do cliente (instância + grupo) para aprovação.
- **Endpoint:** `POST /api/clients`.

## 4. Calendário Editorial — *Tasqui*
- Para clientes de Social Media, monta-se o **calendário editorial**.
- **Duas formas de criar:**
  1. **Manual** — na página *Calendário*, card a card (cliente + formato + dia),
     conteúdo preenchido depois.
  2. **Pelo Assistente (Claude)** — em linguagem natural. Padrões semanais usam
     `criar_calendario_recorrente`: o backend calcula as datas exatas por dia da
     semana (sem erro de "sexta caindo na quinta"). Também cria/limpa/preenche.
- **Status do post:** `PLANEJADO`.
- **Endpoints:** `POST /api/tasqui/calendar`, assistente `/api/assistant/chat`.

## 5. Envio para Produção — *Tasqui → Trello + Tasqui*
- No card `PLANEJADO`, botão **"🎬 Enviar para Produção"** abre um modal que
  carrega do Trello em tempo real: **Lista**, **Responsável** e **Etiquetas**.
- Ao confirmar:
  - status → `PRODUZINDO` (destaque pulsante no calendário);
  - cria o **card no Trello** (lista + responsável + tags + prazo);
  - cria automaticamente uma **tarefa no Tasqui** (projeto "Produção de Conteúdo"
    do cliente, com prazo = data do post e link do Trello).
- **Endpoint:** `POST /api/tasqui/calendar/:id/send-production`.

## 6. Designer conclui + captura da arte — *Trello → Tasqui*
- O **designer anexa a arte** no card do Trello e o move para a lista **"Concluído"**.
- O **webhook do Trello** dispara: o sistema acha o post pelo `trello_card_id`,
  **puxa o anexo (a arte)** via API e salva em `media_urls`.
- Status → `ARTE_PRONTA` (cor ciano no calendário).
- **Endpoint:** `POST /api/techqui/webhook/trello` (registrado uma vez nas Configurações).

## 7. Aprovação do Cliente — *WhatsApp (Evolution)*
- No card `ARTE_PRONTA`, botão **"Enviar para aprovação do cliente"** dispara no
  **grupo de WhatsApp** do cliente: **arte + legenda + enquete ✅ Aprovar / ❌ Reprovar**.
- Status → `AGUARDANDO_APROVACAO` (âmbar).
- **O cliente responde no grupo** e o **webhook do Evolution** interpreta:
  - **Aprovar** → status `APROVADO`; sistema responde "Aprovado! ✅".
  - **Reprovar** → pergunta o motivo (ou capta inline), salva `rejection_reason`
    e volta para `PRODUZINDO` com o ajuste visível para a equipe.
- **Endpoints:** `POST /api/tasqui/calendar/:id/send-approval`, `POST /api/whatsapp/webhook`.

## 8. Agendamento e Publicação — *Instagram (Graph API)*
- Com o post `APROVADO` (plataforma Instagram), botão **"Publicar no Instagram"**:
  define data/hora e mídias, cria o `InstagramScheduledPost`, sobe o container de
  mídia, aguarda ficar pronto (`waitForMediaReady`) e publica.
- Status final → `PUBLICADO` (verde).
- **Endpoint:** `POST /api/tasqui/calendar/:id/publish-instagram`.

---

## Linha do tempo dos status do post
```
PLANEJADO ─► PRODUZINDO ─► ARTE_PRONTA ─► AGUARDANDO_APROVACAO ─► APROVADO ─► PUBLICADO
                 ▲                                  │
                 └──────── reprovado (com motivo) ──┘
```

## Integrações por etapa
| Etapa | Módulo | Integração externa |
|---|---|---|
| Captação | Leadqui | Serper (Maps), Apify (Instagram) |
| Conversão | Leadqui/Tasqui | — |
| Calendário | Tasqui | Claude (Anthropic) — assistente |
| Produção | Tasqui | Trello (card) + Tasqui (tarefa) |
| Arte pronta | TechQui | Trello (webhook + anexos) |
| Aprovação | TechQui | Evolution API (WhatsApp) |
| Publicação | TechQui | Meta Graph API (Instagram) |

## Configuração necessária (uma vez)
- **APIs** (Configurações → Geral): Serper, Apify, Anthropic, Evolution.
- **Trello** (Configurações → Trello): API Key + Token → escolher quadro,
  lista padrão e lista "Concluído" → **Registrar webhook**.
- **Evolution**: apontar o webhook da instância para
  `https://leadqui.vps.pequi.digital/api/whatsapp/webhook` (evento `messages.upsert`).
- **Meta/Instagram** (Configurações → Meta): app + conexão OAuth por cliente.
