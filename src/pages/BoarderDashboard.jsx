import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import SideLayout from '../components/SideLayout.jsx';
import RoomPie from '../components/RoomPie.jsx';
import RoomList from '../components/RoomList.jsx';
import GcashCard from './boarder/GcashCard.jsx';
import ReportCard from './boarder/ReportCard.jsx';
import PasswordCard from './boarder/PasswordCard.jsx';
import ProfileCard from './boarder/ProfileCard.jsx';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { billingText } from './owner/ui.jsx';
import { dateTime, peso, timeOnly, useBodyClass } from '../utils.js';

const VIEW_KEYS = ['overview', 'pay', 'payments', 'attendance', 'reports', 'notifications', 'profile', 'password'];

function PageHead({ eyebrow, title, hint }) {
  return (
    <section className="admin-heading">
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {hint && <p className="admin-muted">{hint}</p>}
      </div>
    </section>
  );
}

export default function BoarderDashboard() {
  useBodyClass('owner-body');
  const { user: session } = useAuth();
  const hash = useLocation().hash.replace('#', '');
  const current = VIEW_KEYS.includes(hash) ? hash : 'overview';
  const [data, setData] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [printAll, setPrintAll] = useState(false);
  const [error, setError] = useState('');

  const [justSeen, setJustSeen] = useState(0); // how many were new when the boarder opened Notifications

  const load = useCallback(
    () =>
      api
        .get('/boarder/dashboard')
        .then((result) => setData(result))
        .catch((err) => setError(err.message)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const user = data?.user ?? session;
  const billing = data?.billing;
  const attendance = data?.attendance ?? [];
  const payments = data?.payments ?? [];
  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;

  // Opening the Notifications page means the boarder has seen them: mark them read so the red badge goes away.
  useEffect(() => {
    if (current !== 'notifications') {
      setJustSeen(0);
      return;
    }
    if (unread === 0) return;
    setJustSeen(unread);
    api
      .post('/boarder/notifications/read')
      .then(() => setData((d) => (d ? { ...d, notifications: d.notifications.map((n) => ({ ...n, is_read: true })) } : d)))
      .catch(() => {});
  }, [current, unread]);

  const groups = [
    {
      items: [
        { icon: '◧', label: 'Dashboard', view: 'overview' },
        { icon: '💙', label: 'Pay with GCash', view: 'pay' },
        { icon: '₱', label: 'Payment Records', view: 'payments' },
        { icon: '◔', label: 'Attendance', view: 'attendance' },
      ],
    },
    {
      label: 'Other',
      items: [
        { icon: '📢', label: 'My Reports', view: 'reports' },
        { icon: '🔔', label: 'Notifications', view: 'notifications', badge: unread },
        { icon: '👤', label: 'My Profile', view: 'profile' },
        { icon: '⚙', label: 'Change Password', view: 'password' },
      ],
    },
  ];

  return (
    <>
      <SideLayout basePath="/boarder" groups={groups} current={current} userName={user?.full_name || user?.username}>
        {error && <div className="admin-notice">{error}</div>}

        {billing?.urgent && (
          <div className="admin-notice" role="alert">
            ⚠️{' '}
            {billing.daysUntilDue < 0
              ? `Your rent was due on ${user.next_due_date} and is unpaid.`
              : billing.daysUntilDue === 0
                ? 'Your rent is due today.'
                : `Your rent is due in ${billing.daysUntilDue} day${billing.daysUntilDue === 1 ? '' : 's'} (${user.next_due_date}).`}{' '}
            Please pay with GCash so your account is not disabled.
          </div>
        )}

        {current === 'overview' && (
          <>
            <PageHead eyebrow="BOARDER PORTAL" title="My Dashboard" hint="View your room, attendance, and payment records." />

            <section className="admin-stats">
              <article className="admin-stat">
                <span>Username</span>
                <strong>{user?.username}</strong>
              </article>
              <article className="admin-stat">
                <span>Room</span>
                <strong>{user?.preferred_room || 'Not assigned'}</strong>
              </article>
              <article className={`admin-stat ${billing?.urgent ? 'danger' : ''}`}>
                <span>Next payment due</span>
                <strong>{user?.next_due_date || 'Not set'}</strong>
                {billing?.urgent && <small className="due-note">{billingText(billing)}</small>}
              </article>
            </section>

            <div className="admin-grid">
              <article className="admin-card">
                <div className="admin-section-heading">
                  <h2>🚪 Room Availability</h2>
                  <span className="admin-badge">{data?.roomStats?.total ?? 0} rooms</span>
                </div>
                <RoomPie stats={data?.roomStats} />
                <RoomList rooms={data?.roomList ?? []} mine={user?.preferred_room} />
              </article>

              {user?.qr_token && (
                <section className="admin-card admin-center">
                  <h2>My QR Code</h2>
                  <p className="admin-muted">Show this to the scanner on the home page for Time In / Time Out.</p>
                  <div style={{ background: '#fff', display: 'inline-block', padding: 8, borderRadius: 10 }}>
                    <QRCodeSVG value={user.qr_token} size={200} marginSize={2} />
                  </div>
                </section>
              )}
            </div>
          </>
        )}

        {current === 'pay' && (
          <>
            <PageHead eyebrow="PAYMENTS" title="Pay with GCash" hint="Send your rent or advance payment through GCash." />
            <GcashCard
              gcash={data?.gcash}
              history={data?.gcashPayments ?? []}
              roomRate={data?.roomRate}
              rentPaid={data?.rentPaidThisMonth}
              onDone={load}
            />
          </>
        )}

        {current === 'payments' && (
          <>
            <PageHead eyebrow="PAYMENTS" title="Payment Records" hint="Your payment history and receipts." />
            <section className="admin-card admin-table-card">
              <div className="admin-section-heading">
                <h2>Payment Records</h2>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="admin-badge">{payments.length} total</span>
                  <button type="button" className="admin-btn" onClick={() => setPrintAll(true)}>
                    🖨 Print all receipts
                  </button>
                </span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, index) => (
                      <tr key={p.id ?? `${p.payment_date}-${index}`}>
                        <td>{p.payment_date}</td>
                        <td>{peso(p.amount)}</td>
                        <td>{p.type || '-'}</td>
                        <td>{p.description || '-'}</td>
                        <td>
                          <span className={p.verified ? 'bd-pill ok' : 'bd-pill warn'}>{p.verified ? 'Paid' : 'Unpaid'}</span>
                        </td>
                        <td>
                          {p.verified ? (
                            <button type="button" className="admin-btn admin-btn-light" onClick={() => setReceiptId(p.id)}>
                              View receipt
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                    {!payments.length && (
                      <tr>
                        <td className="admin-empty" colSpan="6">
                          No payment records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {current === 'attendance' && (
          <>
            <PageHead eyebrow="QR ATTENDANCE" title="Attendance Records" hint="Your time-in / time-out from the QR scanner." />
            <section className="admin-card admin-table-card">
              <div className="admin-section-heading">
                <h2>Attendance Records</h2>
                <span className="admin-badge">{attendance.length} total</span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.attendance_date}>
                        <td>{a.attendance_date}</td>
                        <td><b>{timeOnly(a.time_in)}</b></td>
                        <td>{a.time_out ? <b>{timeOnly(a.time_out)}</b> : <span className="admin-muted">Not yet</span>}</td>
                        <td>
                          <span className="admin-badge">{a.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!attendance.length && (
                      <tr>
                        <td className="admin-empty" colSpan="4">
                          No attendance records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {current === 'reports' && (
          <>
            <PageHead eyebrow="SUPPORT" title="My Reports" hint="Send a concern to the management and see their replies." />
            <ReportCard reports={data?.reports ?? []} onDone={load} />
          </>
        )}

        {current === 'notifications' && (
          <>
            <PageHead eyebrow="UPDATES" title="Notifications" hint="Messages from the management." />
            <section className="admin-card admin-table-card">
              <div className="admin-section-heading">
                <h2>Notifications</h2>
                <span className="admin-badge">{unread || justSeen} new</span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id}>
                        <td>{dateTime(n.created_at)}</td>
                        <td>
                          <span className="admin-badge">{n.type}</span>
                        </td>
                        <td>
                          <strong>{n.title}</strong>
                          <div>{n.message}</div>
                        </td>
                      </tr>
                    ))}
                    {!notifications.length && (
                      <tr>
                        <td className="admin-empty" colSpan="3">
                          No notifications.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {current === 'profile' && (
          <>
            <PageHead eyebrow="ACCOUNT" title="My Profile" hint="Check your details and correct your gender if needed." />
            <ProfileCard user={user} onDone={load} />
          </>
        )}

        {current === 'password' && (
          <>
            <PageHead eyebrow="ACCOUNT" title="Change Password" hint="Keep your account secure." />
            <PasswordCard />
          </>
        )}
      </SideLayout>

      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
      {printAll && <ReceiptModal all onClose={() => setPrintAll(false)} />}
    </>
  );
}
