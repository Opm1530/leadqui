-- Mídias nas mensagens + tags nas conversas
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_type" TEXT;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_key" TEXT;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_mime" TEXT;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_name" TEXT;

ALTER TABLE "whatsapp_conversations" ADD COLUMN "tag_ids" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE "whatsapp_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_tags_pkey" PRIMARY KEY ("id")
);
