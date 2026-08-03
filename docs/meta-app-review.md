# Kit de submissão — Meta App Review (Pequi Digital / Leadqui)

> Objetivo: liberar **Acesso Avançado** das permissões para funcionar nas contas dos **clientes**.
> Enquanto não sai, tudo já funciona na conta da própria Pequi (que tem papel no app).

> **Estratégia em 2 levas** (App Review é incremental — o aprovado fica aprovado):
> - **1ª leva (agora):** conexão + Instagram (publicar + comentários). Inclui `business_management` (para achar o IG no Business Manager, **não** para Ads).
> - **2ª leva (depois):** `ads_read` + `ads_management` — abrir nova solicitação quando quiser. Nenhuma mudança de código é necessária.
> No painel, apague `ads_read` e `ads_management` desta submissão (mantenha `business_management`).

## 🥇 Regras de ouro (leia antes)
1. **Escreva os campos de justificativa em INGLÊS.** Os revisores são internacionais; PT reduz a chance de aprovação.
2. **A tela do app pode estar em português** no screencast — tudo bem. Só narre/descreva os passos em inglês na caixa de instruções.
3. **Entregue um usuário de teste + passo-a-passo.** 80% das reprovações são "não consegui reproduzir".
4. **O vídeo tem que MOSTRAR a permissão sendo usada de verdade** (o comentário sendo respondido, o post sendo publicado, a campanha aparecendo).
5. Envie **uma permissão bem explicada por vez** — não jogue tudo junto sem contexto.
6. App precisa estar em **modo Ativo (Live)** e vinculado ao Business.

---

## 📋 Dados do app (para colar nos campos)
- **App URL:** https://leadqui.vps.pequi.digital
- **OAuth Redirect (Facebook):** https://leadqui.vps.pequi.digital/api/techqui/oauth/callback
- **Webhook Callback (Instagram):** https://leadqui.vps.pequi.digital/api/techqui/webhook/instagram
- **Webhook Verify Token:** `pequi_webhook_2026` (env `META_WEBHOOK_VERIFY_TOKEN`)
- **Privacidade / Termos / Exclusão de dados:** páginas públicas em `/api/legal/*` (confirme as URLs no painel).

## 👤 Usuário de teste para o revisor (JÁ CRIADO)
```
URL:   https://leadqui.vps.pequi.digital
Email: reviewer@pequidigital.com.br
Senha: MetaReview#2026
Cliente demo: "Conta Demo"  (o revisor conecta o próprio Instagram nele)
```
> **NÃO forneça credenciais de Instagram** — apenas o login do app acima. O revisor conecta a própria conta profissional de Instagram.
> A Meta pede que os passos de teste fiquem **dentro da caixa de descrição de cada permissão** (não numa aba separada). Por isso cada permissão abaixo já traz o bloco "HOW TO TEST".

---

## 🔐 Por permissão — justificativa (EN) + passos do revisor + roteiro do vídeo

### 1) `pages_show_list`
**Para que serve (PT):** listar as Páginas do Facebook do usuário para ele escolher qual conectar ao cliente.
**Justification (paste in EN):**
> Our platform lets a marketing agency connect a client's Facebook Page. We use `pages_show_list` to display the Pages the user manages so they can select which one to link to a client profile. No data is stored beyond the selected Page's id/name/token.

**Reviewer steps (EN):**
> 1. Log in. 2. Open "Clientes" and select a client. 3. Open the "Meta" tab → "Conexões". 4. Click "Conectar Facebook" and complete Facebook login. 5. The app shows the list of Pages to choose from — this uses `pages_show_list`.

---

### 2) `pages_read_engagement`
**Para que serve (PT):** ler dados da Página (e o Instagram vinculado) para leitura de comentários/engajamento.
**Justification (EN):**
> We use `pages_read_engagement` to read the connected Page and its linked Instagram professional account, so the agency can view engagement and manage comments on behalf of the client who granted access.

**Reviewer steps (EN):** same connection flow as above; after connecting, open "Meta → Auto-reply" to see engagement/comment features tied to the Page.

---

### 3) `business_management`
**Para que serve (PT):** descobrir e acessar a **conta profissional de Instagram** que está dentro do Business Manager do cliente, quando o IG não está vinculado direto a uma Página. (Não é usada para Ads nesta submissão.)
**Justification (EN):**
> We use `business_management` to discover the client's Instagram professional account that lives inside their Business Manager (when the Instagram account is not directly linked to a Facebook Page). This lets the agency connect and manage the correct Instagram account for content publishing and comment management on behalf of the client who granted access.

**Reviewer steps (EN):**
> 1. Log in and open "Clientes" → select a client → "Meta" tab → "Conexões". 2. Click "Conectar Facebook" (or "Conectar Instagram") and complete login. 3. The app reads the Business Manager to locate the Instagram professional account and shows it available to connect — this uses `business_management`.

---

### 4) `ads_read`  — ⏳ 2ª LEVA (não enviar agora)
**Para que serve (PT):** ler campanhas e métricas de anúncios.
**Justification (EN):**
> We use `ads_read` to display the client's ad campaigns and their performance metrics inside the agency dashboard for reporting and monitoring.

**Reviewer steps (EN):**
> 1. Connect Facebook (with an ad account). 2. Open "Meta" tab → "Meta Ads". 3. The app lists the campaigns and metrics read via `ads_read`.

---

### 5) `ads_management`  — ⏳ 2ª LEVA (não enviar agora)
**Para que serve (PT):** agir sobre campanhas — pausar/ativar e ajustar orçamento.
**Justification (EN):**
> We use `ads_management` to let the agency take actions on the client's campaigns (pause/resume and adjust daily budget) directly from our dashboard, based on the agency's optimization decisions.

**Reviewer steps (EN):**
> 1. Open "Meta" → "Meta Ads". 2. On a campaign, click Pause/Activate or change the daily budget. 3. The write action is performed via `ads_management`.
**Roteiro do vídeo (PT):** mostre a lista de campanhas, clique em **pausar** uma campanha e mostre o status mudando.

---

### 6) `instagram_manage_comments`  (e `instagram_business_manage_comments` no Instagram Login)
**Para que serve (PT):** ler e **responder** comentários do Instagram do cliente (auto-reply por regra fixa ou IA).
**Justification (EN):**
> We use `instagram_manage_comments` to read incoming comments on the client's Instagram media and reply to them (either a fixed reply or an AI-generated reply) according to rules the agency configures. This automates community management for the client who authorized it.

**Reviewer steps (EN):**
> 1. Connect Instagram (Meta → Conexões → "Conectar Instagram"). 2. Open "Meta" → "Auto-reply". 3. Create a rule (fixed reply). 4. Post a comment on the connected test IG account. 5. The app receives the webhook and replies automatically — this uses `instagram_manage_comments`.
**Roteiro do vídeo (PT):** crie a regra, comente no post da conta de teste, e mostre a **resposta automática aparecendo** no Instagram + no log de comentários do sistema.

---

### 7) `instagram_content_publish`  (e `instagram_business_content_publish` no Instagram Login)
**Para que serve (PT):** publicar/agendar posts no Instagram do cliente a partir do módulo Editorial.
**Justification (EN):**
> We use `instagram_content_publish` to publish content the agency produced and scheduled for the client. In our "Editorial" module the agency creates the content, attaches the media, sets a date/time and, after internal approval, our scheduler publishes it to the client's Instagram automatically.

**Reviewer steps (EN):**
> 1. Open "Editorial" from the Hub. 2. Create a content, attach an image, set a date/time a few minutes ahead, enable "Agendar publicação automática", and approve it. 3. At the scheduled time our backend publishes it via `instagram_content_publish`. (The content card shows "Agendado" → "Publicado".)
**Roteiro do vídeo (PT):** crie o conteúdo, anexe a imagem, marque agendar para ~2 min, aprove; mostre o selo **Agendado** e depois **Publicado**, e o post no perfil do Instagram.

---

### (Se usar o produto "Instagram Login" / login sem Página)
As permissões equivalentes já são pedidas pelo app e cobrem o mesmo uso:
- `instagram_business_basic` — identificar a conta profissional conectada.
- `instagram_business_content_publish` — publicar/agendar (item 7).
- `instagram_business_manage_comments` — responder comentários (item 6).
Use a **mesma justificativa** dos itens 6 e 7, adaptando o nome.

---

## 🔔 Configuração do Webhook de comentários (fazer no painel, antes do review de comentários)
No painel do app → **Webhooks**:
1. Objeto **Instagram** (ou **Page**, no fluxo com Página).
2. **Callback URL:** `https://leadqui.vps.pequi.digital/api/techqui/webhook/instagram`
3. **Verify Token:** `pequi_webhook_2026`
4. Assinar o campo **`comments`**.
5. No sistema, em cada conta, use **"Ativar auto-reply"** (o diagnóstico em Conexões mostra se o webhook está ativo).

---

## ✅ Checklist final antes de enviar
- [ ] App em **modo Ativo (Live)**.
- [ ] Business **verificado** (feito).
- [ ] URLs de **Privacidade / Termos / Exclusão de dados** preenchidas.
- [ ] **Usuário de teste** criado + cliente de teste com conta conectada.
- [ ] Webhook de comentários configurado e testado.
- [ ] Um **screencast por permissão**, mostrando a ação real.
- [ ] Justificativas em **inglês** coladas.
- [ ] Passo-a-passo do revisor em **inglês** no campo de instruções.

> **Ordem sugerida — 1ª leva (agora):** `pages_show_list` → `pages_read_engagement` → `business_management` → `instagram_basic`/`instagram_business_basic` → `instagram_manage_comments`/`instagram_business_manage_comments` → `instagram_content_publish`/`instagram_business_content_publish`.
> **2ª leva (depois):** `ads_read` → `ads_management`.
