import { useState } from 'react';
import { api } from '../../api.js';
import { peso } from '../../utils.js';
import { Badge, Btn, Card, Field, Input, Select, Table, billingText, billingToneOf, dueRowClass } from './ui.jsx';

function DueEditor({ boarder, run }) {
  const urgent = boarder.billing?.urgent;
  const [value, setValue] = useState(boarder.next_due_date ?? '');
  const changed = value !== (boarder.next_due_date ?? '');
  return (
    <div style={{ display: 'flex', gap: '5px' }}>
      <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ marginTop: 0, width: '130px', ...(urgent ? { color: '#dc2626', fontWeight: 800, borderColor: '#e5484d' } : {}) }} />
      {changed && (
        <Btn small onClick={() => run(() => api.patch(`/owner/tenants/${boarder.id}`, { next_due_date: value }))}>
          Save
        </Btn>
      )}
    </div>
  );
}

export function TenantsView({ data, run }) {
  const [filter, setFilter] = useState('Active');
  const list = data.boarders.filter((b) =>
    filter === 'All' ? true : filter === 'Disabled' ? b.status === 'Disabled' : b.status !== 'Disabled'
  );

  const roomOptions = (b) =>
    data.rooms.filter((r) => r.room_number === b.preferred_room || r.status !== 'Maintenance');

  return (
    <Card
      title={`Tenants (${list.length})`}
      action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
          <option>Active</option>
          <option>Disabled</option>
          <option>All</option>
        </Select>
      }
    >
      <Table head={['Tenant', 'Contact', 'Room', 'Next due', 'Status', 'Actions']} empty="No boarders found.">
        {list.map((b) => (
          <tr key={b.id} className={dueRowClass(b.billing, b.status)}>
            <td>
              <b>{b.full_name}</b>
              <div className="property-sub">
                @{b.username}
                {b.gender ? ` · ${b.gender}` : ''}
              </div>
            </td>
            <td>
              {b.contact || '-'}
              <div className="property-sub">{b.email || 'No email'}</div>
            </td>
            <td>
              {b.status === 'Disabled' ? (
                b.preferred_room || '-'
              ) : (
                <Select
                  value={b.preferred_room ?? ''}
                  style={{ marginTop: 0, width: '110px' }}
                  onChange={(e) => run(() => api.patch(`/owner/tenants/${b.id}`, { preferred_room: e.target.value }))}
                >
                  <option value="">No room</option>
                  {roomOptions(b).map((r) => (
                    <option key={r.id} value={r.room_number}>
                      Room {r.room_number}
                    </option>
                  ))}
                </Select>
              )}
            </td>
            <td>{b.status === 'Disabled' ? '-' : <DueEditor key={`${b.id}-${b.next_due_date}`} boarder={b} run={run} />}</td>
            <td>
              <Badge tone={billingToneOf(b.billing)}>{b.status === 'Disabled' ? 'Disabled' : billingText(b.billing)}</Badge>
            </td>
            <td className="ov-actions">
              {b.status === 'Disabled' ? (
                <Btn small onClick={() => run(() => api.post(`/owner/tenants/${b.id}/reinstate`))}>
                  Enable account
                </Btn>
              ) : (
                <>
                  <Btn small tone="ghost" onClick={() => run(() => api.post(`/owner/tenants/${b.id}/remind`))}>
                    Remind
                  </Btn>
                  <Btn
                    small
                    tone="ghost"
                    onClick={() =>
                      window.confirm(`Create a temporary password for ${b.full_name}? Their old password stops working.`) &&
                      run(async () => {
                        const result = await api.post(`/owner/tenants/${b.id}/reset-password`);
                        window.alert(
                          `Temporary password for ${b.full_name}:\n\n${result.temp_password}\n\nGive it to the boarder. They can change it in their dashboard.`
                        );
                        return { message: result.message };
                      })
                    }
                  >
                    Reset password
                  </Btn>
                  <Btn
                    small
                    tone="danger"
                    onClick={() =>
                      window.confirm(`Disable ${b.full_name}'s account? They can no longer log in or scan, and the bed becomes free.`) &&
                      run(() => api.post(`/owner/tenants/${b.id}/disable`, { reason: 'Disabled by admin' }))
                    }
                  >
                    Disable
                  </Btn>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="ov-hint">
        A boarder with a due date gets a Gmail notice on the due date if unpaid, and is disabled automatically after
        the grace period ({data.settings.grace_days} days). Recording a rent payment moves the due date one month ahead.
      </p>
    </Card>
  );
}

// Every contract is a fixed 1-year term that starts on the boarder's move-in date.
const CONTRACT_YEARS = 1;
const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** "2026-10-07" -> "2027-10-07" (Feb 29 becomes Feb 28 in non-leap years). */
function contractEnd(start) {
  const [y, m, d] = start.split('-').map(Number);
  const year = y + CONTRACT_YEARS;
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

const daysUntil = (date) => Math.round((Date.parse(date) - Date.parse(todayManila())) / 86400000);

function ContractStatus({ boarder, end }) {
  if (boarder.status === 'Disabled') {
    return <Badge tone="red">Disabled{boarder.termination_reason ? ` - ${boarder.termination_reason}` : ''}</Badge>;
  }
  if (!end) return <Badge tone="gray">No move-in date</Badge>;
  const left = daysUntil(end);
  if (left < 0) return <Badge tone="red">Expired</Badge>;
  if (left <= 30) return <Badge tone="orange">Ends in {left} day{left === 1 ? '' : 's'}</Badge>;
  return <Badge tone="green">Active - {left} days left</Badge>;
}

export function ContractsView({ data }) {
  const rate = (room) => data.rooms.find((r) => r.room_number === room)?.monthly_rate;
  return (
    <Card
      title="Contracts - 1 Year"
      action={
        <Btn small tone="ghost" onClick={() => window.print()}>
          Print
        </Btn>
      }
    >
      <Table
        head={['Tenant', 'Room', 'Monthly rate', 'Contract', 'Start', 'End', 'Next due', 'Status']}
        empty="No contracts yet."
      >
        {data.boarders.map((b) => {
          const end = b.move_in_date ? contractEnd(b.move_in_date) : null;
          return (
            <tr key={b.id}>
              <td>{b.full_name}</td>
              <td>{b.preferred_room || '-'}</td>
              <td>{rate(b.preferred_room) != null ? peso(rate(b.preferred_room)) : '-'}</td>
              <td>1 year</td>
              <td>{b.move_in_date || '-'}</td>
              <td>{end || '-'}</td>
              <td>{b.next_due_date || '-'}</td>
              <td>
                <ContractStatus boarder={b} end={end} />
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="ov-hint">
        Every contract is a 1-year term that starts on the boarder's move-in date, which is set automatically when a
        room is assigned.
      </p>
    </Card>
  );
}

const EMPTY_RES = { full_name: '', contact: '', email: '', room_number: '', reserved_for: '', notes: '' };

export function ReservationsView({ data, run }) {
  const [form, setForm] = useState(EMPTY_RES);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const tone = { Pending: 'orange', Confirmed: 'green', Cancelled: 'gray' };

  return (
    <>
      <Card title="New Reservation">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.post('/owner/reservations', form))) setForm(EMPTY_RES);
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '9px', alignItems: 'end' }}
        >
          <Field label="FULL NAME">
            <Input value={form.full_name} onChange={set('full_name')} required />
          </Field>
          <Field label="CONTACT">
            <Input value={form.contact} onChange={set('contact')} />
          </Field>
          <Field label="EMAIL">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="ROOM">
            <Select value={form.room_number} onChange={set('room_number')}>
              <option value="">Any room</option>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.room_number}>
                  Room {r.room_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="MOVE-IN DATE">
            <Input type="date" value={form.reserved_for} onChange={set('reserved_for')} />
          </Field>
          <Field label="NOTES">
            <Input value={form.notes} onChange={set('notes')} maxLength={255} />
          </Field>
          <Btn type="submit">Add Reservation</Btn>
        </form>
      </Card>

      <Card title={`Reservations (${data.reservations.length})`}>
        <Table head={['Name', 'Contact', 'Room', 'Move-in', 'Status', 'Actions']} empty="No reservations.">
          {data.reservations.map((r) => (
            <tr key={r.id}>
              <td>
                {r.full_name}
                <div className="property-sub">{r.notes}</div>
              </td>
              <td>
                {r.contact || '-'}
                <div className="property-sub">{r.email}</div>
              </td>
              <td>{r.room_number || 'Any'}</td>
              <td>{r.reserved_for || '-'}</td>
              <td>
                <Badge tone={tone[r.status]}>{r.status}</Badge>
              </td>
              <td className="ov-actions">
                {r.status !== 'Confirmed' && (
                  <Btn small onClick={() => run(() => api.patch(`/owner/reservations/${r.id}`, { status: 'Confirmed' }))}>
                    Confirm
                  </Btn>
                )}
                {r.status !== 'Cancelled' && (
                  <Btn small tone="ghost" onClick={() => run(() => api.patch(`/owner/reservations/${r.id}`, { status: 'Cancelled' }))}>
                    Cancel
                  </Btn>
                )}
                <Btn small tone="danger" onClick={() => run(() => api.del(`/owner/reservations/${r.id}`))}>
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

export function UsersView({ data }) {
  const tone = { Owner: 'blue', Admin: 'orange', Boarder: 'green' };
  return (
    <Card title={`Users (${data.users.length})`}>
      <Table head={['Name', 'Username', 'Role', 'Email', 'Status']} empty="No users.">
        {data.users.map((u) => (
          <tr key={u.id}>
            <td>{u.full_name}</td>
            <td>@{u.username}</td>
            <td>
              <Badge tone={tone[u.role]}>{u.role}</Badge>
            </td>
            <td>{u.email || '-'}</td>
            <td>{u.status === 'Disabled' ? <Badge tone="red">Disabled</Badge> : <Badge tone="green">Active</Badge>}</td>
          </tr>
        ))}
      </Table>
      <p className="ov-hint">Boarders create their own accounts from the Register page. Manage their stay in Tenants.</p>
    </Card>
  );
}
