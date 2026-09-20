-- SDR: cadência de follow-up
ALTER TABLE "sdr_playbooks" ADD COLUMN IF NOT EXISTS "followup_hours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "sdr_playbooks" ADD COLUMN IF NOT EXISTS "max_followups"  INTEGER NOT NULL DEFAULT 2;
