import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { checkRoomHasBed, listRoomsWithBeds } from '../services/rooms.js';
import { config } from '../config.js';

const MAX_ROOM = 12;

// Create Account rules. Keep in sync with src/textRules.js
const USERNAME_RULE = /^[A-Z][A-Za-z0-9]{7,11}$/;
const capitalizeWords = (value) => value.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase());
const router = Router();

const ROLES = ['Admin', 'Owner', 'Boarder'];

// Keep in sync with src/passwordRules.js
const PASSWORD_RULES = [
  [(p) => p.length >= 8, 'at least 8 characters'],
  [(p) => /[A-Z]/.test(p), 'an uppercase letter'],
  [(p) => /[a-z]/.test(p), 'a lowercase letter'],
  [(p) => /[0-9]/.test(p), 'a number'],
  [(p) => /[^A-Za-z0-9]/.test(p), 'a special character'],
];
const roomsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests. Please try again in a minute.',
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts. Please try again in a few minutes.',
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many attempts. Please try again in a few minutes.',
});

const GENDERS = ['Male', 'Female', 'LGBTQ+'];

const missingPasswordRules = (password) =>
  PASSWORD_RULES.filter(([test]) => !test(password)).map(([, label]) => label);

/** Finds an account by username, or by email. */
const publicUser = (u) => ({
  id: Number(u.id),
  username: u.username,
  full_name: u.full_name,
  role: u.role,
  preferred_room: u.preferred_room ?? null,
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const accountType = String(req.body?.account_type ?? '').trim();

    if (!username || !password || !ROLES.includes(accountType)) {
      return fail(res, 400, 'Please enter username, password, and account type.');
    }

    const rows = unwrap(
      await supabase
        .from('users')
        .select('id,username,password,role,full_name,preferred_room,status')
        .eq('username', username)
        .eq('role', accountType)
        .limit(1)
    );

    const user = rows[0];
    // bcryptjs also verifies the $2y$ hashes created by PHP's password_hash(),
    // so accounts created by the old PHP app keep working.
    const ok = user && (await bcrypt.compare(password, String(user.password)));

    if (!ok) {
      return fail(res, 401, 'Username, password, or account type is incorrect.');
    }

    if (user.role === 'Boarder' && user.status === 'Pending') {
      return fail(res, 403, 'Your account is waiting for the admin to approve it. Please try again later.');
    }
    if (user.role === 'Boarder' && user.status === 'Declined') {
      return fail(res, 403, 'Your registration was declined. Please contact the owner.');
    }
    if (user.role === 'Boarder' && user.status === 'Archived') {
      return fail(res, 403, 'This account is archived. Please contact the owner if you want to return.');
    }
    if (user.role === 'Boarder' && user.status === 'Disabled') {
      return fail(res, 403, 'Your account has been disabled. Please contact the owner.');
    }

    setSessionCookie(res, user);
    return res.json({ success: true, user: publicUser(user) });
  })
);

// Public: room numbers with how many beds are taken / left (no names), for the Create Account dropdown.
router.get(
  '/rooms',
  roomsLimiter,
  asyncHandler(async (req, res) => {
    const rooms = (await listRoomsWithBeds())
      .filter((r) => /^\d+$/.test(r.room_number) && Number(r.room_number) >= 1 && Number(r.room_number) <= MAX_ROOM)
      .sort((a, b) => Number(a.room_number) - Number(b.room_number));
    res.json({ success: true, rooms });
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const fullName = capitalizeWords(String(body.full_name ?? '').trim());
    const contact = String(body.contact ?? '').trim();
    const email = String(body.email ?? '').trim();
    const address = capitalizeWords(String(body.address ?? '').trim());
    let preferredRoom = String(body.preferred_room ?? '').trim();
    const gender = String(body.gender ?? '').trim();

    if (!GENDERS.includes(gender)) {
      return fail(res, 400, 'Please select your gender (Male, Female or LGBTQ+).');
    }
    if (!contact) return fail(res, 400, 'Contact number is required.');
    if (!email) return fail(res, 400, 'Email is required.');
    if (!address) return fail(res, 400, 'Address is required.');
    if (!/^\d{1,11}$/.test(contact)) {
      return fail(res, 400, 'Contact number must be numbers only, up to 11 digits.');
    }
    // The boarding house only has Room 1 to Room MAX_ROOM.
    if (preferredRoom) {
      const n = /^\d{1,3}$/.test(preferredRoom) ? Number(preferredRoom) : NaN;
      if (!(n >= 1 && n <= MAX_ROOM)) {
        return fail(res, 400, `Room does not exist. Rooms are only up to Room ${MAX_ROOM}.`);
      }
      preferredRoom = String(n); // "05" -> "5", matches the room number in the database
    }
    if (!username || !password || !fullName) {
      return fail(res, 400, 'Username, password, and full name are required.');
    }
    const missingRules = PASSWORD_RULES.filter(([test]) => !test(password)).map(([, label]) => label);
    if (missingRules.length) {
      return fail(res, 400, `Password must contain ${missingRules.join(', ')}.`);
    }
    if (!USERNAME_RULE.test(username)) {
      return fail(res, 400, 'Username must be 8 to 12 characters, start with a capital letter, and use letters and numbers only.');
    }
    if (fullName.length > 150) {
      return fail(res, 400, 'Full name is too long.');
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return fail(res, 400, 'Please enter a valid email address.');
    }

    const sameUsername = unwrap(
      await supabase.from('users').select('id').eq('username', username).limit(1)
    );
    if (sameUsername.length) return fail(res, 409, 'Username is already registered.');

    // One person, one account: the same full name (ignoring capital letters and spaces) cannot register twice.
    // Declined registrations do not count, so a rejected person can try again.
    const nameKey = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '');
    const usedNames = unwrap(await supabase.from('users').select('full_name').neq('status', 'Declined'));
    if (usedNames.some((u) => nameKey(u.full_name) === nameKey(fullName))) {
      return fail(res, 409, 'Full name has been used.', { field: 'full_name' });
    }

    // The same contact number or the same email (ignoring capital letters) cannot be used twice.
    // Declined registrations do not count, so a rejected person can try again.
    const sameContact = unwrap(
      await supabase.from('users').select('id').eq('contact', contact).neq('status', 'Declined').limit(1)
    );
    if (sameContact.length) {
      return fail(res, 409, 'Contact number is already registered.', { field: 'contact' });
    }

    const emailPattern = email.replace(/[\\%_]/g, (ch) => `\\${ch}`); // exact match, not a wildcard search
    const sameEmail = unwrap(
      await supabase.from('users').select('id').ilike('email', emailPattern).neq('status', 'Declined').limit(1)
    );
    if (sameEmail.length) {
      return fail(res, 409, 'Email is already registered.', { field: 'email' });
    }

    // If the chosen room exists it must accept boarders (not under maintenance).
    // The room is only really assigned when the admin approves the account.
    if (preferredRoom) {
      const exists = unwrap(
        await supabase.from('rooms').select('id').eq('room_number', preferredRoom).limit(1)
      );
      if (exists.length) {
        const check = await checkRoomHasBed(preferredRoom);
        if (!check.ok) return fail(res, 409, check.message);
      }
    }

    unwrap(
      await supabase.from('users').insert({
        username,
        password: await bcrypt.hash(password, 10),
        role: 'Boarder', // public registration can only ever create boarders
        full_name: fullName,
        gender,
        contact: contact || null,
        email: email || null,
        address: address || null,
        preferred_room: preferredRoom || null,
        status: 'Pending', // cannot log in until the admin approves
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Registration submitted! Please wait for the admin to approve your account before you can log in.',
    });
  })
);

// Logged-in users can change their own password (needed after an admin gives a temporary one).
router.post(
  '/change-password',
  requireAuth,
  resetLimiter,
  asyncHandler(async (req, res) => {
    const current = String(req.body?.current_password ?? '');
    const password = String(req.body?.new_password ?? '');
    const missing = missingPasswordRules(password);
    if (missing.length) return fail(res, 400, `Password must contain ${missing.join(', ')}.`);

    const rows = unwrap(await supabase.from('users').select('id,password').eq('id', req.user.id).limit(1));
    if (!rows.length || !(await bcrypt.compare(current, String(rows[0].password)))) {
      return fail(res, 400, 'Your current password is incorrect.');
    }
    unwrap(await supabase.from('users').update({ password: await bcrypt.hash(password, 10) }).eq('id', req.user.id));
    return res.json({ success: true, message: 'Password changed.' });
  })
);


router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

export default router;
