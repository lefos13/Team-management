/* Verify dashboard task rows can show completion timestamps separately from deadlines. */
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { TaskDTO } from "@team-management/shared";
import { describe, expect, it } from "vitest";

import { PaginatedTaskStack } from "../pages/DashboardPage";
import { formatDateTime } from "../lib/dates";

const completedTask = {
  id: "task-1",
  title: "Archive onboarding checklist",
  description: null,
  status: "done",
  isDefect: false,
  deadline: "2030-05-10T09:00:00.000Z",
  startDate: null,
  completedAt: "2029-04-03T12:30:00.000Z",
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
  attachmentsPreviewAvailable: false,
  createdAt: "2029-04-01T08:00:00.000Z",
  updatedAt: "2029-04-03T12:30:00.000Z",
} satisfies TaskDTO;

describe("PaginatedTaskStack", () => {
  it("shows the completion date for recently completed rows", () => {
    render(
      <MantineProvider>
        <PaginatedTaskStack
          tasks={[completedTask]}
          empty="No completed tasks in this range."
          datePrefix="Done"
          getTaskDate={(task) => task.completedAt}
        />
      </MantineProvider>,
    );

    expect(screen.getByText(`Done ${formatDateTime(completedTask.completedAt)}`)).toBeInTheDocument();
    expect(screen.queryByText(formatDateTime(completedTask.deadline))).not.toBeInTheDocument();
  });
});
