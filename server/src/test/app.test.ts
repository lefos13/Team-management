/* Exercise registration, verification, and account isolation so the cloud multi-tenant contract is enforced end to end. */
import "dotenv/config";

import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { legalDocumentVersion, projectAiContextMaxLength, projectInputSchema } from "@team-management/shared";

import { createApp } from "../app.js";
import { getConfig } from "../config.js";
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
    await rm(getConfig().ATTACHMENTS_DIR, { recursive: true, force: true });
  });

  async function register(email: string, password: string, overrides: Record<string, unknown> = {}) {
    return request(app.server)
      .post("/api/auth/register")
      .send({ email, password, acceptedTerms: true, legalVersion: legalDocumentVersion, ...overrides });
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

  async function buildTaskImportWorkbook(rows: Array<Record<string, unknown>>) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tasks");
    /*
    Keep the test workbook aligned with the production import template so notes
    and optional dates are exercised through the same column order as real files.
    */
    worksheet.addRow(["Title", "Parent Task Title", "Member Emails", "Deadline", "Description", "Notes", "Status", "Defect", "Start Date"]);

    for (const row of rows) {
      worksheet.addRow([
        row.title,
        row.parentTaskTitle ?? "",
        row.memberEmails ?? row.memberEmail ?? "",
        row.deadline ?? "",
        row.description ?? "",
        row.notes ?? "",
        row.status ?? "",
        row.defect ?? "",
        row.startDate ?? "",
      ]);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async function readBinaryResponse(response: request.Response) {
    return Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
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
    expect(meResponse.body.termsVersion).toBe(legalDocumentVersion);
    expect(meResponse.body.privacyVersion).toBe(legalDocumentVersion);
    expect(meResponse.body.termsAcceptedAt).toBeTruthy();
  });

  /*
  Registration is the legal gate for public accounts, so the API must reject
  clients that bypass the UI checkbox and must refresh metadata while an email
  is still pending verification.
  */
  it("requires and stores legal acceptance during registration", async () => {
    const missingAcceptanceResponse = await request(app.server).post("/api/auth/register").send({
      email: "legal@example.com",
      password: "password123",
    });
    expect(missingAcceptanceResponse.status).toBe(400);

    const acceptedResponse = await request(app.server)
      .post("/api/auth/register")
      .set("User-Agent", "initial-browser")
      .send({
        email: "legal@example.com",
        password: "password123",
        acceptedTerms: true,
        legalVersion: legalDocumentVersion,
      });
    expect(acceptedResponse.status).toBe(200);

    const firstUser = await prisma.user.findUniqueOrThrow({ where: { email: "legal@example.com" } });
    expect(firstUser.termsVersion).toBe(legalDocumentVersion);
    expect(firstUser.privacyVersion).toBe(legalDocumentVersion);
    expect(firstUser.termsAcceptedAt).toBeTruthy();
    expect(firstUser.legalAcceptedUserAgent).toBe("initial-browser");

    const retryResponse = await request(app.server)
      .post("/api/auth/register")
      .set("User-Agent", "retry-browser")
      .send({
        email: "legal@example.com",
        password: "updated-password",
        acceptedTerms: true,
        legalVersion: legalDocumentVersion,
      });
    expect(retryResponse.status).toBe(200);

    const retriedUser = await prisma.user.findUniqueOrThrow({ where: { email: "legal@example.com" } });
    expect(retriedUser.legalAcceptedUserAgent).toBe("retry-browser");

    await verify("legal@example.com");
    const oldPasswordLogin = await request(app.server).post("/api/auth/login").send({
      email: "legal@example.com",
      password: "password123",
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await login("legal@example.com", "updated-password");
    expect(newPasswordLogin.status).toBe(200);
  });

  it("allows existing verified users with no stored legal metadata to sign in", async () => {
    await register("legacy@example.com", "password123");
    await verify("legacy@example.com");
    await prisma.user.update({
      where: { email: "legacy@example.com" },
      data: {
        termsAcceptedAt: null,
        termsVersion: null,
        privacyAcceptedAt: null,
        privacyVersion: null,
        legalAcceptedIp: null,
        legalAcceptedUserAgent: null,
      },
    });

    const loginResponse = await login("legacy@example.com", "password123");
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.termsAcceptedAt).toBeNull();
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
        aiContext: "Legacy API migration with customer-specific rollout rules.",
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
    expect(betaProjects.body.ownedProjects).toHaveLength(0);
    expect(betaProjects.body.sharedProjects).toHaveLength(0);

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

    const betaMemberDelete = await request(app.server).delete(`/api/members/${alphaMember.body.id}`).set("Cookie", betaCookie);
    expect(betaMemberDelete.status).toBe(404);

    const betaDashboard = await request(app.server).get("/api/dashboard").set("Cookie", betaCookie);
    expect(betaDashboard.status).toBe(200);
    expect(betaDashboard.body.stats.projectCount).toBe(0);
    expect(betaDashboard.body.stats.taskCount).toBe(0);
  });

  /*
  Invited task reads must use preview permission while edit-only actions remain
  blocked, otherwise read-only project members cannot open task detail pages.
  */
  it("lets invited preview members open tasks without edit controls", async () => {
    await register("owner-preview@example.com", "password123");
    await verify("owner-preview@example.com");
    const ownerLogin = await login("owner-preview@example.com", "password123");
    const ownerCookie = ownerLogin.headers["set-cookie"]?.[0] as string;

    await register("invited-preview@example.com", "password123");
    await verify("invited-preview@example.com");
    const invitedLogin = await login("invited-preview@example.com", "password123");
    const invitedCookie = invitedLogin.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", ownerCookie)
      .send({
        name: "Invited Preview",
        role: "Reviewer",
        email: "invited-preview@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", ownerCookie)
      .send({
        name: "Preview permissions",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });

    const task = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", ownerCookie)
      .send({
        title: "Read-only task",
        description: "Can be previewed by the invited member.",
        status: "todo",
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    const invitedUser = await prisma.user.findUniqueOrThrow({ where: { email: "invited-preview@example.com" } });
    const projectAccess = await prisma.projectAccess.create({
      data: {
        projectId: project.body.id,
        ownerUserId: ownerLogin.body.id,
        userId: invitedUser.id,
        teamMemberId: member.body.id,
        permission: "preview_own_tasks",
        status: "active",
      },
    });

    const listedTasks = await request(app.server).get("/api/tasks").set("Cookie", invitedCookie);
    expect(listedTasks.status).toBe(200);
    expect(listedTasks.body).toEqual([
      expect.objectContaining({ id: task.body.id, canEdit: false }),
    ]);

    const taskDetail = await request(app.server).get(`/api/tasks/${task.body.id}`).set("Cookie", invitedCookie);
    expect(taskDetail.status).toBe(200);
    expect(taskDetail.body).toEqual(expect.objectContaining({ id: task.body.id, canEdit: false }));

    const statusUpdate = await request(app.server)
      .patch(`/api/tasks/${task.body.id}/status`)
      .set("Cookie", invitedCookie)
      .send({ status: "done" });
    expect(statusUpdate.status).toBe(400);

    const updateAccess = await request(app.server)
      .patch(`/api/projects/${project.body.id}/access/${projectAccess.id}/permission`)
      .set("Cookie", ownerCookie)
      .send({ permission: "edit_own_tasks" });
    expect(updateAccess.status).toBe(200);
    expect(updateAccess.body.permission).toBe("edit_own_tasks");

    const sharedBeforeRevoke = await request(app.server).get("/api/projects").set("Cookie", invitedCookie);
    expect(sharedBeforeRevoke.body.sharedProjects).toEqual([
      expect.objectContaining({ id: project.body.id, permission: "edit_own_tasks" }),
    ]);

    const revokeAccess = await request(app.server)
      .post(`/api/projects/${project.body.id}/access/${projectAccess.id}/revoke`)
      .set("Cookie", ownerCookie);
    expect(revokeAccess.status).toBe(200);
    expect(revokeAccess.body.status).toBe("revoked");

    const sharedAfterRevoke = await request(app.server).get("/api/projects").set("Cookie", invitedCookie);
    expect(sharedAfterRevoke.body.sharedProjects).toHaveLength(0);
  });

  /*
  Exercise project reads and writes with agent context so the new field stays
  aligned across create, detail fetch, update, and list responses.
  */
  it("stores and returns project AI context", async () => {
    await register("projects@example.com", "password123");
    await verify("projects@example.com");
    const loginResponse = await login("projects@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Project Owner",
        role: "Lead",
        email: "owner@projects.test",
        notes: "",
        active: true,
        projectIds: [],
      });

    /*
    Use content larger than the previous short validation cap so repository
    guidance files can be pasted into project context without rejection.
    */
    const largeAiContext = [
      "# Agent Guidelines",
      "All architecture, database schema, and code changes must stay aligned with deploy/production/deploy.sh.",
      "Keep Prisma migrations backward compatible and preserve existing production data.",
    ].join("\n").repeat(40);
    expect(largeAiContext.length).toBeGreaterThan(4000);

    const createProject = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Agent rollout",
        description: "Coordinate automation across teams.",
        aiContext: largeAiContext,
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });

    expect(createProject.status).toBe(200);
    expect(createProject.body.aiContext).toBe(largeAiContext);

    const detailProject = await request(app.server)
      .get(`/api/projects/${createProject.body.id}`)
      .set("Cookie", cookie);

    expect(detailProject.status).toBe(200);
    expect(detailProject.body.aiContext).toBe(createProject.body.aiContext);

    const updateProject = await request(app.server)
      .put(`/api/projects/${createProject.body.id}`)
      .set("Cookie", cookie)
      .send({
        name: "Agent rollout",
        description: "Coordinate automation across teams.",
        aiContext: "Use the project context for agents, prefer release-safe changes, and highlight risky assumptions.",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });

    expect(updateProject.status).toBe(200);
    expect(updateProject.body.aiContext).toBe(
      "Use the project context for agents, prefer release-safe changes, and highlight risky assumptions.",
    );

    const listProjects = await request(app.server).get("/api/projects").set("Cookie", cookie);
    expect(listProjects.status).toBe(200);
    expect(listProjects.body.ownedProjects[0].aiContext).toBe(updateProject.body.aiContext);
  });

  /*
  Project delivery dates are calendar markers rather than tasks, so they remain
  optional project metadata and still appear as high-importance schedule events.
  */
  it("stores project go-live and phase dates as important calendar markers", async () => {
    await register("markers@example.com", "password123");
    await verify("markers@example.com");
    const loginResponse = await login("markers@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;
    const goLiveDate = new Date("2030-06-01T09:00:00.000Z").toISOString();
    const phaseDate = new Date("2030-05-15T09:00:00.000Z").toISOString();

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Marker launch",
        description: "",
        aiContext: "",
        goLiveDate,
        phaseDates: [{ name: "Phase 1", date: phaseDate }],
        status: "active",
        color: "#16A98B",
        memberIds: [],
      });

    expect(project.status).toBe(200);
    expect(project.body.goLiveDate).toBe(goLiveDate);
    expect(project.body.phaseDates).toEqual([expect.objectContaining({ name: "Phase 1", date: phaseDate })]);

    const calendar = await request(app.server)
      .get(`/api/calendar/events?from=${encodeURIComponent("2030-05-01T00:00:00.000Z")}&to=${encodeURIComponent("2030-06-30T23:59:59.999Z")}`)
      .set("Cookie", cookie);
    expect(calendar.status).toBe(200);
    expect(calendar.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ projectId: project.body.id, eventType: "project_phase", importance: "very_important" }),
      expect.objectContaining({ projectId: project.body.id, eventType: "project_go_live", importance: "very_important" }),
    ]));
  });

  /*
  Task share links intentionally bypass login only for the linked task preview;
  the URL stores the raw token while persistence keeps only the token hash.
  */
  it("creates public task share links that expose read-only task previews", async () => {
    await register("share-owner@example.com", "password123");
    await verify("share-owner@example.com");
    const loginResponse = await login("share-owner@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Share Owner",
        role: "Lead",
        email: "share-owner-member@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });
    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Shared preview project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });
    const task = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Preview this task",
        description: "Visible to guests with the link.",
        notes: "Preview notes.",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    const shareLink = await request(app.server)
      .post(`/api/tasks/${task.body.id}/share-links`)
      .set("Cookie", cookie);
    expect(shareLink.status).toBe(200);
    expect(shareLink.body.url).toContain("/share/tasks/");

    const token = new URL(shareLink.body.url).pathname.split("/").pop();
    const publicPreview = await request(app.server).get(`/api/task-shares/${token}`);
    expect(publicPreview.status).toBe(200);
    expect(publicPreview.body).toEqual(expect.objectContaining({
      id: task.body.id,
      title: "Preview this task",
      canEdit: false,
      canManageAssignees: false,
    }));
  });

  /*
  Keep the oversized context guard explicit so abuse protection stays far above
  normal project guidance documents but still has a deterministic boundary.
  */
  it("rejects only oversized project AI context payloads", () => {
    const maxLengthAiContext = "a".repeat(projectAiContextMaxLength);
    const oversizedAiContext = `${maxLengthAiContext}a`;
    const baseProject = {
      name: "Large context",
      description: "",
      status: "active",
      color: "#16A98B",
      memberIds: [],
    };

    expect(projectInputSchema.safeParse({ ...baseProject, aiContext: maxLengthAiContext }).success).toBe(true);
    expect(projectInputSchema.safeParse({ ...baseProject, aiContext: oversizedAiContext }).success).toBe(false);
  });

  /*
  Exercise completion tracking, defect filtering, and export generation together
  because these features all depend on the same task status and metadata fields.
  */
  it("tracks completion dates, member completed counts, dashboard ranges, and filtered exports", async () => {
    await register("tasks@example.com", "password123");
    await verify("tasks@example.com");
    const loginResponse = await login("tasks@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "John Tester",
        role: "QA",
        email: "john@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });
    const secondMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Mia Reviewer",
        role: "Developer",
        email: "mia@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Project A",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id, secondMember.body.id],
      });

    const task = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Fix login bug",
        description: "Regression on sign in",
        status: "todo",
        isDefect: true,
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
        assigneeIds: [member.body.id, secondMember.body.id],
      });

    expect(task.status).toBe(200);
    expect(task.body.isDefect).toBe(true);
    expect(task.body.completedAt).toBeNull();
    expect(task.body.assigneeId).toBe(member.body.id);
    expect(task.body.assigneeIds).toEqual([member.body.id, secondMember.body.id]);
    expect(task.body.assigneeNames).toEqual(["John Tester", "Mia Reviewer"]);

    const doneTask = await request(app.server)
      .patch(`/api/tasks/${task.body.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "done" });

    expect(doneTask.status).toBe(200);
    expect(doneTask.body.completedAt).toBeTruthy();

    const members = await request(app.server).get("/api/members").set("Cookie", cookie);
    expect(members.status).toBe(200);
    expect(members.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: member.body.id, openTaskCount: 0, completedTaskCount: 1 }),
        expect.objectContaining({ id: secondMember.body.id, openTaskCount: 0, completedTaskCount: 1 }),
      ]),
    );

    const range = new URLSearchParams({
      completedFrom: new Date(Date.now() - 60_000).toISOString(),
      completedTo: new Date(Date.now() + 60_000).toISOString(),
    });
    const dashboard = await request(app.server).get(`/api/dashboard?${range.toString()}`).set("Cookie", cookie);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.recentCompletions.count).toBe(1);
    expect(dashboard.body.recentCompletions.tasks[0].title).toBe("Fix login bug");
    expect(dashboard.body.recentCompletions.tasks[0].assigneeNames).toEqual(["John Tester", "Mia Reviewer"]);

    const reopenedTask = await request(app.server)
      .patch(`/api/tasks/${task.body.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "todo" });

    expect(reopenedTask.status).toBe(200);
    expect(reopenedTask.body.completedAt).toBeNull();

    const exportQuery = new URLSearchParams({
      projectId: project.body.id,
      assigneeId: secondMember.body.id,
      status: "todo",
      isDefect: "true",
    });
    const exportResponse = await request(app.server)
      .get(`/api/tasks/export?${exportQuery.toString()}`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("spreadsheetml.sheet");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);
    const worksheet = workbook.getWorksheet("Tasks");

    expect(worksheet).toBeTruthy();
    expect(worksheet?.getCell("A7").value).toBe("Fix login bug");
    expect(worksheet?.getCell("D7").value).toBe("John Tester, Mia Reviewer");
    expect(worksheet?.getCell("F7").value).toBe("Yes");

    const nonDefectTasks = await request(app.server).get("/api/tasks?isDefect=false").set("Cookie", cookie);
    expect(nonDefectTasks.status).toBe(200);
    expect(nonDefectTasks.body).toHaveLength(0);
  });

  /*
  Member deletion removes assignment links while preserving task rows, so the
  primary assignee compatibility column must either promote another remaining
  assignee or become null when no assignees remain.
  */
  it("deletes members while preserving and safely unassigning their tasks", async () => {
    await register("delete-member@example.com", "password123");
    await verify("delete-member@example.com");
    const loginResponse = await login("delete-member@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const primaryMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Primary Member",
        role: "Developer",
        email: "primary@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });
    const secondaryMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Secondary Member",
        role: "Reviewer",
        email: "secondary@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });
    const stablePrimaryMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Stable Primary",
        role: "Lead",
        email: "stable@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Deletion safety",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [primaryMember.body.id, secondaryMember.body.id, stablePrimaryMember.body.id],
      });

    const soloTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Solo assignment",
        description: "",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: primaryMember.body.id,
      });
    const promotedTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Promote another assignee",
        description: "",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: primaryMember.body.id,
        assigneeIds: [primaryMember.body.id, secondaryMember.body.id],
      });
    const nonPrimaryTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Remove non-primary assignee",
        description: "",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: stablePrimaryMember.body.id,
        assigneeIds: [stablePrimaryMember.body.id, primaryMember.body.id],
      });

    expect(soloTask.status).toBe(200);
    expect(promotedTask.status).toBe(200);
    expect(nonPrimaryTask.status).toBe(200);

    const deleted = await request(app.server).delete(`/api/members/${primaryMember.body.id}`).set("Cookie", cookie);

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({
      id: primaryMember.body.id,
      deleted: true,
      unassignedTaskCount: 1,
      reassignedPrimaryTaskCount: 1,
      removedProjectCount: 1,
    });

    const tasks = await request(app.server).get("/api/tasks").set("Cookie", cookie);
    expect(tasks.status).toBe(200);

    const solo = tasks.body.find((task: { id: string }) => task.id === soloTask.body.id);
    const promoted = tasks.body.find((task: { id: string }) => task.id === promotedTask.body.id);
    const nonPrimary = tasks.body.find((task: { id: string }) => task.id === nonPrimaryTask.body.id);

    expect(solo).toEqual(expect.objectContaining({ assigneeId: null, assigneeName: null, assigneeIds: [], assigneeNames: [] }));
    expect(promoted).toEqual(
      expect.objectContaining({
        assigneeId: secondaryMember.body.id,
        assigneeIds: [secondaryMember.body.id],
        assigneeNames: ["Secondary Member"],
      }),
    );
    expect(nonPrimary).toEqual(
      expect.objectContaining({
        assigneeId: stablePrimaryMember.body.id,
        assigneeIds: [stablePrimaryMember.body.id],
        assigneeNames: ["Stable Primary"],
      }),
    );

    const members = await request(app.server).get("/api/members").set("Cookie", cookie);
    expect(members.status).toBe(200);
    expect(members.body.map((member: { id: string }) => member.id)).not.toContain(primaryMember.body.id);

    const filteredByDeletedMember = await request(app.server)
      .get(`/api/tasks?assigneeId=${primaryMember.body.id}`)
      .set("Cookie", cookie);
    expect(filteredByDeletedMember.status).toBe(200);
    expect(filteredByDeletedMember.body).toHaveLength(0);
  });

  /*
  Keep notes and optional dates flowing through create, update, detail, export,
  and date-based summaries so undated tasks stay usable without polluting deadline views.
  */
  it("supports task notes, optional dates, and date-aware dashboard filtering", async () => {
    await register("notes@example.com", "password123");
    await verify("notes@example.com");
    const loginResponse = await login("notes@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Casey Planner",
        role: "Coordinator",
        email: "casey@example.com",
        notes: "",
        active: true,
        projectIds: [],
      });
    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Optional dates project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });

    const undatedTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Draft rollout plan",
        description: "Prepare the initial scope.",
        notes: "Only visible in the detail screen.",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    expect(undatedTask.status).toBe(200);
    expect(undatedTask.body.deadline).toBeNull();
    expect(undatedTask.body.startDate).toBeNull();
    expect(undatedTask.body.notes).toBe("Only visible in the detail screen.");

    const detailResponse = await request(app.server)
      .get(`/api/tasks/${undatedTask.body.id}`)
      .set("Cookie", cookie);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.notes).toBe("Only visible in the detail screen.");
    expect(detailResponse.body.deadline).toBeNull();
    expect(detailResponse.body.startDate).toBeNull();

    const updateResponse = await request(app.server)
      .put(`/api/tasks/${undatedTask.body.id}`)
      .set("Cookie", cookie)
      .send({
        title: "Draft rollout plan",
        description: "Prepare the initial scope.",
        notes: "Expanded implementation notes.",
        status: "todo",
        isDefect: false,
        deadline: "",
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.notes).toBe("Expanded implementation notes.");

    const datedTask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Scheduled release",
        description: "",
        notes: "",
        status: "todo",
        isDefect: false,
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    expect(datedTask.status).toBe(200);

    const calendarResponse = await request(app.server).get("/api/calendar/events").set("Cookie", cookie);
    expect(calendarResponse.status).toBe(200);
    expect(calendarResponse.body).toHaveLength(1);
    expect(calendarResponse.body[0].taskId).toBe(datedTask.body.id);

    const dashboardResponse = await request(app.server).get("/api/dashboard").set("Cookie", cookie);
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.upcomingTasks).toHaveLength(1);
    expect(dashboardResponse.body.upcomingTasks[0].id).toBe(datedTask.body.id);

    const exportResponse = await request(app.server)
      .get(`/api/tasks/export?projectId=${project.body.id}`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(exportResponse.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);
    const worksheet = workbook.getWorksheet("Tasks");
    const taskRows = [7, 8].map((rowNumber) => ({
      title: worksheet?.getCell(`A${rowNumber}`).value,
      notes: worksheet?.getCell(`M${rowNumber}`).value,
    }));
    expect(taskRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Draft rollout plan",
          notes: "Expanded implementation notes.",
        }),
      ]),
    );
  });

  /*
  Exercise the one-level hierarchy contract through create, update, list, and
  delete so production data keeps subtasks without allowing nested children.
  */
  it("supports one-level subtasks and preserves them when a parent is deleted", async () => {
    await register("subtasks@example.com", "password123");
    await verify("subtasks@example.com");
    const loginResponse = await login("subtasks@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Subtask Owner",
        role: "Lead",
        email: "owner@subtasks.test",
        notes: "",
        active: true,
        projectIds: [],
      });
    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Hierarchy project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const parent = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Parent rollout",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    expect(parent.status).toBe(200);
    expect(parent.body.parentTaskId).toBeNull();

    const subtask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Subtask checklist",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
        parentTaskId: parent.body.id,
      });

    expect(subtask.status).toBe(200);
    expect(subtask.body.parentTaskId).toBe(parent.body.id);
    expect(subtask.body.parentTaskTitle).toBe("Parent rollout");

    const nestedSubtask = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Nested child",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
        parentTaskId: subtask.body.id,
      });

    expect(nestedSubtask.status).toBe(400);

    const moveParentUnderChild = await request(app.server)
      .put(`/api/tasks/${parent.body.id}`)
      .set("Cookie", cookie)
      .send({
        title: "Parent rollout",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
        parentTaskId: subtask.body.id,
      });

    expect(moveParentUnderChild.status).toBe(400);

    const listedTasks = await request(app.server).get("/api/tasks").set("Cookie", cookie);
    expect(listedTasks.status).toBe(200);
    expect(listedTasks.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parent.body.id, parentTaskId: null }),
        expect.objectContaining({ id: subtask.body.id, parentTaskId: parent.body.id, parentTaskTitle: "Parent rollout" }),
      ]),
    );

    const filteredTasks = await request(app.server)
      .get(`/api/tasks?projectId=${project.body.id}`)
      .set("Cookie", cookie);
    expect(filteredTasks.status).toBe(200);
    expect(filteredTasks.body.map((task: { id: string }) => task.id)).toEqual(
      expect.arrayContaining([parent.body.id, subtask.body.id]),
    );

    const completeParent = await request(app.server)
      .patch(`/api/tasks/${parent.body.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "done" });

    expect(completeParent.status).toBe(200);
    expect(completeParent.body.status).toBe("done");

    const cascadedSubtasks = await prisma.task.findMany({
      where: { parentTaskId: parent.body.id },
      orderBy: { title: "asc" },
    });
    expect(cascadedSubtasks).toHaveLength(1);
    expect(cascadedSubtasks[0].status).toBe("done");
    expect(cascadedSubtasks[0].completedAt).toBeTruthy();

    const deleteParent = await request(app.server).delete(`/api/tasks/${parent.body.id}`).set("Cookie", cookie);
    expect(deleteParent.status).toBe(204);

    const promotedSubtask = await prisma.task.findUniqueOrThrow({
      where: { id: subtask.body.id },
    });
    expect(promotedSubtask.parentTaskId).toBeNull();
  });

  /*
  Verify task attachments can move between active originals and done archives
  without leaving the task API, filesystem, or access controls out of sync.
  */
  it("supports attachment upload, preview, archiving, restore, and cleanup", async () => {
    await register("attachments@example.com", "password123");
    await verify("attachments@example.com");
    const loginResponse = await login("attachments@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    await register("other-user@example.com", "password123");
    await verify("other-user@example.com");
    const otherLogin = await login("other-user@example.com", "password123");
    const otherCookie = otherLogin.headers["set-cookie"]?.[0] as string;

    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Attachment Owner",
        role: "Lead",
        email: "owner@attachments.test",
        notes: "",
        active: true,
        projectIds: [],
      });
    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Attachments project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [member.body.id],
      });
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const parent = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Parent task",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });
    const child = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Child task",
        description: "",
        status: "todo",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
        parentTaskId: parent.body.id,
      });

    const uploadParent = await request(app.server)
      .post(`/api/tasks/${parent.body.id}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("preview-ready note"), {
        filename: "note.txt",
        contentType: "text/plain",
      })
      .attach("file", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M9QDwADhgGA0sP7WQAAAABJRU5ErkJggg==", "base64"), {
        filename: "pixel.png",
        contentType: "image/png",
      });

    expect(uploadParent.status).toBe(200);
    expect(uploadParent.body.attachments).toHaveLength(2);
    expect(uploadParent.body.attachmentsPreviewAvailable).toBe(true);

    const uploadChild = await request(app.server)
      .post(`/api/tasks/${child.body.id}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("child preview"), {
        filename: "child.txt",
        contentType: "text/plain",
      });

    expect(uploadChild.status).toBe(200);
    expect(uploadChild.body.attachments).toHaveLength(1);

    const noteAttachment = uploadParent.body.attachments.find((attachment: { filename: string }) => attachment.filename === "note.txt");
    const previewResponse = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}/preview`)
      .set("Cookie", cookie);
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.text).toBe("preview-ready note");

    const downloadResponse = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}/download`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloadResponse.status).toBe(200);
    expect((await readBinaryResponse(downloadResponse)).toString("utf8")).toBe("preview-ready note");

    const unauthorizedDownload = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}/download`)
      .set("Cookie", otherCookie);
    expect(unauthorizedDownload.status).toBe(404);

    const oversizeUpload = await request(app.server)
      .post(`/api/tasks/${parent.body.id}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1, 1), {
        filename: "too-large.bin",
        contentType: "application/octet-stream",
      });
    expect(oversizeUpload.status).toBeGreaterThanOrEqual(400);

    const completeParent = await request(app.server)
      .patch(`/api/tasks/${parent.body.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "done" });
    expect(completeParent.status).toBe(200);
    expect(completeParent.body.attachmentArchive).toBeTruthy();
    expect(completeParent.body.attachmentsPreviewAvailable).toBe(false);

    const doneParent = await prisma.task.findUniqueOrThrow({
      where: { id: parent.body.id },
      include: { archive: true, attachments: true },
    });
    const doneChild = await prisma.task.findUniqueOrThrow({
      where: { id: child.body.id },
      include: { archive: true, attachments: true },
    });
    expect(doneParent.archive?.sizeBytes).toBeGreaterThan(0);
    expect(doneChild.archive?.sizeBytes).toBeGreaterThan(0);

    const donePreview = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}/preview`)
      .set("Cookie", cookie);
    expect(donePreview.status).toBe(400);

    const archiveResponse = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/archive`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(archiveResponse.status).toBe(200);
    expect((await readBinaryResponse(archiveResponse)).byteLength).toBeGreaterThan(0);

    const uploadWhileDone = await request(app.server)
      .post(`/api/tasks/${parent.body.id}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("blocked"), {
        filename: "blocked.txt",
        contentType: "text/plain",
      });
    expect(uploadWhileDone.status).toBe(400);

    const reopenedParent = await request(app.server)
      .patch(`/api/tasks/${parent.body.id}/status`)
      .set("Cookie", cookie)
      .send({ status: "todo" });
    expect(reopenedParent.status).toBe(200);
    expect(reopenedParent.body.attachmentArchive).toBeNull();
    expect(reopenedParent.body.attachmentsPreviewAvailable).toBe(true);

    const restoredPreview = await request(app.server)
      .get(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}/preview`)
      .set("Cookie", cookie);
    expect(restoredPreview.status).toBe(200);
    expect(restoredPreview.text).toBe("preview-ready note");

    const deleteAttachment = await request(app.server)
      .delete(`/api/tasks/${parent.body.id}/attachments/${noteAttachment.id}`)
      .set("Cookie", cookie);
    expect(deleteAttachment.status).toBe(200);
    expect(deleteAttachment.body.attachments).toHaveLength(1);

    const deleteParent = await request(app.server)
      .delete(`/api/tasks/${parent.body.id}`)
      .set("Cookie", cookie);
    expect(deleteParent.status).toBe(204);

    const deletedTask = await prisma.task.findUnique({
      where: { id: parent.body.id },
    });
    expect(deletedTask).toBeNull();
    await rm(getConfig().ATTACHMENTS_DIR, { recursive: true, force: true });
  });

  it("supports review/testing status across API, dashboard counts, and import aliases", async () => {
    await register("review-status@example.com", "password123");
    await verify("review-status@example.com");
    const loginResponse = await login("review-status@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Review status project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [],
      });
    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Review Owner",
        role: "QA",
        email: "review-owner@example.com",
        notes: "",
        active: true,
        projectIds: [project.body.id],
      });
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const task = await request(app.server)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({
        title: "Run acceptance tests",
        description: "",
        status: "review_testing",
        deadline,
        startDate: "",
        projectId: project.body.id,
        assigneeId: member.body.id,
      });

    expect(task.status).toBe(200);
    expect(task.body.status).toBe("review_testing");

    const dashboard = await request(app.server).get("/api/dashboard").set("Cookie", cookie);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.tasksByStatus).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "review_testing", count: 1 })]),
    );

    const workbook = await buildTaskImportWorkbook([
      {
        title: "Imported testing task",
        memberEmail: "review-owner@example.com",
        deadline: new Date(2026, 0, 15),
        status: "Review",
      },
    ]);
    const importResponse = await request(app.server)
      .post(`/api/projects/${project.body.id}/tasks/import`)
      .set("Cookie", cookie)
      .attach("file", workbook, {
        filename: "tasks.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(importResponse.status).toBe(200);
    expect(importResponse.body.inserted).toBe(1);

    const importedTask = await prisma.task.findFirstOrThrow({
      where: {
        userId: loginResponse.body.id,
        title: "Imported testing task",
      },
    });
    expect(importedTask.status).toBe("review_testing");
  });

  /*
  Exercise the Excel task import flow through the HTTP boundary so file checks,
  project-member validation, duplicate skipping, and date-only normalization stay aligned.
  */
  it("downloads task import templates and imports valid Excel tasks while skipping duplicates", async () => {
    await register("import@example.com", "password123");
    await verify("import@example.com");
    const loginResponse = await login("import@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Import project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [],
      });
    const member = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Import Owner",
        role: "Lead",
        email: "owner@import.test",
        notes: "",
        active: true,
        projectIds: [project.body.id],
      });
    const secondMember = await request(app.server)
      .post("/api/members")
      .set("Cookie", cookie)
      .send({
        name: "Import Reviewer",
        role: "Reviewer",
        email: "reviewer@import.test",
        notes: "",
        active: true,
        projectIds: [project.body.id],
      });

    expect(member.status).toBe(200);
    expect(secondMember.status).toBe(200);

    const templateResponse = await request(app.server)
      .get(`/api/projects/${project.body.id}/tasks/import-template?variant=blank`)
      .set("Cookie", cookie);

    expect(templateResponse.status).toBe(200);
    expect(templateResponse.headers["content-type"]).toContain("spreadsheetml.sheet");

    const deadline = new Date(2026, 0, 15);
    const startDate = new Date(2026, 0, 14);
    const workbook = await buildTaskImportWorkbook([
      {
        title: "Imported planning task",
        memberEmail: "owner@import.test; reviewer@import.test",
        deadline,
        description: "Created from Excel",
        status: "To Do",
        defect: "no",
        startDate,
      },
      {
        title: "Imported planning subtask",
        parentTaskTitle: "Imported planning task",
        memberEmail: "owner@import.test",
        deadline,
        description: "Created as a child row",
        status: "todo",
        defect: "no",
        startDate,
      },
    ]);

    const importResponse = await request(app.server)
      .post(`/api/projects/${project.body.id}/tasks/import`)
      .set("Cookie", cookie)
      .attach("file", workbook, {
        filename: "tasks.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(importResponse.status).toBe(200);
    expect(importResponse.body.inserted).toBe(2);
    expect(importResponse.body.skipped).toBe(0);

    const importedTask = await prisma.task.findFirstOrThrow({
      where: {
        userId: loginResponse.body.id,
        title: "Imported planning task",
      },
      include: {
        taskAssignees: {
          select: { teamMemberId: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    expect(importedTask.startDate?.getHours()).toBe(9);
    expect(importedTask.deadline?.getHours()).toBe(17);
    expect(importedTask.assigneeId).toBe(member.body.id);
    expect(importedTask.taskAssignees.map((assignment) => assignment.teamMemberId)).toEqual(
      expect.arrayContaining([member.body.id, secondMember.body.id]),
    );

    const importedSubtask = await prisma.task.findFirstOrThrow({
      where: {
        userId: loginResponse.body.id,
        title: "Imported planning subtask",
      },
    });
    expect(importedSubtask.parentTaskId).toBe(importedTask.id);

    const duplicateResponse = await request(app.server)
      .post(`/api/projects/${project.body.id}/tasks/import`)
      .set("Cookie", cookie)
      .attach("file", workbook, {
        filename: "tasks.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(duplicateResponse.status).toBe(200);
    expect(duplicateResponse.body.inserted).toBe(0);
    expect(duplicateResponse.body.skipped).toBe(2);
  });

  it("rejects task imports with members outside the selected project before inserting rows", async () => {
    await register("bad-import@example.com", "password123");
    await verify("bad-import@example.com");
    const loginResponse = await login("bad-import@example.com", "password123");
    const cookie = loginResponse.headers["set-cookie"]?.[0] as string;

    const project = await request(app.server)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        name: "Strict import project",
        description: "",
        status: "active",
        color: "#16A98B",
        memberIds: [],
      });

    const workbook = await buildTaskImportWorkbook([
      {
        title: "Should not import",
        memberEmail: "missing@import.test",
        deadline: new Date(2026, 0, 15),
      },
    ]);

    const importResponse = await request(app.server)
      .post(`/api/projects/${project.body.id}/tasks/import`)
      .set("Cookie", cookie)
      .attach("file", workbook, {
        filename: "tasks.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(importResponse.status).toBe(400);
    expect(importResponse.body.error.code).toBe("BAD_REQUEST");

    const insertedCount = await prisma.task.count({
      where: {
        userId: loginResponse.body.id,
      },
    });
    expect(insertedCount).toBe(0);
  });

  it("backfills existing done task completion dates in the migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260427120000_task_completion_defects/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("ADD COLUMN \"completedAt\"");
    expect(migration).toContain("UPDATE \"Task\" SET \"completedAt\" = \"updatedAt\" WHERE \"status\" = 'done'");
    expect(migration).toContain("Task_completion_metadata_trigger");
  });

  it("backfills task assignees in the multi-assignee migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260428120000_task_multi_assignees/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE \"TaskAssignee\"");
    expect(migration).toContain("SELECT \"id\", \"assigneeId\"");
    expect(migration).toContain("Task_primary_assignee_sync_trigger");
  });

  it("makes task assignees nullable for member deletion in a production-safe migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260503143000_nullable_task_assignees/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("ALTER TABLE \"Task\" ALTER COLUMN \"assigneeId\" DROP NOT NULL");
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain("IF NEW.\"assigneeId\" IS NOT NULL THEN");
  });

  it("adds nullable task hierarchy links in a production-safe migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260430120000_task_subtasks/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("ADD COLUMN \"parentTaskId\" TEXT");
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("Task_parentTaskId_not_self_check");
  });

  it("adds nullable project AI context in a production-safe migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260501180000_project_ai_context/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain('ADD COLUMN "aiContext" TEXT');
  });

  it("rejects unauthenticated access", async () => {
    const response = await request(app.server).get("/api/projects");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
