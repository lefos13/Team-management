/*
Component tests for the desktop Jira-style task board covering column ordering,
counts, subtask parent labels, empty states, show-more pagination, permissions,
and callbacks.
*/
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { taskStatusLabels, taskStatusValues, type TaskDTO } from "@team-management/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskBoard } from "../components/task-board/TaskBoard";
import { TaskBoardColumn } from "../components/task-board/TaskBoardColumn";
import { TaskBoardCard } from "../components/task-board/TaskBoardCard";
import { buildTaskBoardModel } from "../lib/task-board-model";

afterEach(() => {
  cleanup();
});

function createTask(overrides: Partial<TaskDTO> & Pick<TaskDTO, "id" | "title" | "status">): TaskDTO {
  return {
    description: "Task description for testing",
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
    projectName: "Alpha Project",
    assigneeName: "Ada Lovelace",
    assigneeNames: ["Ada Lovelace"],
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

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("TaskBoard component", () => {
  it("renders exactly five columns in taskStatusValues order with accessible headings and counts", () => {
    const tasks: TaskDTO[] = [
      createTask({ id: "t1", title: "Task 1", status: "todo" }),
      createTask({ id: "t2", title: "Task 2", status: "todo" }),
      createTask({ id: "t3", title: "Task 3", status: "in_progress" }),
      createTask({ id: "t4", title: "Task 4", status: "done" }),
    ];

    const columns = buildTaskBoardModel(tasks);

    renderWithMantine(
      <TaskBoard
        columns={columns}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Columns should appear in taskStatusValues order with accessible headings
    const expectedHeaders = taskStatusValues.map((status) => taskStatusLabels[status]);
    for (const header of expectedHeaders) {
      expect(screen.getByRole("heading", { name: new RegExp(`^${header}$`, "i") })).toBeInTheDocument();
    }

    // Accessible column regions should reflect accurate total counts
    expect(screen.getByRole("region", { name: "To Do column, 2 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress column, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocked column, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Review column, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done column, 1 task" })).toBeInTheDocument();
  });

  it("renders meaningful empty state for columns without tasks", () => {
    const columns = buildTaskBoardModel([
      createTask({ id: "t1", title: "Task 1", status: "todo" }),
    ]);

    renderWithMantine(
      <TaskBoard
        columns={columns}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Columns with 0 tasks should render an empty state message
    const emptyStates = screen.getAllByText(/No tasks in this column/i);
    expect(emptyStates.length).toBe(4);
  });
});

describe("TaskBoardColumn component", () => {
  it("initially limits display to 25 cards and shows 'Show more' when more tasks exist", () => {
    const tasks: TaskDTO[] = Array.from({ length: 30 }, (_, index) =>
      createTask({
        id: `todo-${index + 1}`,
        title: `Todo Task #${index + 1}`,
        status: "todo",
      }),
    );

    renderWithMantine(
      <TaskBoardColumn
        column={{ status: "todo", tasks }}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Should render only first 25 tasks initially
    expect(screen.getByText("Todo Task #1")).toBeInTheDocument();
    expect(screen.getByText("Todo Task #25")).toBeInTheDocument();
    expect(screen.queryByText("Todo Task #26")).not.toBeInTheDocument();

    // Show more button should be present
    const showMoreButton = screen.getByRole("button", { name: /Show more \(5 remaining\)/i });
    expect(showMoreButton).toBeInTheDocument();

    // Click Show more to expand
    fireEvent.click(showMoreButton);

    // Now all 30 tasks should be visible
    expect(screen.getByText("Todo Task #26")).toBeInTheDocument();
    expect(screen.getByText("Todo Task #30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show more/i })).not.toBeInTheDocument();
  });

  it("does not show 'Show more' control when tasks count is 25 or fewer", () => {
    const tasks: TaskDTO[] = Array.from({ length: 5 }, (_, index) =>
      createTask({
        id: `todo-${index + 1}`,
        title: `Todo Task #${index + 1}`,
        status: "todo",
      }),
    );

    renderWithMantine(
      <TaskBoardColumn
        column={{ status: "todo", tasks }}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Show more/i })).not.toBeInTheDocument();
  });
});

describe("TaskBoardCard component", () => {
  it("renders scan-friendly task metadata including title, project, defect status, attachments, and deadline", () => {
    const task = createTask({
      id: "card-1",
      title: "Implement API gateway",
      status: "in_progress",
      projectName: "Core Infrastructure",
      isDefect: true,
      deadline: "2030-06-15T00:00:00.000Z",
      attachments: [
        {
          id: "att-1",
          filename: "spec.pdf",
          sizeBytes: 1024,
          mimeType: "application/pdf",
          isImage: false,
          createdAt: "2030-05-01T08:00:00.000Z",
          updatedAt: "2030-05-01T08:00:00.000Z",
        },
      ],
    });
    const { container } = renderWithMantine(
      <TaskBoardCard
        task={task}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Implement API gateway")).toBeInTheDocument();
    expect(screen.getByText("Core Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Defect")).toBeInTheDocument();
    expect(screen.getByText("15 Jun 2030")).toBeInTheDocument();

    const attachmentElement = container.querySelector(".tasks-attachment-count");
    expect(attachmentElement).not.toBeNull();
    expect(within(attachmentElement as HTMLElement).getByText("1")).toBeInTheDocument();
  });

  it("renders parentTaskTitle context for subtasks", () => {
    const subtask = createTask({
      id: "sub-1",
      title: "Child task item",
      status: "todo",
      parentTaskId: "parent-123",
      parentTaskTitle: "Parent Epic Feature",
    });

    renderWithMantine(
      <TaskBoardCard
        task={subtask}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText(/Parent Epic Feature/i)).toBeInTheDocument();
  });

  it("renders completed date for done status tasks", () => {
    const doneTask = createTask({
      id: "done-1",
      title: "Completed migration",
      status: "done",
      completedAt: "2030-05-20T14:30:00.000Z",
    });

    renderWithMantine(
      <TaskBoardCard
        task={doneTask}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("20 May 2030")).toBeInTheDocument();
  });

  it("exposes only Preview action when task.canEdit is false (read-only mode)", () => {
    const readOnlyTask = createTask({
      id: "ro-1",
      title: "Read only task",
      status: "todo",
      canEdit: false,
    });

    renderWithMantine(
      <TaskBoardCard
        task={readOnlyTask}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Preview Read only task/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Read only task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share Read only task/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Read only task/i })).not.toBeInTheDocument();
  });

  it("exposes Preview, Edit, Share, and Delete actions when task.canEdit is true", () => {
    const editableTask = createTask({
      id: "edit-1",
      title: "Editable task",
      status: "todo",
      canEdit: true,
    });

    renderWithMantine(
      <TaskBoardCard
        task={editableTask}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Preview Editable task/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit Editable task/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share Editable task/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete Editable task/i })).toBeInTheDocument();
  });

  it("fires appropriate callbacks when action buttons are clicked", () => {
    const task = createTask({
      id: "cb-task-1",
      title: "Callback task",
      status: "in_progress",
      canEdit: true,
    });

    const onPreview = vi.fn();
    const onEdit = vi.fn();
    const onShare = vi.fn();
    const onDelete = vi.fn();

    renderWithMantine(
      <TaskBoardCard
        task={task}
        onPreview={onPreview}
        onEdit={onEdit}
        onShare={onShare}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Preview Callback task/i }));
    expect(onPreview).toHaveBeenCalledWith("cb-task-1");

    fireEvent.click(screen.getByRole("button", { name: /Edit Callback task/i }));
    expect(onEdit).toHaveBeenCalledWith("cb-task-1");

    fireEvent.click(screen.getByRole("button", { name: /Share Callback task/i }));
    expect(onShare).toHaveBeenCalledWith("cb-task-1");

    fireEvent.click(screen.getByRole("button", { name: /Delete Callback task/i }));
    expect(onDelete).toHaveBeenCalledWith("cb-task-1");
  });
});
