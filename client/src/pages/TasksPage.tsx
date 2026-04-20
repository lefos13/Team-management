/* Keep task management filterable and editable from one screen because the leader is the only status owner. */
import { ActionIcon, Button, Grid, Group, Loader, Paper, Select, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { taskStatusValues, type TaskDTO, type TaskFilters } from "@team-management/shared";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { TaskStatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/forms/TaskFormModal";
import {
  useCreateTask,
  useDeleteTask,
  useMembers,
  useProjects,
  useTasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TaskFilters>({});
  const [opened, setOpened] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const tasksQuery = useTasks(filters);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const selectedTask = useMemo(
    () => tasksQuery.data?.find((task) => task.id === editingTaskId) ?? null,
    [editingTaskId, tasksQuery.data],
  );

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (!taskId || !tasksQuery.data) {
      return;
    }

    const matchingTask = tasksQuery.data.find((task) => task.id === taskId);
    if (matchingTask) {
      setEditingTaskId(taskId);
      setOpened(true);
      searchParams.delete("taskId");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, tasksQuery.data]);

  if (projectsQuery.isLoading || membersQuery.isLoading || tasksQuery.isLoading) {
    return <Loader />;
  }

  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  return (
    <Stack gap="xl">
      <PageHeader
        title="Tasks"
        description="Assign work, filter the workload, and adjust statuses without leaving the manager workspace."
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditingTaskId(null);
              setOpened(true);
            }}
          >
            New task
          </Button>
        }
      />

      <Paper radius="xl" p="lg" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              label="Project"
              clearable
              value={filters.projectId ?? null}
              data={projects.map((project) => ({ value: project.id, label: project.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, projectId: value ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              label="Assignee"
              clearable
              value={filters.assigneeId ?? null}
              data={members.map((member) => ({ value: member.id, label: member.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, assigneeId: value ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              label="Status"
              clearable
              value={filters.status ?? null}
              data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
              onChange={(value) => setFilters((current) => ({ ...current, status: (value as TaskFilters["status"]) ?? undefined }))}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      <Paper radius="xl" p="lg" withBorder>
        <Table verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Task</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Deadline</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tasks.map((task) => (
              <Table.Tr key={task.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text fw={700}>{task.title}</Text>
                    <Text size="sm" c="dimmed">{task.description || "No description"}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>{task.projectName}</Table.Td>
                <Table.Td>{task.assigneeName}</Table.Td>
                <Table.Td>
                  <Group gap="sm">
                    <TaskStatusBadge status={task.status} />
                    <Select
                      size="xs"
                      w={150}
                      value={task.status}
                      data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
                      onChange={async (value) => {
                        if (!value || value === task.status) {
                          return;
                        }

                        try {
                          await updateTaskStatus.mutateAsync({ id: task.id, status: value as TaskDTO["status"] });
                        } catch (error) {
                          notifications.show({
                            color: "red",
                            title: "Unable to update status",
                            message: getErrorMessage(error),
                          });
                        }
                      }}
                    />
                  </Group>
                </Table.Td>
                <Table.Td>{formatDateTime(task.deadline)}</Table.Td>
                <Table.Td>
                  <Group justify="end" gap="xs">
                    <ActionIcon
                      variant="light"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setOpened(true);
                      }}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      loading={deleteTask.isPending}
                      onClick={async () => {
                        try {
                          await deleteTask.mutateAsync(task.id);
                        } catch (error) {
                          notifications.show({
                            color: "red",
                            title: "Unable to delete task",
                            message: getErrorMessage(error),
                          });
                        }
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <TaskFormModal
        projects={projects}
        members={members}
        opened={opened}
        pending={createTask.isPending || updateTask.isPending}
        task={selectedTask}
        onClose={() => setOpened(false)}
        onSubmit={async (values) => {
          try {
            if (editingTaskId) {
              await updateTask.mutateAsync({ id: editingTaskId, payload: values });
            } else {
              await createTask.mutateAsync(values);
            }
            setOpened(false);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to save task",
              message: getErrorMessage(error),
            });
          }
        }}
      />
    </Stack>
  );
}
