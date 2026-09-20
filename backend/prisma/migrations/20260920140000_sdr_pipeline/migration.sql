-- SDR: número dedicado + funil (conversas) + fila de rascunhos
ALTER TABLE "sdr_playbooks" ADD COLUMN IF NOT EXISTS "instance" TEXT;

CREATE TABLE IF NOT EXISTS "sdr_conversations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "instance" TEXT,
    "chat_jid" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NOVO',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "qualification" TEXT,
    "last_message_at" TIMESTAMP(3),
    "next_followup_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sdr_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sdr_conversations_lead_id_key" ON "sdr_conversations"("lead_id");
CREATE INDEX IF NOT EXISTS "sdr_conversations_stage_idx" ON "sdr_conversations"("stage");
ALTER TABLE "sdr_conversations" ADD CONSTRAINT "sdr_conversations_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sdr_drafts" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FIRST_CONTACT',
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "sdr_drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sdr_drafts_status_idx" ON "sdr_drafts"("status");
ALTER TABLE "sdr_drafts" ADD CONSTRAINT "sdr_drafts_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "sdr_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
