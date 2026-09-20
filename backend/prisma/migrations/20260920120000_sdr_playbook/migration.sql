-- SDR de IA — Playbook (configuração do agente de prospecção)
CREATE TABLE IF NOT EXISTS "sdr_playbooks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "icp" TEXT,
    "offer" TEXT,
    "tone" TEXT,
    "qualifying" TEXT,
    "first_msg_guidance" TEXT,
    "followup_guidance" TEXT,
    "goal" TEXT,
    "daily_limit" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sdr_playbooks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sdr_playbooks_user_id_key" ON "sdr_playbooks"("user_id");
