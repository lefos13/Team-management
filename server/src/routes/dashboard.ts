/* Build manager-focused summaries from task deadlines so the dashboard and calendar share the same source data. */
import type { CalendarEventDTO, DashboardDTO } from "@team-management/shared";
import { calendarFiltersSchema, dashboardFiltersSchema, taskStatusValues } from "@team-management/shared";
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../db.js";
import { mapCalendarEvent, mapProjectGoLiveCalendarEvent, mapProjectPhaseCalendarEvent, mapTask } from "../lib/mappers.js";
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
          deadline: { not: null, lt: now },
          status: { not: "done" },
        },
      }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          deadline: { not: null, lt: now },
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
        orderBy: { deadline: { sort: "asc", nulls: "last" } },
        take: 6,
      }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          deadline: {
            not: null,
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
        orderBy: { deadline: { sort: "asc", nulls: "last" } },
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
      overdueTasks: overdueTasks.map((task) => mapTask(task)),
      upcomingTasks: upcomingTasks.map((task) => mapTask(task)),
      recentCompletions: {
        from: completedFrom.toISOString(),
        to: completedTo.toISOString(),
        count: recentCompletedCount,
        tasks: recentCompletedTasks.map((task) => mapTask(task)),
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
      const sharedAccesses = await prisma.projectAccess.findMany({
        where: { userId: user.id, status: "active" },
        select: { projectId: true },
      });
      const visibleProjectIds = sharedAccesses.map((access) => access.projectId);
      const [tasks, goLiveProjects, phaseDates] = await Promise.all([
        prisma.task.findMany({
          /*
          Restrict calendar output to active work so completed tasks disappear
          from every calendar view without relying on client-side filtering.
          */
          where: {
            userId: user.id,
            status: {
              not: "done",
            },
            deadline: {
              not: null,
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
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
          orderBy: { deadline: { sort: "asc", nulls: "last" } },
        }),
        prisma.project.findMany({
          where: {
            OR: [
              { userId: user.id },
              ...(visibleProjectIds.length > 0 ? [{ id: { in: visibleProjectIds } }] : []),
            ],
            goLiveDate: {
              not: null,
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          },
          select: { id: true, name: true, goLiveDate: true },
          orderBy: { goLiveDate: { sort: "asc", nulls: "last" } },
        }),
        prisma.projectPhaseDate.findMany({
          where: {
            project: {
              OR: [
                { userId: user.id },
                ...(visibleProjectIds.length > 0 ? [{ id: { in: visibleProjectIds } }] : []),
              ],
            },
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          },
          include: { project: { select: { name: true } } },
          orderBy: [{ date: "asc" }, { name: "asc" }],
        }),
      ]);

      return [
        ...tasks.map(mapCalendarEvent),
        ...goLiveProjects.map(mapProjectGoLiveCalendarEvent),
        ...phaseDates.map(mapProjectPhaseCalendarEvent),
      ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    },
  );
};
