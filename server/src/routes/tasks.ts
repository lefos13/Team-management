/* Enforce that tasks belong to valid project-member pairs so the calendar and workload views stay coherent. */
import type { TaskDTO, TaskImportResultDTO } from "@team-management/shared";
import {
  taskExportFiltersSchema,
  taskFiltersSchema,
  taskImportTemplateQuerySchema,
  taskInputSchema,
  taskStatusSchema,
  taskStatusValues,
} from "@team-management/shared";
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { mapTask } from "../lib/mappers.js";
import { requireCurrentUser } from "../lib/request-user.js";

const taskIdParamsSchema = z.object({
  id: z.string().min(1),
});

const taskStatusUpdateSchema = z.object({
  status: taskStatusSchema,
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
] as const;

const taskImportHeaders = ["Title", "Parent Task Title", "Member Emails", "Deadline", "Description", "Status", "Defect", "Start Date"] as const;
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
  status: (typeof taskStatusValues)[number];
  isDefect: boolean;
  startDate: Date | null;
  deadline: Date;
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
  userId: string,
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
      where: { id: parentTaskId, userId },
      select: { id: true, projectId: true, parentTaskId: true },
    }),
    currentTaskId
      ? prisma.task.count({
          where: { parentTaskId: currentTaskId, userId },
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

function formatWorkbookDate(value: Date | null): string {
  return value ? value.toISOString() : "";
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

function duplicateKey(projectId: string, parentTaskId: string | null, title: string, assigneeIds: string[], deadline: Date): string {
  return `${projectId}|${parentTaskId ?? ""}|${title.trim().toLowerCase()}|${[...assigneeIds].sort().join(",")}|${deadline.getTime()}`;
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
  return (names.length > 0 ? names : [task.assignee.name]).join(", ");
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

async function buildTasksWorkbook(tasks: ExportTask[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Management";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  worksheet.mergeCells("A1:L1");
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
      task.status.replace("_", " "),
      task.isDefect ? "Yes" : "No",
      formatWorkbookDate(task.startDate),
      formatWorkbookDate(task.deadline),
      formatWorkbookDate(task.completedAt),
      formatWorkbookDate(task.createdAt),
      formatWorkbookDate(task.updatedAt),
      task.description ?? "",
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

async function getProjectForImport(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
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
    ["Required columns", "Title, Member Emails, Deadline"],
    ["Optional columns", "Parent Task Title, Description, Status, Defect, Start Date"],
    ["Statuses", "todo, in_progress, blocked, done"],
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
    tasks.getCell(row, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"todo,in_progress,blocked,done"'],
    };
    tasks.getCell(row, 7).dataValidation = {
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
      userId,
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
    const status = parseImportStatus(row.getCell(5 + memberOffset).value);
    const isDefect = parseImportDefect(row.getCell(6 + memberOffset).value);
    const startDate = parseImportDate(row.getCell(7 + memberOffset).value, 9);

    if (!title && !parentTaskTitle && memberEmails.length === 0 && !deadline && !description && !normalizeImportText(row.getCell(5 + memberOffset).value)) {
      continue;
    }

    const rowErrors: string[] = [];

    if (!title) {
      rowErrors.push("Title is required.");
    }

    if (memberEmails.length === 0) {
      rowErrors.push("Member Emails is required.");
    }

    if (!deadline) {
      rowErrors.push("Deadline is required and must be a valid date.");
    }

    const uniqueMemberEmails = Array.from(new Set(memberEmails));
    const members = uniqueMemberEmails.map((email) => membersByEmail.get(email));
    const hasMissingMember = uniqueMemberEmails.some((_, index) => !members[index]);

    if (hasMissingMember) {
      rowErrors.push("Member Emails must belong to active members assigned to the selected project.");
    }

    if (!status) {
      rowErrors.push("Status must be one of todo, in_progress, blocked, or done.");
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
      const tasks = await prisma.task.findMany({
        where: {
          userId: user.id,
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
            select: { title: true },
          },
          taskAssignees: {
            select: {
              teamMemberId: true,
              teamMember: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      });

      return tasks.map(mapTask);
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
      const tasks = await prisma.task.findMany({
        where: {
          userId: user.id,
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
        orderBy: [{ project: { name: "asc" } }, { status: "asc" }, { deadline: "asc" }],
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
      await getProjectForImport(user.id, params.projectId);
      const importFile = (request as FastifyRequest & { taskImportFile: TaskImportFile }).taskImportFile;
      const parsedRows = await parseTaskImportWorkbook(user.id, params.projectId, importFile.buffer);
      const existingTasks = await prisma.task.findMany({
        where: {
          userId: user.id,
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
              : [task.assigneeId],
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
                userId: user.id,
                title: row.title,
                description: normalizeOptionalText(row.description),
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
      const assigneeIds = normalizeAssigneeIds(body);
      const parentTaskId = await validateParentTask(user.id, body.projectId, normalizeOptionalId(body.parentTaskId));
      await ensureAssignable(user.id, body.projectId, assigneeIds);

      const task = await prisma.task.create({
        data: {
          userId: user.id,
          title: body.title,
          description: normalizeOptionalText(body.description),
          status: body.status,
          isDefect: body.isDefect,
          deadline: new Date(body.deadline),
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
        include: {
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
        },
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
      const existingTask = await prisma.task.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!existingTask) {
        throw notFound("Task");
      }

      const parentTaskId = await validateParentTask(user.id, body.projectId, normalizeOptionalId(body.parentTaskId), params.id);
      await ensureAssignable(user.id, body.projectId, assigneeIds);

      const [, task] = await prisma.$transaction([
        prisma.taskAssignee.deleteMany({
          where: { taskId: params.id },
        }),
        prisma.task.update({
          where: { id: params.id },
          data: {
            title: body.title,
            description: normalizeOptionalText(body.description),
            status: body.status,
            isDefect: body.isDefect,
            deadline: new Date(body.deadline),
            startDate: normalizeOptionalDate(body.startDate),
            completedAt: buildCompletedAtUpdate(body.status, existingTask.status, existingTask.completedAt),
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
          include: {
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
          },
        }),
      ]);

      return mapTask(task);
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
      const task = await prisma.task.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!task) {
        throw notFound("Task");
      }

      const updatedTask = await prisma.task.update({
        where: { id: params.id },
        data: {
          status: body.status,
          completedAt: buildCompletedAtUpdate(body.status, task.status, task.completedAt),
        },
        include: {
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
        },
      });

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
      const task = await prisma.task.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!task) {
        throw notFound("Task");
      }

      await prisma.task.delete({
        where: { id: params.id },
      });

      return reply.status(204).send();
    },
  );
};
