import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../auth.jsx';
import Notice from '../components/Notice.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState({ username: '', password: '', account_type: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [animating, setAnimating] = useState(false);
  // Only one banner is shown at a time: a new login attempt clears the old message, and an error replaces it.
  const [error, setError] = useState(params.get('error') || '');
  const [message, setMessage] = useState(params.get('error') ? '' : params.get('message') || '');
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  const destinationFor = (u) => (HOME_BY_ROLE[u.role] || '/');

  if (user) return <Navigate to={destinationFor(user)} replace />;

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function togglePassword() {
    setAnimating(true);
    setTimeout(() => {
      setShowPassword((visible) => !visible);
      setAnimating(false);
    }, 150);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const loggedIn = await login(form);
      navigate(destinationFor(loggedIn), { replace: true });
    } catch (err) {
      setMessage('');
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
        <section className="auth-card">
          <div className="auth-icon">🏠</div>
          <h1>Boarding House</h1>
          <p className="muted">Management &amp; Monitoring System</p>

          <Notice type="error">{error}</Notice>
          <Notice>{message}</Notice>

          <form className="form" onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter username"
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <div className="password-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={form.password}
                onChange={update('password')}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={togglePassword}
              >
                <span id="eyeIcon" className={animating ? 'animate' : ''}>
                  {showPassword ? '🙈' : '👁'}
                </span>
              </button>
            </div>

            <label htmlFor="account_type">Account Type</label>
            <select id="account_type" value={form.account_type} onChange={update('account_type')} required>
              <option value="">Select Account Type</option>
              <option value="Admin">Admin</option>
              <option value="Owner">Owner</option>
              <option value="Boarder">Boarder</option>
            </select>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Boarder without an account? <Link to="/register">Create an account</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
