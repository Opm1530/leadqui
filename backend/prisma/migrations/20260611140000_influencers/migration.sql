-- Gestão de influenciadoras
CREATE TYPE "PartnershipType" AS ENUM ('PERMUTA', 'PAGO', 'HIBRIDO');
CREATE TYPE "PartnershipStatus" AS ENUM ('NEGOCIACAO', 'ENVIADO', 'PRODUZINDO', 'CONCLUIDO');
CREATE TYPE "ProductStatus" AS ENUM ('A_ENVIAR', 'ENVIADO', 'RECEBIDO');

CREATE TABLE "influencers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "instagram" TEXT,
  "tiktok" TEXT,
  "youtube" TEXT,
  "seguidores" INTEGER,
  "telefone" TEXT,
  "email" TEXT,
  "nicho" TEXT,
  "observacao" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "influencer_partnerships" (
  "id" TEXT NOT NULL,
  "influencer_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "tipo" "PartnershipType" NOT NULL DEFAULT 'PERMUTA',
  "cache_value" DOUBLE PRECISION,
  "status" "PartnershipStatus" NOT NULL DEFAULT 'NEGOCIACAO',
  "observacao" TEXT,
  "started_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "influencer_partnerships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partnership_products" (
  "id" TEXT NOT NULL,
  "partnership_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "valor" DOUBLE PRECISION,
  "status" "ProductStatus" NOT NULL DEFAULT 'A_ENVIAR',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partnership_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partnership_deliverables" (
  "id" TEXT NOT NULL,
  "partnership_id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "descricao" TEXT,
  "entregue" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT,
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partnership_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliverable_sales" (
  "id" TEXT NOT NULL,
  "deliverable_id" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quantidade" INTEGER NOT NULL DEFAULT 1,
  "observacao" TEXT,
  "sale_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deliverable_sales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "influencer_partnerships" ADD CONSTRAINT "influencer_partnerships_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "influencer_partnerships" ADD CONSTRAINT "influencer_partnerships_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partnership_products" ADD CONSTRAINT "partnership_products_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "influencer_partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partnership_deliverables" ADD CONSTRAINT "partnership_deliverables_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "influencer_partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliverable_sales" ADD CONSTRAINT "deliverable_sales_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "partnership_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
