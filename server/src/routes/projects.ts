/* Update project metadata and memberships in one place so task assignment rules can trust project membership. */
import type { ProjectDetailDTO, ProjectSummaryDTO } from "@team-management/shared";
import { projectInputSchema } from "@team-management/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { mapProjectDetail, mapProjectSummary } from "../lib/mappers.js";
import { requireCurrentUser } from "../lib/request-user.js";

const projectIdParamsSchema = z.object({
  id: z.string().min(1),
});

function normalizeOptionalText(value?: string): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
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

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  app.get("/projects", { preHandler: fastify.authenticate }, async (request): Promise<ProjectSummaryDTO[]> => {
    const user = requireCurrentUser(request);
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      include: {
        _count: {
          select: {
            projectMembers: true,
            tasks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return projects.map(mapProjectSummary);
  });

  app.get(
    "/projects/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: projectIdParamsSchema,
      },
    },
    async (request): Promise<ProjectDetailDTO> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id: params.id, userId: user.id },
        include: {
          projectMembers: {
            select: { teamMemberId: true },
          },
          tasks: {
            select: { id: true },
          },
          _count: {
            select: {
              projectMembers: true,
              tasks: true,
            },
          },
        },
      });

      if (!project) {
        throw notFound("Project");
      }

      return mapProjectDetail(project);
    },
  );

  app.post(
    "/projects",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: projectInputSchema,
      },
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
          status: body.status,
          color: normalizeOptionalText(body.color),
          projectMembers: {
            createMany: {
              data: body.memberIds.map((memberId: string) => ({ teamMemberId: memberId })),
            },
          },
        },
        include: {
          _count: {
            select: {
              projectMembers: true,
              tasks: true,
            },
          },
        },
      });

      return mapProjectSummary(project);
    },
  );

  app.put(
    "/projects/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: projectIdParamsSchema,
        body: projectInputSchema,
      },
    },
    async (request): Promise<ProjectSummaryDTO> => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const body = projectInputSchema.parse(request.body);
      await ensureMembersExist(user.id, body.memberIds);

      const existingProject = await prisma.project.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!existingProject) {
        throw notFound("Project");
      }

      const [, project] = await prisma.$transaction([
        prisma.projectMember.deleteMany({
          where: { projectId: params.id },
        }),
        prisma.project.update({
          where: { id: params.id },
          data: {
            name: body.name,
            description: normalizeOptionalText(body.description),
            aiContext: normalizeOptionalText(body.aiContext),
            status: body.status,
            color: normalizeOptionalText(body.color),
            projectMembers: {
              createMany: {
                data: body.memberIds.map((memberId: string) => ({ teamMemberId: memberId })),
              },
            },
          },
          include: {
            _count: {
              select: {
                projectMembers: true,
                tasks: true,
              },
            },
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
      schema: {
        params: projectIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = requireCurrentUser(request);
      const params = projectIdParamsSchema.parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!project) {
        throw notFound("Project");
      }

      await prisma.project.delete({
        where: { id: params.id },
      });

      return reply.status(204).send();
    },
  );
};
