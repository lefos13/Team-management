import type {
  TaskAttachmentArchiveDTO,
  TaskAttachmentDTO,
  CalendarEventDTO,
  ProjectDetailDTO,
  ProjectListDTO,
  ProjectSummaryDTO,
  SharedProjectSummaryDTO,
  TaskDTO,
  TeamMemberDTO,
  UserDTO,
} from "@team-management/shared";
import type { Project, Task, TeamMember, User } from "@prisma/client";

function toIsoString(value: Date): string {
  return value.toISOString();
}

export function mapUser(user: User): UserDTO {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ? toIsoString(user.emailVerifiedAt) : null,
    termsAcceptedAt: user.termsAcceptedAt ? toIsoString(user.termsAcceptedAt) : null,
    termsVersion: user.termsVersion,
    privacyAcceptedAt: user.privacyAcceptedAt ? toIsoString(user.privacyAcceptedAt) : null,
    privacyVersion: user.privacyVersion,
    legalAcceptedIp: user.legalAcceptedIp,
    legalAcceptedUserAgent: user.legalAcceptedUserAgent,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

export function mapProjectSummary(
  project: Project & {
    _count: {
      projectMembers: number;
      tasks: number;
    };
  },
): ProjectSummaryDTO {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    aiContext: project.aiContext,
    status: project.status as ProjectSummaryDTO["status"],
    color: project.color,
    memberCount: project._count.projectMembers,
    taskCount: project._count.tasks,
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
  };
}

export function mapSharedProjectSummary(
  project: Project & {
    _count: {
      projectMembers: number;
      tasks: number;
    };
    access: {
      permission: SharedProjectSummaryDTO["permission"];
      status: SharedProjectSummaryDTO["accessStatus"];
      ownerEmail: string;
    };
  },
): SharedProjectSummaryDTO {
  return {
    ...mapProjectSummary(project),
    permission: project.access.permission,
    accessStatus: project.access.status,
    masterOwnerEmail: project.access.ownerEmail,
  };
}

export function mapProjectList(input: {
  ownedProjects: Parameters<typeof mapProjectSummary>[0][];
  sharedProjects: Parameters<typeof mapSharedProjectSummary>[0][];
}): ProjectListDTO {
  return {
    ownedProjects: input.ownedProjects.map(mapProjectSummary),
    sharedProjects: input.sharedProjects.map(mapSharedProjectSummary),
  };
}

export function mapProjectDetail(
  project: Project & {
    projectMembers: Array<{ teamMemberId: string }>;
    tasks: Array<{ id: string }>;
    _count: {
      projectMembers: number;
      tasks: number;
    };
  },
): ProjectDetailDTO {
  /*
  Project details now include access metadata by contract, so the shared mapper
  returns safe defaults that route handlers can override for invited users.
  */
  return {
    ...mapProjectSummary(project),
    memberIds: project.projectMembers.map((member) => member.teamMemberId),
    tasks: project.tasks.map((task) => task.id),
    isMasterOwner: true,
    permission: "edit_all_tasks",
  };
}

export function mapMember(
  member: TeamMember & {
    projectMembers: Array<{ projectId: string }>;
    taskAssignees: Array<{ task: { status: string } }>;
  },
): TeamMemberDTO {
  const assignedTasks = member.taskAssignees.map((assignment) => assignment.task);
  const openTaskCount = assignedTasks.filter((task) => task.status !== "done").length;
  const completedTaskCount = assignedTasks.filter((task) => task.status === "done").length;

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    email: member.email,
    notes: member.notes,
    active: member.active,
    projectIds: member.projectMembers.map((project) => project.projectId),
    openTaskCount,
    completedTaskCount,
    createdAt: toIsoString(member.createdAt),
    updatedAt: toIsoString(member.updatedAt),
  };
}

export function mapTask(
  task: Task & {
    project: { name: string };
    assignee: { name: string } | null;
    parentTask?: { title: string } | null;
    taskAssignees: Array<{ teamMemberId: string; teamMember: { name: string } }>;
    attachments: Array<{
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      isImage: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
    archive?: {
      id: string;
      sizeBytes: number;
      generatedAt: Date;
    } | null;
  },
  options: { canEdit?: boolean; canManageAssignees?: boolean } = {},
): TaskDTO {
  const orderedAssignees = [...task.taskAssignees].sort((left, right) => {
    if (left.teamMemberId === task.assigneeId) {
      return -1;
    }

    if (right.teamMemberId === task.assigneeId) {
      return 1;
    }

    return left.teamMember.name.localeCompare(right.teamMember.name);
  });
  const assigneeIds = orderedAssignees.map((assignment) => assignment.teamMemberId);
  const assigneeNames = orderedAssignees.map((assignment) => assignment.teamMember.name);
  const attachments: TaskAttachmentDTO[] = task.attachments.map((attachment) => ({
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    isImage: attachment.isImage,
    createdAt: toIsoString(attachment.createdAt),
    updatedAt: toIsoString(attachment.updatedAt),
  }));
  const attachmentArchive: TaskAttachmentArchiveDTO | null = task.archive
    ? {
        id: task.archive.id,
        sizeBytes: task.archive.sizeBytes,
        generatedAt: toIsoString(task.archive.generatedAt),
      }
    : null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    notes: task.notes,
    status: task.status as TaskDTO["status"],
    isDefect: task.isDefect,
    deadline: task.deadline ? toIsoString(task.deadline) : null,
    startDate: task.startDate ? toIsoString(task.startDate) : null,
    completedAt: task.completedAt ? toIsoString(task.completedAt) : null,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    assigneeIds,
    parentTaskId: task.parentTaskId,
    parentTaskTitle: task.parentTask?.title ?? null,
    projectName: task.project.name,
    assigneeName: task.assignee?.name ?? null,
    assigneeNames,
    attachments,
    attachmentArchive,
    attachmentsPreviewAvailable: task.status !== "done",
    canEdit: options.canEdit ?? true,
    canManageAssignees: options.canManageAssignees ?? true,
    createdAt: toIsoString(task.createdAt),
    updatedAt: toIsoString(task.updatedAt),
  };
}

export function mapCalendarEvent(
  task: Task & {
    project: { name: string };
    taskAssignees: Array<{ teamMemberId: string }>;
  },
): CalendarEventDTO {
  if (!task.deadline) {
    throw new Error("Calendar events require a deadline.");
  }

  const overdue = task.status !== "done" && task.deadline.getTime() < Date.now();

  return {
    id: task.id,
    title: `${task.title} · ${task.project.name}`,
    date: toIsoString(task.deadline),
    start: task.startDate ? toIsoString(task.startDate) : null,
    end: toIsoString(task.deadline),
    taskId: task.id,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    assigneeIds: task.taskAssignees.map((assignment) => assignment.teamMemberId),
    status: task.status as CalendarEventDTO["status"],
    overdue,
  };
}
