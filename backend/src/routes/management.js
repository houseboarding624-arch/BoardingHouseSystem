import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { requireRole } from '../middleware/auth.js';
import { todayString } from '../utils/time.js';
import { addMonths, isDate } from '../utils/dates.js';
import { syncRoomStatuses } from '../services/rooms.js';
import { audit } from '../services/audit.js';
import { hasRentThisMonth, RENT_ALREADY_PAID, paymentAmountError } from '../services/payments.js';
import { billingState } from '../services/scheduler.js';
import { getSettings } from '../services/settings.js';

const router = Router();
const ROOM_STATUSES = ['Available', 'Occupied', 'Maintenance'];
const PAYMENT_TYPES = ['Rent', 'Advance Payment', 'Other'];

const byId = (list) => new Map(list.map((item) => [Number(item.id), item]));

// ---------------------------------------------------------------- Admin
router.get(
  '/admin/dashboard',
  requireRole('Owner'),
  asyncHandler(async (req, res) => {
    const today = todayString();

    const boarders = unwrap(
      await supabase
        .from('users')
        .select('id,username,full_name,contact,email,preferred_room,gender,status,next_due_date')
        .eq('role', 'Boarder')
        .in('status', ['Active', 'Disabled'])
        .order('full_name', { ascending: true })
    );
    // Boarders who moved out or transferred (read-only list for the Owner).
    const archived = unwrap(
      await supabase
        .from('users')
        .select('id,username,full_name,contact,email,preferred_room,gender,archived_at,archive_type,archive_reason')
        .eq('role', 'Boarder')
        .eq('status', 'Archived')
        .order('archived_at', { ascending: false })
    );
    const rooms = await syncRoomStatuses();
    const countRooms = (status) => rooms.filter((r) => r.status === status).length;
    const roomCounts = {
      total: rooms.length,
      available: countRooms('Available'),
      occupied: countRooms('Occupied'),
      maintenance: countRooms('Maintenance'),
    };
    const { grace_days: graceDays } = await getSettings();
    const boarderRows = boarders.map((b) => ({ ...b, billing: billingState(b, today, graceDays) }));

    const payments = unwrap(
      await supabase
        .from('payments')
        .select('id,user_id,amount,payment_date,description,type,verified')
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(50)
    );

    const attendance = unwrap(
      await supabase
        .from('attendance')
        .select('id,user_id,attendance_date,time_in,time_out,status,qr_token')
        .order('attendance_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100)
    );

    const reports = unwrap(
      await supabase.from('reports').select('*').order('id', { ascending: false }).limit(100)
    );
    const gcashPayments = unwrap(
      await supabase.from('gcash_payments').select('*').order('id', { ascending: false }).limit(100)
    );

    const people = byId([...boarders, ...archived]);
    const paymentsTotalToday = payments
      .filter((p) => p.payment_date === today)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      success: true,
      today,
      stats: {
        boarders: boarders.length,
        archived: archived.length,
        rooms: roomCounts,
        dueSoon: boarderRows.filter((b) => b.billing.urgent).length,
        paymentsTotalToday,
        attendanceRecords: attendance.length,
        newReports: reports.filter((r) => r.status === 'New').length,
        pendingGcash: gcashPayments.filter((g) => g.status === 'Pending').length,
      },
      reports: reports.map((r) => ({
        ...r,
        full_name: people.get(Number(r.user_id))?.full_name ?? 'Unknown',
        room: people.get(Number(r.user_id))?.preferred_room ?? null,
      })),
      gcashPayments: gcashPayments.map((g) => ({
        ...g,
        full_name: people.get(Number(g.user_id))?.full_name ?? 'Unknown',
      })),
      boarders: boarderRows,
      roomList: rooms.map((r) => ({
        room_number: r.room_number,
        status: r.status,
        monthly_rate: Number(r.monthly_rate ?? 0),
        beds: r.beds,
        beds_taken: r.beds_taken,
        beds_left: r.beds_left,
      })),
      archived,
      payments: payments.map((p) => ({
        ...p,
        full_name: people.get(Number(p.user_id))?.full_name ?? 'Unknown',
      })),
      attendance: attendance.map(({ qr_token, ...r }) => ({
        ...r,
        full_name: people.get(Number(r.user_id))?.full_name ?? 'Unknown',
        room: people.get(Number(r.user_id))?.preferred_room ?? null,
      })),
    });
  })
);

// ---------------------------------------------------- Shared (Admin + Owner)
router.get(
  '/boarders',
  requireRole('Admin', 'Owner'),
  asyncHandler(async (req, res) => {
    const boarders = unwrap(
      await supabase
        .from('users')
        .select('id,full_name')
        .eq('role', 'Boarder')
        .in('status', ['Active', 'Disabled'])
        .order('full_name', { ascending: true })
    );
    res.json({ success: true, boarders });
  })
);

router.post(
  '/payments',
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const userId = Number.parseInt(req.body?.user_id, 10);
    const amount = Number(req.body?.amount);
    const date = String(req.body?.payment_date ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const type = String(req.body?.type ?? 'Rent').trim();
    const proofRef = String(req.body?.proof_ref ?? '').trim();

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !isDate(date) ||
      description.length > 255 ||
      proofRef.length > 255 ||
      !PAYMENT_TYPES.includes(type)
    ) {
      return fail(res, 400, 'Invalid payment information.');
    }
    const amountError = paymentAmountError(amount);
    if (amountError) return fail(res, 400, amountError);

    // Make sure the payment is attached to a boarder, not an admin/owner account.
    const target = unwrap(
      await supabase
        .from('users')
        .select('id,full_name,next_due_date')
        .eq('id', userId)
        .eq('role', 'Boarder')
        .limit(1)
    );
    if (!target.length) return fail(res, 400, 'Selected boarder was not found.');
    const boarder = target[0];

    // One Rent payment per calendar month.
    if (type === 'Rent' && (await hasRentThisMonth(userId, date))) {
      return fail(res, 409, `${boarder.full_name}: ${RENT_ALREADY_PAID}`);
    }

    unwrap(
      await supabase.from('payments').insert({
        user_id: userId,
        amount,
        payment_date: date,
        description: description || null,
        type,
        proof_ref: proofRef || null,
        verified: true, // a recorded payment is Paid automatically
      })
    );

    // A rent payment moves the next due date one month forward (and starts the cycle if none yet).
    let note = '';
    if (type === 'Rent') {
      const nextDue = addMonths(boarder.next_due_date || date, 1);
      unwrap(await supabase.from('users').update({ next_due_date: nextDue }).eq('id', userId));
      note = ` Next due date: ${nextDue}.`;
    }

    await audit(req.user, 'Payment recorded', `${boarder.full_name} - ${type} ${amount} on ${date}`);
    res.status(201).json({ success: true, message: `Payment saved.${note}` });
  })
);

router.post(
  '/rooms',
  requireRole('Admin', 'Owner'),
  asyncHandler(async (req, res) => {
    const room = String(req.body?.room_number ?? '').trim();
    const rate = Number(req.body?.monthly_rate);
    const requested = String(req.body?.status ?? 'Available').trim();

    if (
      !room ||
      room.length > 20 ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      !ROOM_STATUSES.includes(requested)
    ) {
      return fail(res, 400, 'Invalid room information.');
    }

    // Occupied/Available are automatic (based on whether it has boarders); only Maintenance is manual.
    const status = requested === 'Maintenance' ? 'Maintenance' : 'Available';

    unwrap(
      await supabase
        .from('rooms')
        .upsert(
          { room_number: room, monthly_rate: rate, status },
          { onConflict: 'room_number' }
        )
    );
    await syncRoomStatuses();
    await audit(req.user, 'Room saved', `Room ${room} - rate ${rate}`);

    res.json({ success: true, message: `Room ${room} saved.` });
  })
);

export default router;
