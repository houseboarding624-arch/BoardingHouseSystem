import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../api.js';

const READER_ID = 'public-reader';
const SAME_QR_COOLDOWN_MS = 5000; // ignore the same QR while it stays in front of the camera
const RESULT_MS = 4000; // how long the result stays on screen

/**
 * Kiosk scanner. Starts the camera as soon as it mounts. No login: each boarder shows
 * their personal QR, the server records Time In / Time Out straight into Supabase.
 */
export default function PublicScanner() {
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const lastRef = useRef({ token: '', at: 0 });
  const clearTimer = useRef(null);

  const [camera, setCamera] = useState('starting'); // starting | on | off | error
  const [result, setResult] = useState(null); // { ok, type, text, room }

  function showResult(next) {
    setResult(next);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setResult(null), RESULT_MS);
  }

  async function onScan(token) {
    const now = Date.now();
    if (busyRef.current) return;
    if (token === lastRef.current.token && now - lastRef.current.at < SAME_QR_COOLDOWN_MS) return;

    busyRef.current = true;
    lastRef.current = { token, at: now };
    try {
      const data = await api.post('/scan', { qr_token: token });
      showResult({ ok: true, type: data.type, text: data.message, room: data.room, time: data.time, name: data.name });
    } catch (err) {
      showResult({ ok: false, type: err.data?.type, text: err.message, room: err.data?.room });
    } finally {
      busyRef.current = false;
    }
  }

  async function startCamera() {
    if (startedRef.current) return;
    setCamera('starting');

    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    const config = { fps: 10, qrbox: { width: 240, height: 240 } };

    try {
      try {
        await scanner.start({ facingMode: 'environment' }, config, onScan, () => {});
      } catch {
        // No rear camera (laptop/kiosk): fall back to the first available camera.
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) throw new Error('No camera found.');
        await scanner.start(cameras[0].id, config, onScan, () => {});
      }
      startedRef.current = true;
      setCamera('on');
    } catch (err) {
      console.error(err);
      setCamera('error');
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    if (!scanner || !startedRef.current) return;
    startedRef.current = false;
    try {
      await scanner.stop();
      scanner.clear();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    // Small delay so React StrictMode's double-mount in dev doesn't start the camera twice.
    const t = setTimeout(startCamera, 200);
    return () => {
      clearTimeout(t);
      clearTimeout(clearTimer.current);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tone = result ? (result.ok ? 'ok' : 'bad') : 'idle';

  return (
    <div className="scan-panel">
      <div className="scan-frame">
        <div id={READER_ID} className="scan-reader" />
        {camera !== 'on' && (
          <div className="scan-overlay">
            {camera === 'starting' && <p>Starting camera…</p>}
            {camera === 'error' && (
              <>
                <p>Camera could not start. Allow camera access (HTTPS or localhost is required).</p>
                <button type="button" className="lp-btn lp-btn-primary" onClick={startCamera}>
                  Start camera
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`scan-status ${tone}`} role="status" aria-live="polite">
        {result ? (
          <>
            <strong>
              {result.type === 'TIME_IN' && '✅ SUCCESSFULLY LOGGED IN'}
              {result.type === 'TIME_OUT' && '👋 SUCCESSFULLY LOGGED OUT'}
              {result.type === 'NOT_FOUND' && '❌ QR NOT FOUND'}
              {!result.ok && result.type !== 'NOT_FOUND' && '⚠️ ' + (result.type === 'DUPLICATE' || result.type === 'COMPLETE' ? 'ALREADY SCANNED' : result.type === 'CLOSED' ? 'SCANNING CLOSED' : 'CANNOT RECORD')}
            </strong>
            {result.ok && result.name && <span className="scan-name">{result.name}</span>}
            {result.ok && result.time && (
              <span className="scan-time">
                {result.type === 'TIME_OUT' ? 'Time Out' : 'Time In'}: {result.time}
              </span>
            )}
            {/* The heading already says "QR NOT FOUND", so don't repeat it as a second line. */}
            {!(result.ok && result.time) && result.type !== 'NOT_FOUND' && <span>{result.text}</span>}
            {result.room && <small>Room {result.room}</small>}
          </>
        ) : (
          <span>Ready — show your boarder QR to the camera.</span>
        )}
      </div>
    </div>
  );
}
