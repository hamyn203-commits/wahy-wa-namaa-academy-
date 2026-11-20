import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, CheckCircle2, Clock, Copy, ExternalLink, Filter, Globe,
  GraduationCap, Loader2, MessageCircle, Monitor, RefreshCw, Search,
  Smartphone, Tablet, TrendingUp, UserCheck, UserMinus, Users, UserX,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { StatCard } from '../../components/dashboard/DashboardLayout';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { resolveIntlLocale } from '../../lib/locale';

const TOOLTIP_STYLE = {
  background: 'var(--wn-chart-tooltip-bg)',
  color: 'var(--wn-chart-tooltip-text)',
  borderRadius: 'var(--wn-radius-md)',
  border: 'none',
};

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STEP_LABELS_AR = {
  1: 'البيانات الشخصية',
  2: 'تأكيد البريد',
  3: 'كلمة المرور',
  4: 'الصورة والفيديوهات',
  5: 'المراجعة والإرسال',
  6: 'تم الإرسال بنجاح',
};

const STEP_LABELS_EN = {
  1: 'Personal & Academic Info',
  2: 'Email Verification',
  3: 'Password Setup',
  4: 'Photo & Videos',
  5: 'Review & Submit',
  6: 'Submitted',
};

const PLATFORM_LABELS = {
  all: { ar: 'كل المنصات', en: 'All platforms' },
  web: { ar: 'الموقع (Web)', en: 'Web' },
  pwa: { ar: 'تطبيق ويب (PWA)', en: 'PWA' },
  android: { ar: 'أندرويد (Android)', en: 'Android' },
  ios: { ar: 'آيفون (iOS)', en: 'iOS' },
};

function formatHourLabel(hour, isRTL) {
  const h = Number(hour) || 0;
  if (!isRTL) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${suffix}`;
  }
  const suffix = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

function normalizeWhatsAppDigits(raw = '') {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  return digits;
}

function buildWhatsAppFollowUpUrl(session, isRTL) {
  const digits = normalizeWhatsAppDigits(session.whatsapp || session.phone);
  if (!digits) return '';
  const name = session.fullName ? `${session.fullName} ` : '';
  const msg = isRTL
    ? `السلام عليكم أستاذنا ${name}، لاحظنا أنك بدأت التسجيل كمعلم في أكاديمية وَحْيٌ وَنَمَاء وتوقفت عند الخطوة ${session.maxStep} من 5. يسعدنا مساعدتك في إكمال التسجيل بكل سهولة.`
    : `Assalamu Alaikum ${name}, we noticed you started your teacher application at Wahy Wa Namaa Academy (step ${session.maxStep}/5). We would be happy to help you complete it!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export default function AdminAnalyticsTab() {
  const { locale, isRTL } = useI18n();
  const toast = useToast();
  const intlLocale = resolveIntlLocale(locale);

  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState('all');
  const [funnelStatus, setFunnelStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const overviewParams = new URLSearchParams({ days: String(days), platform });
      const funnelParams = new URLSearchParams({
        days: String(days),
        platform,
        status: funnelStatus,
        page: String(page),
        limit: '20',
      });
      if (searchQuery) funnelParams.set('search', searchQuery);

      const [ov, fn] = await Promise.all([
        api.get(`/api/analytics/admin/overview?${overviewParams.toString()}`, { auth: true }),
        api.get(`/api/analytics/admin/teacher-funnel?${funnelParams.toString()}`, { auth: true }),
      ]);
      setOverview(ov);
      setFunnel(fn);
    } catch (err) {
      setError(err.message || (isRTL ? 'تعذر تحميل بيانات الزيارات والتتبع.' : 'Failed to load analytics data.'));
    } finally {
      setLoading(false);
    }
  }, [days, platform, funnelStatus, page, searchQuery, isRTL]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const copyTrackedTeacherLink = async (sourceTag = 'whatsapp') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://wahywanamaa.com';
    const url = `${origin}/${locale || 'ar'}/register/teacher?src=${sourceTag}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(isRTL ? 'تم نسخ رابط دعوة المعلمين المتتبع بنجاح!' : 'Tracked teacher invite link copied!');
    } catch {
      toast.error(isRTL ? 'تعذر النسخ التلقائي — انسخ الرابط يدوياً.' : 'Could not copy automatically.');
    }
  };

  const summary = overview?.summary || {};
  const peakHour = summary.peakHour || { hour: 0, visits: 0 };
  const peakDay = summary.peakDay || { dayOfWeek: 0, visits: 0 };
  const funnelSummary = funnel?.summary || overview?.teacherFunnelSummary || {
    total: 0, visitedOnly: 0, inProgress: 0, submitted: 0, completionRate: 0,
  };

  const hourlyData = useMemo(
    () => (overview?.hourlyDistribution || []).map((row) => ({
      ...row,
      shortHour: `${String(row.hour).padStart(2, '0')}`,
      displayHour: formatHourLabel(row.hour, isRTL),
    })),
    [overview?.hourlyDistribution, isRTL]
  );

  const dailyData = useMemo(
    () => (overview?.dailyTrend || []).map((row) => ({
      ...row,
      label: row.date.slice(5),
    })),
    [overview?.dailyTrend]
  );

  const formatDateTime = (value) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  };

  const stepLabels = isRTL ? STEP_LABELS_AR : STEP_LABELS_EN;
  const weekdayNames = isRTL ? WEEKDAYS_AR : WEEKDAYS_EN;

  const statusBadge = (status) => {
    if (status === 'submitted') {
      return {
        label: isRTL ? 'أكمل الطلب' : 'Submitted',
        cls: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]',
      };
    }
    if (status === 'in_progress') {
      return {
        label: isRTL ? 'أكمل للنصف وتوقف' : 'Stopped halfway',
        cls: 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-gold)]/40',
      };
    }
    return {
      label: isRTL ? 'دخل ولم يفعل شيئاً' : 'Visited only',
      cls: 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]',
    };
  };

  const deviceIcon = (deviceType) => {
    if (deviceType === 'mobile') return <Smartphone size={14} aria-hidden="true" />;
    if (deviceType === 'tablet') return <Tablet size={14} aria-hidden="true" />;
    return <Monitor size={14} aria-hidden="true" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Quick-Link Bar */}
      <section className="wn-dashboard-surface flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-text-gold)]">
            <Activity size={14} aria-hidden="true" />
            <span>{isRTL ? 'رادار الزيارات والتطبيقات ومسار المعلمين' : 'Traffic, App Readiness & Teacher Funnel'}</span>
          </span>
          <h2 className="text-xl font-bold text-[var(--wn-heading)] mt-1">
            {isRTL ? 'تحليلات زيارات الأكاديمية وتتبع رابط المعلمين' : 'Academy Traffic & Teacher Registration Funnel'}
          </h2>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
            {isRTL
              ? `التوقيت المعتمد لحساب ساعات الذروة: ${overview?.timezone || 'Africa/Cairo'} • جاهز للويب و PWA وتطبيقات أندرويد وآيفون.`
              : `Peak hours timezone: ${overview?.timezone || 'Africa/Cairo'} • Ready for Web, PWA, Android & iOS apps.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-1" role="group" aria-label={isRTL ? 'المدة الزمنية' : 'Time window'}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setPage(1); setDays(d); }}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition ${
                  days === d
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)]'
                    : 'text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)]'
                }`}
              >
                {isRTL ? `آخر ${d} يوم` : `${d}d`}
              </button>
            ))}
          </div>

          <select
            value={platform}
            onChange={(e) => { setPage(1); setPlatform(e.target.value); }}
            aria-label={isRTL ? 'تصفية حسب المنصة' : 'Filter by platform'}
            className="min-h-[42px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-3 text-xs font-semibold"
          >
            {Object.entries(PLATFORM_LABELS).map(([key, labels]) => (
              <option key={key} value={key}>{isRTL ? labels.ar : labels.en}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => copyTrackedTeacherLink('whatsapp')}
            className="min-h-[42px] px-3.5 rounded-xl border border-[var(--wn-gold)]/45 bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Copy size={14} aria-hidden="true" />
            <span>{isRTL ? 'نسخ رابط المعلمين (متتبع)' : 'Copy tracked teacher link'}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="min-h-[42px] px-3.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-xs font-bold inline-flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {error ? (
        <div className="wn-dashboard-surface border border-[var(--wn-danger)]/35 bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] text-sm font-semibold">
          {error}
        </div>
      ) : null}

      {/* SECTION 1: Academy Visits & Peak Hours */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            color="emerald"
            label={isRTL ? `إجمالي الزيارات (${days} يوم)` : `Total Visits (${days}d)`}
            value={summary.totalVisits || 0}
            sub={isRTL ? `المتوسط: ${summary.avgDailyVisits || 0} زيارة/يوم` : `Avg: ${summary.avgDailyVisits || 0}/day`}
          />
          <StatCard
            icon={Users}
            color="blue"
            label={isRTL ? 'الزوار الفريدون' : 'Unique Visitors'}
            value={summary.uniqueVisitors || 0}
            sub={isRTL ? `آخر 24 ساعة: ${summary.visitsLast24h || 0} زيارة` : `Last 24h: ${summary.visitsLast24h || 0} visits`}
          />
          <StatCard
            icon={Globe}
            color="teal"
            label={isRTL ? 'زيارات اليوم' : 'Today’s Visits'}
            value={summary.todayVisits || 0}
            sub={isRTL ? `${summary.todayUniqueVisitors || 0} زائر فريد اليوم` : `${summary.todayUniqueVisitors || 0} unique today`}
          />
          <StatCard
            icon={Clock}
            color="amber"
            label={isRTL ? 'أكثر وقت ذروة للزيارات' : 'Peak Visiting Hour'}
            value={peakHour.visits > 0 ? formatHourLabel(peakHour.hour, isRTL) : '—'}
            sub={
              peakHour.visits > 0
                ? (isRTL
                  ? `${peakHour.visits} زيارة • أنشط يوم: ${weekdayNames[peakDay.dayOfWeek] || ''}`
                  : `${peakHour.visits} visits • Peak day: ${weekdayNames[peakDay.dayOfWeek] || ''}`)
                : (isRTL ? 'ستظهر الذروة مع أول الزيارات' : 'Will appear with traffic')
            }
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 24-Hour Peak Visits Distribution */}
          <div className="wn-dashboard-surface">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-bold text-[var(--wn-heading)]">
                  {isRTL ? 'توزيع الزيارات على مدار 24 ساعة (أوقات الذروة)' : '24-Hour Traffic Distribution (Peak Hours)'}
                </h3>
                <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                  {isRTL ? 'العمود الذهبي يوضح أكثر ساعة يدخل فيها الزوار إلى الأكاديمية.' : 'The gold bar marks the busiest hour of the day.'}
                </p>
              </div>
              {peakHour.visits > 0 ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-gold)]/35">
                  {formatHourLabel(peakHour.hour, isRTL)}
                </span>
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--wn-border)" />
                <XAxis dataKey="shortHour" tick={{ fontSize: 11, fill: 'var(--wn-text-secondary)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--wn-text-secondary)' }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.displayHour || ''}
                  formatter={(value) => [value, isRTL ? 'الزيارات' : 'Visits']}
                />
                <Bar dataKey="visits" radius={[5, 5, 0, 0]}>
                  {hourlyData.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={
                        peakHour.visits > 0 && entry.hour === peakHour.hour
                          ? 'var(--wn-gold)'
                          : 'var(--wn-chart-1)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Trend AreaChart */}
          <div className="wn-dashboard-surface">
            <div className="mb-3">
              <h3 className="font-bold text-[var(--wn-heading)]">
                {isRTL ? 'منحنى الزيارات اليومي' : 'Daily Visits Trend'}
              </h3>
              <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                {isRTL ? 'مقارنة بين إجمالي الزيارات والزوار الفريدين يومياً.' : 'Daily total visits vs. unique visitors.'}
              </p>
            </div>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="wnVisitsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--wn-chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--wn-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--wn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--wn-text-secondary)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--wn-text-secondary)' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    name={isRTL ? 'الزيارات' : 'Visits'}
                    stroke="var(--wn-chart-1)"
                    fill="url(#wnVisitsFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="uniqueVisitors"
                    name={isRTL ? 'زوار فريدون' : 'Unique'}
                    stroke="var(--wn-gold)"
                    fill="none"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title={isRTL ? 'لا توجد زيارات مسجلة بعد' : 'No visits recorded yet'}
                description={isRTL ? 'سيبدأ الرسم البياني بالامتلاء تلقائياً مع دخول الزوار.' : 'Charts populate automatically as visitors browse.'}
              />
            )}
          </div>
        </div>

        {/* Platform Readiness (Web / PWA / Android / iOS) + Top Pages + Sources */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Platforms & Mobile App Readiness */}
          <div className="wn-dashboard-surface space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
                <Smartphone size={17} aria-hidden="true" />
                <span>{isRTL ? 'المنصات والتطبيقات' : 'Platforms & Apps'}</span>
              </h3>
              <span className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
                {isRTL ? 'جاهز لـ Android & iOS' : 'Android & iOS Ready'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(overview?.byPlatform || []).map((item) => (
                <div
                  key={item.platform}
                  className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3"
                >
                  <div className="text-xs font-semibold text-[var(--wn-text-secondary)]">
                    {isRTL ? PLATFORM_LABELS[item.platform]?.ar : PLATFORM_LABELS[item.platform]?.en}
                  </div>
                  <div className="text-lg font-extrabold text-[var(--wn-heading)] mt-1">{item.visits}</div>
                  <div className="text-[0.72rem] text-[var(--wn-text-tertiary)]">
                    {isRTL ? `${item.uniqueVisitors} زائر` : `${item.uniqueVisitors} unique`}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--wn-border)] flex flex-wrap gap-2">
              {(overview?.byDevice || []).map((d) => (
                <span
                  key={d.deviceType}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-secondary)]"
                >
                  {deviceIcon(d.deviceType)}
                  <span>{d.deviceType}: {d.visits}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Top Visited Pages */}
          <div className="wn-dashboard-surface space-y-3">
            <h3 className="font-bold text-[var(--wn-heading)]">
              {isRTL ? 'أكثر صفحات الأكاديمية زيارة' : 'Most Visited Pages'}
            </h3>
            {(overview?.topPages || []).length === 0 ? (
              <p className="text-xs text-[var(--wn-text-secondary)]">{isRTL ? 'لا توجد بيانات بعد.' : 'No data yet.'}</p>
            ) : (
              <div className="space-y-2">
                {(overview?.topPages || []).slice(0, 6).map((row) => (
                  <div key={row.path} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--wn-border)] last:border-0">
                    <span className="font-mono text-[var(--wn-text-primary)] truncate" dir="ltr">{row.path}</span>
                    <span className="font-bold text-[var(--wn-emerald-dark)] whitespace-nowrap">
                      {row.visits} <small className="font-normal text-[var(--wn-text-tertiary)]">({row.uniqueVisitors})</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Traffic Sources */}
          <div className="wn-dashboard-surface space-y-3">
            <h3 className="font-bold text-[var(--wn-heading)]">
              {isRTL ? 'مصادر الزيارات' : 'Traffic Sources'}
            </h3>
            {(overview?.topSources || []).length === 0 ? (
              <p className="text-xs text-[var(--wn-text-secondary)]">{isRTL ? 'لا توجد بيانات بعد.' : 'No data yet.'}</p>
            ) : (
              <div className="space-y-2">
                {(overview?.topSources || []).slice(0, 6).map((row) => (
                  <div key={row.source} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--wn-border)] last:border-0">
                    <span className="font-semibold text-[var(--wn-text-primary)]">{row.source || 'direct'}</span>
                    <span className="font-bold text-[var(--wn-heading)]">{row.visits}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: Teacher Registration Funnel */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[var(--wn-heading)] flex items-center gap-2">
              <GraduationCap size={20} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>{isRTL ? 'تتبّع مسار تسجيل المعلمين (مين دخل ومين كمل ومين وقف؟)' : 'Teacher Registration Funnel'}</span>
            </h3>
            <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
              {isRTL
                ? 'يعرض كل شخص فتح رابط المعلمين، وأعلى خطوة وصل لها، وبيانات التواصل للمتابعة المباشرة عبر واتساب.'
                : 'Tracks everyone who opens the teacher registration link, their furthest step, and quick WhatsApp follow-up.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyTrackedTeacherLink('facebook')}
              className="min-h-[38px] px-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] inline-flex items-center gap-1.5"
            >
              <Copy size={13} aria-hidden="true" />
              <span>{isRTL ? 'رابط فيسبوك' : 'Facebook link'}</span>
            </button>
            <button
              type="button"
              onClick={() => copyTrackedTeacherLink('telegram')}
              className="min-h-[38px] px-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] inline-flex items-center gap-1.5"
            >
              <Copy size={13} aria-hidden="true" />
              <span>{isRTL ? 'رابط تيليجرام' : 'Telegram link'}</span>
            </button>
          </div>
        </div>

        {/* 4 Funnel KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            color="blue"
            label={isRTL ? 'إجمالي من فتح رابط المعلمين' : 'Opened Teacher Link'}
            value={funnelSummary.total || 0}
            sub={isRTL ? `خلال آخر ${days} يوم` : `Last ${days} days`}
          />
          <StatCard
            icon={UserX}
            color="slate"
            label={isRTL ? 'دخل ولم يفعل شيئاً' : 'Visited Only (No Input)'}
            value={funnelSummary.visitedOnly || 0}
            sub={isRTL ? `${funnelSummary.bounceRate || 0}% من إجمالي الدخول` : `${funnelSummary.bounceRate || 0}% bounce`}
          />
          <StatCard
            icon={UserMinus}
            color="amber"
            label={isRTL ? 'أكمل للنصف وتوقف' : 'Stopped Halfway'}
            value={funnelSummary.inProgress || 0}
            sub={isRTL ? `${funnelSummary.dropOffRate || 0}% بدأوا ولم يرسلوا` : `${funnelSummary.dropOffRate || 0}% dropped off`}
          />
          <StatCard
            icon={UserCheck}
            color="emerald"
            label={isRTL ? 'أكمل وأرسل الطلب' : 'Completed & Submitted'}
            value={funnelSummary.submitted || 0}
            sub={isRTL ? `نسبة الإكمال: ${funnelSummary.completionRate || 0}%` : `Completion: ${funnelSummary.completionRate || 0}%`}
          />
        </div>

        {/* 5-Step Funnel Progress Bars */}
        <div className="wn-dashboard-surface">
          <h4 className="font-bold text-[var(--wn-heading)] mb-3">
            {isRTL ? 'أين يتوقف المعلمون داخل خطوات التسجيل؟' : 'Step-by-Step Drop-off Breakdown'}
          </h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {(funnel?.stepBreakdown || []).map((row) => {
              const total = funnelSummary.total || 1;
              const pct = Math.round((row.reached / total) * 100);
              const isFinal = row.key === 'submitted';
              return (
                <div
                  key={row.key}
                  className={`rounded-xl border p-3 flex flex-col gap-2 ${
                    isFinal
                      ? 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--wn-text-secondary)]">
                      {isFinal ? <CheckCircle2 size={14} className="text-[var(--wn-emerald)] inline" aria-hidden="true" /> : `0${row.step}`}
                    </span>
                    <span className="text-[var(--wn-heading)]">{pct}%</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--wn-heading)] leading-snug">
                    {stepLabels[row.step]}
                  </div>
                  <div className="h-2 rounded-full bg-[var(--wn-border)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isFinal ? 'bg-[var(--wn-emerald)]' : 'bg-[var(--wn-gold)]'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[0.72rem] text-[var(--wn-text-secondary)]">
                    <span>{isRTL ? `وصلوا: ${row.reached}` : `Reached: ${row.reached}`}</span>
                    {!isFinal && row.stoppedHere > 0 ? (
                      <span className="text-[var(--wn-text-danger)] font-bold">
                        {isRTL ? `توقف: ${row.stoppedHere}` : `Stopped: ${row.stoppedHere}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual Sessions Table */}
        <div className="wn-dashboard-surface space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={isRTL ? 'تصفية حالة المتقدمين' : 'Filter status'}>
              {[
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'in_progress', ar: 'أكمل للنصف وتوقف', en: 'Halfway' },
                { id: 'visited', ar: 'لم يفعل شيئاً', en: 'Visited only' },
                { id: 'submitted', ar: 'أكمل الطلب', en: 'Submitted' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setPage(1); setFunnelStatus(item.id); }}
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition ${
                    funnelStatus === item.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  <Filter size={12} aria-hidden="true" />
                  <span>{isRTL ? item.ar : item.en}</span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[230px]">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={isRTL ? 'بحث بالاسم أو الهاتف أو البريد...' : 'Search name, phone, email...'}
                className="w-full min-h-[40px] ps-9 pe-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs text-[var(--wn-text-primary)]"
              />
            </div>
          </div>

          {(funnel?.sessions || []).length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={isRTL ? 'لا توجد جلسات مسجلة في هذا التصنيف' : 'No sessions found'}
              description={isRTL ? 'عند دخول أي معلم على رابط التسجيل سيظهر هنا فوراً مع خطواته.' : 'Sessions appear here as soon as anyone opens the teacher registration link.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--wn-border)] text-[var(--wn-text-secondary)]">
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'المتقدم / الزائر' : 'Applicant / Visitor'}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'أعلى خطوة' : 'Furthest Step'}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'المصدر والمنصة' : 'Source & Platform'}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'آخر نشاط' : 'Last Active'}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{isRTL ? 'متابعة' : 'Follow-up'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--wn-border)]">
                  {(funnel?.sessions || []).map((s) => {
                    const badge = statusBadge(s.status);
                    const waUrl = buildWhatsAppFollowUpUrl(s, isRTL);
                    return (
                      <tr key={s._id || s.sessionId} className="hover:bg-[var(--wn-surface-soft)]/60">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[var(--wn-heading)]">
                            {s.fullName || (isRTL ? 'زائر لم يُدخل اسماً' : 'Anonymous visitor')}
                            {s.country ? <span className="font-normal text-[var(--wn-text-tertiary)]"> · {s.country}</span> : null}
                          </div>
                          <div className="text-[var(--wn-text-secondary)] mt-0.5 flex flex-wrap gap-2" dir="ltr">
                            {s.phone || s.whatsapp ? <span>{s.whatsapp || s.phone}</span> : null}
                            {s.email ? <span>{s.email}</span> : null}
                            {!s.phone && !s.whatsapp && !s.email ? (
                              <span className="text-[var(--wn-text-tertiary)]">{s.sessionId.slice(0, 14)}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[0.7rem] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[var(--wn-heading)]">
                            {s.maxStep} / 5 — {stepLabels[s.maxStep]}
                          </div>
                          <div className="w-28 h-1.5 rounded-full bg-[var(--wn-border)] mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.status === 'submitted' ? 'bg-[var(--wn-emerald)]' : 'bg-[var(--wn-gold)]'}`}
                              style={{ width: `${(s.maxStep / 5) * 100}%` }}
                            />
                          </div>
                          {s.filesSelectedCount > 0 ? (
                            <div className="text-[0.68rem] text-[var(--wn-text-tertiary)] mt-0.5">
                              {isRTL ? `ملفات مختارة: ${s.filesSelectedCount}` : `Files selected: ${s.filesSelectedCount}`}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3">
                          <div className="inline-flex items-center gap-1.5 font-semibold text-[var(--wn-text-primary)]">
                            {deviceIcon(s.deviceType)}
                            <span>{s.source || 'direct'}</span>
                            <span className="text-[var(--wn-text-tertiary)]">• {s.platform || 'web'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[var(--wn-text-secondary)] whitespace-nowrap">
                          {formatDateTime(s.lastActiveAt)}
                        </td>
                        <td className="py-3 px-3">
                          {waUrl && s.status !== 'submitted' ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] font-bold hover:opacity-90 whitespace-nowrap"
                            >
                              <MessageCircle size={13} aria-hidden="true" />
                              <span>{isRTL ? 'واتساب' : 'WhatsApp'}</span>
                              <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="text-[var(--wn-text-tertiary)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {funnel?.pagination?.totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2 border-t border-[var(--wn-border)] text-xs">
              <span className="text-[var(--wn-text-secondary)]">
                {isRTL
                  ? `صفحة ${funnel.pagination.page} من ${funnel.pagination.totalPages} (${funnel.pagination.total} جلسة)`
                  : `Page ${funnel.pagination.page} of ${funnel.pagination.totalPages} (${funnel.pagination.total} sessions)`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--wn-border)] disabled:opacity-40 font-semibold"
                >
                  {isRTL ? 'السابق' : 'Prev'}
                </button>
                <button
                  type="button"
                  disabled={page >= funnel.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--wn-border)] disabled:opacity-40 font-semibold"
                >
                  {isRTL ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
