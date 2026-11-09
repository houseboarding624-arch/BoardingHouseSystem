import { peso } from '../utils.js';

const GROUPS = [
  ['Available', 'available', 'Rooms with free beds'],
  ['Occupied', 'occupied', 'Full rooms'],
  ['Maintenance', 'maintenance', ''],
];

const bedsText = (n) => `${n} bed${n === 1 ? '' : 's'} left`;

/** Which rooms still have free beds (every room has 4 beds). `mine` highlights the boarder's own room. */
export default function RoomList({ rooms = [], mine }) {
  const usable = rooms.filter((r) => r.status !== 'Maintenance');
  const free = usable.reduce((sum, r) => sum + (r.beds_left ?? 0), 0);
  const total = usable.reduce((sum, r) => sum + (r.beds ?? 0), 0);

  return (
    <div className="room-groups">
      <p className="admin-muted" style={{ margin: 0 }}>
        <b>{free}</b> of <b>{total}</b> beds are free. Every room has 4 beds.
      </p>
      {GROUPS.map(([status, cls, hint]) => {
        const list = rooms.filter((r) => r.status === status);
        return (
          <div key={status} className="room-group">
            <div className="room-group-title">
              <span className={`room-dot ${cls}`} />
              {status} <b>({list.length})</b>
              {hint && <span className="admin-muted"> - {hint}</span>}
            </div>
            {list.length ? (
              <div className="room-chips">
                {list.map((r) => {
                  const isMine = String(r.room_number) === String(mine);
                  return (
                    <span
                      key={r.room_number}
                      className={`room-chip ${cls}${isMine ? ' mine' : ''}`}
                      title={r.monthly_rate ? `${peso(r.monthly_rate)} / month` : undefined}
                    >
                      Room {r.room_number}
                      {status === 'Available' && ` · ${r.beds_taken}/${r.beds} · ${bedsText(r.beds_left)}`}
                      {status === 'Occupied' && ` · Full ${r.beds_taken}/${r.beds}`}
                      {isMine && ' · yours'}
                    </span>
                  );
                })}
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
