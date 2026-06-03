-- DropForeignKey
ALTER TABLE "traffic_campaigns" DROP CONSTRAINT "traffic_campaigns_project_id_fkey";

-- AlterTable
ALTER TABLE "traffic_campaigns" ALTER COLUMN "project_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "traffic_campaigns" ADD CONSTRAINT "traffic_campaigns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
