import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Eye, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardShell from '../AdminDashboard/AdminDashboardShell';
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

export default function AdminPayments() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const pa = t.payments.admin;
  const intlLocale = resolveIntlLocale(locale);
  const rejectReasonId = useId();
  const dossierRef = useRef(null);
  const showLoadError = toast.error;
  const [filter, setFilter] = useState('pending');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState('');
  const [loadingProofId, setLoadingProofId] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [proofModal, setProofModal] = useState(null);

  const closeProofModal = useCallback(() => {
    setProofModal((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => {
    if (proofModal?.url) URL.revokeObjectURL(proofModal.url);
  }, [proofModal]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.get('/api/payments/admin/manual?status=' + encodeURIComponent(filter), { auth: true });
      setPayments(result.payments || []);
    } catch (error) {
      const message = error.message || pa.toasts.loadError;
      setLoadError(message);
      setPayments([]);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, showLoadError, pa.toasts.loadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

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
      if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        setProofModal((previous) => {
          if (previous?.url) URL.revokeObjectURL(previous.url);
          return { url, paymentId: payment.id, studentName: payment.student?.name || pa.card.studentFallback };
        });
        return;
      }
      const ext = mime === 'application/pdf' ? '.pdf' : '';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payment-proof-${payment.id}${ext}`;
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

  if (!ready) return null;

  const isRejecting = Boolean(rejectModal && working === rejectModal.payment.id);

  const handleTabChange = (nextTab) => {
    navigate(`${localizedPath('/admin', locale)}?tab=${encodeURIComponent(nextTab)}`);
  };
  const handleAdminRoute = (route) => {
    if (route === 'payments') return;
    navigate(localizedPath(`/admin/${route}`, locale));
  };

  return (
    <AdminDashboardShell
      user={user}
      active="payments"
      pageTitle={pa.title}
      onChange={handleTabChange}
      onNavigate={handleAdminRoute}
      onLogout={logout}
      search={<AdminQuickDossierHost ref={dossierRef} onChanged={load} />}
    >
      <SEOHead page={{ title: pa.seoTitle, description: pa.seoDesc, noindex: true, canonical: false }} />
      <div className="wn-admin-payment-readable">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <button type="button" onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary min-h-[44px]">
            {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {pa.backToAdmin}
          </button>
          <button type="button" onClick={() => navigate('../subscriptions', { relative: 'path' })} className="wn-btn wn-btn--primary min-h-[44px]">
            {pa.goToSubscriptions}
          </button>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label={pa.filterAria}
              className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
            >
              <option value="pending">{pa.filters.pending}</option>
              <option value="succeeded">{pa.filters.succeeded}</option>
              <option value="failed">{pa.filters.failed}</option>
              <option value="all">{pa.filters.all}</option>
            </select>
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

              return (
                <div key={payment.id} className="wn-dashboard-surface">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="space-y-1">
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
                      <p className="text-sm text-[var(--wn-text-secondary)]">{payment.student?.email}</p>
                      <p className="text-sm text-[var(--wn-text-primary)]">
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
                      <p className="text-xl font-bold text-[var(--wn-emerald)]">{amount(payment)}</p>
                      <p className="text-sm text-[var(--wn-text-primary)]">{pa.card.method}: <strong>{payment.manual?.method || t.adminPortal.common.dash}</strong></p>
                      {payment.manual?.transferReference ? <p className="text-sm text-[var(--wn-text-primary)]">{pa.card.transferRef}: <strong>{payment.manual.transferReference}</strong></p> : null}
                      <p className="text-xs text-[var(--wn-text-tertiary)]">{new Date(payment.createdAt).toLocaleString(intlLocale)}</p>
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

      <Modal
        isOpen={Boolean(proofModal)}
        onClose={closeProofModal}
        title={proofModal ? formatMsg(pa.proofModal.title, { name: proofModal.studentName }) : ''}
        maxWidth="680px"
      >
        {proofModal ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[var(--wn-surface-sunken)] border border-[var(--wn-border)] max-h-[70vh] overflow-auto flex justify-center">
              <img src={proofModal.url} alt={pa.proofModal.imgAlt} className="max-h-[62vh] w-auto rounded-lg object-contain" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <a href={proofModal.url} download={`payment-proof-${proofModal.paymentId}`} className="wn-btn wn-btn--secondary min-h-[44px]">
                {pa.proofModal.download}
              </a>
              <button type="button" onClick={closeProofModal} className="wn-btn wn-btn--primary min-h-[44px]">
                {pa.proofModal.close}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminDashboardShell>
  );
}

