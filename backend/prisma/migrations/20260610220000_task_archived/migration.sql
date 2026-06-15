-- Arquivar tarefas (somem do quadro sem excluir)
ALTER TABLE "tasks" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
