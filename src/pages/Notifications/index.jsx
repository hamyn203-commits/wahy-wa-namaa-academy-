import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import Skeleton from '../../components/shared/Skeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

function pickText(value, locale) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.ar || value.en || '';
}

function getNotificationMeta(type, isAr) {
  if (['session-request', 'session-accepted', 'session-rejected', 'session-rescheduled', 'session-reminder'].includes(type)) {
    return {
      category: 'sessions',
      icon: Calendar,
      priorityLabel: isAr ? 'حصة مباشرة' : 'Live Session',
      priorityClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  if (['homework-assigned', 'certificate-issued', 'course-enrollment', 'session-completed'].includes(type)) {
    return {
      category: 'academic',
      icon: type === 'certificate-issued' ? Award : BookOpen,
      priorityLabel: isAr ? 'متابعة تعليمية' : 'Academic',
      priorityClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  if (type === 'teacher-update') {
    return {
      category: 'academic',
      icon: Video,
      priorityLabel: isAr ? 'رسالة المعلم' : 'Tutor Update',
      priorityClass: 'bg-blue-50 text-blue-800 border-blue-200',
    };
  }
  return {
    category: 'system',
    icon: Info,
    priorityLabel: isAr ? 'إشعار النظام' : 'System',
    priorityClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications?limit=50', { auth: true });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setNotifications([]);
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
    await api.put('/api/notifications/' + id + '/read', {}, { auth: true });
    await load();
  };

  const markAll = async () => {
    await api.put('/api/notifications/read-all', {}, { auth: true });
    await load();
  };

  const filterTabs = [
    { id: 'all', label: isAr ? 'الكل' : 'All', count: notifications.length },
    { id: 'unread', label: isAr ? 'غير المقروءة' : 'Unread', count: unreadCount },
    {
      id: 'sessions',
      label: isAr ? 'الحصص والمواعيد' : 'Sessions',
      count: notifications.filter((n) => getNotificationMeta(n.type, isAr).category === 'sessions').length,
    },
    {
      id: 'academic',
      label: isAr ? 'الواجبات والشهادات' : 'Academic',
      count: notifications.filter((n) => getNotificationMeta(n.type, isAr).category === 'academic').length,
    },
  ];

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !item.isRead;
    return getNotificationMeta(item.type, isAr).category === filter;
  });

  return (
    <div className="wn-public-shell min-h-screen">
      <GlobalHeader />
      <section className="wn-public-hero">
        <div className="page-container wn-public-hero__inner">
          <div>
            <span className="wn-auth-visual__eyebrow">
              <Sparkles size={14} />
              {isAr ? 'مركز الإشعارات' : 'NOTIFICATION CENTER'}
            </span>
            <h1>{isAr ? 'إشعارات حسابك' : 'Your notifications'}</h1>
            <p>
              {isAr
                ? 'الجلسات والواجبات والتحديثات المرتبطة بحسابك مصنّفة حسب الأولوية لسهولة المتابعة.'
                : 'Account-related session alerts, homework, and updates organized by priority.'}
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
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={isAr ? 'تصفية الإشعارات' : 'Filter notifications'}>
            {filterTabs.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={filter === tabItem.id}
                onClick={() => setFilter(tabItem.id)}
                className={filter === tabItem.id ? 'wn-quick-pill is-active' : 'wn-quick-pill bg-white border border-slate-200'}
              >
                <span>{tabItem.label}</span>
                {tabItem.count > 0 ? (
                  <span className="ms-1.5 inline-flex items-center justify-center rounded-full bg-emerald-900/10 px-1.5 py-0.2 text-[11px] font-extrabold">
                    {tabItem.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {unreadCount > 0 ? (
              <button onClick={markAll} className="wn-btn wn-btn--secondary wn-btn--sm">
                <CheckCheck size={14} />
                {isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}
              </button>
            ) : null}
            <Link to={localizedPath('/settings/notifications', locale)} className="wn-btn wn-btn--secondary wn-btn--sm">
              <Settings size={14} />
              {isAr ? 'الإعدادات' : 'Settings'}
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="wn-notification-list" role="status" aria-live="polite">
            <span className="sr-only">{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
            {Array.from({ length: 4 }, (_, idx) => (
              <div key={idx} className="wn-notification-item space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="wn-public-empty">
            <Bell size={42} />
            <h3>{isAr ? 'لا توجد إشعارات في هذا التصنيف' : 'No notifications in this category'}</h3>
          </div>
        ) : (
          <div className="wn-notification-list">
            {filteredNotifications.map((n) => {
              const meta = getNotificationMeta(n.type, isAr);
              const Icon = meta.icon;
              return (
                <article key={n._id} className={'wn-notification-item ' + (!n.isRead ? 'is-unread' : '')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                        <Icon size={17} />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.priorityClass}`}>
                            {meta.priorityLabel}
                          </span>
                          {!n.isRead ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                          ) : null}
                        </div>
                        <h3>{pickText(n.title, locale)}</h3>
                        <p className="mt-1">{pickText(n.message, locale)}</p>
                      </div>
                    </div>
                    {!n.isRead ? (
                      <button
                        onClick={() => markAsRead(n._id)}
                        className="shrink-0 text-[11px] font-bold text-[var(--wn-emerald)] hover:underline"
                      >
                        {isAr ? 'تمت القراءة' : 'Mark read'}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 !text-[10px] !text-[var(--wn-text-tertiary)]">
                    {new Date(n.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en')}
                  </p>
                  {n.data?.meetingLink ? (
                    <a
                      href={n.data.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-xs font-bold text-[var(--wn-emerald-dark)]"
                    >
                      {isAr ? 'فتح رابط الجلسة' : 'Open session link'}
                    </a>
                  ) : null}
                  {n.data?.actionUrl ? (
                    <Link
                      to={localizedPath(n.data.actionUrl, locale)}
                      className="inline-block mt-2 me-3 text-xs font-bold text-[var(--wn-emerald-dark)]"
                    >
                      {isAr ? 'فتح' : 'Open'}
                    </Link>
                  ) : null}
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
