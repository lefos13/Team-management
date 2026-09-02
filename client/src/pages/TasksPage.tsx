/* Keep task management filterable and editable from one screen because the leader is the only status owner. */
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  FileInput,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileDescription,
  IconFileSpreadsheet,
  IconPaperclip,
  IconPlus,
  IconShare,
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
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutationState } from "@tanstack/react-query";

import { PageHeader } from "../components/PageHeader";
import { CompactPagination } from "../components/CompactPagination";
import { TaskStatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/forms/TaskFormModal";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { TaskBoard } from "../components/task-board";
import {
  downloadTaskAttachment,
  downloadTaskAttachmentArchive,
  downloadTaskImportTemplate,
  exportTasks,
  previewTaskAttachment,
  useCreateTask,
  useCreateTaskShareLink,
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
import { formatDate } from "../lib/dates";
import { buildTaskBoardModel, parseTaskView, withTaskViewSearchParams } from "../lib/task-board-model";
import { formatTaskAssignees, getAssigneeAvatarItems, getAssigneeInitials } from "../lib/task-assignees";
import { usePagination } from "../hooks/use-pagination";

function isActiveTaskStatus(status: TaskDTO["status"]) {
  return status !== "done";
}

/*
  Parent completion safety only considers direct, currently active children in
  the project-scoped hierarchy response; subtasks remain independently movable.
*/
function getActiveDirectSubtasks(tasks: TaskDTO[], parentTaskId: string) {
  return tasks.filter((task) => task.parentTaskId === parentTaskId && isActiveTaskStatus(task.status));
}

type StatusConfirmationRequest = {
  task: TaskDTO;
  status: TaskDTO["status"];
  activeSubtaskCount: number;
};
export function getTaskRangeLabel(page: number, pageSize: number, total: number) {
  if (total === 0) {
    return "Showing 0 tasks";
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return `Showing ${start} to ${end} of ${total} tasks`;
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
  pendingStatusTaskIds: ReadonlySet<string>;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onPreview: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onStatusChange: (task: TaskDTO, status: TaskDTO["status"]) => void;
};

type TaskRowProps = TaskTableColumnsProps & {
  expanded?: boolean;
  isSubtask?: boolean;
  subtasks?: TaskDTO[];
  onToggleExpanded?: () => void;
};

function TaskTypeBadge({ task }: { task: TaskDTO }) {
  return (
    <Badge className={task.isDefect ? "task-type-badge task-type-badge-defect" : "task-type-badge task-type-badge-standard"}>
      {task.isDefect ? "Defect" : "Standard"}
    </Badge>
  );
}

function AssigneeAvatarStack({ task }: { task: Pick<TaskDTO, "assigneeName" | "assigneeNames"> }) {
  const { visibleNames, overflowCount, label } = getAssigneeAvatarItems(task);

  return (
    <Tooltip label={label} withArrow>
      <Avatar.Group className="task-assignee-stack">
        {visibleNames.map((name, index) => (
          <Avatar key={`${name}-${index}`} size={32} radius="xl" className="task-assignee-avatar" aria-label={name}>
            {getAssigneeInitials(name)}
          </Avatar>
        ))}
        {overflowCount > 0 ? (
          <Avatar size={32} radius="xl" className="task-assignee-avatar task-assignee-avatar-more" aria-label={`${overflowCount} more assignees`}>
            +{overflowCount}
          </Avatar>
        ) : null}
      </Avatar.Group>
    </Tooltip>
  );
}

function TaskActionGroup({ task, deletePending, onEdit, onDelete, onPreview, onShare }: Omit<TaskTableColumnsProps, "onStatusChange" | "pendingStatusTaskIds">) {
  return (
    <Group justify="end" gap={8} wrap="nowrap" className="tasks-row-actions">
      <Tooltip label="Preview task" withArrow openDelay={300}>
        <ActionIcon variant="subtle" className="tasks-action-icon" onClick={() => onPreview(task.id)} aria-label={`Preview ${task.title}`}>
          <IconEye size={17} />
        </ActionIcon>
      </Tooltip>
      {task.canEdit ? (
        <>
          <Tooltip label="Edit task" withArrow openDelay={300}>
            <ActionIcon variant="subtle" className="tasks-action-icon" onClick={() => onEdit(task.id)} aria-label={`Edit ${task.title}`}>
              <IconEdit size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Share task" withArrow openDelay={300}>
            <ActionIcon variant="subtle" className="tasks-action-icon" onClick={() => onShare(task.id)} aria-label={`Share ${task.title}`}>
              <IconShare size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete task" withArrow openDelay={300}>
            <ActionIcon
              color="red"
              variant="subtle"
              className="tasks-action-icon tasks-action-icon-danger"
              loading={deletePending}
              onClick={() => onDelete(task.id)}
              aria-label={`Delete ${task.title}`}
            >
              <IconTrash size={17} />
            </ActionIcon>
          </Tooltip>
        </>
      ) : null}
    </Group>
  );
}

function TaskStatusSelect({ task, onStatusChange, pendingStatusTaskIds }: Pick<TaskTableColumnsProps, "task" | "onStatusChange" | "pendingStatusTaskIds">) {
  if (!task.canEdit) {
    return <Text size="sm" c="dimmed">-</Text>;
  }

  return (
    <Select
      size="xs"
      className="tasks-status-select"
      value={task.status}
      disabled={pendingStatusTaskIds.has(task.id)}
      data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
      onChange={(value) => {
        if (!value || value === task.status) {
          return;
        }

        onStatusChange(task, value as TaskDTO["status"]);
      }}
    />
  );
}

/*
Desktop rows mirror the screenshot's dense table while keeping hierarchy,
attachments, status editing, and per-task permissions on the same row.
*/
function TaskTableRow({
  task,
  deletePending,
  pendingStatusTaskIds,
  expanded = false,
  isSubtask = false,
  subtasks = [],
  onEdit,
  onDelete,
  onPreview,
  onShare,
  onStatusChange,
  onToggleExpanded,
}: TaskRowProps) {
  const hasSubtasks = subtasks.length > 0;

  return (
    <Table.Tr className={isSubtask ? "tasks-data-row tasks-subtask-row" : "tasks-data-row"}>
      <Table.Td className="tasks-task-cell">
        <Group gap="xs" wrap="nowrap" className="tasks-task-title-group">
          {hasSubtasks ? (
            <ActionIcon
              variant="subtle"
              className="tasks-expand-button"
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
              onClick={onToggleExpanded}
            >
              {expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            </ActionIcon>
          ) : (
            <span className={isSubtask ? "tasks-subtask-marker" : "tasks-expand-spacer"} />
          )}
          <IconFileDescription size={18} className="tasks-task-icon" />
          <Stack gap={3} className="tasks-task-copy">
            <Text fw={800} size="sm" className="tasks-task-title">
              {task.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2} className="tasks-task-description">
              {task.description || "No description"}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td className="tasks-attachments-cell">
        <Group gap={6} wrap="nowrap" className="tasks-attachment-count">
          <IconPaperclip size={16} />
          <Text size="xs">{task.attachments.length}</Text>
        </Group>
      </Table.Td>
      <Table.Td className="tasks-project-cell">
        <Text size="xs" lineClamp={2}>{task.projectName}</Text>
      </Table.Td>
      <Table.Td>
        <AssigneeAvatarStack task={task} />
      </Table.Td>
      <Table.Td>
        <TaskStatusBadge status={task.status} />
      </Table.Td>
      <Table.Td>
        <TaskStatusSelect task={task} onStatusChange={onStatusChange} pendingStatusTaskIds={pendingStatusTaskIds} />
      </Table.Td>
      <Table.Td>
        <TaskTypeBadge task={task} />
      </Table.Td>
      <Table.Td>
        <Text size="xs" c={task.completedAt ? undefined : "dimmed"}>
          {task.completedAt ? formatDate(task.completedAt) : "-"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c={task.deadline ? undefined : "dimmed"}>
          {task.deadline ? formatDate(task.deadline) : "No deadline"}
        </Text>
      </Table.Td>
      <Table.Td className="tasks-actions-cell">
        <TaskActionGroup
          task={task}
          deletePending={deletePending}
          onEdit={onEdit}
          onDelete={onDelete}
          onPreview={onPreview}
          onShare={onShare}
        />
      </Table.Td>
    </Table.Tr>
  );
}

type SubtaskRowsProps = Omit<TaskRowProps, "task" | "subtasks" | "expanded" | "isSubtask" | "onToggleExpanded"> & {
  parentId: string;
  subtasks: TaskDTO[];
};

/*
Expanded subtasks stay inline with the parent table columns and keep their own
small pager so large hierarchies do not stretch the main task page.
*/
function SubtaskRows({ parentId, subtasks, deletePending, pendingStatusTaskIds, onEdit, onDelete, onPreview, onShare, onStatusChange }: SubtaskRowsProps) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(subtasks, 5);

  return (
    <>
      {paginatedItems.map((subtask) => (
        <TaskTableRow
          key={`${parentId}-${subtask.id}`}
          task={subtask}
          isSubtask
          deletePending={deletePending}
          pendingStatusTaskIds={pendingStatusTaskIds}
          onEdit={onEdit}
          onDelete={onDelete}
          onPreview={onPreview}
          onShare={onShare}
          onStatusChange={onStatusChange}
        />
      ))}
      {totalPages > 1 ? (
        <Table.Tr className="tasks-subtask-pagination-row">
          <Table.Td colSpan={10}>
            <Group justify="center">
              <CompactPagination size="xs" total={totalPages} value={page} onChange={setPage} />
            </Group>
          </Table.Td>
        </Table.Tr>
      ) : null}
    </>
  );
}

type TaskMobileCardProps = TaskTableColumnsProps & {
  expanded: boolean;
  subtasks: TaskDTO[];
  onToggleExpanded: () => void;
};

/*
Mobile task cards retain the desktop row information in a vertical layout so
status work, file counts, hierarchy context, and actions stay reachable without
horizontal scrolling.
*/
function TaskMobileCard({
  task,
  deletePending,
  pendingStatusTaskIds,
  expanded,
  subtasks,
  onEdit,
  onDelete,
  onPreview,
  onShare,
  onStatusChange,
  onToggleExpanded,
}: TaskMobileCardProps) {
  return (
    <Paper radius="md" p="md" withBorder className="task-mobile-card">
      <Stack gap="md">
        <Group justify="space-between" align="start" wrap="nowrap">
          <Stack gap={6} className="task-mobile-card-copy">
            <Group gap="xs" wrap="nowrap">
              {subtasks.length > 0 ? (
                <ActionIcon
                  variant="subtle"
                  className="tasks-expand-button"
                  aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
                  onClick={onToggleExpanded}
                >
                  {expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                </ActionIcon>
              ) : null}
              <Text fw={850} className="task-mobile-title">
                {task.title}
              </Text>
            </Group>
            <Text size="sm" c="dimmed" lineClamp={3}>
              {task.description || "No description"}
            </Text>
          </Stack>
          <TaskActionGroup
            task={task}
            deletePending={deletePending}
            onEdit={onEdit}
            onDelete={onDelete}
            onPreview={onPreview}
            onShare={onShare}
          />
        </Group>

        <Group gap="xs" wrap="wrap">
          <TaskStatusBadge status={task.status} />
          <TaskTypeBadge task={task} />
        </Group>

        <TaskStatusSelect task={task} onStatusChange={onStatusChange} pendingStatusTaskIds={pendingStatusTaskIds} />

        <SimpleTaskMeta label="Context" value={task.parentTaskTitle ?? "-"} />
        <SimpleTaskMeta label="Project" value={task.projectName} />
        <SimpleTaskMeta label="Assignee" value={formatTaskAssignees(task)} />
        <SimpleTaskMeta
          label="Files"
          value={task.status === "done" ? `${task.attachments.length} archived` : `${task.attachments.length} attached`}
        />
        <SimpleTaskMeta label="Completed" value={task.completedAt ? formatDate(task.completedAt) : "-"} />
        <SimpleTaskMeta label="Deadline" value={task.deadline ? formatDate(task.deadline) : "No deadline"} />

        {subtasks.length > 0 && expanded ? (
          <SubtaskMobilePanel
            subtasks={subtasks}
            deletePending={deletePending}
            pendingStatusTaskIds={pendingStatusTaskIds}
            onEdit={onEdit}
            onDelete={onDelete}
            onPreview={onPreview}
            onShare={onShare}
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
      <Text size="xs" c="dimmed" fw={800}>
        {label}
      </Text>
      <Text size="sm" ta="right" className="task-mobile-meta-value">
        {value}
      </Text>
    </Group>
  );
}

function SubtaskMobilePanel({ subtasks, deletePending, pendingStatusTaskIds, onEdit, onDelete, onPreview, onShare, onStatusChange }: Omit<SubtaskRowsProps, "parentId">) {
  const { page, setPage, totalPages, paginatedItems } = usePagination(subtasks, 5);

  return (
    <Stack gap="sm" className="task-mobile-subtasks">
      {paginatedItems.map((subtask) => (
        <div key={subtask.id} className="task-mobile-subtask-card">
          <Stack gap="xs">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Stack gap={3} className="task-mobile-card-copy">
                <Text fw={800} size="sm" className="task-mobile-title">
                  {subtask.title}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {subtask.description || "No description"}
                </Text>
              </Stack>
              <TaskActionGroup
                task={subtask}
                deletePending={deletePending}
                onEdit={onEdit}
                onDelete={onDelete}
                onPreview={onPreview}
                onShare={onShare}
              />
            </Group>
            <Group gap="xs" wrap="wrap">
              <TaskStatusBadge status={subtask.status} />
              <TaskTypeBadge task={subtask} />
            </Group>
            <TaskStatusSelect task={subtask} onStatusChange={onStatusChange} pendingStatusTaskIds={pendingStatusTaskIds} />
            <SimpleTaskMeta label="Project" value={subtask.projectName} />
            <SimpleTaskMeta label="Assignee" value={formatTaskAssignees(subtask)} />
            <SimpleTaskMeta label="Files" value={`${subtask.attachments.length} attached`} />
            <SimpleTaskMeta label="Completed" value={subtask.completedAt ? formatDate(subtask.completedAt) : "-"} />
            <SimpleTaskMeta label="Deadline" value={subtask.deadline ? formatDate(subtask.deadline) : "No deadline"} />
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
  const view = parseTaskView(searchParams.get("view"));
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<StatusConfirmationRequest | null>(null);
  const [localPendingStatusTaskIds, setLocalPendingStatusTaskIds] = useState<Set<string>>(() => new Set());
  const statusMoveInFlightRef = useRef<Set<string>>(new Set());
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
  /*
    Keep completion safety independent from display-only filters. A project
    scoped response contains active children hidden by assignee, defect, or
    date filters without broadening the visible board/list response.
  */
  const hierarchyTaskQueryFilters = useMemo<TaskFilters>(() => ({ projectId: filters.projectId }), [filters.projectId]);
  const hierarchyTasksQuery = useTasks(hierarchyTaskQueryFilters);
  const createTask = useCreateTask();
  const createTaskShareLink = useCreateTaskShareLink();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const uploadTaskAttachments = useUploadTaskAttachments();
  const deleteTaskAttachment = useDeleteTaskAttachment();
  const importTasks = useImportTasks();
  /*
    Combine the mutation cache with a local synchronous guard so the board
    reflects pending status work immediately and per-task concurrency stays
    isolated even before React Query publishes its mutation state.
  */
  const pendingMutationTaskIds = useMutationState<string | undefined>({
    filters: { mutationKey: ["task-status"], status: "pending" },
    select: (mutation) => {
      const variables = mutation.state.variables as { id?: unknown } | undefined;
      return typeof variables?.id === "string" ? variables.id : undefined;
    },
  });
  const pendingStatusTaskIds = useMemo(() => {
    const taskIds = new Set(localPendingStatusTaskIds);
    for (const taskId of pendingMutationTaskIds) {
      if (taskId) {
        taskIds.add(taskId);
      }
    }
    return taskIds;
  }, [localPendingStatusTaskIds, pendingMutationTaskIds]);

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
  /*
  Board counts use the complete task response, including subtasks, without
  changing List hierarchy behavior.
  */
  const boardModel = useMemo(() => buildTaskBoardModel(tasks), [tasks]);
  const { visibleTasks, subtasksByParent } = useMemo(() => {
    return buildVisibleTaskHierarchy(tasks, filters.status);
  }, [filters.status, tasks]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [taskPageSize, setTaskPageSize] = useState(10);
  const { page, setPage, totalPages, paginatedItems: paginatedTasks } = usePagination(visibleTasks, taskPageSize);

  if (projectsQuery.isLoading || membersQuery.isLoading || tasksQuery.isLoading || hierarchyTasksQuery.isLoading) {
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

  async function handleShareTask(taskId: string) {
    try {
      const shareLink = await createTaskShareLink.mutateAsync(taskId);
      await navigator.clipboard.writeText(shareLink.url);
      notifications.show({
        color: "teal",
        title: "Share link copied",
        message: "Anyone with the link can preview this task without signing in.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to create share link",
        message: getErrorMessage(error, "Share link creation failed."),
      });
    }
  }

  function handleDeleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    setDeleteTarget({ id: taskId, title: task?.title ?? "this task" });
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) return;
    try {
      await deleteTask.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to delete task",
        message: getErrorMessage(error),
      });
    }
  }

  /*
    Keep a per-task guard around the existing optimistic mutation so repeated
    input cannot enqueue duplicate requests while other cards stay available.
  */
  async function commitStatusChange(task: TaskDTO, status: TaskDTO["status"]) {
    if (statusMoveInFlightRef.current.has(task.id)) {
      return;
    }

    statusMoveInFlightRef.current.add(task.id);
    setLocalPendingStatusTaskIds((current) => new Set(current).add(task.id));
    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Unable to update status",
        message: getErrorMessage(error),
      });
    } finally {
      statusMoveInFlightRef.current.delete(task.id);
      setLocalPendingStatusTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  function handleStatusChange(task: TaskDTO, status: TaskDTO["status"]) {
    if (!task.canEdit || task.status === status || pendingStatusTaskIds.has(task.id) || statusMoveInFlightRef.current.has(task.id)) {
      return;
    }

    if (status === "done" && (hierarchyTasksQuery.isError || !hierarchyTasksQuery.data)) {
      notifications.show({
        color: "red",
        title: "Unable to verify subtasks",
        message: "Refresh the task board before completing this parent task.",
      });
      return;
    }

    const activeSubtasks = getActiveDirectSubtasks(hierarchyTasksQuery.data ?? [], task.id);
    if (status === "done" && activeSubtasks.length > 0) {
      setStatusConfirmation({ task, status, activeSubtaskCount: activeSubtasks.length });
      return;
    }

    void commitStatusChange(task, status);
  }

  function cancelStatusConfirmation() {
    setStatusConfirmation(null);
  }

  function confirmStatusChange() {
    if (!statusConfirmation) {
      return;
    }

    const request = statusConfirmation;
    if (pendingStatusTaskIds.has(request.task.id) || statusMoveInFlightRef.current.has(request.task.id)) {
      return;
    }

    setStatusConfirmation(null);
    void commitStatusChange(request.task, request.status);
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
    <Stack gap="xl" className="tasks-page">
      <PageHeader
        title="Tasks"
        description="This is where work is assigned, filtered, and updated."
        action={
          <Group gap="sm" className="page-action-group">
            {canCreateTasks ? (
              <Button
                variant="default"
                className="tasks-secondary-action"
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
              variant="default"
              className="tasks-secondary-action"
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
                className="tasks-primary-action"
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

      {/*
      Clone the complete query when changing views so task previews and other
      parameters survive.
      */}
      <SegmentedControl
        aria-label="Task view"
        value={view}
        data={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]}
        onChange={(nextView) => {
          setSearchParams(withTaskViewSearchParams(searchParams, parseTaskView(nextView)));
        }}
      />

      <Paper radius="lg" p="lg" withBorder className="tasks-filter-panel">
        <Grid align="end">
          <Grid.Col span={{ base: 12, md: view === "board" ? 4 : 3 }}>
            <Select
              label="Project"
              placeholder="All projects"
              clearable
              value={filters.projectId ?? null}
              data={projects.map((project) => ({ value: project.id, label: project.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, projectId: value ?? undefined }))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: view === "board" ? 4 : 3 }}>
            <Select
              label="Assignee"
              placeholder="All assignees"
              clearable
              value={filters.assigneeId ?? null}
              data={members.map((member) => ({ value: member.id, label: member.name }))}
              onChange={(value) => setFilters((current) => ({ ...current, assigneeId: value ?? undefined }))}
            />
          </Grid.Col>
          {view === "list" ? (
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Select
                label="Status"
                placeholder="All statuses"
                clearable
                value={filters.status ?? null}
                data={taskStatusValues.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
                onChange={(value) => setFilters((current) => ({ ...current, status: (value as TaskFilters["status"]) ?? undefined }))}
              />
            </Grid.Col>
          ) : null}
          <Grid.Col span={{ base: 12, md: view === "board" ? 4 : 3 }}>
            <Text size="sm" fw={700} mb={8}>Defect</Text>
            <SegmentedControl
              fullWidth
              className="tasks-defect-control"
              value={filters.isDefect === undefined ? "all" : filters.isDefect ? "defects" : "non-defects"}
              data={[
                { value: "all", label: "All" },
                { value: "defects", label: "Defects only" },
                { value: "non-defects", label: "Non-defects" },
              ]}
              onChange={(value) => {
                setFilters((current) => ({
                  ...current,
                  isDefect: value === "all" ? undefined : value === "defects",
                }));
              }}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/*
      Board view renders five status columns with desktop horizontal scrolling,
      while List view preserves the nested hierarchy and table pagination.
      */}
      {view === "board" ? (
        <TaskBoard
          columns={boardModel}
          deletePending={deleteTask.isPending}
          pendingStatusTaskIds={pendingStatusTaskIds}
          onPreview={handlePreviewTask}
          onEdit={handleEditTask}
          onShare={handleShareTask}
          onDelete={handleDeleteTask}
          onStatusChange={(task, status) => handleStatusChange(task, status)}
        />
      ) : (
        <>
      <Paper radius="lg" withBorder className="paginated-table-panel tasks-table-panel">
        <Table.ScrollContainer minWidth={1240}>
          <Table verticalSpacing={0} className="tasks-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Task</Table.Th>
                <Table.Th />
                <Table.Th>Project</Table.Th>
                <Table.Th>Assignee</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Update status</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Completed</Table.Th>
                <Table.Th>Deadline</Table.Th>
                <Table.Th className="tasks-actions-heading">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedTasks.map((task) => {
                const subtasks = subtasksByParent.get(task.id) ?? [];
                const expanded = expandedTaskIds.has(task.id);

                return (
                  <Fragment key={task.id}>
                    <TaskTableRow
                      task={task}
                      deletePending={deleteTask.isPending}
                      pendingStatusTaskIds={pendingStatusTaskIds}
                      expanded={expanded}
                      subtasks={subtasks}
                      onEdit={handleEditTask}
                      onDelete={(taskId) => void handleDeleteTask(taskId)}
                      onPreview={handlePreviewTask}
                      onShare={(taskId) => void handleShareTask(taskId)}
                      onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
                      onToggleExpanded={() => toggleExpandedTask(task.id)}
                    />
                    {subtasks.length > 0 && expanded ? (
                      <SubtaskRows
                        parentId={task.id}
                        subtasks={subtasks}
                        deletePending={deleteTask.isPending}
                        pendingStatusTaskIds={pendingStatusTaskIds}
                        onEdit={handleEditTask}
                        onDelete={(taskId) => void handleDeleteTask(taskId)}
                        onPreview={handlePreviewTask}
                        onShare={(taskId) => void handleShareTask(taskId)}
                        onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group className="tasks-table-footer" justify="space-between">
          <Text size="sm" c="dimmed">{getTaskRangeLabel(page, taskPageSize, visibleTasks.length)}</Text>
          {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : <span />}
          <Select
            size="sm"
            w={150}
            className="tasks-page-size-select"
            value={String(taskPageSize)}
            data={[
              { value: "10", label: "10 per page" },
              { value: "25", label: "25 per page" },
              { value: "50", label: "50 per page" },
            ]}
            onChange={(value) => setTaskPageSize(Number(value ?? "10"))}
          />
        </Group>
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
              pendingStatusTaskIds={pendingStatusTaskIds}
              expanded={expanded}
              subtasks={subtasks}
              onEdit={handleEditTask}
              onDelete={(taskId) => void handleDeleteTask(taskId)}
              onPreview={handlePreviewTask}
              onShare={(taskId) => void handleShareTask(taskId)}
              onStatusChange={(nextTask, status) => void handleStatusChange(nextTask, status)}
              onToggleExpanded={() => toggleExpandedTask(task.id)}
            />
          );
        })}
      </Stack>
      <Group className="tasks-mobile-pagination-footer" justify="space-between">
        <Text size="sm" c="dimmed">{getTaskRangeLabel(page, taskPageSize, visibleTasks.length)}</Text>
        {totalPages > 1 ? <CompactPagination total={totalPages} value={page} onChange={setPage} /> : null}
        <Select
          size="sm"
          className="tasks-page-size-select"
          value={String(taskPageSize)}
          data={[
            { value: "10", label: "10 per page" },
            { value: "25", label: "25 per page" },
            { value: "50", label: "50 per page" },
          ]}
          onChange={(value) => setTaskPageSize(Number(value ?? "10"))}
        />
      </Group>
        </>
      )}

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

      {/*
      Completing a parent with active direct subtasks is the one status move
      that needs an explicit acknowledgement of the server-side cascade.
      */}
      <Modal
        opened={statusConfirmation !== null}
        onClose={cancelStatusConfirmation}
        title="Complete task and active subtasks?"
        centered
        radius="lg"
      >
        {statusConfirmation ? (
          <Stack gap="md">
            <Text size="sm">
              The server will also complete {statusConfirmation.activeSubtaskCount === 1 ? "the active subtask" : `${statusConfirmation.activeSubtaskCount} active subtasks`} for this parent task.
            </Text>
            <Group justify="end" gap="sm">
              <Button variant="subtle" onClick={cancelStatusConfirmation}>
                Cancel
              </Button>
              <Button
                loading={pendingStatusTaskIds.has(statusConfirmation.task.id)}
                onClick={confirmStatusChange}
              >
                Complete task and active subtasks
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

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
      <ConfirmDeleteModal
        opened={deleteTarget !== null}
        itemName={deleteTarget?.title ?? ""}
        itemType="task"
        loading={deleteTask.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTask()}
      />
    </Stack>
  );
}
