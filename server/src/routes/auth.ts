/* Keep registration, verification, and login in one module so account lifecycle rules stay explicit and consistent. */
import type { AuthActionResponseDTO, UserDTO } from "@team-management/shared";
import {
  loginInputSchema,
  requestPasswordResetInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  resendVerificationInputSchema,
  verifyEmailInputSchema,
} from "@team-management/shared";
import type { FastifyPluginAsync } from "fastify";

import { getConfig } from "../config.js";
import { prisma } from "../db.js";
import {
  clearSessionCookie,
  createSessionToken,
  emailVerificationPurpose,
  getSessionExpiry,
  hashOtpCode,
  hashPassword,
  hashSessionToken,
  passwordResetPurpose,
  sessionCookieName,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth.js";
import { badRequest, conflict, forbidden, unauthorized } from "../lib/errors.js";
import { mapUser } from "../lib/mappers.js";
import { sendPasswordResetEmail } from "../lib/mail.js";
import { issueOtpCode, issueVerificationCode } from "../lib/otp.js";

type UnsignCookie = (value: string) => {
  valid: boolean;
  renew: boolean;
  value: string | null;
};

async function replaceExistingSession(cookieValue: string | undefined, unsignCookie: UnsignCookie) {
  if (!cookieValue) {
    return;
  }

  const unsigned = unsignCookie(cookieValue);
  if (unsigned.valid && unsigned.value) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(unsigned.value) },
    });
  }
}

/*
Centralize OTP lookup and validation so verification and password reset enforce
the same expiry and attempt handling without duplicating branching in each route.
*/
async function getActiveOtpToken(userId: string, purpose: string) {
  return prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function validateOtpToken(userId: string, purpose: string, otp: string, maxAttempts: number) {
  const token = await getActiveOtpToken(userId, purpose);

  if (!token) {
    throw badRequest("No active verification code was found. Request a new code.");
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    throw badRequest("Verification code expired. Request a new code.");
  }

  if (token.attempts >= maxAttempts) {
    throw forbidden("Too many verification attempts. Request a new code.");
  }

  if (token.codeHash !== hashOtpCode(otp)) {
    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw badRequest("Invalid verification code.");
  }

  return token;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider();
  const config = getConfig();

  app.post(
    "/auth/register",
    {
      schema: {
        body: registerInputSchema,
      },
    },
    async (request): Promise<AuthActionResponseDTO> => {
      const { email, password } = registerInputSchema.parse(request.body);
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser?.emailVerified) {
        throw conflict("An account with this email already exists.");
      }

      const passwordHash = await hashPassword(password);
      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
            },
          })
        : await prisma.user.create({
            data: {
              email,
              passwordHash,
            },
          });

      await issueVerificationCode(user.id, user.email);

      return {
        status: "verification_required",
        email: user.email,
        message: "Verification code sent. Check your email to finish registration.",
      };
    },
  );

  app.post(
    "/auth/verify-email",
    {
      schema: {
        body: verifyEmailInputSchema,
      },
    },
    async (request): Promise<AuthActionResponseDTO> => {
      const { email, otp } = verifyEmailInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw badRequest("Invalid verification request.");
      }

      if (user.emailVerified) {
        return {
          status: "verified",
          email: user.email,
          message: "Email already verified. You can sign in.",
        };
      }

      const token = await validateOtpToken(user.id, emailVerificationPurpose, otp, config.OTP_MAX_ATTEMPTS);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        }),
        prisma.emailVerificationToken.update({
          where: { id: token.id },
          data: {
            consumedAt: new Date(),
          },
        }),
        prisma.emailVerificationToken.deleteMany({
          where: {
            userId: user.id,
            purpose: emailVerificationPurpose,
            id: { not: token.id },
          },
        }),
      ]);

      return {
        status: "verified",
        email: user.email,
        message: "Email verified. You can now sign in.",
      };
    },
  );

  app.post(
    "/auth/resend-verification",
    {
      schema: {
        body: resendVerificationInputSchema,
      },
    },
    async (request): Promise<AuthActionResponseDTO> => {
      const { email } = resendVerificationInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return {
          status: "verification_required",
          email,
          message: "If the account exists and is not verified, a new verification code has been sent.",
        };
      }

      if (user.emailVerified) {
        throw badRequest("This email is already verified. Sign in instead.");
      }

      await issueVerificationCode(user.id, user.email);

      return {
        status: "verification_required",
        email: user.email,
        message: "A new verification code has been sent.",
      };
    },
  );

  app.post(
    "/auth/request-password-reset",
    {
      schema: {
        body: requestPasswordResetInputSchema,
      },
    },
    async (request): Promise<AuthActionResponseDTO> => {
      const { email } = requestPasswordResetInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (user?.emailVerified) {
        await issueOtpCode({
          userId: user.id,
          email: user.email,
          purpose: passwordResetPurpose,
          sendCode: sendPasswordResetEmail,
        });
      }

      return {
        status: "password_reset_requested",
        email,
        message: "If the account exists and is verified, a password reset code has been sent.",
      };
    },
  );

  app.post(
    "/auth/reset-password",
    {
      schema: {
        body: resetPasswordInputSchema,
      },
    },
    async (request): Promise<AuthActionResponseDTO> => {
      const { email, otp, password } = resetPasswordInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.emailVerified) {
        throw badRequest("Invalid password reset request.");
      }

      const token = await validateOtpToken(user.id, passwordResetPurpose, otp, config.OTP_MAX_ATTEMPTS);
      const passwordHash = await hashPassword(password);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
          },
        }),
        prisma.emailVerificationToken.update({
          where: { id: token.id },
          data: {
            consumedAt: new Date(),
          },
        }),
        prisma.emailVerificationToken.deleteMany({
          where: {
            userId: user.id,
            purpose: passwordResetPurpose,
            id: { not: token.id },
          },
        }),
        prisma.session.deleteMany({
          where: {
            userId: user.id,
          },
        }),
      ]);

      return {
        status: "password_reset",
        email: user.email,
        message: "Password updated. Sign in with your new password.",
      };
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: loginInputSchema,
      },
    },
    async (request, reply): Promise<UserDTO> => {
      const { email, password } = loginInputSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw unauthorized("Invalid email or password.");
      }

      if (!user.emailVerified) {
        throw forbidden("Verify your email before signing in.");
      }

      await replaceExistingSession(request.cookies[sessionCookieName], request.unsignCookie.bind(request));

      const sessionToken = createSessionToken();
      await prisma.session.create({
        data: {
          tokenHash: hashSessionToken(sessionToken),
          expiresAt: getSessionExpiry(),
          userId: user.id,
        },
      });

      setSessionCookie(reply, sessionToken, config);

      return mapUser(user);
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    await replaceExistingSession(request.cookies[sessionCookieName], request.unsignCookie.bind(request));

    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: fastify.authenticate }, async (request): Promise<UserDTO> => {
    if (!request.currentUser) {
      throw unauthorized();
    }

    return request.currentUser;
  });
};
