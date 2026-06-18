-- Lembretes no card do lead + grupo da equipe para o boletim diário
ALTER TABLE "user_settings" ADD COLUMN "notification_group_id" TEXT;
ALTER TABLE "user_settings" ADD COLUMN "notification_group_name" TEXT;

CREATE TABLE "lead_reminders" (
  "id"         TEXT NOT NULL,
  "lead_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "remind_on"  TIMESTAMP(3) NOT NULL,
  "done"       BOOLEAN NOT NULL DEFAULT false,
  "sent_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lead_reminders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
