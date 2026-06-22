-- Formulário de onboarding do cliente
CREATE TABLE "onboardings" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "store_name" TEXT,
  "store_link" TEXT,
  "audience" TEXT,
  "credentials" TEXT,
  "checklist" TEXT,
  "traffic_campaign_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboardings_client_id_key" ON "onboardings"("client_id");

ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
