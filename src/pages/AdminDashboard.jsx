import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { billingText } from './owner/ui.jsx';
import RoomPie from '../components/RoomPie.jsx';
import GenderPie from '../components/GenderPie.jsx';
import { useAuth } from '../auth.jsx';
import SideLayout from '../components/SideLayout.jsx';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { dateTime, peso, useBodyClass } from '../utils.js';

const VIEW_KEYS = ['overview', 'boarders', 'archives', 'attendance', 'payments', 'gcash', 'reports'];

function PageHead({ eyebrow, title, hint, action }) {
  return (
    <section className="admin-heading">
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {hint && <p className="admin-muted">{hint}</p>}
      </div>
      {action}
    </section>
  );
}

export default function AdminDashboard() {
  useBodyClass('owner-body');
  const { user } = useAuth();
  const [receiptId, setReceiptId] = useState(null);
  const hash = useLocation().hash.replace('#', '');
  const current = VIEW_KEYS.includes(hash) ? hash : 'overview';

  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null); // { text, ok }

  const load = useCallback(async () => {
    try {
      const result = await api.get('/admin/dashboard');
      setData(result);
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    }
  }, []);

  useEffect(() => {
    load();
    // Pick up new QR scans automatically.
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const reports = data?.reports ?? [];
  const gcash = data?.gcashPayments ?? [];

  // Banner when a new report / GCash payment arrives while the page is open.
  const seen = useRef(null);
  useEffect(() => {
    if (!data) return;
    const now = { reports: data.stats.newReports, gcash: data.stats.pendingGcash };
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    if (now.reports > before.reports) {
      const latest = data.reports.find((r) => r.status === 'New');
      setNotice({ text: `🔔 New report from ${latest?.full_name ?? 'a boarder'}: ${latest?.subject ?? ''}`, ok: true });
    } else if (now.gcash > before.gcash) {
      const latest = data.gcashPayments.find((g) => g.status === 'Pending');
      setNotice({ text: `🔔 New GCash payment from ${latest?.full_name ?? 'a boarder'} (${peso(latest?.amount)})`, ok: true });
    }
  }, [data]);

  const boarders = data?.boarders ?? [];
  const payments = data?.payments ?? [];
  const attendance = data?.attendance ?? [];
  const archived = data?.archived ?? [];
  const stats = data?.stats;

  const groups = [
    {
      items: [
        { icon: '◧', label: 'Dashboard', view: 'overview' },
        { icon: '♟', label: 'Boarders', view: 'boarders' },
        { icon: '🗄', label: 'Archives', view: 'archives' },
        { icon: '◔', label: 'Attendance', view: 'attendance' },
      ],
    },
    {
      label: 'Money',
      items: [
        { icon: '₱', label: 'Payments', view: 'payments' },
        { icon: '💙', label: 'GCash Payments', view: 'gcash', badge: stats?.pendingGcash ?? 0 },
      ],
    },
    {
      label: 'Other',
      items: [
        { icon: '📢', label: 'Boarder Reports', view: 'reports', badge: stats?.newReports ?? 0 },
        { icon: '▦', label: 'Boarder QR Codes', to: '/qr' },
      ],
    },
  ];

  return (
    <>
    <SideLayout basePath="/owner" groups={groups} current={current} userName={user?.full_name || 'Owner'}>
      {notice && <div className={`admin-notice ${notice.ok ? 'success' : ''}`}>{notice.text}</div>}

      {current === 'overview' && (
        <>
          <PageHead eyebrow="CONTROL CENTER" title="Owner Dashboard" hint="View boarders, payments and QR attendance." />

          <section className="admin-stats">
            <article className="admin-stat">
              <span>Boarders</span>
              <strong>{stats?.boarders ?? 0}</strong>
            </article>
            <article className="admin-stat">
              <span>Payments Today</span>
              <strong>{peso(stats?.paymentsTotalToday)}</strong>
            </article>
            <article className="admin-stat">
              <span>Attendance Records</span>
              <strong>{stats?.attendanceRecords ?? 0}</strong>
            </article>
            <article className={`admin-stat ${stats?.dueSoon ? 'danger' : ''}`}>
              <span>Overdue / Due in 7 days</span>
              <strong>{stats?.dueSoon ?? 0}</strong>
            </article>
            <article className="admin-stat">
              <span>New Reports</span>
              <strong>{stats?.newReports ?? 0}</strong>
            </article>
            <article className="admin-stat">
              <span>GCash Pending</span>
              <strong>{stats?.pendingGcash ?? 0}</strong>
            </article>
          </section>

          <div className="admin-grid">
            <article className="admin-card">
              <div className="admin-section-heading">
                <h2>🚪 Rooms</h2>
                <span className="admin-badge">{stats?.rooms?.total ?? 0} rooms</span>
              </div>
              <RoomPie stats={stats?.rooms} />
            </article>

            <article className="admin-card">
              <div className="admin-section-heading">
                <h2>👥 Boarders: Male / Female</h2>
              </div>
              <GenderPie boarders={boarders} />
            </article>
          </div>
        </>
      )}

      {current === 'boarders' && (
        <>
          <PageHead eyebrow="BOARDERS" title="Boarders" hint="Everyone staying in the boarding house." />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>Boarders</h2>
              <span className="admin-badge">{boarders.length} total</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Gender</th>
                    <th>Room</th>
                    <th>Next due</th>
                    <th>Contact</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {boarders.map((b) => (
                    <tr key={b.id} className={b.status !== 'Disabled' && b.billing?.urgent ? 'due-urgent' : undefined}>
                      <td>{b.full_name}</td>
                      <td>{b.username}</td>
                      <td>{b.gender || '-'}</td>
                      <td>{b.preferred_room || '-'}</td>
                      <td>
                        {b.status === 'Disabled' || !b.next_due_date ? (
                          '-'
                        ) : (
                          <>
                            {b.next_due_date}{' '}
                            <span className={b.billing.urgent ? 'bd-pill bad' : 'bd-pill ok'}>{billingText(b.billing)}</span>
                          </>
                        )}
                      </td>
                      <td>{b.contact || '-'}</td>
                      <td>{b.email || '-'}</td>
                    </tr>
                  ))}
                  {!boarders.length && (
                    <tr>
                      <td className="admin-empty" colSpan="7">
                        No boarders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {current === 'archives' && (
        <>
          <PageHead
            eyebrow="ARCHIVES"
            title="Archives"
            hint="Boarders who moved out or transferred to another boarding house. Their accounts are disabled. The admin can enable them again."
          />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>Archived boarders</h2>
              <span className="admin-badge">{archived.length} total</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Last room</th>
                    <th>Left on</th>
                    <th>Reason</th>
                    <th>Account</th>
                    <th>Contact</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((b) => (
                    <tr key={b.id}>
                      <td>{b.full_name}</td>
                      <td>{b.username}</td>
                      <td>{b.preferred_room || '-'}</td>
                      <td>{b.archived_at ? new Date(b.archived_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : '-'}</td>
                      <td>
                        <span className="admin-badge">{b.archive_type || 'Archived'}</span>
                        {b.archive_reason ? ` ${b.archive_reason}` : ''}
                      </td>
                      <td>
                        <span className="bd-pill bad">Disabled</span>
                      </td>
                      <td>{b.contact || '-'}</td>
                      <td>{b.email || '-'}</td>
                    </tr>
                  ))}
                  {!archived.length && (
                    <tr>
                      <td className="admin-empty" colSpan="8">
                        No archived boarders.
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
          <PageHead
            eyebrow="QR ATTENDANCE"
            title="Attendance"
            hint="Time-in / time-out records from the boarders' QR scans."
            action={
              <Link className="admin-btn" to="/qr">
                📱 Boarder QR Codes
              </Link>
            }
          />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>Attendance</h2>
              <span className="admin-badge">{attendance.length} records</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Boarder</th>
                    <th>Room</th>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name}</td>
                      <td>{r.room || '-'}</td>
                      <td>{r.attendance_date}</td>
                      <td>{dateTime(r.time_in)}</td>
                      <td>{dateTime(r.time_out)}</td>
                      <td>
                        <span className="admin-badge">{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {!attendance.length && (
                    <tr>
                      <td className="admin-empty" colSpan="6">
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {current === 'payments' && (
        <>
          <PageHead eyebrow="MONEY" title="Payments" hint="Recorded payments from boarders." />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>Payments</h2>
              <span className="admin-badge">{payments.length} total</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Boarder</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.full_name}</td>
                      <td>{p.payment_date}</td>
                      <td>{peso(p.amount)}</td>
                      <td>{p.description || '-'}</td>
                      <td>
                        {p.verified ? (
                          <button type="button" className="admin-btn admin-btn-light" onClick={() => setReceiptId(p.id)}>
                            View receipt
                          </button>
                        ) : (
                          <span className="bd-pill warn">Unpaid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!payments.length && (
                    <tr>
                      <td className="admin-empty" colSpan="5">
                        No payments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {current === 'gcash' && (
        <>
          <PageHead eyebrow="MONEY" title="GCash Payments" hint="GCash payments sent by boarders." />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>GCash Payments</h2>
              <span className="admin-badge">{stats?.pendingGcash ?? 0} pending</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sent</th>
                    <th>Boarder</th>
                    <th>Amount</th>
                    <th>For</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gcash.map((g) => (
                    <tr key={g.id}>
                      <td>{dateTime(g.created_at)}</td>
                      <td>{g.full_name}</td>
                      <td>{peso(g.amount)}</td>
                      <td>{g.type}</td>
                      <td>{g.reference_no}</td>
                      <td>
                        <span className={g.status === 'Approved' ? 'bd-pill ok' : g.status === 'Rejected' ? 'bd-pill bad' : 'bd-pill warn'}>
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!gcash.length && (
                    <tr>
                      <td className="admin-empty" colSpan="6">
                        No GCash payments yet.
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
          <PageHead eyebrow="BOARDERS" title="Boarder Reports" hint="Reports and concerns sent by boarders." />
          <section className="admin-card admin-table-card">
            <div className="admin-section-heading">
              <h2>Boarder Reports</h2>
              <span className="admin-badge">{stats?.newReports ?? 0} new</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Boarder</th>
                    <th>Report</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{dateTime(r.created_at)}</td>
                      <td>
                        {r.full_name}
                        <div className="admin-muted">Room {r.room || '-'}</div>
                      </td>
                      <td>
                        <strong>{r.subject}</strong> <span className="admin-badge">{r.category}</span>
                        <div>{r.message}</div>
                        {r.admin_reply && <div className="bd-reply">Admin reply: {r.admin_reply}</div>}
                      </td>
                      <td>
                        <span className={r.status === 'Resolved' ? 'bd-pill ok' : r.status === 'New' ? 'bd-pill bad' : 'bd-pill warn'}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!reports.length && (
                    <tr>
                      <td className="admin-empty" colSpan="4">
                        No reports from boarders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </SideLayout>
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  );
}
