/** Date helpers that work on plain "YYYY-MM-DD" strings (no timezone surprises). */
export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Adds months, clamping to the end of shorter months (Jan 31 -> Feb 28). */
export const addMonths = (dateStr, n) => {
  const [y, m, day] = dateStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
};

export const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
