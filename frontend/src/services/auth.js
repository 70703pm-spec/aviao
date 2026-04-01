const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5050').replace(/\/$/, '');
const SESSION_TOKEN_KEY = 'gods_eye_session_token';

function buildHeaders(extra = {}) {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Backend unreachable at ${API_BASE_URL}. Start the backend server or update REACT_APP_API_BASE_URL.`);
    }

    throw error;
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function getAuthApiBaseUrl() {
  return API_BASE_URL;
}

export function getStoredSessionToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY) || '';
}

export function clearStoredSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function loginWithCredentials({ username, password }) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password })
  });

  if (payload?.token) {
    localStorage.setItem(SESSION_TOKEN_KEY, payload.token);
  }

  return payload;
}

export async function restoreSession() {
  const token = getStoredSessionToken();
  if (!token) {
    return null;
  }

  try {
    return await request('/api/auth/session', {
      method: 'GET',
      headers: buildHeaders()
    });
  } catch (error) {
    clearStoredSessionToken();
    throw error;
  }
}

export async function logoutSession() {
  const token = getStoredSessionToken();
  clearStoredSessionToken();

  if (!token) {
    return;
  }

  try {
    await request('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    // Ignore remote logout failures; local session is already cleared.
  }
}
