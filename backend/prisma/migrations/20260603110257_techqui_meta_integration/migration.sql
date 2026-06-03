-- CreateEnum
CREATE TYPE "InstagramMediaType" AS ENUM ('IMAGE', 'CAROUSEL', 'REELS');

-- CreateEnum
CREATE TYPE "InstagramPostStatus" AS ENUM ('AGENDADO', 'PUBLICADO', 'ERRO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetaSuggestionStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'EXECUTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "CommentReplyType" AS ENUM ('FIXO', 'IA');

-- CreateEnum
CREATE TYPE "CommentApplyTo" AS ENUM ('TODOS', 'ESPECIFICOS');

-- CreateTable
CREATE TABLE "techqui_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meta_app_id" TEXT,
    "meta_app_secret" TEXT,
    "meta_business_id" TEXT,
    "meta_system_token" TEXT,
    "openai_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "techqui_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_meta_connections" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "instagram_username" TEXT,
    "ad_account_id" TEXT,
    "page_id" TEXT,
    "page_name" TEXT,
    "access_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_scheduled_posts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "caption" TEXT,
    "media_urls" TEXT NOT NULL,
    "media_type" "InstagramMediaType" NOT NULL DEFAULT 'IMAGE',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "InstagramPostStatus" NOT NULL DEFAULT 'AGENDADO',
    "instagram_media_id" TEXT,
    "error_message" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads_analyses" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "raw_data" TEXT NOT NULL,
    "analysis_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ads_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_agent_suggestions" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_payload" TEXT NOT NULL,
    "status" "MetaSuggestionStatus" NOT NULL DEFAULT 'PENDENTE',
    "executed_at" TIMESTAMP(3),
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_agent_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comment_rules" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reply_type" "CommentReplyType" NOT NULL DEFAULT 'FIXO',
    "fixed_reply" TEXT,
    "keywords" TEXT,
    "apply_to" "CommentApplyTo" NOT NULL DEFAULT 'TODOS',
    "post_ids" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_comment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comment_logs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "comment_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "commenter_username" TEXT,
    "comment_text" TEXT NOT NULL,
    "reply_text" TEXT,
    "replied_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RESPONDIDO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_comment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "techqui_settings_user_id_key" ON "techqui_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_meta_connections_client_id_key" ON "client_meta_connections"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_comment_logs_comment_id_key" ON "instagram_comment_logs"("comment_id");

-- AddForeignKey
ALTER TABLE "techqui_settings" ADD CONSTRAINT "techqui_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_meta_connections" ADD CONSTRAINT "client_meta_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_scheduled_posts" ADD CONSTRAINT "instagram_scheduled_posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "client_meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads_analyses" ADD CONSTRAINT "meta_ads_analyses_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "client_meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_agent_suggestions" ADD CONSTRAINT "meta_agent_suggestions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "meta_ads_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comment_rules" ADD CONSTRAINT "instagram_comment_rules_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "client_meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comment_logs" ADD CONSTRAINT "instagram_comment_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "client_meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
