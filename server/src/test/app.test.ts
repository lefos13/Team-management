/* Exercise registration, verification, and account isolation so the cloud multi-tenant contract is enforced end to end. */
import "dotenv/config";

import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
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

  async function buildTaskImportWorkbook(rows: Array<Record<string, unknown>>) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tasks");
    worksheet.addRow(["Title", "Parent Task Title", "Member Emails", "Deadline", "Description", "Status", "Defect", "Start Date"]);

    for (const row of rows) {
      worksheet.addRow([
        row.title,
        row.parentTaskTitle ?? "",
        row.memberEmail,
        row.deadline,
        row.description ?? "",
        row.status ?? "",
        row.defect ?? "",
        row.startDate ?? "",
      ]);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
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
        status: "Review/Testing",
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
    expect(importedTask.deadline.getHours()).toBe(17);
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

  it("adds nullable task hierarchy links in a production-safe migration", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260430120000_task_subtasks/migration.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("ADD COLUMN \"parentTaskId\" TEXT");
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("Task_parentTaskId_not_self_check");
  });

  it("rejects unauthenticated access", async () => {
    const response = await request(app.server).get("/api/projects");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
