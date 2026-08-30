/*
TaskBoard provides the Jira-style task board. On desktop (>=769px), it renders five
horizontally scrollable equal-height droppable columns. On mobile (<=768px), it renders
an accessible single-column status-tab interface showing live counts and one selected column.
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
import { Badge, Tabs } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { taskStatusLabels, taskStatusValues, type TaskDTO } from "@team-management/shared";
import { useState } from "react";

import { resolveTaskBoardStatusMove } from "../../lib/task-board-status-movement";
import type { TaskBoardColumn as TaskBoardColumnModel } from "../../lib/task-board-model";
import { TaskBoardColumn } from "./TaskBoardColumn";
export type TaskBoardProps = {
  columns: TaskBoardColumnModel[];
  deletePending?: boolean;
  pendingStatusTaskIds?: ReadonlySet<string>;
  isMobile?: boolean;
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
  isMobile: isMobileProp,
  onPreview,
  onEdit,
  onShare,
  onDelete,
  onStatusChange,
}: TaskBoardProps) {
  const isMobileQuery = useMediaQuery("(max-width: 48em)");
  const isMobile = isMobileProp ?? Boolean(isMobileQuery);
  const [selectedStatus, setSelectedStatus] = useState<TaskDTO["status"]>("todo");
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
    On mobile (<=768px / max-width: 48em), render an accessible status-tab interface
    showing one status column at a time to prevent horizontal overflow and eliminate
    multi-column drag interactions.
  */
  if (isMobile) {
    const activeColumn =
      columns.find((col) => col.status === selectedStatus) ??
      columns.find((col) => col.status === "todo") ??
      columns[0];

    return (
      <div className="task-board-mobile" role="region" aria-label="Task board">
        <Tabs
          value={selectedStatus}
          onChange={(val) => {
            if (isTaskStatus(val)) {
              setSelectedStatus(val);
            }
          }}
          className="task-board-mobile-tabs"
          variant="pills"
        >
          <Tabs.List className="task-board-mobile-tab-list" aria-label="Task board status tabs">
            {taskStatusValues.map((status) => {
              const count = columns.find((col) => col.status === status)?.tasks.length ?? 0;

              return (
                <Tabs.Tab
                  key={status}
                  value={status}
                  className="task-board-mobile-tab"
                  rightSection={
                    <Badge size="xs" variant="light" className="task-board-mobile-tab-count" data-count={count}>
                      {count}
                    </Badge>
                  }
                >
                  {taskStatusLabels[status]}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>

          {activeColumn ? (
            <Tabs.Panel value={activeColumn.status} className="task-board-mobile-panel" pt="xs">
              <TaskBoardColumn
                column={activeColumn}
                deletePending={deletePending}
                pendingStatusTaskIds={pendingStatusTaskIds}
                disableDrag={true}
                onPreview={onPreview}
                onEdit={onEdit}
                onShare={onShare}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            </Tabs.Panel>
          ) : null}
        </Tabs>
      </div>
    );
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
