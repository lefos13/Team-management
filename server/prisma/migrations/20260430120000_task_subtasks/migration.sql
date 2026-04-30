/*
Add a nullable self-reference so existing production tasks remain top-level
while new subtasks can point at a parent. Parent deletion keeps child work by
clearing the link, and the check prevents direct self-parenting at the database
boundary before application validation handles the one-level rule.
*/
ALTER TABLE "Task" ADD COLUMN "parentTaskId" TEXT;

CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey"
FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_not_self_check"
CHECK ("parentTaskId" IS NULL OR "parentTaskId" <> "id");
