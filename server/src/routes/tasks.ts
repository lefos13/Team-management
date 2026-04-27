/* Enforce that tasks belong to valid project-member pairs so the calendar and workload views stay coherent. */
import type { TaskDTO } from "@team-management/shared";
import {
  taskExportFiltersSchema,
  taskFiltersSchema,
  taskInputSchema,
  taskStatusSchema,
} from "@team-management/shared";
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import type { FastifyPluginAsync } from "fastify";
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
