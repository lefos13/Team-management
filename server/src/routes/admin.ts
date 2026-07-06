/*
Keep the backoffice read-only and cross-account by serving explicit aggregate
queries instead of reusing user-scoped workspace routes and ownership rules.
*/
import type { FastifyPluginAsync } from "fastify";
import type {
  AdminAccessDTO,
  AdminMemberDTO,
  AdminOverviewDTO,
  AdminPaginationQuery,
  AdminProjectDTO,
  AdminSessionDTO,
  AdminTaskDTO,
  AdminUserDTO,
  PaginatedAdminAccessDTO,
  PaginatedAdminMembersDTO,
  PaginatedAdminProjectsDTO,
  PaginatedAdminTasksDTO,
  PaginatedAdminUsersDTO,
} from "@team-management/shared";
import { adminLoginInputSchema, adminPaginationQuerySchema } from "@team-management/shared";

import { prisma } from "../db.js";
import { clearAdminSessionCookie, hasValidAdminSession, isValidAdminPassword, setAdminSessionCookie } from "../lib/admin-auth.js";
import { unauthorized } from "../lib/errors.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  /*
  Each admin section pages independently, so the server returns total counts and
  one slice at a time instead of sending whole cross-account tables to the client.
  */
  function paginatedResponse<T>(items: T[], pagination: AdminPaginationQuery, totalItems: number) {
    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pagination.pageSize)),
    };
  }

  function getPagination(query: unknown) {
    return adminPaginationQuerySchema.parse(query);
  }

  app.post(
    "/admin/session",
    {
      schema: {
        body: adminLoginInputSchema,
      },
    },
    async (request, reply): Promise<AdminSessionDTO> => {
      const { password } = adminLoginInputSchema.parse(request.body);

      if (!isValidAdminPassword(password)) {
        clearAdminSessionCookie(reply);
        throw unauthorized("Invalid admin password.");
      }

      setAdminSessionCookie(reply);
      return { authenticated: true };
    },
  );

  app.get("/admin/session", async (request, reply): Promise<AdminSessionDTO> => {
    const authenticated = hasValidAdminSession(request);

    if (!authenticated) {
      clearAdminSessionCookie(reply);
    }

    return { authenticated };
  });

  app.delete("/admin/session", async (_request, reply) => {
    clearAdminSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/admin/overview", { preHandler: fastify.authenticateAdmin }, async (): Promise<AdminOverviewDTO> => {
    const [userCount, verifiedUserCount, projectCount, taskCount, invitationCount, activeAccessCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.project.count(),
      prisma.task.count(),
      prisma.projectInvitation.count({
        where: {
          acceptedAt: null,
          revokedAt: null,
        },
      }),
      prisma.projectAccess.count({
        where: {
          status: "active",
        },
      }),
    ]);

    return {
      totals: {
        userCount,
        verifiedUserCount,
        projectCount,
        taskCount,
        invitationCount,
        activeAccessCount,
      },
    };
  });

  app.get("/admin/users", { preHandler: fastify.authenticateAdmin }, async (request): Promise<PaginatedAdminUsersDTO> => {
    const pagination = getPagination(request.query);
    const [totalItems, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return paginatedResponse(users.map((user) => ({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })), pagination, totalItems);
  });

  app.get("/admin/projects", { preHandler: fastify.authenticateAdmin }, async (request): Promise<PaginatedAdminProjectsDTO> => {
    const pagination = getPagination(request.query);
    const [totalItems, projects] = await Promise.all([
      prisma.project.count(),
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          user: { select: { email: true } },
          _count: { select: { projectMembers: true, tasks: true } },
        },
      }),
    ]);

    return paginatedResponse(projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      ownerEmail: project.user.email,
      memberCount: project._count.projectMembers,
      taskCount: project._count.tasks,
      updatedAt: project.updatedAt.toISOString(),
    })), pagination, totalItems);
  });

  app.get("/admin/members", { preHandler: fastify.authenticateAdmin }, async (request): Promise<PaginatedAdminMembersDTO> => {
    const pagination = getPagination(request.query);
    const [totalItems, members] = await Promise.all([
      prisma.teamMember.count(),
      prisma.teamMember.findMany({
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    return paginatedResponse(members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      active: member.active,
      ownerEmail: member.user.email,
      createdAt: member.createdAt.toISOString(),
    })), pagination, totalItems);
  });

  app.get("/admin/tasks", { preHandler: fastify.authenticateAdmin }, async (request): Promise<PaginatedAdminTasksDTO> => {
    const pagination = getPagination(request.query);
    const [totalItems, tasks] = await Promise.all([
      prisma.task.count(),
      prisma.task.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          isDefect: true,
          deadline: true,
          updatedAt: true,
          project: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      }),
    ]);

    return paginatedResponse(tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      isDefect: task.isDefect,
      projectName: task.project.name,
      primaryAssigneeName: task.assignee?.name ?? null,
      deadline: task.deadline?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
    })), pagination, totalItems);
  });

  app.get("/admin/access", { preHandler: fastify.authenticateAdmin }, async (request): Promise<PaginatedAdminAccessDTO> => {
    const pagination = getPagination(request.query);
    const [invitations, accesses] = await Promise.all([
      prisma.projectInvitation.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          inviteEmail: true,
          permission: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          updatedAt: true,
          project: { select: { name: true } },
          ownerUser: { select: { email: true } },
          teamMember: { select: { name: true } },
        },
      }),
      prisma.projectAccess.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          permission: true,
          status: true,
          updatedAt: true,
          project: { select: { name: true } },
          ownerUser: { select: { email: true } },
          user: { select: { email: true } },
          teamMember: { select: { name: true } },
        },
      }),
    ]);

    /*
    Access history spans two tables with one combined admin view, so the server
    merges, sorts, and slices one dataset before returning pagination metadata.
    */
    const items = [
      ...invitations.map<AdminAccessDTO>((invitation) => ({
        id: invitation.id,
        kind: "invitation",
        projectName: invitation.project.name,
        ownerEmail: invitation.ownerUser.email,
        memberName: invitation.teamMember.name,
        inviteEmail: invitation.inviteEmail,
        permission: invitation.permission,
        status: invitation.revokedAt ? "revoked" : invitation.acceptedAt ? "accepted" : "pending",
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        revokedAt: invitation.revokedAt?.toISOString() ?? null,
        updatedAt: invitation.updatedAt.toISOString(),
      })),
      ...accesses.map<AdminAccessDTO>((access) => ({
        id: access.id,
        kind: "access",
        projectName: access.project.name,
        ownerEmail: access.ownerUser.email,
        memberName: access.teamMember?.name ?? null,
        inviteEmail: access.user.email,
        permission: access.permission,
        status: access.status,
        expiresAt: null,
        acceptedAt: null,
        revokedAt: access.status === "revoked" ? access.updatedAt.toISOString() : null,
        updatedAt: access.updatedAt.toISOString(),
      })),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const startIndex = (pagination.page - 1) * pagination.pageSize;

    return paginatedResponse(items.slice(startIndex, startIndex + pagination.pageSize), pagination, items.length);
  });
};
