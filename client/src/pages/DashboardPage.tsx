/* Mirror the social-preview dashboard in the real app while keeping each data
panel paginated so long account histories do not stretch or hide neighboring tiles. */
import {
  Badge,
  Card,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from "@mantine/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import dayjs from "dayjs";
import {
  IconChartBar,
  IconChecklist,
  IconClock,
  IconFolder,
  IconUsers,
} from "@tabler/icons-react";
import { taskStatusLabels, taskStatusValues, type ProjectSummaryDTO, type TaskDTO } from "@team-management/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import { CompactPagination } from "../components/CompactPagination";
import { useCalendarEvents, useDashboard, useMembers, useProjects, useTasks } from "../hooks/use-app-data";
import { usePagination } from "../hooks/use-pagination";
import { formatDate, formatDateTime } from "../lib/dates";

function completionRangeForPreset(preset: "today" | "three-days" | "week") {
  const now = dayjs();
  const start = preset === "today" ? now.startOf("day") : now.subtract(preset === "three-days" ? 3 : 7, "day");

  return {
    completedFrom: start.toDate().toISOString(),
    completedTo: now.toDate().toISOString(),
  };
}

function TaskColumn({ status, tasks }: { status: TaskDTO["status"]; tasks: TaskDTO[] }) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(tasks, 4);

  return (
    <Paper className="dashboard-kanban-column" radius="md" p="sm">
      <Stack h="100%" gap="sm">
        <Group justify="space-between">
          <Text fw={800} size="sm">
            {taskStatusLabels[status]}
          </Text>
          <Badge size="sm" variant="light">
            {tasks.length}
          </Badge>
        </Group>
        <Stack gap="xs" className="dashboard-task-list">
          {paginatedItems.length === 0 ? (
            <Text size="sm" c="dimmed">
              No tasks
            </Text>
          ) : (
            paginatedItems.map((task) => (
              <Paper key={task.id} className="dashboard-task-card" radius="md" p="sm">
                <Stack gap={5}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} size="sm" lineClamp={1}>
                      {task.title}
                    </Text>
                    {task.isDefect ? <DefectBadge /> : null}
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {task.assigneeNames?.length ? task.assigneeNames.join(", ") : task.assigneeName}
                  </Text>
                  <Text size="xs" c={task.status === "blocked" ? "red" : "dimmed"}>
                    {task.deadline ? formatDate(task.deadline) : "No deadline"}
                  </Text>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
        <Group className="fixed-pagination-slot" justify="center">
          {totalPages > 1 ? <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} /> : null}
        </Group>
      </Stack>
    </Paper>
  );
}

type TaskDateFormatter = (task: TaskDTO) => string | null;

type PaginatedTaskStackProps = {
  tasks: TaskDTO[];
  empty: string;
  datePrefix?: string;
  getTaskDate?: TaskDateFormatter;
};

/*
Allow dashboard summary panels to reuse the same compact row layout while each
panel chooses the business date it represents, such as deadlines or completion time.
*/
export function PaginatedTaskStack({
  tasks,
  empty,
  datePrefix,
  getTaskDate = (task) => task.deadline,
}: PaginatedTaskStackProps) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(tasks, 4);

  return (
    <Stack gap="sm" className="fixed-pagination-panel">
      <Stack gap="sm" className="fixed-pagination-content">
        {paginatedItems.length === 0 ? (
          <Text c="dimmed">{empty}</Text>
        ) : (
          paginatedItems.map((task) => (
            <Paper key={task.id} className="compact-list-row" radius="md" p="sm">
              <Group justify="space-between" align="start" wrap="nowrap">
                <Stack gap={3}>
                  <Text fw={800} size="sm" lineClamp={1}>
                    {task.title}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {task.assigneeNames?.length ? task.assigneeNames.join(", ") : task.assigneeName} - {task.projectName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {datePrefix ? `${datePrefix} ` : null}
                    {formatDateTime(getTaskDate(task))}
                  </Text>
                </Stack>
                <TaskStatusBadge status={task.status} />
              </Group>
            </Paper>
          ))
        )}
      </Stack>
      <Group className="fixed-pagination-slot" justify="center">
        {totalPages > 1 ? <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>
    </Stack>
  );
}

function RecentProjectsTable({ projects }: { projects: ProjectSummaryDTO[] }) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(projects, 4);

  return (
    <Stack gap="sm" className="fixed-pagination-panel">
      <div className="fixed-pagination-content">
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Project</Table.Th>
            <Table.Th>Progress</Table.Th>
            <Table.Th>Work</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedItems.map((project) => {
            const progress = project.taskCount === 0 ? 0 : project.status === "completed" ? 100 : project.status === "on_hold" ? 42 : 68;

            return (
              <Table.Tr key={project.id}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <span className="project-swatch" style={{ background: project.color ?? "#16A98B" }} />
                    <Text fw={700} size="sm" lineClamp={1}>
                      {project.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Progress value={progress} radius="xl" color="teal" />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {project.taskCount} tasks
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      </div>
      <Group className="fixed-pagination-slot" justify="center">
        {totalPages > 1 ? <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>
    </Stack>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [completionFilters] = useState(() => completionRangeForPreset("week"));
  const dashboardQuery = useDashboard(completionFilters);
  const calendarQuery = useCalendarEvents();
  const tasksQuery = useTasks({});
  const projectsQuery = useProjects();
  const membersQuery = useMembers();

  if (
    dashboardQuery.isLoading ||
    calendarQuery.isLoading ||
    tasksQuery.isLoading ||
    projectsQuery.isLoading ||
    membersQuery.isLoading
  ) {
    return <Loader />;
  }

  const dashboard = dashboardQuery.data;
  const events = calendarQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const projects = [...(projectsQuery.data?.ownedProjects ?? []), ...(projectsQuery.data?.sharedProjects ?? [])];

  if (!dashboard) {
    return null;
  }

  const completedCount = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <Stack gap={4}>
          <Text className="eyebrow">Operations workspace</Text>
          <Text fw={900} fz={30}>
            Dashboard
          </Text>
        </Stack>
        <Badge color="teal" variant="filled">
          Live overview
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
        {[
          { label: "Active Projects", value: dashboard.stats.projectCount, icon: IconChartBar, color: "teal" },
          { label: "Tasks in Progress", value: tasks.filter((task) => task.status === "in_progress").length, icon: IconChecklist, color: "red" },
          { label: "Upcoming Deadlines", value: dashboard.upcomingTasks.length, icon: IconClock, color: "orange" },
          { label: "Team Members", value: dashboard.stats.memberCount, icon: IconUsers, color: "blue" },
        ].map((stat) => (
          <Card key={stat.label} className="dashboard-stat-card" radius="md" padding="lg" withBorder>
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={58} radius="md" color={stat.color} variant="filled">
                <stat.icon size={28} />
              </ThemeIcon>
              <Stack gap={1}>
                <Text c="dimmed" size="sm">
                  {stat.label}
                </Text>
                <Text fw={900} fz={30}>
                  {stat.value}
                </Text>
              </Stack>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Paper className="dashboard-panel dashboard-overview-panel" radius="md" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Stack gap={2}>
                <Text fw={900} fz="lg">
                  Tasks Overview
                </Text>
                <Text size="sm" c="dimmed">
                  Paginated by status so every column stays stable.
                </Text>
              </Stack>
              <ThemeIcon color="teal" variant="light">
                <IconFolder size={18} />
              </ThemeIcon>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2, xl: 5 }} spacing="sm">
              {taskStatusValues.map((status) => (
                <TaskColumn key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />
              ))}
            </SimpleGrid>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Paper className="dashboard-panel dashboard-overview-panel" radius="md" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={900} fz="lg">
                Calendar
              </Text>
              <Text size="sm" c="dimmed">
                {dayjs().format("MMM YYYY")}
              </Text>
            </Group>
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              height={360}
              dayMaxEventRows={2}
              events={events.map((event) => ({
                id: event.id,
                title: event.title,
                start: event.start ?? event.date,
                end: event.end ?? event.date,
                color: event.overdue ? "#C92A2A" : "#16A98B",
              }))}
              eventClick={(info) => {
                navigate(`/tasks/${info.event.id}`);
              }}
            />
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Paper className="dashboard-panel dashboard-summary-panel" radius="md" p="lg" withBorder>
            <Text fw={900} fz="lg" mb="md">
              Project Progress
            </Text>
            <Group align="center">
              <RingProgress
                size={128}
                thickness={12}
                sections={[{ value: progress, color: "teal" }]}
                label={
                  <Text ta="center" fw={900}>
                    {progress}%
                  </Text>
                }
              />
              <Stack gap="xs" flex={1}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Completed
                  </Text>
                  <Text size="sm" fw={800}>
                    {completedCount}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Open
                  </Text>
                  <Text size="sm" fw={800}>
                    {tasks.length - completedCount}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Overdue
                  </Text>
                  <Text size="sm" fw={800}>
                    {dashboard.stats.overdueCount}
                  </Text>
                </Group>
              </Stack>
            </Group>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Paper className="dashboard-panel dashboard-summary-panel" radius="md" p="lg" withBorder>
            <Text fw={900} fz="lg" mb="md">
              Upcoming Deadlines
            </Text>
            <PaginatedTaskStack tasks={dashboard.upcomingTasks} empty="No upcoming deadlines." />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Paper className="dashboard-panel dashboard-summary-panel" radius="md" p="lg" withBorder>
            <Text fw={900} fz="lg" mb="md">
              Overdue Attention
            </Text>
            <PaginatedTaskStack tasks={dashboard.overdueTasks} empty="No overdue tasks right now." />
          </Paper>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper className="dashboard-panel dashboard-bottom-panel" radius="md" p="lg" withBorder>
            <Text fw={900} fz="lg" mb="md">
              Recent Projects
            </Text>
            <RecentProjectsTable projects={projects} />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper className="dashboard-panel dashboard-bottom-panel" radius="md" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={900} fz="lg">
                Recently Completed
              </Text>
              <Badge variant="light">{dashboard.recentCompletions.count}</Badge>
            </Group>
            <PaginatedTaskStack
              tasks={dashboard.recentCompletions.tasks}
              empty="No completed tasks in this range."
              datePrefix="Done"
              getTaskDate={(task) => task.completedAt}
            />
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
