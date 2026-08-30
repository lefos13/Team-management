/*
  Specify the board's pure status-move boundary so drag and menu actions share
  the same no-op rules before either interaction is wired to the page.
*/
import { taskStatusValues, type TaskDTO } from "@team-management/shared";
import { describe, expect, it } from "vitest";

import { resolveTaskBoardStatusMove } from "../lib/task-board-status-movement";

function task(overrides: Partial<TaskDTO> & Pick<TaskDTO, "id" | "title" | "status">): TaskDTO {
  return {
    description: null,
    notes: null,
    isDefect: false,
    deadline: null,
    startDate: null,
    completedAt: null,
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
    attachmentsPreviewAvailable: true,
    canEdit: true,
    canManageAssignees: true,
    createdAt: "2030-05-01T08:00:00.000Z",
    updatedAt: "2030-05-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("resolveTaskBoardStatusMove", () => {
  it("returns the requested status change for an editable cross-column move", () => {
    const item = task({ id: "task-1", title: "Prepare report", status: taskStatusValues[0] });

    expect(resolveTaskBoardStatusMove(item, taskStatusValues[1])).toEqual({
      task: item,
      status: taskStatusValues[1],
    });
  });

  it.each([
    ["a same-column move", taskStatusValues[0], false],
    ["a cancelled drop", taskStatusValues[1], true],
  ])("returns a no-op for %s", (_caseName, targetStatus, cancelled) => {
    const item = task({ id: "task-2", title: "Keep status", status: taskStatusValues[0] });

    expect(resolveTaskBoardStatusMove(item, targetStatus, { cancelled })).toBeNull();
  });

  it("returns a no-op when a read-only task is moved", () => {
    const item = task({ id: "task-3", title: "Read only", status: taskStatusValues[0], canEdit: false });

    expect(resolveTaskBoardStatusMove(item, taskStatusValues[1])).toBeNull();
  });
});
