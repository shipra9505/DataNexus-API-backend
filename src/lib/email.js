const nodemailer = require('nodemailer')
const { getEnv, getIntEnv } = require('./env')

const SMTP_HOST = getEnv('SMTP_HOST')
const SMTP_PORT = getIntEnv('SMTP_PORT')
const SMTP_USER = getEnv('SMTP_USER')
const SMTP_PASS = getEnv('SMTP_PASS')
const EMAIL_FROM = getEnv('EMAIL_FROM', 'noreply@bluestock.com')

let transporter = null
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    }
  })
}

const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  }

  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send:', subject)
    console.info('Email payload:', mailOptions)
    return
  }

  try {
    return await transporter.sendMail(mailOptions)
  } catch (error) {
    console.warn('Email send failed, continuing without blocking request:', error.message)
    return null
  }
}

const sendUsageAlert = async ({ user, current, limit, threshold }) => {
  if (!user || !user.email) {
    console.warn('Usage alert skipped: missing user email')
    return
  }

  const usagePercent = Math.round((current / limit) * 100)
  const subject = `Bluestock usage alert: ${usagePercent}% of daily limit reached`
  const text = `Hello ${user.businessName || user.email},\n\nYour account has reached ${usagePercent}% of its daily limit (${current}/${limit}).\n` +
    `Please review your usage or upgrade your plan if needed.\n\n` +
    `Threshold triggered: ${threshold}%\n\n` +
    `Thank you,\nBluestock API Team`

  const html = `<p>Hello ${user.businessName || user.email},</p>` +
    `<p>Your account has reached <strong>${usagePercent}%</strong> of its daily limit` +
    ` (<strong>${current}/${limit}</strong>).</p>` +
    `<p>Please review your usage or upgrade your plan if needed.</p>` +
    `<p><strong>Threshold triggered:</strong> ${threshold}%</p>` +
    `<p>Thank you,<br/>Bluestock API Team</p>`

  await sendEmail({ to: user.email, subject, text, html })
}

const sendUserStatusEmail = async ({ user, status }) => {
  if (!user || !user.email) {
    console.warn('User status email skipped: missing user email')
    return
  }

  const subject = `Bluestock account ${status.toLowerCase()}`
  const text = `Hello ${user.businessName || user.email},\n\nYour Bluestock account has been ${status.toLowerCase()}.\n` +
    `If you have any questions, please contact support.\n\nThank you,\nBluestock API Team`
  const html = `<p>Hello ${user.businessName || user.email},</p>` +
    `<p>Your Bluestock account has been <strong>${status.toLowerCase()}</strong>.</p>` +
    `<p>If you have any questions, please contact support.</p>` +
    `<p>Thank you,<br/>Bluestock API Team</p>`

  await sendEmail({ to: user.email, subject, text, html })
}

module.exports = { sendEmail, sendUsageAlert, sendUserStatusEmail }
