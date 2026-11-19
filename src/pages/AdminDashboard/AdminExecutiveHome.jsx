import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Calendar, CalendarClock, CheckCircle2,
  CreditCard, DollarSign, GraduationCap, History, ServerCog,
  ShieldCheck, Sparkles, Users, WalletCards,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg } from './adminFormat';
import LaunchReadinessPanel from './LaunchReadinessPanel';
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

const CHART_COLOR_VARS = [
  'var(--wn-chart-1)',
  'var(--wn-chart-2)',
  'var(--wn-chart-3)',
  'var(--wn-chart-4)',
  'var(--wn-chart-5)',
  'var(--wn-chart-6)',
  'var(--wn-chart-7)',
];

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

function OverviewMetric({ icon: Icon, label, value, note, tone = 'navy', badge, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`wn-admin-exec-metric is-${tone} ${onClick ? 'is-clickable' : ''}`}>
      <div className="wn-admin-exec-metric__top">
        <span className="wn-admin-exec-metric__icon"><Icon size={20} aria-hidden="true" /></span>
        {badge ? <span className="wn-admin-exec-metric__badge">{badge}</span> : null}
      </div>
      <div className="wn-admin-exec-metric__body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <i aria-hidden="true" />
    </Tag>
  );
}

function ExecEmptyNote({ children }) {
  return <div className="wn-admin-exec-empty"><CheckCircle2 size={19} aria-hidden="true" /><span>{children}</span></div>;
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
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsCompact(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const DirectionArrow = isRTL ? ArrowLeft : ArrowRight;

  const actions = commandCenter?.actions || [];
  const priorityActions = actions
    .slice()
    .sort((a, b) => {
      const priority = { high: 3, medium: 2, info: 1, ok: 0 };
      return (priority[b.severity] || 0) - (priority[a.severity] || 0) || Number(b.count || 0) - Number(a.count || 0);
    });

  const chartData = actions.map((item) => ({
    name: item.label.length > 24 ? item.label.slice(0, 24) + '…' : item.label,
    count: Number(item.count || 0),
    id: item.id,
  }));

  const features = Object.entries(health?.features || {});
  const healthyFeatures = features.filter(([, enabled]) => Boolean(enabled)).length;
  const healthPercent = features.length ? Math.round((healthyFeatures / features.length) * 100) : 0;
  const critical = Number(commandCenter?.summary?.criticalActions || 0);
  const totalPending = Number(commandCenter?.summary?.totalPendingActions || 0);

  const handleAction = (item) => {
    if (!item?.actionUrl) return;
    onNavigate?.(item.actionUrl);
  };

  const goToActions = () => {
    document.getElementById('admin-action-center')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div id="admin-executive-content" className="wn-admin-exec-home">
      <section className="wn-admin-exec-quick-actions" aria-label={ex.quickActionsAria}>
        <button type="button" onClick={() => onNavigate?.('/admin?tab=teachers')}>
          <GraduationCap size={17} aria-hidden="true" /><span><strong>{ex.quickActions.teachers}</strong><small>{ex.quickActions.teachersSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onNavigate?.('/admin?tab=sessions')}>
          <Calendar size={17} aria-hidden="true" /><span><strong>{ex.quickActions.sessions}</strong><small>{ex.quickActions.sessionsSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onNavigate?.('/admin?tab=people&focus=guardian-links')}>
          <Users size={17} aria-hidden="true" /><span><strong>{ex.quickActions.guardianLinks}</strong><small>{ex.quickActions.guardianLinksSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onNavigate?.('/admin/payments')}>
          <CreditCard size={17} aria-hidden="true" /><span><strong>{ex.quickActions.payments}</strong><small>{ex.quickActions.paymentsSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onNavigate?.('/admin/trials')}>
          <CalendarClock size={17} aria-hidden="true" /><span><strong>{ex.quickActions.trials}</strong><small>{ex.quickActions.trialsSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onNavigate?.('/admin?tab=system')}>
          <ServerCog size={17} aria-hidden="true" /><span><strong>{ex.quickActions.system}</strong><small>{ex.quickActions.systemSub}</small></span><DirectionArrow size={14} aria-hidden="true" />
        </button>
      </section>

      <section className="wn-admin-exec-hero">
        <div className="wn-admin-exec-hero__copy">
          <span><Sparkles size={14} aria-hidden="true" /> {ex.heroEyebrow || 'EXECUTIVE OVERVIEW'}</span>
          <h2>{ex.heroTitle}</h2>
          <p>{ex.heroSubtitle}</p>
        </div>
        <div className={`wn-admin-exec-hero__status ${critical ? 'is-alert' : 'is-clear'}`}>
          <span>{critical ? <AlertTriangle size={21} aria-hidden="true" /> : <ShieldCheck size={21} aria-hidden="true" />}</span>
          <div>
            <strong>{critical ? formatMsg(ex.criticalCount, { count: critical }) : ex.stableStatus}</strong>
            <small>{totalPending ? formatMsg(ex.pendingCount, { count: totalPending }) : ex.noPending}</small>
          </div>
        </div>
      </section>

      {loading && !stats?.totalStudents && !actions.length ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 my-4" role="status" aria-label={t.adminPortal.common.loading}>
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <section className="wn-admin-exec-metrics">
          <OverviewMetric
            icon={Users}
            label={ex.metrics.students}
            value={compactNumber(stats?.totalStudents, intlLocale)}
            note={ex.metrics.studentsNote}
            tone="blue"
            badge={ex.metrics.studentsBadge}
            onClick={() => onNavigate?.('/admin?tab=people')}
          />
          <OverviewMetric
            icon={GraduationCap}
            label={ex.metrics.teachers}
            value={compactNumber(stats?.totalTeachers, intlLocale)}
            note={ex.metrics.teachersNote}
            tone="gold"
            onClick={() => onNavigate?.('/admin?tab=teachers')}
          />
          <OverviewMetric
            icon={Calendar}
            label={ex.metrics.sessions}
            value={compactNumber(stats?.totalSessions, intlLocale)}
            note={formatMsg(ex.metrics.sessionsNote, { hours: compactNumber(stats?.totalHours, intlLocale) })}
            tone="green"
            onClick={() => onNavigate?.('/admin?tab=sessions')}
          />
          <OverviewMetric
            icon={DollarSign}
            label={ex.metrics.revenue}
            value={currency(stats?.totalEarnings, intlLocale)}
            note={ex.metrics.revenueNote}
            tone="purple"
            onClick={() => onNavigate?.('/admin/payments')}
          />
          <OverviewMetric
            icon={AlertTriangle}
            label={ex.metrics.interventions}
            value={compactNumber(totalPending, intlLocale)}
            note={critical ? formatMsg(ex.metrics.interventionsHigh, { count: critical }) : ex.metrics.interventionsClear}
            tone={critical ? 'red' : 'navy'}
            onClick={goToActions}
          />
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4" aria-label={ex.metricsAria}>
        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 shadow-sm flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[var(--wn-text-secondary)] block">{ex.metrics.avgSessionRevenue}</span>
            <strong className="text-lg font-extrabold text-[var(--wn-heading)] mt-0.5 block">
              {currency(stats?.totalSessions > 0 ? Math.round((stats?.totalEarnings || 0) / stats.totalSessions) : 0, intlLocale)}
            </strong>
            <small className="text-[11px] text-[var(--wn-emerald)] font-semibold">{ex.metrics.avgSessionNote}</small>
          </div>
          <span className="w-10 h-10 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald)] flex items-center justify-center shrink-0">
            <DollarSign size={18} aria-hidden="true" />
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 shadow-sm flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[var(--wn-text-secondary)] block">{ex.metrics.ratioLabel}</span>
            <strong className="text-lg font-extrabold text-[var(--wn-heading)] mt-0.5 block">
              {stats?.totalTeachers > 0
                ? formatMsg(ex.metrics.ratioValue, { ratio: Math.max(1, Math.round((stats?.totalStudents || 0) / stats.totalTeachers)) })
                : t.adminPortal.common.dash}
            </strong>
            <small className="text-[11px] text-[var(--wn-text-gold)] font-semibold">{ex.metrics.ratioNote}</small>
          </div>
          <span className="w-10 h-10 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] flex items-center justify-center shrink-0">
            <GraduationCap size={18} aria-hidden="true" />
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
              <span>{ex.metrics.stabilityLabel}</span>
              <span className="text-[var(--wn-emerald)]">{Math.max(0, 100 - Math.min(85, totalPending * 8))}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--wn-surface-sunken)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--wn-emerald)] transition-all duration-500"
                style={{ width: `${Math.max(15, 100 - Math.min(85, totalPending * 8))}%` }}
              />
            </div>
            <small className="text-[11px] text-[var(--wn-text-secondary)] mt-1 block">{ex.metrics.stabilityNote}</small>
          </div>
        </div>
      </section>

      <section className="wn-admin-exec-grid">
        <article className="wn-admin-exec-panel wn-admin-exec-panel--chart">
          <header className="wn-admin-exec-panel__head">
            <div>
              <span>{ex.chart.eyebrow || 'OPERATIONS PULSE'}</span>
              <h3>{ex.chart.title}</h3>
              <p>{ex.chart.subtitle}</p>
            </div>
            <span className="wn-admin-exec-live"><i aria-hidden="true" /> {ex.chart.live}</span>
          </header>

          {chartData.some((item) => item.count > 0) ? (
            <div className="wn-admin-exec-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--wn-chart-grid)" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--wn-chart-axis)' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isCompact ? 105 : 145}
                    orientation={isRTL ? 'right' : 'left'}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--wn-chart-axis)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--wn-chart-grid)' }}
                    contentStyle={{
                      background: 'var(--wn-chart-tooltip-bg)',
                      border: 'none',
                      borderRadius: 12,
                      color: 'var(--wn-chart-tooltip-text)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[7, 7, 7, 7]} barSize={15}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={entry.id}
                        fill={CHART_COLOR_VARS[index % CHART_COLOR_VARS.length]}
                        cursor="pointer"
                        onClick={() => handleAction(actions.find((item) => item.id === entry.id))}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ExecEmptyNote>{ex.chart.empty}</ExecEmptyNote>
          )}
        </article>

        <article id="admin-action-center" className="wn-admin-exec-panel wn-admin-exec-panel--priority">
          <header className="wn-admin-exec-panel__head">
            <div>
              <span>{ex.priority.eyebrow || 'ACTION CENTER'}</span>
              <h3>{ex.priority.title}</h3>
              <p>{ex.priority.subtitle}</p>
            </div>
            <strong className="wn-admin-exec-count">{totalPending}</strong>
          </header>

          <div className="wn-admin-exec-priority-list">
            {priorityActions.length ? priorityActions.map((item) => {
              const meta = ACTION_META[item.id] || { icon: Activity, tone: 'info' };
              const Icon = meta.icon;
              return (
                <button type="button" key={item.id} className={`is-${meta.tone}`} onClick={() => handleAction(item)}>
                  <span className="wn-admin-exec-priority-list__icon"><Icon size={17} aria-hidden="true" /></span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{Number(item.count || 0) === 0 ? ex.priority.noCases : item.severity === 'high' ? ex.priority.high : item.severity === 'medium' ? ex.priority.medium : ex.priority.review}</small>
                  </span>
                  <b>{item.count}</b>
                  <DirectionArrow size={15} aria-hidden="true" />
                </button>
              );
            }) : <ExecEmptyNote>{ex.priority.empty}</ExecEmptyNote>}
          </div>
        </article>
      </section>

      <section className="wn-admin-exec-grid wn-admin-exec-grid--secondary">
        <article
          className="wn-admin-exec-panel wn-admin-exec-system is-clickable"
          onClick={() => onNavigate?.('/admin?tab=system')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onNavigate?.('/admin?tab=system');
            }
          }}
        >
          <header className="wn-admin-exec-panel__head">
            <div>
              <span>{ex.system.eyebrow || 'SYSTEM HEALTH'}</span>
              <h3>{ex.system.title}</h3>
              <p>{ex.system.subtitle}</p>
            </div>
            <span className={`wn-admin-exec-health-score ${healthPercent === 100 ? 'is-good' : 'is-warning'}`}>
              {healthPercent}%
            </span>
          </header>

          <div className="wn-admin-exec-system__body">
            <div className="wn-admin-exec-system__ring" style={{ '--health': `${healthPercent * 3.6}deg` }}>
              <div><ServerCog size={20} aria-hidden="true" /><strong>{healthyFeatures}/{features.length || 0}</strong><small>{ex.system.activeServices}</small></div>
            </div>
            <div className="wn-admin-exec-system__features">
              {features.length ? features.map(([key, enabled]) => (
                <span key={key} className={enabled ? 'is-on' : 'is-off'}>
                  <i aria-hidden="true" /> {key}
                </span>
              )) : <small>{ex.system.unavailable}</small>}
            </div>
          </div>
        </article>

        <article className="wn-admin-exec-panel wn-admin-exec-activity">
          <header className="wn-admin-exec-panel__head">
            <div>
              <span>{ex.audit.eyebrow}</span>
              <h3>{ex.audit.title}</h3>
              <p>{ex.audit.subtitle}</p>
            </div>
            <History size={19} aria-hidden="true" />
          </header>

          <div className="wn-admin-exec-activity__list">
            {(commandCenter?.recentAudit || []).length ? (commandCenter.recentAudit || []).slice(0, 6).map((entry) => (
              <div key={entry._id}>
                <span className="wn-admin-exec-activity__dot" />
                <span>
                  <strong>{entry.actor?.name || ex.audit.actorFallback}</strong>
                  <small>{entry.action}</small>
                </span>
                <time>{new Date(entry.createdAt).toLocaleString(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            )) : <ExecEmptyNote>{ex.audit.empty}</ExecEmptyNote>}
          </div>
        </article>
      </section>

      <section className="wn-admin-exec-shortcut">
        <div>
          <span><CreditCard size={18} aria-hidden="true" /></span>
          <div>
            <strong>{ex.paymentShortcut.title}</strong>
            <small>{ex.paymentShortcut.subtitle}</small>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate?.('payments')}>
          {ex.paymentShortcut.cta} <DirectionArrow size={15} aria-hidden="true" />
        </button>
      </section>

      <section className="wn-admin-exec-review">
        <div className="wn-admin-exec-section-title">
          <div>
            <span>{ex.reviewSection.eyebrow}</span>
            <h3>{ex.reviewSection.title}</h3>
            <p>{ex.reviewSection.subtitle}</p>
          </div>
          <button type="button" onClick={() => onSelectTab?.('teachers')}>
            {ex.reviewSection.cta} <DirectionArrow size={15} aria-hidden="true" />
          </button>
        </div>

        <TeacherReviewQueue
          teachers={pendingTeachers}
          loading={loading}
          onRefresh={onRefreshTeachers}
          onOpenDossier={onOpenTeacher}
          compact
        />
      </section>

      <section className="wn-admin-exec-launch">
        <LaunchReadinessPanel />
      </section>
    </div>
  );
}
