import { supabase, unwrap } from '../supabase.js';
import { todayString, nowHHMM } from '../utils/time.js';
import { addDays, daysBetween } from '../utils/dates.js';
import { getSettings, saveSetting } from './settings.js';
import { notifyUser } from './notify.js';
import { syncRoomStatuses } from './rooms.js';
import { audit } from './audit.js';

const BOARDER_FIELDS =
  'id,username,full_name,email,preferred_room,status,next_due_date,due_notice_for';

export const DUE_WARNING_DAYS = 7;

/** Billing state for one tenant (shared with the owner dashboard). */
export function billingState(boarder, today, graceDays) {
  if (boarder.status === 'Disabled') return { state: 'Disabled' };
  if (!boarder.next_due_date) return { state: 'No due date' };

  const due = boarder.next_due_date;
  const deadline = addDays(due, graceDays);
  const untilDue = daysBetween(today, due);

  // urgent = unpaid and either overdue or due within a week (shown in red on every dashboard).
  const urgent = untilDue <= DUE_WARNING_DAYS;

  if (untilDue > 3) return { state: 'Upcoming', daysUntilDue: untilDue, deadline, urgent };
  if (untilDue > 0) return { state: 'Due soon', daysUntilDue: untilDue, deadline, urgent };
  if (today <= deadline) {
    return { state: 'Overdue', daysUntilDue: untilDue, daysLeft: daysBetween(today, deadline), deadline, urgent };
  }
  return { state: 'Past grace', daysUntilDue: untilDue, deadline, urgent };
}

/** Curfew: once a day, after curfew time, notify every active boarder (in-app + Gmail). */
export async function runCurfewCheck({ force = false } = {}) {
  const settings = await getSettings();
  const today = todayString();
  if (!force) {
    if (!settings.curfew_enabled) return { skipped: 'curfew disabled' };
    if (settings.curfew_last_run === today) return { skipped: 'already sent today' };
    if (nowHHMM() < settings.curfew_time) return { skipped: 'not curfew time yet' };
  }

  // Mark first so a slow email run can't be started twice.
  await saveSetting('curfew_last_run', today);

  const boarders = unwrap(
    await supabase.from('users').select(BOARDER_FIELDS).eq('role', 'Boarder').eq('status', 'Active')
  );
  const attendance = unwrap(
    await supabase.from('attendance').select('user_id,time_in,time_out').eq('attendance_date', today)
  );
  const inside = new Set(
    attendance.filter((a) => a.time_in && !a.time_out).map((a) => Number(a.user_id))
  );

  let sent = 0;
  let failed = 0;
  for (const boarder of boarders) {
    const isInside = inside.has(Number(boarder.id));
    const message = isInside
      ? `Hi ${boarder.full_name}, curfew has started (${settings.curfew_time}). Please stay inside the boarding house for the night.`
      : `Hi ${boarder.full_name}, curfew has started (${settings.curfew_time}) and you are not checked in. Please return to the boarding house now and scan your QR, or contact the owner.`;
    const status = await notifyUser(boarder, {
      type: 'Curfew',
      title: `Curfew reminder - ${settings.curfew_time}`,
      message,
    });
    if (status === 'sent') sent += 1;
    if (status === 'failed') failed += 1;
  }

  await audit(null, 'Curfew notice', `${boarders.length} boarder(s) notified, ${sent} emailed, ${failed} email failed`);
  return { boarders: boarders.length, emailed: sent, emailFailed: failed };
}

/**
 * Payment check:
 *  - on the due date (unpaid) -> email "pay within N days or your account will be disabled"
 *  - after the N-day grace period (still unpaid) -> disable the account and free the bed
 * Paying rent moves next_due_date forward, which clears the problem.
 */
export async function runPaymentCheck() {
  const settings = await getSettings();
  const today = todayString();

  const boarders = unwrap(
    await supabase
      .from('users')
      .select(BOARDER_FIELDS)
      .eq('role', 'Boarder')
      .eq('status', 'Active')
      .not('next_due_date', 'is', null)
  );

  let warned = 0;
  let disabled = 0;

  for (const boarder of boarders) {
    const due = boarder.next_due_date;
    if (today < due) continue;
    const deadline = addDays(due, settings.grace_days);

    if (boarder.due_notice_for !== due) {
      await notifyUser(boarder, {
        type: 'Payment Due',
        title: 'Boarding house payment is due',
        message:
          `Hi ${boarder.full_name}, your boarding house payment was due on ${due} and has not been received. ` +
          `Please pay within ${settings.grace_days} days (until ${deadline}), or your account will be disabled.`,
      });
      unwrap(await supabase.from('users').update({ due_notice_for: due }).eq('id', boarder.id));
      warned += 1;
    }

    if (settings.auto_terminate && today > deadline) {
      unwrap(
        await supabase
          .from('users')
          .update({
            status: 'Disabled',
            terminated_at: new Date().toISOString(),
            termination_reason: `Unpaid rent due ${due}`,
          })
          .eq('id', boarder.id)
      );
      await notifyUser(boarder, {
        type: 'Disabled',
        title: 'Your account has been disabled',
        message:
          `Hi ${boarder.full_name}, your payment due on ${due} was not received within ${settings.grace_days} days. ` +
          `Your account has been disabled because of unpaid rent. Please contact the owner if you believe this is a mistake.`,
      });
      await audit(null, 'Tenant disabled', `${boarder.full_name} - unpaid rent due ${due}`);
      disabled += 1;
    }
  }

  if (disabled) await syncRoomStatuses();
  return { checked: boarders.length, warned, disabled };
}

export async function runAllChecks() {
  const curfew = await runCurfewCheck().catch((err) => ({ error: err.message }));
  const payments = await runPaymentCheck().catch((err) => ({ error: err.message }));
  return { curfew, payments };
}

/** Runs the checks every minute (cheap: both are no-ops unless something is due). */
export function startScheduler() {
  const tick = () =>
    runAllChecks()
      .then((result) => {
        if (result.curfew?.error || result.payments?.error) console.error('scheduler:', result);
      })
      .catch((err) => console.error('scheduler failed:', err.message));
  setTimeout(tick, 5000);
  setInterval(tick, 60 * 1000);
}
