-- Tarefas rápidas pessoais podem não ter cliente
ALTER TABLE "tasks" ALTER COLUMN "client_id" DROP NOT NULL;
