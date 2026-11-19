import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Settings,
  Sparkles,
  Calendar,
  BookOpen,
  Award,
  Video,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { isSafeInternalRedirect } from '../../lib/navigation';
import '../../styles/public-experience.css';

const TRUSTED_ACADEMY_HOSTS = new Set(['wahywanamaa.com', 'www.wahywanamaa.com']);

function resolveSafeInternalPath(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (isSafeInternalRedirect(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const sameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
    const trustedHost = parsed.protocol === 'https:' && TRUSTED_ACADEMY_HOSTS.has(parsed.hostname.toLowerCase());
    if (sameOrigin || trustedHost) {
      const candidatePath = `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
      return isSafeInternalRedirect(candidatePath) ? candidatePath : null;
    }
  } catch {
    return null;
  }
  return null;
}

function pickText(value, locale) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.ar || value.en || '';
}

function getNotificationMeta(type, nt) {
  if (['session-request', 'session-accepted', 'session-rejected', 'session-rescheduled', 'session-reminder'].includes(type)) {
    return {
      category: 'sessions',
      icon: Calendar,
      priorityLabel: nt.catSessions || 'Live Session',
      priorityClass: 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border-[var(--wn-border-strong)]',
    };
  }
  if (['homework-assigned', 'certificate-issued', 'course-enrollment', 'session-completed'].includes(type)) {
    return {
      category: 'academic',
      icon: type === 'certificate-issued' ? Award : BookOpen,
      priorityLabel: nt.catAcademic || 'Academic',
      priorityClass: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]',
    };
  }
  if (type === 'teacher-update') {
    return {
      category: 'academic',
      icon: Video,
      priorityLabel: nt.catTeacherUpdate || 'Tutor Update',
      priorityClass: 'bg-[var(--wn-mint-soft)] text-[var(--wn-teal-dark)] border-[var(--wn-border-mint)]',
    };
  }
  return {
    category: 'system',
    icon: Info,
    priorityLabel: nt.catSystem || 'System',
    priorityClass: 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]',
  };
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const nt = t?.student?.notifications || {};
  const common = t?.common || {};

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [markingId, setMarkingId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const tabRefs = useRef([]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api.get('/api/notifications?limit=50', { auth: true });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale) + '?redirect=/notifications');
      return;
    }
    const timer = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate, load, locale]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const sync = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(sync, 10000);
    window.addEventListener('focus', sync);
    window.addEventListener('wn:notifications-changed', sync);
    window.addEventListener('wn:realtime-notification', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('wn:notifications-changed', sync);
      window.removeEventListener('wn:realtime-notification', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [isAuthenticated, load]);

  const markAsRead = async (id) => {
    if (markingId) return;
    setMarkingId(id);
    try {
      await api.put('/api/notifications/' + id + '/read', {}, { auth: true });
      await load();
    } catch (err) {
      toast.error(err?.message || nt.loadError || 'Unable to update notification.');
    } finally {
      setMarkingId('');
    }
  };

  const markAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await api.put('/api/notifications/read-all', {}, { auth: true });
      await load();
    } catch (err) {
      toast.error(err?.message || nt.loadError || 'Unable to update notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  const filterTabs = [
    { id: 'all', label: nt.filterAll || 'All', count: notifications.length },
    { id: 'unread', label: nt.filterUnread || 'Unread', count: unreadCount },
    {
      id: 'sessions',
      label: nt.filterSessions || 'Sessions',
      count: notifications.filter((n) => getNotificationMeta(n.type, nt).category === 'sessions').length,
    },
    {
      id: 'academic',
      label: nt.filterAcademic || 'Academic',
      count: notifications.filter((n) => getNotificationMeta(n.type, nt).category === 'academic').length,
    },
  ];

  const handleTabKeyDown = (event, index) => {
    const forwardKey = isRTL ? 'ArrowLeft' : 'ArrowRight';
    const backKey = isRTL ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex = -1;
    if (event.key === forwardKey) nextIndex = (index + 1) % filterTabs.length;
    else if (event.key === backKey) nextIndex = (index - 1 + filterTabs.length) % filterTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = filterTabs.length - 1;
    if (nextIndex >= 0) {
      event.preventDefault();
      setFilter(filterTabs[nextIndex].id);
      tabRefs.current[nextIndex]?.focus?.();
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !item.isRead;
    return getNotificationMeta(item.type, nt).category === filter;
  });

  const intlLocale = resolveIntlLocale(locale);

  return (
    <div dir={dir} className="wn-public-shell min-h-screen">
      <GlobalHeader />
      <section className="wn-public-hero">
        <div className="page-container wn-public-hero__inner">
          <div>
            <span className="wn-auth-visual__eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              {nt.eyebrow || 'NOTIFICATION CENTER'}
            </span>
            <h1>{nt.heading || 'Your notifications'}</h1>
            <p>
              {nt.subtitle || 'Account-related session alerts, homework, and updates organized by priority.'}
            </p>
          </div>
          <div className="wn-public-hero__art" aria-hidden="true">
            <div className="wn-public-orbit" />
            <div className="wn-public-orbit__core">
              <Bell size={46} strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      <main className="wn-utility-wrap">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={nt.filterLabel || 'Filter notifications'}>
            {filterTabs.map((tabItem, index) => (
              <button
                key={tabItem.id}
                ref={(el) => { tabRefs.current[index] = el; }}
                type="button"
                role="tab"
                aria-selected={filter === tabItem.id}
                tabIndex={filter === tabItem.id ? 0 : -1}
                onClick={() => setFilter(tabItem.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                  filter === tabItem.id
                    ? 'wn-quick-pill is-active'
                    : 'wn-quick-pill bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border)]'
                }`}
              >
                <span>{tabItem.label}</span>
                {tabItem.count > 0 ? (
                  <span className="ms-1.5 inline-flex items-center justify-center rounded-full bg-[var(--wn-emerald-soft)] px-1.5 py-0.5 text-[11px] font-extrabold text-[var(--wn-badge-emerald-text)]">
                    {tabItem.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={markingAll}
                onClick={markAll}
                className="wn-btn wn-btn--secondary wn-btn--sm min-h-[44px] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {markingAll ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={14} aria-hidden="true" />}
                <span>{nt.markAllRead || 'Mark all as read'}</span>
              </button>
            ) : null}
            <Link
              to={localizedPath('/settings/notifications', locale)}
              className="wn-btn wn-btn--secondary wn-btn--sm min-h-[44px] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Settings size={14} aria-hidden="true" />
              <span>{nt.settings || 'Settings'}</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="wn-notification-list" role="status" aria-live="polite">
            <span className="sr-only">{common.loading || 'Loading…'}</span>
            {Array.from({ length: 4 }, (_, idx) => (
              <div key={idx} className="wn-notification-item space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : loadError && notifications.length === 0 ? (
          <div
            role="alert"
            className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] p-6 text-center space-y-3"
          >
            <p className="font-bold text-[var(--wn-text-danger)]">
              {nt.loadError || 'Unable to load notifications. Please try again.'}
            </p>
            <button
              type="button"
              onClick={load}
              className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>{common.retry || 'Try again'}</span>
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'all' ? (nt.empty || 'No notifications right now') : (nt.emptyFiltered || 'No notifications in this category')}
            action={
              <Link
                to={localizedPath('/student/dashboard', locale)}
                className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                {nt.emptyCta || 'Back to dashboard'}
              </Link>
            }
          />
        ) : (
          <div className="wn-notification-list">
            {loadError && (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-2 text-xs text-[var(--wn-text-danger)]"
              >
                <span>{nt.loadError || 'Unable to refresh notifications.'}</span>
                <button
                  type="button"
                  onClick={load}
                  className="min-h-[44px] px-3 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                >
                  {common.retry || 'Try again'}
                </button>
              </div>
            )}
            {filteredNotifications.map((n) => {
              const meta = getNotificationMeta(n.type, nt);
              const Icon = meta.icon;
              const isMarkingThis = markingId === n._id;
              return (
                <article key={n._id} className={'wn-notification-item ' + (!n.isRead ? 'is-unread' : '')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)]">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.priorityClass}`}>
                            {meta.priorityLabel}
                          </span>
                          {!n.isRead ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-[var(--wn-emerald)]" />
                          ) : null}
                        </div>
                        <h3>{pickText(n.title, locale)}</h3>
                        <p className="mt-1">{pickText(n.message, locale)}</p>
                      </div>
                    </div>
                    {!n.isRead ? (
                      <button
                        type="button"
                        disabled={Boolean(markingId)}
                        onClick={() => markAsRead(n._id)}
                        className="shrink-0 min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold text-[var(--wn-link)] hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                      >
                        {isMarkingThis && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                        <span>{nt.markRead || 'Mark as read'}</span>
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 !text-[10px] !text-[var(--wn-text-tertiary)]">
                    {new Date(n.createdAt).toLocaleString(intlLocale)}
                  </p>
                  {(() => {
                    const safeMeetingPath = resolveSafeInternalPath(n.data?.meetingLink);
                    const safeActionPath = resolveSafeInternalPath(n.data?.actionUrl);
                    if (!safeMeetingPath && !safeActionPath) return null;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {safeMeetingPath ? (
                          <Link
                            to={localizedPath(safeMeetingPath, locale)}
                            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-bold text-[var(--wn-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                          >
                            {nt.openSession || 'Open session link'}
                          </Link>
                        ) : null}
                        {safeActionPath ? (
                          <Link
                            to={localizedPath(safeActionPath, locale)}
                            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-bold text-[var(--wn-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                          >
                            {nt.open || 'Open'}
                          </Link>
                        ) : null}
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        )}
      </main>
      <GlobalFooter />
    </div>
  );
}

