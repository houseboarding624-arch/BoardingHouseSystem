import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Notice from '../components/Notice.jsx';
import { PASSWORD_RULES, isStrongPassword } from '../passwordRules.js';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = ask for the code, 2 = enter code + new password
  const [form, setForm] = useState({ identifier: '', code: '', password: '', confirm: '' });
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function sendCode(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const data = await api.post('/auth/forgot-password', { identifier: form.identifier });
      setInfo(data.message);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError('');
    if (!isStrongPassword(form.password)) return setError('Password does not meet all the requirements.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const data = await api.post('/auth/reset-password', {
        identifier: form.identifier,
        code: form.code,
        password: form.password,
      });
      navigate(`/login?message=${encodeURIComponent(data.message)}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-body auth-photo">
      <div className="back-home">
        <Link className="btn btn-light btn-small" to="/login">
          ← Back to Login
        </Link>
      </div>

      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-icon">🔑</div>
          <h1>Forgot Password</h1>
          <p className="muted">
            {step === 1 ? 'Enter your username or email and we will send you a 6-digit code.' : 'Enter the code we emailed you and choose a new password.'}
          </p>

          <Notice type="error">{error}</Notice>
          <Notice>{info}</Notice>

          {step === 1 ? (
            <form className="form" onSubmit={sendCode}>
              <label htmlFor="fp-id">Username or Email</label>
              <input id="fp-id" value={form.identifier} onChange={update('identifier')} maxLength={150} required autoFocus />
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form className="form" onSubmit={resetPassword}>
              <label htmlFor="fp-code">6-digit code</label>
              <input
                id="fp-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={form.code}
                onChange={update('code')}
                autoComplete="one-time-code"
                required
                autoFocus
              />

              <label htmlFor="fp-pass">New password</label>
              <div className="password-container">
                <input id="fp-pass" type={show ? 'text' : 'password'} value={form.password} onChange={update('password')} autoComplete="new-password" required />
                <button type="button" className="password-toggle" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>
                  {show ? '🙈' : '👁'}
                </button>
              </div>
              <ul className="pw-rules" aria-label="Password requirements">
                {PASSWORD_RULES.map((rule) => (
                  <li key={rule.id} className={rule.test(form.password) ? 'ok' : ''}>
                    {rule.test(form.password) ? '✓' : '○'} {rule.label}
                  </li>
                ))}
              </ul>

              <label htmlFor="fp-confirm">Confirm new password</label>
              <input id="fp-confirm" type={show ? 'text' : 'password'} value={form.confirm} onChange={update('confirm')} autoComplete="new-password" required />

              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
              <button className="btn btn-light" type="button" onClick={() => { setStep(1); setError(''); setInfo(''); }}>
                Send a new code
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
