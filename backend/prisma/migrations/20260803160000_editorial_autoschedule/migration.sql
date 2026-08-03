-- Agendamento opt-in de publicação no Editorial
ALTER TABLE "editorial_contents" ADD COLUMN "auto_schedule" BOOLEAN NOT NULL DEFAULT false;
