const nodemailer = require('nodemailer');
const config = require('./config');
const db = require('./db');

let transporter = null;
if (config.smtpUrl) {
  transporter = nodemailer.createTransport(config.smtpUrl);
}

async function sendMail({ to, subject, text, html, attachments }) {
  if (transporter) {
    try {
      await transporter.sendMail({ from: config.mailFrom, to, subject, text, html, attachments });
      return { delivered: true };
    } catch (err) {
      console.error(`[mail:error] SMTP delivery failed to ${to}: ${err.message}`);
      if (config.isProd) {
        throw err;
      }
      console.log(`[mail:fallback] Storing email in dev_outbox for ${to}`);
      await db.query(
        'INSERT INTO dev_outbox (to_email, subject, body) VALUES ($1, $2, $3)',
        [to, subject, text]
      );
      return { delivered: false, fallback: true, error: err.message };
    }
  }
  if (config.isProd) {
    throw new Error('SMTP_URL is not configured, refusing to silently drop email in production');
  }
  console.log(`\n[mail:dev] to=${to}\n[mail:dev] subject=${subject}\n${text}\n`);
  await db.query(
    'INSERT INTO dev_outbox (to_email, subject, body) VALUES ($1, $2, $3)',
    [to, subject, text]
  );
  return { delivered: false };
}

async function sendOtpEmail({ to, productName, version, clientName, code, expiresMinutes = 10 }) {
  const subject = `UAT sign-off code ${code} for ${productName} ${version}`;
  const text = [
    `Hello,`,
    ``,
    `Use this one-time code to sign off the UAT for ${productName} ${version} (${clientName}):`,
    ``,
    `    ${code}`,
    ``,
    `The code expires in ${expiresMinutes} minutes. If you did not ask for it, ignore this email.`,
    ``,
    `UAT Desk`
  ].join('\n');
  return sendMail({ to, subject, text });
}

async function sendCertificateEmail({
  to, signerName, clientName, productName, version, verificationId, signedAt, pdfBuffer, verifyUrl
}) {
  const subject = `UAT completion certificate ${verificationId} - ${clientName}`;
  const text = [
    `Hello ${signerName},`,
    ``,
    `${clientName} has completed user acceptance testing of ${productName} ${version}.`,
    ``,
    `Verification ID: ${verificationId}`,
    `Signed: ${signedAt}`,
    `Check it at: ${verifyUrl}`,
    ``,
    `The certificate PDF is attached.`,
    ``,
    `UAT Desk`
  ].join('\n');
  return sendMail({
    to,
    subject,
    text,
    attachments: pdfBuffer
      ? [{ filename: `UAT-certificate-${verificationId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : []
  });
}

module.exports = { sendMail, sendOtpEmail, sendCertificateEmail };
