/* Route mail through the selected provider so local JSON transport, SMTP, and Gmail share the same verification flow. */
import nodemailer from "nodemailer";

import { getConfig } from "../config.js";

let transporter: nodemailer.Transporter | null = null;
let transportWarningShown = false;

type OtpEmailOptions = {
  title: string;
  eyebrow: string;
  intro: string;
  otp: string;
  expiryMinutes: number;
  footer: string;
};

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const config = getConfig();
  const gmailReady = Boolean(config.GMAIL_USER && config.GMAIL_APP_PASSWORD);
  const smtpReady = Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);

  /*
  When email credentials are missing outside production, use JSON transport so
  registration and verification flows remain testable without blocking app startup.
  */
  if (!transportWarningShown && config.NODE_ENV !== "production") {
    if (config.EMAIL_PROVIDER === "gmail" && !gmailReady) {
      transportWarningShown = true;
      console.warn("EMAIL_PROVIDER=gmail but GMAIL_APP_PASSWORD is missing. Falling back to JSON mail transport.");
    }

    if (config.EMAIL_PROVIDER === "smtp" && !smtpReady) {
      transportWarningShown = true;
      console.warn("EMAIL_PROVIDER=smtp but SMTP credentials are incomplete. Falling back to JSON mail transport.");
    }
  }

  transporter = config.EMAIL_PROVIDER === "gmail" && gmailReady
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.GMAIL_USER,
          pass: config.GMAIL_APP_PASSWORD,
        },
      })
    : config.EMAIL_PROVIDER === "smtp" && smtpReady
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          },
        })
      : nodemailer.createTransport({
        jsonTransport: true,
      });

  return transporter;
}

/*
Email clients need table-free, inline-styled markup with a plain-text fallback,
so both OTP flows share one compact renderer and only swap the purpose-specific copy.
*/
function buildOtpEmailHtml({ title, eyebrow, intro, otp, expiryMinutes, footer }: OtpEmailOptions): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#eef5f1;color:#132238;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe8e5;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(19,34,56,0.12);">
        <div style="padding:28px 30px;background:#10263d;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;color:#6ee7d0;">${eyebrow}</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;">${title}</h1>
        </div>
        <div style="padding:30px;">
          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#45566a;">${intro}</p>
          <div style="margin:0 0 22px;padding:20px;border-radius:14px;background:#f4fbf9;border:1px solid #cdeee7;text-align:center;">
            <div style="font-size:12px;font-weight:700;color:#0b7285;text-transform:uppercase;">Your code</div>
            <div style="margin-top:8px;font-size:38px;line-height:1;font-weight:800;letter-spacing:8px;color:#132238;">${otp}</div>
          </div>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#45566a;">This code expires in ${expiryMinutes} minutes.</p>
          <p style="margin:0;padding:16px;border-radius:12px;background:#fff7e8;color:#6b4a12;font-size:14px;line-height:1.5;">${footer}</p>
        </div>
      </div>
      <p style="max-width:560px;margin:18px auto 0;text-align:center;color:#6a7888;font-size:12px;line-height:1.5;">Team Management keeps projects, tasks, members, and deadlines organized in one workspace.</p>
    </div>
  </body>
</html>`;
}

export async function sendVerificationEmail(email: string, otp: string): Promise<void> {
  const config = getConfig();
  const mailer = getTransporter();
  const text = `Your Team Management verification code is ${otp}. It expires in ${config.OTP_EXPIRY_MINUTES} minutes.`;

  await mailer.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    replyTo: config.EMAIL_REPLY_TO,
    subject: "Verify your Team Management account",
    text,
    html: buildOtpEmailHtml({
      title: "Verify your Team Management account",
      eyebrow: "Email verification",
      intro: "Use this one-time code to confirm your email and unlock your team workspace.",
      otp,
      expiryMinutes: config.OTP_EXPIRY_MINUTES,
      footer: "If you did not create a Team Management account, you can safely ignore this email.",
    }),
  });
}

/*
Use a reset-specific message so the inbox makes it clear the OTP changes the
account password, while mail transport behavior stays shared with verification.
*/
export async function sendPasswordResetEmail(email: string, otp: string): Promise<void> {
  const config = getConfig();
  const mailer = getTransporter();
  const text = `Your Team Management password reset code is ${otp}. It expires in ${config.OTP_EXPIRY_MINUTES} minutes.`;

  await mailer.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    replyTo: config.EMAIL_REPLY_TO,
    subject: "Reset your Team Management password",
    text,
    html: buildOtpEmailHtml({
      title: "Reset your Team Management password",
      eyebrow: "Password recovery",
      intro: "Use this one-time code to confirm the reset request and choose a new password.",
      otp,
      expiryMinutes: config.OTP_EXPIRY_MINUTES,
      footer: "If you did not request a password reset, keep your current password and ignore this email.",
    }),
  });
}
