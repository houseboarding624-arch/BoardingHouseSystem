import { supabase, unwrap } from '../supabase.js';

/** Active boarders count per room number. */
export function tenantsByRoom(boarders) {
  const map = new Map();
  for (const b of boarders) {
    if (b.status === 'Disabled' || !b.preferred_room) continue;
    const key = String(b.preferred_room);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return map;
}

/**
 * Keeps rooms.status in sync with who actually lives there:
 * at least one boarder -> Occupied, none -> Available (no limit on boarders per room). "Maintenance" is manual and kept as-is.
 * Returns the refreshed room list.
 */
export async function syncRoomStatuses() {
  const rooms = unwrap(await supabase.from('rooms').select('*').order('room_number', { ascending: true }));
  const boarders = unwrap(
    await supabase.from('users').select('id,preferred_room,status').eq('role', 'Boarder')
  );
  const map = tenantsByRoom(boarders);

  for (const room of rooms) {
    if (room.status === 'Maintenance') continue;
    const taken = (map.get(String(room.room_number)) ?? []).length;
    const next = taken >= 1 ? 'Occupied' : 'Available';
    if (next !== room.status) {
      unwrap(await supabase.from('rooms').update({ status: next }).eq('id', room.id));
      room.status = next;
    }
  }
  return rooms;
}

/** Does this room exist and accept boarders? (no limit on how many boarders per room) */
export async function checkRoomHasBed(roomNumber) {
  const rooms = unwrap(await supabase.from('rooms').select('*').eq('room_number', roomNumber).limit(1));
  const room = rooms[0];
  if (!room) return { ok: false, message: `Room ${roomNumber} does not exist.` };
  if (room.status === 'Maintenance') return { ok: false, message: `Room ${roomNumber} is under maintenance.` };

  return { ok: true, room };
}
