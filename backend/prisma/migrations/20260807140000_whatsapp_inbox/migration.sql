-- Hub de conversas do WhatsApp (inbox)
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "chat_jid" TEXT NOT NULL,
    "name" TEXT,
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,
    "last_message_text" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_conversations_instance_chat_jid_key" ON "whatsapp_conversations"("instance", "chat_jid");
CREATE INDEX "whatsapp_conversations_last_message_at_idx" ON "whatsapp_conversations"("last_message_at");

CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "direction" TEXT NOT NULL,
    "from_me" BOOLEAN NOT NULL DEFAULT false,
    "author_name" TEXT,
    "author_user_id" TEXT,
    "text" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "whatsapp_messages_conversation_id_timestamp_idx" ON "whatsapp_messages"("conversation_id", "timestamp");
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
