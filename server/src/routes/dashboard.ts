/* Build manager-focused summaries from task deadlines so the dashboard and calendar share the same source data. */
import type { CalendarEventDTO, DashboardDTO } from "@team-management/shared";
import { calendarFiltersSchema, dashboardFiltersSchema, taskStatusValues } from "@team-management/shared";
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../db.js";
import { mapCalendarEvent, mapTask } from "../lib/mappers.js";
import { requireCurrentUser } from "../lib/request-user.js";

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  app.get(
    "/dashboard",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: dashboardFiltersSchema,
      },
    },
    async (request): Promise<DashboardDTO> => {
    const user = requireCurrentUser(request);
    const query = dashboardFiltersSchema.parse(request.query);
    const now = new Date();
    const upcomingCutoff = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
    const completedFrom = query.completedFrom ? new Date(query.completedFrom) : new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
    const completedTo = query.completedTo ? new Date(query.completedTo) : now;

    const [
      projectCount,
      memberCount,
      taskCount,
      overdueCount,
      overdueTasks,
      upcomingTasks,
      recentCompletedCount,
      recentCompletedTasks,
      tasksByStatus,
    ] = await Promise.all([
      prisma.project.count({ where: { userId: user.id } }),
      prisma.teamMember.count({ where: { userId: user.id, active: true } }),
      prisma.task.count({ where: { userId: user.id } }),
      prisma.task.count({
        where: {
          userId: user.id,
          deadline: { lt: now },
          status: { not: "done" },
        },
      }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          deadline: { lt: now },
          status: { not: "done" },
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
          taskAssignees: {
            select: {
              teamMemberId: true,
              teamMember: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          attachments: true,
          archive: true,
        },
        orderBy: { deadline: "asc" },
        take: 6,
      }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          deadline: {
            gte: now,
            lte: upcomingCutoff,
          },
          status: { not: "done" },
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
          taskAssignees: {
            select: {
              teamMemberId: true,
              teamMember: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          attachments: true,
          archive: true,
        },
        orderBy: { deadline: "asc" },
        take: 8,
      }),
      prisma.task.count({
        where: {
          userId: user.id,
          status: "done",
          completedAt: {
            gte: completedFrom,
            lte: completedTo,
          },
        },
      }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          status: "done",
          completedAt: {
            gte: completedFrom,
            lte: completedTo,
          },
        },
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
          taskAssignees: {
            select: {
              teamMemberId: true,
              teamMember: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          attachments: true,
          archive: true,
        },
        orderBy: { completedAt: "desc" },
        take: 6,
      }),
      Promise.all(
        taskStatusValues.map(async (status) => ({
          status,
          count: await prisma.task.count({ where: { userId: user.id, status } }),
        })),
      ),
    ]);

    return {
      stats: {
        projectCount,
        memberCount,
        taskCount,
        overdueCount,
      },
      overdueTasks: overdueTasks.map(mapTask),
      upcomingTasks: upcomingTasks.map(mapTask),
      recentCompletions: {
        from: completedFrom.toISOString(),
        to: completedTo.toISOString(),
        count: recentCompletedCount,
        tasks: recentCompletedTasks.map(mapTask),
      },
      tasksByStatus,
    };
    },
  );

  app.get(
    "/calendar/events",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: calendarFiltersSchema,
      },
    },
    async (request): Promise<CalendarEventDTO[]> => {
      const user = requireCurrentUser(request);
      const query = calendarFiltersSchema.parse(request.query);
      const tasks = await prisma.task.findMany({
        /*
        Restrict calendar output to active work so completed tasks disappear
        from every calendar view without relying on client-side filtering.
        */
        where: {
          userId: user.id,
          status: {
            not: "done",
          },
          ...((query.from || query.to)
            ? {
                deadline: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
        },
        include: {
          project: {
            select: { name: true },
          },
          taskAssignees: {
            select: { teamMemberId: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { deadline: "asc" },
      });

      return tasks.map(mapCalendarEvent);
    },
  );
};
