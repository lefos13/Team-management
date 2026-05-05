/* Enforce that tasks belong to valid project-member pairs so the calendar and workload views stay coherent. */
import type { ProjectPermission, TaskDTO, TaskImportResultDTO, TaskShareLinkDTO } from "@team-management/shared";
import {
  taskExportFiltersSchema,
  taskFiltersSchema,
  taskImportTemplateQuerySchema,
  taskInputSchema,
  taskStatusLabels,
  taskStatusSchema,
  taskStatusValues,
} from "@team-management/shared";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { badRequest, notFound } from "../lib/errors.js";
import { mapTask } from "../lib/mappers.js";
import {
  archiveTaskAttachments,
  buildAttachmentMetadata,
  deleteStorageKey,
  deleteTaskStorage,
  ensureAttachmentsRoot,
  fileExists,
  isPreviewableMimeType,
  maxTaskAttachmentBytes,
  readAttachmentFile,
  removeActiveAttachmentFiles,
  restoreTaskArchive,
  taskAttachmentStorageKey,
  writeAttachmentFile,
} from "../lib/task-attachments.js";
import { requireCurrentUser } from "../lib/request-user.js";
import {
  canEditAnyTask,
  canEditOwnTask,
  canPreviewAnyTask,
  canPreviewOwnTask,
  getAccessContext,
} from "../lib/project-access.js";

const taskIdParamsSchema = z.object({
  id: z.string().min(1),
});

const taskStatusUpdateSchema = z.object({
  status: taskStatusSchema,
});

const taskShareParamsSchema = z.object({
  token: z.string().trim().min(16),
});

const taskShareAttachmentParamsSchema = z.object({
  token: z.string().trim().min(16),
  attachmentId: z.string().min(1),
});

const taskAttachmentParamsSchema = z.object({
  taskId: z.string().min(1),
  attachmentId: z.string().min(1),
});

const projectTaskImportParamsSchema = z.object({
  projectId: z.string().min(1),
});

const taskExportHeaders = [
  "Title",
  "Parent Task Title",
  "Project",
  "Members",
  "Current stage",
  "Defect",
  "Start date",
  "Deadline",
  "Completed date",
  "Created at",
  "Updated at",
  "Description",
  "Notes",
] as const;

const taskImportHeaders = ["Title", "Parent Task Title", "Member Emails", "Deadline", "Description", "Notes", "Status", "Defect", "Start Date"] as const;
const legacyTaskImportHeaders = ["Title", "Member Email", "Deadline", "Description", "Status", "Defect", "Start Date"] as const;
const legacyMultiMemberTaskImportHeaders = ["Title", "Member Emails", "Deadline", "Description", "Status", "Defect", "Start Date"] as const;
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);
const statusAliasMap = new Map<string, (typeof taskStatusValues)[number]>([
  ["todo", "todo"],
  ["to do", "todo"],
  ["in_progress", "in_progress"],
  ["in progress", "in_progress"],
  ["blocked", "blocked"],
  ["review", "review_testing"],
  ["testing", "review_testing"],
  ["review/testing", "review_testing"],
  ["review testing", "review_testing"],
  ["review_testing", "review_testing"],
  ["done", "done"],
  ["complete", "done"],
  ["completed", "done"],
]);

type TaskImportFile = {
  filename: string;
  buffer: Buffer;
};

type ParsedImportTask = {
  row: number;
  title: string;
  parentTaskTitle: string | null;
  description: string;
  notes: string;
  status: (typeof taskStatusValues)[number];
  isDefect: boolean;
  startDate: Date | null;
  deadline: Date | null;
  assigneeIds: string[];
  memberEmails: string[];
};

type ExportTask = Prisma.TaskGetPayload<{
  include: {
    project: { select: { name: true } };
    assignee: { select: { name: true } };
    parentTask: { select: { title: true; parentTaskId: true } };
    taskAssignees: {
      select: {
        teamMemberId: true;
        teamMember: { select: { name: true; email: true } };
      };
    };
  };
}>;

const taskDetailsInclude = Prisma.validator<Prisma.TaskInclude>()({
  project: {
    select: { name: true },
  },
  assignee: {
    select: { name: true },
  },
  parentTask: {
    select: { title: true },
  },
  taskAssignees: {
    select: {
      teamMemberId: true,
      teamMember: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  attachments: {
    orderBy: [{ createdAt: "asc" }, { filename: "asc" }],
  },
  archive: true,
});

type TaskDetails = Prisma.TaskGetPayload<{
  include: typeof taskDetailsInclude;
}>;

/*
Keep the export format centralized beside the task query so API fields, workbook
columns, and the project instruction about template maintenance stay aligned.
*/

function normalizeOptionalText(value?: string): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function normalizeOptionalDate(value?: string | null): Date | null {
  return value && value !== "" ? new Date(value) : null;
}

function normalizeOptionalId(value?: string | null): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeImportText(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "text" in value) {
    return String(value.text ?? "").trim();
  }

  return String(value ?? "").trim();
}

function hasXlsxSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTaskShareUrl(token: string) {
  const clientOrigin = new URL(getConfig().CLIENT_ORIGIN).toString().replace(/\/$/, "");
  return `${clientOrigin}/share/tasks/${encodeURIComponent(token)}`;
}

/*
Normalize the new multi-assignee payload while still accepting the legacy
single-assignee field used by older clients and existing tests.
*/
function normalizeAssigneeIds(input: { assigneeId?: string; assigneeIds?: string[] }): string[] {
  const source = input.assigneeIds && input.assigneeIds.length > 0 ? input.assigneeIds : input.assigneeId ? [input.assigneeId] : [];
  return Array.from(new Set(source));
}

async function ensureAssignable(userId: string, projectId: string, assigneeIds: string[]): Promise<void> {
  const uniqueAssigneeIds = Array.from(new Set(assigneeIds));

  if (uniqueAssigneeIds.length === 0) {
    throw badRequest("At least one assignee is required.");
  }

  const [project, members, membershipCount] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId },
    }),
    prisma.teamMember.findMany({
      where: { id: { in: uniqueAssigneeIds }, userId },
    }),
    prisma.projectMember.count({
      where: {
        projectId,
        teamMemberId: { in: uniqueAssigneeIds },
      },
    }),
  ]);

  if (!project) {
    throw notFound("Project");
  }

  if (members.length !== uniqueAssigneeIds.length) {
    throw notFound("Member");
  }

  if (members.some((member) => !member.active)) {
    throw badRequest("Tasks can only be assigned to active team members.");
  }

  if (membershipCount !== uniqueAssigneeIds.length) {
    throw badRequest("Every selected team member must be assigned to that project.");
  }
}

/*
Keep the hierarchy intentionally one level deep. The parent must be an existing
top-level task in the same project, and tasks that already own subtasks cannot
be moved under another parent because that would create nested grandchildren.
*/
async function validateParentTask(
  ownerUserId: string,
  projectId: string,
  parentTaskId: string | null,
  currentTaskId?: string,
): Promise<string | null> {
  if (!parentTaskId) {
    return null;
  }

  if (currentTaskId && parentTaskId === currentTaskId) {
    throw badRequest("A task cannot be its own parent.");
  }

  const [parentTask, childCount] = await Promise.all([
    prisma.task.findFirst({
      where: { id: parentTaskId, userId: ownerUserId },
      select: { id: true, projectId: true, parentTaskId: true },
    }),
    currentTaskId
      ? prisma.task.count({
          where: { parentTaskId: currentTaskId, userId: ownerUserId },
        })
      : Promise.resolve(0),
  ]);

  if (!parentTask) {
    throw notFound("Parent task");
  }

  if (parentTask.projectId !== projectId) {
    throw badRequest("Parent task must belong to the same project.");
  }

  if (parentTask.parentTaskId) {
    throw badRequest("Subtasks cannot be used as parent tasks.");
  }

  if (childCount > 0) {
    throw badRequest("A task with subtasks cannot become a subtask.");
  }

  return parentTask.id;
}

function buildTaskWhere(filters: z.infer<typeof taskFiltersSchema>) {
  return {
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.assigneeId ? { taskAssignees: { some: { teamMemberId: filters.assigneeId } } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.isDefect === undefined ? {} : { isDefect: filters.isDefect }),
    ...((filters.dueFrom || filters.dueTo)
      ? {
          deadline: {
            ...(filters.dueFrom ? { gte: new Date(filters.dueFrom) } : {}),
            ...(filters.dueTo ? { lte: new Date(filters.dueTo) } : {}),
          },
        }
      : {}),
  };
}

function buildCompletedAtUpdate(nextStatus: string, currentStatus?: string, currentCompletedAt?: Date | null) {
  if (nextStatus === "done") {
    return currentStatus === "done" && currentCompletedAt ? currentCompletedAt : new Date();
  }

  return null;
}

function buildCompletedAtUpdateAt(
  nextStatus: string,
  completedAt: Date,
  currentStatus?: string,
  currentCompletedAt?: Date | null,
) {
  if (nextStatus === "done") {
    return currentStatus === "done" && currentCompletedAt ? currentCompletedAt : completedAt;
  }

  return null;
}

function formatWorkbookDate(value: Date | null): string {
  return value ? value.toISOString() : "";
}

function formatTaskStatus(status: string): string {
  return status in taskStatusLabels ? taskStatusLabels[status as keyof typeof taskStatusLabels] : status.replace("_", " ");
}

function setDateTime(date: Date, hour: number): Date {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function dateFromExcelSerial(value: number): Date {
  const excelEpoch = Date.UTC(1899, 11, 30);
  const wholeDays = Math.trunc(value);
  const dayFraction = value - wholeDays;
  return new Date(excelEpoch + wholeDays * 86_400_000 + Math.round(dayFraction * 86_400_000));
}

function parseImportDate(value: unknown, defaultHour: number): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0 && value.getMilliseconds() === 0
      ? setDateTime(value, defaultHour)
      : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = dateFromExcelSerial(value);
    return value % 1 === 0 ? setDateTime(parsed, defaultHour) : parsed;
  }

  const text = normalizeImportText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day, defaultHour, 0, 0, 0);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseImportStatus(value: unknown): (typeof taskStatusValues)[number] | null {
  const text = normalizeImportText(value).toLowerCase().replace(/-/g, "_").replace(/\s+/g, " ");

  if (!text) {
    return "todo";
  }

  return statusAliasMap.get(text) ?? null;
}

function parseImportDefect(value: unknown): boolean | null {
  const text = normalizeImportText(value).toLowerCase();

  if (!text) {
    return false;
  }

  if (["yes", "true", "y", "1"].includes(text)) {
    return true;
  }

  if (["no", "false", "n", "0"].includes(text)) {
    return false;
  }

  return null;
}

function duplicateKey(projectId: string, parentTaskId: string | null, title: string, assigneeIds: string[], deadline: Date | null): string {
  return `${projectId}|${parentTaskId ?? ""}|${title.trim().toLowerCase()}|${[...assigneeIds].sort().join(",")}|${deadline ? deadline.getTime() : "none"}`;
}

function formatAssigneeNames(task: ExportTask): string {
  const names = [...task.taskAssignees]
    .sort((left, right) => {
      if (left.teamMemberId === task.assigneeId) {
        return -1;
      }

      if (right.teamMemberId === task.assigneeId) {
        return 1;
      }

      return left.teamMember.name.localeCompare(right.teamMember.name);
    })
    .map((assignment) => assignment.teamMember.name);
  return names.length > 0 ? names.join(", ") : "Unassigned";
}

/*
Import files keep the member column in one cell, so split common spreadsheet
separators and normalize emails before project-member validation.
*/
function parseMemberEmailsCell(value: unknown): string[] {
  return normalizeImportText(value)
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTaskTitleKey(value: string): string {
  return value.trim().toLowerCase();
}

async function validateTaskImportFile(request: FastifyRequest): Promise<void> {
  const file = await request.file();

  if (!file) {
    throw badRequest("Upload one .xlsx file before importing tasks.");
  }

  if (!file.filename.toLowerCase().endsWith(".xlsx")) {
    throw badRequest("Only .xlsx import files are supported.");
  }

  if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
    throw badRequest("Only Excel .xlsx import files are supported.");
  }

  const buffer = await file.toBuffer();

  if (file.file.truncated || buffer.length > 5 * 1024 * 1024) {
    throw badRequest("Import files must be 5 MB or smaller.");
  }

  if (!hasXlsxSignature(buffer)) {
    throw badRequest("The uploaded file is not a valid .xlsx workbook.");
  }

  (request as FastifyRequest & { taskImportFile: TaskImportFile }).taskImportFile = {
    filename: file.filename,
    buffer,
  };
}

/*
Attachment lifecycle depends on task status: active tasks keep original files
for preview, while done tasks swap those originals for one ZIP archive until
the task is reopened.
*/
async function prepareTaskArchive(task: Pick<TaskDetails, "id" | "attachments" | "archive">) {
  if (task.attachments.length === 0) {
    return null;
  }

  if (task.archive) {
    return {
      storageKey: task.archive.storageKey,
      sizeBytes: task.archive.sizeBytes,
      generatedAt: task.archive.generatedAt,
    };
  }

  return archiveTaskAttachments(
    task.id,
    task.attachments.map((attachment) => attachment.storageKey),
  );
}

async function finalizeTaskArchive(task: Pick<TaskDetails, "attachments">) {
  await removeActiveAttachmentFiles(task.attachments.map((attachment) => attachment.storageKey));
}

async function prepareTaskRestore(task: Pick<TaskDetails, "id" | "archive">) {
  if (!task.archive) {
    return;
  }

  const archiveExists = await fileExists(task.archive.storageKey);
  if (!archiveExists) {
    throw badRequest("The task archive is missing and cannot be restored.");
  }

  await restoreTaskArchive(task.id, task.archive.storageKey);
}

async function finalizeTaskRestore(task: Pick<TaskDetails, "archive">) {
  if (!task.archive) {
    return;
  }

  await deleteStorageKey(task.archive.storageKey);
}

async function getTaskForUser(currentUserId: string, taskId: string, requireEdit = false) {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: taskDetailsInclude,
  });

  if (!task) {
    throw notFound("Task");
  }

  const access = await getAccessContext(task.projectId, currentUserId);
  const isOwnTask = Boolean(access.teamMemberId && task.taskAssignees.some((assignment) => assignment.teamMemberId === access.teamMemberId));
  if (requireEdit) {
    if (access.isMasterOwner || canEditAnyTask(access.permission) || (canEditOwnTask(access.permission) && isOwnTask)) {
      return task;
    }
    throw badRequest("You do not have permission to edit this task.");
  }
  if (access.isMasterOwner || canPreviewAnyTask(access.permission) || (canPreviewOwnTask(access.permission) && isOwnTask)) {
    return task;
  }
  throw notFound("Task");
}

async function getSharedTaskByToken(token: string) {
  const shareLink = await prisma.taskShareLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: {
      task: {
        include: taskDetailsInclude,
      },
    },
  });

  if (!shareLink || shareLink.revokedAt) {
    throw notFound("Task share link");
  }

  return shareLink.task;
}

function canEditTaskForAccess(
  task: Pick<TaskDetails, "taskAssignees">,
  access: { isMasterOwner: boolean; permission: ProjectPermission; teamMemberId: string | null },
) {
  const isOwnTask = Boolean(access.teamMemberId && task.taskAssignees.some((assignment) => assignment.teamMemberId === access.teamMemberId));
  return access.isMasterOwner || canEditAnyTask(access.permission) || (canEditOwnTask(access.permission) && isOwnTask);
}

function canManageTaskAssignees(access: { isMasterOwner: boolean; permission: ProjectPermission }) {
  return access.isMasterOwner || canEditAnyTask(access.permission);
}

function haveSameAssignees(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

async function buildTasksWorkbook(tasks: ExportTask[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Management";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  worksheet.mergeCells("A1:M1");
  worksheet.getCell("A1").value = "Task Current Stage Export";
  worksheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  worksheet.getCell("A1").alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 28;

  worksheet.addRow([]);
  worksheet.addRow(["Generated at", new Date().toISOString(), "Total tasks", tasks.length]);
  worksheet.addRow(["Done tasks", tasks.filter((task) => task.status === "done").length, "Defects", tasks.filter((task) => task.isDefect).length]);
  worksheet.addRow([]);
  worksheet.addRow([...taskExportHeaders]);

  const headerRow = worksheet.getRow(6);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  headerRow.alignment = { vertical: "middle" };

  /*
  Export top-level tasks followed by their direct subtasks so spreadsheet users
  see the same parent-child hierarchy that the task page renders.
  */
  const tasksByParent = new Map<string | null, ExportTask[]>();
  for (const task of tasks) {
    const parentId = task.parentTaskId ?? null;
    tasksByParent.set(parentId, [...(tasksByParent.get(parentId) ?? []), task]);
  }

  const orderedTasks = (tasksByParent.get(null) ?? []).flatMap((task) => [
    task,
    ...(tasksByParent.get(task.id) ?? []),
  ]);
  const orphanSubtasks = tasks.filter((task) => task.parentTaskId && !tasks.some((candidate) => candidate.id === task.parentTaskId));

  for (const task of [...orderedTasks, ...orphanSubtasks]) {
    worksheet.addRow([
      task.parentTaskId ? `  ${task.title}` : task.title,
      task.parentTask?.title ?? "",
      task.project.name,
      formatAssigneeNames(task),
      formatTaskStatus(task.status),
      task.isDefect ? "Yes" : "No",
      formatWorkbookDate(task.startDate),
      formatWorkbookDate(task.deadline),
      formatWorkbookDate(task.completedAt),
      formatWorkbookDate(task.createdAt),
      formatWorkbookDate(task.updatedAt),
      task.description ?? "",
      task.notes ?? "",
    ]);
  }

  worksheet.columns = [
    { width: 34 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 16 },
    { width: 10 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 50 },
    { width: 50 },
  ];

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "top", wrapText: rowNumber > 6 };
    });
  });

  return workbook.xlsx.writeBuffer();
}

type ImportProjectMember = {
  id: string;
  name: string;
  email: string;
};

async function getProjectForImport(currentUserId: string, projectId: string) {
  const access = await getAccessContext(projectId, currentUserId);
  if (!access.isMasterOwner && !canEditAnyTask(access.permission)) {
    throw badRequest("You do not have permission to import tasks for this project.");
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: access.ownerUserId },
    include: {
      projectMembers: {
        include: {
          teamMember: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw notFound("Project");
  }

  return {
    ownerUserId: access.ownerUserId,
    ...project,
    assignableMembers: project.projectMembers
      .map((membership) => membership.teamMember)
      .filter((member): member is ImportProjectMember & { active: true } => member.active),
  };
}

async function buildTaskImportTemplateWorkbook(
  project: Awaited<ReturnType<typeof getProjectForImport>>,
  variant: "blank" | "sample",
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Management";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("Instructions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  instructions.addRows([
    ["Team Management Task Import"],
    ["Project", project.name],
    ["Required columns", "Title, Member Emails"],
    ["Optional columns", "Parent Task Title, Deadline, Description, Notes, Status, Defect, Start Date"],
    ["Statuses", "todo, in_progress, blocked, review_testing, done"],
    ["Defect values", "yes/no, true/false, or blank"],
    ["Date-only rule", "Start Date uses 09:00; Deadline uses 17:00."],
    ["Multiple members", "Separate member emails with commas or semicolons."],
    ["Subtasks", "Parent Task Title must match an existing top-level task or an earlier row in this workbook."],
    ["Duplicate rule", "Existing tasks with the same title, member set, and deadline are skipped."],
  ]);
  instructions.getColumn(1).width = 24;
  instructions.getColumn(2).width = 78;
  instructions.getRow(1).font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  instructions.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };

  const tasks = workbook.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  tasks.addRow([...taskImportHeaders]);
  tasks.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  tasks.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  tasks.columns = [
    { width: 34 },
    { width: 34 },
    { width: 32 },
    { width: 22 },
    { width: 44 },
    { width: 44 },
    { width: 18 },
    { width: 12 },
    { width: 22 },
  ];

  if (variant === "sample" && project.assignableMembers[0]) {
    const sampleMember = project.assignableMembers[0];
    const secondSampleMember = project.assignableMembers[1];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    tasks.addRow([
      "Review project plan",
      "",
      secondSampleMember ? `${sampleMember.email}, ${secondSampleMember.email}` : sampleMember.email,
      tomorrow,
      "Confirm scope, owner, and next actions.",
      "Capture reviewer comments here.",
      "todo",
      "no",
      "",
    ]);
  }

  for (let row = 2; row <= 201; row += 1) {
    tasks.getCell(row, 3).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`'Allowed Members'!$C$2:$C$${Math.max(project.assignableMembers.length + 1, 2)}`],
    };
    tasks.getCell(row, 7).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"todo,in_progress,blocked,review_testing,done"'],
    };
    tasks.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"yes,no,true,false"'],
    };
  }

  const members = workbook.addWorksheet("Allowed Members", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  members.addRow(["Name", "Role", "Email"]);
  members.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  members.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  for (const member of project.assignableMembers) {
    members.addRow([member.name, "", member.email]);
  }
  members.columns = [{ width: 28 }, { width: 18 }, { width: 34 }];

  return workbook.xlsx.writeBuffer();
}

async function parseTaskImportWorkbook(userId: string, projectId: string, buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.getWorksheet("Tasks");

  if (!worksheet) {
    throw badRequest("Import workbook must include a Tasks sheet.");
  }

  const headers = taskImportHeaders.map((_, index) => normalizeHeader(worksheet.getCell(1, index + 1).value));
  const hasCurrentHeaders = headers.every((header, index) => header === taskImportHeaders[index]);
  const legacyHeaders = legacyTaskImportHeaders.map((_, index) => normalizeHeader(worksheet.getCell(1, index + 1).value));
  const hasLegacyHeaders = legacyHeaders.every((header, index) => header === legacyTaskImportHeaders[index]);
  const hasLegacyMultiMemberHeaders = legacyHeaders.every((header, index) => header === legacyMultiMemberTaskImportHeaders[index]);

  if (!hasCurrentHeaders && !hasLegacyHeaders && !hasLegacyMultiMemberHeaders) {
    throw badRequest("Import workbook headers do not match the required template.", {
      expectedHeaders: taskImportHeaders,
      receivedHeaders: hasCurrentHeaders ? headers : legacyHeaders,
    });
  }

  const project = await getProjectForImport(userId, projectId);
  const membersByEmail = new Map(project.assignableMembers.map((member) => [member.email.toLowerCase(), member]));
  const existingTopLevelTasks = await prisma.task.findMany({
    where: {
      userId: project.ownerUserId,
      projectId,
      parentTaskId: null,
    },
    select: { id: true, title: true },
  });
  const existingParentIdsByTitle = new Map<string, string[]>();
  for (const task of existingTopLevelTasks) {
    const key = normalizeTaskTitleKey(task.title);
    existingParentIdsByTitle.set(key, [...(existingParentIdsByTitle.get(key) ?? []), task.id]);
  }
  const rejectedRows: TaskImportResultDTO["rejectedRows"] = [];
  const parsedRows: ParsedImportTask[] = [];
  const workbookParentRowsByTitle = new Map<string, number[]>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const title = normalizeImportText(row.getCell(1).value);
    const parentTaskTitle = hasCurrentHeaders ? normalizeImportText(row.getCell(2).value) : "";
    const memberOffset = hasCurrentHeaders ? 1 : 0;
    const memberEmails = parseMemberEmailsCell(row.getCell(2 + memberOffset).value);
    const deadline = parseImportDate(row.getCell(3 + memberOffset).value, 17);
    const description = normalizeImportText(row.getCell(4 + memberOffset).value);
    const notes = hasCurrentHeaders ? normalizeImportText(row.getCell(5 + memberOffset).value) : "";
    const status = parseImportStatus(row.getCell((hasCurrentHeaders ? 6 : 5) + memberOffset).value);
    const isDefect = parseImportDefect(row.getCell((hasCurrentHeaders ? 7 : 6) + memberOffset).value);
    const startDate = parseImportDate(row.getCell((hasCurrentHeaders ? 8 : 7) + memberOffset).value, 9);

    if (!title && !parentTaskTitle && memberEmails.length === 0 && !deadline && !description && !notes && !normalizeImportText(row.getCell((hasCurrentHeaders ? 6 : 5) + memberOffset).value)) {
      continue;
    }

    const rowErrors: string[] = [];

    if (!title) {
      rowErrors.push("Title is required.");
    }

    if (memberEmails.length === 0) {
      rowErrors.push("Member Emails is required.");
    }

    const uniqueMemberEmails = Array.from(new Set(memberEmails));
    const members = uniqueMemberEmails.map((email) => membersByEmail.get(email));
    const hasMissingMember = uniqueMemberEmails.some((_, index) => !members[index]);

    if (hasMissingMember) {
      rowErrors.push("Member Emails must belong to active members assigned to the selected project.");
    }

    if (!status) {
      rowErrors.push("Status must be one of todo, in_progress, blocked, review_testing, or done.");
    }

    if (isDefect === null) {
      rowErrors.push("Defect must be yes/no, true/false, or blank.");
    }

    if (startDate && deadline && startDate > deadline) {
      rowErrors.push("Start Date must be before Deadline.");
    }

    if (parentTaskTitle) {
      const parentKey = normalizeTaskTitleKey(parentTaskTitle);
      const existingMatches = existingParentIdsByTitle.get(parentKey) ?? [];
      const workbookMatches = workbookParentRowsByTitle.get(parentKey) ?? [];

      if (existingMatches.length + workbookMatches.length === 0) {
        rowErrors.push("Parent Task Title must match an existing top-level task or an earlier top-level row.");
      }

      if (existingMatches.length > 1 || (existingMatches.length === 0 && workbookMatches.length > 1)) {
        rowErrors.push("Parent Task Title is ambiguous. Use a unique top-level task title.");
      }
    }

    if (rowErrors.length > 0 || members.some((member) => !member) || !deadline || !status || isDefect === null) {
      rejectedRows.push({
        row: rowNumber,
        title: title || undefined,
        memberEmail: uniqueMemberEmails.join(", ") || undefined,
        reason: rowErrors.join(" "),
      });
      continue;
    }

    parsedRows.push({
      row: rowNumber,
      title,
      parentTaskTitle: parentTaskTitle || null,
      description,
      notes,
      status,
      isDefect,
      startDate,
      deadline,
      assigneeIds: members.map((member) => member!.id),
      memberEmails: uniqueMemberEmails,
    });

    if (!parentTaskTitle) {
      const titleKey = normalizeTaskTitleKey(title);
      workbookParentRowsByTitle.set(titleKey, [...(workbookParentRowsByTitle.get(titleKey) ?? []), rowNumber]);
    }
  }

  if (rejectedRows.length > 0) {
    throw badRequest("Import file has invalid task rows. No tasks were imported.", {
      rejectedRows,
    });
  }

  return parsedRows;
}

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  app.get(
    "/task-shares/:token",
    {
      schema: {
        params: taskShareParamsSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const params = taskShareParamsSchema.parse(request.params);
      const task = await getSharedTaskByToken(params.token);

      return mapTask(task, { canEdit: false, canManageAssignees: false });
    },
  );

  app.get(
    "/task-shares/:token/attachments/:attachmentId/preview",
    {
      schema: {
        params: taskShareAttachmentParamsSchema,
      },
    },
    async (request, reply) => {
      const params = taskShareAttachmentParamsSchema.parse(request.params);
      const task = await getSharedTaskByToken(params.token);
      const attachment = task.attachments.find((candidate) => candidate.id === params.attachmentId);

      if (!attachment) {
        throw notFound("Attachment");
      }

      if (task.status === "done") {
        throw badRequest("Preview is disabled after a task is done.");
      }

      if (!isPreviewableMimeType(attachment.mimeType)) {
        throw badRequest("This attachment type cannot be previewed in the browser.");
      }

      const file = await readAttachmentFile(attachment.storageKey);
      return reply.header("Content-Type", attachment.mimeType).send(file);
    },
  );

  app.get(
    "/tasks",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: taskFiltersSchema,
      },
    },
    async (request): Promise<TaskDTO[]> => {
      const user = requireCurrentUser(request);
      const query = taskFiltersSchema.parse(request.query);
      const accesses = await prisma.projectAccess.findMany({
        where: { userId: user.id, status: "active" },
        select: { projectId: true, permission: true, teamMemberId: true },
      });
      const allProjectIds = new Set<string>();
      const ownTaskScopes: Array<{ projectId: string; teamMemberId: string }> = [];
      for (const access of accesses) {
        if (canPreviewAnyTask(access.permission) || canEditAnyTask(access.permission)) {
          allProjectIds.add(access.projectId);
          continue;
        }
        if (access.teamMemberId && canPreviewOwnTask(access.permission)) {
          ownTaskScopes.push({ projectId: access.projectId, teamMemberId: access.teamMemberId });
        }
      }
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { userId: user.id },
            ...(allProjectIds.size > 0 ? [{ projectId: { in: Array.from(allProjectIds) } }] : []),
            ...ownTaskScopes.map((scope) => ({
              projectId: scope.projectId,
              taskAssignees: { some: { teamMemberId: scope.teamMemberId } },
            })),
          ],
          ...buildTaskWhere(query),
        },
        include: taskDetailsInclude,
        orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      });

      /*
      List responses carry per-task edit capability so invited users can still
      preview allowed work while the client hides controls the API would reject.
      */
      const accessByProjectId = new Map(accesses.map((access) => [access.projectId, access]));
      return tasks.map((task) => {
        const access = accessByProjectId.get(task.projectId);
        const sharedAccess = access ? { ...access, isMasterOwner: false } : null;
        return mapTask(task, {
          canEdit: task.userId === user.id || (sharedAccess ? canEditTaskForAccess(task, sharedAccess) : false),
          canManageAssignees: task.userId === user.id || (sharedAccess ? canManageTaskAssignees(sharedAccess) : false),
        });
      });
    },
  );

  app.get(
    "/tasks/export",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: taskExportFiltersSchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const query = taskExportFiltersSchema.parse(request.query);
      const accesses = await prisma.projectAccess.findMany({
        where: { userId: user.id, status: "active" },
        select: { projectId: true, permission: true },
      });
      const exportedSharedProjects = accesses.filter((access) => canPreviewAnyTask(access.permission)).map((access) => access.projectId);
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { userId: user.id },
            ...(exportedSharedProjects.length > 0 ? [{ projectId: { in: exportedSharedProjects } }] : []),
          ],
          ...buildTaskWhere(query),
        },
        include: {
          project: {
            select: { name: true },
          },
          assignee: {
            select: { name: true },
          },
          parentTask: {
            select: { title: true, parentTaskId: true },
          },
          taskAssignees: {
            select: {
              teamMemberId: true,
              teamMember: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ project: { name: "asc" } }, { status: "asc" }, { deadline: { sort: "asc", nulls: "last" } }],
      });
      const buffer = await buildTasksWorkbook(tasks);

      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="tasks-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
        .send(Buffer.from(buffer));
    },
  );

  app.get(
    "/projects/:projectId/tasks/import-template",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: projectTaskImportParamsSchema,
        querystring: taskImportTemplateQuerySchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = projectTaskImportParamsSchema.parse(request.params);
      const query = taskImportTemplateQuerySchema.parse(request.query);
      const project = await getProjectForImport(user.id, params.projectId);
      const buffer = await buildTaskImportTemplateWorkbook(project, query.variant);

      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(
          "Content-Disposition",
          `attachment; filename="task-import-${query.variant}-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx"`,
        )
        .send(Buffer.from(buffer));
    },
  );

  app.post(
    "/projects/:projectId/tasks/import",
    {
      preHandler: [fastify.authenticate, validateTaskImportFile],
      schema: {
        params: projectTaskImportParamsSchema,
      },
    },
    async (request): Promise<TaskImportResultDTO> => {
      const user = requireCurrentUser(request);
      const params = projectTaskImportParamsSchema.parse(request.params);
      const project = await getProjectForImport(user.id, params.projectId);
      const importFile = (request as FastifyRequest & { taskImportFile: TaskImportFile }).taskImportFile;
      const parsedRows = await parseTaskImportWorkbook(user.id, params.projectId, importFile.buffer);
      const existingTasks = await prisma.task.findMany({
        where: {
          userId: project.ownerUserId,
          projectId: params.projectId,
        },
        select: {
          id: true,
          title: true,
          assigneeId: true,
          parentTaskId: true,
          deadline: true,
          taskAssignees: {
            select: { teamMemberId: true },
          },
        },
      });
      const seenKeys = new Set(
        existingTasks.map((task) =>
          duplicateKey(
            params.projectId,
            task.parentTaskId,
            task.title,
            task.taskAssignees.length > 0
              ? task.taskAssignees.map((assignment) => assignment.teamMemberId)
              : [],
            task.deadline,
          ),
        ),
      );
      const skippedRows: TaskImportResultDTO["skippedRows"] = [];
      const createRows: ParsedImportTask[] = [];
      const existingParentIdsByTitle = new Map<string, string[]>();
      for (const task of existingTasks.filter((task) => !task.parentTaskId)) {
        const titleKey = normalizeTaskTitleKey(task.title);
        existingParentIdsByTitle.set(titleKey, [...(existingParentIdsByTitle.get(titleKey) ?? []), task.id]);
      }
      const pendingParentRowByTitle = new Map<string, ParsedImportTask>();

      for (const row of parsedRows) {
        const parentTaskId = row.parentTaskTitle
          ? existingParentIdsByTitle.get(normalizeTaskTitleKey(row.parentTaskTitle))?.[0] ?? null
          : null;
        const duplicateParentId = row.parentTaskTitle ? parentTaskId ?? `row:${row.parentTaskTitle}` : null;
        const key = duplicateKey(params.projectId, duplicateParentId, row.title, row.assigneeIds, row.deadline);

        if (seenKeys.has(key)) {
          skippedRows.push({
            row: row.row,
            title: row.title,
            memberEmail: row.memberEmails.join(", "),
            reason: "A task with the same title, member set, and deadline already exists in this project.",
          });
          continue;
        }

        seenKeys.add(key);
        createRows.push(row);

        if (!row.parentTaskTitle) {
          pendingParentRowByTitle.set(normalizeTaskTitleKey(row.title), row);
        }
      }

      if (createRows.length > 0) {
        /*
        Imported rows are created sequentially inside one transaction because a
        subtask may refer to a parent created by an earlier row in the workbook.
        */
        await prisma.$transaction(async (tx) => {
          const createdParentIdsByRow = new Map<number, string>();

          for (const row of createRows) {
            const parentTaskId = row.parentTaskTitle
              ? existingParentIdsByTitle.get(normalizeTaskTitleKey(row.parentTaskTitle))?.[0] ??
                createdParentIdsByRow.get(pendingParentRowByTitle.get(normalizeTaskTitleKey(row.parentTaskTitle))?.row ?? 0) ??
                null
              : null;

            const createdTask = await tx.task.create({
              data: {
                userId: project.ownerUserId,
                title: row.title,
                description: normalizeOptionalText(row.description),
                notes: normalizeOptionalText(row.notes),
                status: row.status,
                isDefect: row.isDefect,
                deadline: row.deadline,
                startDate: row.startDate,
                completedAt: buildCompletedAtUpdate(row.status),
                projectId: params.projectId,
                assigneeId: row.assigneeIds[0],
                parentTaskId,
                taskAssignees: {
                  createMany: {
                    data: row.assigneeIds.map((teamMemberId) => ({ teamMemberId })),
                    skipDuplicates: true,
                  },
                },
              },
              select: { id: true },
            });

            if (!row.parentTaskTitle) {
              createdParentIdsByRow.set(row.row, createdTask.id);
            }
          }
        });
      }

      return {
        inserted: createRows.length,
        skipped: skippedRows.length,
        rejected: 0,
        skippedRows,
        rejectedRows: [],
      };
    },
  );

  app.post(
    "/tasks",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: taskInputSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const body = taskInputSchema.parse(request.body);
      const access = await getAccessContext(body.projectId, user.id);
      if (!access.isMasterOwner && !canEditAnyTask(access.permission)) {
        throw badRequest("You do not have permission to create tasks for this project.");
      }
      const assigneeIds = normalizeAssigneeIds(body);
      const parentTaskId = await validateParentTask(access.ownerUserId, body.projectId, normalizeOptionalId(body.parentTaskId));
      await ensureAssignable(access.ownerUserId, body.projectId, assigneeIds);

      const task = await prisma.task.create({
        data: {
          userId: access.ownerUserId,
          title: body.title,
          description: normalizeOptionalText(body.description),
          notes: normalizeOptionalText(body.notes),
          status: body.status,
          isDefect: body.isDefect,
          deadline: normalizeOptionalDate(body.deadline),
          startDate: normalizeOptionalDate(body.startDate),
          completedAt: buildCompletedAtUpdate(body.status),
          projectId: body.projectId,
          assigneeId: assigneeIds[0],
          parentTaskId,
          taskAssignees: {
            createMany: {
              data: assigneeIds.map((teamMemberId) => ({ teamMemberId })),
              skipDuplicates: true,
            },
          },
        },
        include: taskDetailsInclude,
      });

      return mapTask(task);
    },
  );

  app.put(
    "/tasks/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
        body: taskInputSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      const body = taskInputSchema.parse(request.body);
      const assigneeIds = normalizeAssigneeIds(body);
      const existingTask = await getTaskForUser(user.id, params.id, true);
      const access = await getAccessContext(existingTask.projectId, user.id);
      const existingAssigneeIds = existingTask.taskAssignees.length > 0
        ? existingTask.taskAssignees.map((assignment) => assignment.teamMemberId)
        : existingTask.assigneeId ? [existingTask.assigneeId] : [];
      if (!canManageTaskAssignees(access) && !haveSameAssignees(assigneeIds, existingAssigneeIds)) {
        throw badRequest("You do not have permission to change task assignees.");
      }
      const parentTaskId = await validateParentTask(access.ownerUserId, body.projectId, normalizeOptionalId(body.parentTaskId), params.id);
      await ensureAssignable(access.ownerUserId, body.projectId, assigneeIds);
      const archivePreparation = body.status === "done" && existingTask.status !== "done" ? await prepareTaskArchive(existingTask) : null;
      if (body.status !== "done" && existingTask.status === "done") {
        await prepareTaskRestore(existingTask);
      }
      const childTasks = body.status === "done" && !existingTask.parentTaskId
        ? await prisma.task.findMany({
            where: {
              userId: access.ownerUserId,
              parentTaskId: params.id,
              status: { not: "done" },
            },
            include: taskDetailsInclude,
          })
        : [];
      const childArchives = await Promise.all(childTasks.map((task) => prepareTaskArchive(task)));

      /*
      Full task edits can also complete a parent, so keep the same cascade rule
      used by the status-only endpoint inside the assignment replacement transaction.
      */
      const completedAt = new Date();
      const task = await prisma.$transaction(async (tx) => {
        await tx.taskAssignee.deleteMany({
          where: { taskId: params.id },
        });

        const updated = await tx.task.update({
          where: { id: params.id },
          data: {
            title: body.title,
            description: normalizeOptionalText(body.description),
            notes: body.notes === undefined ? existingTask.notes : normalizeOptionalText(body.notes),
            status: body.status,
            isDefect: body.isDefect,
            deadline: normalizeOptionalDate(body.deadline),
            startDate: normalizeOptionalDate(body.startDate),
            completedAt: buildCompletedAtUpdateAt(body.status, completedAt, existingTask.status, existingTask.completedAt),
            projectId: body.projectId,
            assigneeId: assigneeIds[0],
            parentTaskId,
            taskAssignees: {
              createMany: {
                data: assigneeIds.map((teamMemberId) => ({ teamMemberId })),
                skipDuplicates: true,
              },
            },
            archive:
              body.status === "done" && archivePreparation
                ? {
                    upsert: {
                      create: archivePreparation,
                      update: archivePreparation,
                    },
                  }
                : body.status !== "done" && existingTask.archive
                  ? { delete: true }
                  : undefined,
          },
          include: taskDetailsInclude,
        });

        if (body.status === "done" && !existingTask.parentTaskId) {
          for (const [index, childTask] of childTasks.entries()) {
            const childArchive = childArchives[index];
            await tx.task.update({
              where: { id: childTask.id },
              data: {
                status: "done",
                completedAt,
                archive: childArchive
                  ? {
                      upsert: {
                        create: childArchive,
                        update: childArchive,
                      },
                    }
                  : undefined,
              },
            });
          }
        }

        return updated;
      });

      if (body.status === "done" && existingTask.status !== "done") {
        await finalizeTaskArchive(existingTask);
        await Promise.all(childTasks.map((childTask) => finalizeTaskArchive(childTask)));
      }

      if (body.status !== "done" && existingTask.status === "done") {
        await finalizeTaskRestore(existingTask);
      }

      return mapTask(task, { canManageAssignees: canManageTaskAssignees(access) });
    },
  );

  app.patch(
    "/tasks/:id/status",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
        body: taskStatusUpdateSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      const body = taskStatusUpdateSchema.parse(request.body);
      const task = await getTaskForUser(user.id, params.id, true);
      const access = await getAccessContext(task.projectId, user.id);
      const archivePreparation = body.status === "done" && task.status !== "done" ? await prepareTaskArchive(task) : null;
      if (body.status !== "done" && task.status === "done") {
        await prepareTaskRestore(task);
      }
      const childTasks = body.status === "done" && !task.parentTaskId
        ? await prisma.task.findMany({
            where: {
              userId: access.ownerUserId,
              parentTaskId: params.id,
              status: { not: "done" },
            },
            include: taskDetailsInclude,
          })
        : [];
      const childArchives = await Promise.all(childTasks.map((childTask) => prepareTaskArchive(childTask)));

      /*
      Completing a parent task is a hierarchy-level action: direct subtasks move
      to done in the same transaction so the task page cannot show stale active
      child work under a completed parent.
      */
      const completedAt = new Date();
      const updatedTask = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id: params.id },
          data: {
            status: body.status,
            completedAt: buildCompletedAtUpdateAt(body.status, completedAt, task.status, task.completedAt),
            archive:
              body.status === "done" && archivePreparation
                ? {
                    upsert: {
                      create: archivePreparation,
                      update: archivePreparation,
                    },
                  }
                : body.status !== "done" && task.archive
                  ? { delete: true }
                  : undefined,
          },
          include: taskDetailsInclude,
        });

        if (body.status === "done" && !task.parentTaskId) {
          for (const [index, childTask] of childTasks.entries()) {
            const childArchive = childArchives[index];
            await tx.task.update({
              where: { id: childTask.id },
              data: {
                status: "done",
                completedAt,
                archive: childArchive
                  ? {
                      upsert: {
                        create: childArchive,
                        update: childArchive,
                      },
                    }
                  : undefined,
              },
            });
          }
        }

        return updated;
      });

      if (body.status === "done" && task.status !== "done") {
        await finalizeTaskArchive(task);
        await Promise.all(childTasks.map((childTask) => finalizeTaskArchive(childTask)));
      }

      if (body.status !== "done" && task.status === "done") {
        await finalizeTaskRestore(task);
      }

      return mapTask(updatedTask, { canManageAssignees: canManageTaskAssignees(access) });
    },
  );

  app.get(
    "/tasks/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.id);
      const access = await getAccessContext(task.projectId, user.id);

      return mapTask(task, { canEdit: canEditTaskForAccess(task, access), canManageAssignees: canManageTaskAssignees(access) });
    },
  );

  app.post(
    "/tasks/:id/share-links",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
      },
    },
    async (request): Promise<TaskShareLinkDTO> => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.id, true);
      const token = randomBytes(32).toString("hex");
      const shareLink = await prisma.taskShareLink.create({
        data: {
          taskId: task.id,
          createdByUserId: user.id,
          tokenHash: hashShareToken(token),
        },
      });

      return {
        id: shareLink.id,
        taskId: task.id,
        url: buildTaskShareUrl(token),
        createdAt: shareLink.createdAt.toISOString(),
      };
    },
  );

  app.post(
    "/tasks/:id/attachments",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.id, true);

      if (task.status === "done") {
        throw badRequest("Done tasks can only expose the task archive. Reopen the task to manage attachments.");
      }

      await ensureAttachmentsRoot();
      const parts = request.files();
      const createRows: Array<{
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        storageKey: string;
        isImage: boolean;
      }> = [];
      const storedKeys: string[] = [];
      try {
        for await (const file of parts) {
          let buffer: Buffer;
          try {
            buffer = await file.toBuffer();
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") {
              throw badRequest("Each attachment must be 10 MB or smaller.");
            }

            throw error;
          }

          if (file.file.truncated || buffer.length > maxTaskAttachmentBytes) {
            throw badRequest("Each attachment must be 10 MB or smaller.");
          }

          const attachmentId = randomUUID();
          const metadata = buildAttachmentMetadata(file.filename, file.mimetype, buffer.length);
          const storageKey = taskAttachmentStorageKey(task.id, attachmentId, metadata.filename);
          await writeAttachmentFile(storageKey, buffer);
          storedKeys.push(storageKey);
          createRows.push({
            id: attachmentId,
            filename: metadata.filename,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
            storageKey,
            isImage: metadata.isImage,
          });
        }

        if (createRows.length === 0) {
          throw badRequest("Upload at least one file.");
        }

        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            attachments: {
              createMany: {
                data: createRows,
              },
            },
          },
          include: taskDetailsInclude,
        });

        return mapTask(updatedTask);
      } catch (error) {
        await Promise.all(storedKeys.map((storageKey) => deleteStorageKey(storageKey)));
        throw error;
      }
    },
  );

  app.get(
    "/tasks/:taskId/attachments/:attachmentId/download",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskAttachmentParamsSchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = taskAttachmentParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.taskId);
      const attachment = task.attachments.find((candidate) => candidate.id === params.attachmentId);

      if (!attachment) {
        throw notFound("Attachment");
      }

      if (task.status === "done") {
        throw badRequest("Done tasks expose attachments through the archive download only.");
      }

      const file = await readAttachmentFile(attachment.storageKey);
      return reply
        .header("Content-Type", attachment.mimeType)
        .header("Content-Disposition", `attachment; filename="${attachment.filename.replace(/"/g, "")}"`)
        .send(file);
    },
  );

  app.get(
    "/tasks/:taskId/attachments/:attachmentId/preview",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskAttachmentParamsSchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = taskAttachmentParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.taskId);
      const attachment = task.attachments.find((candidate) => candidate.id === params.attachmentId);

      if (!attachment) {
        throw notFound("Attachment");
      }

      if (task.status === "done") {
        throw badRequest("Preview is disabled after a task is done.");
      }

      if (!isPreviewableMimeType(attachment.mimeType)) {
        throw badRequest("This attachment type cannot be previewed in the browser.");
      }

      const file = await readAttachmentFile(attachment.storageKey);
      return reply.header("Content-Type", attachment.mimeType).send(file);
    },
  );

  app.get(
    "/tasks/:taskId/attachments/archive",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: z.object({ taskId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = z.object({ taskId: z.string().min(1) }).parse(request.params);
      const task = await getTaskForUser(user.id, params.taskId);

      if (task.status !== "done") {
        throw badRequest("Archives are available only for done tasks.");
      }

      if (!task.archive) {
        throw notFound("Attachment archive");
      }

      const archiveFile = await readAttachmentFile(task.archive.storageKey);
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="task-${task.id}-attachments.zip"`)
        .send(archiveFile);
    },
  );

  app.delete(
    "/tasks/:taskId/attachments/:attachmentId",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskAttachmentParamsSchema,
      },
    },
    async (request): Promise<TaskDTO> => {
      const user = requireCurrentUser(request);
      const params = taskAttachmentParamsSchema.parse(request.params);
      const task = await getTaskForUser(user.id, params.taskId);
      const attachment = task.attachments.find((candidate) => candidate.id === params.attachmentId);

      if (!attachment) {
        throw notFound("Attachment");
      }

      if (task.status === "done") {
        throw badRequest("Done tasks cannot delete individual attachments.");
      }

      await prisma.taskAttachment.delete({
        where: { id: attachment.id },
      });
      await deleteStorageKey(attachment.storageKey);

      const updatedTask = await getTaskForUser(user.id, params.taskId, true);
      return mapTask(updatedTask);
    },
  );

  app.delete(
    "/tasks/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: taskIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = taskIdParamsSchema.parse(request.params);
      await getTaskForUser(user.id, params.id, true);

      await prisma.task.delete({
        where: { id: params.id },
      });
      await deleteTaskStorage(params.id);

      return reply.status(204).send();
    },
  );
};
