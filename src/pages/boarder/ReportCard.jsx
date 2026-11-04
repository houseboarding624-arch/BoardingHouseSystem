import { useState } from 'react';
import { api } from '../../api.js';
import { dateTime } from '../../utils.js';

const CATEGORIES = ['Maintenance', 'Noise', 'Payment', 'Neighbor', 'Safety', 'Other'];
const TONE = { New: 'bd-pill warn', 'In Progress': 'bd-pill info', Resolved: 'bd-pill ok' };
const BLANK = { category: 'Maintenance', subject: '', message: '' };

export default function ReportCard({ reports, onDone }) {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const data = await api.post('/boarder/reports', form);
      setMsg({ text: data.message, ok: true });
      setForm(BLANK);
      onDone();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-section-heading">
        <h2>📢 Report a Problem</h2>
      </div>
      <p className="admin-muted">Have a complaint or something broken? The admin and owner are notified right away.</p>

      <form className="bd-form" onSubmit={submit}>
        <label>
          Category
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input required maxLength={120} value={form.subject} onChange={set('subject')} placeholder="e.g. Leaking faucet in Room 3" />
        </label>
        <label className="bd-wide">
          Details
          <textarea required maxLength={1000} rows={4} value={form.message} onChange={set('message')} />
        </label>
        <button className="admin-btn" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </form>

      {msg && <div className={`admin-notice ${msg.ok ? 'success' : ''}`}>{msg.text}</div>}

      {reports.length > 0 && (
        <div className="admin-table-wrap" style={{ marginTop: 14 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Report</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.created_at)}</td>
                  <td>
                    <strong>{r.subject}</strong> <span className="admin-badge">{r.category}</span>
                    <div>{r.message}</div>
                    {r.admin_reply && <div className="bd-reply">Reply: {r.admin_reply}</div>}
                  </td>
                  <td>
                    <span className={TONE[r.status]}>{r.status}</span>
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
