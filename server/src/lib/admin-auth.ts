/*
Keep the admin gate server-controlled by deriving a signed cookie value from the
configured secret instead of exposing any reusable client-side credential.
*/
import crypto from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { getConfig, type AppConfig } from "../config.js";

export const adminSessionCookieName = "team_management_admin_session";
const adminSessionDurationSeconds = 60 * 60 * 4;

function hashAdminAccessPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAdminSessionValue(config: AppConfig = getConfig()) {
  return hashAdminAccessPassword(config.ADMIN_ACCESS_PASSWORD);
}

export function isValidAdminPassword(password: string, config = getConfig()) {
  return secureCompare(hashAdminAccessPassword(password), getAdminSessionValue(config));
}

export function hasValidAdminSession(request: FastifyRequest) {
  const cookieValue = request.cookies[adminSessionCookieName];
  if (!cookieValue) {
    return false;
  }

  const { valid, value } = request.unsignCookie(cookieValue);
  if (!valid) {
    return false;
  }

  return secureCompare(value, getAdminSessionValue());
}

export function setAdminSessionCookie(reply: FastifyReply, config = getConfig()) {
  reply.setCookie(adminSessionCookieName, getAdminSessionValue(config), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: config.NODE_ENV === "production" || config.APP_BASE_URL.startsWith("https://"),
    maxAge: adminSessionDurationSeconds,
  });
}

export function clearAdminSessionCookie(reply: FastifyReply) {
  reply.clearCookie(adminSessionCookieName, {
    path: "/",
  });
}
