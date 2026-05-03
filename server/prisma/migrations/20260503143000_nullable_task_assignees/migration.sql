/*
Tasks need to survive member deletion, so the legacy primary assignee column is
made nullable while the multi-assignee join rows are allowed to disappear when a
member is deleted. Existing task data is preserved and future inserts keep the
join table synchronized only when a primary assignee is present.
*/
ALTER TABLE "TaskAssignee" DROP CONSTRAINT "TaskAssignee_teamMemberId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

ALTER TABLE "Task" ALTER COLUMN "assigneeId" DROP NOT NULL;

ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "sync_task_primary_assignee"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."assigneeId" IS NOT NULL THEN
    INSERT INTO "TaskAssignee" ("taskId", "teamMemberId")
    VALUES (NEW."id", NEW."assigneeId")
    ON CONFLICT ("taskId", "teamMemberId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
