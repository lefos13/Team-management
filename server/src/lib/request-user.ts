/* Centralize access to the authenticated account so every route enforces ownership the same way. */
import type { FastifyRequest } from "fastify";
import type { UserDTO } from "@team-management/shared";

import { unauthorized } from "./errors.js";

export function requireCurrentUser(request: FastifyRequest): UserDTO {
  if (!request.currentUser) {
    throw unauthorized();
  }

  return request.currentUser;
}
