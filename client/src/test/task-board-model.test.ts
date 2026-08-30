/*
Verify board grouping and URL view parsing stay independent from List hierarchy
rules while protecting URL parameters used by task previews.
*/
import { taskStatusValues, type TaskDTO } from "@team-management/shared";
import { describe, expect, it } from "vitest";

import { buildTaskBoardModel, parseTaskView, withTaskViewSearchParams } from "../lib/task-board-model";

function task(overrides: Partial<TaskDTO> & Pick<TaskDTO, "id" | "title" | "status">): TaskDTO {
  return {
    description: null,
    notes: null,
    isDefect: false,
    deadline: "2030-05-10T09:00:00.000Z",
    startDate: null,
    completedAt: overrides.status === "done" ? "2030-05-10T10:00:00.000Z" : null,
    projectId: "project-1",
    assigneeId: "member-1",
    assigneeIds: ["member-1"],
    parentTaskId: null,
    parentTaskTitle: null,
    projectName: "Operations",
    assigneeName: "Ada Manager",
    assigneeNames: ["Ada Manager"],
    attachments: [],
    attachmentArchive: null,
    attachmentsPreviewAvailable: overrides.status !== "done",
    canEdit: true,
    canManageAssignees: true,
    createdAt: "2030-05-01T08:00:00.000Z",
    updatedAt: "2030-05-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildTaskBoardModel", () => {
  it("returns columns in taskStatusValues order and keeps task order within each status", () => {
    const tasks = [
      task({ id: "done-1", title: "Done one", status: "done" }),
      task({ id: "todo-1", title: "Todo one", status: "todo" }),
      task({ id: "todo-2", title: "Todo two", status: "todo" }),
      task({ id: "blocked-1", title: "Blocked one", status: "blocked" }),
    ];

    const columns = buildTaskBoardModel(tasks);

    expect(columns.map((column) => column.status)).toEqual([...taskStatusValues]);
    expect(columns.map((column) => column.tasks.map((item) => item.id))).toEqual([
      ["todo-1", "todo-2"],
      [],
      ["blocked-1"],
      [],
      ["done-1"],
    ]);
  });

  it("keeps empty statuses as explicit empty columns", () => {
    const columns = buildTaskBoardModel([task({ id: "todo-1", title: "Todo one", status: "todo" })]);

    expect(columns).toHaveLength(5);
    expect(columns.filter((column) => column.tasks.length === 0).map((column) => column.status)).toEqual([
      "in_progress",
      "blocked",
      "review_testing",
      "done",
    ]);
  });

  it("groups subtasks by their own status and preserves parentTaskTitle metadata", () => {
    const subtask = task({
      id: "subtask-1",
      title: "Review child",
      status: "review_testing",
      parentTaskId: "parent-1",
      parentTaskTitle: "Parent task",
    });

    const columns = buildTaskBoardModel([
      task({ id: "parent-1", title: "Parent task", status: "todo" }),
      subtask,
    ]);

    expect(columns.find((column) => column.status === "todo")?.tasks.map((item) => item.id)).toEqual(["parent-1"]);
    expect(columns.find((column) => column.status === "review_testing")?.tasks[0]).toBe(subtask);
    expect(columns.find((column) => column.status === "review_testing")?.tasks[0].parentTaskTitle).toBe("Parent task");
  });
});

describe("parseTaskView", () => {
  it("defaults missing and invalid URL values to board", () => {
    expect(parseTaskView(null)).toBe("board");
    expect(parseTaskView("kanban")).toBe("board");
    expect(parseTaskView("")).toBe("board");
  });

  it("accepts the supported board and list URL values", () => {
    expect(parseTaskView("board")).toBe("board");
    expect(parseTaskView("list")).toBe("list");
  });

  it("preserves existing URL parameters when writing the selected view", () => {
    const searchParams = new URLSearchParams("taskId=task-1&filter=mine");

    const nextSearchParams = withTaskViewSearchParams(searchParams, "list");

    expect(nextSearchParams.toString()).toBe("taskId=task-1&filter=mine&view=list");
    expect(searchParams.toString()).toBe("taskId=task-1&filter=mine");
  });
});
