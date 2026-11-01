import {
  DEFAULT_LOCALE,
  getLocaleFromPath,
  isValidLocale,
  localizedPath,
  stripLocale,
} from './locale.js';

const INTERNAL_BASE_ORIGIN = 'https://wahy.local';

export const DASHBOARD_ROUTE_BY_ROLE = Object.freeze({
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  guardian: '/guardian/dashboard',
  admin: '/admin',
});

export function normalizeNavigationLocale(locale) {
  return isValidLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function dashboardPathForRole(role, locale = DEFAULT_LOCALE) {
  const activeLocale = normalizeNavigationLocale(locale);
  const route = DASHBOARD_ROUTE_BY_ROLE[role];

  return route
    ? localizedPath(route, activeLocale)
    : localizedPath('/', activeLocale);
}

/**
 * Enrollment / auth funnel pages. Global "Start your journey" CTAs are hidden
 * here because they would only link back to the step the visitor is already on.
 */
const ONBOARDING_PATH = /^\/(?:[a-z]{2}\/)?(?:start|register|login|forgot-password|reset-password)(?:\/|$)/;

export function isOnboardingPath(pathname = '') {
  return ONBOARDING_PATH.test(String(pathname));
}

export function loginPathForLocale(locale = DEFAULT_LOCALE) {
  return localizedPath('/login', normalizeNavigationLocale(locale));
}

export function homePathForLocale(locale = DEFAULT_LOCALE) {
  return localizedPath('/', normalizeNavigationLocale(locale));
}

export function isSafeInternalRedirect(value) {
  if (typeof value !== 'string') return false;

  const target = value.trim();
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return false;
  }

  try {
    const parsed = new URL(target, INTERNAL_BASE_ORIGIN);
    return parsed.origin === INTERNAL_BASE_ORIGIN && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function localizeInternalHref(value, locale = DEFAULT_LOCALE) {
  if (typeof value !== 'string') return value;

  const target = value.trim();
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return target;
  }

  try {
    const parsed = new URL(target, INTERNAL_BASE_ORIGIN);
    if (parsed.origin !== INTERNAL_BASE_ORIGIN) return target;

    const activeLocale = normalizeNavigationLocale(locale);
    const pathname = getLocaleFromPath(parsed.pathname)
      ? parsed.pathname
      : localizedPath(parsed.pathname || '/', activeLocale);

    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return target;
  }
}

export function postAuthDestination({
  redirect,
  role,
  locale = DEFAULT_LOCALE,
} = {}) {
  const activeLocale = normalizeNavigationLocale(locale);

  if (!isSafeInternalRedirect(redirect)) {
    return dashboardPathForRole(role, activeLocale);
  }

  const destination = localizeInternalHref(redirect, activeLocale);
  const pathname = stripLocale(new URL(destination, INTERNAL_BASE_ORIGIN).pathname);

  // A deep link from a previous account must not take this user to another
  // role's workspace. ProtectedRoute also enforces this at the route level.
  const restrictedRole =
    /^\/student(?:\/|$)/.test(pathname) ? 'student' :
    /^\/guardian(?:\/|$)/.test(pathname) ? 'guardian' :
    /^\/teacher(?:\/dashboard(?:\/|$)|$)/.test(pathname) ? 'teacher' :
    /^\/admin(?:\/|$)/.test(pathname) ? 'admin' :
    null;

  return restrictedRole && restrictedRole !== role
    ? dashboardPathForRole(role, activeLocale)
    : destination;
}