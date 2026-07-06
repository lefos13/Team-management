/* Parse runtime configuration once so auth, mail, and deployment-sensitive behavior share one strict source of truth. */
import { z } from "zod";
import { resolve } from "node:path";

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3001),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    APP_BASE_URL: z.string().url().default("http://localhost:5173"),
    SESSION_SECRET: z.string().min(16).default("replace-with-a-long-random-string"),
    ADMIN_ACCESS_PASSWORD: z.string().min(1),
    EMAIL_PROVIDER: z.enum(["json", "smtp", "gmail"]).default("json"),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: booleanStringSchema.default(false),
    GMAIL_USER: z.string().email().optional(),
    GMAIL_APP_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().trim().min(1).default("Team Management <no-reply@example.com>"),
    EMAIL_REPLY_TO: z.string().trim().email().optional(),
    ATTACHMENTS_DIR: z.string().trim().optional(),
    OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_OVERRIDE_CODE: z.string().trim().regex(/^\d{6}$/).optional(),
  })
  .superRefine((value, ctx) => {
    /*
    Production should fail fast on incomplete mail settings, but local development
    should still boot so the app can run before real email credentials are added.
    */
    const enforceMailCredentials = value.NODE_ENV === "production";

    if (value.EMAIL_PROVIDER === "smtp" && enforceMailCredentials) {
      if (!value.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMTP_HOST is required when EMAIL_PROVIDER=smtp.",
          path: ["SMTP_HOST"],
        });
      }

      if (!value.SMTP_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMTP_USER is required when EMAIL_PROVIDER=smtp.",
          path: ["SMTP_USER"],
        });
      }

      if (!value.SMTP_PASS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMTP_PASS is required when EMAIL_PROVIDER=smtp.",
          path: ["SMTP_PASS"],
        });
      }
    }

    if (value.EMAIL_PROVIDER === "gmail" && enforceMailCredentials) {
      if (!value.GMAIL_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GMAIL_USER is required when EMAIL_PROVIDER=gmail.",
          path: ["GMAIL_USER"],
        });
      }

      if (!value.GMAIL_APP_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GMAIL_APP_PASSWORD is required when EMAIL_PROVIDER=gmail.",
          path: ["GMAIL_APP_PASSWORD"],
        });
      }
    }
  });

export type AppConfig = Omit<z.infer<typeof envSchema>, "ATTACHMENTS_DIR"> & {
  ATTACHMENTS_DIR: string;
};

export function getConfig(): AppConfig {
  const config = envSchema.parse(process.env);

  return {
    ...config,
    ATTACHMENTS_DIR: config.ATTACHMENTS_DIR && config.ATTACHMENTS_DIR !== ""
      ? config.ATTACHMENTS_DIR
      : resolve(process.cwd(), "server", "storage", "attachments"),
  };
}
