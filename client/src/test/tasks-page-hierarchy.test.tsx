/* Verify task hierarchy visibility follows the active/default and done-only status rules. */
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { TaskDTO } from "@team-management/shared";
import { describe, expect, it } from "vitest";

import { TaskStatusBadge } from "../components/StatusBadge";
import { buildVisibleTaskHierarchy, getAssigneeAvatarItems, getAssigneeInitials, getTaskRangeLabel } from "../pages/TasksPage";

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

describe("TasksPage hierarchy visibility", () => {
  it("hides done subtasks under unfinished parents in the default active view", () => {
    const parent = task({ id: "parent", title: "Parent", status: "todo" });
    const activeSubtask = task({ id: "active-child", title: "Active child", status: "blocked", parentTaskId: parent.id });
    const doneSubtask = task({ id: "done-child", title: "Done child", status: "done", parentTaskId: parent.id });

    const result = buildVisibleTaskHierarchy([parent, activeSubtask, doneSubtask]);

    expect(result.visibleTasks.map((item) => item.id)).toEqual(["parent"]);
    expect(result.subtasksByParent.get(parent.id)?.map((item) => item.id)).toEqual(["active-child"]);
  });

  it("shows done subtasks standalone when their parent is unfinished", () => {
    const parent = task({ id: "parent", title: "Parent", status: "todo" });
    const doneSubtask = task({
      id: "done-child",
      title: "Done child",
      status: "done",
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
    });

    const result = buildVisibleTaskHierarchy([parent, doneSubtask], "done");

    expect(result.visibleTasks.map((item) => item.id)).toEqual(["done-child"]);
    expect(result.visibleTasks[0].parentTaskTitle).toBe("Parent");
  });

  it("keeps done parent/subtask rows nested in the done view", () => {
    const parent = task({ id: "parent", title: "Parent", status: "done" });
    const doneSubtask = task({ id: "done-child", title: "Done child", status: "done", parentTaskId: parent.id });

    const result = buildVisibleTaskHierarchy([parent, doneSubtask], "done");

    expect(result.visibleTasks.map((item) => item.id)).toEqual(["parent"]);
    expect(result.subtasksByParent.get(parent.id)?.map((item) => item.id)).toEqual(["done-child"]);
  });
});

describe("TaskStatusBadge", () => {
  it("renders the review label", () => {
    render(
      <MantineProvider>
        <TaskStatusBadge status="review_testing" />
      </MantineProvider>,
    );

    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});

describe("TasksPage presentation helpers", () => {
  it("builds compact assignee initials and overflow labels", () => {
    const avatarItems = getAssigneeAvatarItems(
      task({
        id: "multi-assignee",
        title: "Multi assignee",
        status: "todo",
        assigneeNames: ["Ada Lovelace", "Grace Hopper", "Linus"],
      }),
    );

    expect(getAssigneeInitials("Ada Lovelace")).toBe("AL");
    expect(getAssigneeInitials("Linus")).toBe("LI");
    expect(getAssigneeInitials(" ")).toBe("?");
    expect(avatarItems.visibleNames).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(avatarItems.overflowCount).toBe(1);
    expect(avatarItems.label).toBe("Ada Lovelace, Grace Hopper, Linus");
  });

  it("formats task pagination ranges", () => {
    expect(getTaskRangeLabel(1, 10, 0)).toBe("Showing 0 tasks");
    expect(getTaskRangeLabel(1, 10, 27)).toBe("Showing 1 to 10 of 27 tasks");
    expect(getTaskRangeLabel(3, 10, 27)).toBe("Showing 21 to 27 of 27 tasks");
  });
});
