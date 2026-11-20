import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Calendar, CalendarClock, CheckCircle2,
  CreditCard, DollarSign, GraduationCap, ServerCog, Sparkles, Users, WalletCards,
} from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg } from './adminFormat';
import TeacherReviewQueue from './TeacherReviewQueue';

const ACTION_META = {
  'teacher-review': { icon: GraduationCap, tone: 'danger' },
  'manual-payments': { icon: CreditCard, tone: 'danger' },
  payouts: { icon: WalletCards, tone: 'warning' },
  messages: { icon: Activity, tone: 'warning' },
  'guardian-links': { icon: Users, tone: 'info' },
  'overdue-sessions': { icon: Calendar, tone: 'danger' },
  'missing-session-reports': { icon: BookOpen, tone: 'warning' },
  'trial-requests': { icon: CalendarClock, tone: 'warning' },
  'awaiting-placement': { icon: Users, tone: 'warning' },
};

function compactNumber(value, intlLocale) {
  const number = Number(value || 0);
  return new Intl.NumberFormat(intlLocale, { notation: number >= 10000 ? 'compact' : 'standard' }).format(number);
}

function currency(value, intlLocale) {
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function OverviewMetric({ icon: Icon, label, value, note, tone = 'emerald', badge, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`wn-admin-exec-metric is-${tone} ${onClick ? 'is-clickable' : ''}`}
    >
      <div className="wn-admin-exec-metric__top">
        <div className="wn-admin-exec-metric__title-row">
          <span>{label}</span>
          {badge ? <span className="wn-admin-exec-metric__badge">{badge}</span> : null}
        </div>
        <span className="wn-admin-exec-metric__icon"><Icon size={19} aria-hidden="true" /></span>
      </div>
      <div className="wn-admin-exec-metric__body">
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </Tag>
  );
}

export default function AdminExecutiveHome({
  stats,
  commandCenter,
  health,
  pendingTeachers,
  loading,
  onRefreshTeachers,
  onOpenTeacher,
  onNavigate,
  onSelectTab,
}) {
  const { locale, isRTL, t } = useI18n();
  const ex = t.adminPortal.executive;
  const intlLocale = resolveIntlLocale(locale);
  const DirectionArrow = isRTL ? ArrowLeft : ArrowRight;

  const actions = commandCenter?.actions || [];
  const activePriorityActions = actions
    .filter((item) => Number(item.count || 0) > 0)
    .sort((a, b) => {
      const priority = { high: 3, medium: 2, info: 1, ok: 0 };
      return (priority[b.severity] || 0) - (priority[a.severity] || 0) || Number(b.count || 0) - Number(a.count || 0);
    });

  const features = Object.entries(health?.features || {});
  const healthyFeatures = features.filter(([, enabled]) => Boolean(enabled)).length;
  const healthPercent = features.length ? Math.round((healthyFeatures / features.length) * 100) : 100;
  const totalPending = Number(commandCenter?.summary?.totalPendingActions || 0);
  const pendingTeachersCount = Array.isArray(pendingTeachers) ? pendingTeachers.length : 0;

  const handleAction = (item) => {
    if (!item?.actionUrl) return;
    onNavigate?.(item.actionUrl);
  };

  return (
    <div id="admin-executive-content" className="wn-admin-exec-home wn-admin-exec-home--calm">
      {loading && !stats?.totalStudents && !actions.length ? (
        <div className="wn-admin-exec-metrics" role="status" aria-label={t.adminPortal.common.loading}>
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <section className="wn-admin-exec-metrics" aria-label={ex.metricsAria || 'EXECUTIVE OVERVIEW'}>
          <OverviewMetric
            icon={Users}
            label={ex.metrics.students}
            value={compactNumber(stats?.totalStudents, intlLocale)}
            note={ex.metrics.studentsNote}
            tone="emerald"
            badge={ex.metrics.studentsBadge}
            onClick={() => onNavigate?.('/admin?tab=people')}
          />
          <OverviewMetric
            icon={GraduationCap}
            label={ex.metrics.teachers}
            value={compactNumber(stats?.totalTeachers, intlLocale)}
            note={ex.metrics.teachersNote}
            tone="gold"
            badge={pendingTeachersCount > 0 ? (isRTL ? `${pendingTeachersCount} بانتظار المراجعة` : `${pendingTeachersCount} pending`) : null}
            onClick={() => onNavigate?.('/admin?tab=teachers')}
          />
          <OverviewMetric
            icon={Calendar}
            label={ex.metrics.sessions}
            value={compactNumber(stats?.totalSessions, intlLocale)}
            note={formatMsg(ex.metrics.sessionsNote, { hours: compactNumber(stats?.totalHours, intlLocale) })}
            tone="teal"
            onClick={() => onNavigate?.('/admin?tab=sessions')}
          />
          <OverviewMetric
            icon={DollarSign}
            label={ex.metrics.revenue}
            value={currency(stats?.totalEarnings, intlLocale)}
            note={ex.metrics.revenueNote}
            tone="emerald-deep"
            onClick={() => onNavigate?.('/admin/payments')}
          />
        </section>
      )}

      <section className="wn-admin-exec-workspace">
        <article id="admin-action-center" className="wn-admin-exec-panel wn-admin-exec-panel--priority">
          <header className="wn-admin-exec-panel__head">
            <div>
              <span>{ex.priority.eyebrow || 'ACTION CENTER'}</span>
              <h3>{ex.priority.title}</h3>
              <p>{ex.priority.subtitle}</p>
            </div>
            <strong className={`wn-admin-exec-count ${totalPending > 0 ? 'has-pending' : 'is-clear'}`}>
              {totalPending}
            </strong>
          </header>

          <div className="wn-admin-exec-priority-list">
            {activePriorityActions.length > 0 ? (
              activePriorityActions.map((item) => {
                const meta = ACTION_META[item.id] || { icon: Activity, tone: 'info' };
                const Icon = meta.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`is-${meta.tone}`}
                    onClick={() => handleAction(item)}
                  >
                    <span className="wn-admin-exec-priority-list__icon"><Icon size={17} aria-hidden="true" /></span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>
                        {item.severity === 'high'
                          ? ex.priority.high
                          : item.severity === 'medium'
                            ? ex.priority.medium
                            : ex.priority.review}
                      </small>
                    </span>
                    <b>{item.count}</b>
                    <DirectionArrow size={15} aria-hidden="true" />
                  </button>
                );
              })
            ) : (
              <div className="wn-admin-exec-all-clear">
                <span className="wn-admin-exec-all-clear__icon">
                  <CheckCircle2 size={24} aria-hidden="true" />
                </span>
                <div>
                  <strong>{isRTL ? 'الأكاديمية مستقرة تماماً اليوم' : 'Everything is calm and up to date'}</strong>
                  <p>
                    {ex.priority.empty || (isRTL
                      ? 'لا توجد طلبات عاجلة أو تحويلات أو حصص متأخرة بانتظار قرارك حالياً.'
                      : 'There are no urgent approvals, payouts, or overdue sessions waiting on you right now.')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <footer className="wn-admin-exec-quiet-links">
            <button type="button" onClick={() => onSelectTab?.('analytics')}>
              <Activity size={15} aria-hidden="true" />
              <span>{isRTL ? 'الزيارات ومسار المعلمين' : 'Traffic & Teacher Funnel'}</span>
            </button>
            <button type="button" onClick={() => onNavigate?.('/admin/trials')}>
              <Sparkles size={15} aria-hidden="true" />
              <span>{isRTL ? 'الحصص التجريبية' : 'Trial Bookings'}</span>
            </button>
            <button type="button" onClick={() => onNavigate?.('/admin?tab=system')}>
              <ServerCog size={15} aria-hidden="true" />
              <span>{isRTL ? `النظام والجاهزية (${healthPercent}%)` : `System & Readiness (${healthPercent}%)`}</span>
            </button>
          </footer>
        </article>

        <article className="wn-admin-exec-panel wn-admin-exec-review">
          <div className="wn-admin-exec-section-title">
            <div>
              <span>{ex.reviewSection.eyebrow}</span>
              <h3>{ex.reviewSection.title}</h3>
              <p>{ex.reviewSection.subtitle}</p>
            </div>
            <button type="button" onClick={() => onSelectTab?.('teachers')}>
              {ex.reviewSection.cta} <DirectionArrow size={14} aria-hidden="true" />
            </button>
          </div>

          <TeacherReviewQueue
            teachers={pendingTeachers}
            loading={loading}
            onRefresh={onRefreshTeachers}
            onOpenDossier={onOpenTeacher}
            compact
          />
        </article>
      </section>
    </div>
  );
}
