/* Verify the admin page gates access, renders sidebar sections, and binds one paginated section at a time. */
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AdminPage } from "../pages/AdminPage";

const {
  useAdminOverviewMock,
  useAdminSessionMock,
  useAdminUsersPageMock,
  useAdminProjectsPageMock,
  useAdminMembersPageMock,
  useAdminTasksPageMock,
  useAdminAccessPageMock,
  useCreateAdminSessionMock,
  useDeleteAdminSessionMock,
} = vi.hoisted(() => ({
  useAdminSessionMock: vi.fn(),
  useCreateAdminSessionMock: vi.fn(),
  useDeleteAdminSessionMock: vi.fn(),
  useAdminOverviewMock: vi.fn(),
  useAdminUsersPageMock: vi.fn(),
  useAdminProjectsPageMock: vi.fn(),
  useAdminMembersPageMock: vi.fn(),
  useAdminTasksPageMock: vi.fn(),
  useAdminAccessPageMock: vi.fn(),
}));

vi.mock("../hooks/use-app-data", () => ({
  useAdminSession: useAdminSessionMock,
  useCreateAdminSession: useCreateAdminSessionMock,
  useDeleteAdminSession: useDeleteAdminSessionMock,
  useAdminOverview: useAdminOverviewMock,
  useAdminUsersPage: useAdminUsersPageMock,
  useAdminProjectsPage: useAdminProjectsPageMock,
  useAdminMembersPage: useAdminMembersPageMock,
  useAdminTasksPage: useAdminTasksPageMock,
  useAdminAccessPage: useAdminAccessPageMock,
}));

function renderPage(initialEntry = "/admin/users?page=2&pageSize=10") {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

function mockBaseState() {
  useCreateAdminSessionMock.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
  useDeleteAdminSessionMock.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  });
}

function mockUnlockedState() {
  useAdminSessionMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { authenticated: true },
  });
  useAdminOverviewMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      totals: {
        userCount: 3,
        verifiedUserCount: 2,
        projectCount: 4,
        taskCount: 5,
        invitationCount: 1,
        activeAccessCount: 2,
      },
    },
  });
  useAdminUsersPageMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      page: 2,
      pageSize: 10,
      totalItems: 23,
      totalPages: 3,
      items: [
        {
          id: "user-1",
          email: "owner@example.com",
          emailVerified: true,
          emailVerifiedAt: "2030-01-01T09:00:00.000Z",
          createdAt: "2030-01-01T08:00:00.000Z",
        },
      ],
    },
  });
  useAdminProjectsPageMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
  useAdminMembersPageMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
  useAdminTasksPageMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
  useAdminAccessPageMock.mockReturnValue({ isLoading: false, isError: false, data: undefined });
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseState();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the admin password form before an admin session exists", () => {
    useAdminSessionMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { authenticated: false },
    });

    renderPage("/admin");

    expect(screen.getByLabelText(/secret password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock backoffice/i })).toBeInTheDocument();
  });

  it("renders sidebar navigation and paginated section content after unlock", () => {
    mockUnlockedState();

    renderPage();

    expect(screen.getByRole("heading", { name: "Read-only operations view" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /access and invitations/i })).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText(/23 records/i)).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    expect(useAdminUsersPageMock).toHaveBeenCalledWith(true, { page: 2, pageSize: 10 });
  });
});
