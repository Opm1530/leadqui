-- Comprovante na fatura
ALTER TABLE "invoices" ADD COLUMN "receipt_key" TEXT;
ALTER TABLE "invoices" ADD COLUMN "receipt_name" TEXT;
