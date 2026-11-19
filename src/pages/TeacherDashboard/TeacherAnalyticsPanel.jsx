import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, RefreshCw, TrendingUp } from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherAnalyticsPanel({
  analytics,
  analyticsLoading,
  analyticsError,
  onRetry,
  onOpenWallet,
  isRTL,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const an = tp.analytics || {};
  const currencyEgp = tp.overview?.currencyEgp || 'ج.م';
  const ForwardChevron = isRTL ? ChevronLeft : ChevronRight;

  if (analyticsError && !analytics) {
    return (
      <div className="wn-teacher-analytics">
        <div
          role="alert"
          className="rounded-2xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center space-y-3"
        >
          <AlertTriangle size={28} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
          <h3 className="text-base font-bold text-[var(--wn-heading)]">
            {an.errorTitle || 'تعذر تحميل تحليلات الأداء'}
          </h3>
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {an.errorDesc || 'تحقق من الاتصال ثم أعد المحاولة.'}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{an.retryBtn || 'إعادة المحاولة'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (analyticsLoading || !analytics) {
    return (
      <div className="wn-teacher-analytics space-y-4" role="status" aria-live="polite">
        <span className="sr-only">{an.loadingTitle || 'جاري إعداد لوحة الأداء'}</span>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="wn-teacher-analytics">
      <div className="wn-teacher-analytics__hero">
        <div>
          <span>{an.eyebrow || 'مؤشر الأداء التعليمي'}</span>
          <h3>{an.title || 'أداؤك مع الطلاب في مكان واحد'}</h3>
          <p>{an.subtitle || 'هذه المؤشرات تساعدك على تحسين الاستمرار بعد التجريبية ومتابعة الالتزام بالواجبات.'}</p>
        </div>
        <TrendingUp size={32} aria-hidden="true" />
      </div>

      <div className="wn-teacher-analytics__kpis">
        <div>
          <span>{an.kpiTrialConversion || 'تحويل التجريبية'}</span>
          <strong>{analytics.trialConversion?.rate || 0}%</strong>
          <small>
            {formatMsg(an.kpiTrialConvertedSub || '{converted} من {total} استمروا', {
              converted: analytics.trialConversion?.converted || 0,
              total: analytics.trialConversion?.completedTrials || 0,
            })}
          </small>
        </div>
        <div>
          <span>{an.kpiHomeworkCompletion || 'إكمال الواجبات'}</span>
          <strong>{analytics.homework?.completionRate || 0}%</strong>
          <small>
            {formatMsg(an.kpiHomeworkCompletedSub || '{count} واجب معتمد', {
              count: analytics.homework?.completed || 0,
            })}
          </small>
        </div>
        <div>
          <span>{an.kpiAvgRating || 'متوسط التقييم'}</span>
          <strong>{Number(analytics.averageRating || 0).toFixed(1)}</strong>
          <small>{an.kpiOutOf5 || 'من 5 نجوم'}</small>
        </div>
        <div>
          <span>{an.kpiNextWeek || 'الأسبوع القادم'}</span>
          <strong>{analytics.upcomingSevenDays || 0}</strong>
          <small>{an.kpiConfirmedSessions || 'حصة مؤكدة'}</small>
        </div>
      </div>

      <div className="wn-teacher-analytics__grid">
        <section>
          <div className="wn-teacher-section-heading">
            <div>
              <span>{an.sessionsEyebrow || 'الحصص'}</span>
              <h3>{an.lastSixMonths || 'آخر 6 أشهر'}</h3>
            </div>
            <strong>{analytics.totalCompleted || 0}</strong>
          </div>
          <div className="wn-teacher-monthly-bars">
            {(analytics.monthlySessions || []).length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={an.noDataTitle || 'لا بيانات كافية بعد'}
                description={an.noDataDesc || 'تظهر الاتجاهات بعد إكمال الحصص.'}
              />
            ) : (analytics.monthlySessions || []).map((month) => {
              const maxCount = Math.max(...analytics.monthlySessions.map((item) => item.count), 1);
              return (
                <div key={month.month}>
                  <span>{month.month}</span>
                  <div><i style={{ width: `${Math.max(8, (month.count / maxCount) * 100)}%` }} /></div>
                  <strong>{month.count}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="wn-teacher-section-heading">
            <div>
              <span>{an.incomeEyebrow || 'الدخل'}</span>
              <h3>{an.earningsSummaryTitle || 'ملخص الاستحقاقات'}</h3>
            </div>
          </div>
          <div className="wn-teacher-earning-summary">
            <div><span>{an.today || 'اليوم'}</span><strong>{analytics.earnings?.daily || 0} {currencyEgp}</strong></div>
            <div><span>{an.last7Days || 'آخر 7 أيام'}</span><strong>{analytics.earnings?.weekly || 0} {currencyEgp}</strong></div>
            <div><span>{an.thisMonth || 'هذا الشهر'}</span><strong>{analytics.earnings?.monthly || 0} {currencyEgp}</strong></div>
            <div><span>{an.availableForWithdrawal || 'متاح للسحب'}</span><strong>{analytics.earnings?.available || 0} {currencyEgp}</strong></div>
          </div>
          <button type="button" onClick={onOpenWallet} className="wn-teacher-text-link min-h-[44px]">
            <span>{an.openWalletBtn || 'فتح المحفظة'}</span>
            <ForwardChevron size={15} aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}
