/* Exercise registration, verification, and account isolation so the cloud multi-tenant contract is enforced end to end. */
import "dotenv/config";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { passwordResetPurpose } from "../lib/auth.js";

describe("team management API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.user.deleteMany();
  });

  async function register(email: string, password: string) {
    return request(app.server).post("/api/auth/register").send({ email, password });
  }

  async function verify(email: string, otp = "123456") {
    return request(app.server).post("/api/auth/verify-email").send({ email, otp });
  }

  async function login(email: string, password: string) {
    const response = await request(app.server).post("/api/auth/login").send({ email, password });
    expect(response.headers["set-cookie"]?.[0]).toBeTruthy();
    return response;
  }

  async function requestPasswordReset(email: string) {
    return request(app.server).post("/api/auth/request-password-reset").send({ email });
  }

  async function resetPassword(email: string, otp = "123456", password = "updated-password") {
    return request(app.server).post("/api/auth/reset-password").send({ email, otp, password });
  }

  it("registers, verifies, and signs in a user", async () => {
    const registerResponse = await register("owner@example.com", "password123");

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.status).toBe("verification_required");

    const loginBeforeVerify = await request(app.server).post("/api/auth/login").send({
      email: "owner@example.com",
      password: "password123",
    });

    expect(loginBeforeVerify.status).toBe(403);

    const verifyResponse = await verify("owner@example.com");
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.status).toBe("verified");

    const loginResponse = await login("owner@example.com", "password123");
    expect(loginResponse.status).toBe(200);

    const meResponse = await request(app.server)
      .get("/api/auth/me")
      .set("Cookie", loginResponse.headers["set-cookie"]?.[0] as string);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe("owner@example.com");
    expect(meResponse.body.emailVerified).toBe(true);
  });

  it("rejects invalid verification codes and supports resend", async () => {
    await register("verify@example.com", "password123");

    const invalidVerifyResponse = await verify("verify@example.com", "111111");
    expect(invalidVerifyResponse.status).toBe(400);

    const resendResponse = await request(app.server).post("/api/auth/resend-verification").send({
      email: "verify@example.com",
    });

    expect(resendResponse.status).toBe(200);

    const validVerifyResponse = await verify("verify@example.com");
    expect(validVerifyResponse.status).toBe(200);
  });

  /*
  Exercise the reset OTP lifecycle end to end so neutral reset requests, attempt
  limits, expiry handling, password replacement, and session invalidation stay aligned.
  */
  it("supports password reset with a verified account", async () => {
    await register("reset@example.com", "password123");
    await verify("reset@example.com");

    const initialLogin = await login("reset@example.com", "password123");
    const initialCookie = initialLogin.headers["set-cookie"]?.[0] as string;

    const requestResponse = await requestPasswordReset("reset@example.com");
    expect(requestResponse.status).toBe(200);
    expect(requestResponse.body.status).toBe("password_reset_requested");

    const resetToken = await prisma.emailVerificationToken.findFirst({
      where: {
        email: "reset@example.com",
        purpose: passwordResetPurpose,
        consumedAt: null,
      },
    });

    expect(resetToken).toBeTruthy();

    const resetResponse = await resetPassword("reset@example.com");
    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.status).toBe("password_reset");

    const staleSessionResponse = await request(app.server).get("/api/auth/me").set("Cookie", initialCookie);
    expect(staleSessionResponse.status).toBe(401);

    const oldPasswordLogin = await request(app.server).post("/api/auth/login").send({
      email: "reset@example.com",
      password: "password123",
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await login("reset@example.com", "updated-password");
    expect(newPasswordLogin.status).toBe(200);
  });

  it("keeps password reset requests generic for unknown or unverified emails", async () => {
    await register("pending@example.com", "password123");

    const unknownResponse = await requestPasswordReset("missing@example.com");
    expect(unknownResponse.status).toBe(200);
    expect(unknownResponse.body.message).toContain("If the account exists and is verified");

    const unverifiedResponse = await requestPasswordReset("pending@example.com");
    expect(unverifiedResponse.status).toBe(200);
    expect(unverifiedResponse.body.status).toBe("password_reset_requested");

    const pendingToken = await prisma.emailVerificationToken.findFirst({
      where: {
        email: "pending@example.com",
        purpose: passwordResetPurpose,
      },
    });
    expect(pendingToken).toBeNull();
  });

  it("rejects invalid, expired, and exhausted password reset codes", async () => {
    await register("retry@example.com", "password123");
    await verify("retry@example.com");
    await requestPasswordReset("retry@example.com");

    const invalidResetResponse = await resetPassword("retry@example.com", "111111");
    expect(invalidResetResponse.status).toBe(400);

    const invalidToken = await prisma.emailVerificationToken.findFirstOrThrow({
      where: {
        email: "retry@example.com",
        purpose: passwordResetPurpose,
        consumedAt: null,
      },
    });
    expect(invalidToken.attempts).toBe(1);

    await prisma.emailVerificationToken.update({
      where: { id: invalidToken.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expiredResetResponse = await resetPassword("retry@example.com");
    expect(expiredResetResponse.status).toBe(400);

    await requestPasswordReset("retry@example.com");

    const exhaustedToken = await prisma.emailVerificationToken.findFirstOrThrow({
      where: {
        email: "retry@example.com",
        purpose: passwordResetPurpose,
        consumedAt: null,
      },
    });

    await prisma.emailVerificationToken.update({
      where: { id: exhaustedToken.id },
      data: {
        attempts: 5,
      },
    });

    const exhaustedResetResponse = await resetPassword("retry@example.com");
    expect(exhaustedResetResponse.status).toBe(403);
  });

  it("keeps tenant data isolated between accounts", async () => {
    await register("alpha@example.com", "password123");
    await verify("alpha@example.com");
    const alphaLogin = await login("alpha@example.com", "password123");
    const alphaCookie = alphaLogin.headers["set-cookie"]?.[0] as string;

    await register("beta@example.com", "password123");
    await verify("beta@example.com");
    const betaLogin = await login("beta@example.com", "password123");
    const betaCookie = betaLogin.headers["set-cookie"]?.[0] as string;

    const alphaMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", alphaCookie)
      .send({
        name: "Ada Lovelace",
        role: "Engineer",
        email: "ada@alpha.com",
        notes: "",
        active: true,
        projectIds: [],
      });

    const alphaProject = await request(app.server)
      .post("/api/projects")
      .set("Cookie", alphaCookie)
      .send({
        name: "Alpha migration",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [alphaMember.body.id],
      });

    const alphaTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", alphaCookie)
      .send({
        title: "Audit rollout",
        description: "",
        status: "todo",
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        startDate: "",
        projectId: alphaProject.body.id,
        assigneeId: alphaMember.body.id,
      });

    expect(alphaTask.status).toBe(200);

    const betaProjects = await request(app.server).get("/api/projects").set("Cookie", betaCookie);
    expect(betaProjects.status).toBe(200);
    expect(betaProjects.body).toHaveLength(0);

    const betaTasks = await request(app.server).get("/api/tasks").set("Cookie", betaCookie);
    expect(betaTasks.status).toBe(200);
    expect(betaTasks.body).toHaveLength(0);

    const betaMemberUpdate = await request(app.server)
      .put(`/api/members/${alphaMember.body.id}`)
      .set("Cookie", betaCookie)
      .send({
        name: "Intruder",
        role: "Manager",
        email: "intruder@beta.com",
        notes: "",
        active: true,
        projectIds: [],
      });

    expect(betaMemberUpdate.status).toBe(404);

    const betaDashboard = await request(app.server).get("/api/dashboard").set("Cookie", betaCookie);
    expect(betaDashboard.status).toBe(200);
    expect(betaDashboard.body.stats.projectCount).toBe(0);
    expect(betaDashboard.body.stats.taskCount).toBe(0);
  });

  it("rejects unauthenticated access", async () => {
    const response = await request(app.server).get("/api/projects");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
