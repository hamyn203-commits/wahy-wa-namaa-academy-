import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.cacheDirectory || ''}wn-teacher-swr/`;

async function ensureDir(): Promise<void> {
  if (!FileSystem.cacheDirectory) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR).catch(() => null);
  if (!info?.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
  }
}

function keyPath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${CACHE_DIR}${safe}.json`;
}

/**
 * Lightweight Stale-While-Revalidate cache for instant 0ms screen hydration.
 * Never throws on disk errors so UI always degrades gracefully.
 */
export const swrCache = {
  async get<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<T | null> {
    if (!FileSystem.cacheDirectory) return null;
    try {
      const path = keyPath(key);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
      if (!parsed || typeof parsed.savedAt !== 'number') return null;
      if (Date.now() - parsed.savedAt > maxAgeMs) return null;
      return parsed.data ?? null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    if (!FileSystem.cacheDirectory) return;
    try {
      await ensureDir();
      await FileSystem.writeAsStringAsync(
        keyPath(key),
        JSON.stringify({ savedAt: Date.now(), data })
      );
    } catch {
      // Non-critical cache failure
    }
  },

  async clear(key: string): Promise<void> {
    if (!FileSystem.cacheDirectory) return;
    try {
      await FileSystem.deleteAsync(keyPath(key), { idempotent: true });
    } catch {
      // Ignore cleanup failure
    }
  },
};
