import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { requireRole } from '../middleware/auth.js';
import { todayString } from '../utils/time.js';
import { addMonths, isDate } from '../utils/dates.js';
import { getSettings, saveSetting } from '../services/settings.js';
import { syncRoomStatuses, tenantsByRoom, checkRoomHasBed, BEDS_PER_ROOM } from '../services/rooms.js';
import { notifyUser } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { recordPayment, hasRentThisMonth, RENT_ALREADY_PAID } from '../services/payments.js';
import { billingState, runAllChecks, runCurfewCheck } from '../services/scheduler.js';
import { mailConfigured } from '../mailer.js';
import { config } from '../config.js';

const router = Router();
router.use(requireRole('Admin'));

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const idOf = (req) => Number.parseInt(req.params.id, 10);
const byId = (list) => new Map(list.map((item) => [Number(item.id), item]));

const BOARDER_COLUMNS =
  'id,username,full_name,gender,contact,email,address,preferred_room,status,move_in_date,next_due_date,terminated_at,termination_reason,created_at';

function monthKeys(today, count) {
  const keys = [];
  let cursor = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < count; i += 1) {
    keys.unshift(cursor.slice(0, 7));
    cursor = addMonths(cursor, -1);
  }
  return keys;
}

// ------------------------------------------------------------ dashboard data
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const today = todayString();
    const thisMonth = today.slice(0, 7);
    const settings = await getSettings();
    const rooms = await syncRoomStatuses();

    const boarders = unwrap(
      await supabase
        .from('users')
        .select(BOARDER_COLUMNS)
        .eq('role', 'Boarder')
        .in('status', ['Active', 'Disabled'])
        .order('created_at', { ascending: false })
    );
    // Registrations waiting for approval (and ones that were declined).
    const registrations = unwrap(
      await supabase
        .from('users')
        .select(BOARDER_COLUMNS)
        .eq('role', 'Boarder')
        .in('status', ['Pending', 'Declined'])
        .order('created_at', { ascending: true })
    );
    const allUsers = unwrap(
      await supabase
        .from('users')
        .select('id,username,full_name,role,email,contact,status')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true })
    );

    const firstMonth = `${monthKeys(today, 6)[0]}-01`;
    const payments = unwrap(
      await supabase
        .from('payments')
        .select('id,user_id,amount,payment_date,description,type,proof_ref,verified')
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(500)
    );
    const expenses = unwrap(
      await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(500)
    );
    const attendance = unwrap(
      await supabase
        .from('attendance')
        .select('id,user_id,attendance_date,time_in,time_out,status')
        .order('attendance_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100)
    );
    const reservations = unwrap(
      await supabase.from('reservations').select('*').order('id', { ascending: false }).limit(200)
    );
    const maintenance = unwrap(
      await supabase.from('maintenance_requests').select('*').order('id', { ascending: false }).limit(200)
    );
    const announcements = unwrap(
      await supabase.from('announcements').select('*').order('id', { ascending: false }).limit(50)
    );
    const notifications = unwrap(
      await supabase.from('notifications').select('*').order('id', { ascending: false }).limit(100)
    );
    const auditLogs = unwrap(
      await supabase.from('audit_logs').select('*').order('id', { ascending: false }).limit(100)
    );

    const reports = unwrap(
      await supabase.from('reports').select('*').order('id', { ascending: false }).limit(200)
    );
    const gcashPayments = unwrap(
      await supabase.from('gcash_payments').select('*').order('id', { ascending: false }).limit(200)
    );

    const people = byId(boarders);
    const roomMap = tenantsByRoom(boarders);
    const nameOf = (id, fallback = 'Unknown') => people.get(Number(id))?.full_name ?? fallback;

    const roomRows = rooms.map((room) => {
      const tenantList = (roomMap.get(String(room.room_number)) ?? []).map((b) => ({
        id: b.id,
        full_name: b.full_name,
      }));
      return {
        ...room,
        tenantList,
        tenants: tenantList.length,
        occupancyPercent: Math.round((tenantList.length / BEDS_PER_ROOM) * 100),
      };
    });

    const usableRooms = roomRows.filter((r) => r.status !== 'Maintenance');
    const countStatus = (status) => rooms.filter((r) => r.status === status).length;

    const boarderRows = boarders.map((b) => ({
      ...b,
      billing: billingState(b, today, settings.grace_days),
    }));
    const activeBoarders = boarderRows.filter((b) => b.status !== 'Disabled');
    const todayRecords = attendance.filter((r) => r.attendance_date === today);

    const months = monthKeys(today, 6);
    const report = months.map((month) => ({
      month,
      income: payments
        .filter((p) => String(p.payment_date).startsWith(month))
        .reduce((sum, p) => sum + Number(p.amount), 0),
      expenses: expenses
        .filter((e) => String(e.expense_date).startsWith(month))
        .reduce((sum, e) => sum + Number(e.amount), 0),
    })).map((row) => ({ ...row, net: row.income - row.expenses }));

    res.json({
      success: true,
      today,
      settings,
      mail: { configured: mailConfigured(), account: config.mail.user || null },
      stats: {
        totalRooms: rooms.length,
        occupiedRooms: countStatus('Occupied'),
        availableRooms: countStatus('Available'),
        totalBeds: usableRooms.length * BEDS_PER_ROOM,
        freeBeds: usableRooms.reduce((sum, r) => sum + r.beds_left, 0),
        maintenanceRooms: countStatus('Maintenance'),
        occupancyRate: usableRooms.length
          ? Math.round(((usableRooms.length * BEDS_PER_ROOM - usableRooms.reduce((sum, r) => sum + r.beds_left, 0)) / (usableRooms.length * BEDS_PER_ROOM)) * 100)
          : 0,
        tenants: activeBoarders.length,
        disabled: boarderRows.length - activeBoarders.length,
        overdue: activeBoarders.filter((b) => ['Overdue', 'Past grace'].includes(b.billing.state)).length,
        dueSoon: activeBoarders.filter((b) => b.billing.urgent).length,
        monthTotal: payments
          .filter((p) => String(p.payment_date).startsWith(thisMonth))
          .reduce((sum, p) => sum + Number(p.amount), 0),
        monthExpenses: expenses
          .filter((e) => String(e.expense_date).startsWith(thisMonth))
          .reduce((sum, e) => sum + Number(e.amount), 0),
        newReports: reports.filter((r) => r.status === 'New').length,
        pendingGcash: gcashPayments.filter((g) => g.status === 'Pending').length,
        pendingRegistrations: registrations.filter((r) => r.status === 'Pending').length,
        todayAttendance: todayRecords.length,
        todayTimeOut: todayRecords.filter((r) => r.time_out).length,
      },
      accounts: {
        owners: allUsers.filter((u) => u.role === 'Owner').length,
        admins: allUsers.filter((u) => u.role === 'Admin').length,
        tenants: activeBoarders.length,
      },
      rooms: roomRows,
      boarders: boarderRows,
      registrations,
      users: allUsers,
      payments: payments.map((p) => ({ ...p, full_name: nameOf(p.user_id) })),
      expenses,
      reservations,
      maintenance,
      announcements,
      notifications: notifications.map((n) => ({ ...n, full_name: nameOf(n.user_id) })),
      audit: auditLogs,
      report,
      reports: reports.map((r) => ({
        ...r,
        full_name: nameOf(r.user_id),
        room: people.get(Number(r.user_id))?.preferred_room ?? null,
      })),
      gcashPayments: gcashPayments.map((g) => ({ ...g, full_name: nameOf(g.user_id) })),
      recentAttendance: attendance.slice(0, 8).map((r) => ({ ...r, full_name: nameOf(r.user_id) })),
      attendance: attendance.map((r) => ({
        ...r,
        full_name: nameOf(r.user_id),
        room: people.get(Number(r.user_id))?.preferred_room ?? null,
      })),
      runtime: `Node ${process.version}`,
    });
  })
);

// ----------------------------------------------------------- registrations
// New boarders register as "Pending" and cannot log in until the admin approves them.
async function findRegistration(id) {
  const rows = unwrap(
    await supabase
      .from('users')
      .select('id,full_name,email,preferred_room,status')
      .eq('id', id)
      .eq('role', 'Boarder')
      .in('status', ['Pending', 'Declined'])
      .limit(1)
  );
  return rows[0];
}

router.post(
  '/registrations/:id/approve',
  asyncHandler(async (req, res) => {
    const person = await findRegistration(idOf(req));
    if (!person) return fail(res, 404, 'Registration not found.');

    // If the chosen room exists, the boarder moves in today; otherwise the admin assigns a room later.
    let assigned = false;
    if (person.preferred_room) {
      const exists = unwrap(
        await supabase.from('rooms').select('id').eq('room_number', person.preferred_room).limit(1)
      );
      if (exists.length) {
        const check = await checkRoomHasBed(person.preferred_room);
        if (!check.ok) return fail(res, 409, `${check.message} Decline this account, or change the room first.`);
        assigned = true;
      }
    }

    const today = todayString();
    unwrap(
      await supabase
        .from('users')
        .update({
          status: 'Active',
          move_in_date: assigned ? today : null,
          next_due_date: assigned ? addMonths(today, 1) : null,
        })
        .eq('id', person.id)
    );
    if (assigned) await syncRoomStatuses();

    await notifyUser(person, {
      type: 'Account',
      title: 'Your account was approved',
      message: 'Your boarding house account was approved by the admin. You can now log in.',
    });
    await audit(req.user, 'Registration approved', person.full_name);
    res.json({ success: true, message: `${person.full_name} was approved and can now log in.` });
  })
);

router.post(
  '/registrations/:id/decline',
  asyncHandler(async (req, res) => {
    const person = await findRegistration(idOf(req));
    if (!person) return fail(res, 404, 'Registration not found.');

    unwrap(await supabase.from('users').update({ status: 'Declined' }).eq('id', person.id));
    await notifyUser(person, {
      type: 'Account',
      title: 'Your registration was declined',
      message: 'Your boarding house registration was declined by the admin. Please contact the owner for details.',
    });
    await audit(req.user, 'Registration declined', person.full_name);
    res.json({ success: true, message: `${person.full_name}'s registration was declined.` });
  })
);

// ------------------------------------------------------------------- rooms
router.delete(
  '/rooms/:id',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const rooms = unwrap(await supabase.from('rooms').select('*').eq('id', id).limit(1));
    if (!rooms.length) return fail(res, 404, 'Room not found.');
    const room = rooms[0];

    const living = unwrap(
      await supabase
        .from('users')
        .select('id')
        .eq('role', 'Boarder')
        .eq('status', 'Active')
        .eq('preferred_room', room.room_number)
    );
    if (living.length) {
      return fail(res, 409, `Room ${room.room_number} still has ${living.length} boarder(s). Move them first.`);
    }
    unwrap(await supabase.from('rooms').delete().eq('id', id));
    await audit(req.user, 'Room deleted', `Room ${room.room_number}`);
    res.json({ success: true, message: `Room ${room.room_number} deleted.` });
  })
);

// ----------------------------------------------------------------- tenants
router.patch(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const found = unwrap(
      await supabase.from('users').select('id,full_name,preferred_room,status,move_in_date,next_due_date').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!found.length) return fail(res, 404, 'Boarder not found.');
    const boarder = found[0];
    const patch = {};
    const body = req.body ?? {};

    if ('preferred_room' in body) {
      const roomNumber = text(body.preferred_room, 20);
      if (roomNumber) {
        const check = await checkRoomHasBed(roomNumber, boarder.id);
        if (!check.ok) return fail(res, 409, check.message);
        patch.preferred_room = roomNumber;
        if (!boarder.move_in_date) patch.move_in_date = todayString();
      } else {
        patch.preferred_room = null;
      }
    }
    if ('next_due_date' in body) {
      const value = text(body.next_due_date, 10);
      if (value && !isDate(value)) return fail(res, 400, 'Invalid due date.');
      patch.next_due_date = value || null;
      patch.due_notice_for = null;
    }
    if ('move_in_date' in body) {
      const value = text(body.move_in_date, 10);
      if (value && !isDate(value)) return fail(res, 400, 'Invalid move-in date.');
      patch.move_in_date = value || null;
    }
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update.');

    unwrap(await supabase.from('users').update(patch).eq('id', id));
    await syncRoomStatuses();
    await audit(req.user, 'Tenant updated', `${boarder.full_name}: ${JSON.stringify(patch)}`);
    res.json({ success: true, message: `${boarder.full_name} updated.` });
  })
);

router.post(
  '/tenants/:id/disable',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const found = unwrap(
      await supabase.from('users').select('id,full_name,email,status').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!found.length) return fail(res, 404, 'Boarder not found.');
    const boarder = found[0];
    const reason = text(req.body?.reason, 255) || 'Disabled by admin';

    unwrap(
      await supabase
        .from('users')
        .update({ status: 'Disabled', terminated_at: new Date().toISOString(), termination_reason: reason })
        .eq('id', id)
    );
    await syncRoomStatuses();
    await notifyUser(boarder, {
      type: 'Disabled',
      title: 'Your account has been disabled',
      message: `Hi ${boarder.full_name}, your account has been disabled. Reason: ${reason}.`,
    });
    await audit(req.user, 'Tenant disabled', `${boarder.full_name} - ${reason}`);
    res.json({ success: true, message: `${boarder.full_name} was disabled and the bed is now free.` });
  })
);

router.post(
  '/tenants/:id/reinstate',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const found = unwrap(
      await supabase.from('users').select('id,full_name,preferred_room').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!found.length) return fail(res, 404, 'Boarder not found.');
    const boarder = found[0];

    if (boarder.preferred_room) {
      const check = await checkRoomHasBed(boarder.preferred_room, boarder.id);
      if (!check.ok) return fail(res, 409, `${check.message} Assign another room first.`);
    }
    unwrap(
      await supabase
        .from('users')
        .update({
          status: 'Active',
          terminated_at: null,
          termination_reason: null,
          due_notice_for: null,
          next_due_date: addMonths(todayString(), 1),
        })
        .eq('id', id)
    );
    await syncRoomStatuses();
    await audit(req.user, 'Tenant reinstated', boarder.full_name);
    res.json({ success: true, message: `${boarder.full_name} is active again. Next due date is one month from today.` });
  })
);

// Manual billing reminder
router.post(
  '/tenants/:id/remind',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const found = unwrap(
      await supabase.from('users').select('id,full_name,email,next_due_date,status').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!found.length) return fail(res, 404, 'Boarder not found.');
    const boarder = found[0];
    const settings = await getSettings();
    const status = await notifyUser(boarder, {
      type: 'Payment Due',
      title: 'Boarding house payment reminder',
      message:
        `Hi ${boarder.full_name}, this is a reminder to pay your boarding house rent` +
        (boarder.next_due_date ? ` (due ${boarder.next_due_date})` : '') +
        `. Unpaid rent more than ${settings.grace_days} days after the due date results in your account being disabled.`,
    });
    await audit(req.user, 'Payment reminder', `${boarder.full_name} (email ${status})`);
    res.json({
      success: true,
      message:
        status === 'sent'
          ? `Reminder emailed to ${boarder.full_name}.`
          : `Reminder saved in the app, but the email was ${status === 'failed' ? 'not sent (check Utilities)' : 'skipped (no email on file)'}.`,
    });
  })
);

// ------------------------------------------------------------ payment proof
router.patch(
  '/payments/:id',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const patch = {};
    if ('verified' in (req.body ?? {})) patch.verified = Boolean(req.body.verified);
    if ('proof_ref' in (req.body ?? {})) patch.proof_ref = text(req.body.proof_ref, 255) || null;
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update.');
    unwrap(await supabase.from('payments').update(patch).eq('id', id));
    await audit(req.user, 'Payment proof updated', `Payment #${id}: ${JSON.stringify(patch)}`);
    res.json({ success: true, message: 'Payment updated.' });
  })
);

// ------------------------------------------------------------ reservations
router.post(
  '/reservations',
  asyncHandler(async (req, res) => {
    const fullName = text(req.body?.full_name, 150);
    const date = text(req.body?.reserved_for, 10);
    if (!fullName) return fail(res, 400, 'Name is required.');
    if (date && !isDate(date)) return fail(res, 400, 'Invalid date.');
    unwrap(
      await supabase.from('reservations').insert({
        full_name: fullName,
        contact: text(req.body?.contact, 30) || null,
        email: text(req.body?.email, 150) || null,
        room_number: text(req.body?.room_number, 20) || null,
        reserved_for: date || null,
        notes: text(req.body?.notes, 255) || null,
      })
    );
    await audit(req.user, 'Reservation added', fullName);
    res.status(201).json({ success: true, message: 'Reservation added.' });
  })
);

router.patch(
  '/reservations/:id',
  asyncHandler(async (req, res) => {
    const status = text(req.body?.status, 20);
    if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) return fail(res, 400, 'Invalid status.');
    unwrap(await supabase.from('reservations').update({ status }).eq('id', idOf(req)));
    await audit(req.user, 'Reservation updated', `#${idOf(req)} -> ${status}`);
    res.json({ success: true, message: `Reservation ${status.toLowerCase()}.` });
  })
);

router.delete(
  '/reservations/:id',
  asyncHandler(async (req, res) => {
    unwrap(await supabase.from('reservations').delete().eq('id', idOf(req)));
    await audit(req.user, 'Reservation deleted', `#${idOf(req)}`);
    res.json({ success: true, message: 'Reservation deleted.' });
  })
);

// ---------------------------------------------------------------- expenses
router.post(
  '/expenses',
  asyncHandler(async (req, res) => {
    const category = text(req.body?.category, 60);
    const amount = Number(req.body?.amount);
    const date = text(req.body?.expense_date, 10);
    if (!category || !Number.isFinite(amount) || amount <= 0 || !isDate(date)) {
      return fail(res, 400, 'Invalid expense information.');
    }
    unwrap(
      await supabase.from('expenses').insert({
        category,
        amount,
        expense_date: date,
        description: text(req.body?.description, 255) || null,
      })
    );
    await audit(req.user, 'Expense added', `${category} ${amount}`);
    res.status(201).json({ success: true, message: 'Expense saved.' });
  })
);

router.delete(
  '/expenses/:id',
  asyncHandler(async (req, res) => {
    unwrap(await supabase.from('expenses').delete().eq('id', idOf(req)));
    await audit(req.user, 'Expense deleted', `#${idOf(req)}`);
    res.json({ success: true, message: 'Expense deleted.' });
  })
);

// ------------------------------------------------------------- maintenance
router.post(
  '/maintenance',
  asyncHandler(async (req, res) => {
    const issue = text(req.body?.issue, 255);
    const cost = Number(req.body?.cost ?? 0);
    if (!issue || !Number.isFinite(cost) || cost < 0) return fail(res, 400, 'Invalid maintenance request.');
    unwrap(
      await supabase.from('maintenance_requests').insert({
        issue,
        cost,
        room_number: text(req.body?.room_number, 20) || null,
      })
    );
    await audit(req.user, 'Maintenance added', issue);
    res.status(201).json({ success: true, message: 'Maintenance request added.' });
  })
);

router.patch(
  '/maintenance/:id',
  asyncHandler(async (req, res) => {
    const status = text(req.body?.status, 20);
    if (!['Open', 'In Progress', 'Done'].includes(status)) return fail(res, 400, 'Invalid status.');
    unwrap(await supabase.from('maintenance_requests').update({ status }).eq('id', idOf(req)));
    await audit(req.user, 'Maintenance updated', `#${idOf(req)} -> ${status}`);
    res.json({ success: true, message: `Marked ${status}.` });
  })
);

router.delete(
  '/maintenance/:id',
  asyncHandler(async (req, res) => {
    unwrap(await supabase.from('maintenance_requests').delete().eq('id', idOf(req)));
    await audit(req.user, 'Maintenance deleted', `#${idOf(req)}`);
    res.json({ success: true, message: 'Request deleted.' });
  })
);

// ------------------------------------------- announcements + notifications
async function broadcast({ title, message, type, email }) {
  const boarders = unwrap(
    await supabase.from('users').select('id,full_name,email').eq('role', 'Boarder').eq('status', 'Active')
  );
  let emailed = 0;
  for (const boarder of boarders) {
    const status = await notifyUser(boarder, { type, title, message, email });
    if (status === 'sent') emailed += 1;
  }
  return { count: boarders.length, emailed };
}

router.post(
  '/announcements',
  asyncHandler(async (req, res) => {
    const title = text(req.body?.title, 150);
    const body = text(req.body?.body, 2000);
    if (!title || !body) return fail(res, 400, 'Title and message are required.');
    unwrap(await supabase.from('announcements').insert({ title, body }));
    const result = await broadcast({ title, message: body, type: 'Announcement', email: req.body?.email !== false });
    await audit(req.user, 'Announcement posted', title);
    res.status(201).json({
      success: true,
      message: `Announcement posted to ${result.count} boarder(s), ${result.emailed} emailed.`,
    });
  })
);

router.delete(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    unwrap(await supabase.from('announcements').delete().eq('id', idOf(req)));
    await audit(req.user, 'Announcement deleted', `#${idOf(req)}`);
    res.json({ success: true, message: 'Announcement deleted.' });
  })
);

router.post(
  '/notify',
  asyncHandler(async (req, res) => {
    const title = text(req.body?.title, 150);
    const message = text(req.body?.message, 2000);
    const email = req.body?.email !== false;
    if (!title || !message) return fail(res, 400, 'Title and message are required.');

    if (req.body?.user_id === 'all') {
      const result = await broadcast({ title, message, type: 'Manual', email });
      await audit(req.user, 'Notification sent', `All boarders: ${title}`);
      return res.json({ success: true, message: `Sent to ${result.count} boarder(s), ${result.emailed} emailed.` });
    }

    const id = Number.parseInt(req.body?.user_id, 10);
    const found = unwrap(
      await supabase.from('users').select('id,full_name,email').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!found.length) return fail(res, 400, 'Choose a boarder.');
    const status = await notifyUser(found[0], { type: 'Manual', title, message, email });
    await audit(req.user, 'Notification sent', `${found[0].full_name}: ${title}`);
    res.json({
      success: true,
      message: `Sent to ${found[0].full_name} (email ${status}).`,
    });
  })
);

// ------------------------------------------------------ reset a boarder's password
router.post(
  '/tenants/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const rows = unwrap(
      await supabase.from('users').select('id,full_name').eq('id', id).eq('role', 'Boarder').limit(1)
    );
    if (!rows.length) return fail(res, 404, 'Boarder not found.');

    const pick = (chars, n) => Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]);
    const temp = [
      ...pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 3),
      ...pick('abcdefghijkmnopqrstuvwxyz', 4),
      ...pick('23456789', 3),
      ...pick('!@#$%', 2),
    ]
      .sort(() => crypto.randomInt(3) - 1)
      .join('');

    unwrap(await supabase.from('users').update({ password: await bcrypt.hash(temp, 10) }).eq('id', id));
    await audit(req.user, 'Password reset', rows[0].full_name);
    res.json({
      success: true,
      temp_password: temp,
      message: `Temporary password created for ${rows[0].full_name}.`,
    });
  })
);

// ------------------------------------------------------- boarder reports (complaints)
router.patch(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const status = String(req.body?.status ?? '');
    const reply = text(req.body?.reply, 1000);
    if (status && !['New', 'In Progress', 'Resolved'].includes(status)) {
      return fail(res, 400, 'Invalid status.');
    }

    const found = unwrap(await supabase.from('reports').select('*').eq('id', id).limit(1));
    if (!found.length) return fail(res, 404, 'Report not found.');
    const report = found[0];

    const patch = {};
    if (status) patch.status = status;
    if (reply) patch.admin_reply = reply;
    if (status === 'Resolved') patch.resolved_at = new Date().toISOString();
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update.');
    unwrap(await supabase.from('reports').update(patch).eq('id', id));

    const boarder = unwrap(
      await supabase.from('users').select('id,full_name,email').eq('id', report.user_id).limit(1)
    )[0];
    if (boarder) {
      const label = status || report.status;
      await notifyUser(boarder, {
        type: 'Report',
        title: `Your report: ${report.subject}`,
        message: reply ? `Status: ${label}. Reply: ${reply}` : `Status changed to ${label}.`,
        email: false,
      });
    }
    await audit(req.user, 'Report updated', `#${id} ${JSON.stringify(patch)}`);
    res.json({ success: true, message: 'Report updated and the boarder was notified.' });
  })
);

// --------------------------------------------------------------- GCash payments
router.post(
  '/gcash/:id/approve',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const pendingRow = unwrap(await supabase.from('gcash_payments').select('user_id,type,status').eq('id', id).limit(1))[0];
    if (!pendingRow) return fail(res, 404, 'Payment not found.');
    if (
      pendingRow.status === 'Pending' &&
      pendingRow.type === 'Rent' &&
      (await hasRentThisMonth(pendingRow.user_id, todayString(), { includePending: false }))
    ) {
      return fail(res, 409, `${RENT_ALREADY_PAID} Reject this one, or ask the boarder to resend it as Advance Payment.`);
    }
    // Claim it first so a double click can't record the payment twice.
    const claimed = unwrap(
      await supabase
        .from('gcash_payments')
        .update({ status: 'Approved', reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'Pending')
        .select('*')
    );
    if (!claimed.length) return fail(res, 409, 'This payment was already reviewed.');
    const g = claimed[0];

    const { paymentId, nextDue } = await recordPayment({
      userId: g.user_id,
      amount: Number(g.amount),
      date: todayString(),
      description: `GCash${g.note ? ` - ${g.note}` : ''}`,
      type: g.type,
      proofRef: g.reference_no,
      verified: true,
    });
    unwrap(await supabase.from('gcash_payments').update({ payment_id: paymentId }).eq('id', id));

    const boarder = unwrap(
      await supabase.from('users').select('id,full_name,email').eq('id', g.user_id).limit(1)
    )[0];
    if (boarder) {
      await notifyUser(boarder, {
        type: 'Payment',
        title: 'GCash payment confirmed',
        message: `Your GCash payment of ${g.amount} (ref ${g.reference_no}) was confirmed.${
          nextDue ? ` Next due date: ${nextDue}.` : ''
        } Your receipt is ready in Payment Records.`,
      });
    }
    await audit(req.user, 'GCash approved', `#${id} ${boarder?.full_name ?? ''} ${g.amount} ref ${g.reference_no}`);
    res.json({ success: true, message: `Payment approved and recorded.${nextDue ? ` Next due date: ${nextDue}.` : ''}` });
  })
);

router.post(
  '/gcash/:id/reject',
  asyncHandler(async (req, res) => {
    const id = idOf(req);
    const reason = text(req.body?.reason, 255);
    if (!reason) return fail(res, 400, 'Please give a reason.');

    const rejected = unwrap(
      await supabase
        .from('gcash_payments')
        .update({ status: 'Rejected', reject_reason: reason, reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'Pending')
        .select('*')
    );
    if (!rejected.length) return fail(res, 409, 'This payment was already reviewed.');
    const g = rejected[0];

    const boarder = unwrap(
      await supabase.from('users').select('id,full_name,email').eq('id', g.user_id).limit(1)
    )[0];
    if (boarder) {
      await notifyUser(boarder, {
        type: 'Payment',
        title: 'GCash payment not accepted',
        message: `Your GCash payment (ref ${g.reference_no}) was not accepted. Reason: ${reason}`,
      });
    }
    await audit(req.user, 'GCash rejected', `#${id} ref ${g.reference_no}: ${reason}`);
    res.json({ success: true, message: 'Payment rejected and the boarder was notified.' });
  })
);

// ---------------------------------------------------------------- settings
router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if ('curfew_time' in body) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.curfew_time))) return fail(res, 400, 'Curfew time must be HH:MM.');
      await saveSetting('curfew_time', body.curfew_time);
      await saveSetting('curfew_last_run', ''); // allow today's notice at the new time
    }
    if ('curfew_enabled' in body) await saveSetting('curfew_enabled', Boolean(body.curfew_enabled));
    if ('auto_terminate' in body) await saveSetting('auto_terminate', Boolean(body.auto_terminate));
    if ('grace_days' in body) {
      const days = Number.parseInt(body.grace_days, 10);
      if (!Number.isInteger(days) || days < 0 || days > 60) return fail(res, 400, 'Grace days must be 0-60.');
      await saveSetting('grace_days', days);
    }
    if ('gcash_number' in body) {
      const number = text(body.gcash_number, 20).replace(/[\s-]/g, '');
      if (number && !/^(\+?63|0)9\d{9}$/.test(number)) {
        return fail(res, 400, 'GCash number must look like 09171234567.');
      }
      await saveSetting('gcash_number', number);
    }
    if ('gcash_name' in body) await saveSetting('gcash_name', text(body.gcash_name, 80));
    await audit(req.user, 'Settings changed', JSON.stringify(body));
    res.json({ success: true, message: 'Settings saved.' });
  })
);

router.post(
  '/run-checks',
  asyncHandler(async (req, res) => {
    const result = await runAllChecks();
    await audit(req.user, 'Checks run manually', JSON.stringify(result));
    const p = result.payments ?? {};
    res.json({
      success: true,
      message: `Payment check: ${p.warned ?? 0} warned, ${p.disabled ?? 0} disabled.`,
      result,
    });
  })
);

router.post(
  '/curfew-now',
  asyncHandler(async (req, res) => {
    const result = await runCurfewCheck({ force: true });
    await audit(req.user, 'Curfew notice sent manually', JSON.stringify(result));
    res.json({
      success: true,
      message: `Curfew notice sent to ${result.boarders ?? 0} boarder(s), ${result.emailed ?? 0} emailed.`,
    });
  })
);

export default router;
