import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { todayString, clockTime } from '../utils/time.js';

const router = Router();

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: 'Too many scans. Please wait a moment.',
});

const DOUBLE_SCAN_MS = 60 * 1000; // ignore a repeat scan within 1 minute

// Public (no login): the scanner on the home page posts the boarder's personal QR here.
// First scan of the day = Time In, second = Time Out.
router.post(
  '/',
  scanLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.qr_token ?? '').trim();
    const notFound = () => fail(res, 404, 'QR not found.', { type: 'NOT_FOUND' });
    if (!token || token.length > 100) return notFound();

    const users = unwrap(
      await supabase
        .from('users')
        .select('id,full_name,preferred_room,role,status')
        .eq('qr_token', token)
        .limit(1)
    );
    const person = users[0];
    if (!person || person.role !== 'Boarder') return notFound();
    if (person.status === 'Pending' || person.status === 'Declined') {
      return fail(res, 403, 'Your account is not approved yet.');
    }
    if (person.status === 'Archived') {
      return fail(res, 403, 'Your account is archived. Please contact the owner.');
    }
    if (person.status === 'Disabled') {
      return fail(res, 403, 'Your account is disabled. Please contact the owner.');
    }

    const today = todayString();
    const now = new Date();
    const who = { name: person.full_name, room: person.preferred_room ?? null };

    const records = unwrap(
      await supabase
        .from('attendance')
        .select('id,time_in,time_out')
        .eq('user_id', person.id)
        .eq('attendance_date', today)
        .limit(1)
    );
    const record = records[0];

    if (!record) {
      unwrap(
        await supabase.from('attendance').insert({
          user_id: person.id,
          attendance_date: today,
          time_in: now.toISOString(),
          time_out: null,
          qr_token: token,
          status: 'IN',
        })
      );
      return res.json({
        success: true,
        type: 'TIME_IN',
        time: clockTime(now),
        ...who,
        message: `${person.full_name} — Time In at ${clockTime(now)}`,
      });
    }

    if (record.time_in && !record.time_out) {
      const since = now.getTime() - new Date(record.time_in).getTime();
      if (since < DOUBLE_SCAN_MS) {
        return fail(res, 409, `${person.full_name}, you already scanned a moment ago.`, {
          type: 'DUPLICATE',
          ...who,
        });
      }
      unwrap(
        await supabase
          .from('attendance')
          .update({ time_out: now.toISOString(), status: 'OUT' })
          .eq('id', record.id)
      );
      return res.json({
        success: true,
        type: 'TIME_OUT',
        time: clockTime(now),
        ...who,
        message: `${person.full_name} — Time Out at ${clockTime(now)}`,
      });
    }

    return fail(res, 409, `${person.full_name} already has Time In and Time Out today.`, {
      type: 'COMPLETE',
      ...who,
    });
  })
);

export default router;
