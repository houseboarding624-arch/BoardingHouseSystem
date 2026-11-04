import { useState } from 'react';
import { api } from '../../api.js';
import { PASSWORD_RULES, isStrongPassword } from '../../passwordRules.js';

const BLANK = { current_password: '', new_password: '', confirm: '' };

export default function PasswordCard() {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!isStrongPassword(form.new_password)) return setMsg({ text: 'New password does not meet all the requirements.', ok: false });
    if (form.new_password !== form.confirm) return setMsg({ text: 'Passwords do not match.', ok: false });
    setBusy(true);
    try {
      const data = await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setMsg({ text: data.message, ok: true });
      setForm(BLANK);
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-section-heading">
        <h2>🔒 Change Password</h2>
      </div>
      <p className="admin-muted">Got a temporary password from the admin? Change it here.</p>
      <form className="bd-form" onSubmit={submit}>
        <label className="bd-wide">
          Current password
          <input type="password" autoComplete="current-password" required value={form.current_password} onChange={set('current_password')} />
        </label>
        <label>
          New password
          <input type="password" autoComplete="new-password" required value={form.new_password} onChange={set('new_password')} />
        </label>
        <label>
          Confirm new password
          <input type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </label>
        <ul className="pw-rules bd-wide" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.id} className={rule.test(form.new_password) ? 'ok' : ''}>
              {rule.test(form.new_password) ? '✓' : '○'} {rule.label}
            </li>
          ))}
        </ul>
        <button className="admin-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
      {msg && <div className={`admin-notice ${msg.ok ? 'success' : ''}`}>{msg.text}</div>}
    </section>
  );
}
