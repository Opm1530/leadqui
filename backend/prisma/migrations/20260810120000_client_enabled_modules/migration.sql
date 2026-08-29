-- Módulos do produto CRM liberados por cliente (hub do cliente)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "enabled_modules" TEXT[] NOT NULL DEFAULT '{}';
