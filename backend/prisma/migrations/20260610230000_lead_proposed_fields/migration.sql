-- Campos propostos no lead (pré-carregam a conversão em cliente)
ALTER TABLE "leads" ADD COLUMN "valor_proposto" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "duracao_proposta" INTEGER;
ALTER TABLE "leads" ADD COLUMN "responsavel_proposto" TEXT;
ALTER TABLE "leads" ADD COLUMN "servicos_propostos" TEXT;
