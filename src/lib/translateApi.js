import api from './api';

const cache = new Map();

export async function translateText(text, from, to, { auth = true } = {}) {
  const safeText = typeof text === 'string' ? text.trim() : '';
  if (!safeText) return '';
  const key = `${from}:${to}:${safeText}`;
  if (cache.has(key)) return cache.get(key);

  const res = await api.post('/api/translate', { text: safeText, from, to }, { auth });
  if (cache.size >= 300) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, res.translated);
  return res.translated;
}

export async function fetchLanguages() {
  return api.get('/api/translate/languages');
}

export function clearTranslateCache() {
  cache.clear();
}
