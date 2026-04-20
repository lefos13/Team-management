/* Resolve the signed session cookie on demand so protected routes stay small and consistent. */
import fp from "fastify-plugin";

import { prisma } from "../db.js";
import { clearSessionCookie, hashSessionToken, sessionCookieName } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";
import { mapUser } from "../lib/mappers.js";

export const authPlugin = fp(async (fastify) => {
  fastify.decorateRequest("currentUser", null);
  fastify.decorate("authenticate", async function authenticate(request, reply) {
    const cookieValue = request.cookies[sessionCookieName];
    if (!cookieValue) {
      throw unauthorized();
    }

    const { valid, value } = request.unsignCookie(cookieValue);
    if (!valid) {
      clearSessionCookie(reply);
      throw unauthorized();
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(value) },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      clearSessionCookie(reply);
      throw unauthorized();
    }

    request.currentUser = mapUser(session.user);
  });
});
