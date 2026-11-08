import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LogoutButton({ className = 'btn btn-light btn-small', children = 'Logout' }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  async function confirmLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      setOpen(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open &&
        createPortal(
          <div className="logout-overlay" role="presentation" onClick={() => !busy && setOpen(false)}>
            <div
              className="logout-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              aria-describedby="logout-text"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="logout-icon" aria-hidden="true">
                ⏻
              </div>
              <h2 id="logout-title">Log out?</h2>
              <p id="logout-text">Are you sure you want to log out of your account?</p>
              <div className="logout-actions">
                <button type="button" className="logout-cancel" onClick={() => setOpen(false)} disabled={busy} autoFocus>
                  Cancel
                </button>
                <button type="button" className="logout-confirm" onClick={confirmLogout} disabled={busy}>
                  {busy ? 'Logging out…' : 'Yes, log out'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
