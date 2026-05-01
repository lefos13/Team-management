/*
Resolve project-level authorization in one place so owned and invited access
share the same permission checks across project, member, and task routes.
*/
import type { ProjectPermission } from "@team-management/shared";

import { prisma } from "../db.js";
import { forbidden, notFound } from "./errors.js";

export type AccessContext = {
  projectId: string;
  ownerUserId: string;
  currentUserId: string;
  isMasterOwner: boolean;
  permission: ProjectPermission;
  teamMemberId: string | null;
};

export async function getAccessContext(projectId: string, currentUserId: string): Promise<AccessContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });

  if (!project) {
    throw notFound("Project");
  }

  if (project.userId === currentUserId) {
    return {
      projectId,
      ownerUserId: project.userId,
      currentUserId,
      isMasterOwner: true,
      permission: "admin",
      teamMemberId: null,
    };
  }

  const access = await prisma.projectAccess.findFirst({
    where: {
      projectId,
      userId: currentUserId,
      status: "active",
    },
    select: {
      permission: true,
      teamMemberId: true,
      ownerUserId: true,
    },
  });

  if (!access) {
    throw notFound("Project");
  }

  return {
    projectId,
    ownerUserId: access.ownerUserId,
    currentUserId,
    isMasterOwner: false,
    permission: access.permission,
    teamMemberId: access.teamMemberId,
  };
}

export function canPreviewAnyTask(permission: ProjectPermission) {
  return permission === "preview_all_tasks" || permission === "edit_all_tasks" || permission === "admin";
}

export function canEditAnyTask(permission: ProjectPermission) {
  return permission === "edit_all_tasks" || permission === "admin";
}

export function canEditOwnTask(permission: ProjectPermission) {
  return permission === "edit_own_tasks" || canEditAnyTask(permission);
}

export function canPreviewOwnTask(permission: ProjectPermission) {
  return permission === "preview_own_tasks" || canPreviewAnyTask(permission) || canEditOwnTask(permission);
}

export function assertCanManageMembers(context: AccessContext) {
  if (context.isMasterOwner || context.permission === "admin") {
    return;
  }

  throw forbidden("You do not have permission to manage project members.");
}

export function assertMasterOwner(context: AccessContext) {
  if (context.isMasterOwner) {
    return;
  }

  throw forbidden("Only the master owner can perform this action.");
}
