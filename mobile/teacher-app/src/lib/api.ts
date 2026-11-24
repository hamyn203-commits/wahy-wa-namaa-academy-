import * as FileSystem from 'expo-file-system';
import { API_BASE_URL, APP_AUDIENCE, APP_VERSION, CLIENT_PLATFORM, SITE_URL } from './config';
import { secureStorage } from './secureStorage';

export class ApiError extends Error {
  status: number;
  code?: string;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof data.code === 'string' ? data.code : undefined;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  _retried?: boolean;
}

class TeacherApiClient {
  private accessToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  private refreshInFlight: Promise<string | null> | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.onUnauthorized = handler;
  }

  async hydrateToken(): Promise<string | null> {
    if (this.accessToken) return this.accessToken;
    const stored = await secureStorage.getAccessToken();
    if (stored) {
      this.accessToken = stored;
      return stored;
    }
    const storedRefresh = await secureStorage.getRefreshToken();
    if (storedRefresh) {
      return this.refreshAccessToken();
    }
    return null;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const runner = (async (): Promise<string | null> => {
      const storedRefresh = await secureStorage.getRefreshToken();
      if (!storedRefresh) {
        return null;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'omit',
          headers: this.buildHeaders(null, false, {}, true),
          body: JSON.stringify({ refreshToken: storedRefresh }),
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (response.ok && typeof data.accessToken === 'string' && data.accessToken) {
          this.accessToken = data.accessToken;
          await secureStorage.setAccessToken(data.accessToken);
          if (typeof data.refreshToken === 'string' && data.refreshToken) {
            await secureStorage.setRefreshToken(data.refreshToken);
          }
          return data.accessToken;
        }

        if (response.status === 401 || response.status === 403) {
          this.accessToken = null;
          await secureStorage.clearAuthTokens();
          this.onUnauthorized?.();
          return null;
        }

        throw new ApiError(
          (typeof data.error === 'string' && data.error) || `HTTP ${response.status}`,
          response.status,
          data
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError('انتهت مهلة تجديد الجلسة — تحقق من الإنترنت وحاول مجدداً.', 408, { code: 'TIMEOUT' });
        }
        throw new ApiError('تعذر الاتصال بالخادم — تحقق من اتصالك بالإنترنت.', 0, { code: 'NETWORK_ERROR' });
      } finally {
        clearTimeout(timer);
      }
    })();

    this.refreshInFlight = runner;
    try {
      return await runner;
    } finally {
      if (this.refreshInFlight === runner) {
        this.refreshInFlight = null;
      }
    }
  }

  private buildHeaders(
    token: string | null,
    auth: boolean,
    extra: Record<string, string> = {},
    jsonBody = false
  ): Record<string, string> {
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      Origin: SITE_URL,
      'X-Client-Platform': CLIENT_PLATFORM,
      'X-App-Audience': APP_AUDIENCE,
      'X-App-Version': APP_VERSION,
      ...extra,
    };

    if (jsonBody) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    if (auth && token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
    return requestHeaders;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new ApiError('Invalid API path', 400, { code: 'INVALID_API_PATH' });
    }

    const {
      method = 'GET',
      body,
      auth = false,
      headers = {},
      timeoutMs = 35000,
      _retried = false,
    } = options;

    const token = auth ? await this.hydrateToken() : null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const requestHeaders = this.buildHeaders(token, auth, headers, body !== undefined);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        credentials: 'omit',
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (auth && response.status === 401) {
        if (!_retried) {
          const freshToken = await this.refreshAccessToken();
          if (freshToken) {
            return this.request<T>(path, { ...options, _retried: true });
          }
        }
        this.accessToken = null;
        await secureStorage.clearAuthTokens();
        this.onUnauthorized?.();
      }

      if (!response.ok) {
        const message =
          (typeof data.error === 'string' && data.error)
          || (typeof data.message === 'string' && data.message)
          || `HTTP ${response.status}`;
        throw new ApiError(message, response.status, data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('انتهت مهلة الاتصال بالخادم — تحقق من الإنترنت وحاول مجدداً.', 408, { code: 'TIMEOUT' });
      }
      throw new ApiError('تعذر الاتصال بالخادم — تحقق من اتصالك بالإنترنت.', 0, { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
    }
  }

  async uploadMultipart<T = unknown>(
    path: string,
    formData: FormData,
    options: { auth?: boolean; timeoutMs?: number; _retried?: boolean } = {}
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new ApiError('Invalid API path', 400, { code: 'INVALID_API_PATH' });
    }
    const { auth = true, timeoutMs = 45000, _retried = false } = options;
    const token = auth ? await this.hydrateToken() : null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const requestHeaders = this.buildHeaders(token, auth, {}, false);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        credentials: 'omit',
        headers: requestHeaders,
        body: formData,
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (auth && response.status === 401) {
        if (!_retried) {
          const freshToken = await this.refreshAccessToken();
          if (freshToken) {
            return this.uploadMultipart<T>(path, formData, { ...options, _retried: true });
          }
        }
        this.accessToken = null;
        await secureStorage.clearAuthTokens();
        this.onUnauthorized?.();
      }

      if (!response.ok) {
        const message =
          (typeof data.error === 'string' && data.error)
          || (typeof data.message === 'string' && data.message)
          || `HTTP ${response.status}`;
        throw new ApiError(message, response.status, data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('انتهت مهلة رفع الملف — حاول مجدداً.', 408, { code: 'TIMEOUT' });
      }
      throw new ApiError('تعذر رفع الملف — تحقق من اتصالك بالإنترنت.', 0, { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Downloads an authenticated private audio/media file to local cache so expo-av can play it reliably.
   */
  async downloadAuthenticatedFile(path: string, filename: string): Promise<string> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new ApiError('Invalid API path', 400, { code: 'INVALID_API_PATH' });
    }
    const token = await this.hydrateToken();
    if (!token) {
      throw new ApiError('يرجى تسجيل الدخول مجدداً', 401, { code: 'UNAUTHORIZED' });
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localUri = `${FileSystem.cacheDirectory || ''}${Date.now()}-${safeName}`;
    const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, localUri, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: SITE_URL,
      },
    });
    if (result.status < 200 || result.status >= 300) {
      throw new ApiError('تعذر تحميل الملف الصوتي', result.status);
    }
    return result.uri;
  }

  get<T = unknown>(path: string, opts?: Omit<RequestOptions, 'method' | 'body' | '_retried'>) {
    return this.request<T>(path, { ...opts, method: 'GET' });
  }

  post<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body' | '_retried'>) {
    return this.request<T>(path, { ...opts, method: 'POST', body });
  }

  put<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body' | '_retried'>) {
    return this.request<T>(path, { ...opts, method: 'PUT', body });
  }

  patch<T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body' | '_retried'>) {
    return this.request<T>(path, { ...opts, method: 'PATCH', body });
  }

  delete<T = unknown>(path: string, opts?: Omit<RequestOptions, 'method' | 'body' | '_retried'>) {
    return this.request<T>(path, { ...opts, method: 'DELETE' });
  }
}

export const api = new TeacherApiClient();

export async function trackMobileAppVisit(screenPath: string): Promise<void> {
  try {
    await api.post('/api/analytics/visit', {
      path: screenPath,
      platform: CLIENT_PLATFORM === 'web' ? 'android' : CLIENT_PLATFORM,
      deviceType: 'mobile',
      appVersion: APP_VERSION,
      source: 'mobile_app',
    });
  } catch {
    // Never interrupt UX for non-critical telemetry.
  }
}
