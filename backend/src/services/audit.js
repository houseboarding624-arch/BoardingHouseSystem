import { supabase } from '../supabase.js';

/** Best-effort audit trail; never breaks the request. */
export async function audit(actor, action, details = '') {
  try {
    await supabase.from('audit_logs').insert({
      actor_name: actor?.full_name || actor?.username || 'System',
      action,
      details: String(details).slice(0, 500),
    });
  } catch (err) {
    console.error('audit failed:', err.message);
  }
}
