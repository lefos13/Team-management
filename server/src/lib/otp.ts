/* Persist one active OTP per purpose so verification and password reset share the same server-side expiry and attempt rules. */
import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { emailVerificationPurpose, generateOtpCode, getOtpExpiry, hashOtpCode } from "./auth.js";
import { sendVerificationEmail } from "./mail.js";

type SendOtpCode = (email: string, code: string) => Promise<void>;

type IssueOtpCodeOptions = {
  userId: string;
  email: string;
  purpose: string;
  sendCode: SendOtpCode;
};

export async function issueOtpCode({ userId, email, purpose, sendCode }: IssueOtpCodeOptions): Promise<void> {
  const config = getConfig();
  const code = generateOtpCode(config.OTP_OVERRIDE_CODE);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        purpose,
        codeHash: hashOtpCode(code),
        expiresAt: getOtpExpiry(config),
      },
    }),
  ]);

  await sendCode(email, code);
}

export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  await issueOtpCode({
    userId,
    email,
    purpose: emailVerificationPurpose,
    sendCode: sendVerificationEmail,
  });
}
