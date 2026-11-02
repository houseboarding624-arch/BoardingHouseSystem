import { config } from './config.js';

export const mailConfigured = () => Boolean(config.mail.user && config.mail.pass);

let transporter = null;
let attempted = false;

async function getTransporter() {
  if (attempted) return transporter;
  attempted = true;
  if (!mailConfigured()) return null;
  try {
    const { default: nodemailer } = await import('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  } catch (err) {
    console.error('nodemailer is not installed. Run: npm install --prefix backend', err.message);
    transporter = null;
  }
  return transporter;
}

/** Never throws. Returns { ok, error }. */
export async function sendMail({ to, subject, text }) {
  if (!to) return { ok: false, error: 'No email address on file.' };
  const mailer = await getTransporter();
  if (!mailer) {
    return {
      ok: false,
      error: mailConfigured()
        ? 'Email library is not installed (run npm install in backend).'
        : 'Gmail is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env).',
    };
  }
  try {
    await mailer.sendMail({
      from: `"Boarding House" <${config.mail.user}>`,
      to,
      subject,
      text,
    });
    return { ok: true };
  } catch (err) {
    console.error('Email failed:', err.message);
    return { ok: false, error: err.message };
  }
}
