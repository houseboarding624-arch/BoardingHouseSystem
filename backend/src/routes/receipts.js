import { Router } from 'express';
import { supabase, unwrap } from '../supabase.js';
import { asyncHandler, fail } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

export const receiptNumber = (id) => `OR-${String(id).padStart(6, '0')}`;

// Official receipt for one PAID payment.
// A boarder can only open their own; Admin and Owner can open any.
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return fail(res, 400, 'Invalid receipt.');

    const rows = unwrap(
      await supabase
        .from('payments')
        .select('id,user_id,amount,payment_date,description,type,proof_ref,verified,created_at')
        .eq('id', id)
        .limit(1)
    );
    const payment = rows[0];
    // Same answer for "not found" and "not yours" so ids can't be probed.
    if (!payment || (req.user.role === 'Boarder' && Number(payment.user_id) !== Number(req.user.id))) {
      return fail(res, 404, 'Receipt not found.');
    }
    if (!payment.verified) return fail(res, 409, 'This payment is marked Unpaid, so there is no receipt yet.');

    const boarder = unwrap(
      await supabase.from('users').select('full_name,preferred_room').eq('id', payment.user_id).limit(1)
    )[0];
    const viaGcash = unwrap(
      await supabase.from('gcash_payments').select('reference_no').eq('payment_id', id).limit(1)
    )[0];

    res.json({
      success: true,
      receipt: {
        number: receiptNumber(id),
        date: payment.payment_date,
        issued_at: payment.created_at,
        boarder: boarder?.full_name ?? 'Unknown',
        room: boarder?.preferred_room ?? null,
        type: payment.type,
        description: payment.description || null,
        amount: Number(payment.amount),
        method: viaGcash ? 'GCash' : 'Recorded by admin',
        reference: viaGcash?.reference_no || payment.proof_ref || null,
        status: 'PAID',
      },
    });
  })
);

export default router;
