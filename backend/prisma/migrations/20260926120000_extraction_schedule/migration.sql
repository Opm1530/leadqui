-- Extração automática de leads (regras agendadas)
CREATE TABLE IF NOT EXISTS "extraction_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'GOOGLE_MAPS',
    "categoria" TEXT NOT NULL,
    "cidades" TEXT[] NOT NULL DEFAULT '{}',
    "quantidade" INTEGER NOT NULL DEFAULT 20,
    "tag_id" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "auto_sdr" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "extraction_schedules_pkey" PRIMARY KEY ("id")
);
