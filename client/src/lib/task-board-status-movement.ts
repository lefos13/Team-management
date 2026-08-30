/*
  Keep board movement decisions pure so drag-and-drop and the accessible menu
  share identical edit-permission, cancellation, and same-column rules.
*/
import type { TaskDTO } from "@team-management/shared";

export type TaskBoardStatusMove = {
  task: TaskDTO;
  status: TaskDTO["status"];
};

export function resolveTaskBoardStatusMove(
  task: TaskDTO,
  targetStatus: TaskDTO["status"],
  options: { cancelled?: boolean } = {},
): TaskBoardStatusMove | null {
  if (options.cancelled || !task.canEdit || task.status === targetStatus) {
    return null;
  }

  return { task, status: targetStatus };
}
