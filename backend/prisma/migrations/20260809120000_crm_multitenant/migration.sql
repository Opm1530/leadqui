-- Multi-tenant: CRM/Leads/Tags/Formulários isolados por cliente (produto CRM white-label)

-- Usuários podem pertencer a um cliente (produto CRM). null = usuário da agência.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "member_of_client_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_client_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD CONSTRAINT "users_member_of_client_id_fkey"
  FOREIGN KEY ("member_of_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Colunas de isolamento por cliente (null = dado da agência)
ALTER TABLE "crm_columns"    ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "crm_cards"      ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "tags"           ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "form_endpoints" ADD COLUMN IF NOT EXISTS "client_id" TEXT;

CREATE INDEX IF NOT EXISTS "crm_columns_client_id_idx"    ON "crm_columns"("client_id");
CREATE INDEX IF NOT EXISTS "crm_cards_client_id_idx"      ON "crm_cards"("client_id");
CREATE INDEX IF NOT EXISTS "tags_client_id_idx"           ON "tags"("client_id");
CREATE INDEX IF NOT EXISTS "form_endpoints_client_id_idx" ON "form_endpoints"("client_id");

-- Backfill: usuários de login dos clientes (viewqui) viram membros + admin do próprio cliente
UPDATE "users" u
   SET "member_of_client_id" = c."id",
       "is_client_admin"     = true
  FROM "clients" c
 WHERE c."login_user_id" = u."id";
