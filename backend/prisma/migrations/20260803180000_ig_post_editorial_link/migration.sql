-- Vincula post agendado ao conteúdo do Editorial
ALTER TABLE "instagram_scheduled_posts" ADD COLUMN "editorial_content_id" TEXT;
