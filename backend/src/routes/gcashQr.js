import { Router } from 'express';
import { asyncHandler, fail } from '../utils/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getGcashQr, saveSetting } from '../services/settings.js';
import { audit } from '../services/audit.js';

const router = Router();
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_CHARS = 600_000; // ~450 KB of image

function looksLikeImage(type, bytes) {
  if (type === 'png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.slice(0, 4).toString('ascii') === 'RIFF'; // webp
}

// Any logged-in user (boarders need it to pay). ?v=<version> is only used to bust the browser cache.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const image = await getGcashQr();
    const match = DATA_URL.exec(image);
    if (!match) return fail(res, 404, 'No GCash QR has been uploaded yet.');
    res.set('Content-Type', `image/${match[1]}`);
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(Buffer.from(match[2], 'base64'));
  })
);

router.post(
  '/',
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const image = String(req.body?.image ?? '');
    if (image.length > MAX_CHARS) return fail(res, 400, 'Image is too large. Use a smaller screenshot.');
    const match = DATA_URL.exec(image);
    if (!match) return fail(res, 400, 'Please upload a PNG, JPG or WEBP image.');
    if (!looksLikeImage(match[1], Buffer.from(match[2].slice(0, 16), 'base64'))) {
      return fail(res, 400, 'That file is not a valid image.');
    }

    await saveSetting('gcash_qr', image);
    await saveSetting('gcash_qr_version', Date.now());
    await audit(req.user, 'GCash QR uploaded', `${Math.round(image.length / 1024)} KB`);
    res.json({ success: true, message: 'GCash QR saved. Boarders can see it now.' });
  })
);

router.delete(
  '/',
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    await saveSetting('gcash_qr', '');
    await saveSetting('gcash_qr_version', '');
    await audit(req.user, 'GCash QR removed');
    res.json({ success: true, message: 'GCash QR removed.' });
  })
);

export default router;
