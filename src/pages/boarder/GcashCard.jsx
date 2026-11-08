import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { dateTime, peso } from '../../utils.js';

const TONE = { Pending: 'bd-pill warn', Approved: 'bd-pill ok', Rejected: 'bd-pill bad' };
const BLANK = { amount: '', type: 'Rent', reference_no: '', sender_number: '', note: '' };

export default function GcashCard({ gcash, history, roomRate, rentPaid, onDone }) {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { text, ok }
  const [copied, setCopied] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });


  useEffect(() => {
    if (rentPaid) setForm((f) => (f.type === 'Rent' ? { ...f, type: 'Advance Payment' } : f));
  }, [rentPaid]);

  const ready = Boolean(gcash?.number || gcash?.hasQr);
  const qrUrl = `/api/gcash-qr?v=${gcash?.qrVersion ?? ''}`;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const data = await api.post('/boarder/gcash', form);
      setMsg({ text: data.message, ok: true });
      setForm(BLANK);
      onDone();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(gcash.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-section-heading">
        <h2>💙 Pay with GCash</h2>
      </div>

      {!ready ? (
        <p className="admin-muted">Online payment is not set up yet. Please ask the admin.</p>
      ) : (
        <>
          <div className="gcash-box">
            {gcash.hasQr ? (
              <>
                <span className="admin-muted">Scan this QR in GCash</span>
                <img className="gcash-qr" src={qrUrl} alt="GCash QR code for payment" />
                <a className="admin-btn admin-btn-light" href={qrUrl} download="gcash-qr">
                  Save QR image
                </a>
              </>
            ) : (
              <span className="admin-muted">Send your payment to</span>
            )}
            {gcash.number && (
              <>
                <strong className="gcash-number">{gcash.number}</strong>
                <button type="button" className="admin-btn admin-btn-light" onClick={copyNumber}>
                  {copied ? 'Copied!' : 'Copy number'}
                </button>
              </>
            )}
            {gcash.name && <span>{gcash.name}</span>}
          </div>
          <ol className="bd-steps">
            {gcash.hasQr ? (
              <li>
                Open GCash → <b>Pay QR</b> → scan the code. On the same phone? Tap <b>Save QR image</b>, then in Pay QR
                choose <b>Upload QR</b> from your gallery.
              </li>
            ) : (
              <li>Open GCash → Send Money → enter the number above.</li>
            )}
            <li>Enter the amount and pay. Then copy the Reference No. from your GCash receipt.</li>
            <li>Fill in the form below. Your payment is confirmed once the admin checks it.</li>
          </ol>

          {rentPaid && (
            <div className="admin-notice success">
              ✅ Your rent for this month is already paid (or waiting for approval). You can pay rent again next month.
              To pay ahead, choose <b>Advance Payment</b>.
            </div>
          )}

          <form className="bd-form" onSubmit={submit}>
            <label>
              Amount (₱)
              <input type="number" min="1" step="0.01" required value={form.amount} onChange={set('amount')} placeholder={roomRate ? `Monthly rate: ${roomRate}` : ""} />
              {roomRate > 0 && !rentPaid && (
                <button type="button" className="bd-link" onClick={() => setForm({ ...form, amount: String(roomRate), type: 'Rent' })}>
                  Use my monthly rate (₱{roomRate})
                </button>
              )}
            </label>
            <label>
              Payment for
              <select value={form.type} onChange={set('type')}>
                <option disabled={rentPaid}>Rent</option>
                <option>Advance Payment</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              GCash Reference No.
              <input required maxLength={40} value={form.reference_no} onChange={set('reference_no')} placeholder="e.g. 1234567890123" />
            </label>
            <label>
              Your GCash number (optional)
              <input value={form.sender_number} onChange={set('sender_number')} placeholder="09171234567" />
            </label>
            <label className="bd-wide">
              Note (optional)
              <input maxLength={255} value={form.note} onChange={set('note')} placeholder="e.g. October rent" />
            </label>
            <button className="admin-btn" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Submit payment'}
            </button>
          </form>
        </>
      )}

      {msg && <div className={`admin-notice ${msg.ok ? 'success' : ''}`}>{msg.text}</div>}

      {history.length > 0 && (
        <div className="admin-table-wrap" style={{ marginTop: 14 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Amount</th>
                <th>For</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((g) => (
                <tr key={g.id}>
                  <td>{dateTime(g.created_at)}</td>
                  <td>{peso(g.amount)}</td>
                  <td>{g.type}</td>
                  <td>{g.reference_no}</td>
                  <td>
                    <span className={TONE[g.status]}>{g.status}</span>
                    {g.reject_reason && <div className="admin-muted">{g.reject_reason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
