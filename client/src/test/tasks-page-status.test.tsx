/*
Exercise the page-level status boundary so the parent/subtask completion guard
is verified on the same callback path used by both board menus and drag drops.
*/
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TaskDTO } from "@team-management/shared";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCreateTask,
  useCreateTaskShareLink,
  useDeleteTask,
  useDeleteTaskAttachment,
  useImportTasks,
  useMembers,
  useProjects,
  useTasks,
  useUploadTaskAttachments,
  useUpdateTask,
  useUpdateTaskStatus,
} from "../hooks/use-app-data";
import { TasksPage } from "../pages/TasksPage";

vi.mock("../components/forms/TaskFormModal", () => ({
  TaskFormModal: () => null,
}));

vi.mock("../hooks/use-app-data", () => ({
  downloadTaskAttachment: vi.fn(),
  downloadTaskAttachmentArchive: vi.fn(),
  downloadTaskImportTemplate: vi.fn(),
  exportTasks: vi.fn(),
  previewTaskAttachment: vi.fn(),
  useCreateTask: vi.fn(),
  useCreateTaskShareLink: vi.fn(),
  useDeleteTask: vi.fn(),
  useDeleteTaskAttachment: vi.fn(),
  useImportTasks: vi.fn(),
  useMembers: vi.fn(),
  useProjects: vi.fn(),
  useTasks: vi.fn(),
  useUploadTaskAttachments: vi.fn(),
  useUpdateTask: vi.fn(),
  useUpdateTaskStatus: vi.fn(),
}));

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

function mutationStub() {
  return { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) };
}

const statusMutateAsync = vi.fn();

function renderTasksPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={["/tasks?view=board"]}>
          <TasksPage />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("TasksPage status movement safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const parent = createTask({ id: "parent", title: "Parent task", status: "todo" });
    const activeChild = createTask({
      id: "active-child",
      title: "Active child",
      status: "in_progress",
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
    });

    vi.mocked(useProjects).mockReturnValue({ data: { ownedProjects: [{ id: "project-1", name: "Operations" }], sharedProjects: [] }, isLoading: false } as never);
    vi.mocked(useMembers).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useTasks).mockReturnValue({ data: [parent, activeChild], isLoading: false } as never);
    vi.mocked(useCreateTask).mockReturnValue(mutationStub() as never);
    vi.mocked(useCreateTaskShareLink).mockReturnValue(mutationStub() as never);
    vi.mocked(useDeleteTask).mockReturnValue(mutationStub() as never);
    vi.mocked(useDeleteTaskAttachment).mockReturnValue(mutationStub() as never);
    vi.mocked(useImportTasks).mockReturnValue(mutationStub() as never);
    vi.mocked(useUploadTaskAttachments).mockReturnValue(mutationStub() as never);
    vi.mocked(useUpdateTask).mockReturnValue(mutationStub() as never);
    vi.mocked(useUpdateTaskStatus).mockReturnValue({ isPending: false, mutateAsync: statusMutateAsync } as never);
  });

  it("requires confirmation before completing a parent with active direct subtasks", async () => {
    const user = userEvent.setup();
    renderTasksPage();

    await user.click(screen.getByRole("button", { name: "Move Parent task" }));
    await user.click(await screen.findByRole("menuitem", { name: "Done" }));

    expect(statusMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toHaveTextContent(/server will also complete the active subtask/i);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(statusMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Move Parent task" }));
    await user.click(await screen.findByRole("menuitem", { name: "Done" }));
    await user.click(await screen.findByRole("button", { name: /Complete task and active subtasks/i }));

    await waitFor(() => {
      expect(statusMutateAsync).toHaveBeenCalledWith({ id: "parent", status: "done" });
    });
  });
});
