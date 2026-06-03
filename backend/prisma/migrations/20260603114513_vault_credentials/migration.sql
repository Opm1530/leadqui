-- CreateEnum
CREATE TYPE "VaultCategory" AS ENUM ('SOCIAL_MEDIA', 'HOSTING', 'EMAIL', 'ADS', 'CRM', 'BANCO', 'DOMINIO', 'OUTROS');

-- CreateTable
CREATE TABLE "vault_credentials" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "VaultCategory" NOT NULL DEFAULT 'OUTROS',
    "username" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "password_enc" TEXT NOT NULL,
    "password_iv" TEXT NOT NULL,
    "password_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_audit_logs" (
    "id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "ip_address" TEXT,
    "action" TEXT NOT NULL DEFAULT 'REVEAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vault_credentials" ADD CONSTRAINT "vault_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_credentials" ADD CONSTRAINT "vault_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_logs" ADD CONSTRAINT "vault_audit_logs_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "vault_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
