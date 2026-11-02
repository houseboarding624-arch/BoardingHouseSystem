import { config } from '../config.js';

/** Today's date as YYYY-MM-DD in the app timezone (Asia/Manila). */
export function todayString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Readable clock time such as "03:05:09 PM" in the app timezone. */
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

/** Current "HH:MM" (24h) in the app timezone. */
export function nowHHMM(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}
