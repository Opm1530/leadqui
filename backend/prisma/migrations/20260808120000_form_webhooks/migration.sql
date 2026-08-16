-- Captação de leads via formulários / landing pages (webhook de entrada)

-- Nova origem de lead
ALTER TYPE "LeadOrigem" ADD VALUE IF NOT EXISTS 'FORMULARIO';

-- Endpoints (um por formulário/landing)
CREATE TABLE IF NOT EXISTS "form_endpoints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_tag_ids" TEXT[] NOT NULL DEFAULT '{}',
    "default_responsavel" TEXT,
    "redirect_url" TEXT,
    "submissions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_endpoints_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "form_endpoints_token_key" ON "form_endpoints"("token");
CREATE INDEX IF NOT EXISTS "form_endpoints_token_idx" ON "form_endpoints"("token");
ALTER TABLE "form_endpoints" ADD CONSTRAINT "form_endpoints_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Log de submissões (payload cru)
CREATE TABLE IF NOT EXISTS "form_submissions" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "payload" JSONB NOT NULL,
    "ip" TEXT,
    "spam" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "form_submissions_endpoint_id_idx" ON "form_submissions"("endpoint_id");
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_endpoint_id_fkey"
    FOREIGN KEY ("endpoint_id") REFERENCES "form_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
