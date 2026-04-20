import type {
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
    tasks: Array<{ id: string }>;
  },
): TeamMemberDTO {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    email: member.email,
    notes: member.notes,
    active: member.active,
    projectIds: member.projectMembers.map((project) => project.projectId),
    openTaskCount: member.tasks.length,
    createdAt: toIsoString(member.createdAt),
    updatedAt: toIsoString(member.updatedAt),
  };
}

export function mapTask(
  task: Task & {
    project: { name: string };
    assignee: { name: string };
  },
): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskDTO["status"],
    deadline: toIsoString(task.deadline),
    startDate: task.startDate ? toIsoString(task.startDate) : null,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    projectName: task.project.name,
    assigneeName: task.assignee.name,
    createdAt: toIsoString(task.createdAt),
    updatedAt: toIsoString(task.updatedAt),
  };
}

export function mapCalendarEvent(
  task: Task & {
    project: { name: string };
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
    status: task.status as CalendarEventDTO["status"],
    overdue,
  };
}
