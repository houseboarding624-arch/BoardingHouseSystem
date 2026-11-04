// Small fetch wrapper. The session lives in an httpOnly cookie set by the API.
// VITE_API_URL is empty when the API serves the app (or in local dev through the Vite proxy),
// and the backend's https URL when the app is hosted separately (GitHub Pages).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    credentials: API_URL ? 'include' : 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || 'Request failed. Please try again.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  patch: (path, body = {}) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
