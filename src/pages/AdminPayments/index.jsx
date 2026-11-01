import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Eye, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';

function amount(payment) {
  return (Number(payment.amountMinor || 0) / 100).toFixed(2) + ' ' + payment.currency;
}

export default function AdminPayments() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const showLoadError = toast.error;
  const [filter, setFilter] = useState('pending');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [rejectModal, setRejectModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/api/payments/admin/manual?status=' + encodeURIComponent(filter), { auth: true });
      setPayments(result.payments || []);
    } catch (error) {
      showLoadError(error.message || 'تعذر تحميل المدفوعات');
    } finally {
      setLoading(false);
    }
  }, [filter, showLoadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const review = async (payment, action, customNote) => {
    if (action === 'reject' && customNote === undefined) {
      setRejectModal({ payment, note: '' });
      return;
    }
    const note = customNote !== undefined ? customNote : (action === 'reject'
      ? window.prompt('سبب الرفض (اختياري):', '') ?? null
      : '');
    if (note === null) return;

    setWorking(payment.id);
    try {
      const result = await api.patch('/api/payments/admin/manual/' + payment.id + '/review', { action, note }, { auth: true });
      toast.success(
        action === 'approve'
          ? (result.renewalQueued
              ? 'تم اعتماد التجديد. سيبدأ تلقائيًا بعد انتهاء الرصيد الحالي.'
              : (result.autoPlaced || result.renewalActivated)
                ? 'تم اعتماد التجديد وتفعيله تلقائيًا مع نفس الجروب والمعلم.'
                : result.awaitingPlacement
                  ? 'تم تأكيد الدفع. الطلب الآن بانتظار التسكين مع المعلم المختار.'
                  : 'تم تأكيد الدفع بنجاح.')
          : 'تم رفض إثبات الدفع'
      );
      await load();
    } catch (error) {
      toast.error(error.message || 'فشلت المراجعة');
    } finally {
      setWorking('');
    }
  };

  const openProof = async (payment) => {
    try {
      const response = await api.request('/api/payments/admin/manual/' + payment.id + '/proof', {
        auth: true,
        json: false,
        method: 'GET',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.message || 'تعذر فتح الإثبات');
    }
  };

  if (!ready) return null;

  return (
    <DashboardLayout title="مراجعة المدفوعات اليدوية" user={user} onLogout={logout}>
      <div className="wn-admin-payment-readable">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <button onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary">
          <ArrowRight size={16} /> لوحة الإدارة
        </button>
        <button onClick={() => navigate('../subscriptions', { relative: 'path' })} className="wn-btn wn-btn--primary">الاشتراكات وتسكين الطلاب</button>
        <div className="flex gap-2">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="pending">قيد المراجعة</option>
            <option value="succeeded">مقبولة</option>
            <option value="failed">مرفوضة</option>
            <option value="all">الكل</option>
          </select>
          <button onClick={load} className="wn-btn wn-btn--secondary" disabled={loading}><RefreshCw size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      ) : payments.length === 0 ? (
        <div className="wn-dashboard-surface text-center text-gray-500 py-12">لا توجد عمليات في هذه الحالة.</div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="wn-dashboard-surface">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold">{payment.student?.name || 'طالب'}</h3>
                  <p className="text-sm text-gray-500">{payment.student?.email}</p>
                  <p className="text-sm">
                    {payment.kind === 'subscription'
                      ? (payment.subscription?.pricingSnapshot?.nameAr || payment.subscription?.planKey || 'اشتراك أكاديمية')
                      : (payment.course?.title?.ar || payment.course?.title?.en || payment.course?.slug)}
                  </p>
                  {payment.kind === 'subscription' ? (
                    <div className="text-xs text-slate-600 space-y-1 rounded-lg bg-slate-50 border p-3 my-2">
                      {payment.subscription?.renewalOf ? (
                        <p><strong className="text-emerald-700">تجديد نفس الجروب والمعلم</strong></p>
                      ) : null}
                      <p>القسم: <strong>{payment.subscription?.section === 'ladies' ? 'قسم السيدات' : 'قسم الرجال والأطفال'}</strong></p>
                      <p>الحصص: <strong>{payment.subscription?.sessionCount || '—'}</strong></p>
                      <p>
                        المعلم المختار:{' '}
                        <strong>
                          {payment.subscription?.preferredTeacher?.personalInfo?.fullName
                            || payment.subscription?.preferredTeacher?.user?.name
                            || '—'}
                        </strong>
                      </p>
                    </div>
                  ) : null}
                  <p className="text-xl font-bold text-emerald-700">{amount(payment)}</p>
                  <p className="text-sm">الطريقة: <strong>{payment.manual?.method || '-'}</strong></p>
                  {payment.manual?.transferReference ? <p className="text-sm">مرجع العملية: <strong>{payment.manual.transferReference}</strong></p> : null}
                  <p className="text-xs text-gray-400">{new Date(payment.createdAt).toLocaleString('ar-EG')}</p>
                  {payment.manual?.reviewNote ? <p className="text-xs text-gray-500">ملاحظة المراجعة: {payment.manual.reviewNote}</p> : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={
                    'text-xs px-3 py-1 rounded-full ' +
                    (payment.status === 'succeeded'
                      ? 'bg-green-100 text-green-700'
                      : payment.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700')
                  }>
                    {payment.status === 'succeeded' ? 'مقبول' : payment.status === 'failed' ? 'مرفوض' : 'قيد المراجعة'}
                  </span>

                  {payment.proofAvailable ? (
                    <button onClick={() => openProof(payment)} className="wn-btn wn-btn--secondary"><Eye size={16} /> عرض الإثبات</button>
                  ) : null}

                  {payment.kind === 'subscription' && payment.status === 'succeeded' ? (
                    <button onClick={() => navigate('../subscriptions', { relative: 'path' })} className="wn-btn wn-btn--primary">متابعة التسكين والحلقات</button>
                  ) : null}
                  {payment.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button disabled={working === payment.id} onClick={() => review(payment, 'approve')} className="wn-btn wn-btn--primary"><CheckCircle size={16} /> {payment.kind === 'subscription' ? 'اعتماد الدفع' : 'قبول'}</button>
                      <button disabled={working === payment.id} onClick={() => review(payment, 'reject')} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold flex items-center gap-2"><XCircle size={16} /> رفض</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">رفض إثبات الدفع اليدوي</h3>
              <button type="button" onClick={() => setRejectModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-600">
              <p>الطالب: <strong>{rejectModal.payment.student?.name || 'طالب'}</strong> — المبلغ: <strong>{amount(rejectModal.payment)}</strong></p>
              <label className="block text-xs font-semibold text-slate-700 space-y-1">
                <span>سبب الرفض أو المطلوب من الطالب لتصحيح الإيصال:</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={rejectModal.note}
                  onChange={(e) => setRejectModal({ ...rejectModal, note: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  placeholder="مثال: صورة الإيصال غير واضحة أو رقم المرجع غير مطابق..."
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">إلغاء</button>
              <button
                type="button"
                disabled={working === rejectModal.payment.id}
                onClick={async () => {
                  const { payment, note } = rejectModal;
                  setRejectModal(null);
                  await review(payment, 'reject', note.trim());
                }}
                className="px-4 py-2 text-sm text-white font-semibold rounded-lg bg-red-600 hover:bg-red-700"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

