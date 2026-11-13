const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_BASE_URL ?? '';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://wahywanamaa.com';

/** مسار API نسبي في الإنتاج — يعمل على Vercel وأي دومين مربوط */
function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

/** رابط الموقع الحالي (للمشاركة والـ SEO) */
function siteUrl(path = '') {
  const base = typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  const p = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${base}${p}`;
}

export { API_BASE_URL, SITE_URL, apiUrl, siteUrl };
