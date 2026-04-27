/*
Populate one verified demo workspace with realistic projects, members, and tasks
so the local dashboard, pagination, calendar, export, and import surfaces have
enough data to show their full behavior without touching non-demo accounts.
*/
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const demoEmail = "demo@team-management.local";
const demoPassword = "demo-password";

const members = [
  ["Alex Kun", "Project Manager", "alex.demo@example.com"],
  ["Maya Chen", "Product Designer", "maya.demo@example.com"],
  ["Nikos Aris", "Backend Engineer", "nikos.demo@example.com"],
  ["Sofia Reed", "Frontend Engineer", "sofia.demo@example.com"],
  ["Iris Patel", "QA Lead", "iris.demo@example.com"],
  ["Jon Bell", "Support Specialist", "jon.demo@example.com"],
  ["Elena Park", "Marketing Lead", "elena.demo@example.com"],
  ["Chris Stone", "Data Analyst", "chris.demo@example.com"],
] as const;

const projects = [
  ["Website Redesign", "Refresh the marketing site and onboarding flow.", "active", "#0F766E", [0, 1, 3, 4]],
  ["Mobile App", "Ship a focused mobile companion for task updates.", "active", "#2563EB", [0, 2, 3, 4]],
  ["API Stabilization", "Harden imports, exports, and reporting endpoints.", "active", "#7C3AED", [0, 2, 4, 7]],
  ["Customer Migration", "Move legacy customer workspaces into the new platform.", "on_hold", "#F59E0B", [0, 5, 7]],
  ["Marketing Campaign", "Coordinate launch assets, content, and reporting.", "active", "#EF4444", [1, 6, 7]],
  ["Internal Operations", "Improve recurring team processes and visibility.", "completed", "#16A34A", [0, 5, 6]],
] as const;

const taskTitles = [
  "Define project scope",
  "Research and planning",
  "Create wireframes",
  "Design system",
  "API integration",
  "Frontend development",
  "UI/UX review",
  "Code review",
  "Performance test",
  "Project kickoff",
  "Team onboarding",
  "Environment setup",
  "API documentation",
  "Release checklist",
  "Stakeholder update",
  "Analytics review",
] as const;

function daysFromNow(days: number, hour = 17) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function startBefore(deadline: Date, days = 2) {
  const date = new Date(deadline);
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function removeExistingDemoUser() {
  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!user) {
    return;
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.task.deleteMany({ where: { userId: user.id } }),
    prisma.projectMember.deleteMany({
      where: {
        OR: [{ project: { userId: user.id } }, { teamMember: { userId: user.id } }],
      },
    }),
    prisma.project.deleteMany({ where: { userId: user.id } }),
    prisma.teamMember.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy server/.env.example to server/.env before running this script.");
  }

  await removeExistingDemoUser();

  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash: await bcrypt.hash(demoPassword, 12),
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const createdMembers = [];
  for (const [name, role, email] of members) {
    createdMembers.push(
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          name,
          role,
          email,
          notes: `${role} for the demo workspace.`,
          active: true,
        },
      }),
    );
  }

  const createdProjects = [];
  for (const [name, description, status, color, memberIndexes] of projects) {
    createdProjects.push(
      await prisma.project.create({
        data: {
          userId: user.id,
          name,
          description,
          status,
          color,
          projectMembers: {
            createMany: {
              data: memberIndexes.map((index) => ({
                teamMemberId: createdMembers[index].id,
              })),
            },
          },
        },
      }),
    );
  }

  let taskIndex = 0;
  for (const [projectIndex, project] of createdProjects.entries()) {
    const memberIndexes = projects[projectIndex][4];

    for (let index = 0; index < 7; index += 1) {
      const status = (["todo", "in_progress", "blocked", "done"] as const)[(index + projectIndex) % 4];
      const deadline = daysFromNow(index - 3 + projectIndex * 2, 10 + (index % 7));
      const completedAt = status === "done" ? daysFromNow(-index, 15) : null;
      const assignee = createdMembers[memberIndexes[index % memberIndexes.length]];

      await prisma.task.create({
        data: {
          userId: user.id,
          projectId: project.id,
          assigneeId: assignee.id,
          title: `${taskTitles[taskIndex % taskTitles.length]} - ${project.name}`,
          description: `Demo task for ${project.name}. Use it to inspect dashboard cards, tables, calendar entries, and imports.`,
          status,
          isDefect: taskIndex % 6 === 0,
          startDate: startBefore(deadline, 2 + (index % 3)),
          deadline,
          completedAt,
        },
      });

      taskIndex += 1;
    }
  }

  console.log("Demo account seeded.");
  console.log(`Email: ${demoEmail}`);
  console.log(`Password: ${demoPassword}`);
  console.log(`Projects: ${createdProjects.length}`);
  console.log(`Members: ${createdMembers.length}`);
  console.log(`Tasks: ${taskIndex}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
