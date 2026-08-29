# Roteiro de teste — CRM multi-tenant (produto white-label)

> Objetivo: validar de ponta a ponta que um cliente tem o próprio CRM isolado, e que a agência
> continua intocada. Faça na ordem. Tempo estimado: ~15 min.

## 0) Deploy e pré-requisitos
- [ ] `git pull && docker compose up -d --build` na VPS.
- [ ] A migração roda sozinha no start. Confira no log do backend que não houve erro de migration.
- [ ] **Todos relogam uma vez** (o token JWT agora carrega o `client_id`). Faça logout/login.

---

## 1) A agência não mudou (regressão)
Logado como **você (agência / ADMIN)**:
- [ ] Abra **Leads** — vê todos os leads de sempre.
- [ ] Abra **CRM** — o quadro da agência está igual (colunas e cards preservados).
- [ ] Abra **Tags** e **Formulários** — tudo como antes.
- [ ] Crie um lead de teste "Lead Agência" — aparece normalmente.

✅ Esperado: nada mudou para a agência.

---

## 2) Criar um cliente com CRM liberado
Ainda como agência:
- [ ] Vá em **Leads**, escolha um lead qualquer e clique em **Converter em Cliente**
      (ou crie um cliente novo em Clientes).
- [ ] Preencha **e-mail** e **senha** de acesso (anote os dois).
- [ ] Em **"Módulos liberados para o cliente"**, marque **CRM**, **Leads** e **Formulários**.
- [ ] Confirme a conversão.

✅ Esperado: cliente criado, com um login (o e-mail/senha que você definiu).

---

## 3) O hub do cliente mostra só o que foi liberado
Abra uma **janela anônima** (pra não misturar sessões) e faça login com o **e-mail/senha do cliente**:
- [ ] Cai no **hub do cliente** com os cards: **Painel, CRM, Leads, Formulários** e **Equipe**
      (Equipe aparece porque esse primeiro login é admin do cliente).
- [ ] **Não** aparece nenhum módulo da agência (Cash, Team, Tasqui, etc.).
- [ ] Não há barra lateral da agência — só o cabeçalho com **Hub** e **Sair**.

✅ Esperado: hub enxuto, só com os módulos liberados.

---

## 4) Isolamento dos dados (o teste que mais importa)
Como **cliente** (janela anônima):
- [ ] Abra **Leads** — está **vazio** (não vê os leads da agência). 🔒
- [ ] Crie um lead "Lead do Cliente".
- [ ] Abra **CRM** — crie uma coluna e arraste o "Lead do Cliente" pra ela.
- [ ] Crie uma **Tag** e aplique no lead.

Volte para a **agência** (janela normal):
- [ ] Em **Leads**, você **não** vê o "Lead do Cliente". 🔒
- [ ] No **CRM** da agência, a coluna criada pelo cliente **não** aparece. 🔒
- [ ] As tags do cliente **não** aparecem nas suas.

✅ Esperado: dados 100% separados nos dois sentidos.

---

## 5) Formulário do cliente cai no CRM do cliente
Como **cliente**:
- [ ] Abra **Formulários**, crie um "Form Teste", copie a **URL do webhook**.
- [ ] Num terminal, simule um envio (troque a URL pela sua):
      ```bash
      curl -X POST "https://SEU_DOMINIO/api/forms/COLE_O_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"nome":"Contato Form","email":"contato@teste.com","telefone":"11999999999"}'
      ```
- [ ] Em **Leads** (do cliente), o "Contato Form" aparece.
- [ ] Na **agência**, esse lead **não** aparece. 🔒

✅ Esperado: leads captados entram isolados no tenant do cliente.

---

## 6) O admin do cliente gerencia a equipe
Como **cliente admin**:
- [ ] Abra **Equipe** → **Novo usuário** (nome, e-mail, senha; deixe admin desmarcado).
- [ ] Faça login com esse **segundo usuário** em outra janela anônima.
- [ ] Ele vê o **mesmo CRM/Leads** do cliente (o "Lead do Cliente" está lá). ✅
- [ ] Ele **não** tem o card **Equipe** (não é admin). 🔒
- [ ] Volte ao admin e teste **resetar senha** e **excluir** o segundo usuário.

✅ Esperado: vários usuários compartilham o mesmo CRM; só o admin gerencia a equipe.

---

## 7) Trocar o que está liberado
Como **agência**:
- [ ] Abra o cliente em **Editar**, **desmarque Formulários**, salve.
- [ ] No cliente (relogar ou recarregar o hub), o card **Formulários** some.

✅ Esperado: o controle de módulos é dinâmico.

---

## Checklist de segurança (opcional, via API)
Pegue o token do cliente (login) e tente acessar rota da agência — deve dar 403:
```bash
curl -s -H "Authorization: Bearer TOKEN_DO_CLIENTE" https://SEU_DOMINIO/api/teamqui | head
# esperado: 403 (equipe interna)
```
E uma rota de outro cliente deve retornar vazio/404 — nunca dados de outro tenant.

---

## Notas
- **Clientes antigos** (logins de viewqui que já existiam) entram com `enabled_modules` vazio →
  veem só o **Painel** até você abrir em **Editar** e liberar os módulos.
- Se algum usuário "não vê o CRM dele", quase sempre é **token antigo**: peça pra sair e entrar de novo.
