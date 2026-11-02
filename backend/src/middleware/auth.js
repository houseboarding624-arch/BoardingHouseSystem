import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { fail } from '../utils/http.js';

export const COOKIE_NAME = 'bh_token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
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

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return fail(res, 401, 'Please login first.');

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return fail(res, 401, 'Your session has expired. Please login again.');
  }
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
