import { supabase, unwrap } from '../supabase.js';
import { sendMail } from '../mailer.js';

/**
 * Creates an in-app notification and (optionally) emails the boarder's Gmail.
 * Returns the email status: 'sent' | 'failed' | 'skipped'.
 */
export async function notifyUser(user, { type, title, message, email = true }) {
  let emailStatus = 'skipped';
  let emailError = null;

  if (email) {
    const result = await sendMail({ to: user.email, subject: title, text: message });
    emailStatus = result.ok ? 'sent' : 'failed';
    emailError = result.ok ? null : result.error;
  }

  unwrap(
    await supabase.from('notifications').insert({
      user_id: user.id,
      type,
      title,
      message,
      email_status: emailStatus,
      email_error: emailError,
    })
  );
  return emailStatus;
}
