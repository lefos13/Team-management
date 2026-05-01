CREATE TYPE "ProjectPermission" AS ENUM ('preview_own_tasks', 'preview_all_tasks', 'edit_own_tasks', 'edit_all_tasks', 'admin');
CREATE TYPE "ProjectAccessStatus" AS ENUM ('invited', 'active', 'revoked');

CREATE TABLE "ProjectAccess" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamMemberId" TEXT,
  "permission" "ProjectPermission" NOT NULL,
  "status" "ProjectAccessStatus" NOT NULL DEFAULT 'invited',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectInvitation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "teamMemberId" TEXT NOT NULL,
  "inviteEmail" TEXT NOT NULL,
  "permission" "ProjectPermission" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "acceptedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectAccess_projectId_userId_key" ON "ProjectAccess"("projectId", "userId");
CREATE INDEX "ProjectAccess_ownerUserId_userId_status_idx" ON "ProjectAccess"("ownerUserId", "userId", "status");
CREATE INDEX "ProjectAccess_projectId_status_idx" ON "ProjectAccess"("projectId", "status");

CREATE UNIQUE INDEX "ProjectInvitation_tokenHash_key" ON "ProjectInvitation"("tokenHash");
CREATE INDEX "ProjectInvitation_projectId_inviteEmail_revokedAt_acceptedAt_idx" ON "ProjectInvitation"("projectId", "inviteEmail", "revokedAt", "acceptedAt");
CREATE INDEX "ProjectInvitation_ownerUserId_inviteEmail_idx" ON "ProjectInvitation"("ownerUserId", "inviteEmail");

ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
