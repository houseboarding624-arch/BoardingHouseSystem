import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { syncRoomStatuses } from '../services/rooms.js';
import { getSettings } from '../services/settings.js';
import { audit } from '../services/audit.js';
import { billingState } from '../services/scheduler.js';
import { hasRentThisMonth, RENT_ALREADY_PAID } from '../services/payments.js';
import { todayString } from '../utils/time.js';

const router = Router();

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many submissions. Please try again in a few minutes.',
});
const REPORT_CATEGORIES = ['Maintenance', 'Noise', 'Payment', 'Neighbor', 'Safety', 'Other'];
const PAYMENT_TYPES = ['Rent', 'Advance Payment', 'Other'];

// Boarder dashboard data (profile + attendance + payments)
router.get(
  '/dashboard',
  requireRole('Boarder'),
  asyncHandler(async (req, res) => {
    const id = req.user.id;

    const users = unwrap(
      await supabase
        .from('users')
        .select('id,username,full_name,contact,email,address,preferred_room,status,next_due_date,qr_token')
        .eq('id', id)
        .limit(1)
    );
    const user = users[0];
    if (!user) return fail(res, 404, 'Account not found.');

    const attendance = unwrap(
      await supabase
        .from('attendance')
        .select('attendance_date,time_in,time_out,status')
        .eq('user_id', id)
        .order('attendance_date', { ascending: false })
        .limit(30)
    );

    const payments = unwrap(
      await supabase
        .from('payments')
        .select('id,amount,payment_date,description,type,verified')
        .eq('user_id', id)
        .order('payment_date', { ascending: false })
        .limit(20)
    );

    const notifications = unwrap(
      await supabase
        .from('notifications')
        .select('id,type,title,message,is_read,created_at')
        .eq('user_id', id)
        .order('id', { ascending: false })
        .limit(20)
    );

    const rooms = await syncRoomStatuses();
    const count = (status) => rooms.filter((r) => r.status === status).length;
    const roomStats = {
      total: rooms.length,
      available: count('Available'),
      occupied: count('Occupied'),
      maintenance: count('Maintenance'),
    };

    const reports = unwrap(
      await supabase
        .from('reports')
        .select('id,category,subject,message,status,admin_reply,created_at')
        .eq('user_id', id)
        .order('id', { ascending: false })
        .limit(20)
    );
    const gcashPayments = unwrap(
      await supabase
        .from('gcash_payments')
        .select('id,amount,type,reference_no,status,reject_reason,created_at')
        .eq('user_id', id)
        .order('id', { ascending: false })
        .limit(20)
    );
    const settings = await getSettings();

    res.json({
      success: true,
      user,
      attendance,
      payments,
      notifications,
      roomStats,
      roomList: rooms.map((r) => ({
        room_number: r.room_number,
        status: r.status,
        monthly_rate: Number(r.monthly_rate ?? 0),
        beds: r.beds,
        beds_taken: r.beds_taken,
        beds_left: r.beds_left,
      })),
      rentPaidThisMonth: await hasRentThisMonth(id, todayString()),
      billing: billingState(user, todayString(), settings.grace_days),
      reports,
      gcashPayments,
      gcash: {
        number: settings.gcash_number,
        name: settings.gcash_name,
        hasQr: settings.gcash_has_qr,
        qrVersion: settings.gcash_qr_version,
      },
      roomRate: Number(rooms.find((r) => String(r.room_number) === String(user.preferred_room))?.monthly_rate ?? 0),
    });
  })
);

router.post(
  '/notifications/read',
  requireRole('Boarder'),
  asyncHandler(async (req, res) => {
    unwrap(
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false)
    );
    res.json({ success: true });
  })
);

// ----------------------------------------------------------- report / complaint
router.post(
  '/reports',
  requireRole('Boarder'),
  submitLimiter,
  asyncHandler(async (req, res) => {
    const subject = text(req.body?.subject, 120);
    const message = text(req.body?.message, 1000);
    const category = REPORT_CATEGORIES.includes(req.body?.category) ? req.body.category : 'Other';
    if (subject.length < 3) return fail(res, 400, 'Please enter a short subject.');
    if (message.length < 10) return fail(res, 400, 'Please describe the problem (at least 10 characters).');

    unwrap(
      await supabase.from('reports').insert({ user_id: req.user.id, category, subject, message })
    );
    await audit(req.user, 'Report submitted', `${category}: ${subject}`);
    res.status(201).json({
      success: true,
      message: 'Your report was sent. The admin and owner can see it now.',
    });
  })
);

// ------------------------------------------------------------------ GCash payment
router.post(
  '/gcash',
  requireRole('Boarder'),
  submitLimiter,
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    if (!settings.gcash_number && !settings.gcash_has_qr) {
      return fail(res, 400, 'GCash payment is not set up yet. Please ask the admin.');
    }

    const amount = Number(req.body?.amount);
    const type = String(req.body?.type ?? 'Rent');
    const reference = text(req.body?.reference_no, 40).replace(/\s+/g, '').toUpperCase();
    const sender = text(req.body?.sender_number, 20);
    const note = text(req.body?.note, 255);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return fail(res, 400, 'Enter a valid amount.');
    }
    if (!PAYMENT_TYPES.includes(type)) return fail(res, 400, 'Invalid payment type.');
    if (type === 'Rent' && (await hasRentThisMonth(req.user.id, todayString()))) {
      return fail(res, 409, RENT_ALREADY_PAID);
    }
    if (!/^[A-Z0-9]{8,20}$/.test(reference)) {
      return fail(res, 400, 'Enter the reference number from your GCash receipt (letters/numbers only).');
    }
    if (sender && !/^(\+?63|0)9\d{9}$/.test(sender.replace(/[\s-]/g, ''))) {
      return fail(res, 400, 'Your GCash number looks invalid (example: 09171234567).');
    }

    const pending = unwrap(
      await supabase
        .from('gcash_payments')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('status', 'Pending')
    );
    if (pending.length >= 5) {
      return fail(res, 429, 'You already have 5 payments waiting for approval.');
    }

    const { error } = await supabase.from('gcash_payments').insert({
      user_id: req.user.id,
      amount,
      type,
      reference_no: reference,
      sender_number: sender || null,
      note: note || null,
    });
    if (error) {
      if (error.code === '23505') {
        return fail(res, 409, 'This reference number was already submitted.');
      }
      throw new Error(error.message);
    }

    await audit(req.user, 'GCash payment submitted', `${type} ${amount} ref ${reference}`);
    res.status(201).json({
      success: true,
      message: 'GCash payment sent for checking. It will be marked paid once the admin confirms it.',
    });
  })
);

export default router;
