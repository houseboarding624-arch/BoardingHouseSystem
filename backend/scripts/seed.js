
import bcrypt from 'bcryptjs';
import { assertConfig } from '../src/config.js';

assertConfig();
const { supabase, unwrap } = await import('../src/supabase.js');

const accounts = [
  {
    username: 'admin1',
    password: 'admin123',
    role: 'Admin',
    full_name: 'John Mark',
    contact: '09123456788',
    email: 'admin@example.com',
    address: 'Manila, Philippines',
    preferred_room: null,
  },
  {
    username: 'owner1',
    password: 'owner123',
    role: 'Owner',
    full_name: 'Boarding House Owner',
    contact: '09123456789',
    email: 'owner@example.com',
    address: 'Manila, Philippines',
    preferred_room: null,
  },
  {
    username: 'boarder1',
    password: 'boarder123',
    role: 'Boarder',
    full_name: 'Juan Dela Cruz',
    contact: '09123456787',
    email: 'boarder@example.com',
    address: 'Manila, Philippines',
    preferred_room: '101',
  },
];

for (const { password, ...account } of accounts) {
  unwrap(
    await supabase
      .from('users')
      .upsert(
        { ...account, password: await bcrypt.hash(password, 10) },
        { onConflict: 'username' }
      )
  );
  console.log(`ready: ${account.role.padEnd(8)} ${account.username} / ${password}`);
}

console.log('\nDemo accounts are ready. Change these passwords before production.');
