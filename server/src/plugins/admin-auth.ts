/* Reuse the cookie-signing pipeline to guard admin-only routes with one shared check. */
import fp from "fastify-plugin";

import { clearAdminSessionCookie, hasValidAdminSession } from "../lib/admin-auth.js";
import { unauthorized } from "../lib/errors.js";

export const adminAuthPlugin = fp(async (fastify) => {
  fastify.decorate("authenticateAdmin", async function authenticateAdmin(request, reply) {
    if (hasValidAdminSession(request)) {
      return;
    }

    clearAdminSessionCookie(reply);
    throw unauthorized();
  });
});
