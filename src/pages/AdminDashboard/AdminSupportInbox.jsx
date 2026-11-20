import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import SupportChat from '../../components/support/SupportChat';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';

export default function AdminSupportInbox({ selectedStudent, onSelect }) {
  const { locale, t } = useI18n();
  const si = t.supportChat.inbox;
  const intlLocale = resolveIntlLocale(locale);
  const [rows, setRows] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const lastRefreshAtRef = useRef(0);
  const rateLimitedUntilRef = useRef(0);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now < rateLimitedUntilRef.current) return;
    try {
      const data = await api.get('/api/support/inbox', { auth: true });
      lastRefreshAtRef.current = Date.now();
      rateLimitedUntilRef.current = 0;
      setRows((current) => [
        ...data.conversations,
        ...current.filter((c) => !data.conversations.some((n) => n.student._id === c.student._id)),
      ]);
      setNextBefore(data.nextBefore);
      setError('');
    } catch (err) {
      if (err?.status === 429) {
        rateLimitedUntilRef.current = Date.now() + 60000;
      }
      setError(si.refreshError);
    } finally {
      setLoading(false);
    }
  }, [si.refreshError]);

  useEffect(() => {
    let mounted = true;
    api.get('/api/support/inbox', { auth: true })
      .then((data) => {
        if (!mounted) return;
        lastRefreshAtRef.current = Date.now();
        setRows(data.conversations || []);
        setNextBefore(data.nextBefore);
        setError('');
      })
      .catch((err) => {
        if (err?.status === 429) {
          rateLimitedUntilRef.current = Date.now() + 60000;
        }
        if (mounted) setError(si.loadError);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const visible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshAtRef.current >= 8000) {
        refresh();
      }
    };
    const realtimeRefresh = () => refresh({ force: true });
    const timer = setInterval(visible, 15000);
    window.addEventListener('focus', visible);
    window.addEventListener('wn:realtime-notification', realtimeRefresh);
    window.addEventListener('wn:support-changed', realtimeRefresh);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', visible);
      window.removeEventListener('wn:realtime-notification', realtimeRefresh);
      window.removeEventListener('wn:support-changed', realtimeRefresh);
    };
  }, [refresh, si.loadError]);

  const more = async () => {
    if (loadingMore || !nextBefore) return;
    setLoadingMore(true);
    try {
      const data = await api.get(`/api/support/inbox?before=${nextBefore}`, { auth: true });
      setRows((current) => [
        ...current,
        ...data.conversations.filter((c) => !current.some((n) => n.student._id === c.student._id)),
      ]);
      setNextBefore(data.nextBefore);
    } catch {
      setError(si.olderError);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section aria-label={si.ariaLabel} className="wn-support-inbox">
      <aside>
        <h2>{si.title}</h2>
        <p>{si.subtitle}</p>
        {error && (
          <div role="alert" className="wn-support-error space-y-2 mb-3">
            <p>{error}</p>
            <button type="button" onClick={() => refresh({ force: true })} className="wn-btn wn-btn--secondary min-h-[44px]">
              {si.retry}
            </button>
          </div>
        )}
        {loading ? (
          <div className="space-y-2" role="status" aria-label={t.adminPortal.common.loading}>
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : rows.length === 0 && !error ? (
          <EmptyState icon={MessageSquare} title={si.empty} />
        ) : (
          rows.map((r) => (
            <button
              type="button"
              key={r.student._id}
              className={r.student._id === selectedStudent ? 'is-active' : ''}
              onClick={() => onSelect(r.student._id)}
            >
              <strong>
                {r.student.name}
                {r.unread > 0 && <span className="wn-support-badge">{r.unread}</span>}
              </strong>
              <p>{r.latest.text}</p>
              <small>{new Date(r.latest.createdAt).toLocaleString(intlLocale)}</small>
            </button>
          ))
        )}
        {nextBefore && (
          <button type="button" onClick={more} disabled={loadingMore} className="min-h-[44px] inline-flex items-center justify-center gap-2">
            {loadingMore ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {si.loadOlder}
          </button>
        )}
      </aside>
      {selectedStudent ? (
        <SupportChat key={selectedStudent} studentId={selectedStudent} admin />
      ) : (
        <div className="wn-support-empty">
          <EmptyState icon={MessageSquare} title={si.emptySelectionTitle} description={si.emptySelectionDesc} />
        </div>
      )}
    </section>
  );
}
