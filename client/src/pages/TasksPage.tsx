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
  IconEye,
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  taskStatusLabels,
  taskStatusValues,
  type TaskDTO,
  type TaskExportFilters,
  type TaskFilters,
  type TaskImportResultDTO,
} from "@team-management/shared";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { CompactPagination } from "../components/CompactPagination";
import { DefectBadge, TaskStatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/forms/TaskFormModal";
import {
  downloadTaskAttachment,
  downloadTaskAttachmentArchive,
  downloadTaskImportTemplate,
  exportTasks,
  previewTaskAttachment,
  useCreateTask,
  useDeleteTaskAttachment,
  useDeleteTask,
  useImportTasks,
  useMembers,
  useProjects,
  useTasks,
  useUploadTaskAttachments,
  useUpdateTask,
  useUpdateTaskStatus,
} from "../hooks/use-app-data";
import { getErrorMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";
import { usePagination } from "../hooks/use-pagination";

function isActiveTaskStatus(status: TaskDTO["status"]) {
  return status !== "done";
}

export function buildVisibleTaskHierarchy(tasks: TaskDTO[], statusFilter?: TaskFilters["status"]) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, TaskDTO[]>();
  const isDoneFilter = statusFilter === "done";

  for (const task of tasks) {
    if (!task.parentTaskId) {
      continue;
    }

    const parent = tasksById.get(task.parentTaskId);

    if (!parent) {
      continue;
    }

    if (isDoneFilter && parent.status === "done" && task.status === "done") {
      grouped.set(task.parentTaskId, [...(grouped.get(task.parentTaskId) ?? []), task]);
    }

    if (!isDoneFilter && isActiveTaskStatus(parent.status) && isActiveTaskStatus(task.status)) {
      grouped.set(task.parentTaskId, [...(grouped.get(task.parentTaskId) ?? []), task]);
    }
  }

  const visibleTasks = tasks.filter((task) => {
    const parent = task.parentTaskId ? tasksById.get(task.parentTaskId) : null;
    const isTopLevel = !task.parentTaskId || !parent;

    if (isDoneFilter) {
      return task.status === "done" && (isTopLevel || parent.status !== "done");
    }

    if (statusFilter) {
      return isTopLevel && task.status === statusFilter;
    }

    return isTopLevel && isActiveTaskStatus(task.status);
  });

  return { visibleTasks, subtasksByParent: grouped };
}

type TaskTableColumnsProps = {
  task: TaskDTO;
  deletePending: boolean;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onPreview: (taskId: string) => void;
  onStatusChange: (task: TaskDTO, status: TaskDTO["status"]) => void;
};

function TaskTableColumns({ task, deletePending, onEdit, onDelete, onPreview, onStatusChange }: TaskTableColumnsProps) {
  return (
    <>
      <Table.Td>
        <Stack gap={2}>
          <Text fw={700}>{task.title}</Text>
          <Text size="sm" c="dimmed">{task.description || "No description"}</Text>
          {task.parentTaskTitle ? (
            <Text size="xs" c="dimmed">Subtask of {task.parentTaskTitle}</Text>
          ) : null}
          {task.status === "done" ? (
            <Text size="xs" c="dimmed">
              {task.attachments.length} attachments archived
            </Text>
          ) : task.attachments.length > 0 ? (
            <Text size="xs" c="dimmed">
              {task.attachments.length} attachments
            </Text>
          ) : null}
        </Stack>
      </Table.Td>
      <Table.Td>{task.projectName}</Table.Td>
      <Table.Td>{task.assigneeNames?.length ? task.assigneeNames.join(", ") : task.assigneeName}</Table.Td>
      <Table.Td>
        <Group gap="sm">
          <TaskStatusBadge status={task.status} />
          {task.canEdit ? (
            <Select
              size="xs"
              w={150}
              value={task.status}
              data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
              onChange={(value) => {
                if (!value || value === task.status) {
                  return;
                }

                onStatusChange(task, value as TaskDTO["status"]);
              }}
            />
          ) : null}
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
      <Table.Td>{task.deadline ? formatDateTime(task.deadline) : "No deadline"}</Table.Td>
      <Table.Td>
        <Group justify="end" gap="xs">
          <ActionIcon variant="light" onClick={() => onPreview(task.id)}>
            <IconEye size={16} />
          </ActionIcon>
          {task.canEdit ? (
            <>
              <ActionIcon variant="light" onClick={() => onEdit(task.id)}>
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon color="red" variant="light" loading={deletePending} onClick={() => onDelete(task.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </>
          ) : null}
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
function SubtaskPanel({ subtasks, deletePending, onEdit, onDelete, onPreview, onStatusChange }: SubtaskPanelProps) {
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
                onPreview={onPreview}
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

type TaskMobileCardProps = TaskTableColumnsProps & {
  expanded: boolean;
  subtasks: TaskDTO[];
  onToggleExpanded: () => void;
};

/*
Mobile task cards preserve the table's management actions while collapsing
secondary columns into short metadata rows that can wrap without page overflow.
*/
function TaskMobileCard({
  task,
  deletePending,
  expanded,
  subtasks,
  onEdit,
  onDelete,
  onPreview,
  onStatusChange,
  onToggleExpanded,
}: TaskMobileCardProps) {
  return (
    <Paper radius="md" p="md" withBorder className="task-mobile-card">
      <Stack gap="sm">
        <Group justify="space-between" align="start" wrap="nowrap">
          <Stack gap={4} className="task-mobile-card-copy">
            <Group gap="xs" wrap="nowrap">
              {subtasks.length > 0 ? (
                <ActionIcon
                  variant="subtle"
                  aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
                  onClick={onToggleExpanded}
                >
                  {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
              ) : null}
              <Text fw={800} className="task-mobile-title">
                {task.title}
              </Text>
            </Group>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {task.description || "No description"}
            </Text>
            {task.parentTaskTitle ? (
              <Text size="xs" c="dimmed">
                Subtask of {task.parentTaskTitle}
              </Text>
            ) : null}
          </Stack>
          <Group gap="xs" wrap="nowrap" className="task-mobile-actions">
            <ActionIcon variant="light" onClick={() => onPreview(task.id)} aria-label={`Preview ${task.title}`}>
              <IconEye size={16} />
            </ActionIcon>
            {task.canEdit ? (
              <>
                <ActionIcon variant="light" onClick={() => onEdit(task.id)} aria-label={`Edit ${task.title}`}>
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  color="red"
                  variant="light"
                  loading={deletePending}
                  onClick={() => onDelete(task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </>
            ) : null}
          </Group>
        </Group>

        <Group gap="xs" wrap="wrap">
          <TaskStatusBadge status={task.status} />
          {task.isDefect ? <DefectBadge /> : null}
        </Group>

        {task.canEdit ? (
          <Select
            size="xs"
            className="task-mobile-status-select"
            value={task.status}
            data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
            onChange={(value) => {
              if (!value || value === task.status) {
                return;
              }

              onStatusChange(task, value as TaskDTO["status"]);
            }}
          />
        ) : null}

        <SimpleTaskMeta label="Project" value={task.projectName} />
        <SimpleTaskMeta label="Assignee" value={task.assigneeNames?.length ? task.assigneeNames.join(", ") : task.assigneeName} />
        <SimpleTaskMeta label="Deadline" value={task.deadline ? formatDateTime(task.deadline) : "No deadline"} />
        {task.completedAt ? <SimpleTaskMeta label="Done" value={formatDateTime(task.completedAt)} /> : null}
        {task.attachments.length > 0 ? (
          <SimpleTaskMeta
            label="Files"
            value={task.status === "done" ? `${task.attachments.length} archived` : `${task.attachments.length} attached`}
          />
        ) : null}

        {subtasks.length > 0 && expanded ? (
          <SubtaskMobilePanel
            subtasks={subtasks}
            deletePending={deletePending}
            onEdit={onEdit}
            onDelete={onDelete}
            onPreview={onPreview}
            onStatusChange={onStatusChange}
          />
        ) : null}
      </Stack>
    </Paper>
  );
}

function SimpleTaskMeta({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" className="task-mobile-meta-row">
      <Text size="xs" c="dimmed" fw={700}>
        {label}
      </Text>
      <Text size="sm" ta="right" className="task-mobile-meta-value">
        {value}
      </Text>
    </Group>
  );
}

function SubtaskMobilePanel({ subtasks, deletePending, onEdit, onDelete, onPreview, onStatusChange }: SubtaskPanelProps) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(subtasks, 5);

  return (
    <Stack gap="sm" className="task-mobile-subtasks">
      {paginatedItems.map((subtask) => (
        <div key={subtask.id} className="task-mobile-subtask-card">
          <Stack gap="xs">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text fw={700} size="sm" className="task-mobile-title">
                {subtask.title}
              </Text>
              <Group gap={6} wrap="nowrap">
                <ActionIcon size="sm" variant="light" onClick={() => onPreview(subtask.id)} aria-label={`Preview ${subtask.title}`}>
                  <IconEye size={14} />
                </ActionIcon>
                {subtask.canEdit ? (
                  <>
                    <ActionIcon size="sm" variant="light" onClick={() => onEdit(subtask.id)} aria-label={`Edit ${subtask.title}`}>
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      color="red"
                      variant="light"
                      loading={deletePending}
                      onClick={() => onDelete(subtask.id)}
                      aria-label={`Delete ${subtask.title}`}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </>
                ) : null}
              </Group>
            </Group>
            <Group gap="xs" wrap="wrap">
              <TaskStatusBadge status={subtask.status} />
              {subtask.isDefect ? <DefectBadge /> : null}
            </Group>
            {subtask.canEdit ? (
              <Select
                size="xs"
                className="task-mobile-status-select"
                value={subtask.status}
                data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
                onChange={(value) => {
                  if (!value || value === subtask.status) {
                    return;
                  }

                  onStatusChange(subtask, value as TaskDTO["status"]);
                }}
              />
            ) : null}
            <SimpleTaskMeta label="Assignee" value={subtask.assigneeNames?.length ? subtask.assigneeNames.join(", ") : subtask.assigneeName} />
            <SimpleTaskMeta label="Deadline" value={subtask.deadline ? formatDateTime(subtask.deadline) : "No deadline"} />
          </Stack>
        </div>
      ))}
      <Group justify="center">
        {totalPages > 1 ? <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>
    </Stack>
  );
}

export function TasksPage() {
  const navigate = useNavigate();
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
  const taskQueryFilters = useMemo<TaskFilters>(
    () => ({
      projectId: filters.projectId,
      assigneeId: filters.assigneeId,
      isDefect: filters.isDefect,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
    }),
    [filters],
  );

  const projectsQuery = useProjects();
  const membersQuery = useMembers();
  const tasksQuery = useTasks(taskQueryFilters);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const uploadTaskAttachments = useUploadTaskAttachments();
  const deleteTaskAttachment = useDeleteTaskAttachment();
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
      if (matchingTask.canEdit) {
        setEditingTaskId(taskId);
        setOpened(true);
      } else {
        navigate(`/tasks/${taskId}`);
      }
      searchParams.delete("taskId");
      setSearchParams(searchParams, { replace: true });
    }
  }, [navigate, searchParams, setSearchParams, tasksQuery.data]);

  const writableSharedProjects =
    projectsQuery.data?.sharedProjects.filter((project) => project.permission === "edit_all_tasks") ?? [];
  const taskWritableProjects = [...(projectsQuery.data?.ownedProjects ?? []), ...writableSharedProjects];
  const projects = [...(projectsQuery.data?.ownedProjects ?? []), ...(projectsQuery.data?.sharedProjects ?? [])];
  const canCreateTasks = taskWritableProjects.length > 0;
  const members = membersQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const { visibleTasks, subtasksByParent } = useMemo(() => {
    return buildVisibleTaskHierarchy(tasks, filters.status);
  }, [filters.status, tasks]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const { page, setPage, totalPages, paginatedItems: paginatedTasks } = usePagination(visibleTasks, 10);

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

  function handlePreviewTask(taskId: string) {
    navigate(`/tasks/${taskId}`);
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

  async function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function openBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();

    /*
    Browsers may intentionally hide the new-tab window handle when noopener is
    used, so release the blob after navigation starts instead of treating that
    privacy behavior as a preview failure.
    */
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
          <Group gap="sm" className="page-action-group">
            {canCreateTasks ? (
              <Button
                variant="light"
                leftSection={<IconUpload size={16} />}
                onClick={() => {
                  setImportProjectId(
                    taskWritableProjects.some((project) => project.id === filters.projectId)
                      ? (filters.projectId ?? null)
                      : (taskWritableProjects[0]?.id ?? null),
                  );
                  setImportFile(null);
                  setImportResult(null);
                  setImportOpened(true);
                }}
              >
                Import
              </Button>
            ) : null}
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
            {canCreateTasks ? (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditingTaskId(null);
                  setOpened(true);
                }}
              >
                New task
              </Button>
            ) : null}
          </Group>
        }
      />

      <Paper radius="xl" p="lg" withBorder className="tasks-filter-panel">
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
              data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
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

      <Paper radius="xl" p="lg" withBorder className="paginated-table-panel tasks-table-panel">
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
                      onPreview={handlePreviewTask}
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
                          onPreview={handlePreviewTask}
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
      <Stack gap="sm" className="tasks-mobile-list">
        {paginatedTasks.map((task) => {
          const subtasks = subtasksByParent.get(task.id) ?? [];
          const expanded = expandedTaskIds.has(task.id);

          return (
            <TaskMobileCard
              key={task.id}
              task={task}
              deletePending={deleteTask.isPending}
              expanded={expanded}
              subtasks={subtasks}
              onEdit={handleEditTask}
              onDelete={(taskId) => void handleDeleteTask(taskId)}
              onPreview={handlePreviewTask}
              onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
              onToggleExpanded={() => toggleExpandedTask(task.id)}
            />
          );
        })}
      </Stack>
      <Group className="page-pagination-slot" justify="center">
        {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : null}
      </Group>

      <TaskFormModal
        projects={editingTaskId ? projects : taskWritableProjects}
        members={members}
        tasks={tasks}
        opened={opened}
        pending={createTask.isPending || updateTask.isPending}
        attachmentPending={uploadTaskAttachments.isPending || deleteTaskAttachment.isPending}
        task={selectedTask}
        onClose={() => setOpened(false)}
        onDeleteAttachment={async (taskId, attachmentId) => {
          try {
            await deleteTaskAttachment.mutateAsync({ taskId, attachmentId });
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to delete attachment",
              message: getErrorMessage(error),
            });
          }
        }}
        onDownloadAttachment={async (taskId, attachmentId, filename) => {
          try {
            const blob = await downloadTaskAttachment(taskId, attachmentId);
            await saveBlob(blob, filename);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to download attachment",
              message: getErrorMessage(error),
            });
          }
        }}
        onDownloadAttachmentArchive={async (taskId) => {
          try {
            const blob = await downloadTaskAttachmentArchive(taskId);
            await saveBlob(blob, `task-${taskId}-attachments.zip`);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to download archive",
              message: getErrorMessage(error),
            });
          }
        }}
        onPreviewAttachment={async (taskId, attachmentId, _filename, _mimeType) => {
          try {
            const blob = await previewTaskAttachment(taskId, attachmentId);
            await openBlob(blob);
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to preview attachment",
              message: getErrorMessage(error),
            });
          }
        }}
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
        onUploadAttachments={async (taskId, files) => {
          try {
            await uploadTaskAttachments.mutateAsync({ taskId, files });
          } catch (error) {
            notifications.show({
              color: "red",
              title: "Unable to upload attachments",
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
                data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
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
            data={taskWritableProjects.map((project) => ({ value: project.id, label: project.name }))}
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
