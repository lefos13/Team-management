/*
Keep view parsing and board preparation pure so URL state and task grouping can
be tested without rendering the page or applying List hierarchy rules.
*/
import { taskStatusValues, type TaskDTO } from "@team-management/shared";

export type TaskView = "board" | "list";
export type TaskBoardColumn = {
  status: (typeof taskStatusValues)[number];
  tasks: TaskDTO[];
};

export function parseTaskView(value: string | null): TaskView {
  return value === "list" ? "list" : "board";
}

export function withTaskViewSearchParams(searchParams: URLSearchParams, view: TaskView) {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set("view", view);
  return nextSearchParams;
}

export function buildTaskBoardModel(tasks: TaskDTO[]): TaskBoardColumn[] {
  return taskStatusValues.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));
}
