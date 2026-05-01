import type {
  TaskAttachmentArchiveDTO,
  TaskAttachmentDTO,
  CalendarEventDTO,
  ProjectDetailDTO,
  ProjectSummaryDTO,
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
    status: project.status as ProjectSummaryDTO["status"],
    color: project.color,
    memberCount: project._count.projectMembers,
    taskCount: project._count.tasks,
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
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
  return {
    ...mapProjectSummary(project),
    memberIds: project.projectMembers.map((member) => member.teamMemberId),
    tasks: project.tasks.map((task) => task.id),
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
    assignee: { name: string };
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
    status: task.status as TaskDTO["status"],
    isDefect: task.isDefect,
    deadline: toIsoString(task.deadline),
    startDate: task.startDate ? toIsoString(task.startDate) : null,
    completedAt: task.completedAt ? toIsoString(task.completedAt) : null,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    assigneeIds: assigneeIds.length > 0 ? assigneeIds : [task.assigneeId],
    parentTaskId: task.parentTaskId,
    parentTaskTitle: task.parentTask?.title ?? null,
    projectName: task.project.name,
    assigneeName: task.assignee.name,
    assigneeNames: assigneeNames.length > 0 ? assigneeNames : [task.assignee.name],
    attachments,
    attachmentArchive,
    attachmentsPreviewAvailable: task.status !== "done",
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
    assigneeIds:
      task.taskAssignees.length > 0 ? task.taskAssignees.map((assignment) => assignment.teamMemberId) : [task.assigneeId],
    status: task.status as CalendarEventDTO["status"],
    overdue,
  };
}
