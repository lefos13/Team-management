CREATE TABLE "TaskAttachment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "isImage" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskAttachmentArchive" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskAttachmentArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAttachment_storageKey_key" ON "TaskAttachment"("storageKey");
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");
CREATE UNIQUE INDEX "TaskAttachmentArchive_taskId_key" ON "TaskAttachmentArchive"("taskId");
CREATE UNIQUE INDEX "TaskAttachmentArchive_storageKey_key" ON "TaskAttachmentArchive"("storageKey");

ALTER TABLE "TaskAttachment"
ADD CONSTRAINT "TaskAttachment_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAttachmentArchive"
ADD CONSTRAINT "TaskAttachmentArchive_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
