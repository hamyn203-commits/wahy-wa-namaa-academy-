import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Loader2, RefreshCw, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';
import { formatMsg } from './adminFormat';

export default function AdminGuardianLinksPanel({ onOpenStudent }) {
  const { locale, isRTL, t } = useI18n();
  const toast = useToast();
  const gl = t.adminPortal.people.guardianLinks;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [approveModal, setApproveModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = statusFilter === 'pending'
        ? '/api/admin/people/guardian-links?status=pending'
        : '/api/admin/people/guardian-links?status=' + encodeURIComponent(statusFilter);
      const result = await api.get(endpoint, { auth: true });
      setItems(result.invitations || []);
    } catch (err) {
      setError(err.message || gl.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, gl.loadError]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (invitationId, action, guardianEmail = '') => {
    if (busyId) return;
    setBusyId(invitationId);
    try {
      await api.post(`/api/admin/people/guardian-links/${encodeURIComponent(invitationId)}/action`, {
        action,
        ...(guardianEmail ? { guardianEmail } : {}),
      }, { auth: true });
      toast.success(
        action === 'approve'
          ? (isRTL ? 'تم اعتماد ربط ولي الأمر بالطالب بنجاح' : 'Guardian linked to student successfully')
          : (isRTL ? 'تم إلغاء دعوة الربط المعلقة' : 'Guardian link invitation cancelled')
      );
      setApproveModal(null);
      await load();
    } catch (err) {
      if (action === 'approve' && err?.code === 'GUARDIAN_ACCOUNT_NOT_FOUND' && !approveModal) {
        setApproveModal({ invitationId, guardianEmail: '' });
      } else {
        toast.error(err.message || gl.loadError);
      }
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="wn-admin-guardian-links">
      <header>
        <div>
          <span>{gl.eyebrow}</span>
          <h3><Link2 size={18} aria-hidden="true" /> {gl.title}</h3>
          <p>{gl.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={gl.filterAria}
            className="min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--wn-surface)] text-[var(--wn-text-primary)] font-semibold"
          >
            <option value="pending">{gl.statuses.pending}</option>
            <option value="accepted">{gl.statuses.accepted}</option>
            <option value="rejected">{gl.statuses.rejected}</option>
            <option value="expired">{gl.statuses.expired}</option>
            <option value="all">{gl.statuses.all}</option>
          </select>
          <button type="button" onClick={load} disabled={loading} className="min-h-[44px]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {gl.refresh}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2 p-2" role="status" aria-label={gl.loading}>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} aria-hidden="true" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
            {t.adminPortal.common.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={gl.empty} />
      ) : (
        <div className="wn-admin-guardian-links__list">
          {items.map((item) => {
            const isBusy = busyId === item._id;
            return (
              <article key={item._id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="wn-admin-guardian-links__icon"><UserRound size={17} aria-hidden="true" /></span>
                  <div>
                    <strong>{item.student?.name || gl.studentFallback}</strong>
                    <small>{item.student?.email || dash} · {gl.relations[item.relationship] || item.relationship}</small>
                  </div>
                </div>
                <div>
                  <strong>{item.phoneMasked || dash}</strong>
                  <small>{formatMsg(gl.expiresPrefix, { date: new Date(item.expiresAt).toLocaleDateString(intlLocale) })}</small>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(item._id, 'approve')}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                        <span>{isRTL ? 'اعتماد الربط' : 'Approve Link'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(item._id, 'cancel')}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle size={13} aria-hidden="true" />
                        <span>{isRTL ? 'إلغاء' : 'Cancel'}</span>
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => onOpenStudent?.(item.student?._id)} className="min-h-[40px]">
                    {gl.openStudent360}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(approveModal)}
        onClose={() => { if (!busyId) setApproveModal(null); }}
        title={isRTL ? 'تحديد حساب ولي الأمر للربط' : 'Select Guardian Account to Link'}
        disableClose={Boolean(busyId)}
      >
        {approveModal ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!approveModal.guardianEmail.trim()) return;
              handleAction(approveModal.invitationId, 'approve', approveModal.guardianEmail.trim());
            }}
            className="space-y-4 text-sm"
          >
            <p className="text-xs text-[var(--wn-text-secondary)]">
              {isRTL
                ? 'لم يُعثر على حساب ولي أمر مطابق تلقائياً برقم الهاتف. أدخل البريد الإلكتروني المسجل لولي الأمر لإتمام الربط:'
                : 'No guardian account matched automatically by phone. Enter the registered guardian email to complete linking:'}
            </p>
            <input
              required
              type="email"
              value={approveModal.guardianEmail}
              onChange={(e) => setApproveModal((prev) => ({ ...prev, guardianEmail: e.target.value }))}
              placeholder="parent@example.com"
              className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button type="button" onClick={() => setApproveModal(null)} className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)]">
                {t.adminPortal.common.cancel}
              </button>
              <button type="submit" disabled={Boolean(busyId)} className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1.5">
                {busyId ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                <span>{isRTL ? 'ربط الحساب الآن' : 'Link Now'}</span>
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
