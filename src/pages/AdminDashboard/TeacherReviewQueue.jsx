import { Eye, RefreshCw, ShieldCheck } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg } from './adminFormat';

export default function TeacherReviewQueue({
  teachers = [],
  loading = false,
  onRefresh,
  onOpenDossier,
  compact = false,
}) {
  const { locale, t } = useI18n();
  const rq = t.adminPortal.dossiers.reviewQueue;
  const intlLocale = resolveIntlLocale(locale);

  const Wrapper = compact ? 'div' : 'section';
  const wrapperClass = compact ? 'wn-admin-review-queue--compact' : 'wn-dashboard-surface';

  return (
    <Wrapper className={wrapperClass}>
      {compact ? (
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-[var(--wn-text-secondary)]">
            {formatMsg(rq.title, { count: teachers.length })}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-emerald-soft)] hover:border-[var(--wn-emerald)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {rq.refresh}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-[var(--wn-heading)]">{formatMsg(rq.title, { count: teachers.length })}</h3>
            <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{rq.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-surface-soft)] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {rq.refresh}
          </button>
        </div>
      )}

      {loading && teachers.length === 0 ? (
        <div className="space-y-2.5" role="status" aria-label={t.adminPortal.common.loading}>
          <Skeleton className={compact ? 'h-16 w-full rounded-xl' : 'h-24 w-full rounded-xl'} />
          <Skeleton className={compact ? 'h-16 w-full rounded-xl' : 'h-24 w-full rounded-xl'} />
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={rq.emptyTitle} description={rq.emptyDesc} />
      ) : (
        <div className="space-y-3">
          {teachers.map((teacher) => (
            <article key={teacher._id} className="border border-[var(--wn-border)] rounded-xl p-4 bg-[var(--wn-surface-soft)]">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-[var(--wn-heading)]">
                      {teacher.user?.name || teacher.personalInfo?.fullName || rq.teacherFallback}
                    </h4>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] font-semibold">
                      {teacher.status === 'under-review' ? rq.statusUnderReview : rq.statusPending}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                    {[teacher.personalInfo?.country, teacher.personalInfo?.city]
                      .filter(Boolean)
                      .join(' — ') || rq.locationIncomplete}
                  </p>
                  <p className="text-xs text-[var(--wn-text-tertiary)] mt-1">
                    {teacher.user?.email || rq.noEmail}
                  </p>
                  {teacher.createdAt ? (
                    <p className="text-[11px] text-[var(--wn-text-tertiary)] mt-1">
                      {formatMsg(rq.submittedAt, { date: new Date(teacher.createdAt).toLocaleString(intlLocale) })}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenDossier(teacher._id)}
                  className="min-h-[44px] px-3 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold flex items-center gap-1.5"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  {rq.openDossier}
                </button>
              </div>

              {!compact ? (
                <div className="mt-4 border-t border-[var(--wn-border)] pt-3 flex items-start gap-2 text-xs text-[var(--wn-text-secondary)]">
                  <Eye size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <p>{rq.compactNote}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Wrapper>
  );
}
