import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Calendar, CalendarClock, CheckCircle2,
  CreditCard, DollarSign, GraduationCap, History, MessageSquare, Radio, RefreshCw,
  ServerCog, Sparkles, Users, WalletCards,
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
  'support-unread': { icon: MessageSquare, tone: 'danger' },
  messages: { icon: Activity, tone: 'warning' },
  'guardian-links': { icon: Users, tone: 'info' },
  'overdue-sessions': { icon: Calendar, tone: 'danger' },
  'missing-session-reports': { icon: BookOpen, tone: 'warning' },
  'trial-requests': { icon: CalendarClock, tone: 'warning' },
  'awaiting-placement': { icon: Users, tone: 'warning' },
  'low-balance-subscriptions': { icon: RefreshCw, tone: 'warning' },
};

function formatAuditActionLabel(action = '', isRTL = true) {
  const key = String(action || '');
  const mapAr = {
    'teacher.approved': 'اعتماد معلم',
    'teacher.rejected': 'رفض طلب معلم',
    'teacher.updated': 'تحديث إعدادات معلم',
    'trial.assigned': 'تعيين معلم لحصة تجريبية',
    'trial.rescheduled': 'إعادة جدولة حصة تجريبية',
    'trial.assessed': 'تقييم حصة تجريبية',
    'payment.manual.approved': 'اعتماد إيصال دفع يدوي',
    'payment.manual.rejected': 'رفض إيصال دفع يدوي',
    'subscription.placed': 'تسكين طالب في حلقة',
    'finance.teacher.bonus': 'تسوية مالية / مكافأة لمعلم',
    'contact_message.replied': 'الرد على رسالة تواصل',
  };
  if (isRTL && mapAr[key]) return mapAr[key];
  return key.replace(/[._]/g, ' ');
}

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
  const livePulse = commandCenter?.livePulse || {};
  const recentAudit = Array.isArray(commandCenter?.recentAudit) ? commandCenter.recentAudit.slice(0, 6) : [];
  const liveRoomsNow = Number(livePulse.liveRoomsNow || 0);
  const todayTotal = Number(livePulse.todaySessionsTotal || 0);
  const todayCompleted = Number(livePulse.todaySessionsCompleted || 0);
  const unreadSupport = Number(livePulse.unreadSupportMessages || 0);
  const lowBalanceCount = Number(livePulse.lowBalanceSubscriptions || 0);

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

      {/* Live Daily Operations Pulse Strip */}
      <section
        aria-label={isRTL ? 'نبض التشغيل الحي اليوم' : 'Live daily operations pulse'}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
      >
        <button
          type="button"
          onClick={() => onNavigate?.('/admin?tab=sessions&focus=live')}
          className="wn-dashboard-surface p-3.5 text-start flex items-center justify-between gap-3 hover:border-[var(--wn-emerald)] transition"
        >
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
              {isRTL ? 'غرف مباشرة جارية الآن' : 'Live Classrooms Now'}
            </span>
            <strong className="text-lg font-extrabold text-[var(--wn-heading)] mt-0.5 block">
              {compactNumber(liveRoomsNow, intlLocale)}
            </strong>
            <small className="text-[0.72rem] text-[var(--wn-text-tertiary)]">
              {liveRoomsNow > 0
                ? (isRTL ? 'اضغط للمراقبة الحية الفورية' : 'Click to observe live rooms')
                : (isRTL ? 'لا توجد غرف مفتوحة اللحظة' : 'No active rooms right now')}
            </small>
          </div>
          <span className={`p-2.5 rounded-xl shrink-0 ${liveRoomsNow > 0 ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald)] animate-pulse' : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-tertiary)]'}`}>
            <Radio size={18} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('/admin?tab=sessions&focus=today')}
          className="wn-dashboard-surface p-3.5 text-start flex items-center justify-between gap-3 hover:border-[var(--wn-emerald)] transition"
        >
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
              {isRTL ? 'إنجاز حصص اليوم' : 'Today’s Sessions Progress'}
            </span>
            <strong className="text-lg font-extrabold text-[var(--wn-heading)] mt-0.5 block" dir="ltr">
              {todayCompleted} / {todayTotal}
            </strong>
            <small className="text-[0.72rem] text-[var(--wn-text-tertiary)]">
              {todayTotal > 0
                ? (isRTL ? `اكتمل ${Math.round((todayCompleted / todayTotal) * 100)}% من جدول اليوم` : `${Math.round((todayCompleted / todayTotal) * 100)}% completed today`)
                : (isRTL ? 'لا توجد حصص مجدولة اليوم' : 'No sessions scheduled today')}
            </small>
          </div>
          <span className="p-2.5 rounded-xl shrink-0 bg-[var(--wn-surface-mint)] text-[var(--wn-emerald)]">
            <CalendarClock size={18} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('/admin?tab=messages')}
          className="wn-dashboard-surface p-3.5 text-start flex items-center justify-between gap-3 hover:border-[var(--wn-emerald)] transition"
        >
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
              {isRTL ? 'دعم الطلاب الحي (غير مقروء)' : 'Unread Student Support'}
            </span>
            <strong className={`text-lg font-extrabold mt-0.5 block ${unreadSupport > 0 ? 'text-[var(--wn-status-danger-text)]' : 'text-[var(--wn-heading)]'}`}>
              {compactNumber(unreadSupport, intlLocale)}
            </strong>
            <small className="text-[0.72rem] text-[var(--wn-text-tertiary)]">
              {unreadSupport > 0
                ? (isRTL ? 'رسائل طلاب بانتظار الرد المباشر' : 'Student messages awaiting reply')
                : (isRTL ? 'كل محادثات الطلاب مقروءة' : 'All student chats caught up')}
            </small>
          </div>
          <span className={`p-2.5 rounded-xl shrink-0 ${unreadSupport > 0 ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]' : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-tertiary)]'}`}>
            <MessageSquare size={18} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('/admin/subscriptions')}
          className="wn-dashboard-surface p-3.5 text-start flex items-center justify-between gap-3 hover:border-[var(--wn-emerald)] transition"
        >
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
              {isRTL ? 'باقات قاربت على النفاد' : 'Low-Balance Subscriptions'}
            </span>
            <strong className={`text-lg font-extrabold mt-0.5 block ${lowBalanceCount > 0 ? 'text-[var(--wn-badge-gold-text)]' : 'text-[var(--wn-heading)]'}`}>
              {compactNumber(lowBalanceCount, intlLocale)}
            </strong>
            <small className="text-[0.72rem] text-[var(--wn-text-tertiary)]">
              {isRTL ? 'رصيد حصتين أو أقل (فرصة تجديد)' : '2 or fewer sessions remaining'}
            </small>
          </div>
          <span className={`p-2.5 rounded-xl shrink-0 ${lowBalanceCount > 0 ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]' : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-tertiary)]'}`}>
            <RefreshCw size={18} aria-hidden="true" />
          </span>
        </button>
      </section>

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

      {recentAudit.length > 0 ? (
        <section
          aria-label={isRTL ? 'آخر القرارات الإدارية في سجل التدقيق' : 'Recent administrative audit activity'}
          className="wn-dashboard-surface space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[var(--wn-surface-soft)] text-[var(--wn-emerald)]">
                <History size={17} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[var(--wn-heading)]">
                  {isRTL ? 'آخر العمليات الموثقة في سجل التدقيق' : 'Recent Audited Admin Decisions'}
                </h3>
                <p className="text-xs text-[var(--wn-text-secondary)]">
                  {isRTL ? 'شفافية فورية لآخر القرارات الإدارية المتخذة على المنصة.' : 'Live stream of the latest audited administrative actions.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab?.('audit')}
              className="min-h-[38px] px-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] inline-flex items-center gap-1.5"
            >
              <span>{isRTL ? 'عرض سجل التدقيق الكامل' : 'Full Audit Log'}</span>
              <DirectionArrow size={13} aria-hidden="true" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {recentAudit.map((entry) => (
              <div
                key={entry._id}
                className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-xs font-bold text-[var(--wn-heading)]">
                    {formatAuditActionLabel(entry.action, isRTL)}
                  </strong>
                  <span className="text-[0.68rem] px-2 py-0.5 rounded-full bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)] shrink-0">
                    {entry.entityType || 'admin'}
                  </span>
                </div>
                {entry.reason ? (
                  <p className="text-xs text-[var(--wn-text-secondary)] line-clamp-1">{entry.reason}</p>
                ) : null}
                <div className="flex items-center justify-between gap-2 text-[0.7rem] text-[var(--wn-text-tertiary)] pt-1 border-t border-[var(--wn-border)]">
                  <span className="truncate">{entry.actor?.name || entry.actor?.email || (isRTL ? 'مشرف' : 'Admin')}</span>
                  <span className="whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString(intlLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
