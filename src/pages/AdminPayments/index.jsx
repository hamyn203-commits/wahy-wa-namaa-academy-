import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle, Clock3, Copy,
  Download, Eye, FileText, Loader2, MessageCircle, RefreshCw, RotateCw,
  Search, ShieldCheck, Wallet, XCircle, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardShell from '../AdminDashboard/AdminDashboardShell';
import AdminFinanceNavStrip from '../AdminDashboard/AdminFinanceNavStrip';
import AdminQuickDossierHost from '../AdminDashboard/AdminQuickDossierHost';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? '')),
    String(template || '')
  );
}

function amount(payment) {
  return (Number(payment.amountMinor || 0) / 100).toFixed(2) + ' ' + payment.currency;
}

function formatMinorPair(pair = {}) {
  const egp = (Number(pair.EGP || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const usd = Number(pair.USD || 0) / 100;
  return usd > 0 ? `${egp} EGP · $${usd.toFixed(2)}` : `${egp} EGP`;
}

function whatsappHref(phoneValue) {
  const raw = String(phoneValue || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

function formatBytes(bytes) {
  const num = Number(bytes || 0);
  if (!num) return '';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminPayments() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const pa = t.payments.admin;
  const intlLocale = resolveIntlLocale(locale);
  const rejectReasonId = useId();
  const proofNoteId = useId();
  const dossierRef = useRef(null);
  const showLoadError = toast.error;

  const [filter, setFilter] = useState('pending');
  const [methodFilter, setMethodFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    counts: { pending: 0, succeeded: 0, failed: 0, total: 0 },
    amountsMinor: { pending: { EGP: 0, USD: 0 }, succeeded: { EGP: 0, USD: 0 } },
    byMethod: { instapay: 0, mobile_wallet: 0, bank_transfer: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState('');
  const [loadingProofId, setLoadingProofId] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [proofModal, setProofModal] = useState(null);

  const closeProofModal = () => {
    setProofModal((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => () => {
    if (proofModal?.url) URL.revokeObjectURL(proofModal.url);
  }, [proofModal]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        status: filter,
        method: methodFilter,
        kind: kindFilter,
      });
      if (appliedQuery) params.set('q', appliedQuery);
      const result = await api.get('/api/payments/admin/manual?' + params.toString(), { auth: true });
      setPayments(result.payments || []);
      if (result.summary) setSummary(result.summary);
    } catch (error) {
      const message = error.message || pa.toasts.loadError;
      setLoadError(message);
      setPayments([]);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, methodFilter, kindFilter, appliedQuery, showLoadError, pa.toasts.loadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const copyReference = async (key, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedId(key);
      toast.success(isRTL ? 'تم نسخ مرجع التحويل' : 'Reference copied');
      window.setTimeout(() => setCopiedId((curr) => (curr === key ? '' : curr)), 2000);
    } catch {
      toast.error(isRTL ? 'تعذر النسخ التلقائي' : 'Copy failed');
    }
  };

  const review = async (payment, action, customNote) => {
    if (working) return false;
    if (action === 'reject' && customNote === undefined) {
      setRejectModal({ payment, note: '' });
      return false;
    }
    const note = customNote !== undefined ? customNote : '';

    setWorking(payment.id);
    try {
      const result = await api.patch('/api/payments/admin/manual/' + payment.id + '/review', { action, note }, { auth: true });
      toast.success(
        action === 'approve'
          ? (result.renewalQueued
              ? pa.toasts.renewalQueued
              : (result.autoPlaced || result.renewalActivated)
                ? pa.toasts.renewalActive
                : result.awaitingPlacement
                  ? pa.toasts.awaitingPlacement
                  : pa.toasts.confirmed)
          : pa.toasts.rejected
      );
      await load();
      return true;
    } catch (error) {
      toast.error(error.message || pa.toasts.reviewFailed);
      return false;
    } finally {
      setWorking('');
    }
  };

  const openProof = async (payment) => {
    if (loadingProofId) return;
    setLoadingProofId(payment.id);
    try {
      const response = await api.request('/api/payments/admin/manual/' + payment.id + '/proof', {
        auth: true,
        json: false,
        method: 'GET',
      });
      const blob = await response.blob();
      const mime = String(blob.type || '').toLowerCase();
      const url = URL.createObjectURL(blob);
      if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) {
        setProofModal((previous) => {
          if (previous?.url) URL.revokeObjectURL(previous.url);
          return {
            url,
            mime,
            payment,
            paymentId: payment.id,
            studentName: payment.student?.name || pa.card.studentFallback,
            zoom: 1,
            rotate: 0,
            note: payment.manual?.reviewNote || '',
          };
        });
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payment-proof-${payment.id}`;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.message || pa.toasts.proofError);
    } finally {
      setLoadingProofId('');
    }
  };

  const exportCsv = () => {
    if (!payments.length) return;
    const headers = [
      'ID',
      'CreatedAt',
      'Status',
      'Kind',
      'Amount',
      'Currency',
      'Method',
      'TransferReference',
      'StudentName',
      'StudentEmail',
      'StudentPhone',
      'SubmittedBy',
      'ReviewedBy',
      'ReviewNote',
    ];
    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = payments.map((p) => [
      p.id,
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
      p.status,
      p.kind,
      (Number(p.amountMinor || 0) / 100).toFixed(2),
      p.currency,
      p.manual?.method || '',
      p.manual?.transferReference || '',
      p.student?.name || '',
      p.student?.email || '',
      p.student?.phone || '',
      p.manual?.submittedBy?.email || p.student?.email || '',
      p.manual?.reviewedBy?.name || p.manual?.reviewedBy?.email || '',
      p.manual?.reviewNote || '',
    ].map(escapeCell).join(','));
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wahy-manual-payments-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const methodLabel = useCallback((method) => {
    const mapAr = {
      instapay: 'إنستاباي (InstaPay)',
      mobile_wallet: 'محفظة إلكترونية',
      bank_transfer: 'تحويل بنكي',
    };
    const mapEn = {
      instapay: 'InstaPay',
      mobile_wallet: 'Mobile Wallet',
      bank_transfer: 'Bank Transfer',
    };
    return (isRTL ? mapAr[method] : mapEn[method]) || method || t.adminPortal.common.dash;
  }, [isRTL, t.adminPortal.common.dash]);

  const hasActiveFilters = useMemo(
    () => methodFilter !== 'all' || kindFilter !== 'all' || Boolean(appliedQuery),
    [methodFilter, kindFilter, appliedQuery]
  );

  if (!ready) return null;

  const isRejecting = Boolean(rejectModal && working === rejectModal.payment.id);
  const isProofWorking = Boolean(proofModal?.payment && working === proofModal.payment.id);

  const handleTabChange = (nextTab) => {
    navigate(`${localizedPath('/admin', locale)}?tab=${encodeURIComponent(nextTab)}`);
  };
  const handleAdminRoute = (route) => {
    if (route === 'payments') return;
    navigate(localizedPath(`/admin/${route}`, locale));
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setAppliedQuery(queryInput.trim());
  };

  const resetFilters = () => {
    setMethodFilter('all');
    setKindFilter('all');
    setQueryInput('');
    setAppliedQuery('');
  };

  return (
    <AdminDashboardShell
      user={user}
      active="payments"
      pageTitle={pa.title}
      onChange={handleTabChange}
      onNavigate={handleAdminRoute}
      onLogout={logout}
      badges={{ payments: summary.counts?.pending || 0 }}
      search={<AdminQuickDossierHost ref={dossierRef} onChanged={load} />}
    >
      <SEOHead page={{ title: pa.seoTitle, description: pa.seoDesc, noindex: true, canonical: false }} />
      <div className="wn-admin-payment-readable space-y-5">
        <AdminFinanceNavStrip
          active="payments"
          pendingPaymentsCount={summary.counts?.pending || 0}
        />

        <div className="flex flex-wrap justify-between items-center gap-3">
          <button type="button" onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary min-h-[44px]">
            {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {pa.backToAdmin}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => navigate('../subscriptions', { relative: 'path' })} className="wn-btn wn-btn--primary min-h-[44px]">
              {pa.goToSubscriptions}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!payments.length || loading}
              className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={15} aria-hidden="true" />
              <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={load}
              className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px]"
              disabled={loading}
              aria-label={pa.refreshAria}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Operational Financial KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
              filter === 'pending'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : (summary.counts?.pending > 0
                    ? 'border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]')
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'إيصالات بانتظار المراجعة' : 'Pending Verification'}
              </span>
              <Clock3 size={17} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
            </div>
            <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] tabular-nums">
              {summary.counts?.pending ?? 0}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1 tabular-nums">
              {formatMinorPair(summary.amountsMinor?.pending)}
            </small>
          </button>

          <button
            type="button"
            onClick={() => setFilter('succeeded')}
            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
              filter === 'succeeded'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'تحويلات معتمدة ومحصّلة' : 'Approved Transfers'}
              </span>
              <ShieldCheck size={17} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            </div>
            <strong className="block text-2xl font-extrabold text-[var(--wn-emerald)] tabular-nums">
              {summary.counts?.succeeded ?? 0}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1 tabular-nums">
              {formatMinorPair(summary.amountsMinor?.succeeded)}
            </small>
          </button>

          <button
            type="button"
            onClick={() => setFilter('failed')}
            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
              filter === 'failed'
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'إيصالات مرفوضة' : 'Rejected Proofs'}
              </span>
              <XCircle size={17} className="text-[var(--wn-status-danger-text)]" aria-hidden="true" />
            </div>
            <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] tabular-nums">
              {summary.counts?.failed ?? 0}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1">
              {isRTL ? 'سجل الإيصالات غير المطابقة' : 'Declined or mismatched proofs'}
            </small>
          </button>

          <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 text-start">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'المعلّق حسب الوسيلة' : 'Pending by Method'}
              </span>
              <Wallet size={17} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { key: 'instapay', label: 'InstaPay', count: summary.byMethod?.instapay || 0 },
                { key: 'mobile_wallet', label: isRTL ? 'محفظة' : 'Wallet', count: summary.byMethod?.mobile_wallet || 0 },
                { key: 'bank_transfer', label: isRTL ? 'بنكي' : 'Bank', count: summary.byMethod?.bank_transfer || 0 },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setFilter('pending');
                    setMethodFilter((curr) => (curr === m.key ? 'all' : m.key));
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    methodFilter === m.key
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]'
                  }`}
                >
                  {m.label}: {m.count}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Multi-Dimensional Filters */}
        <form onSubmit={submitSearch} className="wn-dashboard-surface space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[230px] flex items-center gap-2 border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-xl px-3">
              <Search size={17} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={isRTL ? 'ابحث برقم المرجع، اسم الطالب، البريد، أو الهاتف...' : 'Search by transfer ref, student name, email, or phone...'}
                aria-label={isRTL ? 'بحث في المدفوعات اليدوية' : 'Search manual payments'}
                className="w-full min-h-[44px] py-2 bg-transparent outline-none text-sm text-[var(--wn-text-primary)]"
              />
            </div>
            <button type="submit" className="wn-btn wn-btn--primary min-h-[44px] px-5 text-sm">
              {isRTL ? 'بحث' : 'Search'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label={pa.filterAria}
              className="min-h-[42px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <option value="pending">{pa.filters.pending}</option>
              <option value="succeeded">{pa.filters.succeeded}</option>
              <option value="failed">{pa.filters.failed}</option>
              <option value="all">{pa.filters.all}</option>
            </select>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              aria-label={isRTL ? 'تصفية حسب وسيلة التحويل' : 'Filter by payment method'}
              className="min-h-[42px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <option value="all">{isRTL ? 'كل وسائل الدفع' : 'All Methods'}</option>
              <option value="instapay">InstaPay</option>
              <option value="mobile_wallet">{isRTL ? 'محفظة إلكترونية' : 'Mobile Wallet'}</option>
              <option value="bank_transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</option>
            </select>

            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label={isRTL ? 'تصفية حسب نوع الدفع' : 'Filter by payment kind'}
              className="min-h-[42px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <option value="all">{isRTL ? 'كل الأنواع (باقات + دورات)' : 'All Kinds'}</option>
              <option value="subscription">{isRTL ? 'اشتراكات الباقات والحلقات' : 'Subscriptions'}</option>
              <option value="course_enrollment">{isRTL ? 'الدورات المسجلة' : 'Courses'}</option>
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[42px] px-3 py-1.5 text-xs font-bold text-[var(--wn-link)] hover:underline"
              >
                {isRTL ? 'مسح الفلاتر' : 'Reset Filters'}
              </button>
            ) : null}
          </div>
        </form>

        {loading ? (
          <div className="space-y-4" role="status" aria-label={t.adminPortal.common.loading}>
            {[1, 2, 3].map((row) => (
              <div key={row} className="wn-dashboard-surface space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-10 w-full" />
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
              {pa.retry}
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="wn-dashboard-surface">
            <EmptyState title={pa.empty} />
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const subPlanName = locale === 'ar'
                ? (payment.subscription?.pricingSnapshot?.nameAr || payment.subscription?.pricingSnapshot?.nameEn)
                : (payment.subscription?.pricingSnapshot?.nameEn || payment.subscription?.pricingSnapshot?.nameAr);
              const courseName = locale === 'ar'
                ? (payment.course?.title?.ar || payment.course?.title?.en)
                : (payment.course?.title?.[locale] || payment.course?.title?.en || payment.course?.title?.ar);
              const isBusy = working === payment.id;
              const isProofLoading = loadingProofId === payment.id;
              const submitter = payment.manual?.submittedBy;
              const isSubmittedByGuardian = Boolean(
                submitter?._id && String(submitter._id) !== String(payment.student?._id || '')
              );
              const waUrl = whatsappHref(
                submitter?.phone || payment.student?.whatsappPhone || payment.student?.phone
              );

              return (
                <div key={payment.id} className="wn-dashboard-surface">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {payment.student?._id ? (
                          <button
                            type="button"
                            onClick={() => dossierRef.current?.openStudent(payment.student._id)}
                            className="font-bold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4 text-start"
                          >
                            {payment.student?.name || pa.card.studentFallback}
                          </button>
                        ) : (
                          <h3 className="font-bold text-[var(--wn-heading)]">{payment.student?.name || pa.card.studentFallback}</h3>
                        )}
                        <span className="rounded-full bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--wn-text-secondary)]">
                          {payment.kind === 'subscription' ? (isRTL ? 'اشتراك باقة' : 'Subscription') : (isRTL ? 'دورة مسجلة' : 'Course')}
                        </span>
                      </div>

                      <p className="text-sm text-[var(--wn-text-secondary)]">
                        {payment.student?.email}
                        {payment.student?.phone ? ` · ${payment.student.phone}` : ''}
                      </p>

                      {isSubmittedByGuardian ? (
                        <p className="text-xs rounded-lg bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] text-[var(--wn-emerald-dark)] px-2.5 py-1 inline-flex items-center gap-1.5 font-semibold">
                          <ShieldCheck size={13} aria-hidden="true" />
                          <span>
                            {isRTL
                              ? `رُفع الإيصال بواسطة ولي الأمر: ${submitter.name || submitter.email}`
                              : `Submitted by guardian: ${submitter.name || submitter.email}`}
                          </span>
                        </p>
                      ) : null}

                      <p className="text-sm font-semibold text-[var(--wn-text-primary)]">
                        {payment.kind === 'subscription'
                          ? (subPlanName || payment.subscription?.planKey || pa.card.subDefault)
                          : (courseName || payment.course?.slug)}
                      </p>

                      {payment.kind === 'subscription' ? (
                        <div className="text-xs text-[var(--wn-text-secondary)] space-y-1 rounded-lg bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] p-3 my-2">
                          {payment.subscription?.renewalOf ? (
                            <p><strong className="text-[var(--wn-emerald)]">{pa.card.renewalBadge}</strong></p>
                          ) : null}
                          <p>{pa.card.section}: <strong>{payment.subscription?.section === 'ladies' ? pa.card.sectionLadies : pa.card.sectionMenChildren}</strong></p>
                          <p>{pa.card.sessions}: <strong>{payment.subscription?.sessionCount || t.adminPortal.common.dash}</strong></p>
                          <p>
                            {pa.card.preferredTutor}:{' '}
                            {payment.subscription?.preferredTeacher?._id ? (
                              <button
                                type="button"
                                onClick={() => dossierRef.current?.openTeacher(payment.subscription.preferredTeacher._id)}
                                className="font-bold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4"
                              >
                                {payment.subscription?.preferredTeacher?.personalInfo?.fullName
                                  || payment.subscription?.preferredTeacher?.user?.name
                                  || t.adminPortal.common.dash}
                              </button>
                            ) : (
                              <strong>
                                {payment.subscription?.preferredTeacher?.personalInfo?.fullName
                                  || payment.subscription?.preferredTeacher?.user?.name
                                  || t.adminPortal.common.dash}
                              </strong>
                            )}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <p className="text-xl font-extrabold text-[var(--wn-emerald)] tabular-nums">{amount(payment)}</p>
                        <span className="rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wn-heading)]">
                          {methodLabel(payment.manual?.method)}
                        </span>
                      </div>

                      {payment.manual?.transferReference ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--wn-text-primary)]">
                          <span>{pa.card.transferRef}: <strong className="font-mono">{payment.manual.transferReference}</strong></span>
                          <button
                            type="button"
                            onClick={() => copyReference(payment.id, payment.manual.transferReference)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] text-xs font-bold inline-flex items-center gap-1"
                            title={isRTL ? 'نسخ رقم المرجع' : 'Copy reference'}
                          >
                            {copiedId === payment.id ? <Check size={13} className="text-[var(--wn-emerald)]" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                            <span>{copiedId === payment.id ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ' : 'Copy')}</span>
                          </button>
                        </div>
                      ) : null}

                      {payment.manual?.proofContentType || payment.manual?.proofShortHash ? (
                        <p className="text-xs text-[var(--wn-text-tertiary)] flex flex-wrap items-center gap-2">
                          <FileText size={13} aria-hidden="true" />
                          <span>{payment.manual?.proofContentType === 'application/pdf' ? 'PDF' : 'Image'}</span>
                          {payment.manual?.proofSize ? <span>· {formatBytes(payment.manual.proofSize)}</span> : null}
                          {payment.manual?.proofShortHash ? <span className="font-mono">· SHA:{payment.manual.proofShortHash}</span> : null}
                        </p>
                      ) : null}

                      <p className="text-xs text-[var(--wn-text-tertiary)]">
                        {new Date(payment.createdAt).toLocaleString(intlLocale)}
                        {payment.manual?.reviewedBy?.name ? ` · ${isRTL ? 'راجعه:' : 'Reviewed by:'} ${payment.manual.reviewedBy.name}` : ''}
                      </p>
                      {payment.manual?.reviewNote ? <p className="text-xs text-[var(--wn-text-secondary)]">{pa.card.reviewNote}: {payment.manual.reviewNote}</p> : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={
                        'text-xs px-3 py-1 rounded-full font-semibold ' +
                        (payment.status === 'succeeded'
                          ? 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]'
                          : payment.status === 'failed'
                            ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]'
                            : 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]')
                      }>
                        {payment.status === 'succeeded' ? pa.status.succeeded : payment.status === 'failed' ? pa.status.failed : pa.status.pending}
                      </span>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={isRTL ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
                            title={isRTL ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] transition"
                          >
                            <MessageCircle size={17} aria-hidden="true" />
                          </a>
                        ) : null}

                        {payment.proofAvailable ? (
                          <button
                            type="button"
                            onClick={() => openProof(payment)}
                            disabled={Boolean(loadingProofId)}
                            className="wn-btn wn-btn--secondary min-h-[44px]"
                          >
                            {isProofLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                            {isProofLoading ? pa.card.loadingProof : pa.card.viewProof}
                          </button>
                        ) : null}
                      </div>

                      {payment.kind === 'subscription' && payment.status === 'succeeded' ? (
                        <button type="button" onClick={() => navigate('../subscriptions', { relative: 'path' })} className="wn-btn wn-btn--primary min-h-[44px]">
                          {pa.card.goToPlacement}
                        </button>
                      ) : null}

                      {payment.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() => review(payment, 'approve')}
                            className="wn-btn wn-btn--primary min-h-[44px] disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                            {payment.kind === 'subscription' ? pa.card.approveSub : pa.card.approveCourse}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() => review(payment, 'reject')}
                            className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            <XCircle size={16} aria-hidden="true" /> {pa.card.reject}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={Boolean(rejectModal)}
        onClose={() => { if (!isRejecting) setRejectModal(null); }}
        title={pa.rejectModal.title}
        disableClose={isRejecting}
      >
        {rejectModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>
              {formatMsg(pa.rejectModal.summary, {
                name: rejectModal.payment.student?.name || pa.card.studentFallback,
                amount: amount(rejectModal.payment),
              })}
            </p>
            <div>
              <label htmlFor={rejectReasonId} className="block text-xs font-semibold text-[var(--wn-heading)] mb-1">
                {pa.rejectModal.reasonLabel}
              </label>
              <textarea
                id={rejectReasonId}
                rows={3}
                value={rejectModal.note}
                disabled={isRejecting}
                onChange={(e) => setRejectModal({ ...rejectModal, note: e.target.value })}
                className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                placeholder={pa.rejectModal.reasonPlaceholder}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => setRejectModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {pa.rejectModal.cancel}
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={async () => {
                  const { payment, note } = rejectModal;
                  const ok = await review(payment, 'reject', note.trim());
                  if (ok) setRejectModal(null);
                }}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-semibold rounded-lg bg-[var(--wn-danger)] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isRejecting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {isRejecting ? pa.rejectModal.confirming : pa.rejectModal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Side-by-Side Interactive Proof Verification & Settlement Modal */}
      <Modal
        isOpen={Boolean(proofModal)}
        onClose={() => { if (!isProofWorking) closeProofModal(); }}
        title={proofModal ? formatMsg(pa.proofModal.title, { name: proofModal.studentName }) : ''}
        maxWidth="960px"
        disableClose={isProofWorking}
      >
        {proofModal ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Proof Visual Canvas */}
            <div className="lg:col-span-7 space-y-2.5">
              {proofModal.mime !== 'application/pdf' ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setProofModal((p) => (p ? { ...p, zoom: Math.max(0.75, Number(((p.zoom || 1) - 0.25).toFixed(2))) } : p))}
                      className="min-h-[36px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold inline-flex items-center gap-1"
                    >
                      <ZoomOut size={14} aria-hidden="true" />
                    </button>
                    <span className="text-xs font-bold text-[var(--wn-heading)] px-2 tabular-nums">
                      {Math.round((proofModal.zoom || 1) * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setProofModal((p) => (p ? { ...p, zoom: Math.min(2.5, Number(((p.zoom || 1) + 0.25).toFixed(2))) } : p))}
                      className="min-h-[36px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold inline-flex items-center gap-1"
                    >
                      <ZoomIn size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProofModal((p) => (p ? { ...p, rotate: ((p.rotate || 0) + 90) % 360 } : p))}
                      className="min-h-[36px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold inline-flex items-center gap-1"
                    >
                      <RotateCw size={14} aria-hidden="true" />
                      <span>{isRTL ? 'تدوير' : 'Rotate'}</span>
                    </button>
                  </div>
                  <a
                    href={proofModal.url}
                    download={`payment-proof-${proofModal.paymentId}`}
                    className="text-xs font-bold text-[var(--wn-link)] hover:underline inline-flex items-center gap-1"
                  >
                    <Download size={13} aria-hidden="true" /> {pa.proofModal.download}
                  </a>
                </div>
              ) : null}

              <div className="p-3 rounded-xl bg-[var(--wn-surface-sunken)] border border-[var(--wn-border)] max-h-[65vh] overflow-auto flex justify-center items-center">
                {proofModal.mime === 'application/pdf' ? (
                  <div className="p-8 text-center space-y-3">
                    <FileText size={40} className="mx-auto text-[var(--wn-emerald)]" aria-hidden="true" />
                    <p className="text-sm font-semibold text-[var(--wn-heading)]">
                      {isRTL ? 'ملف إيصال بصيغة PDF' : 'PDF Payment Receipt'}
                    </p>
                    <a
                      href={proofModal.url}
                      download={`payment-proof-${proofModal.paymentId}.pdf`}
                      className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
                    >
                      <Download size={16} aria-hidden="true" /> {pa.proofModal.download}
                    </a>
                  </div>
                ) : (
                  <img
                    src={proofModal.url}
                    alt={pa.proofModal.imgAlt}
                    style={{
                      transform: `scale(${proofModal.zoom || 1}) rotate(${proofModal.rotate || 0}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 160ms ease',
                    }}
                    className="max-h-[58vh] w-auto rounded-lg object-contain"
                  />
                )}
              </div>
            </div>

            {/* Side-by-Side Reconciliation & Direct Decision */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--wn-text-tertiary)]">
                    {isRTL ? 'بيانات المطابقة المالية' : 'Reconciliation Details'}
                  </span>
                  <p className="text-2xl font-extrabold text-[var(--wn-emerald)] mt-1 tabular-nums">
                    {amount(proofModal.payment)}
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--wn-text-secondary)]">{pa.card.method}:</span>
                    <strong className="text-[var(--wn-heading)]">{methodLabel(proofModal.payment?.manual?.method)}</strong>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[var(--wn-text-secondary)]">{pa.card.transferRef}:</span>
                    {proofModal.payment?.manual?.transferReference ? (
                      <button
                        type="button"
                        onClick={() => copyReference(`modal-${proofModal.paymentId}`, proofModal.payment.manual.transferReference)}
                        className="font-mono font-bold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] inline-flex items-center gap-1"
                      >
                        <span>{proofModal.payment.manual.transferReference}</span>
                        <Copy size={12} aria-hidden="true" />
                      </button>
                    ) : (
                      <strong>{t.adminPortal.common.dash}</strong>
                    )}
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--wn-text-secondary)]">{isRTL ? 'الطالب:' : 'Student:'}</span>
                    <strong className="text-[var(--wn-heading)]">{proofModal.studentName}</strong>
                  </div>
                  {proofModal.payment?.manual?.proofShortHash ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-[var(--wn-text-secondary)]">{isRTL ? 'بصمة الإيصال:' : 'Proof SHA:'}</span>
                      <span className="font-mono text-[var(--wn-text-tertiary)]">{proofModal.payment.manual.proofShortHash}</span>
                    </div>
                  ) : null}
                </div>

                {proofModal.payment?.status === 'pending' ? (
                  <div>
                    <label htmlFor={proofNoteId} className="block text-xs font-bold text-[var(--wn-heading)] mb-1">
                      {isRTL ? 'ملاحظة المراجعة / سبب القرار (اختياري للاعتماد، يُحفظ في السجل)' : 'Review / Audit Note'}
                    </label>
                    <textarea
                      id={proofNoteId}
                      rows={2}
                      value={proofModal.note || ''}
                      disabled={isProofWorking}
                      onChange={(e) => setProofModal((p) => (p ? { ...p, note: e.target.value } : p))}
                      placeholder={isRTL ? 'مثال: تمت مطابقة التحويل في كشف InstaPay...' : 'e.g. Verified in bank/InstaPay statement...'}
                      className="w-full rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] p-2 text-xs text-[var(--wn-text-primary)]"
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 pt-3 border-t border-[var(--wn-border)]">
                {proofModal.payment?.status === 'pending' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isProofWorking}
                      onClick={async () => {
                        const ok = await review(proofModal.payment, 'approve', String(proofModal.note || '').trim());
                        if (ok) closeProofModal();
                      }}
                      className="wn-btn wn-btn--primary min-h-[44px] text-xs justify-center disabled:opacity-50"
                    >
                      {isProofWorking ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={15} aria-hidden="true" />}
                      <span>{isRTL ? 'اعتماد التحويل الآن' : 'Approve Transfer'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProofWorking}
                      onClick={async () => {
                        const ok = await review(proofModal.payment, 'reject', String(proofModal.note || '').trim());
                        if (ok) closeProofModal();
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={15} aria-hidden="true" />
                      <span>{pa.card.reject}</span>
                    </button>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button type="button" onClick={closeProofModal} disabled={isProofWorking} className="wn-btn wn-btn--secondary min-h-[42px] text-xs">
                    {pa.proofModal.close}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminDashboardShell>
  );
}
