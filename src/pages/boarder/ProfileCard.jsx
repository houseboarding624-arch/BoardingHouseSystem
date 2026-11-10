import { useEffect, useState } from 'react';
import { api } from '../../api.js';

/** Lets the boarder see their details and correct the gender if they picked the wrong one. */
export default function ProfileCard({ user, onDone }) {
  const [gender, setGender] = useState(user?.gender ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => setGender(user?.gender ?? ''), [user?.gender]);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const data = await api.patch('/boarder/profile/gender', { gender });
      setMsg({ text: data.message, ok: true });
      onDone?.();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-section-heading">
        <h2>👤 My Profile</h2>
      </div>
      <p className="admin-muted">Chose the wrong gender when you registered? You can fix it here.</p>
      <form className="bd-form" onSubmit={submit}>
        <label>
          Full name
          <input value={user?.full_name ?? ''} disabled />
        </label>
        <label>
          Username
          <input value={user?.username ?? ''} disabled />
        </label>
        <label>
          Gender
          <select value={gender} onChange={(e) => setGender(e.target.value)} required>
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="LGBTQ+">LGBTQ+</option>
          </select>
        </label>
        <button className="admin-btn" type="submit" disabled={busy || !gender || gender === (user?.gender ?? '')}>
          {busy ? 'Saving…' : 'Save gender'}
        </button>
      </form>
      {msg && <div className={`admin-notice ${msg.ok ? 'success' : ''}`}>{msg.text}</div>}
    </section>
  );
}
