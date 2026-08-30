/*
TaskBoardCard displays an individual task card within a board column, exposing
accessible preview/edit/share/delete actions and scan-friendly metadata.
*/
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Loader,
  Menu,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowsMove,
  IconCalendar,
  IconCheck,
  IconEdit,
  IconEye,
  IconGripVertical,
  IconPaperclip,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { taskStatusLabels, taskStatusValues, type TaskDTO } from "@team-management/shared";

import { formatDate } from "../../lib/dates";
import { getAssigneeAvatarItems, getAssigneeInitials } from "../../lib/task-assignees";

export type TaskBoardCardProps = {
  task: TaskDTO;
  deletePending?: boolean;
  statusPending?: boolean;
  isDragging?: boolean;
  dragRef?: (element: Element | null) => void;
  dragHandleRef?: (element: Element | null) => void;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (task: TaskDTO, status: TaskDTO["status"]) => void;
};

export function TaskBoardCard({
  task,
  deletePending = false,
  statusPending = false,
  isDragging = false,
  dragRef,
  dragHandleRef,
  onPreview,
  onEdit,
  onShare,
  onDelete,
  onStatusChange,
}: TaskBoardCardProps) {
  const { visibleNames, overflowCount, label: assigneeLabel } = getAssigneeAvatarItems(task);
  const isDone = task.status === "done";
  const dateDisplay = isDone
    ? task.completedAt
      ? formatDate(task.completedAt)
      : "-"
    : task.deadline
      ? formatDate(task.deadline)
      : "No deadline";

  /*
    Editable cards keep the existing actions and add a compact status menu and
    an optional dnd-kit handle; pending mutations make only this card busy.
  */
  return (
    <Paper
      ref={dragRef}
      radius="sm"
      withBorder
      className={`task-board-card${isDragging ? " task-board-card-dragging" : ""}${statusPending ? " task-board-card-status-pending" : ""}`}
      data-task-id={task.id}
      aria-busy={statusPending || undefined}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={6} wrap="wrap">
            <Badge
              size="xs"
              className={task.isDefect ? "task-type-badge task-type-badge-defect" : "task-type-badge task-type-badge-standard"}
            >
              {task.isDefect ? "Defect" : "Standard"}
            </Badge>
          </Group>

          <Group gap={4} wrap="nowrap" className="tasks-row-actions">
            {task.canEdit && dragHandleRef ? (
              <Tooltip label="Drag to move task" withArrow openDelay={300}>
                <ActionIcon
                  ref={dragHandleRef}
                  size="sm"
                  variant="subtle"
                  className="tasks-action-icon task-board-drag-handle"
                  disabled={statusPending}
                  aria-label={`Drag ${task.title}`}
                >
                  <IconGripVertical size={15} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {task.canEdit ? (
              <Menu withinPortal position="bottom-end" shadow="md">
                <Menu.Target>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    className="tasks-action-icon task-board-status-menu-target"
                    loading={statusPending}
                    disabled={statusPending}
                    aria-label={`Move ${task.title}`}
                  >
                    <IconArrowsMove size={15} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown aria-label={`Move ${task.title}`}>
                  {taskStatusValues.map((status) => {
                    const isCurrentStatus = status === task.status;

                    return (
                      <Menu.Item
                        key={status}
                        disabled={isCurrentStatus || statusPending}
                        aria-current={isCurrentStatus ? "true" : undefined}
                        aria-label={`${taskStatusLabels[status]}${isCurrentStatus ? " (current status)" : ""}`}
                        onClick={() => {
                          if (!isCurrentStatus && !statusPending) {
                            onStatusChange?.(task, status);
                          }
                        }}
                      >
                        <Group gap="xs" justify="space-between" wrap="nowrap">
                          <Text size="sm">{taskStatusLabels[status]}</Text>
                          {isCurrentStatus ? <Text size="xs" c="dimmed">Current</Text> : null}
                        </Group>
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
            ) : null}
            <Tooltip label="Preview task" withArrow openDelay={300}>
              <ActionIcon
                size="sm"
                variant="subtle"
                className="tasks-action-icon"
                onClick={() => onPreview(task.id)}
                aria-label={`Preview ${task.title}`}
              >
                <IconEye size={15} />
              </ActionIcon>
            </Tooltip>
            {task.canEdit ? (
              <>
                <Tooltip label="Edit task" withArrow openDelay={300}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    className="tasks-action-icon"
                    onClick={() => onEdit(task.id)}
                    aria-label={`Edit ${task.title}`}
                  >
                    <IconEdit size={15} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Share task" withArrow openDelay={300}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    className="tasks-action-icon"
                    onClick={() => onShare(task.id)}
                    aria-label={`Share ${task.title}`}
                  >
                    <IconShare size={15} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete task" withArrow openDelay={300}>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    className="tasks-action-icon tasks-action-icon-danger"
                    loading={deletePending}
                    onClick={() => onDelete(task.id)}
                    aria-label={`Delete ${task.title}`}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </Tooltip>
              </>
            ) : null}
          </Group>
        </Group>

        {statusPending ? (
          <Group gap={5} wrap="nowrap" className="task-board-card-status-pending-label" role="status">
            <Loader size={12} color="gray" />
            <Text size="xs" c="dimmed">Updating status…</Text>
          </Group>
        ) : null}

        {task.parentTaskTitle ? (
          <Text size="xs" c="dimmed" fw={650} className="task-board-subtask-label" lineClamp={1}>
            Subtask of: {task.parentTaskTitle}
          </Text>
        ) : null}

        <Text fw={750} size="sm" className="task-board-card-title" lineClamp={2}>
          {task.title}
        </Text>

        <Group justify="space-between" align="center" wrap="nowrap" className="task-board-card-footer">
          <Text size="xs" c="dimmed" lineClamp={1} className="task-board-card-project">
            {task.projectName}
          </Text>
          <Group gap={6} wrap="nowrap" className="tasks-attachment-count">
            <IconPaperclip size={14} />
            <Text size="xs">{task.attachments.length}</Text>
          </Group>
        </Group>

        <Group justify="space-between" align="center" wrap="nowrap" className="task-board-card-footer">
          <Group gap={4} wrap="nowrap">
            {isDone ? <IconCheck size={14} className="task-board-card-icon-done" /> : <IconCalendar size={14} className="task-board-card-icon-calendar" />}
            <Text size="xs" c={isDone && !task.completedAt ? "dimmed" : !isDone && !task.deadline ? "dimmed" : undefined}>
              {dateDisplay}
            </Text>
          </Group>

          <Tooltip label={assigneeLabel} withArrow>
            <Avatar.Group className="task-assignee-stack">
              {visibleNames.map((name, index) => (
                <Avatar key={`${name}-${index}`} size={24} radius="xl" className="task-assignee-avatar" aria-label={name}>
                  {getAssigneeInitials(name)}
                </Avatar>
              ))}
              {overflowCount > 0 ? (
                <Avatar size={24} radius="xl" className="task-assignee-avatar task-assignee-avatar-more" aria-label={`${overflowCount} more assignees`}>
                  +{overflowCount}
                </Avatar>
              ) : null}
            </Avatar.Group>
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  );
}
