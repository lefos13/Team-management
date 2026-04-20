/* Keep passwords, sessions, and OTP codes server-managed so registration and login stay consistent across transports. */
import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import type { FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";

export const sessionCookieName = "team_management_session";
export const emailVerificationPurpose = "email_verification";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOtpCode(overrideCode?: string): string {
  if (overrideCode) {
    return overrideCode;
  }

  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function getSessionExpiry(): Date {
  return new Date(Date.now() + sessionDurationMs);
}

export function getOtpExpiry(config: AppConfig): Date {
  return new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function setSessionCookie(reply: FastifyReply, token: string, config: AppConfig): void {
  reply.setCookie(sessionCookieName, token, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: config.NODE_ENV === "production" || config.APP_BASE_URL.startsWith("https://"),
    maxAge: sessionDurationMs / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(sessionCookieName, {
    path: "/",
  });
}
