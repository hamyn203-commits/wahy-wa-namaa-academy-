import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { API_BASE_URL } from '../config';
import api from '../lib/api';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
  clearLegacyAuthStorage,
} from '../lib/authSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    clearAccessToken();
    clearLegacyAuthStorage();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clear client state even when the network is unavailable.
    } finally {
      clearSessionState();
    }
  }, [clearSessionState]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Remove tokens left by older versions. Authentication now restores
      // exclusively from the HttpOnly refresh cookie.
      clearLegacyAuthStorage();

      try {
        await refreshAccessToken();
        const data = await api.get('/api/auth/me?fresh=' + Date.now(), { auth: true });

        if (!cancelled) {
          setUser(data.user || null);
          setIsAuthenticated(Boolean(data.user));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          clearAccessToken();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAuthenticatedSession = useCallback((data) => {
    if (!data?.user || !data?.accessToken) {
      throw new Error('Authentication response is incomplete');
    }

    setAccessToken(data.accessToken);
    setUser(data.user);
    setIsAuthenticated(true);
    clearLegacyAuthStorage();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
          code: data.code || null,
          applicationStatus: data.applicationStatus || null,
        };
      }

      saveAuthenticatedSession(data);
      return { success: true, user: data.user };
    } catch (error) {
      const isNetworkError = error instanceof TypeError || /failed to fetch|networkerror/i.test(String(error?.message || ''));
      return {
        success: false,
        error: isNetworkError
          ? 'تعذر الاتصال بالخادم حالياً. تأكد من تشغيل الخادم أو تحديث الصفحة ثم حاول مرة أخرى.'
          : error.message,
        code: isNetworkError ? 'NETWORK_ERROR' : null,
        applicationStatus: null,
      };
    }
  }, [saveAuthenticatedSession]);

  const googleLogin = useCallback(async (credential, role = 'student', context = 'signin', enrollmentSection) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, role, context, ...(context === 'signup' && role === 'student' && enrollmentSection ? { enrollmentSection } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed');
      saveAuthenticatedSession(data);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [saveAuthenticatedSession]);

  const register = useCallback(async (userData) => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
    } catch (error) {
      // fetch only rejects on network failure (offline, DNS, server unreachable).
      return { success: false, status: 0, code: 'NETWORK_ERROR', error: error.message };
    }

    // Proxies and rate limiters may answer with HTML or an empty body.
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        code: data.code || null,
        error: data.error || 'Registration failed',
      };
    }

    try {
      saveAuthenticatedSession(data);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, status: response.status, code: 'SESSION_SAVE_FAILED', error: error.message };
    }
  }, [saveAuthenticatedSession]);

  const refreshUser = useCallback(async () => {
    const data = await api.get('/api/auth/me?fresh=' + Date.now(), { auth: true });
    setUser(data.user);
    return data.user;
  }, []);

  const saveOnboarding = useCallback(async (updates) => {
    const data = await api.patch('/api/auth/onboarding', updates, { auth: true });
    if (!data?.user) throw new Error('لم يتم تأكيد حفظ البيانات');
    setUser(data.user);
    return data.user;
  }, []);

  const saveLearningTrack = useCallback(async (track) => {
    const data = await api.patch('/api/auth/learning-track', { track }, { auth: true });
    if (!data?.user) throw new Error('لم يتم تأكيد حفظ المسار');
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  }, []);

  const updateProfile = useCallback(async (updates) => {
    try {
      const data = await api.patch('/api/auth/me', updates, { auth: true });
      setUser(data.user);
      setIsAuthenticated(Boolean(data.user));
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword }, { auth: true });
      clearSessionState();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [clearSessionState]);

  const forgotPassword = useCallback(async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const makeRequest = async (token) => fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    let token = getAccessToken();
    if (!token) token = await refreshAccessToken();

    let response = await makeRequest(token);

    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));

      if (data.code === 'TOKEN_EXPIRED') {
        try {
          token = await refreshAccessToken();
          response = await makeRequest(token);
          return response;
        } catch {
          await logout();
          throw new Error('Session expired');
        }
      }

      await logout();
      throw new Error('Session expired');
    }

    return response;
  }, [logout]);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    accessToken: getAccessToken(),
    login,
    googleLogin,
    register,
    logout,
    updateProfile,
    refreshUser,
    saveOnboarding,
    saveLearningTrack,
    changePassword,
    forgotPassword,
    authFetch,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
