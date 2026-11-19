import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Link2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';
import { formatMsg } from './adminFormat';

export default function AdminGuardianLinksPanel({ onOpenStudent }) {
  const { locale, t } = useI18n();
  const gl = t.adminPortal.people.guardianLinks;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = statusFilter === 'pending'
        ? '/api/admin/people/guardian-links?status=pending'
        : '/api/admin/people/guardian-links?status=' + encodeURIComponent(statusFilter);
      const result = await api.get(endpoint, { auth: true });
      setItems(result.invitations || []);
    } catch (err) {
      setError(err.message || gl.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, gl.loadError]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="wn-admin-guardian-links">
      <header>
        <div>
          <span>{gl.eyebrow}</span>
          <h3><Link2 size={18} aria-hidden="true" /> {gl.title}</h3>
          <p>{gl.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={gl.filterAria}
            className="min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--wn-surface)] text-[var(--wn-text-primary)] font-semibold"
          >
            <option value="pending">{gl.statuses.pending}</option>
            <option value="accepted">{gl.statuses.accepted}</option>
            <option value="rejected">{gl.statuses.rejected}</option>
            <option value="expired">{gl.statuses.expired}</option>
            <option value="all">{gl.statuses.all}</option>
          </select>
          <button type="button" onClick={load} disabled={loading} className="min-h-[44px]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {gl.refresh}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2 p-2" role="status" aria-label={gl.loading}>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} aria-hidden="true" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
            {t.adminPortal.common.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={gl.empty} />
      ) : (
        <div className="wn-admin-guardian-links__list">
          {items.map((item) => (
            <article key={item._id}>
              <span className="wn-admin-guardian-links__icon"><UserRound size={17} aria-hidden="true" /></span>
              <div>
                <strong>{item.student?.name || gl.studentFallback}</strong>
                <small>{item.student?.email || dash} · {gl.relations[item.relationship] || item.relationship}</small>
              </div>
              <div>
                <strong>{item.phoneMasked || dash}</strong>
                <small>{formatMsg(gl.expiresPrefix, { date: new Date(item.expiresAt).toLocaleDateString(intlLocale) })}</small>
              </div>
              <button type="button" onClick={() => onOpenStudent?.(item.student?._id)} className="min-h-[44px]">
                {gl.openStudent360}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
