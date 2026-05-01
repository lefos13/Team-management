/*
Keep the new project agent context optional so production deploys can add the
column without rewriting existing rows or blocking current project records.
*/
ALTER TABLE "Project" ADD COLUMN "aiContext" TEXT;
