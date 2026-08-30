/*
TaskBoardColumn renders one status column of the board with accessible heading,
total count, meaningful empty state, and incremental 25-card pagination.
*/
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { taskStatusLabels } from "@team-management/shared";
import { useState } from "react";

import type { TaskBoardColumn as TaskBoardColumnModel } from "../../lib/task-board-model";
import { TaskBoardCard } from "./TaskBoardCard";

export type TaskBoardColumnProps = {
  column: TaskBoardColumnModel;
  deletePending?: boolean;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

const INITIAL_TASK_LIMIT = 25;
const TASK_PAGE_INCREMENT = 25;

export function TaskBoardColumn({
  column,
  deletePending = false,
  onPreview,
  onEdit,
  onShare,
  onDelete,
}: TaskBoardColumnProps) {
  const [displayLimit, setDisplayLimit] = useState(INITIAL_TASK_LIMIT);
  const statusLabel = taskStatusLabels[column.status];
  const totalCount = column.tasks.length;
  const visibleTasks = column.tasks.slice(0, displayLimit);
  const hasMore = totalCount > displayLimit;
  const remainingCount = totalCount - displayLimit;

  return (
    <div
      className="task-board-column"
      role="region"
      aria-label={`${statusLabel} column, ${totalCount} ${totalCount === 1 ? "task" : "tasks"}`}
      data-status={column.status}
    >
      <Group justify="space-between" align="center" wrap="nowrap" className="task-board-column-header">
        <Text component="h3" className="task-board-column-title">
          {statusLabel}
        </Text>
        <Badge
          size="sm"
          variant="light"
          className="task-board-column-count"
          data-count={totalCount}
        >
          {totalCount}
        </Badge>
      </Group>

      {totalCount === 0 ? (
        <Paper p="md" withBorder className="task-board-empty-state">
          <Text size="sm" c="dimmed" ta="center">
            No tasks in this column
          </Text>
        </Paper>
      ) : (
        <Stack gap={8} className="task-board-column-cards">
          {visibleTasks.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              deletePending={deletePending}
              onPreview={onPreview}
              onEdit={onEdit}
              onShare={onShare}
              onDelete={onDelete}
            />
          ))}

          {hasMore ? (
            <Button
              variant="subtle"
              size="xs"
              fullWidth
              className="task-board-show-more"
              onClick={() => setDisplayLimit((current) => current + TASK_PAGE_INCREMENT)}
            >
              Show more ({remainingCount} remaining)
            </Button>
          ) : null}
        </Stack>
      )}
    </div>
  );
}
