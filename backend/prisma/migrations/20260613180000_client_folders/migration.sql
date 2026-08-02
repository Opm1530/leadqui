-- Pastas de arquivos do cliente
ALTER TABLE "client_files" ADD COLUMN "folder_id" TEXT;

CREATE TABLE "client_folders" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_folders_pkey" PRIMARY KEY ("id")
);
