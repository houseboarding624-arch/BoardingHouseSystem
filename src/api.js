// Small fetch wrapper. The session lives in an httpOnly cookie set by the API.
// VITE_API_URL is empty when the API serves the app (or in local dev through the Vite proxy),
// and the backend's https URL when the app is hosted separately (GitHub Pages).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: API_URL ? 'include' : 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure, blocked by CORS, or the server is down.
    throw new Error('Cannot reach the server. Check that the backend is running and that VITE_API_URL is correct.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok || data?.success === false) {
    const fallback = data
      ? 'Request failed. Please try again.'
      : `The server did not answer correctly (HTTP ${response.status}). Is the backend running?`;
    const error = new Error(data?.message || fallback);
    error.status = response.status;
    // The session ended (expired, or the account was disabled/archived): let the app log the user out.
    if (response.status === 401 && !path.startsWith('/auth/login')) window.dispatchEvent(new Event('bh:session-ended'));
    error.data = data;
    throw error;
  }

  return data;
}

// For images (e.g. the GCash QR): fetched with the login cookie, so it also works when the app and API are on different sites.
async function blob(path) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, { credentials: API_URL ? 'include' : 'same-origin' });
  } catch {
    throw new Error('Cannot reach the server.');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

export const api = {
  blob,
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  patch: (path, body = {}) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
