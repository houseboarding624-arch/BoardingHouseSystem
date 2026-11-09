import { supabase, unwrap } from '../supabase.js';

/** Every room has this many beds. */
export const BEDS_PER_ROOM = 4;

/** Active boarders per room number. */
export function tenantsByRoom(boarders) {
  const map = new Map();
  for (const b of boarders) {
    if ((b.status && b.status !== 'Active') || !b.preferred_room) continue;
    const key = String(b.preferred_room);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return map;
}

/**
 * Keeps rooms.status in sync with who actually lives there:
 * all 4 beds taken -> Occupied (full), otherwise Available (some beds are still free).
 * "Maintenance" is manual and kept as-is.
 * Returns the refreshed room list, each room with beds, beds_taken and beds_left.
 */
export async function syncRoomStatuses() {
  const rooms = unwrap(await supabase.from('rooms').select('*').order('room_number', { ascending: true }));
  const boarders = unwrap(
    await supabase.from('users').select('id,preferred_room,status').eq('role', 'Boarder')
  );
  const map = tenantsByRoom(boarders);

  for (const room of rooms) {
    const taken = (map.get(String(room.room_number)) ?? []).length;
    if (room.status !== 'Maintenance') {
      const next = taken >= BEDS_PER_ROOM ? 'Occupied' : 'Available';
      if (next !== room.status) {
        unwrap(await supabase.from('rooms').update({ status: next }).eq('id', room.id));
        room.status = next;
      }
    }
    room.beds = BEDS_PER_ROOM;
    room.beds_taken = Math.min(taken, BEDS_PER_ROOM);
    room.beds_left = Math.max(0, BEDS_PER_ROOM - taken);
  }
  return rooms;
}

/**
 * Does this room exist, is it open, and does it still have a free bed?
 * Pass excludeUserId when moving a boarder who may already live in that room.
 */
export async function checkRoomHasBed(roomNumber, excludeUserId = null) {
  const rooms = unwrap(await supabase.from('rooms').select('*').eq('room_number', roomNumber).limit(1));
  const room = rooms[0];
  if (!room) return { ok: false, message: `Room ${roomNumber} does not exist.` };
  if (room.status === 'Maintenance') return { ok: false, message: `Room ${roomNumber} is under maintenance.` };

  const living = unwrap(
    await supabase
      .from('users')
      .select('id')
      .eq('role', 'Boarder')
      .eq('status', 'Active')
      .eq('preferred_room', String(roomNumber))
  );
  const taken = living.filter((u) => Number(u.id) !== Number(excludeUserId)).length;
  if (taken >= BEDS_PER_ROOM) {
    return { ok: false, message: `Room ${roomNumber} is full. All ${BEDS_PER_ROOM} beds are taken.` };
  }
  return { ok: true, room, bedsLeft: BEDS_PER_ROOM - taken };
}

/** Read-only room list with bed counts (used by the public registration form). Never changes any data. */
export async function listRoomsWithBeds() {
  const rooms = unwrap(await supabase.from('rooms').select('room_number,status').order('room_number', { ascending: true }));
  const boarders = unwrap(
    await supabase.from('users').select('id,preferred_room,status').eq('role', 'Boarder').eq('status', 'Active')
  );
  const map = tenantsByRoom(boarders);
  return rooms.map((room) => {
    const taken = Math.min((map.get(String(room.room_number)) ?? []).length, BEDS_PER_ROOM);
    return {
      room_number: room.room_number,
      status: room.status === 'Maintenance' ? 'Maintenance' : taken >= BEDS_PER_ROOM ? 'Full' : 'Available',
      beds: BEDS_PER_ROOM,
      beds_taken: taken,
      beds_left: BEDS_PER_ROOM - taken,
    };
  });
}
