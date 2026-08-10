-- Filtros do inbox: instância que alimenta + conversa arquivada
ALTER TABLE "instances" ADD COLUMN "inbox_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_conversations" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
