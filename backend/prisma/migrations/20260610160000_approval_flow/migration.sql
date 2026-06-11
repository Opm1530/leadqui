-- Fluxo de aprovação: novos status, motivo de reprovação e config do webhook Trello
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'ARTE_PRONTA';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'AGUARDANDO_APROVACAO';

ALTER TABLE "calendar_posts" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "calendar_posts" ADD COLUMN "awaiting_reason" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "calendar_posts" ADD COLUMN "approval_sent_at" TIMESTAMP(3);

ALTER TABLE "techqui_settings" ADD COLUMN "trello_done_list_id" TEXT;
ALTER TABLE "techqui_settings" ADD COLUMN "trello_webhook_id" TEXT;
