-- Liga uma despesa registrada à despesa fixa que a originou
ALTER TABLE "expenses" ADD COLUMN "fixed_expense_id" TEXT;
