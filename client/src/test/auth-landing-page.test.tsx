/* Tests for AuthLandingPage and its interactive showcase micro-simulations. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthLandingPage } from "../pages/AuthLandingPage";

describe("AuthLandingPage Showcase", () => {
  afterEach(() => {
    cleanup();
  });

  function renderLandingPage(mode: "login" | "register" = "login") {
    return render(
      <MantineProvider>
        <MemoryRouter>
          <AuthLandingPage
            mode={mode}
            loginLoading={false}
            loginErrorMessage={null}
            registerLoading={false}
            registerErrorMessage={null}
            onLoginSubmit={vi.fn()}
            onRegisterSubmit={vi.fn()}
          />
        </MemoryRouter>
      </MantineProvider>,
    );
  }

  it("renders all showcase sections and branding", () => {
    renderLandingPage();

    // Brand and headline
    expect(screen.getAllByText(/MGteam/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bring order to complex team execution/i)).toBeInTheDocument();

    // Section headings
    expect(screen.getByText(/Kanban Execution & Defect Governance/i)).toBeInTheDocument();
    expect(screen.getByText(/Operational Visibility & Workload/i)).toBeInTheDocument();
    expect(screen.getByText(/Calendar & Client Sharing/i)).toBeInTheDocument();

    // High contrast CTA
    expect(screen.getByText(/Bring order to team execution in minutes/i)).toBeInTheDocument();

    // Footer
    expect(screen.getByText(/All Systems Operational/i)).toBeInTheDocument();
  });

  it("interactively updates Workspace Pulse subtasks and progress", () => {
    renderLandingPage();

    // Initially 2 of 3 subtasks completed = 67%
    expect(screen.getByText(/67%/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 subtasks verified/i)).toBeInTheDocument();
    expect(screen.getByText(/In Flight/i)).toBeInTheDocument();

    // Toggle the unchecked third subtask (Apple Pay & Google Pay)
    const thirdSubtask = screen.getByLabelText(/Toggle Apple Pay & Google Pay direct checkout tokens/i);
    fireEvent.click(thirdSubtask);

    // Now 3 of 3 completed = 100% and Milestone Complete badge
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 subtasks verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Milestone Complete/i)).toBeInTheDocument();
  });

  it("advances Kanban lanes and toggles defect flag", () => {
    renderLandingPage();

    // Card starts in "In Progress"
    expect(screen.getByText(/Zero-Downtime Distributed Lock Manager/i)).toBeInTheDocument();
    expect(screen.queryByText(/Defect: Token Race Condition/i)).not.toBeInTheDocument();

    // Flag Defect
    const flagDefectButton = screen.getByRole("button", { name: /flag defect/i });
    fireEvent.click(flagDefectButton);

    expect(screen.getByText(/Defect: Token Race Condition/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resolve defect/i })).toBeInTheDocument();

    // Resolve Defect
    fireEvent.click(screen.getByRole("button", { name: /resolve defect/i }));
    expect(screen.queryByText(/Defect: Token Race Condition/i)).not.toBeInTheDocument();

    // Advance lane
    const advanceLaneButton = screen.getByRole("button", { name: /advance lane/i });
    fireEvent.click(advanceLaneButton);

    // Card should still be visible in the board
    expect(screen.getByText(/Zero-Downtime Distributed Lock Manager/i)).toBeInTheDocument();
  });

  it("inspects team member capacity when selecting different members", () => {
    renderLandingPage();

    // Defaults to Elena Rostova
    expect(screen.getAllByText(/Elena Rostova/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Lead Architect/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Distributed lock manager, Redis Redlock leasing & idempotency keys/i)).toBeInTheDocument();
    // Select Marcus Vance
    const marcusButton = screen.getByRole("button", { name: /select marcus vance/i });
    fireEvent.click(marcusButton);

    expect(screen.getByText(/Database query optimization, replica failover & connection pooling/i)).toBeInTheDocument();
    expect(screen.getByText(/68% allocated/i)).toBeInTheDocument();

    // Select Sofia Chen
    const sofiaButton = screen.getByRole("button", { name: /select sofia chen/i });
    fireEvent.click(sofiaButton);

    expect(screen.getByText(/Automated end-to-end regression test suite & chaos testing/i)).toBeInTheDocument();
    expect(screen.getByText(/52% allocated/i)).toBeInTheDocument();
  });

  it("interacts with the milestone calendar strip and client share preview", () => {
    renderLandingPage();

    // Select Monday on the 5-day calendar strip
    const monButton = screen.getByRole("button", { name: /select mon sep 07/i });
    fireEvent.click(monButton);

    expect(screen.getByText(/Mon, Sep 07 • Architecture Sign-off/i)).toBeInTheDocument();
    expect(screen.getByText(/System RFC Architectural Sign-off/i)).toBeInTheDocument();

    // Toggle to Manager View in Client Share Preview
    const managerRadio = screen.getByRole("radio", { name: /manager view/i });
    fireEvent.click(managerRadio);

    expect(screen.getByText(/INTERNAL MANAGER CONTROLS ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit scope/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reassign owner/i })).toBeInTheDocument();

    // Toggle back to Client Preview
    const clientRadio = screen.getByRole("radio", { name: /client preview/i });
    fireEvent.click(clientRadio);

    expect(screen.getByText(/VERIFIED CLIENT ACCESS • READ-ONLY TOKEN/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit scope/i })).not.toBeInTheDocument();
  });
});
