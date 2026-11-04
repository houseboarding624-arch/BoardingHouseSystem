import { peso } from '../utils.js';

const GROUPS = [
  ['Available', 'available'],
  ['Occupied', 'occupied'],
  ['Maintenance', 'maintenance'],
];

/** Shows which room numbers are Available / Occupied / Maintenance. `mine` highlights the boarder's own room. */
export default function RoomList({ rooms = [], mine }) {
  return (
    <div className="room-groups">
      {GROUPS.map(([status, cls]) => {
        const list = rooms.filter((r) => r.status === status);
        return (
          <div key={status} className="room-group">
            <div className="room-group-title">
              <span className={`room-dot ${cls}`} />
              {status} <b>({list.length})</b>
            </div>
            {list.length ? (
              <div className="room-chips">
                {list.map((r) => (
                  <span
                    key={r.room_number}
                    className={`room-chip ${cls}${String(r.room_number) === String(mine) ? ' mine' : ''}`}
                    title={r.monthly_rate ? `${peso(r.monthly_rate)} / month` : undefined}
                  >
                    Room {r.room_number}
                    {String(r.room_number) === String(mine) && ' · yours'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="admin-muted">None</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
