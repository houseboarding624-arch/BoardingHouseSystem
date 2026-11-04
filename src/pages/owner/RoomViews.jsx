import { useState } from 'react';
import { api } from '../../api.js';
import { peso } from '../../utils.js';
import { Badge, Btn, Card, Field, Input, Select, Table, roomTone } from './ui.jsx';

const EMPTY = { room_number: '', monthly_rate: '', status: 'Available' };

export function RoomsView({ data, run }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const ok = await run(() => api.post('/rooms', form));
    if (ok) setForm(EMPTY);
    setSaving(false);
  }

  return (
    <>
      <Card title="Add / Update Room">
        <form
          onSubmit={save}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '9px', alignItems: 'end' }}
        >
          <Field label="ROOM NUMBER">
            <Input value={form.room_number} onChange={set('room_number')} maxLength={20} required placeholder="101" />
          </Field>
          <Field label="MONTHLY RATE">
            <Input type="number" min="0" step="0.01" value={form.monthly_rate} onChange={set('monthly_rate')} required />
          </Field>
          <Field label="STATUS">
            <Select value={form.status} onChange={set('status')}>
              <option value="Available">Automatic (Available / Occupied)</option>
              <option value="Maintenance">Maintenance</option>
            </Select>
          </Field>
          <Btn type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Room'}
          </Btn>
        </form>
        <p className="ov-hint">
          Add as many rooms as you need, with any number of boarders in each. A room turns <b>Occupied</b> by itself as
          soon as it has a boarder, and goes back to <b>Available</b> when it has none.
        </p>
      </Card>

      <Card title={`Rooms & Beds (${data.rooms.length})`}>
        <Table
          head={['Room', 'Rate', 'Boarders', 'Status', 'Actions']}
          empty="No rooms yet. Add one above."
        >
          {data.rooms.map((r) => (
            <tr key={r.id}>
              <td>
                <b>Room {r.room_number}</b>
              </td>
              <td>{peso(r.monthly_rate)}</td>
              <td>
                {r.tenantList.length ? `${r.tenantList.length} - ${r.tenantList.map((t) => t.full_name).join(', ')}` : '-'}
              </td>
              <td>
                <Badge tone={roomTone[r.status]}>{r.status}</Badge>
              </td>
              <td className="ov-actions">
                <Btn
                  small
                  tone="ghost"
                  onClick={() =>
                    setForm({
                      room_number: r.room_number,
                      monthly_rate: r.monthly_rate,
                      status: r.status === 'Maintenance' ? 'Maintenance' : 'Available',
                    })
                  }
                >
                  Edit
                </Btn>
                <Btn
                  small
                  tone="danger"
                  onClick={() =>
                    window.confirm(`Delete room ${r.room_number}?`) && run(() => api.del(`/owner/rooms/${r.id}`))
                  }
                >
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

function AssignBox({ room, boarders, run }) {
  const [userId, setUserId] = useState('');
  const candidates = boarders.filter((b) => b.status !== 'Disabled' && b.preferred_room !== room.room_number);
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
      <Select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ marginTop: 0 }}>
        <option value="">Put a boarder here…</option>
        {candidates.map((b) => (
          <option key={b.id} value={b.id}>
            {b.full_name}
            {b.preferred_room ? ` (now ${b.preferred_room})` : ''}
          </option>
        ))}
      </Select>
      <Btn
        small
        disabled={!userId}
        onClick={async () => {
          if (await run(() => api.patch(`/owner/tenants/${userId}`, { preferred_room: room.room_number }))) setUserId('');
        }}
      >
        Assign
      </Btn>
    </div>
  );
}

export function VacancyView({ data, run }) {
  const reservedFor = (room) =>
    data.reservations.filter((r) => r.room_number === room.room_number && r.status !== 'Cancelled').length;

  return (
    <Card title={`Vacancy Board - ${data.stats.availableRooms} available room(s)`}>
      <div className="ov-room-grid">
        {data.rooms.map((r) => (
          <div key={r.id} className={`ov-room-card ${r.status.toLowerCase()}`}>
            <div className="ov-room-top">
              <b>Room {r.room_number}</b>
              <Badge tone={roomTone[r.status]}>{r.status}</Badge>
            </div>
            <div className="property-sub">{peso(r.monthly_rate)} / month</div>
            <div className="owner-progress" style={{ marginTop: '10px' }}>
              <div className="owner-progress-track">
                <div className={`owner-progress-fill ${r.occupancyPercent ? 'red' : ''}`} style={{ width: `${r.occupancyPercent}%` }} />
              </div>
              <span>
                {r.tenantList.length} boarder(s)
              </span>
            </div>
            <div className="property-sub" style={{ marginTop: '8px' }}>
              {r.tenantList.map((t) => t.full_name).join(', ') || 'No boarders yet'}
            </div>
            {reservedFor(r) > 0 && <div className="property-sub">{reservedFor(r)} reservation(s) for this room</div>}
            {r.status !== 'Maintenance' && (
              <AssignBox room={r} boarders={data.boarders} run={run} />
            )}
          </div>
        ))}
        {!data.rooms.length && <p className="ov-hint">No rooms yet. Add rooms in Rooms &amp; Beds.</p>}
      </div>
    </Card>
  );
}
