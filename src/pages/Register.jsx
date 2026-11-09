import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Notice from '../components/Notice.jsx';
import { PASSWORD_RULES, isStrongPassword } from '../passwordRules.js';
import { USERNAME_ERROR, USERNAME_HINT, capitalizeWords, cleanUsername, isValidUsername } from '../textRules.js';

// The boarding house has Room 1 to Room 12 only.
const MAX_ROOM = 12;
const ROOM_ERROR = `Room does not exist. Rooms are only up to Room ${MAX_ROOM}.`;
const roomLabel = (r) => {
  const people = `${r.beds_taken} of ${r.beds} boarders`;
  if (r.status === 'Maintenance') return `Room ${r.room_number} - Under maintenance`;
  if (r.status === 'Full') return `Room ${r.room_number} - Full (${people})`;
  return `Room ${r.room_number} - Available (${people}, ${r.beds_left} bed${r.beds_left === 1 ? '' : 's'} left)`;
};

const EMPTY = {
  username: '',
  password: '',
  confirm_password: '',
  full_name: '',
  gender: '',
  contact: '',
  email: '',
  preferred_room: '',
  address: '',
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rooms, setRooms] = useState(null);
  const [roomsError, setRoomsError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/auth/rooms')
      .then((data) => alive && setRooms(data.rooms))
      .catch((err) => alive && setRoomsError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!isValidUsername(form.username)) {
      setError(USERNAME_ERROR);
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError('Password does not meet all the requirements.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    const chosen = rooms?.find((r) => String(r.room_number) === form.preferred_room);
    if (form.preferred_room && (!chosen || chosen.status !== 'Available')) {
      setError(chosen ? `Room ${chosen.room_number} is not available. Please choose another room.` : ROOM_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { confirm_password: _ignored, ...payload } = form;
      const data = await api.post('/auth/register', payload);
      navigate(`/login?message=${encodeURIComponent(data.message)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-body auth-photo">
      <div className="back-home">
        <Link className="btn btn-light btn-small" to="/">
          ← Back to Home
        </Link>
      </div>

      <main className="auth-page">
        <section className="auth-card wide">
          <div className="auth-icon">👤</div>
          <h1>Create Boarder Account</h1>
          <p className="muted">Register as a boarder to access your dashboard.</p>

          <Notice type="error">{error}</Notice>

          <form className="form two-column" onSubmit={handleSubmit}>
            <div>
              <label>Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: cleanUsername(e.target.value) })}
                maxLength={12}
                autoComplete="username"
                aria-invalid={form.username !== '' && !isValidUsername(form.username)}
                required
              />
              <small style={{ color: form.username === '' || isValidUsername(form.username) ? '#64748b' : '#b91c1c', fontWeight: 600 }}>
                {USERNAME_HINT}
              </small>
            </div>
            <div className="pw-block">
              <label htmlFor="reg-password">Password</label>
              <div className="password-container">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              <ul className="pw-rules" aria-label="Password requirements">
                {PASSWORD_RULES.map((rule) => (
                  <li key={rule.id} className={rule.test(form.password) ? 'ok' : ''}>
                    {rule.test(form.password) ? '✓' : '○'} {rule.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={update('confirm_password')}
                autoComplete="new-password"
                required
              />
              {form.confirm_password && form.password !== form.confirm_password && (
                <small className="pw-mismatch">Passwords do not match.</small>
              )}
            </div>
            <div>
              <label>Full Name</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: capitalizeWords(e.target.value) })}
                maxLength={150}
                required
              />
            </div>
            <div>
              <label htmlFor="reg-gender">Gender</label>
              <select id="reg-gender" value={form.gender} onChange={update('gender')} required>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label>Contact</label>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                inputMode="numeric"
                maxLength={11}
                placeholder="09123456789"
              />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={update('email')} maxLength={150} />
            </div>
            <div>
              <label>Preferred Room</label>
              <select value={form.preferred_room} onChange={update('preferred_room')}>
                <option value="">{rooms ? 'Select a room (optional)' : roomsError ? 'Rooms could not be loaded' : 'Loading rooms…'}</option>
                {(rooms ?? []).map((r) => (
                  <option key={r.room_number} value={r.room_number} disabled={r.status !== 'Available'}>
                    {roomLabel(r)}
                  </option>
                ))}
              </select>
              {roomsError && <small style={{ color: '#b91c1c', fontWeight: 700 }}>{roomsError}</small>}
            </div>
            <div>
              <label>Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: capitalizeWords(e.target.value) })}
                maxLength={255}
              />
            </div>
            <div className="full">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>

          <p className="auth-footer">
            Already registered? <Link to="/login">Login here</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
