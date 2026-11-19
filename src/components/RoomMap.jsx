import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// How often the map refreshes itself while the page is open (the API allows 60 requests a minute per visitor).
const REFRESH_MS = 30000;

const STATUS = {
  Available: { cls: 'available', label: 'Available' },
  Full: { cls: 'full', label: 'Full' },
  Maintenance: { cls: 'maintenance', label: 'Maintenance' },
};

function roomSummary(room) {
  if (room.status === 'Maintenance') return 'Under maintenance';
  if (room.beds_left === 0) return 'All beds taken';
  return `${room.beds_left} bed${room.beds_left === 1 ? '' : 's'} free`;
}

/**
 * Public room map: every room with its 4 beds (filled = taken, empty = free).
 * Reads GET /api/auth/rooms, which only exposes counts. No boarder names or personal data.
 */
export default function RoomMap() {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/auth/rooms');
      setRooms(data.rooms);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (rooms === null && !error) {
    return (
      <p className="rm-note" role="status">
        Loading room availability…
      </p>
    );
  }

  // First load failed: nothing to show yet.
  if (rooms === null) {
    return (
      <div className="rm-note rm-error" role="alert">
        <p>Could not load room availability. {error}</p>
        <button type="button" className="lp-btn lp-btn-ghost" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (!rooms.length) return <p className="rm-note">No rooms are listed yet.</p>;

  const usable = rooms.filter((r) => r.status !== 'Maintenance');
  const freeBeds = usable.reduce((sum, r) => sum + r.beds_left, 0);
  const totalBeds = usable.reduce((sum, r) => sum + r.beds, 0);
  const openRooms = usable.filter((r) => r.beds_left > 0).length;

  return (
    <div className="rm">
      <div className="rm-summary">
        <p className="rm-count">
          <strong>{freeBeds}</strong> of {totalBeds} beds free in <strong>{openRooms}</strong> room
          {openRooms === 1 ? '' : 's'}
        </p>
        {freeBeds > 0 ? (
          <Link className="lp-btn lp-btn-primary" to="/register">
            Apply for a bed
          </Link>
        ) : (
          <p className="rm-full">All beds are taken right now. Please check again soon.</p>
        )}
      </div>

      <ul className="rm-legend" aria-label="Legend">
        <li>
          <span className="rm-bed free" aria-hidden="true" /> Free bed
        </li>
        <li>
          <span className="rm-bed taken" aria-hidden="true" /> Taken bed
        </li>
        <li>
          <span className="rm-swatch maintenance" aria-hidden="true" /> Maintenance
        </li>
      </ul>

      <ul className="rm-grid">
        {rooms.map((room) => {
          const status = STATUS[room.status] ?? STATUS.Full;
          const maintenance = room.status === 'Maintenance';
          return (
            <li
              key={room.room_number}
              className={`rm-room ${status.cls}`}
              aria-label={
                maintenance
                  ? `Room ${room.room_number}: under maintenance, not open for new boarders.`
                  : `Room ${room.room_number}: ${status.label}. ${roomSummary(room)}.`
              }
            >
              <div className="rm-room-top">
                <b>Room {room.room_number}</b>
                <span className={`rm-badge ${status.cls}`}>{status.label}</span>
              </div>
              {maintenance ? (
                <p className="rm-room-note">Not open for new boarders.</p>
              ) : (
                <>
                  <div className="rm-beds" aria-hidden="true">
                    {Array.from({ length: room.beds }, (_, i) => (
                      <span key={i} className={`rm-bed ${i < room.beds_taken ? 'taken' : 'free'}`} />
                    ))}
                  </div>
                  <p className="rm-room-note">{roomSummary(room)}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {updatedAt && (
        <p className="rm-updated">
          Updates automatically. Last checked{' '}
          {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
        </p>
      )}
    </div>
  );
}
