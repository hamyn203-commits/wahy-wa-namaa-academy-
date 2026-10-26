import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useI18n } from '../i18n';
import { localizeInternalHref } from '../lib/navigation';
import { useToast } from '../context/ToastProvider';
import { Room, RoomEvent } from 'livekit-client';

function pickText(obj, locale = 'ar') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.ar || obj.en || '';
}

export default function NotificationBell() {
  const { locale } = useI18n();
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

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {}, { auth: true });
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all', {}, { auth: true });
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
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
    if (notification.data?.meetingLink) {
      return localizeInternalHref(notification.data.meetingLink, locale);
    }
    if (notification.data?.actionUrl) {
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

  const isExternal = (url) => url?.startsWith('http');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-emerald-600 transition"
        aria-label="الإشعارات"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">الإشعارات</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <CheckCheck size={16} />
                    تعليم الكل
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/80 px-3 py-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOnlyUnread(false)}
                className={!onlyUnread ? 'rounded-lg bg-emerald-700 px-2.5 py-1 text-white' : 'rounded-lg px-2.5 py-1 text-gray-600 hover:bg-gray-200/60'}
              >
                الكل ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyUnread(true)}
                className={onlyUnread ? 'rounded-lg bg-emerald-700 px-2.5 py-1 text-white' : 'rounded-lg px-2.5 py-1 text-gray-600 hover:bg-gray-200/60'}
              >
                غير المقروءة ({unreadCount})
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="mx-auto mb-2 text-gray-400" size={40} />
                  <p>لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(onlyUnread ? notifications.filter((n) => !n.isRead) : notifications).map((notification) => {
                    const href = getNotificationLink(notification);
                    const content = (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-sm text-gray-900">
                                {pickText(notification.title, locale)}
                              </h4>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {pickText(notification.message, locale)}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(notification.createdAt).toLocaleString('ar-EG')}
                            </p>
                          </div>
                        </div>
                      </>
                    );

                    const clickHandler = () => {
                      if (!notification.isRead) markAsRead(notification._id);
                      setIsOpen(false);
                    };

                    return isExternal(href) ? (
                      <a
                        key={notification._id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={clickHandler}
                        className={`block p-4 hover:bg-gray-50 transition ${!notification.isRead ? 'bg-emerald-50' : ''}`}
                      >
                        {content}
                      </a>
                    ) : (
                      <Link
                        key={notification._id}
                        to={href}
                        onClick={clickHandler}
                        className={`block p-4 hover:bg-gray-50 transition ${!notification.isRead ? 'bg-emerald-50' : ''}`}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t p-3 bg-gray-50">
                <Link
                  to={localizeInternalHref('/notifications', locale)}
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  عرض جميع الإشعارات
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
