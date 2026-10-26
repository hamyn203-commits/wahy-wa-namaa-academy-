const prefetchedRoutes = new Set();

const ROUTE_LOADERS = {
  '/': () => import('../pages/NewLandingPage'),
  '/courses': () => import('../pages/Courses'),
  '/teachers': () => import('../pages/Teachers'),
  '/plans': () => import('../pages/Plans'),
  '/start': () => import('../pages/Start'),
  '/free-trial': () => import('../pages/FreeTrial/FreeTrial'),
  '/about': () => import('../pages/About'),
  '/contact': () => import('../pages/Contact'),
  '/faq': () => import('../pages/FAQ'),
  '/blog': () => import('../pages/Blog'),
  '/library': () => import('../pages/Library'),
  '/women': () => import('../pages/Women'),
  '/programs/kids': () => import('../pages/Programs/Kids'),
  '/login': () => import('../pages/Login'),
  '/register': () => import('../pages/Register'),
  '/notifications': () => import('../pages/Notifications'),
  '/student/dashboard': () => import('../pages/StudentDashboard'),
  '/teacher/dashboard': () => import('../pages/TeacherDashboard/TeacherDashboardGate'),
  '/guardian/dashboard': () => import('../pages/GuardianDashboard'),
  '/admin': () => import('../pages/AdminDashboard'),
};

function normalizeRouteKey(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '/';
  const withoutQuery = rawPath.split('?')[0].split('#')[0];
  // Strip leading /:locale segment (e.g. /ar/teachers -> /teachers, /en -> /)
  const stripped = withoutQuery.replace(/^\/(ar|en|fr|de|es|tr|ur|id|ms)(?=\/|$)/, '') || '/';
  if (ROUTE_LOADERS[stripped]) return stripped;
  if (stripped.startsWith('/register/')) return '/register';
  return stripped;
}

export function prefetchRoute(rawPath) {
  try {
    if (typeof navigator !== 'undefined' && navigator.connection?.saveData) {
      return;
    }
    const key = normalizeRouteKey(rawPath);
    const loader = ROUTE_LOADERS[key];
    if (!loader || prefetchedRoutes.has(key)) return;
    prefetchedRoutes.add(key);
    Promise.resolve(loader()).catch(() => {
      prefetchedRoutes.delete(key);
    });
  } catch {
    // Ignore prefetch errors silently
  }
}
