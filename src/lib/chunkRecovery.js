const CHUNK_RELOAD_KEY = 'wn_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Unable to preload CSS for/i,
  /Failed to load module script/i,
];

export function isChunkLoadError(error) {
  if (!error) return false;
  const name = typeof error === 'object' ? String(error.name || '') : '';
  if (name === 'ChunkLoadError') return true;
  const message = typeof error === 'string'
    ? error
    : String(error.message || (typeof error.toString === 'function' ? error.toString() : ''));
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function reloadOnceForChunkError({
  storage = typeof window !== 'undefined' ? window.sessionStorage : null,
  reload = typeof window !== 'undefined' && window.location ? () => window.location.reload() : null,
  now = Date.now(),
  cooldownMs = CHUNK_RELOAD_COOLDOWN_MS,
  force = false,
} = {}) {
  if (typeof reload !== 'function') return false;
  if (!force) {
    if (!storage) return false;
    try {
      const lastRaw = storage.getItem(CHUNK_RELOAD_KEY);
      const last = Number(lastRaw || 0);
      if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) {
        return false;
      }
      storage.setItem(CHUNK_RELOAD_KEY, String(now));
    } catch {
      // Avoid infinite reload loops when storage is inaccessible.
      return false;
    }
  } else if (storage) {
    try {
      storage.setItem(CHUNK_RELOAD_KEY, String(now));
    } catch {
      // Ignore storage errors on explicit user retry.
    }
  }
  reload();
  return true;
}

export function withChunkRetry(importer, options = {}) {
  return () => Promise.resolve()
    .then(() => importer())
    .catch((error) => {
      if (isChunkLoadError(error) && reloadOnceForChunkError(options)) {
        return new Promise(() => {});
      }
      throw error;
    });
}

export function installVitePreloadRecovery(target = typeof window !== 'undefined' ? window : null) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const handler = (event) => {
    if (reloadOnceForChunkError()) {
      event?.preventDefault?.();
    }
  };
  target.addEventListener('vite:preloadError', handler);
  return () => target.removeEventListener('vite:preloadError', handler);
}
