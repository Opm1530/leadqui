-- Tarefa passa a pertencer direto ao cliente; projeto vira opcional
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;
