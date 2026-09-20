-- Histórico de mensagens da conversa do SDR
CREATE TABLE IF NOT EXISTS "sdr_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sdr_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sdr_messages_conversation_id_idx" ON "sdr_messages"("conversation_id");
ALTER TABLE "sdr_messages" ADD CONSTRAINT "sdr_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "sdr_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
