/*
Unify ownership and invited-access project flows so a user can manage personal
projects while participating in shared projects with permission-based controls.
*/
import type {
  ProjectDetailDTO,
  ProjectInvitationDTO,
  ProjectListDTO,
  ProjectPermission,
  ProjectSummaryDTO,
} from "@team-management/shared";
import {
  acceptProjectInvitationInputSchema,
  projectPermissionLabels,
  projectInputSchema,
  sendProjectInvitationInputSchema,
  updateProjectAccessPermissionInputSchema,
} from "@team-management/shared";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getConfig } from "../config.js";
import { prisma } from "../db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { mapProjectDetail, mapProjectList, mapProjectSummary } from "../lib/mappers.js";
import { sendProjectInvitationEmail } from "../lib/mail.js";
import { assertMasterOwner, getAccessContext } from "../lib/project-access.js";
import { requireCurrentUser } from "../lib/request-user.js";

const projectIdParamsSchema = z.object({
  id: z.string().min(1),
});

const projectInvitationParamsSchema = z.object({
  id: z.string().min(1),
  invitationId: z.string().min(1),
});

const projectAccessParamsSchema = z.object({
  id: z.string().min(1),
  accessId: z.string().min(1),
});

function normalizeOptionalText(value?: string): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function normalizeOptionalDate(value?: string | null): Date | null {
  return value && value !== "" ? new Date(value) : null;
}

function permissionLabel(permission: ProjectPermission): string {
  return projectPermissionLabels[permission];
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureMembersExist(userId: string, memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }

  const count = await prisma.teamMember.count({
    where: {
      userId,
      id: { in: memberIds },
    },
  });

  if (count !== new Set(memberIds).size) {
    throw badRequest("One or more selected team members do not exist.");
  }
}

function mapInvitation(invitation: {
  id: string;
  projectId: string;
  teamMemberId: string;
  inviteEmail: string;
  permission: ProjectPermission;
  access?: {
    id: string;
    status: "active" | "invited" | "revoked";
  } | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ProjectInvitationDTO {
  return {
    id: invitation.id,
    projectId: invitation.projectId,
    memberId: invitation.teamMemberId,
    inviteEmail: invitation.inviteEmail,
    permission: invitation.permission,
    accessId: invitation.access?.id ?? null,
    accessStatus: invitation.access?.status ?? null,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  app.get("/projects", { preHandler: fastify.authenticate }, async (request): Promise<ProjectListDTO> => {
    const user = requireCurrentUser(request);

    const [ownedProjects, sharedAccesses] = await Promise.all([
      prisma.project.findMany({
        where: { userId: user.id },
        include: {
          _count: { select: { projectMembers: true, tasks: true } },
          phaseDates: { orderBy: [{ date: "asc" }, { name: "asc" }] },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.projectAccess.findMany({
        where: { userId: user.id, status: "active" },
        include: {
          ownerUser: { select: { email: true } },
          project: {
            include: {
              _count: { select: { projectMembers: true, tasks: true } },
              phaseDates: { orderBy: [{ date: "asc" }, { name: "asc" }] },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const sharedProjects = sharedAccesses.map((access) => ({
      ...access.project,
      access: {
        permission: access.permission,
        status: access.status,
        ownerEmail: access.ownerUser.email,
      },
    }));

    return mapProjectList({ ownedProjects, sharedProjects });
  });

  app.get(
    "/projects/:id",
    {
      preHandler: fastify.authenticate,
      schema: { params: projectIdParamsSchema },
    },
    async (request): Promise<ProjectDetailDTO> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const access = await getAccessContext(params.id, user.id);

      const project = await prisma.project.findFirst({
        where: { id: params.id },
        include: {
          user: { select: { email: true } },
          projectMembers: { select: { teamMemberId: true } },
          tasks: { select: { id: true } },
          _count: { select: { projectMembers: true, tasks: true } },
          phaseDates: { orderBy: [{ date: "asc" }, { name: "asc" }] },
        },
      });

      if (!project) {
        throw notFound("Project");
      }

      return {
        ...mapProjectDetail(project),
        isMasterOwner: access.isMasterOwner,
        permission: access.permission,
        masterOwnerEmail: project.user.email,
      };
    },
  );

  app.post(
    "/projects",
    {
      preHandler: fastify.authenticate,
      schema: { body: projectInputSchema },
    },
    async (request): Promise<ProjectSummaryDTO> => {
      const user = requireCurrentUser(request);
      const body = projectInputSchema.parse(request.body);
      await ensureMembersExist(user.id, body.memberIds);

      const project = await prisma.project.create({
        data: {
          userId: user.id,
          name: body.name,
          description: normalizeOptionalText(body.description),
          aiContext: normalizeOptionalText(body.aiContext),
          goLiveDate: normalizeOptionalDate(body.goLiveDate),
          status: body.status,
          color: normalizeOptionalText(body.color),
          phaseDates: {
            createMany: {
              data: body.phaseDates.map((phaseDate) => ({
                name: phaseDate.name,
                date: new Date(phaseDate.date),
              })),
            },
          },
          projectMembers: {
            createMany: {
              data: body.memberIds.map((memberId: string) => ({ teamMemberId: memberId })),
            },
          },
        },
        include: {
          _count: { select: { projectMembers: true, tasks: true } },
          phaseDates: { orderBy: [{ date: "asc" }, { name: "asc" }] },
        },
      });

      return mapProjectSummary(project);
    },
  );

  app.put(
    "/projects/:id",
    {
      preHandler: fastify.authenticate,
      schema: { params: projectIdParamsSchema, body: projectInputSchema },
    },
    async (request): Promise<ProjectSummaryDTO> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const body = projectInputSchema.parse(request.body);
      await ensureMembersExist(user.id, body.memberIds);
      const access = await getAccessContext(params.id, user.id);
      if (!access.isMasterOwner) {
        throw forbidden("Only the master owner can edit project settings.");
      }

      const [, , project] = await prisma.$transaction([
        prisma.projectMember.deleteMany({ where: { projectId: params.id } }),
        prisma.projectPhaseDate.deleteMany({ where: { projectId: params.id } }),
        prisma.project.update({
          where: { id: params.id },
          data: {
            name: body.name,
            description: normalizeOptionalText(body.description),
            aiContext: normalizeOptionalText(body.aiContext),
            goLiveDate: normalizeOptionalDate(body.goLiveDate),
            status: body.status,
            color: normalizeOptionalText(body.color),
            phaseDates: {
              createMany: {
                data: body.phaseDates.map((phaseDate) => ({
                  name: phaseDate.name,
                  date: new Date(phaseDate.date),
                })),
              },
            },
            projectMembers: {
              createMany: {
                data: body.memberIds.map((memberId: string) => ({ teamMemberId: memberId })),
              },
            },
          },
          include: {
            _count: { select: { projectMembers: true, tasks: true } },
            phaseDates: { orderBy: [{ date: "asc" }, { name: "asc" }] },
          },
        }),
      ]);

      return mapProjectSummary(project);
    },
  );

  app.delete(
    "/projects/:id",
    {
      preHandler: fastify.authenticate,
      schema: { params: projectIdParamsSchema },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const access = await getAccessContext(params.id, user.id);
      if (!access.isMasterOwner) {
        throw forbidden("Only the master owner can delete a project.");
      }

      await prisma.project.delete({ where: { id: params.id } });
      return reply.status(204).send();
    },
  );

  app.get(
    "/projects/:id/invitations",
    { preHandler: fastify.authenticate, schema: { params: projectIdParamsSchema } },
    async (request): Promise<ProjectInvitationDTO[]> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const access = await getAccessContext(params.id, user.id);
      assertMasterOwner(access);

      const [invitations, accesses] = await Promise.all([
        prisma.projectInvitation.findMany({
          where: { projectId: params.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.projectAccess.findMany({
          where: { projectId: params.id },
          select: { id: true, teamMemberId: true, permission: true, status: true },
        }),
      ]);
      const accessByMemberId = new Map(accesses.filter((item) => item.teamMemberId).map((item) => [item.teamMemberId!, item]));

      return invitations.map((invitation) => {
        const activeAccess = accessByMemberId.get(invitation.teamMemberId);
        return mapInvitation({
          ...invitation,
          permission: activeAccess?.permission ?? invitation.permission,
          access: activeAccess ? { id: activeAccess.id, status: activeAccess.status } : null,
        });
      });
    },
  );

  app.post(
    "/projects/:id/invitations",
    { preHandler: fastify.authenticate, schema: { params: projectIdParamsSchema, body: sendProjectInvitationInputSchema } },
    async (request): Promise<ProjectInvitationDTO> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const body = sendProjectInvitationInputSchema.parse(request.body);
      const access = await getAccessContext(params.id, user.id);
      assertMasterOwner(access);

      const member = await prisma.teamMember.findFirst({
        where: { id: body.memberId, userId: user.id },
      });

      if (!member) {
        throw notFound("Member");
      }

      const membership = await prisma.projectMember.findUnique({
        where: { projectId_teamMemberId: { projectId: params.id, teamMemberId: body.memberId } },
      });

      if (!membership) {
        throw badRequest("Member is not assigned to this project.");
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = hashInvitationToken(token);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      const invitation = await prisma.projectInvitation.create({
        data: {
          projectId: params.id,
          ownerUserId: user.id,
          teamMemberId: member.id,
          inviteEmail: member.email.toLowerCase(),
          permission: body.permission,
          tokenHash,
          expiresAt,
        },
      });

      const project = await prisma.project.findUniqueOrThrow({ where: { id: params.id }, select: { name: true } });
      const config = getConfig();
      const acceptUrl = `${new URL(config.CLIENT_ORIGIN).toString().replace(/\/$/, "")}/projects/invitations/accept?token=${encodeURIComponent(token)}`;

      await sendProjectInvitationEmail({
        recipientEmail: member.email,
        inviterEmail: user.email,
        projectName: project.name,
        permissionLabel: permissionLabel(body.permission),
        acceptUrl,
        expiresAt,
      });

      return mapInvitation(invitation);
    },
  );

  app.patch(
    "/projects/:id/access/:accessId/permission",
    { preHandler: fastify.authenticate, schema: { params: projectAccessParamsSchema, body: updateProjectAccessPermissionInputSchema } },
    async (request) => {
      const user = requireCurrentUser(request);
      const params = projectAccessParamsSchema.parse(request.params);
      const body = updateProjectAccessPermissionInputSchema.parse(request.body);
      const context = await getAccessContext(params.id, user.id);
      assertMasterOwner(context);

      const access = await prisma.projectAccess.findFirst({ where: { id: params.accessId, projectId: params.id } });
      if (!access) {
        throw notFound("Project access");
      }

      return prisma.projectAccess.update({ where: { id: params.accessId }, data: { permission: body.permission } });
    },
  );

  app.post(
    "/projects/:id/access/:accessId/revoke",
    { preHandler: fastify.authenticate, schema: { params: projectAccessParamsSchema } },
    async (request) => {
      const user = requireCurrentUser(request);
      const params = projectAccessParamsSchema.parse(request.params);
      const context = await getAccessContext(params.id, user.id);
      assertMasterOwner(context);

      const access = await prisma.projectAccess.findFirst({ where: { id: params.accessId, projectId: params.id } });
      if (!access) {
        throw notFound("Project access");
      }

      /*
      Revoking accepted access changes only the server-side access row. The
      original invitation remains historical, while shared-project visibility
      stops because project lists only include active access.
      */
      return prisma.projectAccess.update({ where: { id: params.accessId }, data: { status: "revoked" } });
    },
  );

  app.post(
    "/project-invitations/accept",
    { preHandler: fastify.authenticate, schema: { body: acceptProjectInvitationInputSchema } },
    async (request): Promise<ProjectInvitationDTO> => {
      const user = requireCurrentUser(request);
      if (!user.emailVerified) {
        throw forbidden("Verify your email before accepting invitations.");
      }

      const body = acceptProjectInvitationInputSchema.parse(request.body);
      const tokenHash = hashInvitationToken(body.token);
      const invitation = await prisma.projectInvitation.findUnique({
        where: { tokenHash },
      });

      if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
        throw badRequest("Invitation is invalid or expired.");
      }

      if (user.email.toLowerCase() !== invitation.inviteEmail.toLowerCase()) {
        throw forbidden("You must sign in with the same email that received this invitation.");
      }

      const [member, membership] = await Promise.all([
        prisma.teamMember.findUnique({ where: { id: invitation.teamMemberId } }),
        prisma.projectMember.findUnique({
          where: {
            projectId_teamMemberId: {
              projectId: invitation.projectId,
              teamMemberId: invitation.teamMemberId,
            },
          },
        }),
      ]);

      if (!member || !membership) {
        throw badRequest("Invitation member is no longer eligible for this project.");
      }

      await prisma.$transaction([
        prisma.projectAccess.upsert({
          where: {
            projectId_userId: {
              projectId: invitation.projectId,
              userId: user.id,
            },
          },
          update: {
            ownerUserId: invitation.ownerUserId,
            teamMemberId: invitation.teamMemberId,
            permission: invitation.permission,
            status: "active",
          },
          create: {
            projectId: invitation.projectId,
            ownerUserId: invitation.ownerUserId,
            userId: user.id,
            teamMemberId: invitation.teamMemberId,
            permission: invitation.permission,
            status: "active",
          },
        }),
        prisma.projectInvitation.update({
          where: { id: invitation.id },
          data: {
            acceptedAt: new Date(),
            acceptedByUserId: user.id,
          },
        }),
      ]);

      const accepted = await prisma.projectInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
      return mapInvitation(accepted);
    },
  );

  app.post(
    "/projects/:id/invitations/:invitationId/revoke",
    { preHandler: fastify.authenticate, schema: { params: projectInvitationParamsSchema } },
    async (request): Promise<ProjectInvitationDTO> => {
      const user = requireCurrentUser(request);
      const params = projectInvitationParamsSchema.parse(request.params);
      const access = await getAccessContext(params.id, user.id);
      assertMasterOwner(access);

      const invitation = await prisma.projectInvitation.findFirst({ where: { id: params.invitationId, projectId: params.id } });
      if (!invitation) {
        throw notFound("Invitation");
      }

      const updated = await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });

      return mapInvitation(updated);
    },
  );
};
