-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "isDefect" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing completed work without changing active task history.
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'done' AND "completedAt" IS NULL;

-- Preserve completion metadata even if the previous app version writes during deploy.
CREATE OR REPLACE FUNCTION "set_task_completion_metadata"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isDefect" IS NULL THEN
    NEW."isDefect" = false;
  END IF;

  IF NEW."status" = 'done' AND NEW."completedAt" IS NULL THEN
    NEW."completedAt" = CURRENT_TIMESTAMP;
  END IF;

  IF NEW."status" <> 'done' THEN
    NEW."completedAt" = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Task_completion_metadata_trigger"
BEFORE INSERT OR UPDATE OF "status", "completedAt", "isDefect" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "set_task_completion_metadata"();

-- CreateIndex
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
