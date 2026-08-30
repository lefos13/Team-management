/*
TaskBoard provides the top-level horizontally scrollable Jira-style task board,
rendering five status columns without global board pagination.
*/
import { Accessibility } from "@dnd-kit/dom";
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import { taskStatusLabels, taskStatusValues, type TaskDTO } from "@team-management/shared";

import { resolveTaskBoardStatusMove } from "../../lib/task-board-status-movement";
import type { TaskBoardColumn as TaskBoardColumnModel } from "../../lib/task-board-model";
import { TaskBoardColumn } from "./TaskBoardColumn";

export type TaskBoardProps = {
  columns: TaskBoardColumnModel[];
  deletePending?: boolean;
  pendingStatusTaskIds?: ReadonlySet<string>;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (task: TaskDTO, status: TaskDTO["status"]) => void;
};

function isTaskStatus(value: unknown): value is TaskDTO["status"] {
  return typeof value === "string" && (taskStatusValues as readonly string[]).includes(value);
}

function getStatusLabel(value: unknown) {
  return isTaskStatus(value) ? taskStatusLabels[value] : "another status column";
}

/*
  Configure dnd-kit's public accessibility plugin once so keyboard users get
  short instructions and announcements without relying on private internals.
*/
const taskBoardAccessibility = Accessibility.configure({
  id: "task-board",
  screenReaderInstructions: {
    draggable: "Press Space to pick up the task. Use Arrow keys to move between status columns. Press Space to drop or Escape to cancel.",
  },
  announcements: {
    dragstart: ({ operation }: DragStartEvent) => `Picked up task ${String(operation.source?.id ?? "")}. Use Arrow keys to choose a status column.`,
    dragover: ({ operation }: DragOverEvent) => `Task is over the ${getStatusLabel(operation.target?.id)} column.`,
    dragend: ({ operation, canceled }: DragEndEvent) => {
      if (canceled) {
        return "Task movement canceled.";
      }

      return operation.target
        ? `Task dropped in the ${getStatusLabel(operation.target.id)} column.`
        : "Task dropped outside a status column. No status change was made.";
    },
  },
});

export function TaskBoard({
  columns,
  deletePending = false,
  pendingStatusTaskIds,
  onPreview,
  onEdit,
  onShare,
  onDelete,
  onStatusChange,
}: TaskBoardProps) {
  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || !onStatusChange) {
      return;
    }

    const sourceId = event.operation.source?.id;
    const targetId = event.operation.target?.id;
    if (typeof sourceId !== "string" || !isTaskStatus(targetId)) {
      return;
    }

    const task = columns.flatMap((column) => column.tasks).find((candidate) => candidate.id === sourceId);
    const move = task ? resolveTaskBoardStatusMove(task, targetId, { cancelled: event.canceled }) : null;
    if (move) {
      onStatusChange(move.task, move.status);
    }
  }

  /*
    The provider owns pointer and keyboard sensors for the whole board; columns
    are status-only droppable targets, so no intra-column ordering is tracked.
  */
  return (
    <DragDropProvider
      sensors={[PointerSensor, KeyboardSensor]}
      plugins={(plugins) => plugins.map((plugin) => (plugin === Accessibility ? taskBoardAccessibility : plugin))}
      onDragEnd={handleDragEnd}
    >
      <div className="task-board-container" role="region" aria-label="Task board">
        <div className="task-board-columns">
          {columns.map((column) => (
            <TaskBoardColumn
              key={column.status}
              column={column}
              deletePending={deletePending}
              pendingStatusTaskIds={pendingStatusTaskIds}
              onPreview={onPreview}
              onEdit={onEdit}
              onShare={onShare}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}
