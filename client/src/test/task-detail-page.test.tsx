/* Verify the task detail route keeps notes and attachment previews in one
read-focused screen while preserving archive-only behavior for done tasks.
*/

import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TaskDTO } from "@team-management/shared";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskDetailPage } from "../pages/TaskDetailPage";

const { useProjectDetailMock, useTaskDetailMock, mutateAsync, writeTextMock } = vi.hoisted(() => ({
  useProjectDetailMock: vi.fn(),
  useTaskDetailMock: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  writeTextMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../hooks/use-app-data", () => ({
  useProjectDetail: useProjectDetailMock,
  useTaskDetail: useTaskDetailMock,
  useUpdateTask: vi.fn(() => ({
    mutateAsync,
    isPending: false,
  })),
  downloadTaskAttachment: vi.fn(),
  downloadTaskAttachmentArchive: vi.fn(),
  previewTaskAttachment: vi.fn(),
}));

function buildTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    title: "Preview task",
    description: "Ship the launch checklist.",
    notes: "Coordinate with support before rollout.",
    status: "todo",
    isDefect: false,
    deadline: "2030-05-10T09:00:00.000Z",
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
    attachments: [
      {
        id: "attachment-1",
        filename: "brief.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        isImage: true,
        createdAt: "2030-05-01T08:00:00.000Z",
        updatedAt: "2030-05-01T08:00:00.000Z",
      },
    ],
    attachmentArchive: null,
    attachmentsPreviewAvailable: true,
    canEdit: true,
    canManageAssignees: true,
    createdAt: "2030-05-01T08:00:00.000Z",
    updatedAt: "2030-05-01T08:00:00.000Z",
    ...overrides,
  };
}

function renderPage(task: TaskDTO) {
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: writeTextMock,
    },
  });

  useTaskDetailMock.mockReturnValue({
    data: task,
    isLoading: false,
  });
  useProjectDetailMock.mockReturnValue({
    data: {
      id: "project-1",
      name: "Operations",
      description: "Coordinate launch readiness.",
      aiContext: "Use release-safe language and note customer-impact assumptions.",
      status: "active",
      color: "#16A98B",
      memberCount: 1,
      taskCount: 1,
      createdAt: "2030-05-01T08:00:00.000Z",
      updatedAt: "2030-05-01T08:00:00.000Z",
      memberIds: ["member-1"],
      tasks: ["task-1"],
    },
    isLoading: false,
  });

  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("TaskDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders description, notes, and active attachment previews", () => {
    renderPage(buildTask());

    expect(screen.getByText("Ship the launch checklist.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Coordinate with support before rollout.")).toBeInTheDocument();
    expect(screen.getAllByText("brief.png").length).toBeGreaterThan(0);
    expect(screen.getByAltText("brief.png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download archive" })).not.toBeInTheDocument();
  });

  it("saves notes and switches to archive-only UI for done tasks", async () => {
    const user = userEvent.setup();
    renderPage(
      buildTask({
        status: "done",
        attachmentArchive: {
          id: "archive-1",
          sizeBytes: 4096,
          generatedAt: "2030-05-10T10:00:00.000Z",
        },
        attachmentsPreviewAvailable: false,
      }),
    );

    const notesInput = screen.getByPlaceholderText("Add internal notes for this task.");
    await user.clear(notesInput);
    await user.type(notesInput, "Reopened only after customer sign-off.");
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: "task-1",
      payload: expect.objectContaining({
        notes: "Reopened only after customer sign-off.",
      }),
    });
    expect(screen.getByRole("button", { name: "Download archive" })).toBeEnabled();
    expect(screen.queryByAltText("brief.png")).not.toBeInTheDocument();
  });

  it("copies an AI prompt with project and task context", async () => {
    const user = userEvent.setup();
    renderPage(buildTask());
    await user.click(screen.getByRole("button", { name: "Copy AI prompt" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("Project Context\nDescription:\nCoordinate launch readiness."));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("AI Context:\nUse release-safe language and note customer-impact assumptions."));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("Task\nTitle: Preview task"));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("Notes:\nCoordinate with support before rollout."));
      expect(writeTextMock).not.toHaveBeenCalledWith(expect.stringContaining("Status:"));
      expect(writeTextMock).not.toHaveBeenCalledWith(expect.stringContaining("Assignees:"));
    });
  });

  it("shows unassigned when deleted members leave no assignees", () => {
    renderPage(buildTask({ assigneeId: null, assigneeIds: [], assigneeName: null, assigneeNames: [] }));

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});
