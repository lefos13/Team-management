/*
TaskBoardCard displays an individual task card within a board column, exposing
accessible preview/edit/share/delete actions and scan-friendly metadata.
*/
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCalendar,
  IconCheck,
  IconEdit,
  IconEye,
  IconPaperclip,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import type { TaskDTO } from "@team-management/shared";

import { formatDate } from "../../lib/dates";
import { getAssigneeAvatarItems, getAssigneeInitials } from "../../lib/task-assignees";

export type TaskBoardCardProps = {
  task: TaskDTO;
  deletePending?: boolean;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

export function TaskBoardCard({
  task,
  deletePending = false,
  onPreview,
  onEdit,
  onShare,
  onDelete,
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

  return (
    <Paper radius="sm" withBorder className="task-board-card" data-task-id={task.id}>
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
