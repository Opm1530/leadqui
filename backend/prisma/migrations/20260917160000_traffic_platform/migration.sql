-- Classificar tráfego por plataforma (Meta / Google / TikTok)
ALTER TABLE "traffic_budgets" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'META';
ALTER TABLE "traffic_checks"  ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'META';

-- Verba passa a ser por (cliente, mês, plataforma)
DROP INDEX IF EXISTS "traffic_budgets_client_id_month_key";
CREATE UNIQUE INDEX IF NOT EXISTS "traffic_budgets_client_id_month_platform_key"
  ON "traffic_budgets"("client_id", "month", "platform");

CREATE INDEX IF NOT EXISTS "traffic_checks_client_id_month_platform_idx"
  ON "traffic_checks"("client_id", "month", "platform");
