import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, CreditCard,
  Download, GraduationCap, Loader2, MessageCircle, Plus, RefreshCw, Sparkles, UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardShell from '../AdminDashboard/AdminDashboardShell';
import AdminFinanceNavStrip from '../AdminDashboard/AdminFinanceNavStrip';
import AdminQuickDossierHost from '../AdminDashboard/AdminQuickDossierHost';
import EmptyState from '../../components/shared/EmptyState';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';
import SubscriptionCircleCard from './SubscriptionCircleCard';

const DAY_KEYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? '')),
    String(template || '')
  );
}

function whatsappHref(phoneValue) {
  const raw = String(phoneValue || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

export default function AdminSubscriptions() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, dir, isRTL, t } = useI18n();
  const ps = t.payments.subscriptions;
  const intlLocale = resolveIntlLocale(locale);
  const searchInputId = useId();
  const awaitingTabId = useId();
  const circlesTabId = useId();
  const ledgerTabId = useId();
  const awaitingPanelId = useId();
  const circlesPanelId = useId();
  const ledgerPanelId = useId();
  const dossierRef = useRef(null);
  const showLoadError = toast.error;

  const [tab, setTab] = useState('awaiting');
  const [subscriptions, setSubscriptions] = useState([]);
  const [circles, setCircles] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerSummary, setLedgerSummary] = useState({
    awaitingPlacement: 0,
    activePackages: 0,
    lowBalance: 0,
    renewalQueued: 0,
    pendingPayment: 0,
    paymentReview: 0,
    paused: 0,
    scholarships: 0,
  });
  const [ledgerFocus, setLedgerFocus] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [circleStatusFilter, setCircleStatusFilter] = useState('all');
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState('');
  const [search, setSearch] = useState('');
  const [showNewCircleForm, setShowNewCircleForm] = useState(false);
  const [newCircleForm, setNewCircleForm] = useState({
    name: '',
    teacherId: '',
    planKey: 'focused',
    section: 'men_children',
    day: 'Saturday',
    startTime: '',
    endTime: '',
  });

  const planName = useCallback((item) => {
    const snap = item.pricingSnapshot;
    if (locale === 'ar' && snap?.nameAr) return snap.nameAr;
    if (locale !== 'ar' && snap?.nameEn) return snap.nameEn;
    return snap?.nameAr || snap?.nameEn || ps.planNames[item.planKey] || item.planKey;
  }, [locale, ps.planNames]);

  const teacherName = useCallback((item) => (
    item.preferredTeacher?.personalInfo?.fullName
    || item.preferredTeacher?.user?.name
    || ps.awaitingCard.teacherUnassigned
  ), [ps.awaitingCard.teacherUnassigned]);

  const loadLedger = useCallback(async (focusVal = ledgerFocus, secVal = sectionFilter) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ focus: focusVal, section: secVal });
      const res = await api.get('/api/subscriptions/admin/ledger?' + params.toString(), { auth: true });
      setLedgerRows(res.subscriptions || []);
      if (res.summary) setLedgerSummary(res.summary);
    } catch {
      // Non-blocking fallback so core placement & circle views stay operational
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerFocus, sectionFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [placements, groups] = await Promise.all([
        api.get('/api/subscriptions/admin/placements?status=awaiting_placement', { auth: true }),
        api.get('/api/subscriptions/admin/circles', { auth: true }),
      ]);
      setSubscriptions(placements.subscriptions || []);
      setCircles(groups.circles || []);
      setTeachers(groups.teachers || placements.teachers || []);
      setAllStudents(groups.students || []);
      loadLedger().catch(() => {});
    } catch (error) {
      const message = error.message || ps.loadError;
      setLoadError(message);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [showLoadError, ps.loadError, loadLedger]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  useEffect(() => {
    if (ready && tab === 'ledger') {
      loadLedger(ledgerFocus, sectionFilter);
    }
  }, [ready, tab, ledgerFocus, sectionFilter, loadLedger]);

  const formFor = (item) => forms[item._id] || {
    mode: item.compatibleCircles?.length ? 'existing' : 'new',
    existingCircleId: item.compatibleCircles?.[0]?._id || item.flexibleCircles?.[0]?._id || '',
    circleName: planName(item) + ' — ' + teacherName(item),
    teacherId: item.preferredTeacher?._id || '',
    setScheduleNow: false,
    startImmediately: false,
    day: 'Saturday',
    startTime: '18:00',
    endTime: '19:00',
    timezone: 'Africa/Cairo',
  };
  const updateForm = (item, patch) => setForms((current) => ({
    ...current,
    [item._id]: { ...formFor(item), ...patch },
  }));

  const place = async (item) => {
    if (working) return;
    const form = formFor(item);
    if ((form.mode === 'existing' || form.mode === 'flexible') && !form.existingCircleId) {
      toast.error(ps.toasts.chooseCircleError);
      return;
    }
    if (form.mode === 'new' && !form.circleName.trim()) {
      toast.error(ps.toasts.circleNameRequired);
      return;
    }
    if (form.setScheduleNow && (!form.startTime || !form.endTime || form.endTime <= form.startTime)) {
      toast.error(ps.toasts.invalidScheduleTime);
      return;
    }
    setWorking(item._id);
    try {
      const schedulePayload = form.setScheduleNow
        ? [{ day: form.day || 'Saturday', startTime: form.startTime, endTime: form.endTime }]
        : undefined;
      const payload = form.mode === 'existing' || form.mode === 'flexible'
        ? {
            existingCircleId: form.existingCircleId,
            allowFlexibleCircle: form.mode === 'flexible',
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          }
        : {
            circleName: form.circleName.trim(),
            teacherId: form.teacherId || undefined,
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          };
      const result = await api.post('/api/subscriptions/admin/' + encodeURIComponent(item._id) + '/place', payload, { auth: true });
      toast.success(result.subscriptionStatus === 'active'
        ? ps.toasts.placedActive
        : result.circleStatus === 'ready'
          ? ps.toasts.placedReady
          : ps.toasts.placedDefault);
      await load();
    } catch (error) {
      toast.error(error.message || ps.toasts.placeFailed);
    } finally {
      setWorking('');
    }
  };

  const createStandaloneCircle = async (e) => {
    e.preventDefault();
    if (working) return;
    if (!newCircleForm.name.trim()) return toast.error(ps.toasts.standaloneNameRequired);
    if (!newCircleForm.teacherId) return toast.error(ps.toasts.standaloneTeacherRequired);
    setWorking('create-circle');
    try {
      const schedule = newCircleForm.startTime && newCircleForm.endTime && newCircleForm.endTime > newCircleForm.startTime
        ? [{ day: newCircleForm.day, startTime: newCircleForm.startTime, endTime: newCircleForm.endTime }]
        : [];
      await api.post('/api/subscriptions/admin/circles', {
        name: newCircleForm.name.trim(),
        teacherId: newCircleForm.teacherId,
        planKey: newCircleForm.planKey,
        section: newCircleForm.section,
        schedule,
      }, { auth: true });
      toast.success(ps.toasts.standaloneCreated);
      setNewCircleForm({ name: '', teacherId: '', planKey: 'group', section: 'men_children', day: 'Saturday', startTime: '', endTime: '' });
      setShowNewCircleForm(false);
      await load();
    } catch (error) {
      toast.error(error.message || ps.toasts.standaloneCreateFailed);
    } finally {
      setWorking('');
    }
  };

  const compatibleNewCircleTeachers = useMemo(
    () => teachers.filter((tItem) => (
      newCircleForm.section === 'ladies'
        ? (!tItem.gender || tItem.gender === 'female')
        : true
    )),
    [teachers, newCircleForm.section]
  );

  const filteredSubscriptions = useMemo(
    () => subscriptions.filter((item) => {
      if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
      return [item.student?.name, item.student?.email, teacherName(item), planName(item)].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    }),
    [subscriptions, search, sectionFilter, teacherName, planName]
  );

  const filteredCircles = useMemo(
    () => circles.filter((circle) => {
      if (sectionFilter !== 'all' && circle.section !== sectionFilter) return false;
      if (circleStatusFilter === 'ready' && circle.status !== 'ready') return false;
      if (circleStatusFilter === 'forming' && circle.status !== 'forming') return false;
      if (circleStatusFilter === 'running' && !['active', 'full'].includes(circle.status)) return false;
      if (circleStatusFilter === 'paused' && circle.status !== 'paused') return false;
      return [circle.name, circle.code, circle.teacher?.personalInfo?.fullName, circle.teacher?.user?.name, circle.plan?.name?.ar, circle.plan?.name?.en].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    }),
    [circles, search, sectionFilter, circleStatusFilter]
  );

  const filteredLedgerRows = useMemo(
    () => ledgerRows.filter((row) => (
      [
        row.student?.name,
        row.student?.email,
        row.student?.phone,
        row.preferredTeacher?.personalInfo?.fullName,
        row.preferredTeacher?.user?.name,
        row.circle?.name,
        planName(row),
      ].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())
    )),
    [ledgerRows, search, planName]
  );

  const readyCount = circles.filter((circle) => circle.status === 'ready').length;
  const runningCount = circles.filter((circle) => ['active', 'full'].includes(circle.status)).length;

  const exportLedgerCsv = () => {
    if (!filteredLedgerRows.length) return;
    const headers = [
      'SubscriptionId',
      'Status',
      'StudentName',
      'StudentEmail',
      'StudentPhone',
      'Section',
      'Plan',
      'SessionsUsed',
      'SessionsRemaining',
      'SessionCount',
      'Amount',
      'Currency',
      'Scholarship',
      'Circle',
      'Teacher',
      'CreatedAt',
    ];
    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filteredLedgerRows.map((r) => [
      r._id,
      r.status,
      r.student?.name || '',
      r.student?.email || '',
      r.student?.phone || '',
      r.section,
      planName(r),
      r.sessionsUsed ?? 0,
      r.sessionsRemaining ?? 0,
      r.sessionCount ?? 0,
      ((Number(r.totalAmountMinor || 0)) / 100).toFixed(2),
      r.currency || 'EGP',
      r.isScholarship ? 'YES' : 'NO',
      r.circle?.name || '',
      r.preferredTeacher?.personalInfo?.fullName || r.preferredTeacher?.user?.name || '',
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
    ].map(escapeCell).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wahy-subscriptions-${ledgerFocus}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const statusBadgeForSub = (sub) => {
    const mapAr = {
      active: 'نشط بالجروب',
      placed: 'مُسكّن بانتظار بدء الجروب',
      awaiting_placement: 'مدفوع بانتظار التسكين',
      renewal_queued: 'تجديد مدفوع بالانتظار',
      payment_review: 'إيصال قيد المراجعة',
      pending_payment: 'بانتظار إتمام الدفع',
      paused: 'مجمّد مؤقتاً',
      completed: 'مكتمل الرصيد',
    };
    const mapEn = {
      active: 'Active',
      placed: 'Placed (Forming)',
      awaiting_placement: 'Awaiting Placement',
      renewal_queued: 'Queued Renewal',
      payment_review: 'Payment Review',
      pending_payment: 'Pending Checkout',
      paused: 'Paused',
      completed: 'Completed',
    };
    return (isRTL ? mapAr[sub.status] : mapEn[sub.status]) || sub.status;
  };

  const handleTabKeyDown = (event) => {
    const order = ['awaiting', 'circles', 'ledger'];
    const idx = order.indexOf(tab);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const dirStep = (event.key === 'ArrowRight' ? 1 : -1) * (isRTL ? -1 : 1);
      setTab(order[(idx + dirStep + order.length) % order.length]);
    }
  };

  if (!ready) return null;

  const handleTabChange = (nextTab) => {
    navigate(`${localizedPath('/admin', locale)}?tab=${encodeURIComponent(nextTab)}`);
  };
  const handleAdminRoute = (route) => {
    if (route === 'subscriptions') return;
    navigate(localizedPath(`/admin/${route}`, locale));
  };

  return (
    <AdminDashboardShell
      user={user}
      active="subscriptions"
      pageTitle={ps.title}
      onChange={handleTabChange}
      onNavigate={handleAdminRoute}
      onLogout={logout}
      badges={{ subscriptions: subscriptions.length }}
      search={<AdminQuickDossierHost ref={dossierRef} approvedTeachers={teachers} onChanged={load} />}
    >
      <SEOHead page={{ title: ps.seoTitle, description: ps.seoDesc, noindex: true, canonical: false }} />
      <div className="space-y-5" dir={dir}>
        <AdminFinanceNavStrip
          active="subscriptions"
          awaitingPlacementsCount={subscriptions.length}
        />

        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" onClick={() => navigate('..', { relative: 'path' })}>
            {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {ps.backToAdmin}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" onClick={() => navigate('../payments', { relative: 'path' })}>
              {ps.reviewPayments}
            </button>
            {tab === 'ledger' ? (
              <button
                type="button"
                onClick={exportLedgerCsv}
                disabled={!filteredLedgerRows.length || ledgerLoading}
                className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={15} aria-hidden="true" />
                <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
              </button>
            ) : null}
            <button type="button" className="wn-btn wn-btn--secondary min-h-[44px]" disabled={loading || Boolean(working)} onClick={load}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {ps.refresh}
            </button>
          </div>
        </div>

        {/* Live Subscription & Circle Telemetry Strip (button elements keep article selectors pristine) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => setTab('awaiting')}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'awaiting'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : (subscriptions.length > 0
                    ? 'border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]')
            }`}
          >
            <Sparkles size={16} className="text-[var(--wn-text-gold)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'بانتظار التسكين' : 'Awaiting Placement'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">{subscriptions.length}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('circles'); setCircleStatusFilter('ready'); }}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'circles' && circleStatusFilter === 'ready'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <CheckCircle2 size={16} className="text-[var(--wn-emerald)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'حلقات جاهزة للبدء' : 'Ready Circles'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-emerald)] tabular-nums">{readyCount}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('circles'); setCircleStatusFilter('running'); }}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'circles' && circleStatusFilter === 'running'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <UsersRound size={16} className="text-[var(--wn-emerald)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'حلقات جارية' : 'Running Circles'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">{runningCount}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('ledger'); setLedgerFocus('low_balance'); }}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'ledger' && ledgerFocus === 'low_balance'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : (ledgerSummary.lowBalance > 0
                    ? 'border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]')
            }`}
          >
            <Clock3 size={16} className="text-[var(--wn-status-danger-text)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'رصيد منخفض ≤ 2' : 'Low Balance ≤ 2'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">{ledgerSummary.lowBalance ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('ledger'); setLedgerFocus('renewal_queued'); }}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'ledger' && ledgerFocus === 'renewal_queued'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <RefreshCw size={16} className="text-[var(--wn-emerald)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'تجديدات بالانتظار' : 'Queued Renewals'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">{ledgerSummary.renewalQueued ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('ledger'); setLedgerFocus('pending_payment'); }}
            className={`rounded-xl border p-3.5 text-start transition cursor-pointer ${
              tab === 'ledger' && ledgerFocus === 'pending_payment'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <CreditCard size={16} className="text-[var(--wn-text-gold)] mb-1" aria-hidden="true" />
            <strong className="block text-xs text-[var(--wn-heading)]">{isRTL ? 'بانتظار إتمام الدفع' : 'Unpaid Checkouts'}</strong>
            <span className="text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">{ledgerSummary.pendingPayment ?? 0}</span>
          </button>
        </div>

        <div className="wn-dashboard-surface">
          <h2 className="font-bold text-xl flex gap-2 items-center text-[var(--wn-heading)]">
            <UsersRound aria-hidden="true" /> {ps.headerTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--wn-text-secondary)]">{ps.headerFlow}</p>
          <p className="mt-2 text-sm text-[var(--wn-text-primary)]">{ps.headerNote}</p>
          <div className="flex flex-wrap gap-2 mt-4" role="tablist" aria-label={ps.tabs.ariaLabel}>
            <button
              id={awaitingTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'awaiting'}
              aria-controls={awaitingPanelId}
              tabIndex={tab === 'awaiting' ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              className={'wn-btn min-h-[44px] ' + (tab === 'awaiting' ? 'wn-btn--primary' : 'wn-btn--secondary')}
              onClick={() => setTab('awaiting')}
            >
              {formatMsg(ps.tabs.awaiting, { count: subscriptions.length })}
            </button>
            <button
              id={circlesTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'circles'}
              aria-controls={circlesPanelId}
              tabIndex={tab === 'circles' ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              className={'wn-btn min-h-[44px] ' + (tab === 'circles' ? 'wn-btn--primary' : 'wn-btn--secondary')}
              onClick={() => setTab('circles')}
            >
              {formatMsg(ps.tabs.circles, { count: circles.length })} · {formatMsg(ps.tabs.readyCount, { count: readyCount })}
            </button>
            <button
              id={ledgerTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'ledger'}
              aria-controls={ledgerPanelId}
              tabIndex={tab === 'ledger' ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              className={'wn-btn min-h-[44px] ' + (tab === 'ledger' ? 'wn-btn--primary' : 'wn-btn--secondary')}
              onClick={() => setTab('ledger')}
            >
              {isRTL ? 'سجل الباقات والتجديدات' : 'Packages & Renewals Ledger'}
            </button>
          </div>
        </div>

        {/* Search & Section Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-8">
            <label htmlFor={searchInputId} className="block text-sm font-semibold text-[var(--wn-heading)]">
              {ps.searchLabel}
            </label>
            <input
              id={searchInputId}
              className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl p-3 mt-1"
              value={search}
              placeholder={ps.searchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-semibold text-[var(--wn-heading)]">
              {isRTL ? 'تصفية حسب القسم' : 'Section Filter'}
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl p-2.5 mt-1 text-sm"
              >
                <option value="all">{isRTL ? 'كل الأقسام' : 'All Sections'}</option>
                <option value="men_children">{ps.awaitingCard.sectionMenChildren}</option>
                <option value="ladies">{ps.awaitingCard.sectionLadies}</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4" role="status" aria-label={t.adminPortal.common.loading}>
            {[1, 2, 3].map((row) => (
              <div key={row} className="wn-dashboard-surface space-y-3">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="wn-dashboard-surface border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} aria-hidden="true" />
              <span className="font-semibold">{loadError}</span>
            </div>
            <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
              {ps.retry}
            </button>
          </div>
        ) : tab === 'circles' ? (
          <div id={circlesPanelId} role="tabpanel" aria-labelledby={circlesTabId} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: isRTL ? `الكل (${circles.length})` : `All (${circles.length})` },
                  { id: 'ready', label: isRTL ? `جاهزة للبدء (${readyCount})` : `Ready (${readyCount})` },
                  { id: 'forming', label: isRTL ? 'قيد الاكتمال' : 'Forming' },
                  { id: 'running', label: isRTL ? `جارية (${runningCount})` : `Running (${runningCount})` },
                  { id: 'paused', label: isRTL ? 'متوقفة مؤقتاً' : 'Paused' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setCircleStatusFilter(pill.id)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      circleStatusFilter === pill.id
                        ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                        : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowNewCircleForm((v) => !v)}
                className="wn-btn wn-btn--primary min-h-[44px] text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={15} aria-hidden="true" /> {showNewCircleForm ? ps.closeNewCircleBtn : ps.newCircleBtn}
              </button>
            </div>

            {showNewCircleForm ? (
              <form onSubmit={createStandaloneCircle} className="wn-dashboard-surface border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] space-y-3">
                <h3 className="font-bold text-sm text-[var(--wn-heading)]">{ps.form.title}</h3>
                <div className="grid sm:grid-cols-4 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.nameLabel}</span>
                    <input
                      required
                      type="text"
                      maxLength={120}
                      placeholder={ps.form.namePlaceholder}
                      value={newCircleForm.name}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, name: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.sectionLabel}</span>
                    <select
                      value={newCircleForm.section}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, section: e.target.value, teacherId: '' }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="men_children">{ps.awaitingCard.sectionMenChildren}</option>
                      <option value="ladies">{ps.awaitingCard.sectionLadies}</option>
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.teacherLabel}</span>
                    <select
                      required
                      value={newCircleForm.teacherId}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, teacherId: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="">{ps.form.teacherPlaceholder}</option>
                      {compatibleNewCircleTeachers.map((teacherItem) => (
                        <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.planLabel}</span>
                    <select
                      value={newCircleForm.planKey}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, planKey: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      <option value="focused">{ps.planNames.focused}</option>
                      <option value="mini">{ps.planNames.mini}</option>
                      <option value="private">{ps.planNames.private}</option>
                      <option value="private_intensive">{ps.planNames.private_intensive || (isRTL ? 'الفردية المكثّفة والإجازة (60 د)' : 'Intensive Private & Ijazah (60m)')}</option>
                      <option value="group">{ps.planNames.group}</option>
                      <option value="community">{ps.planNames.community}</option>
                    </select>
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.dayLabel}</span>
                    <select
                      value={newCircleForm.day}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, day: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    >
                      {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.startLabel}</span>
                    <input
                      type="time"
                      value={newCircleForm.startTime}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                  <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                    <span>{ps.form.endLabel}</span>
                    <input
                      type="time"
                      value={newCircleForm.endTime}
                      onChange={(e) => setNewCircleForm((p) => ({ ...p, endTime: e.target.value }))}
                      className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewCircleForm(false)} disabled={Boolean(working)} className="wn-btn wn-btn--secondary min-h-[44px] text-xs">
                    {ps.form.cancel}
                  </button>
                  <button type="submit" disabled={Boolean(working)} className="wn-btn wn-btn--primary min-h-[44px] text-xs">
                    {working === 'create-circle' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                    {working === 'create-circle' ? ps.form.submitting : ps.form.submit}
                  </button>
                </div>
              </form>
            ) : null}

            {filteredCircles.length ? filteredCircles.map((circle) => (
              <SubscriptionCircleCard
                key={circle._id}
                circle={circle}
                teachers={teachers}
                allStudents={allStudents}
                onChanged={load}
                onOpenStudent={(sId) => dossierRef.current?.openStudent(sId)}
                onOpenTeacher={(tId) => dossierRef.current?.openTeacher(tId)}
              />
            )) : (
              <div className="wn-dashboard-surface">
                <EmptyState icon={UsersRound} title={ps.emptyCircles} />
              </div>
            )}
          </div>
        ) : tab === 'ledger' ? (
          <div id={ledgerPanelId} role="tabpanel" aria-labelledby={ledgerTabId} className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: isRTL ? 'كل الباقات' : 'All Packages' },
                { id: 'low_balance', label: isRTL ? `رصيد منخفض ≤ 2 (${ledgerSummary.lowBalance ?? 0})` : `Low Balance (${ledgerSummary.lowBalance ?? 0})` },
                { id: 'renewal_queued', label: isRTL ? `تجديد بالانتظار (${ledgerSummary.renewalQueued ?? 0})` : `Queued Renewal (${ledgerSummary.renewalQueued ?? 0})` },
                { id: 'pending_payment', label: isRTL ? `سلات غير مدفوعة (${ledgerSummary.pendingPayment ?? 0})` : `Unpaid (${ledgerSummary.pendingPayment ?? 0})` },
                { id: 'payment_review', label: isRTL ? `قيد مراجعة الدفع (${ledgerSummary.paymentReview ?? 0})` : `In Review (${ledgerSummary.paymentReview ?? 0})` },
                { id: 'paused', label: isRTL ? `موقوفة مؤقتاً (${ledgerSummary.paused ?? 0})` : `Paused (${ledgerSummary.paused ?? 0})` },
                { id: 'scholarships', label: isRTL ? `منح دراسية (${ledgerSummary.scholarships ?? 0})` : `Scholarships (${ledgerSummary.scholarships ?? 0})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setLedgerFocus(pill.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    ledgerFocus === pill.id
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {ledgerLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((r) => <Skeleton key={r} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !filteredLedgerRows.length ? (
              <div className="wn-dashboard-surface">
                <EmptyState icon={CreditCard} title={isRTL ? 'لا توجد باقات مطابقة لهذا الفلتر حالياً' : 'No matching subscriptions found'} />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLedgerRows.map((sub) => {
                  const isLow = ['active', 'placed'].includes(sub.status) && Number(sub.sessionsRemaining ?? 99) <= 2;
                  const waUrl = whatsappHref(sub.student?.whatsappPhone || sub.student?.phone);
                  const tutorLabel = sub.preferredTeacher?.personalInfo?.fullName
                    || sub.preferredTeacher?.user?.name
                    || ps.awaitingCard.teacherUnassigned;

                  return (
                    <div
                      key={sub._id}
                      className="wn-dashboard-surface flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {sub.student?._id ? (
                            <button
                              type="button"
                              onClick={() => dossierRef.current?.openStudent(sub.student._id)}
                              className="font-bold text-base text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4 text-start"
                            >
                              {sub.student?.name || ps.awaitingCard.studentFallback}
                            </button>
                          ) : (
                            <strong className="text-base text-[var(--wn-heading)]">{sub.student?.name || ps.awaitingCard.studentFallback}</strong>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isLow
                                ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]'
                                : ['active', 'placed', 'renewal_queued'].includes(sub.status)
                                  ? 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]'
                                  : 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]'
                            }`}
                          >
                            {statusBadgeForSub(sub)}
                          </span>
                          {sub.isScholarship ? (
                            <span className="rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] px-2.5 py-0.5 text-xs font-bold">
                              {isRTL ? 'منحة دراسية' : 'Scholarship'}
                            </span>
                          ) : null}
                        </div>

                        <p className="text-xs text-[var(--wn-text-secondary)]">
                          {sub.student?.email}
                          {sub.student?.phone ? ` · ${sub.student.phone}` : ''}
                        </p>

                        <p className="text-sm text-[var(--wn-text-primary)] flex flex-wrap items-center gap-2">
                          <strong>{planName(sub)}</strong>
                          <span>·</span>
                          <span>{sub.section === 'ladies' ? ps.awaitingCard.sectionLadies : ps.awaitingCard.sectionMenChildren}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap size={14} aria-hidden="true" />
                            {sub.preferredTeacher?._id ? (
                              <button
                                type="button"
                                onClick={() => dossierRef.current?.openTeacher(sub.preferredTeacher._id)}
                                className="font-semibold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4"
                              >
                                {tutorLabel}
                              </button>
                            ) : (
                              <span>{tutorLabel}</span>
                            )}
                          </span>
                          {sub.circle?.name ? (
                            <span>· {sub.circle.name}</span>
                          ) : null}
                        </p>

                        <p className="text-xs text-[var(--wn-text-tertiary)]">
                          {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString(intlLocale) : ''}
                          {!sub.isScholarship ? ` · ${(Number(sub.totalAmountMinor || 0) / 100).toFixed(2)} ${sub.currency || 'EGP'}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-center rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3.5 py-2">
                          <span className="block text-xs text-[var(--wn-text-secondary)]">
                            {isRTL ? 'الرصيد المتبقي' : 'Credits Left'}
                          </span>
                          <strong className={`text-lg font-extrabold tabular-nums ${isLow ? 'text-[var(--wn-status-danger-text)]' : 'text-[var(--wn-emerald)]'}`}>
                            {sub.sessionsRemaining}/{sub.sessionCount}
                          </strong>
                        </div>

                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={isRTL ? 'متابعة عبر واتساب' : 'Follow up via WhatsApp'}
                            title={isRTL ? 'متابعة عبر واتساب' : 'Follow up via WhatsApp'}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] transition"
                          >
                            <MessageCircle size={17} aria-hidden="true" />
                          </a>
                        ) : null}

                        {sub.student?._id ? (
                          <button
                            type="button"
                            onClick={() => dossierRef.current?.openStudent(sub.student._id)}
                            className="wn-btn wn-btn--secondary min-h-[44px] text-xs"
                          >
                            {isRTL ? 'إدارة الباقة (360)' : 'Manage (360)'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div id={awaitingPanelId} role="tabpanel" aria-labelledby={awaitingTabId} className="space-y-4">
            {!filteredSubscriptions.length ? (
              <div className="wn-dashboard-surface">
                <EmptyState icon={UsersRound} title={ps.emptyAwaiting} />
              </div>
            ) : filteredSubscriptions.map((item) => {
              const form = formFor(item);
              const isPlacing = working === item._id;
              const compatibleTeachersForItem = teachers.filter((tItem) => (
                item.section === 'ladies' ? (!tItem.gender || tItem.gender === 'female') : true
              ));

              return (
                <article key={item._id} className="wn-dashboard-surface grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.student?._id ? (
                        <button
                          type="button"
                          onClick={() => dossierRef.current?.openStudent(item.student._id)}
                          className="font-bold text-lg text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4 text-start"
                        >
                          {item.student?.name || ps.awaitingCard.studentFallback}
                        </button>
                      ) : (
                        <h3 className="font-bold text-lg text-[var(--wn-heading)]">{item.student?.name || ps.awaitingCard.studentFallback}</h3>
                      )}
                      {item.isScholarship ? (
                        <span className="rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] px-2.5 py-0.5 text-xs font-bold">
                          {isRTL ? 'منحة دراسية' : 'Scholarship'}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-[var(--wn-text-secondary)]">{item.student?.email}</p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {formatMsg(ps.awaitingCard.planLine, { plan: planName(item), price: (item.pricePerSessionMinor || 0) / 100 })}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {ps.awaitingCard.preferredTutor}:{' '}
                      {item.preferredTeacher?._id ? (
                        <button
                          type="button"
                          onClick={() => dossierRef.current?.openTeacher(item.preferredTeacher._id)}
                          className="font-bold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4"
                        >
                          {teacherName(item)}
                        </button>
                      ) : (
                        <strong>{teacherName(item)}</strong>
                      )}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {ps.awaitingCard.sectionLabel}: {item.section === 'ladies' ? ps.awaitingCard.sectionLadies : ps.awaitingCard.sectionMenChildren} · {ps.awaitingCard.ageLabel}: {item.student?.age || t.adminPortal.common.dash}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {ps.awaitingCard.balanceLabel}: <strong>{item.sessionsRemaining}/{item.sessionCount} {ps.card.table.sessionUnit}</strong>
                    </p>
                    <span className="inline-block bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] rounded-lg p-2 text-sm font-semibold">
                      {ps.awaitingCard.paidBadge}
                    </span>
                  </div>
                  <div className="border border-[var(--wn-border)] rounded-xl p-4 space-y-3 bg-[var(--wn-surface-soft)]">
                    <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                      {ps.awaitingCard.placementModeLabel}
                      <select
                        className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                        value={form.mode}
                        onChange={(event) => {
                          const nextMode = event.target.value;
                          const nextCircleId = nextMode === 'existing'
                            ? (item.compatibleCircles?.[0]?._id || '')
                            : nextMode === 'flexible'
                              ? (item.flexibleCircles?.[0]?._id || '')
                              : '';
                          updateForm(item, { mode: nextMode, existingCircleId: nextCircleId });
                        }}
                      >
                        <option value="existing" disabled={!item.compatibleCircles?.length}>{ps.awaitingCard.modeExisting}</option>
                        {item.flexibleCircles?.length ? (
                          <option value="flexible">{ps.awaitingCard.modeFlexible}</option>
                        ) : null}
                        <option value="new">{ps.awaitingCard.modeNew}</option>
                      </select>
                    </label>

                    {form.mode === 'existing' ? (
                      <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                        {ps.awaitingCard.circleLabel}
                        <select
                          className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                          value={form.existingCircleId}
                          onChange={(event) => updateForm(item, { existingCircleId: event.target.value })}
                        >
                          {item.compatibleCircles?.map((circle) => (
                            <option key={circle._id} value={circle._id}>
                              {circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? ps.awaitingCard.circleOptionStatusRunning : ps.awaitingCard.circleOptionStatusForming}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : form.mode === 'flexible' ? (
                      <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                        {ps.awaitingCard.flexibleCircleLabel}
                        <select
                          className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                          value={form.existingCircleId}
                          onChange={(event) => updateForm(item, { existingCircleId: event.target.value })}
                        >
                          {item.flexibleCircles?.map((circle) => (
                            <option key={circle._id} value={circle._id}>
                              {circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? ps.awaitingCard.circleOptionStatusRunning : ps.awaitingCard.circleOptionStatusForming}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                          {ps.awaitingCard.newCircleNameLabel}
                          <input
                            className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                            maxLength={120}
                            value={form.circleName}
                            onChange={(event) => updateForm(item, { circleName: event.target.value })}
                          />
                        </label>
                        {compatibleTeachersForItem.length > 0 ? (
                          <label className="block text-sm font-semibold text-[var(--wn-heading)]">
                            {ps.awaitingCard.assignTeacherLabel}
                            <select
                              className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                              value={form.teacherId || item.preferredTeacher?._id || ''}
                              onChange={(event) => updateForm(item, { teacherId: event.target.value })}
                            >
                              {!item.preferredTeacher?._id ? <option value="">{ps.awaitingCard.selectTeacherPlaceholder}</option> : null}
                              {compatibleTeachersForItem.map((teacherItem) => <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.name}</option>)}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--wn-border)] space-y-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={Boolean(form.setScheduleNow)}
                          onChange={(e) => updateForm(item, { setScheduleNow: e.target.checked })}
                          className="w-4 h-4 accent-[var(--wn-emerald)]"
                        />
                        <span>{ps.awaitingCard.scheduleNowCheckbox}</span>
                      </label>
                      {form.setScheduleNow ? (
                        <div className="rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] p-3 space-y-2 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.dayLabel}</span>
                              <select
                                value={form.day || 'Saturday'}
                                onChange={(e) => updateForm(item, { day: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              >
                                {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                              </select>
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.fromLabel}</span>
                              <input
                                type="time"
                                value={form.startTime || '18:00'}
                                onChange={(e) => updateForm(item, { startTime: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              />
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>{ps.awaitingCard.toLabel}</span>
                              <input
                                type="time"
                                value={form.endTime || '19:00'}
                                onChange={(e) => updateForm(item, { endTime: e.target.value })}
                                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded p-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                              />
                            </label>
                          </div>
                          <label className="inline-flex items-center gap-2 font-bold text-[var(--wn-emerald)] cursor-pointer pt-1 min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={Boolean(form.startImmediately)}
                              onChange={(e) => updateForm(item, { startImmediately: e.target.checked })}
                              className="w-4 h-4 accent-[var(--wn-emerald)]"
                            />
                            <span>{ps.awaitingCard.startImmediatelyLabel}</span>
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs text-[var(--wn-text-secondary)]">{ps.awaitingCard.placementHint}</p>
                    <button
                      type="button"
                      disabled={Boolean(working)}
                      className="wn-btn wn-btn--primary wn-btn--block min-h-[44px]"
                      onClick={() => place(item)}
                    >
                      {isPlacing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                      {isPlacing ? ps.awaitingCard.placingBtn : ps.awaitingCard.placeBtn}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="text-xs text-[var(--wn-text-tertiary)]">{ps.footerNote}</p>
      </div>
    </AdminDashboardShell>
  );
}
