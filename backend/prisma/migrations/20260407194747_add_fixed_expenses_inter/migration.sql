-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "payment_day" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "fixed_expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OUTROS',
    "due_day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "account_number" TEXT,
    "last_sync" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inter_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_transactions" (
    "id" TEXT NOT NULL,
    "credentials_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "linked_invoice_id" TEXT,
    "linked_expense_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inter_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inter_credentials_user_id_key" ON "inter_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inter_transactions_transaction_id_key" ON "inter_transactions"("transaction_id");

-- AddForeignKey
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_credentials" ADD CONSTRAINT "inter_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_transactions" ADD CONSTRAINT "inter_transactions_credentials_id_fkey" FOREIGN KEY ("credentials_id") REFERENCES "inter_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
