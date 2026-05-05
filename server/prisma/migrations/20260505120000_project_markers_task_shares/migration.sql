/*
Project schedule markers and task share links are additive so existing projects,
tasks, and deployment order continue to work without production backfills.
*/
ALTER TABLE "Project" ADD COLUMN "goLiveDate" TIMESTAMP(3);

CREATE TABLE "ProjectPhaseDate" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectPhaseDate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskShareLink" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskShareLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_goLiveDate_idx" ON "Project"("goLiveDate");
CREATE INDEX "ProjectPhaseDate_projectId_idx" ON "ProjectPhaseDate"("projectId");
CREATE INDEX "ProjectPhaseDate_date_idx" ON "ProjectPhaseDate"("date");
CREATE UNIQUE INDEX "TaskShareLink_tokenHash_key" ON "TaskShareLink"("tokenHash");
CREATE INDEX "TaskShareLink_taskId_revokedAt_idx" ON "TaskShareLink"("taskId", "revokedAt");
CREATE INDEX "TaskShareLink_createdByUserId_idx" ON "TaskShareLink"("createdByUserId");

ALTER TABLE "ProjectPhaseDate" ADD CONSTRAINT "ProjectPhaseDate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskShareLink" ADD CONSTRAINT "TaskShareLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskShareLink" ADD CONSTRAINT "TaskShareLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
