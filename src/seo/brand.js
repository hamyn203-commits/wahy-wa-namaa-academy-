/** هوية الأكاديمية الرسمية + بيانات SEO العالمية — وَحْيٌ وَنَمَاء */
import { ALTERNATE_NAMES, DEFAULT_SITE_URL, LOCALE_BRAND, OG_LOCALE, RTL_LOCALES, SEO_LOCALES } from './staticRoutes.js';

const envSiteUrl = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_SITE_URL
  : '';

export const SITE_URL = (envSiteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/hero-wahy-namaa.jpg`;
export const LOGO_URL = `${SITE_URL}/assets/logo.png`;

export function toAbsoluteUrl(pathOrUrl = '') {
  const value = String(pathOrUrl || '').trim();
  if (!value) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export { SEO_LOCALES, RTL_LOCALES, OG_LOCALE, ALTERNATE_NAMES, LOCALE_BRAND };

export const ALTERNATE_SLOGANS = [
  'نتعلم القرآن، نحفظه، وننمو به.',
  'نتعلم القران نحفظه وننمو به',
  'Learn the Quran. Memorize it. Grow through it.',
  'Quranic Learning. Lifelong Growth.',
  'Apprendre le Coran, le mémoriser, et grandir avec lui.',
  'Lerne den Koran, bewahre ihn, und wachse durch ihn.',
  'Kuran\'ı öğreniyoruz, ezberliyoruz ve onunla büyüyoruz.',
  'قرآن سیکھیں، حفظ کریں اور اس کے ذریعے نمو پائیں۔',
  'Pelajari Al-Quran, hafalkan, dan bertumbuh dengannya.',
  'Pelajari Al-Quran, hafalkannya, dan berkembang melaluinya.',
  'فێری قورئان دەبین، لەبەری دەکەین، و گەشەی پێ دەکەین.',
];

export function localePath(locale, path = '/') {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}/${locale}${clean}`;
}

export function hreflangLinks(path = '/') {
  const links = SEO_LOCALES.map((loc) => ({
    rel: 'alternate',
    hreflang: loc,
    href: localePath(loc, path),
  }));
  links.push({ rel: 'alternate', hreflang: 'x-default', href: localePath('ar', path) });
  return links;
}
