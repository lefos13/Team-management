import { z } from "zod";

export const taskStatusValues = ["todo", "in_progress", "blocked", "review_testing", "done"] as const;
export const taskStatusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  review_testing: "Review/Testing",
  done: "Done",
} as const satisfies Record<(typeof taskStatusValues)[number], string>;
export const projectStatusValues = ["active", "on_hold", "completed"] as const;
export const projectPermissionValues = ["preview_own_tasks", "preview_all_tasks", "edit_own_tasks", "edit_all_tasks"] as const;
export const projectPermissionLabels = {
  preview_own_tasks: "View own tasks",
  preview_all_tasks: "View all tasks",
  edit_own_tasks: "Edit own tasks",
  edit_all_tasks: "Edit all tasks",
} as const satisfies Record<(typeof projectPermissionValues)[number], string>;
export const authStatusValues = [
  "verification_required",
  "verified",
  "password_reset_requested",
  "password_reset",
] as const;
export const legalDocumentVersion = "2026-05-03";

export const taskStatusSchema = z.enum(taskStatusValues);
export const projectStatusSchema = z.enum(projectStatusValues);
export const projectPermissionSchema = z.enum(projectPermissionValues);
export const authStatusSchema = z.enum(authStatusValues);
/*
Project AI context is intended to hold copied repository or agent guidance, so
the guard is sized for large documents while still rejecting abusive payloads.
*/
export const projectAiContextMaxLength = 1_000_000;

export const projectPhaseDateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().datetime(),
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerInputSchema = loginInputSchema.extend({
  acceptedTerms: z.literal(true),
  legalVersion: z.literal(legalDocumentVersion),
});

export const verifyEmailInputSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
});

export const resendVerificationInputSchema = z.object({
  email: z.string().email(),
});

/*
Keep reset-password requests in the shared contract so the client and server
validate the same email, OTP, and replacement-password rules.
*/
export const requestPasswordResetInputSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordInputSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8),
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  aiContext: z.string().trim().max(projectAiContextMaxLength).optional().or(z.literal("")),
  goLiveDate: z.string().datetime().optional().nullable().or(z.literal("")),
  phaseDates: z.array(projectPhaseDateInputSchema).default([]),
  status: projectStatusSchema,
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/).optional().or(z.literal("")),
  memberIds: z.array(z.string().min(1)).default([]),
});

export const sendProjectInvitationInputSchema = z.object({
  memberId: z.string().min(1),
  permission: projectPermissionSchema,
});

export const updateProjectAccessPermissionInputSchema = z.object({
  permission: projectPermissionSchema,
});

export const acceptProjectInvitationInputSchema = z.object({
  token: z.string().trim().min(16),
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
    notes: z.string().trim().max(4000).optional().or(z.literal("")),
    status: taskStatusSchema,
    isDefect: z.boolean().default(false),
    deadline: z.string().datetime().optional().nullable().or(z.literal("")),
    startDate: z.string().datetime().optional().nullable().or(z.literal("")),
    projectId: z.string().min(1),
    assigneeId: z.string().min(1).optional(),
    assigneeIds: z.array(z.string().min(1)).default([]),
    parentTaskId: z.string().min(1).optional().nullable().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.assigneeIds.length === 0 && !value.assigneeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one assignee is required.",
        path: ["assigneeIds"],
      });
    }

    if (value.startDate && value.startDate !== "" && value.deadline && value.deadline !== "" && new Date(value.startDate) > new Date(value.deadline)) {
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
  isDefect: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
});

export const taskExportFiltersSchema = taskFiltersSchema.pick({
  projectId: true,
  assigneeId: true,
  status: true,
  isDefect: true,
});

export const taskImportTemplateVariantSchema = z.enum(["blank", "sample"]).default("blank");

export const taskImportTemplateQuerySchema = z.object({
  variant: taskImportTemplateVariantSchema,
});

export const taskAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  isImage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const taskAttachmentArchiveSchema = z.object({
  id: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});

export const taskShareLinkSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  url: z.string().url(),
  createdAt: z.string().datetime(),
});

export const taskImportRowResultSchema = z.object({
  row: z.number().int().positive(),
  title: z.string().optional(),
  memberEmail: z.string().optional(),
  reason: z.string(),
});

export const taskImportResultSchema = z.object({
  inserted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  skippedRows: z.array(taskImportRowResultSchema),
  rejectedRows: z.array(taskImportRowResultSchema),
});

export const dashboardFiltersSchema = z.object({
  completedFrom: z.string().datetime().optional(),
  completedTo: z.string().datetime().optional(),
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
  termsAcceptedAt: z.string().datetime().nullable(),
  termsVersion: z.string().nullable(),
  privacyAcceptedAt: z.string().datetime().nullable(),
  privacyVersion: z.string().nullable(),
  legalAcceptedIp: z.string().nullable(),
  legalAcceptedUserAgent: z.string().nullable(),
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
  aiContext: z.string().nullable(),
  goLiveDate: z.string().datetime().nullable(),
  phaseDates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      date: z.string().datetime(),
    }),
  ),
  status: projectStatusSchema,
  color: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sharedProjectSummarySchema = projectSummarySchema.extend({
  permission: projectPermissionSchema,
  masterOwnerEmail: z.string().email(),
  accessStatus: z.enum(["active", "invited", "revoked"]),
});

export const projectListSchema = z.object({
  ownedProjects: z.array(projectSummarySchema),
  sharedProjects: z.array(sharedProjectSummarySchema),
});

export const projectDetailSchema = projectSummarySchema.extend({
  memberIds: z.array(z.string()),
  tasks: z.array(z.string()),
  isMasterOwner: z.boolean().default(true),
  permission: projectPermissionSchema.default("edit_all_tasks"),
  masterOwnerEmail: z.string().email().optional(),
});

export const projectInvitationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  memberId: z.string(),
  inviteEmail: z.string().email(),
  permission: projectPermissionSchema,
  accessId: z.string().nullable(),
  accessStatus: z.enum(["active", "invited", "revoked"]).nullable(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
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
  completedTaskCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const memberDeleteResultSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
  unassignedTaskCount: z.number().int().nonnegative(),
  reassignedPrimaryTaskCount: z.number().int().nonnegative(),
  removedProjectCount: z.number().int().nonnegative(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  status: taskStatusSchema,
  isDefect: z.boolean(),
  deadline: z.string().datetime().nullable(),
  startDate: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  projectId: z.string(),
  assigneeId: z.string().nullable(),
  assigneeIds: z.array(z.string()),
  parentTaskId: z.string().nullable(),
  parentTaskTitle: z.string().nullable(),
  projectName: z.string(),
  assigneeName: z.string().nullable(),
  assigneeNames: z.array(z.string()),
  attachments: z.array(taskAttachmentSchema),
  attachmentArchive: taskAttachmentArchiveSchema.nullable(),
  attachmentsPreviewAvailable: z.boolean(),
  canEdit: z.boolean(),
  canManageAssignees: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().datetime(),
  start: z.string().datetime().nullable(),
  end: z.string().datetime().nullable(),
  taskId: z.string().nullable(),
  projectId: z.string(),
  assigneeId: z.string().nullable(),
  assigneeIds: z.array(z.string()),
  status: taskStatusSchema.nullable(),
  eventType: z.enum(["task_deadline", "project_go_live", "project_phase"]),
  importance: z.enum(["normal", "very_important"]),
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
  recentCompletions: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    count: z.number().int().nonnegative(),
    tasks: z.array(taskSchema),
  }),
  overdueTasks: z.array(taskSchema),
  upcomingTasks: z.array(taskSchema),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectPermission = z.infer<typeof projectPermissionSchema>;
export type AuthStatus = z.infer<typeof authStatusSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationInputSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectPhaseDateInput = z.infer<typeof projectPhaseDateInputSchema>;
export type SendProjectInvitationInput = z.infer<typeof sendProjectInvitationInputSchema>;
export type UpdateProjectAccessPermissionInput = z.infer<typeof updateProjectAccessPermissionInputSchema>;
export type AcceptProjectInvitationInput = z.infer<typeof acceptProjectInvitationInputSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type TaskExportFilters = z.infer<typeof taskExportFiltersSchema>;
export type TaskImportTemplateVariant = z.infer<typeof taskImportTemplateVariantSchema>;
export type TaskImportResultDTO = z.infer<typeof taskImportResultSchema>;
export type TaskImportRowResultDTO = z.infer<typeof taskImportRowResultSchema>;
export type TaskAttachmentDTO = z.infer<typeof taskAttachmentSchema>;
export type TaskAttachmentArchiveDTO = z.infer<typeof taskAttachmentArchiveSchema>;
export type TaskShareLinkDTO = z.infer<typeof taskShareLinkSchema>;
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
export type CalendarFilters = z.infer<typeof calendarFiltersSchema>;
export type UserDTO = z.infer<typeof userSchema>;
export type AuthActionResponseDTO = z.infer<typeof authActionResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ProjectSummaryDTO = z.infer<typeof projectSummarySchema>;
export type SharedProjectSummaryDTO = z.infer<typeof sharedProjectSummarySchema>;
export type ProjectListDTO = z.infer<typeof projectListSchema>;
export type ProjectDetailDTO = z.infer<typeof projectDetailSchema>;
export type ProjectInvitationDTO = z.infer<typeof projectInvitationSchema>;
export type TeamMemberDTO = z.infer<typeof memberSchema>;
export type MemberDeleteResultDTO = z.infer<typeof memberDeleteResultSchema>;
export type TaskDTO = z.infer<typeof taskSchema>;
export type CalendarEventDTO = z.infer<typeof calendarEventSchema>;
export type DashboardDTO = z.infer<typeof dashboardSchema>;
