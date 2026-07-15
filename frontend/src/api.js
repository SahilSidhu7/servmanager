// Shared API + auth helpers. All paths are relative — the Vite dev
// server proxies /api and /ws to the backend (see vite.config.js),
// and in production the backend serves the frontend itself.

export function getAuth() {
  return {
    token: localStorage.getItem('sm_token') || '',
    role: localStorage.getItem('sm_role') || '',
  };
}

export function setAuth(token, role) {
  localStorage.setItem('sm_token', token);
  localStorage.setItem('sm_role', role);
}

export function clearAuth() {
  localStorage.removeItem('sm_token');
  localStorage.removeItem('sm_role');
}

export function wsUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const { token } = getAuth();
  const sep = path.includes('?') ? '&' : '?';
  return `${protocol}//${window.location.host}${path}${sep}token=${encodeURIComponent(token)}`;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiCall(endpoint, method = 'GET', body = null) {
  const { token } = getAuth();
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(endpoint, options);
  if (!res.ok) {
    let detail = 'Request failed';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch { /* non-JSON error body */ }
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || 'Login failed', res.status);
  setAuth(data.token, data.role || 'admin');
  return data;
}

export async function remoteLogin(pin) {
  const res = await fetch('/api/remote/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || 'Invalid PIN', res.status);
  setAuth(data.token, data.role || 'remote');
  return data;
}
