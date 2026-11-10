import { useEffect } from 'react';

const TZ = 'Asia/Manila';

/** Allowed payment amount (pesos). Keep in sync with backend/src/services/payments.js. */
export const MIN_PAYMENT = 1000;
export const MAX_PAYMENT = 2000;

export const peso = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** "Oct 7, 2026, 3:05 PM" in Manila time, or "-" when empty. */
/** Clock time only (e.g. 10:31:05 AM) in Philippine time, for attendance Time In / Time Out. */
export function timeOnly(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('en-PH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function dateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Adds a class to <body> while a page is mounted (the dashboards style the body). */
export function useBodyClass(className) {
  useEffect(() => {
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [className]);
}
