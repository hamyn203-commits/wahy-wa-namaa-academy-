import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Check, Clock3, Copy, Download, ExternalLink,
  Landmark, Loader2, MessageCircle, PlusCircle, RefreshCw, Search, ShieldCheck,
  TrendingUp, WalletCards,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { resolveIntlLocale } from '../../lib/locale';
import AdminFinanceNavStrip from './AdminFinanceNavStrip';
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

function formatMoneyPair(egpVal = 0, usdVal = 0) {
  const egp = Number(egpVal || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const usd = Number(usdVal || 0);
  return usd !== 0 ? `${egp} EGP · $${usd.toFixed(2)}` : `${egp} EGP`;
}

function whatsappHref(phoneValue) {
  const raw = String(phoneValue || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AdminWithdrawalsTab({
  withdrawals = [],
  approvedTeachers = [],
  onReviewWithdraw,
  onReload,
  onOpenTeacher,
}) {
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const tw = t.adminPortal.tabs.withdrawals;
  const intlLocale = resolveIntlLocale(locale);

  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [ledgerModal, setLedgerModal] = useState(null);
  const [submittingLedger, setSubmittingLedger] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await api.get('/api/finance/admin/overview', { auth: true });
      setOverview(res);
    } catch {
      // Non-blocking so withdrawal queue still renders if overview fails
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, withdrawals.length]);

  const handleRefreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        loadOverview(),
        Promise.resolve(onReload?.()),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const copyValue = async (key, val) => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(String(val));
      setCopiedKey(key);
      toast.success(isRTL ? 'تم نسخ بيانات التحويل' : 'Copied to clipboard');
      window.setTimeout(() => setCopiedKey((c) => (c === key ? '' : c)), 2000);
    } catch {
      toast.error(isRTL ? 'تعذر النسخ التلقائي' : 'Copy failed');
    }
  };

  const openLedgerModal = (kind = 'bonus') => {
    setLedgerModal({
      kind,
      teacherId: approvedTeachers[0]?._id || '',
      amount: '',
      currency: 'EGP',
      reason: '',
      idempotencyKey: makeIdempotencyKey(),
    });
  };

  const submitLedgerAdjustment = async (e) => {
    e.preventDefault();
    if (!ledgerModal || submittingLedger) return;
    const numAmount = Number(ledgerModal.amount);
    if (!ledgerModal.teacherId) {
      toast.error(isRTL ? 'اختر المعلم أولاً' : 'Please select a teacher');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error(isRTL ? 'أدخل مبلغاً مالياً صحيحاً أكبر من الصفر' : 'Enter a valid positive amount');
      return;
    }
    if (String(ledgerModal.reason || '').trim().length < 3) {
      toast.error(isRTL ? 'يرجى كتابة سبب مالي واضح للتدقيق (3 أحرف على الأقل)' : 'Audit reason required (min 3 chars)');
      return;
    }

    setSubmittingLedger(true);
    try {
      const endpoint = ledgerModal.kind === 'bonus'
        ? '/api/finance/admin/bonus'
        : '/api/finance/admin/deduction';
      await api.post(endpoint, {
        teacherId: ledgerModal.teacherId,
        amount: numAmount,
        currency: ledgerModal.currency,
        reason: ledgerModal.reason.trim(),
        idempotencyKey: ledgerModal.idempotencyKey,
      }, { auth: true });
      toast.success(
        ledgerModal.kind === 'bonus'
          ? (isRTL ? 'تم تسجيل المكافأة وإضافتها لمحفظة المعلم بنجاح' : 'Bonus recorded and credited to teacher wallet')
          : (isRTL ? 'تم تسجيل القيد العكسي (الخصم) في دفتر المعلم بنجاح' : 'Deduction recorded in teacher ledger')
      );
      setLedgerModal(null);
      await handleRefreshAll();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تسجيل القيد المالي' : 'Failed to record ledger entry'));
    } finally {
      setSubmittingLedger(false);
    }
  };

  const counts = useMemo(() => {
    const out = { all: withdrawals.length, pending: 0, processing: 0, completed: 0, rejected: 0 };
    for (const w of withdrawals) {
      if (['approved', 'completed'].includes(w.status)) out.completed += 1;
      else if (w.status === 'processing') out.processing += 1;
      else if (w.status === 'rejected') out.rejected += 1;
      else out.pending += 1;
    }
    return out;
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withdrawals.filter((w) => {
      const normalizedStatus = ['approved', 'completed'].includes(w.status) ? 'completed' : (w.status || 'pending');
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      const normalizedMethod = w.method === 'bank' ? 'bank_transfer' : (w.method || w.payoutMethod || '');
      if (methodFilter !== 'all' && normalizedMethod !== methodFilter) return false;
      const curr = String(w.currency || 'EGP').toUpperCase();
      if (currencyFilter !== 'all' && curr !== currencyFilter) return false;
      if (!q) return true;
      const hay = [
        w.teacher?.user?.name,
        w.teacher?.personalInfo?.fullName,
        w.teacher?.user?.email,
        w.teacher?.user?.phone,
        w.accountInfo,
        w.referenceNumber,
        w.payoutDetails?.ipaAddress,
        w.payoutDetails?.phone,
        w.payoutDetails?.bankName,
        w.payoutDetails?.bankAccountNumber,
        w.payoutDetails?.accountHolderName,
        w.payoutDetails?.paypalEmail,
        w.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [withdrawals, statusFilter, methodFilter, currencyFilter, search]);

  const exportPayoutsCsv = () => {
    if (!filteredWithdrawals.length) return;
    const headers = [
      'PayoutId',
      'CreatedAt',
      'Status',
      'TeacherName',
      'TeacherEmail',
      'Amount',
      'Currency',
      'Method',
      'AccountDestination',
      'ReferenceNumber',
      'ReceiptUrl',
      'ProcessedAt',
      'Notes',
    ];
    const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredWithdrawals.map((w) => [
      w._id,
      w.createdAt ? new Date(w.createdAt).toISOString() : '',
      w.status,
      w.teacher?.personalInfo?.fullName || w.teacher?.user?.name || '',
      w.teacher?.user?.email || '',
      w.amount ?? 0,
      w.currency || 'EGP',
      w.method || w.payoutMethod || '',
      w.accountInfo || '',
      w.referenceNumber || '',
      w.receiptUrl || '',
      w.processedAt ? new Date(w.processedAt).toISOString() : '',
      w.notes || w.adminNote || '',
    ].map(escapeCell).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wahy-teacher-payouts-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const methodDisplay = (method) => {
    const key = method === 'bank' ? 'bank_transfer' : method;
    const mapAr = {
      instapay: 'InstaPay',
      vodafone_cash: 'محفظة إلكترونية (Vodafone Cash)',
      bank_transfer: 'تحويل بنكي (IBAN)',
      paypal: 'PayPal',
    };
    const mapEn = {
      instapay: 'InstaPay',
      vodafone_cash: 'Mobile Wallet',
      bank_transfer: 'Bank Transfer',
      paypal: 'PayPal',
    };
    return (isRTL ? mapAr[key] : mapEn[key]) || method || '—';
  };

  return (
    <div className="space-y-5">
      <AdminFinanceNavStrip
        active="withdrawals"
        pendingPayoutsCount={counts.pending + counts.processing}
      />

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--wn-heading)]">
            {isRTL ? 'مركز الخزينة ومستحقات وسحوبات المعلمين' : 'Academy Treasury & Teacher Payouts'}
          </h2>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
            {isRTL
              ? 'متابعة حية لإيرادات الأكاديمية والتزامات محافظ المعلمين ومعالجة طلبات السحب والقيود المالية الموثّقة'
              : 'Live academy revenue, teacher wallet liabilities, 3-stage payout settlement, and audited ledger adjustments'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openLedgerModal('bonus')}
            className="wn-btn wn-btn--primary min-h-[44px] text-xs inline-flex items-center gap-1.5"
          >
            <PlusCircle size={15} aria-hidden="true" />
            <span>{isRTL ? 'مكافأة أو قيد خصم لمعلم' : 'Teacher Bonus / Deduction'}</span>
          </button>
          <button
            type="button"
            onClick={exportPayoutsCsv}
            disabled={!filteredWithdrawals.length}
            className="wn-btn wn-btn--secondary min-h-[44px] text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={15} aria-hidden="true" />
            <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px]"
            aria-label={isRTL ? 'تحديث بيانات الخزينة والسحوبات' : 'Refresh treasury and payouts'}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Treasury Overview KPI Cards */}
      {loadingOverview && !overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'إجمالي الإيرادات المحصّلة' : 'Gross Collected Revenue'}
              </span>
              <TrendingUp size={17} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            </div>
            <strong className="block text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">
              {formatMoneyPair(overview.revenue?.EGP, overview.revenue?.USD)}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1">
              {isRTL
                ? `${overview.studentsBreakdown?.totalCompletedSessions ?? 0} حصة مكتملة مسجلة`
                : `${overview.studentsBreakdown?.totalCompletedSessions ?? 0} completed sessions`}
            </small>
          </div>

          <div className="rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'صافي دخل الأكاديمية' : 'Net Academy Income'}
              </span>
              <Landmark size={17} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            </div>
            <strong className="block text-xl font-extrabold text-[var(--wn-emerald)] tabular-nums">
              {formatMoneyPair(overview.netIncome?.EGP, overview.netIncome?.USD)}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1">
              {isRTL ? 'بعد خصم مستحقات المعلمين المكتسبة' : 'After accrued teacher earnings'}
            </small>
          </div>

          <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'أرصدة المعلمين المتاحة للسحب' : 'Available Teacher Liability'}
              </span>
              <ShieldCheck size={17} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
            </div>
            <strong className="block text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">
              {formatMoneyPair(overview.teacherDues?.EGP?.availableLiability, overview.teacherDues?.USD?.availableLiability)}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1 tabular-nums">
              {isRTL
                ? `تم صرفه سابقاً: ${formatMoneyPair(overview.teacherDues?.EGP?.withdrawn, overview.teacherDues?.USD?.withdrawn)}`
                : `Already paid: ${formatMoneyPair(overview.teacherDues?.EGP?.withdrawn, overview.teacherDues?.USD?.withdrawn)}`}
            </small>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter(counts.pending > 0 ? 'pending' : 'all')}
            className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
              (counts.pending + counts.processing) > 0
                ? 'border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--wn-heading)]">
                {isRTL ? 'طلبات سحب قيد المعالجة' : 'Active Payout Queue'}
              </span>
              <Clock3 size={17} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
            </div>
            <strong className="block text-xl font-extrabold text-[var(--wn-heading)] tabular-nums">
              {counts.pending + counts.processing}
            </strong>
            <small className="block text-xs text-[var(--wn-text-secondary)] mt-1 tabular-nums">
              {formatMoneyPair(overview.teacherDues?.EGP?.pendingPayouts, overview.teacherDues?.USD?.pendingPayouts)}
            </small>
          </button>
        </div>
      ) : null}

      {/* Search & Filter Controls */}
      <div className="wn-dashboard-surface space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-xl px-3">
            <Search size={16} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث باسم المعلم، البريد، حساب السحب (IPA / IBAN / هاتف)، أو رقم المرجع...' : 'Search teacher, email, IPA/IBAN/phone, or transfer ref...'}
              aria-label={isRTL ? 'بحث في طلبات سحب المعلمين' : 'Search teacher withdrawals'}
              className="w-full min-h-[42px] py-2 bg-transparent outline-none text-sm text-[var(--wn-text-primary)]"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            aria-label={isRTL ? 'تصفية حسب وسيلة السحب' : 'Filter by payout method'}
            className="min-h-[42px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--wn-text-primary)]"
          >
            <option value="all">{isRTL ? 'كل وسائل السحب' : 'All Methods'}</option>
            <option value="instapay">InstaPay</option>
            <option value="vodafone_cash">{isRTL ? 'محفظة إلكترونية' : 'Mobile Wallet'}</option>
            <option value="bank_transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</option>
            <option value="paypal">PayPal</option>
          </select>

          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            aria-label={isRTL ? 'تصفية حسب العملة' : 'Filter by currency'}
            className="min-h-[42px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--wn-text-primary)]"
          >
            <option value="all">{isRTL ? 'كل العملات' : 'All Currencies'}</option>
            <option value="EGP">EGP</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: isRTL ? `الكل (${counts.all})` : `All (${counts.all})` },
            { id: 'pending', label: isRTL ? `بانتظار المراجعة (${counts.pending})` : `Pending (${counts.pending})` },
            { id: 'processing', label: isRTL ? `جاري التحويل (${counts.processing})` : `Processing (${counts.processing})` },
            { id: 'completed', label: isRTL ? `مكتملة (${counts.completed})` : `Completed (${counts.completed})` },
            { id: 'rejected', label: isRTL ? `مرفوضة (${counts.rejected})` : `Rejected (${counts.rejected})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                statusFilter === pill.id
                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                  : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <div className="wn-dashboard-surface">
          <EmptyState icon={WalletCards} title={tw.empty} />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWithdrawals.map((w) => {
            const teacherId = w.teacher?._id;
            const teacherName = w.teacher?.personalInfo?.fullName || w.teacher?.user?.name || t.adminPortal.dossiers.reviewQueue.teacherFallback;
            const statusText = ['approved', 'completed'].includes(w.status)
              ? tw.statuses.approved
              : w.status === 'rejected'
                ? tw.statuses.rejected
                : w.status === 'processing'
                  ? tw.statuses.processing
                  : tw.statuses.pending;
            const waUrl = whatsappHref(w.teacher?.user?.whatsappPhone || w.teacher?.user?.phone || w.payoutDetails?.phone);
            const copyTarget = w.payoutDetails?.ipaAddress
              || w.payoutDetails?.bankAccountNumber
              || w.payoutDetails?.phone
              || w.payoutDetails?.paypalEmail
              || w.accountInfo;

            return (
              <div key={w._id} className="wn-dashboard-surface flex flex-wrap justify-between items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {teacherId && onOpenTeacher ? (
                      <button
                        type="button"
                        onClick={() => onOpenTeacher(teacherId)}
                        className="font-bold text-base text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4 text-start"
                      >
                        {teacherName}
                      </button>
                    ) : (
                      <p className="font-bold text-base text-[var(--wn-heading)]">{teacherName}</p>
                    )}
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)]">
                      {w.source === 'ledger' ? tw.ledgerSource : tw.legacySource}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--wn-text-secondary)]">
                    {w.teacher?.user?.email}
                    {w.teacher?.user?.phone ? ` · ${w.teacher.user.phone}` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <p className="text-xl font-extrabold text-[var(--wn-emerald)] tabular-nums">
                      {w.amount} {w.currency || 'EGP'}
                    </p>
                    <span className="rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wn-heading)]">
                      {methodDisplay(w.method || w.payoutMethod)}
                    </span>
                  </div>

                  {/* Structured Payout Destination with 1-Click Copy */}
                  {(copyTarget || w.payoutDetails?.bankName || w.payoutDetails?.accountHolderName) ? (
                    <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-2.5 text-xs space-y-1 max-w-xl">
                      {w.payoutDetails?.bankName ? (
                        <p className="text-[var(--wn-text-primary)]">
                          <strong>{isRTL ? 'البنك:' : 'Bank:'}</strong> {w.payoutDetails.bankName}
                          {w.payoutDetails?.accountHolderName ? ` · ${w.payoutDetails.accountHolderName}` : ''}
                        </p>
                      ) : null}
                      {copyTarget ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[var(--wn-heading)] break-all">{copyTarget}</span>
                          <button
                            type="button"
                            onClick={() => copyValue(w._id, copyTarget)}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)] font-bold inline-flex items-center gap-1 shrink-0"
                          >
                            {copiedKey === w._id ? <Check size={13} className="text-[var(--wn-emerald)]" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                            <span>{copiedKey === w._id ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الحساب' : 'Copy')}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {w.referenceNumber && (
                    <p className="text-xs text-[var(--wn-emerald)] font-semibold">
                      {formatMsg(tw.transferRef, { ref: w.referenceNumber })}
                    </p>
                  )}

                  {w.receiptUrl ? (
                    <a
                      href={w.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[var(--wn-link)] hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      <span>{isRTL ? 'عرض إيصال التحويل المرفق' : 'View Transfer Receipt'}</span>
                    </a>
                  ) : null}

                  {(w.notes || w.adminNote) && (
                    <p className="text-xs text-[var(--wn-text-secondary)]">
                      {formatMsg(tw.notes, { notes: w.notes || w.adminNote })}
                    </p>
                  )}

                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {w.createdAt ? new Date(w.createdAt).toLocaleString(intlLocale) : ''}
                    {w.processedBy?.name ? ` · ${isRTL ? 'بواسطة:' : 'By:'} ${w.processedBy.name}` : ''}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadgeClass(w.status)}`}>
                    {statusText}
                  </span>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={isRTL ? 'تواصل مع المعلم عبر واتساب' : 'Message teacher on WhatsApp'}
                        title={isRTL ? 'تواصل مع المعلم عبر واتساب' : 'Message teacher on WhatsApp'}
                        className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] transition"
                      >
                        <MessageCircle size={16} aria-hidden="true" />
                      </a>
                    ) : null}

                    {w.status === 'pending' && w.source === 'ledger' ? (
                      <button
                        type="button"
                        onClick={() => onReviewWithdraw(w, 'processing')}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[var(--wn-status-info-border)] bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] text-xs font-bold"
                      >
                        {isRTL ? 'بدء التحويل (حجز للعمل)' : 'Mark Processing'}
                      </button>
                    ) : null}

                    {['pending', 'processing'].includes(w.status) && (
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
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher Bonus / Deduction Audited Ledger Modal */}
      <Modal
        isOpen={Boolean(ledgerModal)}
        onClose={() => { if (!submittingLedger) setLedgerModal(null); }}
        title={isRTL ? 'تسجيل مكافأة أو قيد خصم في دفتر المعلم' : 'Record Teacher Bonus or Deduction'}
        disableClose={submittingLedger}
        maxWidth="500px"
      >
        {ledgerModal ? (
          <form onSubmit={submitLedgerAdjustment} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLedgerModal((p) => ({ ...p, kind: 'bonus' }))}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                  ledgerModal.kind === 'bonus'
                    ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]'
                }`}
              >
                <ArrowUpCircle size={15} aria-hidden="true" />
                <span>{isRTL ? 'مكافأة مالية (+)' : 'Bonus (+)'}</span>
              </button>
              <button
                type="button"
                onClick={() => setLedgerModal((p) => ({ ...p, kind: 'deduction' }))}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                  ledgerModal.kind === 'deduction'
                    ? 'border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]'
                }`}
              >
                <ArrowDownCircle size={15} aria-hidden="true" />
                <span>{isRTL ? 'قيد خصم إداري (-)' : 'Deduction (-)'}</span>
              </button>
            </div>

            <label className="block text-xs font-bold text-[var(--wn-heading)] space-y-1">
              <span>{isRTL ? 'المعلم المستهدف' : 'Teacher'}</span>
              <select
                required
                value={ledgerModal.teacherId}
                onChange={(e) => setLedgerModal((p) => ({ ...p, teacherId: e.target.value }))}
                className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
              >
                <option value="">{isRTL ? 'اختر المعلم...' : 'Select teacher...'}</option>
                {approvedTeachers.map((tItem) => (
                  <option key={tItem._id} value={tItem._id}>
                    {tItem.personalInfo?.fullName || tItem.user?.name || tItem._id}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 block text-xs font-bold text-[var(--wn-heading)] space-y-1">
                <span>{isRTL ? 'المبلغ' : 'Amount'}</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  value={ledgerModal.amount}
                  onChange={(e) => setLedgerModal((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="100"
                  className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
                />
              </label>
              <label className="block text-xs font-bold text-[var(--wn-heading)] space-y-1">
                <span>{isRTL ? 'العملة' : 'Currency'}</span>
                <select
                  value={ledgerModal.currency}
                  onChange={(e) => setLedgerModal((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
                >
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-bold text-[var(--wn-heading)] space-y-1">
              <span>{isRTL ? 'سبب القيد في سجل التدقيق (إلزامي)' : 'Mandatory Audit Reason'}</span>
              <textarea
                required
                minLength={3}
                rows={3}
                value={ledgerModal.reason}
                onChange={(e) => setLedgerModal((p) => ({ ...p, reason: e.target.value }))}
                placeholder={
                  ledgerModal.kind === 'bonus'
                    ? (isRTL ? 'مثال: مكافأة التزام وتميز شهر نوفمبر...' : 'e.g. Monthly excellence bonus...')
                    : (isRTL ? 'مثال: تسوية حصة مسجلة بالخطأ رقم...' : 'e.g. Reversal for duplicate session...')
                }
                className="w-full rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] p-2.5 text-sm text-[var(--wn-text-primary)]"
              />
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={submittingLedger}
                onClick={() => setLedgerModal(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)]"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingLedger}
                className={`min-h-[44px] px-5 py-2 rounded-lg text-xs font-bold text-[var(--wn-text-inverse)] inline-flex items-center gap-2 disabled:opacity-50 ${
                  ledgerModal.kind === 'bonus' ? 'bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)]' : 'bg-[var(--wn-danger)]'
                }`}
              >
                {submittingLedger ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                <span>
                  {ledgerModal.kind === 'bonus'
                    ? (isRTL ? 'اعتماد وإضافة المكافأة' : 'Credit Bonus')
                    : (isRTL ? 'اعتماد القيد العكسي' : 'Record Deduction')}
                </span>
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
