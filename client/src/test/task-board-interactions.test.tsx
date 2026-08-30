/*
Specify the board interaction contract at the accessible UI boundary: editable
cards expose both dnd-kit drag handles and an equivalent status menu, while
read-only and pending cards remain safe to operate.
*/
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { taskStatusLabels, taskStatusValues, type TaskDTO } from "@team-management/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskBoard } from "../components/task-board/TaskBoard";
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
    deadline: null,
    startDate: null,
    completedAt: null,
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
    attachmentsPreviewAvailable: true,
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

describe("TaskBoardCard status fallback", () => {
  it("moves an editable card through the accessible menu and marks its current status disabled", async () => {
    const user = userEvent.setup();
    const task = createTask({ id: "menu-task", title: "Prepare report", status: "todo" });
    const onStatusChange = vi.fn();

    renderWithMantine(
      <TaskBoardCard
        task={task}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    const moveButton = screen.getByRole("button", { name: "Move Prepare report" });
    await user.click(moveButton);

    const currentStatus = await screen.findByRole("menuitem", { name: /To Do.*current status/i });
    expect(currentStatus).toBeDisabled();
    expect(currentStatus).toHaveAttribute("aria-current", "true");

    const targetStatus = await screen.findByRole("menuitem", { name: taskStatusLabels.in_progress });
    targetStatus.focus();
    await user.keyboard("{Enter}");

    expect(onStatusChange).toHaveBeenCalledWith(task, "in_progress");
  });

  it("supports choosing a new status from the keyboard menu path", async () => {
    const user = userEvent.setup();
    const task = createTask({ id: "keyboard-menu-task", title: "Keyboard task", status: "todo" });
    const onStatusChange = vi.fn();

    renderWithMantine(
      <TaskBoardCard
        task={task}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    const moveButton = screen.getByRole("button", { name: "Move Keyboard task" });
    moveButton.focus();
    await user.keyboard("{Enter}");
    const targetStatus = await screen.findByRole("menuitem", { name: taskStatusLabels.blocked });
    targetStatus.focus();
    await user.keyboard("{Enter}");

    expect(onStatusChange).toHaveBeenCalledWith(task, "blocked");
  });
});

describe("TaskBoard interaction accessibility", () => {
  it("wires the card menu through the board and exposes dnd-kit's keyboard instructions", async () => {
    const user = userEvent.setup();
    const task = createTask({ id: "board-task", title: "Board task", status: "todo" });
    const onStatusChange = vi.fn();

    renderWithMantine(
      <TaskBoard
        columns={buildTaskBoardModel([task])}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    const dragHandle = await screen.findByRole("button", { name: "Drag Board task" });
    await waitFor(() => {
      expect(dragHandle).toHaveAttribute("aria-roledescription", "draggable");
      expect(dragHandle).toHaveAttribute("aria-describedby");
    });
    expect(screen.getByText(/Press Space to pick up the task/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move Board task" }));
    await user.click(await screen.findByRole("menuitem", { name: taskStatusLabels.review_testing }));

    expect(onStatusChange).toHaveBeenCalledWith(task, "review_testing");
  });

  it("does not expose drag or status movement controls for read-only cards", () => {
    const task = createTask({ id: "read-only-task", title: "Read only task", status: "todo", canEdit: false });

    renderWithMantine(
      <TaskBoard
        columns={buildTaskBoardModel([task])}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Drag Read only task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move Read only task" })).not.toBeInTheDocument();
  });

  it("isolates the pending state to the task whose status mutation is in flight", () => {
    const pendingTask = createTask({ id: "pending-task", title: "Pending task", status: "todo" });
    const availableTask = createTask({ id: "available-task", title: "Available task", status: "blocked" });

    renderWithMantine(
      <TaskBoard
        columns={buildTaskBoardModel([pendingTask, availableTask])}
        pendingStatusTaskIds={new Set([pendingTask.id])}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const pendingCard = screen.getByText("Pending task").closest("[data-task-id]");
    expect(pendingCard).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Move Pending task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Drag Pending task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Available task" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Drag Available task" })).not.toBeDisabled();
  });

  it("keeps the five status columns in the shared status order", () => {
    const task = createTask({ id: "order-task", title: "Order task", status: taskStatusValues[0] });

    renderWithMantine(
      <TaskBoard
        columns={buildTaskBoardModel([task])}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const columns = screen.getAllByRole("region").filter((region) => region.className.includes("task-board-column"));
    expect(columns.map((column) => column.getAttribute("data-status"))).toEqual([...taskStatusValues]);
  });
});
