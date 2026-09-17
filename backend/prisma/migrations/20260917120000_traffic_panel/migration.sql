-- Painel de verificação de tráfego pago por cliente

CREATE TABLE IF NOT EXISTS "traffic_budgets" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traffic_budgets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "traffic_budgets_client_id_month_key" ON "traffic_budgets"("client_id", "month");
ALTER TABLE "traffic_budgets" ADD CONSTRAINT "traffic_budgets_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "traffic_columns" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NUMBER',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traffic_columns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "traffic_columns_client_id_idx" ON "traffic_columns"("client_id");
ALTER TABLE "traffic_columns" ADD CONSTRAINT "traffic_columns_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "traffic_checks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaign_name" TEXT,
    "campaign_id" TEXT,
    "adset_name" TEXT,
    "ad_name" TEXT,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observation" TEXT,
    "values" JSONB NOT NULL DEFAULT '{}',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traffic_checks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "traffic_checks_client_id_month_idx" ON "traffic_checks"("client_id", "month");
ALTER TABLE "traffic_checks" ADD CONSTRAINT "traffic_checks_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
