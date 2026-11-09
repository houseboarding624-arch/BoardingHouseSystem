import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { supabase } from '../supabase.js';
import { fail } from '../utils/http.js';

export const COOKIE_NAME = 'bh_token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export function cookieOptions() {
  return {
    httpOnly: true,
    // Cross-site (app on GitHub Pages, API elsewhere) needs SameSite=None, which requires Secure (https).
    sameSite: config.crossSite ? 'none' : 'lax',
    secure: config.isProd || config.crossSite,
    path: '/',
  };
}

export function signSession(user) {
  const payload = {
    id: Number(user.id),
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    preferred_room: user.preferred_room ?? null,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
}

export function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, signSession(user), { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

const SESSION_ENDED = {
  Disabled: 'Your account has been disabled. Please contact the owner.',
  Archived: 'This account is archived. Please contact the owner if you want to return.',
  Pending: 'Your account is waiting for the admin to approve it.',
  Declined: 'Your registration was declined. Please contact the owner.',
};

/**
 * Verifies the login cookie. For boarders it also checks the account's current status on every request,
 * so disabling or archiving a boarder ends their session immediately instead of after the 8-hour token expires.
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return fail(res, 401, 'Please login first.');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return fail(res, 401, 'Your session has expired. Please login again.');
  }

  if (payload.role === 'Boarder') {
    try {
      const { data, error } = await supabase.from('users').select('status').eq('id', payload.id).limit(1);
      if (error) throw error;
      const status = data?.[0]?.status;
      if (!data?.length || status !== 'Active') {
        clearSessionCookie(res);
        return fail(res, 401, SESSION_ENDED[status] || 'Your account is no longer available. Please login again.');
      }
    } catch (err) {
      return next(err); // fail closed: never let a boarder through if the status could not be checked
    }
  }

  req.user = payload;
  return next();
}

export function requireRole(...roles) {
  return [
    requireAuth,
    (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return fail(res, 403, 'Access denied. You do not have permission to access this.');
      }
      return next();
    },
  ];
}
