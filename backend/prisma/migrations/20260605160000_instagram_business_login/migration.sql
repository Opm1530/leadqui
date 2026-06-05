-- AlterTable
ALTER TABLE "techqui_settings" ADD COLUMN "instagram_app_id" TEXT;
ALTER TABLE "techqui_settings" ADD COLUMN "instagram_app_secret" TEXT;

-- AlterTable
ALTER TABLE "client_meta_connections" ADD COLUMN "connection_type" TEXT NOT NULL DEFAULT 'FACEBOOK';
