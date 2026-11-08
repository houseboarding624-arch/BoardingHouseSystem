import crypto from 'node:crypto';
import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { requireRole } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const router = Router();
const newToken = () => `BHU-${crypto.randomBytes(32).toString('hex')}`;

// Admin/Owner: list every active boarder with their personal QR token (for printing).
router.get(
  '/boarders',
  requireRole('Admin', 'Owner'),
  asyncHandler(async (req, res) => {
    const boarders = unwrap(
      await supabase
        .from('users')
        .select('id,full_name,preferred_room,status,qr_token')
        .eq('role', 'Boarder')
        .in('status', ['Active', 'Disabled'])
        .order('full_name', { ascending: true })
    );
    res.json({ success: true, boarders });
  })
);

// Replace a lost/leaked QR. The old one stops working immediately.
router.post(
  '/boarders/:id/regenerate',
  requireRole('Admin', 'Owner'),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid boarder.');

    const rows = unwrap(
      await supabase
        .from('users')
        .update({ qr_token: newToken() })
        .eq('id', id)
        .eq('role', 'Boarder')
        .select('id,full_name,qr_token')
    );
    if (!rows.length) return fail(res, 404, 'Boarder not found.');

    await audit(req.user, 'QR regenerated', rows[0].full_name);
    res.json({ success: true, message: `New QR generated for ${rows[0].full_name}.`, boarder: rows[0] });
  })
);

export default router;
