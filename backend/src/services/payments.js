import { supabase, unwrap } from '../supabase.js';
import { addMonths } from '../utils/dates.js';

/** Every payment must be between these amounts (in pesos). Keep in sync with src/utils.js. */
export const MIN_PAYMENT = 1000;
export const MAX_PAYMENT = 2000;

/** Returns an error message when the amount is outside the allowed range, otherwise null. */
export function paymentAmountError(amount) {
  if (!Number.isFinite(amount) || amount < MIN_PAYMENT || amount > MAX_PAYMENT) {
    return `Payment amount must be from ₱${MIN_PAYMENT.toLocaleString('en-PH')} to ₱${MAX_PAYMENT.toLocaleString('en-PH')}.`;
  }
  return null;
}

/**
 * Inserts a payment. A Rent payment moves the boarder's next due date one month ahead
 * (and starts the cycle from the payment date if none was set yet).
 */
export async function recordPayment({ userId, amount, date, description, type, proofRef, verified = false }) {
  const rows = unwrap(
    await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        payment_date: date,
        description: description || null,
        type,
        proof_ref: proofRef || null,
        verified,
      })
      .select('id')
  );

  let nextDue = null;
  if (type === 'Rent') {
    const users = unwrap(await supabase.from('users').select('next_due_date').eq('id', userId).limit(1));
    nextDue = addMonths(users[0]?.next_due_date || date, 1);
    unwrap(await supabase.from('users').update({ next_due_date: nextDue }).eq('id', userId));
  }
  return { paymentId: rows?.[0]?.id ?? null, nextDue };
}

export const RENT_ALREADY_PAID =
  'Rent for this month is already paid. You can pay rent again next month (use Advance Payment to pay ahead).';

/**
 * True when this boarder already has a Rent payment in the calendar month of `date`
 * (or a Rent GCash payment still waiting for approval).
 */
export async function hasRentThisMonth(userId, date, { includePending = true } = {}) {
  const first = `${date.slice(0, 7)}-01`;
  const next = addMonths(first, 1);
  const paid = unwrap(
    await supabase
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'Rent')
      .gte('payment_date', first)
      .lt('payment_date', next)
      .limit(1)
  );
  if (paid.length) return true;
  if (!includePending) return false;

  const pending = unwrap(
    await supabase
      .from('gcash_payments')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'Rent')
      .eq('status', 'Pending')
      .limit(1)
  );
  return pending.length > 0;
}
