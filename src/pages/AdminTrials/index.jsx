import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle, Clock, Download,
  ExternalLink, Loader2, MessageCircle, Phone, RefreshCw, Search, Sparkles, UserCheck, Users, XCircle,
} from 'lucide-react';
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

const STATUS_STYLES = {
  pending: 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]',
  scheduled: 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)]',
  completed: 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]',
  no_show: 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]',
  cancelled: 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]',
};

function teacherName(teacher, fallback) {
  return teacher?.personalInfo?.fullName || teacher?.user?.name || fallback;
}

function formatDate(value, intlLocale, dash, withTime = false) {
  if (!value) return dash;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dash;
  return withTime ? date.toLocaleString(intlLocale) : date.toLocaleDateString(intlLocale);
}

function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeWhatsAppDigits(raw = '') {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  return digits;
}

function buildTrialWhatsAppUrl(trial, session, isRTL, intlLocale, teacherFallback) {
  const digits = normalizeWhatsAppDigits(trial.whatsappPhone || trial.phone);
  if (!digits) return '';
  const student = trial.studentName || '';
  const assignedName = trial.assignedTeacher ? teacherName(trial.assignedTeacher, teacherFallback) : '';
  let text;
  if (trial.status === 'scheduled' && session?.scheduledAt) {
    const when = formatDate(session.scheduledAt, intlLocale, '', true);
    text = isRTL
      ? `السلام عليكم ورحمة الله، أهلاً بكم من أكاديمية وَحْيٌ وَنَمَاء. تم تأكيد موعد الحصة التجريبية المجانية للطالب (${student}) يوم ${when}${assignedName ? ` مع ${assignedName}` : ''}. نسعد بحضوركم قبل الموعد بـ 5 دقائق.`
      : `Assalamu Alaikum from Wahy Wa Namaa Academy! The free trial class for ${student} is confirmed for ${when}${assignedName ? ` with ${assignedName}` : ''}.`;
  } else if (trial.status === 'completed') {
    text = isRTL
      ? `السلام عليكم ورحمة الله، سعدنا بحضور الطالب (${student}) للحصة التجريبية في أكاديمية وَحْيٌ وَنَمَاء. يسعدنا مساعدتكم في اختيار الباقة والحلقة الأنسب للبدء فوراً.`
      : `Assalamu Alaikum! Thank you for attending ${student}'s trial class at Wahy Wa Namaa Academy. Let us help you choose the best subscription package to get started.`;
  } else {
    text = isRTL
      ? `السلام عليكم ورحمة الله، أهلاً بكم من أكاديمية وَحْيٌ وَنَمَاء. نتواصل معكم لتنسيق وتأكيد الموعد الأنسب للحصة التجريبية المجانية للطالب (${student}).`
      : `Assalamu Alaikum from Wahy Wa Namaa Academy! Reaching out to coordinate the best time for ${student}'s free trial class.`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function AssignPanel({ trial, teachers, onDone, onCancel }) {
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const intlLocale = resolveIntlLocale(locale);
  const pt = t.payments.trials;
  const ap = pt.assignPanel;
  const teacherSelectId = useId();
  const scheduledInputId = useId();
  const notesInputId = useId();
  const [teacherId, setTeacherId] = useState(trial.assignedTeacher?._id || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsData, setSlotsData] = useState({ configured: false, slots: [], teacherTimezone: '' });
  const slotsReqRef = useRef(0);

  // Filter safeguarding-compatible teachers for adults (>=12) and sort requested gender first.
  const compatibleTeachers = useMemo(() => {
    const isSafeguardedAge = Number(trial.age || 0) >= 12 && ['male', 'female'].includes(trial.gender);
    const list = isSafeguardedAge
      ? teachers.filter((tc) => !tc.personalInfo?.gender || tc.personalInfo.gender === trial.gender)
      : teachers;
    const wanted = trial.preferredTeacherGender;
    if (!wanted || wanted === 'any') return list;
    return [...list].sort((a, b) => {
      const aMatch = a.personalInfo?.gender === wanted ? 0 : 1;
      const bMatch = b.personalInfo?.gender === wanted ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [teachers, trial.age, trial.gender, trial.preferredTeacherGender]);

  useEffect(() => {
    if (!teacherId) {
      setSlotsData({ configured: false, slots: [], teacherTimezone: '' });
      setSlotsLoading(false);
      return;
    }
    const reqId = ++slotsReqRef.current;
    setSlotsLoading(true);
    api.get(`/api/sessions/available-slots/${encodeURIComponent(teacherId)}?days=10&duration=30`)
      .then((res) => {
        if (reqId !== slotsReqRef.current) return;
        setSlotsData({
          configured: Boolean(res?.configured),
          slots: Array.isArray(res?.slots) ? res.slots.slice(0, 12) : [],
          teacherTimezone: res?.teacherTimezone || '',
        });
      })
      .catch(() => {
        if (reqId !== slotsReqRef.current) return;
        setSlotsData({ configured: false, slots: [], teacherTimezone: '' });
      })
      .finally(() => {
        if (reqId === slotsReqRef.current) setSlotsLoading(false);
      });
  }, [teacherId]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!teacherId || !scheduledAt) {
      toast.error(pt.toasts.selectTeacherAndTime);
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
      toast.success(result.studentLinked ? pt.toasts.scheduledLinked : pt.toasts.scheduledUnlinked);
      onDone();
    } catch (error) {
      toast.error(error.message || pt.toasts.scheduleFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="text-sm font-semibold space-y-1">
          <label htmlFor={teacherSelectId} className="block text-[var(--wn-heading)]">{ap.teacher}</label>
          <select
            id={teacherSelectId}
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
            className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
            required
          >
            <option value="">{ap.selectTeacher}</option>
            {compatibleTeachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacherName(teacher, pt.card.teacherFallback)}
                {teacher.personalInfo?.gender ? (teacher.personalInfo.gender === 'female' ? ap.femaleSuffix : ap.maleSuffix) : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm font-semibold space-y-1">
          <label htmlFor={scheduledInputId} className="block text-[var(--wn-heading)]">{ap.scheduledAt}</label>
          <input
            id={scheduledInputId}
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
            required
          />
        </div>
      </div>

      {/* Smart 30-Minute Teacher Available Slots Picker */}
      {teacherId ? (
        <div className="rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[var(--wn-heading)] inline-flex items-center gap-1.5">
              <Sparkles size={13} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>
                {isRTL
                  ? 'أقرب مواعيد متاحة فعلياً لدى المعلم (30 دقيقة — اضغط للاختيار الفوري):'
                  : 'Nearest open 30-min teacher slots (click to autofill):'}
              </span>
            </span>
            {slotsLoading ? <Loader2 size={14} className="animate-spin text-[var(--wn-emerald)]" aria-hidden="true" /> : null}
          </div>
          {slotsLoading ? null : slotsData.slots.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {slotsData.slots.map((slot) => {
                const localVal = toDatetimeLocalValue(slot.startsAt);
                const selected = localVal && scheduledAt === localVal;
                const label = new Date(slot.startsAt).toLocaleString(intlLocale, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setScheduledAt(localVal)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                      selected
                        ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                        : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-emerald)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--wn-text-secondary)]">
              {slotsData.configured
                ? (isRTL ? 'لا توجد نوافذ فراغ مسجلة خلال الـ 10 أيام القادمة — اختر معلمًا آخر أو نسّق الموعد.' : 'No open slots found in the next 10 days for this teacher.')
                : (isRTL ? 'جدول هذا المعلم مرن (غير مقيد بساعات محددة) — يمكنك اختيار أي موعد مستقبلي مناسب.' : 'This teacher has flexible availability — pick any suitable future time.')}
            </p>
          )}
        </div>
      ) : null}

      <div className="text-sm font-semibold space-y-1">
        <label htmlFor={notesInputId} className="block text-[var(--wn-heading)]">{ap.notes}</label>
        <textarea
          id={notesInputId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="wn-btn wn-btn--secondary min-h-[44px]">
          {ap.cancel}
        </button>
        <button type="submit" disabled={saving} className="wn-btn wn-btn--primary min-h-[44px]">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CalendarClock size={16} aria-hidden="true" />}
          {saving ? ap.saving : ap.submit}
        </button>
      </div>
    </form>
  );
}

export default function AdminTrials() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const pt = t.payments.trials;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const cancelReasonId = useId();
  const dossierRef = useRef(null);
  const showLoadError = toast.error;
  const [filter, setFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [summary, setSummary] = useState(null);
  const [trials, setTrials] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [working, setWorking] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [noShowModal, setNoShowModal] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });
      if (filter !== 'all') params.set('status', filter);
      if (trackFilter !== 'all') params.set('track', trackFilter);
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (searchQuery) params.set('q', searchQuery);

      const [trialResult, teacherResult] = await Promise.all([
        api.get(`/api/trials?${params.toString()}`, { auth: true }),
        api.get('/api/admin/teachers/approved', { auth: true }).catch(() => []),
      ]);
      setTrials(trialResult.trials || []);
      if (trialResult.summary) setSummary(trialResult.summary);
      if (trialResult.pagination) setPagination(trialResult.pagination);
      setTeachers(Array.isArray(teacherResult) ? teacherResult : (teacherResult?.teachers || []));
    } catch (error) {
      const message = error.message || pt.loadError;
      setLoadError(message);
      setTrials([]);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, trackFilter, genderFilter, searchQuery, page, showLoadError, pt.loadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const exportTrialsCsv = () => {
    if (!trials.length) {
      toast.error(isRTL ? 'لا توجد طلبات تجريبية لتصديرها في الفلتر الحالي' : 'No trial requests to export');
      return;
    }
    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      isRTL ? 'اسم الطالب' : 'Student',
      isRTL ? 'العمر' : 'Age',
      isRTL ? 'الجنس' : 'Gender',
      isRTL ? 'ولي الأمر' : 'Guardian',
      isRTL ? 'واتساب' : 'WhatsApp',
      isRTL ? 'المسار' : 'Track',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'المعلم المعين' : 'Assigned Teacher',
      isRTL ? 'موعد الحصة' : 'Scheduled At',
      isRTL ? 'نتيجة التقييم' : 'Assessment Level',
      isRTL ? 'تاريخ الطلب' : 'Created At',
    ];
    const rows = trials.map((tr) => [
      tr.studentName || '',
      tr.age ?? '',
      tr.gender || '',
      tr.guardianName || '',
      tr.whatsappPhone || tr.phone || '',
      pt.tracks[tr.preferredTrack] || tr.preferredTrack || '',
      pt.statuses[tr.status] || tr.status || '',
      tr.assignedTeacher ? teacherName(tr.assignedTeacher, '') : '',
      tr.scheduledSession?.scheduledAt ? new Date(tr.scheduledSession.scheduledAt).toISOString() : '',
      tr.assessment?.level || '',
      tr.createdAt ? new Date(tr.createdAt).toISOString() : '',
    ].map(csvEscape).join(','));
    const csv = `\uFEFF${headers.map(csvEscape).join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-trials-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateStatus = async (trial, status, reason = '') => {
    if (working) return false;
    setWorking(trial._id);
    try {
      await api.put('/api/trials/' + trial._id + '/status', { status, reason }, { auth: true });
      toast.success(status === 'cancelled' ? pt.toasts.cancelled : pt.toasts.updated);
      await load();
      return true;
    } catch (error) {
      toast.error(error.message || pt.toasts.updateFailed);
      return false;
    } finally {
      setWorking('');
    }
  };

  if (!ready) return null;

  const isCancelling = Boolean(cancelModal && working === cancelModal.trial._id);
  const isMarkingNoShow = Boolean(noShowModal && working === noShowModal._id);

  const handleTabChange = (nextTab) => {
    navigate(`${localizedPath('/admin', locale)}?tab=${encodeURIComponent(nextTab)}`);
  };
  const handleAdminRoute = (route) => {
    if (route === 'trials') return;
    navigate(localizedPath(`/admin/${route}`, locale));
  };

  const kpiCards = [
    {
      id: 'pending',
      label: isRTL ? 'بانتظار تعيين معلم' : 'Awaiting Teacher',
      value: summary ? summary.pending : trials.filter((r) => r.status === 'pending').length,
      icon: Clock,
      tone: 'border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]',
    },
    {
      id: 'scheduled',
      label: isRTL ? 'مجدولة وقادمة' : 'Scheduled',
      value: summary ? summary.scheduled : trials.filter((r) => r.status === 'scheduled').length,
      icon: CalendarClock,
      tone: 'border-[var(--wn-status-info-border)] bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)]',
    },
    {
      id: 'completed',
      label: isRTL ? 'مكتملة ومقيّمة' : 'Completed & Assessed',
      value: summary ? summary.completed : trials.filter((r) => r.status === 'completed').length,
      icon: CheckCircle,
      tone: 'border-[var(--wn-status-success-border)] bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]',
    },
    {
      id: 'no_show',
      label: isRTL ? 'غياب للطالب' : 'Student No-Show',
      value: summary ? summary.no_show : trials.filter((r) => r.status === 'no_show').length,
      icon: AlertTriangle,
      tone: 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]',
    },
    {
      id: 'all',
      label: isRTL ? 'مرتبطة بحساب طالب' : 'Linked Student Accounts',
      value: summary ? summary.linkedStudents : trials.filter((r) => Boolean(r.studentUser)).length,
      icon: Users,
      tone: 'border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-emerald)]',
    },
  ];

  return (
    <AdminDashboardShell
      user={user}
      active="trials"
      pageTitle={pt.title}
      onChange={handleTabChange}
      onNavigate={handleAdminRoute}
      onLogout={logout}
      search={<AdminQuickDossierHost ref={dossierRef} approvedTeachers={teachers} onChanged={load} />}
    >
      <SEOHead page={{ title: pt.seoTitle, description: pt.seoDesc, noindex: true, canonical: false }} />

      {/* Top Navigation & Export Row */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <button type="button" onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary min-h-[44px]">
          {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {pt.backToAdmin}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportTrialsCsv}
            disabled={loading || trials.length === 0}
            className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={15} aria-hidden="true" />
            <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={load}
            className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px]"
            disabled={loading}
            aria-label={pt.refreshAria}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 5 KPI Pulse Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const selected = filter === card.id;
          return (
            <button
              key={card.id + card.label}
              type="button"
              onClick={() => { setPage(1); setFilter(card.id); }}
              className={`rounded-2xl border p-3.5 text-start transition ${
                selected
                  ? 'ring-2 ring-[var(--wn-emerald)] border-[var(--wn-emerald)] bg-[var(--wn-surface)]'
                  : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--wn-text-secondary)]">{card.label}</span>
                <span className={`p-1.5 rounded-lg border ${card.tone}`}>
                  <Icon size={14} aria-hidden="true" />
                </span>
              </div>
              <strong className="text-2xl font-extrabold text-[var(--wn-heading)] mt-1.5 block">
                {card.value}
              </strong>
            </button>
          );
        })}
      </section>

      {/* Search & Multi-Filter Bar */}
      <section className="wn-dashboard-surface mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={isRTL ? 'بحث باسم الطالب، ولي الأمر، رقم الواتساب، المرجع...' : 'Search student, guardian, WhatsApp, ref...'}
            className="w-full min-h-[44px] ps-9 pe-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-sm text-[var(--wn-text-primary)]"
          />
        </div>

        <select
          value={filter}
          onChange={(event) => { setPage(1); setFilter(event.target.value); }}
          className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          aria-label={pt.filterAria}
        >
          <option value="all">{pt.statuses.all}</option>
          <option value="pending">{pt.statuses.pending}</option>
          <option value="scheduled">{pt.statuses.scheduled}</option>
          <option value="completed">{pt.statuses.completed}</option>
          <option value="no_show">{pt.statuses.no_show}</option>
          <option value="cancelled">{pt.statuses.cancelled}</option>
        </select>

        <select
          value={trackFilter}
          onChange={(event) => { setPage(1); setTrackFilter(event.target.value); }}
          aria-label={isRTL ? 'تصفية حسب المسار' : 'Filter by track'}
          className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">{isRTL ? 'كل المسارات' : 'All tracks'}</option>
          <option value="memorization">{pt.tracks.memorization || (isRTL ? 'التحفيظ' : 'Memorization')}</option>
          <option value="tajweed_ijazah">{pt.tracks.tajweed_ijazah || (isRTL ? 'التجويد والإجازة' : 'Tajweed & Ijazah')}</option>
          <option value="kids_foundation">{pt.tracks.kids_foundation || (isRTL ? 'تأسيس الأطفال' : 'Kids Foundation')}</option>
        </select>

        <select
          value={genderFilter}
          onChange={(event) => { setPage(1); setGenderFilter(event.target.value); }}
          aria-label={isRTL ? 'تصفية حسب جنس الطالب' : 'Filter by student gender'}
          className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">{isRTL ? 'كل الطلاب' : 'All genders'}</option>
          <option value="male">{pt.card.male}</option>
          <option value="female">{pt.card.female}</option>
        </select>
      </section>

      {!loading && !loadError && teachers.length === 0 ? (
        <div className="mb-4 rounded-lg border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] p-3 text-sm text-[var(--wn-status-warn-text)]">
          {pt.noTeachersWarning}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4" role="status" aria-label={t.adminPortal.common.loading}>
          {[1, 2, 3].map((row) => (
            <div key={row} className="wn-dashboard-surface space-y-3">
              <Skeleton className="h-5 w-52" />
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
            {pt.retry}
          </button>
        </div>
      ) : trials.length === 0 ? (
        <div className="wn-dashboard-surface">
          <EmptyState title={pt.empty} />
        </div>
      ) : (
        <div className="space-y-4">
          {trials.map((trial) => {
            const session = trial.scheduledSession && typeof trial.scheduledSession === 'object' ? trial.scheduledSession : null;
            const canSchedule = ['pending', 'scheduled', 'no_show'].includes(trial.status);
            const isBusy = working === trial._id;
            const waFollowUpUrl = buildTrialWhatsAppUrl(trial, session, isRTL, intlLocale, pt.card.teacherFallback);

            return (
              <div key={trial._id} className="wn-dashboard-surface">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-[var(--wn-heading)]">
                      {trial.studentName}
                      <span className="text-sm font-normal text-[var(--wn-text-secondary)]">
                        {' '}— {trial.age} {pt.card.yearsSuffix}، {trial.gender === 'female' ? pt.card.female : pt.card.male}
                      </span>
                    </h3>
                    {trial.guardianName ? <p className="text-sm text-[var(--wn-text-primary)]">{pt.card.guardian}: <strong>{trial.guardianName}</strong></p> : null}
                    <p className="text-sm flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={14} aria-hidden="true" />
                        <a href={'https://wa.me/' + String(trial.whatsappPhone || '').replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" className="text-[var(--wn-link)] underline" dir="ltr">
                          {trial.whatsappPhone}
                        </a>
                      </span>
                      {waFollowUpUrl ? (
                        <a
                          href={waFollowUpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)] hover:opacity-90"
                        >
                          <MessageCircle size={12} aria-hidden="true" />
                          <span>{isRTL ? 'رسالة تنسيق واتساب جاهزة' : 'Quick WhatsApp template'}</span>
                          <ExternalLink size={10} aria-hidden="true" />
                        </a>
                      ) : null}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {pt.card.track}: <strong>{pt.tracks[trial.preferredTrack] || trial.preferredTrack}</strong>
                      {trial.currentLevel ? <> · {pt.card.level}: <strong>{trial.currentLevel}</strong></> : null}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {pt.card.preference}: <strong>{pt.slots[trial.preferredTimeSlot] || trial.preferredTimeSlot || dash}</strong>
                      {trial.preferredDate ? <> · {formatDate(trial.preferredDate, intlLocale, dash)}</> : null}
                      {trial.preferredTeacherGender && trial.preferredTeacherGender !== 'any'
                        ? <> · {trial.preferredTeacherGender === 'female' ? pt.card.prefersFemaleTeacher : pt.card.prefersMaleTeacher}</>
                        : null}
                    </p>
                    <p className="text-xs text-[var(--wn-text-secondary)]">
                      {trial.studentUser ? (
                        <button
                          type="button"
                          onClick={() => dossierRef.current?.openStudent(trial.studentUser._id || trial.studentUser)}
                          className="inline-flex items-center gap-1 text-[var(--wn-emerald)] font-semibold hover:underline"
                        >
                          <UserCheck size={12} aria-hidden="true" />
                          {formatMsg(pt.card.linkedAccount, { name: trial.studentUser.name || trial.studentUser.email || pt.card.studentFallback })}
                        </button>
                      ) : pt.card.noAccount}
                      {trial.referenceNumber ? <> · {pt.card.refPrefix} <span dir="ltr">{trial.referenceNumber}</span></> : null}
                      {' · '}{formatDate(trial.createdAt, intlLocale, dash, true)}
                    </p>
                    {trial.notes ? <p className="text-xs text-[var(--wn-text-secondary)] whitespace-pre-line">{pt.card.notes}: {trial.notes}</p> : null}
                    {trial.assignedTeacher ? (
                      <div className="space-y-1">
                        <p className="text-sm text-[var(--wn-text-primary)]">
                          {pt.card.teacher}:{' '}
                          {trial.assignedTeacher._id ? (
                            <button
                              type="button"
                              onClick={() => dossierRef.current?.openTeacher(trial.assignedTeacher._id)}
                              className="font-bold text-[var(--wn-heading)] hover:text-[var(--wn-emerald)] underline decoration-dotted underline-offset-4"
                            >
                              {teacherName(trial.assignedTeacher, pt.card.teacherFallback)}
                            </button>
                          ) : (
                            <strong>{teacherName(trial.assignedTeacher, pt.card.teacherFallback)}</strong>
                          )}
                          {session?.scheduledAt ? <> · {pt.card.scheduledAt}: <strong>{formatDate(session.scheduledAt, intlLocale, dash, true)}</strong></> : null}
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] px-2.5 py-0.5 text-xs font-semibold">
                          <UserCheck size={12} aria-hidden="true" />
                          {isRTL
                            ? `مُسندة للمعلم مباشرة (${session?.status === 'pending' ? 'بانتظار قبول المعلم' : 'مؤكدة'}) — للعلم والمتابعة`
                            : `Assigned to teacher (${session?.status === 'pending' ? 'awaiting teacher acceptance' : 'confirmed'}) — FYI`}
                        </span>
                      </div>
                    ) : null}
                    {trial.assessment?.level ? (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-[var(--wn-emerald)]">
                          {pt.card.assessment}: {pt.card.level} <strong>{trial.assessment.level}</strong> · {pt.card.recommendedTrack} <strong>{pt.tracks[trial.assessment.recommendedTrack] || trial.assessment.recommendedTrack}</strong>
                          {trial.assessment.assignedCircle?.name ? (
                            <> · {isRTL ? 'الحلقة المرشحة:' : 'Recommended circle:'} <strong>{trial.assessment.assignedCircle.name}</strong></>
                          ) : null}
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate(localizedPath('/admin/subscriptions', locale))}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-emerald)] hover:opacity-90"
                        >
                          {isRTL ? 'متابعة الاشتراك والتسكين' : 'Open Subscriptions'}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={'text-xs px-3 py-1 rounded-full font-semibold ' + (STATUS_STYLES[trial.status] || 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]')}>
                      {pt.statuses[trial.status] || trial.status}
                    </span>
                    {canSchedule ? (
                      <button
                        type="button"
                        onClick={() => setActiveId(activeId === trial._id ? '' : trial._id)}
                        className="wn-btn wn-btn--primary min-h-[44px]"
                        disabled={Boolean(working)}
                      >
                        <CalendarClock size={16} aria-hidden="true" /> {trial.status === 'pending' ? pt.card.assignBtn : pt.card.rescheduleBtn}
                      </button>
                    ) : null}
                    {trial.status === 'scheduled' ? (
                      <button
                        type="button"
                        onClick={() => setNoShowModal(trial)}
                        disabled={Boolean(working)}
                        className="wn-btn wn-btn--secondary min-h-[44px]"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                        {pt.card.noShowBtn}
                      </button>
                    ) : null}
                    {['pending', 'scheduled'].includes(trial.status) ? (
                      <button
                        type="button"
                        onClick={() => setCancelModal({ trial, reason: '' })}
                        disabled={Boolean(working)}
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <XCircle size={16} aria-hidden="true" /> {pt.card.cancelBtn}
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

          {pagination.pages > 1 ? (
            <div className="wn-dashboard-surface flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--wn-text-secondary)]">
                {isRTL
                  ? `صفحة ${pagination.page} من ${pagination.pages} (${pagination.total} طلب)`
                  : `Page ${pagination.page} of ${pagination.pages} (${pagination.total} requests)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="wn-btn wn-btn--secondary min-h-[40px] disabled:opacity-40"
                >
                  {isRTL ? 'السابق' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.pages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="wn-btn wn-btn--secondary min-h-[40px] disabled:opacity-40"
                >
                  {isRTL ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        isOpen={Boolean(noShowModal)}
        onClose={() => { if (!isMarkingNoShow) setNoShowModal(null); }}
        title={pt.noShowModal.title}
        disableClose={isMarkingNoShow}
      >
        {noShowModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{formatMsg(pt.noShowModal.body, { name: noShowModal.studentName || pt.card.studentFallback })}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={isMarkingNoShow}
                onClick={() => setNoShowModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {pt.noShowModal.cancel}
              </button>
              <button
                type="button"
                disabled={isMarkingNoShow}
                onClick={async () => {
                  const ok = await updateStatus(noShowModal, 'no_show');
                  if (ok) setNoShowModal(null);
                }}
                className="wn-btn wn-btn--primary min-h-[44px] disabled:opacity-50"
              >
                {isMarkingNoShow ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {pt.noShowModal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(cancelModal)}
        onClose={() => { if (!isCancelling) setCancelModal(null); }}
        title={pt.cancelModal.title}
        disableClose={isCancelling}
      >
        {cancelModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{pt.cancelModal.student} <strong>{cancelModal.trial.studentName || dash}</strong></p>
            <div>
              <label htmlFor={cancelReasonId} className="block text-xs font-semibold text-[var(--wn-heading)] mb-1">
                {pt.cancelModal.reasonLabel}
              </label>
              <textarea
                id={cancelReasonId}
                rows={3}
                value={cancelModal.reason}
                disabled={isCancelling}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                placeholder={pt.cancelModal.reasonPlaceholder}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancelModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {pt.cancelModal.back}
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  const targetTrial = cancelModal.trial;
                  const reason = cancelModal.reason.trim();
                  const ok = await updateStatus(targetTrial, 'cancelled', reason);
                  if (ok) setCancelModal(null);
                }}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-medium rounded-lg bg-[var(--wn-danger)] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {isCancelling ? pt.cancelModal.confirming : pt.cancelModal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminDashboardShell>
  );
}
