-- AlterTable
ALTER TABLE "StudentDocument" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: older uploads first within each (studentId, type)
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY "studentId", type
      ORDER BY "uploadedAt" ASC
    ) - 1) AS rn
  FROM "StudentDocument"
)
UPDATE "StudentDocument" AS d
SET "sortOrder" = ranked.rn
FROM ranked
WHERE d.id = ranked.id;

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_type_sortOrder_idx" ON "StudentDocument"("studentId", "type", "sortOrder");
