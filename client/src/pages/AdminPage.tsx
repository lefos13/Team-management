/*
Render the backoffice as a route-driven shell so the secret gate unlocks one
read-only admin surface with server-paginated sections instead of one oversized page.
*/
import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChecklist,
  IconFolder,
  IconKey,
  IconLock,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink, Navigate, useLocation, useSearchParams } from "react-router-dom";

import type {
  AdminAccessDTO,
  AdminMemberDTO,
  AdminPaginationQuery,
  AdminProjectDTO,
  AdminTaskDTO,
  AdminUserDTO,
  PaginatedAdminAccessDTO,
  PaginatedAdminMembersDTO,
  PaginatedAdminProjectsDTO,
  PaginatedAdminTasksDTO,
  PaginatedAdminUsersDTO,
} from "@team-management/shared";
import { CompactPagination } from "../components/CompactPagination";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  useAdminAccessPage,
  useAdminMembersPage,
  useAdminOverview,
  useAdminProjectsPage,
  useAdminSession,
  useAdminTasksPage,
  useAdminUsersPage,
  useCreateAdminSession,
  useDeleteAdminSession,
} from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";

type AdminSectionKey = "users" | "projects" | "members" | "tasks" | "access";

type SectionConfig = {
  key: AdminSectionKey;
  label: string;
  description: string;
  icon: typeof IconUsers;
};

type PaginatedSectionData =
  | PaginatedAdminUsersDTO
  | PaginatedAdminProjectsDTO
  | PaginatedAdminMembersDTO
  | PaginatedAdminTasksDTO
  | PaginatedAdminAccessDTO;

const adminSections: SectionConfig[] = [
  { key: "users", label: "Users", description: "Accounts and verification state across all workspaces.", icon: IconUsers },
  { key: "projects", label: "Projects", description: "Ownership, status, and workload distribution.", icon: IconFolder },
  { key: "members", label: "Members", description: "Team member records grouped by owning account.", icon: IconUsers },
  { key: "tasks", label: "Tasks", description: "Cross-project delivery status, deadlines, and defects.", icon: IconChecklist },
  { key: "access", label: "Access and Invitations", description: "Sharing relationships and pending invitations.", icon: IconShieldCheck },
];

const pageSizeOptions = ["10", "20", "50", "100"];

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && pageSizeOptions.includes(String(parsed)) ? parsed : 20;
}

function getSectionFromPath(pathname: string): AdminSectionKey | null {
  const segment = pathname.split("/")[2];
  return adminSections.some((section) => section.key === segment) ? (segment as AdminSectionKey) : null;
}

/*
Keep pagination in the URL so each admin subsection stays server-driven, refresh-safe,
and shareable without mixing page state into local component memory.
*/
function useAdminPagination() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));

  function updatePagination(next: Partial<AdminPaginationQuery>) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next.page ?? page));
    params.set("pageSize", String(next.pageSize ?? pageSize));
    setSearchParams(params, { replace: true });
  }

  return {
    pagination: { page, pageSize },
    setPage: (nextPage: number) => updatePagination({ page: nextPage }),
    setPageSize: (nextPageSize: number) => updatePagination({ page: 1, pageSize: nextPageSize }),
  };
}

function AdminTableShell({
  title,
  description,
  pagination,
  onPageChange,
  onPageSizeChange,
  children,
}: {
  title: string;
  description: string;
  pagination: PaginatedSectionData;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  children: ReactNode;
}) {
  return (
    <Paper className="admin-shell-card" radius="xl" p={{ base: "lg", sm: "xl" }} withBorder>
      <Stack gap="lg">
        <Group justify="space-between" align="end">
          <Stack gap={4}>
            <Title order={2}>{title}</Title>
            <Text c="dimmed">{description}</Text>
          </Stack>
          <Group gap="sm" align="end">
            <Select
              label="Rows"
              value={String(pagination.pageSize)}
              data={pageSizeOptions}
              onChange={(value) => {
                if (value) {
                  onPageSizeChange(Number(value));
                }
              }}
              w={92}
            />
            <Stack gap={2} align="end">
              <Text size="sm" c="dimmed">
                {pagination.totalItems} records
              </Text>
              <Text size="xs" c="dimmed">
                Page {pagination.page} of {pagination.totalPages}
              </Text>
            </Stack>
          </Group>
        </Group>
        <ScrollArea type="auto" offsetScrollbars>
          {children}
        </ScrollArea>
        {pagination.totalPages > 1 ? (
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{" "}
              {pagination.totalItems}
            </Text>
            <CompactPagination total={pagination.totalPages} value={pagination.page} onChange={onPageChange} />
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

function renderUsersTable(users: AdminUserDTO[]) {
  return (
    <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={680}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Email</Table.Th>
          <Table.Th>Verified</Table.Th>
          <Table.Th>Verified at</Table.Th>
          <Table.Th>Created</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed">No users found.</Text>
            </Table.Td>
          </Table.Tr>
        ) : users.map((user) => (
          <Table.Tr key={user.id}>
            <Table.Td>{user.email}</Table.Td>
            <Table.Td>
              <Badge color={user.emailVerified ? "teal" : "gray"} variant="light">
                {user.emailVerified ? "Verified" : "Pending"}
              </Badge>
            </Table.Td>
            <Table.Td>{formatDateTime(user.emailVerifiedAt)}</Table.Td>
            <Table.Td>{formatDateTime(user.createdAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function renderProjectsTable(projects: AdminProjectDTO[]) {
  return (
    <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={760}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Project</Table.Th>
          <Table.Th>Owner</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Members</Table.Th>
          <Table.Th>Tasks</Table.Th>
          <Table.Th>Updated</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {projects.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={6}>
              <Text c="dimmed">No projects found.</Text>
            </Table.Td>
          </Table.Tr>
        ) : projects.map((project) => (
          <Table.Tr key={project.id}>
            <Table.Td>{project.name}</Table.Td>
            <Table.Td>{project.ownerEmail}</Table.Td>
            <Table.Td>
              <Badge variant="light">{project.status.replace(/_/g, " ")}</Badge>
            </Table.Td>
            <Table.Td>{project.memberCount}</Table.Td>
            <Table.Td>{project.taskCount}</Table.Td>
            <Table.Td>{formatDateTime(project.updatedAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function renderMembersTable(members: AdminMemberDTO[]) {
  return (
    <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={760}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Role</Table.Th>
          <Table.Th>Owner</Table.Th>
          <Table.Th>State</Table.Th>
          <Table.Th>Created</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {members.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text c="dimmed">No members found.</Text>
            </Table.Td>
          </Table.Tr>
        ) : members.map((member) => (
          <Table.Tr key={member.id}>
            <Table.Td>
              <Stack gap={0}>
                <Text fw={700}>{member.name}</Text>
                <Text size="xs" c="dimmed">
                  {member.email}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>{member.role}</Table.Td>
            <Table.Td>{member.ownerEmail}</Table.Td>
            <Table.Td>
              <Badge color={member.active ? "teal" : "gray"} variant="light">
                {member.active ? "Active" : "Inactive"}
              </Badge>
            </Table.Td>
            <Table.Td>{formatDateTime(member.createdAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function renderTasksTable(tasks: AdminTaskDTO[]) {
  return (
    <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={860}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Task</Table.Th>
          <Table.Th>Project</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Assignee</Table.Th>
          <Table.Th>Deadline</Table.Th>
          <Table.Th>Updated</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tasks.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={6}>
              <Text c="dimmed">No tasks found.</Text>
            </Table.Td>
          </Table.Tr>
        ) : tasks.map((task) => (
          <Table.Tr key={task.id}>
            <Table.Td>
              <Stack gap={0}>
                <Text fw={700}>{task.title}</Text>
                {task.isDefect ? (
                  <Text size="xs" c="red">
                    Defect
                  </Text>
                ) : null}
              </Stack>
            </Table.Td>
            <Table.Td>{task.projectName}</Table.Td>
            <Table.Td>
              <Badge variant="light">{task.status.replace(/_/g, " ")}</Badge>
            </Table.Td>
            <Table.Td>{task.primaryAssigneeName ?? "Unassigned"}</Table.Td>
            <Table.Td>{formatDateTime(task.deadline)}</Table.Td>
            <Table.Td>{formatDateTime(task.updatedAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function renderAccessTable(accessItems: AdminAccessDTO[]) {
  return (
    <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={980}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Kind</Table.Th>
          <Table.Th>Project</Table.Th>
          <Table.Th>Invitee</Table.Th>
          <Table.Th>Permission</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Updated</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {accessItems.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={6}>
              <Text c="dimmed">No access records found.</Text>
            </Table.Td>
          </Table.Tr>
        ) : accessItems.map((item) => (
          <Table.Tr key={`${item.kind}-${item.id}`}>
            <Table.Td>
              <Badge variant="light" color={item.kind === "invitation" ? "orange" : "teal"}>
                {item.kind}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Stack gap={0}>
                <Text fw={700}>{item.projectName}</Text>
                <Text size="xs" c="dimmed">
                  Owner: {item.ownerEmail}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>
              <Stack gap={0}>
                <Text>{item.memberName ?? item.inviteEmail}</Text>
                <Text size="xs" c="dimmed">
                  {item.inviteEmail}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>{item.permission.replace(/_/g, " ")}</Table.Td>
            <Table.Td>
              <Badge variant="light">{item.status.replace(/_/g, " ")}</Badge>
            </Table.Td>
            <Table.Td>{formatDateTime(item.updatedAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function AdminPage() {
  const [password, setPassword] = useState("");
  const location = useLocation();
  const activeSection = getSectionFromPath(location.pathname);
  const { pagination, setPage, setPageSize } = useAdminPagination();
  const adminSessionQuery = useAdminSession();
  const createAdminSessionMutation = useCreateAdminSession();
  const deleteAdminSessionMutation = useDeleteAdminSession();
  const unlocked = adminSessionQuery.data?.authenticated ?? false;
  const overviewQuery = useAdminOverview(unlocked);
  const usersQuery = useAdminUsersPage(unlocked && activeSection === "users", pagination);
  const projectsQuery = useAdminProjectsPage(unlocked && activeSection === "projects", pagination);
  const membersQuery = useAdminMembersPage(unlocked && activeSection === "members", pagination);
  const tasksQuery = useAdminTasksPage(unlocked && activeSection === "tasks", pagination);
  const accessQuery = useAdminAccessPage(unlocked && activeSection === "access", pagination);

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createAdminSessionMutation.mutateAsync({ password });
      setPassword("");
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unlock failed",
        message: getErrorMessage(error, "Unable to unlock the backoffice."),
      });
    }
  }

  async function handleSignOut() {
    await deleteAdminSessionMutation.mutateAsync();
  }

  if (adminSessionQuery.isLoading) {
    return (
      <Center mih="100vh">
        <Loader color="teal" size="lg" />
      </Center>
    );
  }

  if (!unlocked) {
    return (
      <div className="admin-page admin-login-page">
        <Container size="sm" py={{ base: 48, md: 96 }}>
          <Paper className="admin-shell-card admin-login-shell" radius="xl" p={{ base: "lg", sm: "xl" }} withBorder>
            <Stack gap="xl">
              <Group justify="space-between" align="start">
                <Stack gap={6}>
                  <Text className="eyebrow">Admin backoffice</Text>
                  <Title order={1} className="admin-title">
                    Unlock the read-only operations view
                  </Title>
                  <Text c="dimmed">
                    Enter the server-managed secret password to inspect users, projects, members, tasks, and shared access data.
                  </Text>
                </Stack>
                <Group gap="sm" align="center">
                  <ThemeToggle />
                  <Badge size="lg" color="dark" variant="light" leftSection={<IconLock size={14} />}>
                    Protected
                  </Badge>
                </Group>
              </Group>

              <form onSubmit={handleUnlock}>
                <Stack gap="md">
                  <PasswordInput
                    label="Secret password"
                    placeholder="Enter the admin secret"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    required
                    size="md"
                  />
                  <Button type="submit" size="md" leftSection={<IconKey size={16} />} loading={createAdminSessionMutation.isPending}>
                    Unlock backoffice
                  </Button>
                </Stack>
              </form>

              {adminSessionQuery.isError ? (
                <Alert color="red" title="Session check failed">
                  {getErrorMessage(adminSessionQuery.error, "Unable to check admin access.")}
                </Alert>
              ) : null}
            </Stack>
          </Paper>
        </Container>
      </div>
    );
  }

  if (!activeSection) {
    return <Navigate to="/admin/users?page=1&pageSize=20" replace />;
  }

  const currentSection = adminSections.find((section) => section.key === activeSection) ?? adminSections[0];
  const currentQuery =
    activeSection === "users"
      ? usersQuery
      : activeSection === "projects"
        ? projectsQuery
        : activeSection === "members"
          ? membersQuery
          : activeSection === "tasks"
            ? tasksQuery
            : accessQuery;

  if (overviewQuery.isLoading || currentQuery.isLoading) {
    return (
      <Center mih="100vh">
        <Loader color="teal" size="lg" />
      </Center>
    );
  }

  if (overviewQuery.isError || currentQuery.isError || !overviewQuery.data || !currentQuery.data) {
    return (
      <div className="admin-page">
        <Container size="xl" py="xl">
          <Alert color="red" title="Backoffice data unavailable">
            {getErrorMessage(currentQuery.error ?? overviewQuery.error, "The admin session is active, but the dashboard data could not be loaded.")}
          </Alert>
        </Container>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const currentData = currentQuery.data;

  let table: ReactNode;
  if (activeSection === "users") {
    table = renderUsersTable(currentData.items as AdminUserDTO[]);
  } else if (activeSection === "projects") {
    table = renderProjectsTable(currentData.items as AdminProjectDTO[]);
  } else if (activeSection === "members") {
    table = renderMembersTable(currentData.items as AdminMemberDTO[]);
  } else if (activeSection === "tasks") {
    table = renderTasksTable(currentData.items as AdminTaskDTO[]);
  } else {
    table = renderAccessTable(currentData.items as AdminAccessDTO[]);
  }

  return (
    <div className="admin-page">
      <Container size="xl" py={{ base: "lg", sm: "xl" }}>
        <Stack gap="lg">
          <Paper className="admin-shell-card" radius="xl" p={{ base: "lg", sm: "xl" }} withBorder>
            <Group justify="space-between" align="start">
              <Stack gap={6}>
                <Text className="eyebrow">Admin backoffice</Text>
                <Title order={1}>Read-only operations view</Title>
                <Text c="dimmed">
                  Cross-account visibility into the live database state for monitoring people, projects, work, and sharing activity.
                </Text>
              </Stack>
              <Group gap="sm" align="center">
                <ThemeToggle />
                <Button variant="light" color="dark" onClick={handleSignOut} loading={deleteAdminSessionMutation.isPending}>
                  Sign out
                </Button>
              </Group>
            </Group>
          </Paper>

          <div className="admin-stats-grid">
            {[
              { label: "Users", value: overview.totals.userCount },
              { label: "Verified", value: overview.totals.verifiedUserCount },
              { label: "Projects", value: overview.totals.projectCount },
              { label: "Tasks", value: overview.totals.taskCount },
              { label: "Invitations", value: overview.totals.invitationCount },
              { label: "Active access", value: overview.totals.activeAccessCount },
            ].map((stat) => (
              <Paper key={stat.label} className="admin-shell-card admin-stat-card admin-stat-card-minimal" radius="lg" p="md" withBorder>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    {stat.label}
                  </Text>
                  <Text fw={800} fz={26}>
                    {stat.value}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </div>

          <div className="admin-layout">
            <Paper className="admin-shell-card admin-sidebar" radius="xl" p="md" withBorder>
              <Stack gap="xs">
                {adminSections.map((section) => (
                  <NavLink
                    key={section.key}
                    to={`/admin/${section.key}?page=1&pageSize=${pagination.pageSize}`}
                    className={({ isActive }) => `admin-sidebar-link${isActive ? " admin-sidebar-link-active" : ""}`}
                  >
                    <section.icon size={18} />
                    <span>{section.label}</span>
                  </NavLink>
                ))}
              </Stack>
            </Paper>

            <Stack gap="lg" className="admin-main-panel">
              <AdminTableShell
                title={currentSection.label}
                description={currentSection.description}
                pagination={currentData}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              >
                {table}
              </AdminTableShell>
            </Stack>
          </div>
        </Stack>
      </Container>
    </div>
  );
}
