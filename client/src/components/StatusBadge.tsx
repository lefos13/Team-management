import type { ProjectStatus, TaskStatus } from "@team-management/shared";
import { Badge } from "@mantine/core";

const taskColorMap: Record<TaskStatus, string> = {
  todo: "gray",
  in_progress: "blue",
  blocked: "red",
  done: "teal",
};

const projectColorMap: Record<ProjectStatus, string> = {
  active: "teal",
  on_hold: "yellow",
  completed: "blue",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge color={taskColorMap[status]} variant="light">{status.replace("_", " ")}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge color={projectColorMap[status]} variant="light">{status.replace("_", " ")}</Badge>;
}
