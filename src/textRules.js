// Create Account rules. Keep in sync with backend/src/routes/auth.js.

export const USERNAME_HINT = '8 to 12 characters. Starts with a capital letter; letters and numbers only.';
export const USERNAME_ERROR = 'Username must be 8 to 12 characters, start with a capital letter, and use letters and numbers only.';

export const isValidUsername = (value) => /^[A-Z][A-Za-z0-9]{7,11}$/.test(value);

/** Letters and numbers only, at most 12 characters, first letter always a capital. */
export function cleanUsername(value) {
  const text = value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Capital first letter of every word (full name, address). The rest of each word is left as typed. */
export const capitalizeWords = (value) => value.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase());
