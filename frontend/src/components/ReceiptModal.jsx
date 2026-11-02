import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { dateTime, peso } from '../utils.js';

/** Official receipt for one paid payment. "Print / Save as PDF" uses the browser's print dialog. */
export default function ReceiptModal({ paymentId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get(`/receipts/${paymentId}`)
      .then((data) => alive && setReceipt(data.receipt))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [paymentId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt" onClick={onClose}>
      <div className="receipt-box" onClick={(e) => e.stopPropagation()}>
        {error && <div className="receipt-error">{error}</div>}
        {!receipt && !error && <p className="receipt-loading">Loading receipt…</p>}

        {receipt && (
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
        )}

        <div className="receipt-actions">
          {receipt && (
            <button type="button" className="admin-btn" onClick={() => window.print()}>
              🖨 Print / Save as PDF
            </button>
          )}
          <button type="button" className="admin-btn admin-btn-light" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
