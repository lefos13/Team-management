/* Keep task management filterable and editable from one screen because the leader is the only status owner. */
import {
  ActionIcon,
  Alert,
  Button,
  FileInput,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  taskStatusValues,
  type TaskDTO,
  type TaskExportFilters,
  type TaskFilters,
  type TaskImportResultDTO,
} from "@team-management/shared";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { CompactPagination } from "../components/CompactPagination";
import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/forms/TaskFormModal";
import {
  downloadTaskImportTemplate,
  exportTasks,
  useCreateTask,
  useDeleteTask,
  useImportTasks,
  useMembers,
  useProjects,
  useTasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";
import { usePagination } from "../hooks/use-pagination";

type TaskTableColumnsProps = {
  task: TaskDTO;
  deletePending: boolean;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (task: TaskDTO, status: TaskDTO["status"]) => void;
};

function TaskTableColumns({ task, deletePending, onEdit, onDelete, onStatusChange }: TaskTableColumnsProps) {
  return (
    <>
      <Table.Td>
        <Stack gap={2}>
          <Text fw={700}>{task.title}</Text>
          <Text size="sm" c="dimmed">{task.description || "No description"}</Text>
          {task.parentTaskTitle ? (
            <Text size="xs" c="dimmed">Subtask of {task.parentTaskTitle}</Text>
          ) : null}
        </Stack>
      </Table.Td>
      <Table.Td>{task.projectName}</Table.Td>
      <Table.Td>{task.assigneeNames?.length ? task.assigneeNames.join(", ") : task.assigneeName}</Table.Td>
      <Table.Td>
        <Group gap="sm">
          <TaskStatusBadge status={task.status} />
          <Select
            size="xs"
            w={150}
            value={task.status}
            data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
            onChange={(value) => {
              if (!value || value === task.status) {
                return;
              }

              onStatusChange(task, value as TaskDTO["status"]);
            }}
          />
        </Group>
      </Table.Td>
      <Table.Td>
        <Stack gap={6}>
          {task.isDefect ? <DefectBadge /> : <Text size="sm" c="dimmed">Standard</Text>}
          {task.completedAt ? (
            <Text size="xs" c="dimmed">Done {formatDateTime(task.completedAt)}</Text>
          ) : null}
        </Stack>
      </Table.Td>
      <Table.Td>{formatDateTime(task.deadline)}</Table.Td>
      <Table.Td>
        <Group justify="end" gap="xs">
          <ActionIcon variant="light" onClick={() => onEdit(task.id)}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon color="red" variant="light" loading={deletePending} onClick={() => onDelete(task.id)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </>
  );
}

type SubtaskPanelProps = Omit<TaskTableColumnsProps, "task"> & {
  subtasks: TaskDTO[];
};

/*
Keep subtask paging local to each expanded parent so opening one hierarchy does
not change the page position inside another parent task.
*/
function SubtaskPanel({ subtasks, deletePending, onEdit, onDelete, onStatusChange }: SubtaskPanelProps) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(subtasks, 5);

  return (
    <Stack gap="sm" className="subtask-panel">
      <Table verticalSpacing="sm">
        <Table.Tbody>
          {paginatedItems.map((subtask) => (
            <Table.Tr key={subtask.id} className="subtask-row">
              <Table.Td />
              <TaskTableColumns
                task={subtask}
                deletePending={deletePending}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="center">
        {totalPages > 1 ? <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>
    </Stack>
  );
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TaskFilters>({});
  const [exportFilters, setExportFilters] = useState<TaskExportFilters>({});
  const [exportOpened, setExportOpened] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [importOpened, setImportOpened] = useState(false);
  const [importProjectId, setImportProjectId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [templatePending, setTemplatePending] = useState<"blank" | "sample" | null>(null);
  const [importResult, setImportResult] = useState<TaskImportResultDTO | null>(null);
  const [opened, setOpened] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const tasksQuery = useTasks(filters);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const importTasks = useImportTasks();

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

  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const subtasksByParent = useMemo(() => {
    const grouped = new Map<string, TaskDTO[]>();

    for (const task of tasks) {
      if (!task.parentTaskId) {
        continue;
      }

      grouped.set(task.parentTaskId, [...(grouped.get(task.parentTaskId) ?? []), task]);
    }

    return grouped;
  }, [tasks]);
  const topLevelTasks = useMemo(
    () => tasks.filter((task) => !task.parentTaskId || !tasksById.has(task.parentTaskId)),
    [tasks, tasksById],
  );
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const { page, setPage, totalPages, paginatedItems: paginatedTasks } = usePagination(topLevelTasks, 10);

  if (projectsQuery.isLoading || membersQuery.isLoading || tasksQuery.isLoading) {
    return <Loader />;
  }

  async function handleExport() {
    setExportPending(true);
    try {
      const blob = await exportTasks(exportFilters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExportOpened(false);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to export tasks",
        message: getErrorMessage(error),
      });
    } finally {
      setExportPending(false);
    }
  }

  async function handleTemplateDownload(variant: "blank" | "sample") {
    if (!importProjectId) {
      notifications.show({
        color: "red",
        title: "Project required",
        message: "Choose a project before downloading an import template.",
      });
      return;
    }

    setTemplatePending(variant);
    try {
      const blob = await downloadTaskImportTemplate(importProjectId, variant);
      const project = projects.find((item) => item.id === importProjectId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `task-import-${variant}-${project?.name ?? "project"}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to download template",
        message: getErrorMessage(error),
      });
    } finally {
      setTemplatePending(null);
    }
  }

  async function handleImport() {
    if (!importProjectId || !importFile) {
      notifications.show({
        color: "red",
        title: "Import is not ready",
        message: "Choose a project and upload one .xlsx file before importing.",
      });
      return;
    }

    try {
      const result = await importTasks.mutateAsync({ projectId: importProjectId, file: importFile });
      setImportResult(result);
      setImportFile(null);
      notifications.show({
        color: "teal",
        title: "Import complete",
        message: `${result.inserted} tasks imported. ${result.skipped} duplicates skipped.`,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to import tasks",
        message: getErrorMessage(error),
      });
    }
  }

  function handleEditTask(taskId: string) {
    setEditingTaskId(taskId);
    setOpened(true);
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask.mutateAsync(taskId);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to delete task",
        message: getErrorMessage(error),
      });
    }
  }

  async function handleStatusChange(task: TaskDTO, status: TaskDTO["status"]) {
    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to update status",
        message: getErrorMessage(error),
      });
    }
  }

  function toggleExpandedTask(taskId: string) {
    setExpandedTaskIds((current) => {
      const next = new Set(current);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Tasks"
        description="Assign work, filter the workload, and adjust statuses without leaving the manager workspace."
        action={
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              onClick={() => {
                setImportProjectId(filters.projectId ?? projects[0]?.id ?? null);
                setImportFile(null);
                setImportResult(null);
                setImportOpened(true);
              }}
            >
              Import
            </Button>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                setExportFilters({
                  projectId: filters.projectId,
                  assigneeId: filters.assigneeId,
                  status: filters.status,
                  isDefect: filters.isDefect,
                });
                setExportOpened(true);
              }}
            >
              Export
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingTaskId(null);
                setOpened(true);
              }}
            >
              New task
            </Button>
          </Group>
        }
      />

      <Paper radius="xl" p="lg" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Project"
              clearable
              value={filters.projectId ?? null}
              data={projects.map((project) => ({ value: project.id, label: project.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, projectId: value ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Assignee"
              clearable
              value={filters.assigneeId ?? null}
              data={members.map((member) => ({ value: member.id, label: member.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, assigneeId: value ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Status"
              clearable
              value={filters.status ?? null}
              data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
              onChange={(value) => setFilters((current) => ({ ...current, status: (value as TaskFilters["status"]) ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              label="Defect"
              clearable
              value={filters.isDefect === undefined ? null : String(filters.isDefect)}
              data={[
                { value: "true", label: "Defects only" },
                { value: "false", label: "Non-defects only" },
              ]}
              onChange={(value) => setFilters((current) => ({ ...current, isDefect: value === null ? undefined : value === "true" }))}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      <Paper radius="xl" p="lg" withBorder className="paginated-table-panel">
        <Table verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={46} />
              <Table.Th>Task</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Info</Table.Th>
              <Table.Th>Deadline</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedTasks.map((task) => {
              const subtasks = subtasksByParent.get(task.id) ?? [];
              const expanded = expandedTaskIds.has(task.id);

              return (
                <Fragment key={task.id}>
                  <Table.Tr>
                    <Table.Td>
                      {subtasks.length > 0 ? (
                        <ActionIcon
                          variant="subtle"
                          aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
                          onClick={() => toggleExpandedTask(task.id)}
                        >
                          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </ActionIcon>
                      ) : null}
                    </Table.Td>
                    <TaskTableColumns
                      task={task}
                      deletePending={deleteTask.isPending}
                      onEdit={handleEditTask}
                      onDelete={(taskId) => void handleDeleteTask(taskId)}
                      onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
                    />
                  </Table.Tr>
                  {subtasks.length > 0 && expanded ? (
                    <Table.Tr className="subtask-panel-row">
                      <Table.Td colSpan={8}>
                        <SubtaskPanel
                          subtasks={subtasks}
                          deletePending={deleteTask.isPending}
                          onEdit={handleEditTask}
                          onDelete={(taskId) => void handleDeleteTask(taskId)}
                          onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
      <Group className="page-pagination-slot" justify="center">
        {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>

      <TaskFormModal
        projects={projects}
        members={members}
        tasks={tasks}
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

      <Modal opened={exportOpened} onClose={() => setExportOpened(false)} title="Export tasks" centered size="lg" radius="lg">
        <Stack>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Project"
                clearable
                value={exportFilters.projectId ?? null}
                data={projects.map((project) => ({ value: project.id, label: project.name }))}
                onChange={(value) => setExportFilters((current) => ({ ...current, projectId: value ?? undefined }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Member"
                clearable
                value={exportFilters.assigneeId ?? null}
                data={members.map((member) => ({ value: member.id, label: member.name }))}
                onChange={(value) => setExportFilters((current) => ({ ...current, assigneeId: value ?? undefined }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Status"
                clearable
                value={exportFilters.status ?? null}
                data={taskStatusValues.map((status) => ({ value: status, label: status.replace("_", " ") }))}
                onChange={(value) => setExportFilters((current) => ({ ...current, status: (value as TaskExportFilters["status"]) ?? undefined }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Defect"
                clearable
                value={exportFilters.isDefect === undefined ? null : String(exportFilters.isDefect)}
                data={[
                  { value: "true", label: "Defects only" },
                  { value: "false", label: "Non-defects only" },
                ]}
                onChange={(value) => setExportFilters((current) => ({ ...current, isDefect: value === null ? undefined : value === "true" }))}
              />
            </Grid.Col>
          </Grid>
          <Group justify="end">
            <Button variant="subtle" onClick={() => setExportOpened(false)}>Cancel</Button>
            <Button leftSection={<IconDownload size={16} />} loading={exportPending} onClick={handleExport}>
              Export Excel
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title="Import tasks" centered size="lg" radius="lg">
        <Stack>
          <Select
            label="Project"
            description="Tasks are imported into this project only."
            value={importProjectId}
            data={projects.map((project) => ({ value: project.id, label: project.name }))}
            onChange={(value) => {
              setImportProjectId(value);
              setImportResult(null);
            }}
          />
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={templatePending === "blank"}
              onClick={() => void handleTemplateDownload("blank")}
            >
              Blank template
            </Button>
            <Button
              variant="light"
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={templatePending === "sample"}
              onClick={() => void handleTemplateDownload("sample")}
            >
              Sample template
            </Button>
          </Group>
          <FileInput
            label="Excel file"
            placeholder="Upload .xlsx task import"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            value={importFile}
            onChange={(file) => {
              setImportFile(file);
              setImportResult(null);
            }}
          />
          {importResult ? (
            <Alert color="teal" variant="light" title="Import summary">
              <Stack gap={4}>
                <Text size="sm">{importResult.inserted} tasks imported.</Text>
                <Text size="sm">{importResult.skipped} duplicate rows skipped.</Text>
                {importResult.skippedRows.slice(0, 4).map((row) => (
                  <Text key={row.row} size="xs" c="dimmed">
                    Row {row.row}: {row.reason}
                  </Text>
                ))}
              </Stack>
            </Alert>
          ) : null}
          <Group justify="end">
            <Button variant="subtle" onClick={() => setImportOpened(false)}>Close</Button>
            <Button leftSection={<IconUpload size={16} />} loading={importTasks.isPending} onClick={handleImport}>
              Import Excel
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
