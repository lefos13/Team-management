/* Enforce that tasks belong to valid project-member pairs so the calendar and workload views stay coherent. */
import type { TaskDTO } from "@team-management/shared";
import { taskFiltersSchema, taskInputSchema, taskStatusSchema } from "@team-management/shared";
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
          deadline: new Date(body.deadline),
          startDate: normalizeOptionalDate(body.startDate),
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
          deadline: new Date(body.deadline),
          startDate: normalizeOptionalDate(body.startDate),
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
        data: { status: body.status },
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
