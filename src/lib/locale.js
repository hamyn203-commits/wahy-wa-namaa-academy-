export const LOCALES = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];
export const DEFAULT_LOCALE = 'ar';
export const RTL_LOCALES = ['ar', 'ur', 'ku'];
export const INTL_LOCALES = {
  ar: 'ar-EG',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  tr: 'tr-TR',
  ur: 'ur-PK',
  id: 'id-ID',
  ms: 'ms-MY',
  ku: 'ckb-IQ',
};

export function resolveIntlLocale(locale = DEFAULT_LOCALE) {
  const raw = String(locale || DEFAULT_LOCALE).trim();
  if (!raw) return INTL_LOCALES[DEFAULT_LOCALE];
  const lower = raw.toLowerCase();
  if (INTL_LOCALES[lower]) return INTL_LOCALES[lower];
  if (raw.includes('-')) {
    const base = lower.split('-')[0];
    if (INTL_LOCALES[base] || base === 'ckb') return raw;
  }
  return INTL_LOCALES[DEFAULT_LOCALE];
}

export function isValidLocale(locale) {
  return LOCALES.includes(locale);
}

export function getLocaleFromPath(pathname) {
  const seg = pathname.split('/').filter(Boolean)[0];
  return isValidLocale(seg) ? seg : null;
}

export function stripLocale(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && isValidLocale(parts[0])) parts.shift();
  return '/' + parts.join('/');
}

export function localizedPath(path, locale = DEFAULT_LOCALE) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return `/${locale}`;
  return `/${locale}${clean}`;
}

export function localizedLocation(pathname, locale = DEFAULT_LOCALE, search = '', hash = '') {
  const basePath = stripLocale(pathname || '/');
  const localized = localizedPath(basePath || '/', locale);
  return `${localized}${search || ''}${hash || ''}`;
}

export function detectBrowserLocale() {
  const lang = (navigator.language || 'ar').split('-')[0];
  return isValidLocale(lang) ? lang : DEFAULT_LOCALE;
}