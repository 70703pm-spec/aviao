function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3003';
  }

  return `${window.location.protocol}//${window.location.hostname}:3003`;
}

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, '');
const SESSION_TOKEN_KEY = 'gods_eye_session_token';
const DEFAULT_AUTH_PROVIDERS = {
  google: { enabled: false, label: 'Google' },
  github: { enabled: false, label: 'GitHub' }
};

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

export function setStoredSessionToken(token) {
  if (!token) {
    clearStoredSessionToken();
    return;
  }

  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function consumeOAuthRedirectResult() {
  if (typeof window === 'undefined') {
    return { token: '', error: '' };
  }

  const currentUrl = new URL(window.location.href);
  const token = currentUrl.searchParams.get('authToken') || '';
  const error = currentUrl.searchParams.get('authError') || '';

  if (!token && !error) {
    return { token: '', error: '' };
  }

  currentUrl.searchParams.delete('authToken');
  currentUrl.searchParams.delete('authError');

  const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState({}, document.title, nextUrl);

  return { token, error };
}

export async function fetchAuthProviders() {
  const payload = await request('/api/auth/providers', {
    method: 'GET',
    headers: buildHeaders()
  });

  return {
    ...DEFAULT_AUTH_PROVIDERS,
    ...(payload || {})
  };
}

export async function loginWithCredentials({ identifier, password }) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ identifier, password })
  });

  if (payload?.token) {
    setStoredSessionToken(payload.token);
  }

  return payload;
}

export async function registerWithCredentials({ username, displayName, email, password }) {
  const payload = await request('/api/auth/register', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, displayName, email, password })
  });

  if (payload?.token) {
    setStoredSessionToken(payload.token);
  }

  return payload;
}

export function beginOAuthSignIn(provider, mode = 'signin') {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(`${API_BASE_URL}/api/auth/oauth/${encodeURIComponent(provider)}`);
  url.searchParams.set('mode', mode);
  window.location.assign(url.toString());
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
