import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import LogoutButton from '../components/LogoutButton.jsx';
import Notice from '../components/Notice.jsx';

export default function QrGenerator() {
  const { user } = useAuth();
  const back = user?.role === 'Admin' ? '/admin' : '/owner';

  const [boarders, setBoarders] = useState([]);
  const [status, setStatus] = useState({ text: '', error: false });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/qr/boarders');
      setBoarders(data.boarders);
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerate(b) {
    if (!window.confirm(`Generate a new QR for ${b.full_name}? The old QR will stop working.`)) return;
    setBusyId(b.id);
    try {
      const data = await api.post(`/qr/boarders/${b.id}/regenerate`);
      setStatus({ text: data.message, error: false });
      await load();
    } catch (err) {
      setStatus({ text: err.message, error: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="topbar no-print">
        <Link className="brand" to={back}>
          📱 Boarder QR Codes
        </Link>
        <LogoutButton />
      </header>

      <main className="container">
        <section className="card center no-print">
          <span className="eyebrow">ATTENDANCE</span>
          <h1>Personal QR for each boarder</h1>
          <p className="muted">
            Each boarder shows their own QR to the scanner on the home page. Print the cards below and hand them out.
          </p>
          {status.text && <Notice type={status.error ? 'error' : 'success'}>{status.text}</Notice>}
          <div className="actions center-actions">
            <button className="btn btn-primary" type="button" onClick={() => window.print()}>
              Print all
            </button>
            <Link className="btn btn-light" to={back}>
              Back to Dashboard
            </Link>
          </div>
        </section>

        <section className="qr-grid">
          {boarders.map((b) => (
            <article className="qr-card" key={b.id}>
              <strong>{b.full_name}</strong>
              <span className="muted small">
                Room {b.preferred_room || '-'}
                {b.status === 'Disabled' ? ' · Disabled' : ''}
              </span>
              <div className="qr-box">
                {b.qr_token && <QRCodeSVG value={b.qr_token} size={160} marginSize={2} />}
              </div>
              <button
                className="btn btn-light no-print"
                type="button"
                disabled={busyId === b.id}
                onClick={() => regenerate(b)}
              >
                {busyId === b.id ? 'Working…' : 'Regenerate'}
              </button>
            </article>
          ))}
          {!boarders.length && <p className="muted">No boarders yet.</p>}
        </section>
      </main>
    </>
  );
}
