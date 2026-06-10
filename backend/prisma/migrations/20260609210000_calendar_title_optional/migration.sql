-- AlterTable: tornar title opcional para permitir cards vazios
ALTER TABLE "calendar_posts" ALTER COLUMN "title" DROP NOT NULL;
