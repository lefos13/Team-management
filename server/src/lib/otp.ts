/* Persist one active verification code per account so resend, expiry, and attempt limits are enforced on the server. */
import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { emailVerificationPurpose, generateOtpCode, getOtpExpiry, hashOtpCode } from "./auth.js";
import { sendVerificationEmail } from "./mail.js";

export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const config = getConfig();
  const code = generateOtpCode(config.OTP_OVERRIDE_CODE);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        purpose: emailVerificationPurpose,
        consumedAt: null,
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        purpose: emailVerificationPurpose,
        codeHash: hashOtpCode(code),
        expiresAt: getOtpExpiry(config),
      },
    }),
  ]);

  await sendVerificationEmail(email, code);
}
