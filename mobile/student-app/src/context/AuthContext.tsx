import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, trackMobileAppVisit } from '../lib/api';
import { secureStorage } from '../lib/secureStorage';
import { AcademyUser } from '../types/academy';
import { useI18n } from '../i18n/I18nProvider';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'student' | 'guardian';
}

interface AuthContextValue {
  user: AcademyUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const ALLOWED_LEARNER_ROLES = new Set(['student', 'guardian']);
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<AcademyUser | null>(null);
  const [loading, setLoading] = useState(true);

  const assertLearnerRole = useCallback(
    (candidate: AcademyUser | null | undefined) => {
      if (!candidate) return;
      if (ALLOWED_LEARNER_ROLES.has(candidate.role)) return;
      const msg = candidate.role === 'teacher' ? t.auth.wrongAppTeacher : t.auth.wrongAppAdmin;
      throw new ApiError(msg, 403, { code: 'WRONG_APP_AUDIENCE' });
    },
    [t.auth.wrongAppAdmin, t.auth.wrongAppTeacher]
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
      const response = await api.get<{ user?: AcademyUser } & AcademyUser>('/api/auth/me', { auth: true });
      const resolved = response.user ?? response;
      assertLearnerRole(resolved);
      setUser(resolved);
      await secureStorage.setCachedUser(resolved as unknown as Record<string, unknown>);
    } catch (error) {
      // Only clear session on explicit auth/role rejection.
      // Never log the student out on transient network/offline errors or server hiccups!
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearSession();
      }
    }
  }, [assertLearnerRole, clearSession]);

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUser(null);
    });
    let mounted = true;
    (async () => {
      try {
        // Hydrate cached user immediately so OTA reloads & app restarts never flash the login screen.
        const [cachedUser, storedAccess, storedRefresh] = await Promise.all([
          secureStorage.getCachedUser<AcademyUser>(),
          secureStorage.getAccessToken(),
          secureStorage.getRefreshToken(),
        ]);
        if (mounted && cachedUser && (storedAccess || storedRefresh)) {
          if (storedAccess) api.setAccessToken(storedAccess);
          setUser(cachedUser);
          setLoading(false);
        }
        await refreshUser();
        void trackMobileAppVisit('/mobile/student-app');
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
    async (email: string, password: string) => {
      const response = await api.post<{
        accessToken?: string;
        refreshToken?: string;
        user?: AcademyUser;
      }>('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const loggedUser = response.user;
      assertLearnerRole(loggedUser);

      if (response.accessToken) {
        api.setAccessToken(response.accessToken);
        await secureStorage.setAccessToken(response.accessToken);
      }
      if (response.refreshToken) {
        await secureStorage.setRefreshToken(response.refreshToken);
      }
      if (loggedUser) {
        await secureStorage.setCachedUser(loggedUser as unknown as Record<string, unknown>);
      }
      setUser(loggedUser ?? null);
    },
    [assertLearnerRole]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await api.post<{
        accessToken?: string;
        refreshToken?: string;
        user?: AcademyUser;
      }>('/api/auth/register', {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        phone: input.phone?.trim() || undefined,
        role: input.role,
      });

      const createdUser = response.user;
      assertLearnerRole(createdUser);

      if (response.accessToken) {
        api.setAccessToken(response.accessToken);
        await secureStorage.setAccessToken(response.accessToken);
      }
      if (response.refreshToken) {
        await secureStorage.setRefreshToken(response.refreshToken);
      }
      if (createdUser) {
        await secureStorage.setCachedUser(createdUser as unknown as Record<string, unknown>);
      }
      setUser(createdUser ?? null);
    },
    [assertLearnerRole]
  );

  const logout = useCallback(async () => {
    try {
      const storedRefresh = await secureStorage.getRefreshToken();
      await api.post(
        '/api/auth/logout',
        storedRefresh ? { refreshToken: storedRefresh } : {},
        { auth: true }
      );
    } catch {
      // Clear local credentials even if offline.
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      refreshUser,
      logout,
    }),
    [user, loading, login, register, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
