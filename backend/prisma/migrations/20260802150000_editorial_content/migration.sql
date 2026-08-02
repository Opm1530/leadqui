-- Editorial: controle de conteúdos sincronizado com tarefas
CREATE TYPE "ContentStatus" AS ENUM ('IDEIA', 'EM_PRODUCAO', 'AJUSTES', 'EM_APROVACAO', 'AGUARDANDO_POSTAR', 'POSTADO');

CREATE TABLE "editorial_contents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "responsible_id" TEXT,
    "task_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reference_url" TEXT,
    "caption" TEXT,
    "hashtags" TEXT,
    "content_type" TEXT NOT NULL DEFAULT 'POST',
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "status" "ContentStatus" NOT NULL DEFAULT 'EM_PRODUCAO',
    "scheduled_date" TIMESTAMP(3),
    "produced_key" TEXT,
    "produced_name" TEXT,
    "feedback" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "editorial_contents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "editorial_contents_task_id_key" ON "editorial_contents"("task_id");

ALTER TABLE "editorial_contents" ADD CONSTRAINT "editorial_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "editorial_contents" ADD CONSTRAINT "editorial_contents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "editorial_contents" ADD CONSTRAINT "editorial_contents_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "editorial_contents" ADD CONSTRAINT "editorial_contents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
