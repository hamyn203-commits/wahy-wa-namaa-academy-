import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';

const DASHBOARD_BY_ROLE = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  guardian: '/guardian/dashboard',
  admin: '/admin',
};

export default function UserMenu({ locale = DEFAULT_LOCALE }) {
  const { user, logout, isAuthenticated } = useAuth();
  const { locale: ctxLocale, t } = useI18n();
  const um = t?.userMenu || {};
  const activeLocale = locale || ctxLocale || DEFAULT_LOCALE;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!isAuthenticated || !user) return null;

  const lp = (path) => localizedPath(path, activeLocale);
  const dashboard = lp(DASHBOARD_BY_ROLE[user.role] || '/student/dashboard');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={um.openMenu || 'Open account menu'}
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--wn-surface-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
      >
        <div className="w-8 h-8 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] flex items-center justify-center text-sm font-bold shrink-0">
          {user.name?.charAt(0) || 'U'}
        </div>
        <span className="hidden lg:block text-sm font-medium text-[var(--wn-text-primary)] max-w-[100px] truncate">
          {user.name}
        </span>
        <ChevronDown size={16} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-56 bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl shadow-xl border border-[var(--wn-border)] z-50 py-2"
        >
          <div className="px-4 py-2 border-b border-[var(--wn-border)]">
            <p className="font-semibold text-sm truncate">{user.name}</p>
            <p className="text-xs text-[var(--wn-text-secondary)] truncate">{user.email}</p>
          </div>
          <Link
            role="menuitem"
            to={dashboard}
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wn-focus)]"
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            <span>{um.dashboard || 'Dashboard'}</span>
          </Link>
          <Link
            role="menuitem"
            to={lp('/ai')}
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wn-focus)]"
          >
            <User size={16} aria-hidden="true" />
            <span>{um.aiHub || 'AI Hub'}</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wn-focus)]"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{um.logout || 'Logout'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

