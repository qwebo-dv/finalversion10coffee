import nodemailer from "nodemailer"

const DEFAULT_SENDER = "info@10coffee.ru"

/**
 * Shared SMTP transporter for all outbound mail.
 *
 * The sender is the mailbox in SMTP_FROM (falls back to SMTP_EMAIL, which is
 * info@10coffee.ru in production). Without SMTP_HOST the app connects to the
 * Mail.ru relay (smtp.mail.ru:465, SSL); set SMTP_HOST/SMTP_PORT/SMTP_SECURE
 * to use any other relay. Credentials are read from environment variables and
 * are usually set in the hosting panel (Coolify > Environment variables), not
 * committed to the repo.
 */
function resolveSmtpOptions() {
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(
        process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587)
      ),
      secure: process.env.SMTP_SECURE === "true",
    }
  }
  return { host: "smtp.mail.ru", port: 465, secure: true }
}

function createSmtpTransporter() {
  return nodemailer.createTransport({
    ...resolveSmtpOptions(),
    auth: {
      user: process.env.SMTP_USER || process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

export const smtpTransporter = createSmtpTransporter()

/** `"Display name" <sender-address>` used as the From header of every mail. */
export function mailFrom(displayName = "10coffee") {
  const address = process.env.SMTP_FROM || process.env.SMTP_EMAIL || DEFAULT_SENDER
  return `"${displayName}" <${address}>`
}

/** Default From for transaction adapters (Payload email). */
export function defaultFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_EMAIL || DEFAULT_SENDER
}