-- Armazenamento R2 + arquivos por cliente
ALTER TABLE "user_settings" ADD COLUMN "r2_account_id" TEXT;
ALTER TABLE "user_settings" ADD COLUMN "r2_access_key_id" TEXT;
ALTER TABLE "user_settings" ADD COLUMN "r2_secret_key" TEXT;
ALTER TABLE "user_settings" ADD COLUMN "r2_bucket" TEXT;

CREATE TABLE "client_files" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "mime" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_files_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_files" ADD CONSTRAINT "client_files_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
