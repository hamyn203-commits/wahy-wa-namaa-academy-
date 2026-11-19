import { WalletCards } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg } from './adminFormat';

function statusBadgeClass(status) {
  if (['approved', 'completed'].includes(status)) {
    return 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border border-[var(--wn-status-success-border)]';
  }
  if (status === 'rejected') {
    return 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)]';
  }
  if (status === 'processing') {
    return 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border border-[var(--wn-status-info-border)]';
  }
  return 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border border-[var(--wn-status-warn-border)]';
}

export default function AdminWithdrawalsTab({ withdrawals, onReviewWithdraw }) {
  const { locale, t } = useI18n();
  const tw = t.adminPortal.tabs.withdrawals;
  const intlLocale = resolveIntlLocale(locale);

  if (withdrawals.length === 0) {
    return (
      <div className="wn-dashboard-surface">
        <EmptyState icon={WalletCards} title={tw.empty} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {withdrawals.map((w) => {
        const teacherName = w.teacher?.user?.name || w.teacher?.personalInfo?.fullName || t.adminPortal.reviewQueue.teacherFallback;
        const statusText = ['approved', 'completed'].includes(w.status)
          ? tw.statuses.approved
          : w.status === 'rejected'
            ? tw.statuses.rejected
            : w.status === 'processing'
              ? tw.statuses.processing
              : tw.statuses.pending;

        return (
          <div key={w._id} className="wn-dashboard-surface flex flex-wrap justify-between items-center gap-4">
            <div className="min-w-0">
              <p className="font-bold text-[var(--wn-heading)]">{teacherName}</p>
              <p className="text-sm text-[var(--wn-text-secondary)]">{w.teacher?.user?.email}</p>
              <p className="text-lg font-bold text-[var(--wn-emerald)] mt-1">
                {w.amount} {w.currency || 'EGP'} — {w.method}
              </p>
              <p className="text-xs text-[var(--wn-text-tertiary)]">
                {w.source === 'ledger' ? tw.ledgerSource : tw.legacySource}
              </p>
              {w.accountInfo && <p className="text-sm text-[var(--wn-text-primary)]">{w.accountInfo}</p>}
              {w.referenceNumber && (
                <p className="text-xs text-[var(--wn-emerald)] font-semibold mt-1">
                  {formatMsg(tw.transferRef, { ref: w.referenceNumber })}
                </p>
              )}
              {w.notes && (
                <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                  {formatMsg(tw.notes, { notes: w.notes })}
                </p>
              )}
              <p className="text-xs text-[var(--wn-text-tertiary)] mt-1">
                {w.createdAt ? new Date(w.createdAt).toLocaleString(intlLocale) : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadgeClass(w.status)}`}>
                {statusText}
              </span>
              {w.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => onReviewWithdraw(w, 'approve')}
                    className="min-h-[44px] px-4 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold"
                  >
                    {tw.approveBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewWithdraw(w, 'reject')}
                    className="min-h-[44px] px-4 py-2 bg-[var(--wn-danger)] hover:opacity-90 text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold"
                  >
                    {tw.rejectBtn}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
