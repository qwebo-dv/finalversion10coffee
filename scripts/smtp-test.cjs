/* Diagnostic test for the outbound SMTP setup (Mail.ru by default).
 *
 *   node scripts/smtp-test.cjs [recipient@example.com]
 *
 * Reads SMTP_* from the environment, verifies connection+auth, then sends a
 * test email. Prints the exact nodemailer error on failure so we can tell
 * whether the problem is DNS/port, wrong credentials, or a delivery issue.
 */
const nodemailer = require("nodemailer")

const host = process.env.SMTP_HOST || "smtp.mail.ru"
const port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587))
const secure = process.env.SMTP_SECURE === "true"
const user = process.env.SMTP_USER || process.env.SMTP_EMAIL
const pass = process.env.SMTP_PASSWORD
const from = process.env.SMTP_FROM || process.env.SMTP_EMAIL
const to = process.argv[2] || from

console.log("=== SMTP test ===")
console.log(`device env  : SMTP_HOST=${host} SMTP_PORT=${port} SMTP_SECURE=${secure}`)
console.log(`user        : ${user}`)
console.log(`from        : ${from}`)
console.log(`to          : ${to}`)
console.log(`password    : ${pass ? "set (" + pass.length + " chars)" : "NOT SET"}`)

if (!user || !pass) {
  console.error("\nFATAL: SMTP_USER/SMTP_EMAIL or SMTP_PASSWORD is missing.")
  process.exit(1)
}

const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })

async function main() {
  console.log("\n--- 1/2 verify connection + auth ---")
  try {
    await transporter.verify()
    console.log("OK: connected and authenticated")
  } catch (err) {
    console.error("FAILED:", err && err.message ? err.message : err)
    if (err && err.response) console.error("SERVER RESPONSE:", err.response)
    if (err && err.code === "EAUTH") {
      console.error(
        "\nLikely cause: wrong password. Mail.ru for external apps requires an APP-SPECIFIC password" +
          " (Настройки ящика -> Безопасность -> Пароли для внешних приложений), not the mailbox password."
      )
    } else if (err && err.code === "ECONNECTION") {
      console.error(
        "\nLikely cause: server cannot reach the relay, or the port is blocked (465 needs SSL)." +
          " Check that SMTP_PORT=465 and SMTP_SECURE=true and that the host allows outbound 465."
      )
    }
    process.exit(1)
  }

  console.log("\n--- 2/2 send test email ---")
  try {
    const info = await transporter.sendMail({
      from: `"10coffee SMTP test" <${from}>`,
      to,
      subject: "SMTP test from 10coffee",
      text: `This is a test email sent via ${host}:${port}. Received at ${new Date().toISOString()}.`,
    })
    console.log("SENT OK. nodemailer result:", info.messageId || JSON.stringify(info))
  } catch (err) {
    console.error("FAILED:", err && err.message ? err.message : err)
    if (err && err.response) console.error("SERVER RESPONSE:", err.response)
    console.error(
      "\nIf auth passed but the message is rejected, check the domain DNS:" +
        " 10coffee.ru must publish SPF (include:ru listed via Mail.ru: v=spf1 redirect=... ) and DKIM from Mail.ru," +
        " otherwise receivers (Gmail etc.) silently reject or spam-filter the message."
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("UNEXPECTED ERROR:", err)
  process.exit(1)
})