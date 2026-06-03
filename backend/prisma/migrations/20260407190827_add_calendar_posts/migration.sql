-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('POST', 'STORY', 'REEL', 'CARROSSEL', 'AD');

-- CreateEnum
CREATE TYPE "PostPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PLANEJADO', 'PRODUZINDO', 'APROVADO', 'PUBLICADO');

-- CreateTable
CREATE TABLE "calendar_posts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "type" "PostType" NOT NULL DEFAULT 'POST',
    "platform" "PostPlatform" NOT NULL DEFAULT 'INSTAGRAM',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'PLANEJADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_posts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "calendar_posts" ADD CONSTRAINT "calendar_posts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_posts" ADD CONSTRAINT "calendar_posts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
