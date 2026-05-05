/* Verify project editing keeps the agent context field in sync across modal
resets so create and edit submissions carry the intended project guidance.
*/
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectSummaryDTO, TeamMemberDTO } from "@team-management/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectFormModal } from "../components/forms/ProjectFormModal";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

const members: TeamMemberDTO[] = [{
  id: "member-1",
  name: "Ada Manager",
  role: "Lead",
  email: "ada@example.com",
  notes: null,
  active: true,
  projectIds: ["project-1"],
  openTaskCount: 1,
  completedTaskCount: 0,
  createdAt: "2030-05-01T08:00:00.000Z",
  updatedAt: "2030-05-01T08:00:00.000Z",
}];

function renderModal(project: (ProjectSummaryDTO & { memberIds?: string[] }) | null, onSubmit = vi.fn()) {
  return render(
    <MantineProvider>
      <ProjectFormModal
        members={members}
        opened
        pending={false}
        project={project}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    </MantineProvider>,
  );
}

describe("ProjectFormModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits AI context for a new project", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderModal(null, onSubmit);

    await user.type(screen.getByLabelText("Name"), "Agent rollout");
    await user.type(screen.getByLabelText("Description"), "Coordinate automation across teams.");
    await user.type(screen.getByLabelText("AI context"), "Use staged releases and flag any customer-impact risk.");
    await user.click(screen.getByRole("button", { name: "Save project" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "Agent rollout",
      description: "Coordinate automation across teams.",
      aiContext: "Use staged releases and flag any customer-impact risk.",
    }));
  });

  it("resets the AI context field when editing an existing project", () => {
    const project: ProjectSummaryDTO & { memberIds?: string[] } = {
      id: "project-1",
      name: "Operations",
      description: "Coordinate operations work.",
      aiContext: "Keep terminology aligned with the support team.",
      goLiveDate: null,
      phaseDates: [],
      status: "active",
      color: "#16A98B",
      memberCount: 1,
      taskCount: 2,
      createdAt: "2030-05-01T08:00:00.000Z",
      updatedAt: "2030-05-01T08:00:00.000Z",
      memberIds: ["member-1"],
    };

    renderModal(project);

    expect(screen.getByDisplayValue("Keep terminology aligned with the support team.")).toBeInTheDocument();
  });
});
