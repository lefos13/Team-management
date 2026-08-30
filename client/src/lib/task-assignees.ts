/*
Assignee display helpers format task assignee names, initials, avatar stacks,
and overflow labels consistently across board, list, and dashboard views.
*/
import type { TaskDTO } from "@team-management/shared";

export type AssigneeAvatarSummary = {
  visibleNames: string[];
  overflowCount: number;
  label: string;
};

export function formatTaskAssignees(task: Pick<TaskDTO, "assigneeName" | "assigneeNames">): string {
  return task.assigneeNames.length > 0 ? task.assigneeNames.join(", ") : task.assigneeName ?? "Unassigned";
}

export function getAssigneeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getAssigneeAvatarItems(
  task: Pick<TaskDTO, "assigneeName" | "assigneeNames">,
  maxVisible = 2,
): AssigneeAvatarSummary {
  const names = task.assigneeNames.length > 0 ? task.assigneeNames : task.assigneeName ? [task.assigneeName] : ["Unassigned"];

  return {
    visibleNames: names.slice(0, maxVisible),
    overflowCount: Math.max(names.length - maxVisible, 0),
    label: names.join(", "),
  };
}
