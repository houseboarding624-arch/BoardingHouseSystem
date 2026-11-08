import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import LogoutButton from '../components/LogoutButton.jsx';
import { peso, useBodyClass } from '../utils.js';
import { RoomsView, VacancyView } from './owner/RoomViews.jsx';
import { TenantsView, ContractsView, ReservationsView, UsersView } from './owner/TenantViews.jsx';
import {
  BillingView,
  PaymentsView,
  AdvancePaymentsView,
  ProofsView,
  ExpensesView,
  ReportsView,
} from './owner/MoneyViews.jsx';
import { BoarderReportsView, GcashView } from './owner/BoarderRequests.jsx';
import { RegistrationsView } from './owner/Registrations.jsx';
import RoomPie from '../components/RoomPie.jsx';
import GenderPie from '../components/GenderPie.jsx';
import {
  NotifyView,
  UtilitiesView,
  AnnouncementsView,
  MaintenanceView,
  AuditView,
  SettingsView,
  AttendanceView,
} from './owner/OpsViews.jsx';

// [icon, label, view key]
const NAV = [
  {
    group: 'Properties',
    items: [
      ['▦', 'Rooms & Beds', 'rooms'],
      ['▤', 'Vacancy Board', 'vacancy'],
    ],
  },
  {
    group: 'Tenants',
    items: [
      ['✔', 'Registrations', 'registrations'],
      ['♟', 'Tenants', 'tenants'],
      ['▣', 'Contracts', 'contracts'],
      ['▧', 'Reservations', 'reservations'],
    ],
  },
  {
    group: 'Financial',
    items: [
      ['▣', 'Billing', 'billing'],
      ['₱', 'Payments', 'payments'],
      ['◇', 'Advance Payments', 'deposits'],
      ['▤', 'Payment Proofs', 'proofs'],
      ['▧', 'Expenses', 'expenses'],
      ['💙', 'GCash Payments', 'gcash'],
    ],
  },
  {
    group: 'Operations',
    items: [
      ['◔', 'Attendance', 'attendance'],
      ['📢', 'Boarder Reports', 'reports_inbox'],
      ['➤', 'Send Notification', 'notify'],
      ['ϟ', 'Utilities', 'utilities'],
      ['★', 'Announcements', 'announcements'],
      ['⚒', 'Maintenance', 'maintenance'],
      ['▥', 'Reports', 'reports'],
    ],
  },
];

const OTHER_NAV = [
  ['♟', 'Users', 'users'],
  ['◉', 'Audit Log', 'audit'],
  ['⚙', 'Settings', 'settings'],
];

const VIEWS = {
  rooms: RoomsView,
  vacancy: VacancyView,
  registrations: RegistrationsView,
  tenants: TenantsView,
  contracts: ContractsView,
  reservations: ReservationsView,
  billing: BillingView,
  payments: PaymentsView,
  deposits: AdvancePaymentsView,
  proofs: ProofsView,
  expenses: ExpensesView,
  notify: NotifyView,
  utilities: UtilitiesView,
  announcements: AnnouncementsView,
  maintenance: MaintenanceView,
  reports: ReportsView,
  attendance: AttendanceView,
  gcash: GcashView,
  reports_inbox: BoarderReportsView,
  users: UsersView,
  audit: AuditView,
  settings: SettingsView,
};

function NavLink({ icon, label, view, current, badge }) {
  return (
    <Link className={current === view ? 'active' : ''} to={`/admin#${view}`}>
      <span className="nav-icon">{icon}</span>
      {label}
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  );
}

export default function OwnerDashboard() {
  useBodyClass('owner-body');
  const { user } = useAuth();
  const location = useLocation();
  const hash = location.hash.replace('#', '');
  const current = VIEWS[hash] ? hash : 'overview';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.get('/owner/dashboard'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    // Pick up new QR scans automatically.
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  // Every action goes through here: shows the result/error, then refreshes the data.
  const run = useCallback(
    async (action) => {
      setError('');
      setFlash('');
      try {
        const result = await action();
        if (result?.message) setFlash(result.message);
        await load();
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      }
    },
    [load]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    setError('');
    setFlash('');
  }, [current]);

  // Red counters in the sidebar + a banner when something new arrives between refreshes.
  const badges = {
    reports_inbox: data?.stats.newReports ?? 0,
    gcash: data?.stats.pendingGcash ?? 0,
    registrations: data?.stats.pendingRegistrations ?? 0,
  };
  const seen = useRef(null);
  useEffect(() => {
    if (!data) return;
    const now = { reports: data.stats.newReports, gcash: data.stats.pendingGcash, registrations: data.stats.pendingRegistrations };
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    if (now.reports > before.reports) {
      const latest = data.reports.find((r) => r.status === 'New');
      setFlash(`🔔 New report from ${latest?.full_name ?? 'a boarder'}: ${latest?.subject ?? ''}`);
    } else if (now.registrations > before.registrations) {
      const latest = data.registrations.filter((r) => r.status === 'Pending').at(-1);
      setFlash(`🔔 New registration from ${latest?.full_name ?? 'a boarder'} waiting for approval`);
    } else if (now.gcash > before.gcash) {
      const latest = data.gcashPayments.find((g) => g.status === 'Pending');
      setFlash(`🔔 New GCash payment from ${latest?.full_name ?? 'a boarder'} (${peso(latest?.amount)}) waiting for approval`);
    }
  }, [data]);

  const ownerName = user?.full_name || 'Admin';
  const View = VIEWS[current];

  return (
    <div className="owner-layout">
      <aside className="owner-sidebar">
        <Link className="owner-logo" to="/admin">
          <span className="owner-logo-mark">⌂</span>
          <span>Boarding House</span>
        </Link>

        <nav className="owner-nav">
          <NavLink icon="◧" label="Dashboard" view="overview" current={current} />
        </nav>

        {NAV.map(({ group, items }) => (
          <div key={group}>
            <div className="owner-nav-group">{group}</div>
            <nav className="owner-nav">
              {items.map(([icon, label, view]) => (
                <NavLink key={view} icon={icon} label={label} view={view} current={current} badge={badges[view]} />
              ))}
            </nav>
          </div>
        ))}

        <div className="owner-divider" />

        <div className="owner-nav-group">Other</div>
        <nav className="owner-nav">
          {OTHER_NAV.map(([icon, label, view]) => (
            <NavLink key={view} icon={icon} label={label} view={view} current={current} />
          ))}
        </nav>
      </aside>

      <main className="owner-main">
        <header className="owner-topbar">
          <div className="owner-user">
            <span>Welcome, {ownerName}</span>
            <span className="owner-avatar">A</span>
            <LogoutButton className="owner-logout">Logout</LogoutButton>
          </div>
        </header>

        <div className="owner-content">
          {error && <div className="owner-alert">{error}</div>}
          {flash && <div className="owner-flash">{flash}</div>}

          {!data && !error && <p className="ov-hint">Loading…</p>}
          {data && (current === 'overview' ? <Overview data={data} ownerName={ownerName} /> : <View data={data} run={run} />)}
        </div>
      </main>
    </div>
  );
}

function Overview({ data, ownerName }) {
  const { stats, rooms, accounts } = data;
  const recentPayments = data.payments.slice(0, 5);
  const monthLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <>
      <section className="owner-grid-top owner-section">
        <article className="owner-stat">
          <span className="owner-stat-label">ROOMS</span>
          <strong className="owner-stat-value">{stats.totalRooms}</strong>
          <div className="owner-stat-note">
            {stats.availableRooms} available · {stats.occupiedRooms} occupied
          </div>
          <span className="owner-stat-icon">▦</span>
        </article>

        <article className="owner-stat">
          <span className="owner-stat-label">OCCUPIED ROOMS</span>
          <strong className="owner-stat-value">{stats.occupiedRooms}</strong>
          <div className="owner-stat-note">{stats.availableRooms} still available</div>
          <span className="owner-stat-icon">▰</span>
        </article>

        <article className="owner-stat">
          <span className="owner-stat-label">ACTIVE TENANTS</span>
          <strong className="owner-stat-value">{stats.tenants}</strong>
          <div className="owner-stat-note">
            {stats.todayAttendance} attendance scans today · {stats.overdue} overdue · {stats.dueSoon} due within 7 days
          </div>
          <span className="owner-stat-icon">♟</span>
        </article>

        <article className="owner-stat teal">
          <span className="owner-stat-label">THIS MONTH</span>
          <strong className="owner-stat-value">{peso(stats.monthTotal)}</strong>
          <div className="owner-stat-note">Recorded payments for {monthLabel}</div>
          <span className="owner-stat-icon">₱</span>
        </article>
      </section>

      <div className="owner-row-pies">
        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>Rooms: Available / Occupied / Maintenance</h2>
              <Link to="/admin#rooms">View rooms →</Link>
            </div>
            <RoomPie
              stats={{ available: stats.availableRooms, occupied: stats.occupiedRooms, maintenance: stats.maintenanceRooms }}
            />
          </div>
        </section>

        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>Boarders: Male / Female</h2>
              <Link to="/admin#tenants">View tenants →</Link>
            </div>
            <GenderPie boarders={data.boarders} />
          </div>
        </section>
      </div>

      <div className="owner-row-main">
        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>Occupancy Rate</h2>
              <Link to="/admin#rooms">View rooms →</Link>
            </div>

            <div className="occupancy-wrap">
              <div>
                <div className="owner-ring" style={{ '--occupancy': `${stats.occupancyRate}%` }}>
                  <div className="owner-ring-content">
                    <strong>{stats.occupancyRate}%</strong>
                    <span>rooms occupied</span>
                  </div>
                </div>
                <div className="owner-legend">
                  <span>
                    <i className="owner-dot" />
                    Filled {stats.occupiedRooms}
                  </span>
                  <span>•</span>
                  <span>
                    <i className="owner-dot empty" />
                    Empty {stats.availableRooms}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>User Accounts</h2>
              <Link to="/admin#users">View all →</Link>
            </div>

            <div className="account-list">
              <div className="account-item">
                <span className="account-icon">♟</span>
                <strong>Owners</strong>
                <b>{accounts.owners}</b>
              </div>
              <div className="account-item">
                <span className="account-icon" style={{ color: '#2563eb', background: '#dbeafe' }}>
                  ♟
                </span>
                <strong>Admins</strong>
                <b>{accounts.admins}</b>
              </div>
              <div className="account-item">
                <span className="account-icon">♟</span>
                <strong>Tenants</strong>
                <b>{accounts.tenants}</b>
              </div>
            </div>

            <div className="owner-total">
              <span>Total Active</span>
              <strong>{accounts.owners + accounts.admins + accounts.tenants}</strong>
            </div>
          </div>
        </section>

        <section className="owner-card property-card owner-section">
          <div className="owner-card-title" style={{ padding: '16px 16px 0' }}>
            <h2>All Properties</h2>
            <Link to="/admin#rooms">Manage →</Link>
          </div>

          <div className="table-wrap">
            <table className="property-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Manager</th>
                  <th>Boarders</th>
                  <th>Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="property-name">Room {r.room_number}</div>
                      <div className="property-sub">{r.status}</div>
                    </td>
                    <td>{ownerName}</td>
                    <td>{r.tenantList.length}</td>
                    <td>
                      <div className="owner-progress">
                        <div className="owner-progress-track">
                          <div
                            className={`owner-progress-fill ${r.occupancyPercent ? 'red' : ''}`}
                            style={{ width: `${r.occupancyPercent}%` }}
                          />
                        </div>
                        <span>{r.occupancyPercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rooms.length && (
                  <tr>
                    <td colSpan="4">No rooms yet. Open Rooms &amp; Beds to add one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="owner-bottom">
        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>Recent Payments</h2>
              <Link to="/admin#payments">View all →</Link>
            </div>

            <div className="payment-list">
              {recentPayments.map((p) => (
                <div className="payment-item" key={p.id}>
                  <span className="payment-icon">₱</span>
                  <div>
                    <div className="payment-name">{p.full_name}</div>
                    <div className="payment-meta">
                      {p.description || p.type} · {p.payment_date}
                    </div>
                  </div>
                  <div className="payment-amount">
                    {peso(p.amount)}
                    <span className="payment-status">{p.verified ? 'PAID' : 'UNPAID'}</span>
                  </div>
                </div>
              ))}

              {!recentPayments.length && (
                <div className="payment-item">
                  <div style={{ gridColumn: '1/-1', color: '#64748b', fontSize: '12px' }}>No payments recorded yet.</div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="owner-card owner-section">
          <div className="owner-card-pad">
            <div className="owner-card-title">
              <h2>Quick Actions</h2>
            </div>

            <div className="quick-grid">
              <Link className="quick-action" to="/admin#rooms">
                <span className="quick-icon">＋</span>
                Add Room
              </Link>
              <Link className="quick-action" to="/admin#payments">
                <span className="quick-icon">₱</span>
                Record Payment
              </Link>
              <Link className="quick-action" to="/admin#settings">
                <span className="quick-icon">⚙</span>
                Settings
              </Link>
              <Link className="quick-action" to="/admin#reports">
                <span className="quick-icon">▤</span>
                Reports
              </Link>
            </div>

            <div className="system-status">
              <div className="system-status-top">
                <span className="status-shield">{data.mail.configured ? '✓' : '!'}</span>
                <div>
                  <strong>System Status</strong>
                  <small>{data.mail.configured ? 'Gmail notices active' : 'Gmail not configured'}</small>
                </div>
              </div>
              <div className="system-version">
                <span>●</span> v2.0.0 · {data.runtime}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="owner-card owner-section" style={{ marginTop: '12px' }}>
        <div className="owner-card-pad">
          <div className="owner-card-title">
            <h2>Recent Attendance</h2>
            <Link to="/admin#attendance">View all →</Link>
          </div>
          <div className="table-wrap">
            <table className="property-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttendance.map((r) => (
                  <tr key={r.id}>
                    <td>{r.full_name}</td>
                    <td>{r.attendance_date}</td>
                    <td>{r.status || '-'}</td>
                  </tr>
                ))}
                {!data.recentAttendance.length && (
                  <tr>
                    <td colSpan="3">No attendance records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
