/* Verify the task modal switches attachment controls by task status and blocks oversize uploads before the request is sent. */
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ProjectSummaryDTO, TaskDTO, TeamMemberDTO } from "@team-management/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskFormModal, validateAttachmentFiles } from "../components/forms/TaskFormModal";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

afterEach(() => {
  cleanup();
});

const projects: ProjectSummaryDTO[] = [{ id: "project-1", name: "Operations", description: null, status: "active", color: "#16A98B", memberCount: 1, taskCount: 1, createdAt: "2030-05-01T08:00:00.000Z", updatedAt: "2030-05-01T08:00:00.000Z" }];
const members: TeamMemberDTO[] = [{ id: "member-1", name: "Ada Manager", role: "Lead", email: "ada@example.com", notes: null, active: true, projectIds: ["project-1"], openTaskCount: 1, completedTaskCount: 0, createdAt: "2030-05-01T08:00:00.000Z", updatedAt: "2030-05-01T08:00:00.000Z" }];

function task(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    title: "Attachment task",
    description: null,
    notes: null,
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
    attachments: [],
    attachmentArchive: null,
    attachmentsPreviewAvailable: true,
    createdAt: "2030-05-01T08:00:00.000Z",
    updatedAt: "2030-05-01T08:00:00.000Z",
    ...overrides,
  };
}

function renderModal(currentTask: TaskDTO | null) {
  return render(
    <MantineProvider>
      <TaskFormModal
        projects={[...projects]}
        members={[...members]}
        opened
        pending={false}
        attachmentPending={false}
        task={currentTask}
        tasks={currentTask ? [currentTask] : []}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onUploadAttachments={vi.fn().mockResolvedValue(undefined)}
        onDeleteAttachment={vi.fn().mockResolvedValue(undefined)}
        onDownloadAttachment={vi.fn().mockResolvedValue(undefined)}
        onDownloadAttachmentArchive={vi.fn().mockResolvedValue(undefined)}
        onPreviewAttachment={vi.fn().mockResolvedValue(undefined)}
      />
    </MantineProvider>,
  );
}

describe("TaskFormModal attachments", () => {
  it("shows active-task upload controls and existing attachment rows", () => {
    renderModal(
      task({
        attachments: [
          {
            id: "attachment-1",
            filename: "brief.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            isImage: false,
            createdAt: "2030-05-01T08:00:00.000Z",
            updatedAt: "2030-05-01T08:00:00.000Z",
          },
        ],
      }),
    );

    expect(screen.getByText("Attachments")).toBeInTheDocument();
    expect(screen.getByLabelText("Add files")).toBeInTheDocument();
    expect(screen.getByText("brief.pdf")).toBeInTheDocument();
    expect(screen.getByLabelText("Preview brief.pdf")).toBeEnabled();
  });

  it("shows archive-only controls for done tasks", () => {
    renderModal(
      task({
        status: "done",
        completedAt: "2030-05-10T10:00:00.000Z",
        attachmentsPreviewAvailable: false,
        attachmentArchive: {
          id: "archive-1",
          sizeBytes: 4096,
          generatedAt: "2030-05-10T10:00:00.000Z",
        },
        attachments: [
          {
            id: "attachment-1",
            filename: "brief.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            isImage: false,
            createdAt: "2030-05-01T08:00:00.000Z",
            updatedAt: "2030-05-01T08:00:00.000Z",
          },
        ],
      }),
    );

    expect(screen.getByText("Preview is disabled for done tasks. Download the archive to inspect the compressed files.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download archive" })).toBeEnabled();
    expect(screen.queryByLabelText("Add files")).not.toBeInTheDocument();
  });

  it("blocks files larger than 10 MB before upload", () => {
    const largeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.bin", {
      type: "application/octet-stream",
    });

    expect(validateAttachmentFiles([largeFile])).toBe("huge.bin exceeds the 10 MB limit.");
  });
});
