/*
TaskBoardColumn renders one status column of the board with accessible heading,
total count, meaningful empty state, and incremental 25-card pagination.
*/
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { taskStatusLabels } from "@team-management/shared";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { useState } from "react";

import type { TaskBoardColumn as TaskBoardColumnModel } from "../../lib/task-board-model";
import { TaskBoardCard, type TaskBoardCardProps } from "./TaskBoardCard";

export type TaskBoardColumnProps = {
  column: TaskBoardColumnModel;
  deletePending?: boolean;
  pendingStatusTaskIds?: ReadonlySet<string>;
  disableDrag?: boolean;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (task: TaskBoardCardProps["task"], status: TaskBoardCardProps["task"]["status"]) => void;
};

const INITIAL_TASK_LIMIT = 25;
const TASK_PAGE_INCREMENT = 25;
const TASK_DRAG_TYPE = "task";

type DraggableTaskBoardCardProps = Omit<TaskBoardCardProps, "dragRef" | "dragHandleRef" | "isDragging">;

/*
  Keep dnd-kit hooks in a dedicated child so read-only cards never register as
  draggables and the column can continue rendering independent task cards.
*/
function DraggableTaskBoardCard({ task, statusPending = false, ...props }: DraggableTaskBoardCardProps) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: task.id,
    type: TASK_DRAG_TYPE,
    disabled: statusPending,
  });

  return (
    <TaskBoardCard
      {...props}
      task={task}
      statusPending={statusPending}
      dragRef={ref}
      dragHandleRef={handleRef}
      isDragging={isDragging}
    />
  );
}

export function TaskBoardColumn({
  column,
  deletePending = false,
  pendingStatusTaskIds,
  disableDrag = false,
  onPreview,
  onEdit,
  onShare,
  onDelete,
  onStatusChange,
}: TaskBoardColumnProps) {
  /*
    Disable droppable registrations on mobile where a single column is visible
    and drag interactions are not available.
  */
  const { ref: columnRef, isDropTarget } = useDroppable({
    id: column.status,
    accept: TASK_DRAG_TYPE,
    disabled: disableDrag,
  });
  const [displayLimit, setDisplayLimit] = useState(INITIAL_TASK_LIMIT);
  const statusLabel = taskStatusLabels[column.status];
  const totalCount = column.tasks.length;
  const visibleTasks = column.tasks.slice(0, displayLimit);
  const hasMore = totalCount > displayLimit;
  const remainingCount = totalCount - displayLimit;

  return (
    <div
      ref={disableDrag ? undefined : columnRef}
      className={`task-board-column${!disableDrag && isDropTarget ? " task-board-column-drop-target" : ""}`}
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
          {visibleTasks.map((task) => {
            const statusPending = pendingStatusTaskIds?.has(task.id) ?? false;

            /*
              When drag is enabled (desktop), wire dnd-kit draggable wrapper; on mobile,
              render the card directly with its accessible Move menu and no drag handle.
            */
            if (task.canEdit && !disableDrag) {
              return (
                <DraggableTaskBoardCard
                  key={task.id}
                  task={task}
                  deletePending={deletePending}
                  statusPending={statusPending}
                  onPreview={onPreview}
                  onEdit={onEdit}
                  onShare={onShare}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                />
              );
            }

            if (task.canEdit && disableDrag) {
              return (
                <TaskBoardCard
                  key={task.id}
                  task={task}
                  deletePending={deletePending}
                  statusPending={statusPending}
                  onPreview={onPreview}
                  onEdit={onEdit}
                  onShare={onShare}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                />
              );
            }

            return (
              <TaskBoardCard
                key={task.id}
                task={task}
                deletePending={deletePending}
                onPreview={onPreview}
                onEdit={onEdit}
                onShare={onShare}
                onDelete={onDelete}
              />
            );
          })}

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
