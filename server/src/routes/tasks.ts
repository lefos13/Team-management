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
  "Project",
  "Member",
  "Current stage",
  "Defect",
  "Start date",
  "Deadline",
  "Completed date",
  "Created at",
  "Updated at",
  "Description",
] as const;

const taskImportHeaders = ["Title", "Member Email", "Deadline", "Description", "Status", "Defect", "Start Date"] as const;
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
  description: string;
  status: (typeof taskStatusValues)[number];
  isDefect: boolean;
  startDate: Date | null;
  deadline: Date;
  assigneeId: string;
  memberEmail: string;
};

type ExportTask = Prisma.TaskGetPayload<{
  include: {
    project: { select: { name: true } };
    assignee: { select: { name: true } };
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

async function ensureAssignable(userId: string, projectId: string, assigneeId: string): Promise<void> {
  const [project, member, membership] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId },
    }),
    prisma.teamMember.findFirst({
      where: { id: assigneeId, userId },
    }),
    prisma.projectMember.findFirst({
      where: {
        projectId,
        teamMemberId: assigneeId,
      },
    }),
  ]);

  if (!project) {
    throw notFound("Project");
  }

  if (!member) {
    throw notFound("Member");
  }

  if (!member.active) {
    throw badRequest("Tasks can only be assigned to active team members.");
  }

  if (!membership) {
    throw badRequest("The selected team member is not assigned to that project.");
  }
}

function buildTaskWhere(filters: z.infer<typeof taskFiltersSchema>) {
  return {
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
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

function duplicateKey(projectId: string, title: string, assigneeId: string, deadline: Date): string {
  return `${projectId}|${title.trim().toLowerCase()}|${assigneeId}|${deadline.getTime()}`;
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

  worksheet.mergeCells("A1:K1");
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

  for (const task of tasks) {
    worksheet.addRow([
      task.title,
      task.project.name,
      task.assignee.name,
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
    ["Required columns", "Title, Member Email, Deadline"],
    ["Optional columns", "Description, Status, Defect, Start Date"],
    ["Statuses", "todo, in_progress, blocked, done"],
    ["Defect values", "yes/no, true/false, or blank"],
    ["Date-only rule", "Start Date uses 09:00; Deadline uses 17:00."],
    ["Duplicate rule", "Existing tasks with the same title, member, and deadline are skipped."],
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
    { width: 32 },
    { width: 22 },
    { width: 44 },
    { width: 18 },
    { width: 12 },
    { width: 22 },
  ];

  if (variant === "sample" && project.assignableMembers[0]) {
    const sampleMember = project.assignableMembers[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    tasks.addRow([
      "Review project plan",
      sampleMember.email,
      tomorrow,
      "Confirm scope, owner, and next actions.",
      "todo",
      "no",
      "",
    ]);
  }

  for (let row = 2; row <= 201; row += 1) {
    tasks.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`'Allowed Members'!$C$2:$C$${Math.max(project.assignableMembers.length + 1, 2)}`],
    };
    tasks.getCell(row, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"todo,in_progress,blocked,done"'],
    };
    tasks.getCell(row, 6).dataValidation = {
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

  if (headers.some((header, index) => header !== taskImportHeaders[index])) {
    throw badRequest("Import workbook headers do not match the required template.", {
      expectedHeaders: taskImportHeaders,
      receivedHeaders: headers,
    });
  }

  const project = await getProjectForImport(userId, projectId);
  const membersByEmail = new Map(project.assignableMembers.map((member) => [member.email.toLowerCase(), member]));
  const rejectedRows: TaskImportResultDTO["rejectedRows"] = [];
  const parsedRows: ParsedImportTask[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const title = normalizeImportText(row.getCell(1).value);
    const memberEmail = normalizeImportText(row.getCell(2).value).toLowerCase();
    const deadline = parseImportDate(row.getCell(3).value, 17);
    const description = normalizeImportText(row.getCell(4).value);
    const status = parseImportStatus(row.getCell(5).value);
    const isDefect = parseImportDefect(row.getCell(6).value);
    const startDate = parseImportDate(row.getCell(7).value, 9);

    if (!title && !memberEmail && !deadline && !description && !normalizeImportText(row.getCell(5).value)) {
      continue;
    }

    const rowErrors: string[] = [];

    if (!title) {
      rowErrors.push("Title is required.");
    }

    if (!memberEmail) {
      rowErrors.push("Member Email is required.");
    }

    if (!deadline) {
      rowErrors.push("Deadline is required and must be a valid date.");
    }

    const member = memberEmail ? membersByEmail.get(memberEmail) : undefined;

    if (memberEmail && !member) {
      rowErrors.push("Member Email must belong to an active member assigned to the selected project.");
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

    if (rowErrors.length > 0 || !member || !deadline || !status || isDefect === null) {
      rejectedRows.push({
        row: rowNumber,
        title: title || undefined,
        memberEmail: memberEmail || undefined,
        reason: rowErrors.join(" "),
      });
      continue;
    }

    parsedRows.push({
      row: rowNumber,
      title,
      description,
      status,
      isDefect,
      startDate,
      deadline,
      assigneeId: member.id,
      memberEmail,
    });
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
        },
        orderBy: [{ project: { name: "asc" } }, { assignee: { name: "asc" } }, { status: "asc" }, { deadline: "asc" }],
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
          title: true,
          assigneeId: true,
          deadline: true,
        },
      });
      const seenKeys = new Set(
        existingTasks.map((task) => duplicateKey(params.projectId, task.title, task.assigneeId, task.deadline)),
      );
      const skippedRows: TaskImportResultDTO["skippedRows"] = [];
      const createRows: ParsedImportTask[] = [];

      for (const row of parsedRows) {
        const key = duplicateKey(params.projectId, row.title, row.assigneeId, row.deadline);

        if (seenKeys.has(key)) {
          skippedRows.push({
            row: row.row,
            title: row.title,
            memberEmail: row.memberEmail,
            reason: "A task with the same title, member, and deadline already exists in this project.",
          });
          continue;
        }

        seenKeys.add(key);
        createRows.push(row);
      }

      if (createRows.length > 0) {
        await prisma.$transaction(
          createRows.map((row) =>
            prisma.task.create({
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
                assigneeId: row.assigneeId,
              },
            }),
          ),
        );
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
      await ensureAssignable(user.id, body.projectId, body.assigneeId);

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
          assigneeId: body.assigneeId,
        },
        include: {
          project: {
            select: { name: true },
          },
          assignee: {
            select: { name: true },
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
      const existingTask = await prisma.task.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!existingTask) {
        throw notFound("Task");
      }

      await ensureAssignable(user.id, body.projectId, body.assigneeId);

      const task = await prisma.task.update({
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
          assigneeId: body.assigneeId,
        },
        include: {
          project: {
            select: { name: true },
          },
          assignee: {
            select: { name: true },
          },
        },
      });

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
