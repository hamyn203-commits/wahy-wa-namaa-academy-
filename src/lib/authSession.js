import { API_BASE_URL } from '../config';

let accessToken = null;
let lastInjectedMobileToken = null;
let refreshPromise = null;

function getMobileWebViewToken() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem('wwn_mobile_token');
    if (!raw) return null;
    const trimmed = raw.trim();
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('wwn:mobile-token', (event) => {
    const nextToken = event?.detail?.token;
    if (typeof nextToken === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(nextToken.trim())) {
      const clean = nextToken.trim();
      lastInjectedMobileToken = clean;
      accessToken = clean;
    }
  });
}

export function getAccessToken() {
  const mobileToken = getMobileWebViewToken();
  if (mobileToken && mobileToken !== lastInjectedMobileToken) {
    lastInjectedMobileToken = mobileToken;
    accessToken = mobileToken;
    return mobileToken;
  }
  if (accessToken) return accessToken;
  if (mobileToken) {
    accessToken = mobileToken;
    return mobileToken;
  }
  return null;
}

export function setAccessToken(token) {
  accessToken = token || null;
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    // If embedded inside the native mobile app WebView and the host app pushed a rotated token,
    // adopt it immediately before attempting cookie-based web refresh.
    const latestMobileToken = getMobileWebViewToken();
    if (latestMobileToken && latestMobileToken !== accessToken) {
      lastInjectedMobileToken = latestMobileToken;
      accessToken = latestMobileToken;
      return latestMobileToken;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!response.ok) {
      clearAccessToken();
      throw new Error('Failed to refresh session');
    }

    const data = await response.json();
    if (!data.accessToken) {
      clearAccessToken();
      throw new Error('Refresh response did not include an access token');
    }

    setAccessToken(data.accessToken);
    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export function clearLegacyAuthStorage() {
  ['token', 'accessToken', 'refreshToken', 'user'].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage access failures.
    }
  });
}
