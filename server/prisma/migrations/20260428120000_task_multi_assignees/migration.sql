/*
Keep the current primary assignee column in place while introducing the join
table that stores the complete member set. Existing tasks are copied into the
join table, and legacy inserts during deployment get the same copy before the
new application code starts writing both shapes.
*/
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","teamMemberId")
);

INSERT INTO "TaskAssignee" ("taskId", "teamMemberId")
SELECT "id", "assigneeId"
FROM "Task"
ON CONFLICT ("taskId", "teamMemberId") DO NOTHING;

CREATE INDEX "TaskAssignee_teamMemberId_idx" ON "TaskAssignee"("teamMemberId");

ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "sync_task_primary_assignee"()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "TaskAssignee" ("taskId", "teamMemberId")
  VALUES (NEW."id", NEW."assigneeId")
  ON CONFLICT ("taskId", "teamMemberId") DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Task_primary_assignee_sync_trigger"
AFTER INSERT ON "Task"
FOR EACH ROW EXECUTE FUNCTION "sync_task_primary_assignee"();
