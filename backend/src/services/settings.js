import { supabase, unwrap } from '../supabase.js';

const DEFAULTS = {
  curfew_enabled: 'true',
  curfew_time: '22:00',
  grace_days: '3',
  auto_terminate: 'true',
  curfew_last_run: '',
  gcash_number: '',
  gcash_name: '',
  gcash_qr_version: '',
};

export async function getSettings() {
  const rows = unwrap(await supabase.from('app_settings').select('key,value').neq('key', 'gcash_qr'));
  const raw = { ...DEFAULTS };
  for (const row of rows) raw[row.key] = row.value;
  return {
    curfew_enabled: raw.curfew_enabled === 'true',
    curfew_time: /^\d{2}:\d{2}$/.test(raw.curfew_time) ? raw.curfew_time : '22:00',
    grace_days: Math.max(0, Number.parseInt(raw.grace_days, 10) || 0),
    auto_terminate: raw.auto_terminate === 'true',
    curfew_last_run: raw.curfew_last_run,
    gcash_number: raw.gcash_number,
    gcash_name: raw.gcash_name,
    gcash_has_qr: Boolean(raw.gcash_qr_version),
    gcash_qr_version: raw.gcash_qr_version,
  };
}

export async function saveSetting(key, value) {
  unwrap(await supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' }));
}

/** The uploaded GCash QR as a data URL ('' when none). Kept out of getSettings() because it is large. */
export async function getGcashQr() {
  const rows = unwrap(await supabase.from('app_settings').select('value').eq('key', 'gcash_qr').limit(1));
  return rows[0]?.value ?? '';
}
