import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useI18n } from '../i18n';
import { resolveIntlLocale } from '../lib/locale';
import { isSafeInternalRedirect, localizeInternalHref } from '../lib/navigation';
import { useToast } from '../context/ToastProvider';
import { Room, RoomEvent } from 'livekit-client';

const TRUSTED_ACADEMY_HOSTS = new Set(['wahywanamaa.com', 'www.wahywanamaa.com']);

function isSafeNotificationTarget(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (isSafeInternalRedirect(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    const sameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
    const trustedHost = parsed.protocol === 'https:' && TRUSTED_ACADEMY_HOSTS.has(parsed.hostname.toLowerCase());
    return sameOrigin || trustedHost;
  } catch {
    return false;
  }
}

function pickText(obj, locale = 'ar') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.ar || obj.en || '';
}

export default function NotificationBell() {
  const { locale, t } = useI18n();
  const nb = t?.notificationsBell || {};
  const toast = useToast();
  const knownNotificationIds = useRef(new Set());
  const initializedNotifications = useRef(false);
  const realtimeRoomRef = useRef(null);
  const fetching = useRef(false);
  const refreshPending = useRef(false);
  const fetchNotificationsRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (fetching.current) { refreshPending.current = true; return; }
    fetching.current = true;
    try {
      if (!api.getToken()) return;
      const data = await api.get('/api/notifications?limit=10', { auth: true });
      const nextNotifications = data.notifications || [];

      if (!initializedNotifications.current) {
        nextNotifications.forEach((item) => knownNotificationIds.current.add(String(item._id)));
        initializedNotifications.current = true;
      } else {
        const fresh = nextNotifications.filter((item) => (
          !item.isRead && !knownNotificationIds.current.has(String(item._id))
        ));

        nextNotifications.forEach((item) => knownNotificationIds.current.add(String(item._id)));

        if (fresh.length > 0) {
          const newest = fresh[0];
          toast.info(pickText(newest.message, locale), {
            title: pickText(newest.title, locale),
            position: 'top-right',
            duration: 5000,
          });
          fresh.forEach((notification) => window.dispatchEvent(new CustomEvent('wn:realtime-notification', { detail: notification })));
        }
      }

      setNotifications(nextNotifications);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      fetching.current = false;
      if (refreshPending.current) { refreshPending.current = false; fetchNotificationsRef.current?.(); }
    }
  }, [locale, toast]);

  useEffect(() => {
    let disposed = false;
    fetchNotificationsRef.current = fetchNotifications;

    setTimeout(() => { fetchNotifications(); }, 0);

    const connectRealtime = async () => {
      try {
        if (!api.getToken()) return;
        const connection = await api.get('/api/notifications/realtime-token', { auth: true });
        if (disposed || !connection?.token || !connection?.url) return;

        const room = new Room();
        realtimeRoomRef.current = room;

        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (topic && topic !== 'notifications') return;

          try {
            const event = JSON.parse(new TextDecoder().decode(payload));
            if (event?.type === 'notifications-changed') { fetchNotifications(); window.dispatchEvent(new Event('wn:notifications-changed')); return; }
            if (event?.type === 'support-updated') { window.dispatchEvent(new Event('wn:support-changed')); return; }
            const notification = event?.notification;
            if (event?.type !== 'notification' || !notification) return;

            const id = String(notification._id || '');
            const known = knownNotificationIds.current.has(id);
            if (id) knownNotificationIds.current.add(id);

            if (!known && !notification.isRead) toast.info(pickText(notification.message, locale), {
              title: pickText(notification.title, locale),
              position: 'top-right',
              duration: 5000,
            });

            window.dispatchEvent(new CustomEvent('wn:realtime-notification', {
              detail: notification,
            }));

            setTimeout(() => { fetchNotifications(); }, 0);
          } catch (error) {
            console.error('Realtime notification payload error:', error);
          }
        });

        await room.connect(connection.url, connection.token, { autoSubscribe: false });
      } catch (error) {
        console.warn('Realtime notifications unavailable; using polling fallback:', error?.message || error);
      }
    };

    connectRealtime();

    // Fallback only. Normal updates arrive instantly through LiveKit.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, 10000);

    const onFocus = () => fetchNotifications();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('wn:notifications-changed', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('wn:notifications-changed', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      realtimeRoomRef.current?.disconnect?.();
      realtimeRoomRef.current = null;
    };
  }, [locale, toast, fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {}, { auth: true });
      await fetchNotifications();
    } catch (error) {
      toast.error(error?.message || nb.loadError || 'Unable to load notifications');
    }
  };

  const markAllAsRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await api.put('/api/notifications/read-all', {}, { auth: true });
      await fetchNotifications();
    } catch (error) {
      toast.error(error?.message || nb.loadError || 'Unable to update notifications');
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'session-request': '📅',
      'session-accepted': '✅',
      'session-rejected': '❌',
      'session-completed': '🎓',
      'course-enrollment': '📚',
      'certificate-issued': '🏆',
      'homework-assigned': '📝',
      'teacher-update': '🎥',
      'system': '🔔',
    };
    return icons[type] || '🔔';
  };

  const getNotificationLink = (notification) => {
    if (notification.data?.meetingLink && isSafeNotificationTarget(notification.data.meetingLink)) {
      return localizeInternalHref(notification.data.meetingLink, locale);
    }
    if (notification.data?.actionUrl && isSafeNotificationTarget(notification.data.actionUrl)) {
      return localizeInternalHref(notification.data.actionUrl, locale);
    }
    const links = {
      'session-request': '/teacher/dashboard',
      'session-accepted': '/student/dashboard',
      'session-rejected': '/student/dashboard',
      'course-enrollment': '/student/dashboard',
      'certificate-issued': '/student/dashboard',
    };
    return localizeInternalHref(links[notification.type] || '/notifications', locale);
  };

  const isExternal = (url) => typeof url === 'string' && url.startsWith('https://');
  const intlLocale = resolveIntlLocale(locale);
  const visibleNotifications = onlyUnread ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[var(--wn-text-secondary)] hover:text-[var(--wn-link)] hover:bg-[var(--wn-surface-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        aria-label={nb.title || 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Bell size={22} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            role="menu"
            aria-label={nb.title || 'Notifications'}
            className="absolute end-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl shadow-2xl z-50 overflow-hidden border border-[var(--wn-border)]"
          >
            <div className="bg-[var(--wn-emerald-deep)] p-4 text-[var(--wn-text-inverse)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-lg">{nb.title || 'Notifications'}</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markingAll}
                    onClick={markAllAsRead}
                    className="min-h-[44px] text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-gold)] disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {markingAll ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={16} aria-hidden="true" />}
                    <span>{nb.markAll || 'Mark all'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-b border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3 py-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOnlyUnread(false)}
                className={`min-h-[44px] rounded-lg px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                  !onlyUnread
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                    : 'text-[var(--wn-text-secondary)] hover:bg-[var(--wn-emerald-soft)]'
                }`}
              >
                {nb.all || 'All'} ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyUnread(true)}
                className={`min-h-[44px] rounded-lg px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                  onlyUnread
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                    : 'text-[var(--wn-text-secondary)] hover:bg-[var(--wn-emerald-soft)]'
                }`}
              >
                {nb.unread || 'Unread'} ({unreadCount})
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {visibleNotifications.length === 0 ? (
                <div className="p-8 text-center text-[var(--wn-text-secondary)]">
                  <Bell className="mx-auto mb-2 text-[var(--wn-text-tertiary)]" size={40} aria-hidden="true" />
                  <p>{nb.empty || 'No notifications'}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--wn-border)]">
                  {visibleNotifications.map((notification) => {
                    const href = getNotificationLink(notification);
                    const content = (
                      <div className="flex items-start gap-3">
                        <div className="text-2xl" aria-hidden="true">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm text-[var(--wn-text-primary)]">
                              {pickText(notification.title, locale)}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-[var(--wn-emerald)] rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-[var(--wn-text-secondary)] mt-1 line-clamp-2">
                            {pickText(notification.message, locale)}
                          </p>
                          <p className="text-xs text-[var(--wn-text-tertiary)] mt-2">
                            {new Date(notification.createdAt).toLocaleString(intlLocale)}
                          </p>
                        </div>
                      </div>
                    );

                    const clickHandler = () => {
                      if (!notification.isRead) markAsRead(notification._id);
                      setIsOpen(false);
                    };

                    return isExternal(href) ? (
                      <a
                        key={notification._id}
                        role="menuitem"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={clickHandler}
                        className={`block p-4 hover:bg-[var(--wn-surface-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wn-focus)] ${
                          !notification.isRead ? 'bg-[var(--wn-emerald-soft)]' : ''
                        }`}
                      >
                        {content}
                      </a>
                    ) : (
                      <Link
                        key={notification._id}
                        role="menuitem"
                        to={href}
                        onClick={clickHandler}
                        className={`block p-4 hover:bg-[var(--wn-surface-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wn-focus)] ${
                          !notification.isRead ? 'bg-[var(--wn-emerald-soft)]' : ''
                        }`}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-[var(--wn-border)] p-2 bg-[var(--wn-surface-soft)]">
                <Link
                  to={localizeInternalHref('/notifications', locale)}
                  onClick={() => setIsOpen(false)}
                  className="min-h-[44px] flex items-center justify-center rounded-lg text-sm text-[var(--wn-link)] hover:bg-[var(--wn-emerald-soft)] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  {nb.viewAll || 'View all notifications'}
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

