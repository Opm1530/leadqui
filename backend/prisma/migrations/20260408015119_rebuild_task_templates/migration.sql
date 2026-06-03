/*
  Warnings:

  - You are about to drop the column `days_to_due` on the `task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `task_templates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `task_templates` table. All the data in the column will be lost.
  - Added the required column `name` to the `task_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `task_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `task_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "task_templates" DROP COLUMN "days_to_due",
DROP COLUMN "priority",
DROP COLUMN "title",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "service" DROP NOT NULL;

-- CreateTable
CREATE TABLE "task_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "due_days_offset" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_template_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
