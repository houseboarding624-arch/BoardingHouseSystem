import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { dateTime, peso } from '../../utils.js';
import { useBlobUrl } from '../../useBlobUrl.js';
import { Badge, Btn, Card, Field, Input, Select, Table } from './ui.jsx';

const textArea = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '6px',
  padding: '9px 10px',
  minHeight: '90px',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  background: '#f1f5f9',
  color: '#0f172a',
  fontSize: '15px',
  fontFamily: 'inherit',
};

const emailTone = { sent: 'green', failed: 'red', skipped: 'gray' };

export function NotifyView({ data, run }) {
  const blank = { user_id: 'all', title: '', message: '', email: true };
  const [form, setForm] = useState(blank);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const active = data.boarders.filter((b) => b.status !== 'Disabled');

  return (
    <>
      <Card title="Send Notification">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.post('/owner/notify', form))) setForm(blank);
          }}
          style={{ display: 'grid', gap: '9px' }}
        >
          <Field label="TO">
            <Select value={form.user_id} onChange={set('user_id')}>
              <option value="all">All boarders</option>
              {active.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="TITLE">
            <Input value={form.title} onChange={set('title')} maxLength={150} required />
          </Field>
          <Field label="MESSAGE">
            <textarea style={textArea} value={form.message} onChange={set('message')} maxLength={2000} required />
          </Field>
          <label style={{ color: '#334155', fontSize: '15px' }}>
            <input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Also
            send to their Gmail
          </label>
          <div>
            <Btn type="submit">Send</Btn>
          </div>
        </form>
      </Card>

      <Card title="Notification History">
        <Table head={['When', 'To', 'Type', 'Title', 'Email']} empty="No notifications sent yet.">
          {data.notifications.map((n) => (
            <tr key={n.id}>
              <td>{dateTime(n.created_at)}</td>
              <td>{n.full_name}</td>
              <td>{n.type}</td>
              <td>{n.title}</td>
              <td>
                <Badge tone={emailTone[n.email_status]}>{n.email_status}</Badge>
                {n.email_error && <div className="property-sub">{n.email_error}</div>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

export function UtilitiesView({ data, run }) {
  return (
    <>
      <Card title="QR Attendance">
        <p className="ov-hint" style={{ marginTop: 0 }}>
          Print each boarder's personal QR. Boarders show it to the scanner on the home page for Time In / Time Out.
        </p>
        <Link className="ov-btn primary" to="/qr">
          Open Boarder QR Codes
        </Link>
      </Card>

      <Card title="Gmail Notifications">
        <p style={{ margin: '0 0 10px', fontSize: '15px' }}>
          Status:{' '}
          {data.mail.configured ? (
            <Badge tone="green">Connected as {data.mail.account}</Badge>
          ) : (
            <Badge tone="red">Not configured</Badge>
          )}
        </p>
        {!data.mail.configured && (
          <p className="ov-hint">
            Set <b>GMAIL_USER</b> and <b>GMAIL_APP_PASSWORD</b> in <code>backend/.env</code> (use a Google App Password), then restart
            the backend. Until then notices still appear inside each boarder's dashboard, but no emails are sent.
          </p>
        )}
      </Card>

      <Card title="Automatic Checks">
        <p className="ov-hint" style={{ marginTop: 0 }}>
          The server checks every minute: it sends the curfew notice at {data.settings.curfew_time}, emails unpaid boarders on
          their due date, and disables their account after {data.settings.grace_days} days. You can also run them now.
        </p>
        <div className="ov-actions">
          <Btn onClick={() => run(() => api.post('/owner/run-checks'))}>Run payment check now</Btn>
          <Btn
            tone="ghost"
            onClick={() =>
              window.confirm('Send the curfew notice to every boarder now?') && run(() => api.post('/owner/curfew-now'))
            }
          >
            Send curfew notice now
          </Btn>
        </div>
      </Card>
    </>
  );
}

export function AnnouncementsView({ data, run }) {
  const blank = { title: '', body: '', email: true };
  const [form, setForm] = useState(blank);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  return (
    <>
      <Card title="New Announcement">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.post('/owner/announcements', form))) setForm(blank);
          }}
          style={{ display: 'grid', gap: '9px' }}
        >
          <Field label="TITLE">
            <Input value={form.title} onChange={set('title')} maxLength={150} required />
          </Field>
          <Field label="MESSAGE">
            <textarea style={textArea} value={form.body} onChange={set('body')} maxLength={2000} required />
          </Field>
          <label style={{ color: '#334155', fontSize: '15px' }}>
            <input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Also
            email every boarder
          </label>
          <div>
            <Btn type="submit">Post to all boarders</Btn>
          </div>
        </form>
      </Card>
      <Card title={`Announcements (${data.announcements.length})`}>
        <Table head={['Posted', 'Title', 'Message', '']} empty="No announcements yet.">
          {data.announcements.map((a) => (
            <tr key={a.id}>
              <td>{dateTime(a.created_at)}</td>
              <td>{a.title}</td>
              <td>{a.body}</td>
              <td>
                <Btn small tone="danger" onClick={() => run(() => api.del(`/owner/announcements/${a.id}`))}>
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

export function MaintenanceView({ data, run }) {
  const blank = { room_number: '', issue: '', cost: 0 };
  const [form, setForm] = useState(blank);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const tone = { Open: 'red', 'In Progress': 'orange', Done: 'green' };
  return (
    <>
      <Card title="New Maintenance Request">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.post('/owner/maintenance', form))) setForm(blank);
          }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '9px', alignItems: 'end' }}
        >
          <Field label="ROOM">
            <Select value={form.room_number} onChange={set('room_number')}>
              <option value="">General</option>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.room_number}>
                  Room {r.room_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ISSUE">
            <Input value={form.issue} onChange={set('issue')} maxLength={255} required />
          </Field>
          <Field label="COST">
            <Input type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} />
          </Field>
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
      <Card title={`Maintenance (${data.maintenance.length})`}>
        <Table head={['Date', 'Room', 'Issue', 'Cost', 'Status', 'Actions']} empty="No maintenance requests.">
          {data.maintenance.map((m) => (
            <tr key={m.id}>
              <td>{dateTime(m.created_at)}</td>
              <td>{m.room_number || 'General'}</td>
              <td>{m.issue}</td>
              <td>{peso(m.cost)}</td>
              <td>
                <Badge tone={tone[m.status]}>{m.status}</Badge>
              </td>
              <td className="ov-actions">
                <Select
                  value={m.status}
                  style={{ marginTop: 0, width: '110px' }}
                  onChange={(e) => run(() => api.patch(`/owner/maintenance/${m.id}`, { status: e.target.value }))}
                >
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Done</option>
                </Select>
                <Btn small tone="danger" onClick={() => run(() => api.del(`/owner/maintenance/${m.id}`))}>
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

export function AuditView({ data }) {
  return (
    <Card title="Audit Log">
      <Table head={['When', 'Who', 'Action', 'Details']} empty="Nothing logged yet.">
        {data.audit.map((a) => (
          <tr key={a.id}>
            <td>{dateTime(a.created_at)}</td>
            <td>{a.actor_name}</td>
            <td>{a.action}</td>
            <td>{a.details}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}


// Shrinks the screenshot so it stays small (a QR only needs ~700px) and returns a PNG/JPEG data URL.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const scale = Math.min(1, 720 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL('image/png');
        if (url.length > 450000) url = canvas.toDataURL('image/jpeg', 0.92);
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function GcashQrCard({ data, run }) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const has = data.settings.gcash_has_qr;
  const { url: qrPreview, failed: qrFailed } = useBlobUrl(has ? `/gcash-qr?v=${data.settings.gcash_qr_version}` : null);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLocalError('');
    if (!file.type.startsWith('image/')) return setLocalError('Please choose an image file.');
    if (file.size > 10 * 1024 * 1024) return setLocalError('That image is too big (max 10 MB).');
    setBusy(true);
    try {
      const image = await fileToDataUrl(file);
      await run(() => api.post('/gcash-qr', { image }));
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="GCash QR">
      <p className="ov-hint" style={{ marginTop: 0 }}>
        In the GCash app open <b>QR Code / Receive Money</b>, take a screenshot, and upload it here. Boarders will see
        this QR on their dashboard and pay by scanning it.
      </p>
      {has && !qrPreview && (
        <p className="ov-hint">
          {qrFailed ? 'The saved QR could not be loaded. Reload the page, or upload it again.' : 'Loading QR…'}
        </p>
      )}
      {has && qrPreview && (
        <img
          src={qrPreview}
          alt="Current GCash QR"
          style={{ width: 200, maxWidth: '100%', borderRadius: 10, background: '#fff', padding: 6, display: 'block', marginBottom: 10 }}
        />
      )}
      {localError && <div className="owner-alert">{localError}</div>}
      <div className="ov-actions">
        <label className="ov-btn primary" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Uploading…' : has ? 'Replace QR' : 'Upload QR'}
          <input type="file" accept="image/*" onChange={onPick} disabled={busy} style={{ display: 'none' }} />
        </label>
        {has && (
          <Btn tone="ghost" onClick={() => window.confirm('Remove the GCash QR?') && run(() => api.del('/gcash-qr'))}>
            Remove
          </Btn>
        )}
      </div>
    </Card>
  );
}

export function SettingsView({ data, run }) {
  const [form, setForm] = useState({
    curfew_enabled: data.settings.curfew_enabled,
    curfew_time: data.settings.curfew_time,
    grace_days: data.settings.grace_days,
    auto_terminate: data.settings.auto_terminate,
    gcash_number: data.settings.gcash_number ?? '',
    gcash_name: data.settings.gcash_name ?? '',
  });
  const check = (f) => (e) => setForm({ ...form, [f]: e.target.checked });
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  return (
    <>
    <GcashQrCard data={data} run={run} />
    <Card title="Settings">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.patch('/owner/settings', form));
        }}
        style={{ display: 'grid', gap: '12px', maxWidth: '420px' }}
      >
        <label style={{ color: '#334155', fontSize: '15px' }}>
          <input type="checkbox" checked={form.curfew_enabled} onChange={check('curfew_enabled')} /> Send curfew notice to every
          boarder
        </label>
        <Field label="CURFEW TIME (24-hour, Manila time)">
          <Input type="time" value={form.curfew_time} onChange={set('curfew_time')} required />
        </Field>
        <Field label="DAYS TO PAY AFTER DUE DATE BEFORE ACCOUNT IS DISABLED">
          <Input type="number" min="0" max="60" value={form.grace_days} onChange={set('grace_days')} required />
        </Field>
        <label style={{ color: '#334155', fontSize: '15px' }}>
          <input type="checkbox" checked={form.auto_terminate} onChange={check('auto_terminate')} /> Automatically disable boarders who don't pay
          who still haven't paid after those days
        </label>
        <Field label="GCASH NUMBER (optional, shown beside the QR)">
          <Input value={form.gcash_number} onChange={set('gcash_number')} placeholder="09171234567" />
        </Field>
        <Field label="GCASH ACCOUNT NAME">
          <Input value={form.gcash_name} onChange={set('gcash_name')} maxLength={80} />
        </Field>
        <div>
          <Btn type="submit">Save Settings</Btn>
        </div>
      </form>
    </Card>
    </>
  );
}

export function AttendanceView({ data }) {
  return (
    <Card
      title="Attendance"
      action={
        <Link className="ov-btn primary small" to="/qr">
          Boarder QR Codes
        </Link>
      }
    >
      <p className="ov-hint" style={{ marginTop: 0 }}>
        {data.stats.todayAttendance} scanned in today · {data.stats.todayTimeOut} timed out. Updates automatically.
      </p>
      <Table
        head={['Boarder', 'Room', 'Date', 'Time In', 'Time Out', 'Status']}
        empty="No attendance records yet."
      >
        {data.attendance.map((r) => (
          <tr key={r.id}>
            <td>{r.full_name}</td>
            <td>{r.room || '-'}</td>
            <td>{r.attendance_date}</td>
            <td>{dateTime(r.time_in)}</td>
            <td>{dateTime(r.time_out)}</td>
            <td>
              <Badge tone={r.status === 'IN' ? 'green' : 'gray'}>{r.status}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
