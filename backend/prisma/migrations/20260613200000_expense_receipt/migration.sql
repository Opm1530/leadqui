-- Comprovante da despesa
ALTER TABLE "expenses" ADD COLUMN "receipt_key" TEXT;
ALTER TABLE "expenses" ADD COLUMN "receipt_name" TEXT;
