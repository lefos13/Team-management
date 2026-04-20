import { z } from "zod";

export const taskStatusValues = ["todo", "in_progress", "blocked", "done"] as const;
export const projectStatusValues = ["active", "on_hold", "completed"] as const;
export const authStatusValues = ["verification_required", "verified"] as const;

export const taskStatusSchema = z.enum(taskStatusValues);
export const projectStatusSchema = z.enum(projectStatusValues);
export const authStatusSchema = z.enum(authStatusValues);

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerInputSchema = loginInputSchema;

export const verifyEmailInputSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
});

export const resendVerificationInputSchema = z.object({
  email: z.string().email(),
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: projectStatusSchema,
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/).optional().or(z.literal("")),
  memberIds: z.array(z.string().min(1)).default([]),
});

export const memberInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
  projectIds: z.array(z.string().min(1)).default([]),
});

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    status: taskStatusSchema,
    deadline: z.string().datetime(),
    startDate: z.string().datetime().optional().nullable().or(z.literal("")),
    projectId: z.string().min(1),
    assigneeId: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.startDate !== "" && new Date(value.startDate) > new Date(value.deadline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date must be before deadline.",
        path: ["startDate"],
      });
    }
  });

export const taskFiltersSchema = z.object({
  projectId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  status: taskStatusSchema.optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
});

export const calendarFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const authActionResponseSchema = z.object({
  status: authStatusSchema,
  email: z.string().email(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  color: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectDetailSchema = projectSummarySchema.extend({
  memberIds: z.array(z.string()),
  tasks: z.array(z.string()),
});

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  email: z.string().email(),
  notes: z.string().nullable(),
  active: z.boolean(),
  projectIds: z.array(z.string()),
  openTaskCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  deadline: z.string().datetime(),
  startDate: z.string().datetime().nullable(),
  projectId: z.string(),
  assigneeId: z.string(),
  projectName: z.string(),
  assigneeName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().datetime(),
  start: z.string().datetime().nullable(),
  end: z.string().datetime().nullable(),
  taskId: z.string(),
  projectId: z.string(),
  assigneeId: z.string(),
  status: taskStatusSchema,
  overdue: z.boolean(),
});

export const dashboardSchema = z.object({
  stats: z.object({
    projectCount: z.number().int().nonnegative(),
    memberCount: z.number().int().nonnegative(),
    taskCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
  }),
  tasksByStatus: z.array(
    z.object({
      status: taskStatusSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
  overdueTasks: z.array(taskSchema),
  upcomingTasks: z.array(taskSchema),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type AuthStatus = z.infer<typeof authStatusSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type CalendarFilters = z.infer<typeof calendarFiltersSchema>;
export type UserDTO = z.infer<typeof userSchema>;
export type AuthActionResponseDTO = z.infer<typeof authActionResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ProjectSummaryDTO = z.infer<typeof projectSummarySchema>;
export type ProjectDetailDTO = z.infer<typeof projectDetailSchema>;
export type TeamMemberDTO = z.infer<typeof memberSchema>;
export type TaskDTO = z.infer<typeof taskSchema>;
export type CalendarEventDTO = z.infer<typeof calendarEventSchema>;
export type DashboardDTO = z.infer<typeof dashboardSchema>;
