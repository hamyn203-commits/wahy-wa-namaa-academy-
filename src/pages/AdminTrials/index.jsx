import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle, Phone, RefreshCw, UserCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';

const STATUS_LABELS = {
  pending: 'بانتظار تعيين معلم',
  scheduled: 'مجدولة',
  completed: 'مكتملة',
  no_show: 'لم يحضر',
  cancelled: 'ملغاة',
};

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-700',
};

const TRACK_LABELS = {
  memorization: 'الحفظ والمراجعة',
  tajweed_ijazah: 'التجويد والإجازة',
  kids_foundation: 'تأسيس الأطفال',
};

const SLOT_LABELS = {
  morning: 'صباحًا',
  afternoon: 'ظهرًا',
  evening: 'مساءً',
  flexible: 'مرن',
};

function teacherName(teacher) {
  return teacher?.personalInfo?.fullName || teacher?.user?.name || 'معلم';
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString('ar-EG') : date.toLocaleDateString('ar-EG');
}

function AssignPanel({ trial, teachers, onDone, onCancel }) {
  const toast = useToast();
  const [teacherId, setTeacherId] = useState(trial.assignedTeacher?._id || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Suggest teachers matching the requested teacher gender first.
  const sortedTeachers = useMemo(() => {
    const wanted = trial.preferredTeacherGender;
    if (!wanted || wanted === 'any') return teachers;
    return [...teachers].sort((a, b) => {
      const aMatch = a.personalInfo?.gender === wanted ? 0 : 1;
      const bMatch = b.personalInfo?.gender === wanted ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [teachers, trial.preferredTeacherGender]);

  const submit = async (event) => {
    event.preventDefault();
    if (!teacherId || !scheduledAt) {
      toast.error('اختر المعلم وموعد الحصة');
      return;
    }
    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const result = await api.put('/api/trials/' + trial._id + '/assign', {
        teacherId,
        scheduledAt,
        timezone,
        notes: notes.trim() || undefined,
      }, { auth: true });
      toast.success(result.studentLinked
        ? 'تمت الجدولة وإشعار المعلم والطالب'
        : 'تمت الجدولة وإشعار المعلم — الطالب ليس لديه حساب بعد، تواصل معه عبر واتساب');
      onDone();
    } catch (error) {
      toast.error(error.message || 'تعذر جدولة الحصة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold space-y-1">
          <span>المعلم</span>
          <select
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
            required
          >
            <option value="">— اختر معلمًا معتمدًا —</option>
            {sortedTeachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacherName(teacher)}
                {teacher.personalInfo?.gender ? (teacher.personalInfo.gender === 'female' ? ' (معلمة)' : ' (معلم)') : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold space-y-1">
          <span>موعد الحصة (بتوقيتك المحلي)</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
            required
          />
        </label>
      </div>
      <label className="text-sm font-semibold space-y-1 block">
        <span>ملاحظات للمعلم (اختياري)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full border rounded-lg px-3 py-2 bg-white"
        />
      </label>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="wn-btn wn-btn--secondary">إلغاء</button>
        <button type="submit" disabled={saving} className="wn-btn wn-btn--primary">
          <CalendarClock size={16} /> {saving ? 'جارٍ الجدولة...' : 'تأكيد الجدولة'}
        </button>
      </div>
    </form>
  );
}

export default function AdminTrials() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const showLoadError = toast.error;
  const [filter, setFilter] = useState('pending');
  const [trials, setTrials] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');
  const [working, setWorking] = useState('');
  const [cancelModal, setCancelModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === 'all' ? '' : '?status=' + encodeURIComponent(filter);
      const [trialResult, teacherResult] = await Promise.all([
        api.get('/api/trials' + query + (query ? '&' : '?') + 'limit=50', { auth: true }),
        api.get('/api/admin/teachers/approved', { auth: true }).catch(() => []),
      ]);
      setTrials(trialResult.trials || []);
      setTeachers(Array.isArray(teacherResult) ? teacherResult : (teacherResult?.teachers || []));
    } catch (error) {
      showLoadError(error.message || 'تعذر تحميل طلبات الحصص التجريبية');
    } finally {
      setLoading(false);
    }
  }, [filter, showLoadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const updateStatus = async (trial, status, reason = '') => {
    setWorking(trial._id);
    try {
      await api.put('/api/trials/' + trial._id + '/status', { status, reason }, { auth: true });
      toast.success(status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم تحديث الحالة');
      await load();
    } catch (error) {
      toast.error(error.message || 'تعذر تحديث الحالة');
    } finally {
      setWorking('');
    }
  };

  if (!ready) return null;

  return (
    <DashboardLayout title="طلبات الحصص التجريبية" user={user} onLogout={logout}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <button onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary">
          <ArrowRight size={16} /> لوحة الإدارة
        </button>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            aria-label="تصفية حسب الحالة"
          >
            <option value="pending">بانتظار تعيين معلم</option>
            <option value="scheduled">مجدولة</option>
            <option value="completed">مكتملة</option>
            <option value="no_show">لم يحضر</option>
            <option value="cancelled">ملغاة</option>
            <option value="all">الكل</option>
          </select>
          <button onClick={load} className="wn-btn wn-btn--secondary" disabled={loading} aria-label="تحديث">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {!loading && teachers.length === 0 ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          لا يوجد معلمون معتمدون حاليًا — اعتمد معلمًا من لوحة الإدارة قبل جدولة الحصص التجريبية.
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>
      ) : trials.length === 0 ? (
        <div className="wn-dashboard-surface text-center text-gray-500 py-12">لا توجد طلبات في هذه الحالة.</div>
      ) : (
        <div className="space-y-4">
          {trials.map((trial) => {
            const session = trial.scheduledSession && typeof trial.scheduledSession === 'object' ? trial.scheduledSession : null;
            const canSchedule = ['pending', 'scheduled', 'no_show'].includes(trial.status);
            return (
              <div key={trial._id} className="wn-dashboard-surface">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">
                      {trial.studentName}
                      <span className="text-sm font-normal text-gray-500"> — {trial.age} سنة، {trial.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                    </h3>
                    {trial.guardianName ? <p className="text-sm">ولي الأمر: <strong>{trial.guardianName}</strong></p> : null}
                    <p className="text-sm flex items-center gap-1">
                      <Phone size={14} />
                      <a href={'https://wa.me/' + String(trial.whatsappPhone || '').replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline" dir="ltr">
                        {trial.whatsappPhone}
                      </a>
                    </p>
                    <p className="text-sm">
                      المسار: <strong>{TRACK_LABELS[trial.preferredTrack] || trial.preferredTrack}</strong>
                      {trial.currentLevel ? <> · المستوى: <strong>{trial.currentLevel}</strong></> : null}
                    </p>
                    <p className="text-sm">
                      التفضيل: <strong>{SLOT_LABELS[trial.preferredTimeSlot] || trial.preferredTimeSlot || '—'}</strong>
                      {trial.preferredDate ? <> · {formatDate(trial.preferredDate)}</> : null}
                      {trial.preferredTeacherGender && trial.preferredTeacherGender !== 'any'
                        ? <> · يفضّل {trial.preferredTeacherGender === 'female' ? 'معلمة' : 'معلمًا'}</>
                        : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {trial.studentUser ? <span className="inline-flex items-center gap-1 text-emerald-700"><UserCheck size={12} /> مرتبط بحساب: {trial.studentUser.name || trial.studentUser.email || 'طالب'}</span> : 'بدون حساب على المنصة'}
                      {trial.referenceNumber ? <> · المرجع: <span dir="ltr">{trial.referenceNumber}</span></> : null}
                      {' · '}{formatDate(trial.createdAt, true)}
                    </p>
                    {trial.notes ? <p className="text-xs text-gray-600 whitespace-pre-line">ملاحظات: {trial.notes}</p> : null}
                    {trial.assignedTeacher ? (
                      <p className="text-sm">
                        المعلم: <strong>{teacherName(trial.assignedTeacher)}</strong>
                        {session?.scheduledAt ? <> · الموعد: <strong>{formatDate(session.scheduledAt, true)}</strong></> : null}
                      </p>
                    ) : null}
                    {trial.assessment?.level ? (
                      <p className="text-sm text-emerald-800">
                        التقييم: المستوى <strong>{trial.assessment.level}</strong> · المسار المقترح <strong>{TRACK_LABELS[trial.assessment.recommendedTrack] || trial.assessment.recommendedTrack}</strong>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={'text-xs px-3 py-1 rounded-full ' + (STATUS_STYLES[trial.status] || 'bg-gray-100 text-gray-700')}>
                      {STATUS_LABELS[trial.status] || trial.status}
                    </span>
                    {canSchedule ? (
                      <button
                        onClick={() => setActiveId(activeId === trial._id ? '' : trial._id)}
                        className="wn-btn wn-btn--primary"
                        disabled={working === trial._id}
                      >
                        <CalendarClock size={16} /> {trial.status === 'pending' ? 'تعيين معلم وموعد' : 'إعادة الجدولة'}
                      </button>
                    ) : null}
                    {trial.status === 'scheduled' ? (
                      <button onClick={() => updateStatus(trial, 'no_show')} disabled={working === trial._id} className="wn-btn wn-btn--secondary">
                        <CheckCircle size={16} /> لم يحضر
                      </button>
                    ) : null}
                    {['pending', 'scheduled'].includes(trial.status) ? (
                      <button onClick={() => setCancelModal({ trial, reason: '' })} disabled={working === trial._id} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold flex items-center gap-2">
                        <XCircle size={16} /> إلغاء
                      </button>
                    ) : null}
                  </div>
                </div>

                {activeId === trial._id ? (
                  <AssignPanel
                    trial={trial}
                    teachers={teachers}
                    onCancel={() => setActiveId('')}
                    onDone={() => { setActiveId(''); load(); }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">إلغاء طلب الحصة التجريبية</h3>
              <button type="button" onClick={() => setCancelModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-600">
              <p>الطالب: <strong>{cancelModal.trial.studentName || '—'}</strong></p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">سبب الإلغاء (اختياري):</label>
                <textarea
                  autoFocus
                  rows={3}
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="اكتب سبب الإلغاء..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetTrial = cancelModal.trial;
                  const reason = cancelModal.reason.trim();
                  setCancelModal(null);
                  await updateStatus(targetTrial, 'cancelled', reason);
                }}
                className="px-4 py-2 text-sm text-white font-medium rounded-lg transition bg-red-600 hover:bg-red-700"
              >
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
