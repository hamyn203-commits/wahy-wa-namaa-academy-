import { API_BASE_URL } from '../config';
import { getAccessToken, refreshAccessToken, clearAccessToken } from './authSession';

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = data?.code;
    this.data = data;
  }
}

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getToken() {
    return getAccessToken();
  }

  async request(path, options = {}) {
    const { auth = false, json = true, body, headers = {}, ...rest } = options;
    const reqHeaders = { ...headers };

    if (json && body && !(body instanceof FormData)) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    let token = auth ? this.getToken() : null;
    if (auth && !token) {
      try {
        token = await refreshAccessToken();
      } catch {
        token = null;
      }
    }

    const makeRequest = async (activeToken) => {
      const activeHeaders = { ...reqHeaders };
      if (auth && activeToken) activeHeaders.Authorization = `Bearer ${activeToken}`;

      return fetch(`${this.baseUrl}${path}`, {
        credentials: 'include',
        ...rest,
        cache: auth ? 'no-store' : (rest.cache || 'default'),
        headers: activeHeaders,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
    };

    let response;
    try {
      response = await makeRequest(token);
    } catch (error) {
      if (rest.signal?.aborted || error?.name === 'AbortError') {
        throw error;
      }
      if ((!rest.method || rest.method === 'GET') && error instanceof TypeError) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        response = await makeRequest(token);
      } else {
        throw error;
      }
    }
    let data = json ? await response.clone().json().catch(() => ({})) : null;

    if (auth && response.status === 401 && data?.code === 'TOKEN_EXPIRED') {
      try {
        token = await refreshAccessToken();
        response = await makeRequest(token);
        data = json ? await response.clone().json().catch(() => ({})) : null;
      } catch {
        clearAccessToken();
      }
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || data?.message || `HTTP ${response.status}`,
        response.status,
        data || {}
      );
    }

    if (typeof window !== 'undefined' && /^\/api\/notifications(?:\/|\?|$)/.test(path) && ['PUT', 'DELETE'].includes(rest.method)) {
      window.dispatchEvent(new Event('wn:notifications-changed'));
    }
    return json ? data : response;
  }

  get(path, opts) { return this.request(path, { ...opts, method: 'GET' }); }
  post(path, body, opts) { return this.request(path, { ...opts, method: 'POST', body }); }
  put(path, body, opts) { return this.request(path, { ...opts, method: 'PUT', body }); }
  patch(path, body, opts) { return this.request(path, { ...opts, method: 'PATCH', body }); }
  delete(path, opts) { return this.request(path, { ...opts, method: 'DELETE' }); }
}

export const api = new ApiClient();
export default api;

