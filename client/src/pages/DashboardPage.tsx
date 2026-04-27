/* Keep the dashboard focused on workload signals the leader needs first: totals, overdue work, and near-term deadlines. */
import { Button, Card, Grid, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import { useCalendarEvents, useDashboard } from "../hooks/use-app-data";
import { formatDateTime } from "../lib/dates";

function completionRangeForPreset(preset: "today" | "three-days" | "week") {
  const now = dayjs();
  const start = preset === "today" ? now.startOf("day") : now.subtract(preset === "three-days" ? 3 : 7, "day");

  return {
    completedFrom: start.toDate().toISOString(),
    completedTo: now.toDate().toISOString(),
  };
}

function completionRangeForDay(value: string) {
  const selected = dayjs(value);

  return {
    completedFrom: selected.startOf("day").toDate().toISOString(),
    completedTo: selected.endOf("day").toDate().toISOString(),
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [completionFilters, setCompletionFilters] = useState(() => completionRangeForPreset("week"));
  const [selectedCompletionDay, setSelectedCompletionDay] = useState("");
  const dashboardQuery = useDashboard(completionFilters);
  const calendarQuery = useCalendarEvents();

  if (dashboardQuery.isLoading || calendarQuery.isLoading) {
    return <Loader />;
  }

  const dashboard = dashboardQuery.data;
  const events = calendarQuery.data;

  if (!dashboard || !events) {
    return null;
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Dashboard"
        description="A fast manager overview of team capacity, deadlines, and status distribution."
      />

      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <Card className="stat-card" padding="lg" radius="xl">
          <Text c="dimmed">Projects</Text>
          <Text fz={34} fw={800}>{dashboard.stats.projectCount}</Text>
        </Card>
        <Card className="stat-card" padding="lg" radius="xl">
          <Text c="dimmed">Active members</Text>
          <Text fz={34} fw={800}>{dashboard.stats.memberCount}</Text>
        </Card>
        <Card className="stat-card" padding="lg" radius="xl">
          <Text c="dimmed">Tasks</Text>
          <Text fz={34} fw={800}>{dashboard.stats.taskCount}</Text>
        </Card>
        <Card className="stat-card stat-card-alert" padding="lg" radius="xl">
          <Text c="dimmed">Overdue</Text>
          <Text fz={34} fw={800}>{dashboard.stats.overdueCount}</Text>
        </Card>
      </SimpleGrid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper radius="xl" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={700} fz="lg">Upcoming deadlines</Text>
              <Text size="sm" c="dimmed">Next 7 days</Text>
            </Group>
            <Table verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Task</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Due</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.upcomingTasks.map((task) => (
                  <Table.Tr key={task.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600}>{task.title}</Text>
                        <Text size="sm" c="dimmed">{task.assigneeName} · {task.projectName}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td><TaskStatusBadge status={task.status} /></Table.Td>
                    <Table.Td>{formatDateTime(task.deadline)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper radius="xl" p="lg" withBorder>
            <Text fw={700} fz="lg" mb="md">Status distribution</Text>
            <Stack gap="md">
              {dashboard.tasksByStatus.map((entry) => (
                <Group key={entry.status} justify="space-between">
                  <TaskStatusBadge status={entry.status} />
                  <Text fw={700}>{entry.count}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper radius="xl" p="lg" withBorder>
        <Group justify="space-between" align="end" mb="md">
          <Stack gap={4}>
            <Text fw={700} fz="lg">Recently completed</Text>
            <Text size="sm" c="dimmed">
              {formatDateTime(dashboard.recentCompletions.from)} to {formatDateTime(dashboard.recentCompletions.to)}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={() => setCompletionFilters(completionRangeForPreset("today"))}>
              Today
            </Button>
            <Button size="xs" variant="light" onClick={() => setCompletionFilters(completionRangeForPreset("three-days"))}>
              Past 3 days
            </Button>
            <Button size="xs" variant="light" onClick={() => setCompletionFilters(completionRangeForPreset("week"))}>
              Past week
            </Button>
            <TextInput
              type="date"
              size="xs"
              value={selectedCompletionDay}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setSelectedCompletionDay(value);
                if (value) {
                  setCompletionFilters(completionRangeForDay(value));
                }
              }}
            />
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card className="stat-card" padding="lg" radius="xl">
            <Text c="dimmed">Completed in range</Text>
            <Text fz={34} fw={800}>{dashboard.recentCompletions.count}</Text>
          </Card>
          <Stack gap="sm">
            {dashboard.recentCompletions.tasks.length === 0 ? (
              <Text c="dimmed">No completed tasks in this range.</Text>
            ) : (
              dashboard.recentCompletions.tasks.map((task) => (
                <Card key={task.id} radius="lg" withBorder>
                  <Group justify="space-between" align="start">
                    <Stack gap={4}>
                      <Text fw={700}>{task.title}</Text>
                      <Text size="sm" c="dimmed">{task.assigneeName} · {task.projectName}</Text>
                      <Text size="sm">Done {formatDateTime(task.completedAt)}</Text>
                    </Stack>
                    <Group gap="xs">
                      {task.isDefect ? <DefectBadge /> : null}
                      <TaskStatusBadge status={task.status} />
                    </Group>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </SimpleGrid>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper radius="xl" p="lg" withBorder>
            <Text fw={700} fz="lg" mb="md">Calendar preview</Text>
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              height={480}
              events={events.map((event) => ({
                id: event.id,
                title: event.title,
                start: event.start ?? event.date,
                end: event.end ?? event.date,
                color: event.overdue ? "#C92A2A" : "#16A98B",
              }))}
              eventClick={(info) => {
                navigate(`/tasks?taskId=${info.event.id}`);
              }}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper radius="xl" p="lg" withBorder>
            <Text fw={700} fz="lg" mb="md">Overdue attention list</Text>
            <Stack gap="md">
              {dashboard.overdueTasks.length === 0 ? (
                <Text c="dimmed">No overdue tasks right now.</Text>
              ) : (
                dashboard.overdueTasks.map((task) => (
                  <Card key={task.id} radius="lg" className="overdue-card">
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Text fw={700}>{task.title}</Text>
                        <TaskStatusBadge status={task.status} />
                      </Group>
                      <Text size="sm" c="dimmed">{task.assigneeName} · {task.projectName}</Text>
                      <Text size="sm">{formatDateTime(task.deadline)}</Text>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
