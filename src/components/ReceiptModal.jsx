import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { dateTime, peso } from '../utils.js';

function Receipt({ receipt }) {
  return (
    <article className="receipt-sheet">
      <header>
        <h2>🏠 Boarding House</h2>
        <p>OFFICIAL RECEIPT</p>
      </header>

      <dl>
        <div><dt>Receipt No.</dt><dd>{receipt.number}</dd></div>
        <div><dt>Payment date</dt><dd>{receipt.date}</dd></div>
        <div><dt>Received from</dt><dd>{receipt.boarder}</dd></div>
        <div><dt>Room</dt><dd>{receipt.room || '-'}</dd></div>
        <div><dt>Payment for</dt><dd>{receipt.type}</dd></div>
        {receipt.description && <div><dt>Details</dt><dd>{receipt.description}</dd></div>}
        <div><dt>Method</dt><dd>{receipt.method}</dd></div>
        {receipt.reference && <div><dt>Reference No.</dt><dd>{receipt.reference}</dd></div>}
        <div><dt>Issued</dt><dd>{dateTime(receipt.issued_at)}</dd></div>
      </dl>

      <div className="receipt-total">
        <span>AMOUNT PAID</span>
        <strong>{peso(receipt.amount)}</strong>
      </div>
      <div className="receipt-stamp">PAID</div>
      <p className="receipt-foot">This receipt is proof of payment. Please keep it for your records.</p>
    </article>
  );
}

/**
 * Official receipt(s). Pass `paymentId` for one receipt, or `all` for every paid payment of the logged-in boarder
 * (one receipt per printed page). "Print / Save as PDF" uses the browser's print dialog.
 */
export default function ReceiptModal({ paymentId, all = false, onClose }) {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const request = all
      ? api.get('/receipts').then((data) => data.receipts)
      : api.get(`/receipts/${paymentId}`).then((data) => [data.receipt]);
    request.then((list) => alive && setReceipts(list)).catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [paymentId, all]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rendered straight into <body> so printing can hide the whole app and print only the receipt(s).
  return createPortal(
    <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt" onClick={onClose}>
      <div className="receipt-box" onClick={(e) => e.stopPropagation()}>
        {error && <div className="receipt-error">{error}</div>}
        {!receipts && !error && <p className="receipt-loading">Loading receipt…</p>}
        {receipts && !receipts.length && <div className="receipt-error">No paid payments to print yet.</div>}

        {receipts?.map((r) => (
          <Receipt key={r.number} receipt={r} />
        ))}

        <div className="receipt-actions">
          {receipts?.length > 0 && (
            <button type="button" className="admin-btn" onClick={() => window.print()}>
              🖨 {receipts.length > 1 ? `Print all (${receipts.length})` : 'Print / Save as PDF'}
            </button>
          )}
          <button type="button" className="admin-btn admin-btn-light" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
