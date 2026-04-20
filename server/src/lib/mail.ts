/* Route mail through the selected provider so local JSON transport, SMTP, and Gmail share the same verification flow. */
import nodemailer from "nodemailer";

import { getConfig } from "../config.js";

let transporter: nodemailer.Transporter | null = null;
let transportWarningShown = false;

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

export async function sendVerificationEmail(email: string, otp: string): Promise<void> {
  const config = getConfig();
  const mailer = getTransporter();

  await mailer.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    replyTo: config.EMAIL_REPLY_TO,
    subject: "Verify your Team Management account",
    text: `Your Team Management verification code is ${otp}. It expires in ${config.OTP_EXPIRY_MINUTES} minutes.`,
  });
}
