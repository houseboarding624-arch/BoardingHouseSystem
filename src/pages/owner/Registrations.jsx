import { useState } from 'react';
import { api } from '../../api.js';
import { dateTime } from '../../utils.js';
import { Badge, Btn, Card, Select, Table } from './ui.jsx';

const TONE = { Pending: 'orange', Declined: 'red' };

/** New boarder registrations: the admin approves or declines them before they can log in. */
export function RegistrationsView({ data, run }) {
  const [filter, setFilter] = useState('Pending');
  const [busyId, setBusyId] = useState(null);
  const list = data.registrations.filter((r) => filter === 'All' || r.status === filter);

  async function act(person, action) {
    if (action === 'decline' && !window.confirm(`Decline the registration of ${person.full_name}?`)) return;
    setBusyId(person.id);
    await run(() => api.post(`/owner/registrations/${person.id}/${action}`));
    setBusyId(null);
  }

  return (
    <Card
      title={`Registrations (${data.stats.pendingRegistrations} waiting)`}
      action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
          <option>Pending</option>
          <option>Declined</option>
          <option>All</option>
        </Select>
      }
    >
      <Table
        head={['Registered', 'Name', 'Gender', 'Contact', 'Email', 'Address', 'Room', 'Status', 'Actions']}
        empty={filter === 'Pending' ? 'No registrations waiting for approval.' : 'No registrations.'}
      >
        {list.map((r) => (
          <tr key={r.id}>
            <td>{dateTime(r.created_at)}</td>
            <td>
              {r.full_name}
              <div className="property-sub">@{r.username}</div>
            </td>
            <td>{r.gender || '-'}</td>
            <td>{r.contact || '-'}</td>
            <td>{r.email || '-'}</td>
            <td>{r.address || '-'}</td>
            <td>{r.preferred_room || '-'}</td>
            <td>
              <Badge tone={TONE[r.status]}>{r.status}</Badge>
            </td>
            <td className="ov-actions">
              <Btn small disabled={busyId === r.id} onClick={() => act(r, 'approve')}>
                Approve
              </Btn>
              {r.status === 'Pending' && (
                <Btn small tone="danger" disabled={busyId === r.id} onClick={() => act(r, 'decline')}>
                  Decline
                </Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="ov-hint">
        Boarders cannot log in until you approve them. Approving moves them into the room they chose (if it exists).
      </p>
    </Card>
  );
}
