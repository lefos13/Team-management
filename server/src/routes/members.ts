/* Maintain team members as manager-owned records while preserving task history when someone becomes inactive. */
import type { TeamMemberDTO } from "@team-management/shared";
import { memberInputSchema } from "@team-management/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { mapMember } from "../lib/mappers.js";
import { requireCurrentUser } from "../lib/request-user.js";

const memberIdParamsSchema = z.object({
  id: z.string().min(1),
});

function normalizeOptionalText(value?: string): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

async function ensureProjectsExist(userId: string, projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) {
    return;
  }

  const count = await prisma.project.count({
    where: {
      userId,
      id: { in: projectIds },
    },
  });

  if (count !== new Set(projectIds).size) {
    throw badRequest("One or more selected projects do not exist.");
  }
}

export const memberRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();

  app.get("/members", { preHandler: fastify.authenticate }, async (request): Promise<TeamMemberDTO[]> => {
    const user = requireCurrentUser(request);
    const members = await prisma.teamMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        projectMembers: {
          select: { projectId: true },
        },
        tasks: {
          where: {
            status: {
              not: "done",
            },
          },
          select: { id: true },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return members.map(mapMember);
  });

  app.post(
    "/members",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: memberInputSchema,
      },
    },
    async (request): Promise<TeamMemberDTO> => {
      const user = requireCurrentUser(request);
      const body = memberInputSchema.parse(request.body);
      await ensureProjectsExist(user.id, body.projectIds);

      const member = await prisma.teamMember.create({
        data: {
          userId: user.id,
          name: body.name,
          role: body.role,
          email: body.email,
          notes: normalizeOptionalText(body.notes),
          active: body.active,
          projectMembers: {
            createMany: {
              data: body.projectIds.map((projectId: string) => ({ projectId })),
            },
          },
        },
        include: {
          projectMembers: {
            select: { projectId: true },
          },
          tasks: {
            where: {
              status: {
                not: "done",
              },
            },
            select: { id: true },
          },
        },
      });

      return mapMember(member);
    },
  );

  app.put(
    "/members/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: memberIdParamsSchema,
        body: memberInputSchema,
      },
    },
    async (request): Promise<TeamMemberDTO> => {
      const user = requireCurrentUser(request);
      const params = memberIdParamsSchema.parse(request.params);
      const body = memberInputSchema.parse(request.body);
      await ensureProjectsExist(user.id, body.projectIds);

      const existingMember = await prisma.teamMember.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!existingMember) {
        throw notFound("Member");
      }

      const [, member] = await prisma.$transaction([
        prisma.projectMember.deleteMany({
          where: { teamMemberId: params.id },
        }),
        prisma.teamMember.update({
          where: { id: params.id },
          data: {
            name: body.name,
            role: body.role,
            email: body.email,
            notes: normalizeOptionalText(body.notes),
            active: body.active,
            projectMembers: {
              createMany: {
                data: body.projectIds.map((projectId: string) => ({ projectId })),
              },
            },
          },
          include: {
            projectMembers: {
              select: { projectId: true },
            },
            tasks: {
              where: {
                status: {
                  not: "done",
                },
              },
              select: { id: true },
            },
          },
        }),
      ]);

      return mapMember(member);
    },
  );

  app.delete(
    "/members/:id",
    {
      preHandler: fastify.authenticate,
      schema: {
        params: memberIdParamsSchema,
      },
    },
    async (request): Promise<TeamMemberDTO> => {
      const user = requireCurrentUser(request);
      const params = memberIdParamsSchema.parse(request.params);
      const member = await prisma.teamMember.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!member) {
        throw notFound("Member");
      }

      const updatedMember = await prisma.teamMember.update({
        where: { id: params.id },
        data: { active: false },
        include: {
          projectMembers: {
            select: { projectId: true },
          },
          tasks: {
            where: {
              status: {
                not: "done",
              },
            },
            select: { id: true },
          },
        },
      });

      return mapMember(updatedMember);
    },
  );
};
