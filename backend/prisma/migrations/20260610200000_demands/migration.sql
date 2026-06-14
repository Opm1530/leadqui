-- Caixa de Demandas captadas nos grupos de WhatsApp
CREATE TYPE "DemandStatus" AS ENUM ('NOVA', 'EM_ANDAMENTO', 'RESOLVIDA', 'DESCARTADA');

CREATE TABLE "demands" (
  "id"            TEXT NOT NULL,
  "client_id"     TEXT NOT NULL,
  "group_jid"     TEXT NOT NULL,
  "sender"        TEXT,
  "original_text" TEXT NOT NULL,
  "summary"       TEXT NOT NULL,
  "category"      TEXT,
  "status"        "DemandStatus" NOT NULL DEFAULT 'NOVA',
  "task_id"       TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "demands" ADD CONSTRAINT "demands_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
