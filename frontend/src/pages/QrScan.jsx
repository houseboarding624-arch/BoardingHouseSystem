import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../api.js';
import LogoutButton from '../components/LogoutButton.jsx';
import { useBodyClass } from '../utils.js';

const READER_ID = 'reader';

export default function QrScan() {
  useBodyClass('admin-dashboard');
  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const [result, setResult] = useState(null); // { text, error }

  const show = (text, error = false) => setResult({ text, error });

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner || !runningRef.current) return;
    runningRef.current = false;
    try {
      await scanner.stop();
      scanner.clear();
    } catch (err) {
      console.error(err);
    }
  }

  async function onScan(token) {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const data = await api.post('/boarder/attendance', {
        qr_token: token,
      });
      show(data.message);
      await stopScanner();
    } catch (err) {
      show(err.message, true);
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 1500);
    }
  }

  async function startScanner() {
    if (runningRef.current) return;

    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScan,
        () => {}
      );
      runningRef.current = true;
      show('Camera started. Point it at the entrance QR.');
    } catch (err) {
      console.error(err);
      show('Camera could not start. Use HTTPS/localhost and allow camera access.', true);
    }
  }

  // Release the camera when leaving the page.
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="admin-topbar">
        <Link className="admin-brand" to="/boarder">
          📷 QR Scanner
        </Link>
        <div className="admin-top-actions">
          <LogoutButton />
        </div>
      </header>

      <main className="admin-main admin-narrow">
        <section className="admin-card admin-center">
          <span className="admin-eyebrow">BOARDER ATTENDANCE</span>
          <h1>Scan Entrance QR</h1>
          <p className="admin-muted">Scan once for Time In and again later for Time Out.</p>

          <div id={READER_ID} className="scanner" />
          {result?.text && (
            <div className={`admin-notice ${result.error ? '' : 'success'}`}>{result.text}</div>
          )}

          <div className="admin-actions">
            <button className="admin-btn" type="button" onClick={startScanner}>
              Start Camera
            </button>
            <button className="admin-btn admin-btn-light" type="button" onClick={stopScanner}>
              Stop Camera
            </button>
            <Link className="admin-btn admin-btn-light" to="/boarder">
              Back to Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
