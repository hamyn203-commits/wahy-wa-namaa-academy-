import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, trackMobileAppVisit } from '../lib/api';
import { secureStorage } from '../lib/secureStorage';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { TeacherUser } from '../types/teacher';
import { useI18n } from '../i18n/I18nProvider';

interface AuthContextValue {
  user: TeacherUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isApprovedTeacher: boolean;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [loading, setLoading] = useState(true);

  const assertTeacherRole = useCallback(
    (candidate: TeacherUser | null | undefined) => {
      if (!candidate) return;
      if (candidate.role === 'teacher') return;
      const msg = candidate.role === 'admin' ? t.auth.wrongAppAdmin : t.auth.wrongAppLearner;
      throw new ApiError(msg, 403, { code: 'WRONG_APP_AUDIENCE' });
    },
    [t.auth.wrongAppAdmin, t.auth.wrongAppLearner]
  );

  const clearSession = useCallback(async () => {
    api.setAccessToken(null);
    await secureStorage.clearAuthTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const [storedAccess, storedRefresh] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getRefreshToken(),
    ]);

    if (!storedAccess && !storedRefresh) {
      setUser(null);
      return;
    }

    if (storedAccess) {
      api.setAccessToken(storedAccess);
    }

    try {
      const response = await api.get<{ user?: TeacherUser } & TeacherUser>('/api/auth/me', { auth: true });
      const resolved = response.user ?? response;
      assertTeacherRole(resolved);
      setUser(resolved);
      await secureStorage.setCachedUser(resolved as unknown as Record<string, unknown>);
      void registerForPushNotificationsAsync().catch(() => {});
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearSession();
      }
    }
  }, [assertTeacherRole, clearSession]);

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUser(null);
    });
    let mounted = true;
    (async () => {
      try {
        const [cachedUser, storedAccess, storedRefresh] = await Promise.all([
          secureStorage.getCachedUser<TeacherUser>(),
          secureStorage.getAccessToken(),
          secureStorage.getRefreshToken(),
        ]);
        if (mounted && cachedUser && cachedUser.role === 'teacher' && (storedAccess || storedRefresh)) {
          if (storedAccess) api.setAccessToken(storedAccess);
          setUser(cachedUser);
          setLoading(false);
        }
        await refreshUser();
        void trackMobileAppVisit('/mobile/teacher-app');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      api.setUnauthorizedHandler(null);
    };
  }, [refreshUser]);

  const login = useCallback(
    async (rawIdentifier: string, rawPassword: string) => {
      const stripBidi = (s: string) => s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
      const toLatinDigits = (s: string) =>
        s
          .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
          .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

      const cleanedRaw = toLatinDigits(stripBidi(rawIdentifier)).trim();
      const identifier = cleanedRaw.includes('@')
        ? cleanedRaw.toLowerCase()
        : cleanedRaw.replace(/\s+/g, '');
      const password = stripBidi(rawPassword);

      let response: {
        accessToken?: string;
        refreshToken?: string;
        user?: TeacherUser;
      };
      try {
        response = await api.post(
          '/api/auth/login',
          {
            identifier,
            email: identifier,
            password,
          },
          { timeoutMs: 45000 }
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && /invalid (email|credentials)/i.test(err.message)) {
          throw new ApiError(t.auth.invalidCredentials, 401, err.data);
        }
        throw err;
      }

      const loggedUser = response.user;
      assertTeacherRole(loggedUser);

      if (!response.accessToken) {
        throw new ApiError('تعذر استلام رمز الدخول.', 500);
      }

      api.setAccessToken(response.accessToken);
      await secureStorage.setAccessToken(response.accessToken);
      if (response.refreshToken) {
        await secureStorage.setRefreshToken(response.refreshToken);
      }

      if (loggedUser && typeof loggedUser.teacherApproved === 'boolean') {
        setUser(loggedUser);
        await secureStorage.setCachedUser(loggedUser as unknown as Record<string, unknown>);
      } else {
        try {
          const me = await api.get<{ user?: TeacherUser } & TeacherUser>('/api/auth/me', { auth: true });
          const resolved = me.user ?? me;
          assertTeacherRole(resolved);
          setUser(resolved);
          await secureStorage.setCachedUser(resolved as unknown as Record<string, unknown>);
        } catch {
          if (loggedUser) {
            setUser(loggedUser);
            await secureStorage.setCachedUser(loggedUser as unknown as Record<string, unknown>);
          }
        }
      }
      void registerForPushNotificationsAsync().catch(() => {});
    },
    [assertTeacherRole, t.auth.invalidCredentials]
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      await api.post('/api/auth/logout', refreshToken ? { refreshToken } : {}, { auth: true });
    } catch {
      // Clear local session regardless of network availability.
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isApprovedTeacher: Boolean(user && user.role === 'teacher' && user.teacherApproved === true),
      login,
      refreshUser,
      logout,
    }),
    [user, loading, login, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
