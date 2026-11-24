import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'wn_teacher_access_token';
const REFRESH_TOKEN_KEY = 'wn_teacher_refresh_token';
const USER_CACHE_KEY = 'wn_teacher_user_cache';
const LOCALE_KEY = 'wn_teacher_locale';

const memoryFallback = new Map<string, string>();

async function safeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryFallback.get(key) ?? null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    // Memory fallback preserves active session if keystore is temporarily locked.
  }
}

async function safeDelete(key: string): Promise<void> {
  memoryFallback.delete(key);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore storage cleanup failure.
  }
}

function compactUserSnapshot<T extends Record<string, unknown>>(user: T): string {
  const safe = {
    _id: user._id,
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    teacherApproved: user.teacherApproved,
    teacherApprovalStatus: user.teacherApprovalStatus,
    teacherReviewNote: user.teacherReviewNote,
    teacherRequestedChanges: user.teacherRequestedChanges,
    onboarding: user.onboarding,
    avatar: typeof user.avatar === 'string' && user.avatar.length <= 320 ? user.avatar : undefined,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
  };
  return JSON.stringify(safe);
}

export const secureStorage = {
  getAccessToken: () => safeGet(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => safeSet(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => safeGet(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => safeSet(REFRESH_TOKEN_KEY, token),
  getCachedUser: async <T = Record<string, unknown>>(): Promise<T | null> => {
    const raw = await safeGet(USER_CACHE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as T) : null;
    } catch {
      return null;
    }
  },
  setCachedUser: async <T extends Record<string, unknown>>(user: T | null): Promise<void> => {
    if (!user) {
      await safeDelete(USER_CACHE_KEY);
      return;
    }
    try {
      await safeSet(USER_CACHE_KEY, compactUserSnapshot(user));
    } catch {
      // Non-critical cache failure.
    }
  },
  clearAuthTokens: async () => {
    await Promise.all([
      safeDelete(ACCESS_TOKEN_KEY),
      safeDelete(REFRESH_TOKEN_KEY),
      safeDelete(USER_CACHE_KEY),
    ]);
  },
  getLocale: () => safeGet(LOCALE_KEY),
  setLocale: (locale: string) => safeSet(LOCALE_KEY, locale),
};
