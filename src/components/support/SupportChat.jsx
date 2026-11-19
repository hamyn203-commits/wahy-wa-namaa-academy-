import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw, Send } from 'lucide-react';
import api from '../../lib/api';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import EmptyState from '../shared/EmptyState';
import Skeleton from '../shared/Skeleton';
import './support.css';

export default function SupportChat({ studentId = 'me', admin = false }) {
  const { locale, dir, t } = useI18n();
  const sc = t.supportChat;
  const intlLocale = resolveIntlLocale(locale);
  const errorId = useId();
  const [messages, setMessages] = useState([]);
  const [student, setStudent] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [older, setOlder] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pending = useRef(null);
  const busy = useRef(false);
  const bottom = useRef(null);
  const view = useRef(null);
  const generation = useRef(0);
  const cursorInitialized = useRef(false);
  const base = `/api/support/${encodeURIComponent(studentId)}`;

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const version = generation.current;
    try {
      const data = await api.get(`${base}/messages`, { auth: true });
      if (version !== generation.current) return;
      const nearBottom = !view.current || view.current.scrollHeight - view.current.scrollTop - view.current.clientHeight < 100;
      setMessages((current) => [...new Map([...current, ...(data.messages || [])].map((m) => [m._id, m])).values()]);
      setStudent(data.student);
      setLoaded(true);
      setSyncError(false);
      if (!cursorInitialized.current) {
        setNextBefore(data.nextBefore);
        cursorInitialized.current = true;
      }
      if (nearBottom) requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'nearest' }));
      const last = data.messages?.at(-1);
      const observed = (data.messages || []).filter((m) => m.senderRole !== (admin ? 'admin' : 'student') && !m.readAt).map((m) => m._id);
      if (last && observed.length && document.visibilityState === 'visible') {
        await api.put(`${base}/read`, { through: last._id, messageIds: observed }, { auth: true });
        window.dispatchEvent(new Event('wn:notifications-changed'));
        window.dispatchEvent(new Event('wn:support-changed'));
      }
    } catch {
      if (version === generation.current) setSyncError(true);
    } finally {
      if (version === generation.current) {
        busy.current = false;
        setRefreshing(false);
      }
    }
  }, [base, admin]);

  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    cursorInitialized.current = false;
    // The parent keys conversations by student, so a new conversation starts with fresh state.
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(onVisible, 5000);
    window.addEventListener('focus', onVisible);
    window.addEventListener('wn:realtime-notification', onVisible);
    window.addEventListener('wn:support-changed', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      generation.current += 1;
      clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('wn:realtime-notification', onVisible);
      window.removeEventListener('wn:support-changed', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const loadOlder = async () => {
    if (loadingOlder) return;
    const version = generation.current;
    setLoadingOlder(true);
    try {
      const data = await api.get(`${base}/messages?before=${nextBefore}`, { auth: true });
      if (version !== generation.current) return;
      setOlder((current) => [...data.messages, ...current]);
      setNextBefore(data.nextBefore);
      const observed = data.messages.filter((m) => m.senderRole !== (admin ? 'admin' : 'student') && !m.readAt).map((m) => m._id);
      if (observed.length && document.visibilityState === 'visible') {
        await api.put(`${base}/read`, { through: data.messages.at(-1)._id, messageIds: observed }, { auth: true });
        window.dispatchEvent(new Event('wn:notifications-changed'));
        window.dispatchEvent(new Event('wn:support-changed'));
      }
    } catch {
      setError(sc.loadOlderError);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || sending) return;
    const version = generation.current;
    const draft = text.trim();
    if (!pending.current || pending.current.text !== draft) {
      pending.current = { clientId: crypto.randomUUID(), text: draft };
    }
    setSending(true);
    setError('');
    try {
      const data = await api.post(`${base}/messages`, pending.current, { auth: true });
      if (version !== generation.current) return;
      setMessages((current) => (current.some((m) => m._id === data.message._id) ? current : [...current, data.message]));
      setText('');
      pending.current = null;
      requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'nearest' }));
      window.dispatchEvent(new Event('wn:support-changed'));
      await refresh();
    } catch (failure) {
      if (version === generation.current) setError(failure.message || sc.sendError);
    } finally {
      if (version === generation.current) setSending(false);
    }
  };

  const all = [...new Map([...older, ...messages].map((m) => [m._id, m])).values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a._id.localeCompare(b._id)
  );

  return (
    <section className="wn-support-chat" aria-label={sc.ariaLabel} dir={dir}>
      <header className="wn-support-chat__header">
        <span className="wn-support-icon"><MessageCircle size={23} aria-hidden="true" /></span>
        <div>
          <h2>{admin ? student?.name || sc.adminTitle : sc.studentTitle}</h2>
          <p>{admin ? sc.adminSubtitle : sc.studentSubtitle}</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing} aria-label={sc.refreshAria}>
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </header>
      <div className="wn-support-sync" role="status">{syncError ? sc.syncError : sc.syncOk}</div>
      <div className="wn-support-chat__messages" ref={view} role="log" aria-live="polite" aria-relevant="additions">
        {nextBefore && (
          <button type="button" className="wn-support-older" disabled={loadingOlder} onClick={loadOlder}>
            {loadingOlder ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {sc.loadOlder}
          </button>
        )}
        {!loaded ? (
          <div className="space-y-3 p-2" role="status" aria-label={sc.loading}>
            <Skeleton className="h-14 w-3/4 rounded-xl" />
            <Skeleton className="h-14 w-2/3 ms-auto rounded-xl" />
            <Skeleton className="h-12 w-1/2 rounded-xl" />
          </div>
        ) : all.length === 0 ? (
          <EmptyState icon={MessageCircle} title={sc.emptyTitle} description={sc.emptyDesc} />
        ) : (
          all.map((m) => {
            const mine = m.senderRole === (admin ? 'admin' : 'student');
            return (
              <article key={m._id} className={`wn-support-bubble ${mine ? 'is-mine' : ''}`}>
                <strong>{m.senderRole === 'admin' ? sc.adminSender : student?.name}</strong>
                <p>{m.text}</p>
                <small>
                  {new Date(m.createdAt).toLocaleString(intlLocale, { dateStyle: 'short', timeStyle: 'short' })}
                  {mine && <span> · {m.readAt ? sc.read : sc.sent}</span>}
                </small>
              </article>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="wn-support-compose">
        <label htmlFor={`support-text-${studentId}`}>{sc.yourMessage}</label>
        <textarea
          id={`support-text-${studentId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={sending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholder={admin ? sc.placeholderAdmin : sc.placeholderStudent}
        />
        <div>
          <small>{text.length}/2000</small>
          <button type="submit" disabled={!text.trim() || sending} className="min-h-[44px]">
            {sending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {sending ? sc.sending : sc.send}
          </button>
        </div>
        {error && <p id={errorId} className="wn-support-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}

export function SupportLauncher({ onOpen }) {
  const { t } = useI18n();
  const launcher = t.supportChat.launcher;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await api.get('/api/support/me/unread', { auth: true });
        if (!disposed) setUnread(data.unread || 0);
      } catch {
        /* The conversation itself shows connection failures. */
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('wn:realtime-notification', refresh);
    window.addEventListener('wn:support-changed', refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('wn:realtime-notification', refresh);
      window.removeEventListener('wn:support-changed', refresh);
    };
  }, []);

  return (
    <div className="wn-support-launcher">
      <div>
        <strong>{launcher.title}</strong>
        <p>{launcher.subtitle}</p>
      </div>
      <button type="button" onClick={onOpen} className="min-h-[44px]">
        <MessageCircle size={18} aria-hidden="true" />
        {launcher.cta}
        {unread > 0 && <span className="wn-support-badge" aria-label={launcher.unreadAria}>{unread}</span>}
      </button>
    </div>
  );
}
