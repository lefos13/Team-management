/*
TaskBoard provides the top-level horizontally scrollable Jira-style task board,
rendering five status columns without global board pagination.
*/
import type { TaskBoardColumn as TaskBoardColumnModel } from "../../lib/task-board-model";
import { TaskBoardColumn } from "./TaskBoardColumn";

export type TaskBoardProps = {
  columns: TaskBoardColumnModel[];
  deletePending?: boolean;
  onPreview: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onShare: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

export function TaskBoard({
  columns,
  deletePending = false,
  onPreview,
  onEdit,
  onShare,
  onDelete,
}: TaskBoardProps) {
  return (
    <div className="task-board-container" role="region" aria-label="Task board">
      <div className="task-board-columns">
        {columns.map((column) => (
          <TaskBoardColumn
            key={column.status}
            column={column}
            deletePending={deletePending}
            onPreview={onPreview}
            onEdit={onEdit}
            onShare={onShare}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
