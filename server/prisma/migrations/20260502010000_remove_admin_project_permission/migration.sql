/*
The owner role is represented by project ownership, not by an assignable member
permission. Existing admin member access is preserved as full task editing before
the enum is narrowed so production data continues to migrate cleanly.
*/
UPDATE "ProjectAccess"
SET "permission" = 'edit_all_tasks'
WHERE "permission" = 'admin';

UPDATE "ProjectInvitation"
SET "permission" = 'edit_all_tasks'
WHERE "permission" = 'admin';

ALTER TYPE "ProjectPermission" RENAME TO "ProjectPermission_old";

CREATE TYPE "ProjectPermission" AS ENUM (
  'preview_own_tasks',
  'preview_all_tasks',
  'edit_own_tasks',
  'edit_all_tasks'
);

ALTER TABLE "ProjectAccess"
ALTER COLUMN "permission" TYPE "ProjectPermission"
USING "permission"::text::"ProjectPermission";

ALTER TABLE "ProjectInvitation"
ALTER COLUMN "permission" TYPE "ProjectPermission"
USING "permission"::text::"ProjectPermission";

DROP TYPE "ProjectPermission_old";
