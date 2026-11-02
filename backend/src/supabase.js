import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Uses the secret (service) key, so this must only ever run on the server.
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Throws if a Supabase response contains an error, otherwise returns data. */
export function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message || 'Database error');
    err.code = error.code;
    throw err;
  }
  return data;
}
