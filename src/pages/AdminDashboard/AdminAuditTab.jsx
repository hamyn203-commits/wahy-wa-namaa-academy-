import { History, Loader2, RefreshCw } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';

export default function AdminAuditTab({ auditEntries, loading, onRefresh }) {
  const { locale, t } = useI18n();
  const ta = t.adminPortal.tabs.audit;
  const intlLocale = resolveIntlLocale(locale);

  return (
    <section className="wn-dashboard-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
            <History size={18} aria-hidden="true" />
            <span>{ta.title}</span>
          </h3>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{ta.desc}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="wn-btn min-h-[44px] inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={15} aria-hidden="true" />
          )}
          <span>{ta.refresh}</span>
        </button>
      </div>

      {auditEntries.length === 0 ? (
        <EmptyState icon={History} title={ta.empty} />
      ) : (
        <div className="wn-admin-audit-list">
          {auditEntries.map((entry) => (
            <div key={entry._id}>
              <span>
                <strong>{entry.actor?.name || ta.actorFallback}</strong>
                <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString(intlLocale) : ''}</small>
              </span>
              <span>
                <strong>{entry.action}</strong>
                <small>{entry.entityType} · {entry.entityId}</small>
              </span>
              <span>
                <strong>{entry.reason || ta.noNote}</strong>
                <small>{entry.request?.path || ''}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
