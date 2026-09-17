-- Central de alertas
CREATE TABLE IF NOT EXISTS "alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "client_id" TEXT,
    "link" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "alerts_resolved_idx" ON "alerts"("resolved");
