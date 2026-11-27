import { useEffect, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Clock3, GraduationCap, Link2, Loader2,
  MessageCircle, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { formatMsg } from './adminFormat';

const INITIAL_STUDENT_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  age: 12,
  gender: 'male',
  currentLevel: 'beginner',
  preferredTrack: 'memorization',
  memorizedJuz: 0,
  createSubscription: false,
  planKey: 'group',
  sessionCount: 8,
  preferredTeacherId: '',
};

function whatsappLink(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

export default function AdminPeopleDirectory({
  onOpenStudent,
  onOpenGuardian,
  selectedRole = 'all',
  approvedTeachers = [],
  showingGuardianLinks = false,
  onToggleGuardianLinks,
  pendingGuardianLinksCount = 0,
}) {
  const toast = useToast();
  const { dir, isRTL, t } = useI18n();
  const pp = t.adminPortal.people;
  const fm = pp.form;
  const dash = t.adminPortal.common.dash;

  const [role, setRole] = useState(selectedRole);
  const [status, setStatus] = useState('all');
  const [section, setSection] = useState('all');
  const [track, setTrack] = useState('all');
  const [focus, setFocus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({
    people: [],
    total: 0,
    pages: 1,
    counts: { student: null, guardian: null },
    pulse: { awaitingPlacement: 0, lowBalance: 0, minorsWithoutGuardian: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState(INITIAL_STUDENT_FORM);
  const [savingStudent, setSavingStudent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      role,
      status,
      section,
      track,
      focus,
      page: String(page),
      limit: '15',
    });
    if (search) params.set('q', search);
    api.get('/api/admin/people/directory?' + params, { auth: true, signal: controller.signal })
      .then((result) => { if (current) setData(result); })
      .catch((err) => { if (current && err?.name !== 'AbortError') setError(err.message || pp.loadError); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [role, status, section, track, focus, page, search, refresh, pp.loadError]);

  useEffect(() => { setRole(selectedRole); setPage(1); }, [selectedRole]);

  const selectRole = (next) => {
    setRole(next);
    if (next === 'guardian') {
      setFocus('all');
      setSection('all');
      setTrack('all');
    }
    setPage(1);
  };
  const selectFocus = (nextFocus) => {
    const toggled = focus === nextFocus ? 'all' : nextFocus;
    setFocus(toggled);
    if (toggled !== 'all') setRole('student');
    setPage(1);
  };
  const clearFilters = () => {
    setRole('all');
    setStatus('all');
    setSection('all');
    setTrack('all');
    setFocus('all');
    setQuery('');
    setSearch('');
    setPage(1);
  };

  const submit = (event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); };
  const open = (person) => (person.role === 'student'
    ? onOpenStudent?.(person._id)
    : onOpenGuardian?.(person._id));

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (savingStudent) return;
    setSavingStudent(true);
    try {
      await api.post('/api/admin/people/students', {
        ...studentForm,
        age: Number(studentForm.age) || 12,
        memorizedJuz: Number(studentForm.memorizedJuz) || 0,
        sessionCount: Number(studentForm.sessionCount) || 8,
        preferredTeacherId: studentForm.preferredTeacherId || null,
      }, { auth: true });
      toast.success(studentForm.createSubscription ? t.adminPortal.toasts.studentCreatedWithSub : t.adminPortal.toasts.studentCreated);
      setStudentForm(INITIAL_STUDENT_FORM);
      setShowAddStudent(false);
      setRefresh((x) => x + 1);
    } catch (err) {
      toast.error(err.message || t.adminPortal.toasts.studentCreateFailed);
    } finally {
      setSavingStudent(false);
    }
  };

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const pulse = data.pulse || {};
  const hasActiveFilters = role !== 'all' || status !== 'all' || section !== 'all' || track !== 'all' || focus !== 'all' || Boolean(search);

  const subStatusLabel = (subStatus) => {
    if (!subStatus) return '';
    const mapAr = {
      awaiting_placement: 'بانتظار التسكين',
      placed: 'مُسكّن بحلقة قيد الاكتمال',
      active: 'اشتراك نشط',
      paused: 'مجمّد مؤقتاً',
      payment_review: 'إيصال قيد المراجعة',
    };
    const mapEn = {
      awaiting_placement: 'Awaiting placement',
      placed: 'Placed (forming)',
      active: 'Active package',
      paused: 'Paused',
      payment_review: 'Payment under review',
    };
    return (isRTL ? mapAr[subStatus] : mapEn[subStatus]) || subStatus;
  };

  return (
    <section className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 md:p-7 space-y-5" dir={dir} aria-label={pp.directoryAria}>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--wn-heading)]">{pp.directoryTitle}</h2>
          <p className="text-sm text-[var(--wn-text-secondary)] mt-1">{pp.directoryDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {typeof onToggleGuardianLinks === 'function' ? (
            <button
              type="button"
              onClick={onToggleGuardianLinks}
              className={`min-h-[44px] rounded-xl border px-3.5 py-2 flex items-center gap-2 text-xs font-bold transition ${
                showingGuardianLinks
                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                  : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] hover:border-[var(--wn-emerald)]'
              }`}
            >
              <Link2 size={15} aria-hidden="true" />
              <span>{isRTL ? 'طلبات ربط الأسرة' : 'Guardian Link Requests'}</span>
              {pendingGuardianLinksCount > 0 ? (
                <span className="rounded-full bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] px-2 py-0.5 text-xs font-extrabold">
                  {pendingGuardianLinksCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAddStudent((v) => !v)}
            className="min-h-[44px] rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-4 py-2 flex items-center gap-1.5 text-sm font-bold"
          >
            <Plus size={16} aria-hidden="true" /> {showAddStudent ? pp.closeAddBtn : pp.addStudentBtn}
          </button>
          <button
            type="button"
            onClick={() => setRefresh((x) => x + 1)}
            disabled={loading}
            className="min-h-[44px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] px-3 py-2 flex items-center gap-2 text-sm font-semibold"
            aria-label={pp.refreshAria}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {pp.refresh}
          </button>
        </div>
      </div>

      {showAddStudent ? (
        <form onSubmit={handleCreateStudent} className="rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-[var(--wn-heading)]">{fm.title}</h3>
            <span className="text-xs text-[var(--wn-emerald)]">{fm.note}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.name}</span>
              <input required type="text" placeholder={fm.namePlaceholder} value={studentForm.name} onChange={(e) => setStudentForm((p) => ({ ...p, name: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.email}</span>
              <input required type="email" placeholder={fm.emailPlaceholder} value={studentForm.email} onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.password}</span>
              <input required type="password" minLength={8} placeholder={fm.passwordPlaceholder} value={studentForm.password} onChange={(e) => setStudentForm((p) => ({ ...p, password: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.phone}</span>
              <input type="text" placeholder={fm.phonePlaceholder} value={studentForm.phone} onChange={(e) => setStudentForm((p) => ({ ...p, phone: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.age}</span>
              <input type="number" min={4} max={100} value={studentForm.age} onChange={(e) => setStudentForm((p) => ({ ...p, age: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.gender}</span>
              <select value={studentForm.gender} onChange={(e) => setStudentForm((p) => ({ ...p, gender: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                <option value="male">{fm.genderMale}</option>
                <option value="female">{fm.genderFemale}</option>
              </select>
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.level}</span>
              <select value={studentForm.currentLevel} onChange={(e) => setStudentForm((p) => ({ ...p, currentLevel: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                <option value="beginner">{fm.levels.beginner}</option>
                <option value="intermediate">{fm.levels.intermediate}</option>
                <option value="advanced">{fm.levels.advanced}</option>
                <option value="ijazah">{fm.levels.ijazah}</option>
              </select>
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{fm.track}</span>
              <select value={studentForm.preferredTrack} onChange={(e) => setStudentForm((p) => ({ ...p, preferredTrack: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                <option value="memorization">{fm.tracks.memorization}</option>
                <option value="tajweed_ijazah">{fm.tracks.tajweed_ijazah}</option>
                <option value="kids_foundation">{fm.tracks.kids_foundation}</option>
              </select>
            </label>
          </div>

          <div className="pt-2 border-t border-[var(--wn-border-mint)] space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={studentForm.createSubscription}
                onChange={(e) => setStudentForm((p) => ({ ...p, createSubscription: e.target.checked }))}
                className="w-4 h-4 accent-[var(--wn-emerald)]"
              />
              <span>{fm.createSub}</span>
            </label>

            {studentForm.createSubscription ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                  <span>{fm.planKey}</span>
                  <select value={studentForm.planKey} onChange={(e) => setStudentForm((p) => ({ ...p, planKey: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                    <option value="community">{fm.plans.community}</option>
                    <option value="group">{fm.plans.group}</option>
                    <option value="focused">{fm.plans.focused}</option>
                    <option value="mini">{fm.plans.mini}</option>
                    <option value="private">{fm.plans.private}</option>
                  </select>
                </label>
                <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                  <span>{fm.sessionCount}</span>
                  <select value={studentForm.sessionCount} onChange={(e) => setStudentForm((p) => ({ ...p, sessionCount: Number(e.target.value) }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                    {[4, 8, 12, 24].map((cnt) => (
                      <option key={cnt} value={cnt}>{formatMsg(fm.sessionOption, { count: cnt })}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 font-bold text-[var(--wn-heading)]">
                  <span>{fm.preferredTeacher}</span>
                  <select value={studentForm.preferredTeacherId} onChange={(e) => setStudentForm((p) => ({ ...p, preferredTeacherId: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                    <option value="">{fm.preferredTeacherLater}</option>
                    {approvedTeachers
                      .filter((tItem) => (studentForm.gender === 'female' ? tItem.personalInfo?.gender === 'female' : Number(studentForm.age) < 12 || tItem.personalInfo?.gender === 'male'))
                      .map((teacherItem) => (
                        <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.personalInfo?.fullName || teacherItem.user?.name || fm.teacherFallback}</option>
                      ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddStudent(false)} disabled={savingStudent} className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-text-secondary)]">
              {fm.cancel}
            </button>
            <button type="submit" disabled={savingStudent} className="min-h-[44px] px-5 py-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50">
              {savingStudent ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
              {savingStudent ? fm.saving : fm.submit}
            </button>
          </div>
        </form>
      ) : null}

      {/* Operational Pulse Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => { selectRole('student'); setFocus('all'); }}
          className={`rounded-xl border p-3.5 text-start min-h-[44px] transition ${
            role === 'student' && focus === 'all'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <Users size={18} className="text-[var(--wn-emerald)] mb-1.5" aria-hidden="true" />
          <strong className="block text-xs text-[var(--wn-heading)]">{pp.counts.students}</strong>
          <span className="text-xl font-extrabold text-[var(--wn-text-primary)] tabular-nums">
            {loading && data.counts?.student == null ? '…' : (data.counts?.student ?? dash)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectRole('guardian')}
          className={`rounded-xl border p-3.5 text-start min-h-[44px] transition ${
            role === 'guardian'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <ShieldCheck size={18} className="text-[var(--wn-emerald)] mb-1.5" aria-hidden="true" />
          <strong className="block text-xs text-[var(--wn-heading)]">{pp.counts.guardians}</strong>
          <span className="text-xl font-extrabold text-[var(--wn-text-primary)] tabular-nums">
            {loading && data.counts?.guardian == null ? '…' : (data.counts?.guardian ?? dash)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectFocus('awaiting_placement')}
          className={`rounded-xl border p-3.5 text-start min-h-[44px] transition ${
            focus === 'awaiting_placement'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : (pulse.awaitingPlacement > 0
                  ? 'border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]'
                  : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)]')
          }`}
        >
          <Sparkles size={18} className="text-[var(--wn-text-gold)] mb-1.5" aria-hidden="true" />
          <strong className="block text-xs text-[var(--wn-heading)]">
            {isRTL ? 'بانتظار التسكين' : 'Awaiting Placement'}
          </strong>
          <span className="text-xl font-extrabold text-[var(--wn-text-primary)] tabular-nums">
            {pulse.awaitingPlacement ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectFocus('low_balance')}
          className={`rounded-xl border p-3.5 text-start min-h-[44px] transition ${
            focus === 'low_balance'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : (pulse.lowBalance > 0
                  ? 'border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)]'
                  : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)]')
          }`}
        >
          <Clock3 size={18} className={pulse.lowBalance > 0 ? 'text-[var(--wn-status-danger-text)] mb-1.5' : 'text-[var(--wn-text-secondary)] mb-1.5'} aria-hidden="true" />
          <strong className="block text-xs text-[var(--wn-heading)]">
            {isRTL ? 'رصيد ≤ حصتين (تجديد)' : 'Low Balance (≤ 2)'}
          </strong>
          <span className="text-xl font-extrabold text-[var(--wn-text-primary)] tabular-nums">
            {pulse.lowBalance ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectFocus('minors_without_guardian')}
          className={`col-span-2 sm:col-span-1 rounded-xl border p-3.5 text-start min-h-[44px] transition ${
            focus === 'minors_without_guardian'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <ShieldAlert size={18} className="text-[var(--wn-text-gold)] mb-1.5" aria-hidden="true" />
          <strong className="block text-xs text-[var(--wn-heading)]">
            {isRTL ? 'قُصّر بلا ولي أمر' : 'Minors w/o Guardian'}
          </strong>
          <span className="text-xl font-extrabold text-[var(--wn-text-primary)] tabular-nums">
            {pulse.minorsWithoutGuardian ?? 0}
          </span>
        </button>
      </div>

      {/* Search & Multi-Dimensional Filters */}
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-xl px-3">
            <Search size={17} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
            <input
              className="w-full min-h-[44px] py-2 outline-none bg-transparent text-sm text-[var(--wn-text-primary)]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pp.searchPlaceholder}
              aria-label={pp.searchAria}
            />
          </div>
          <button type="submit" className="min-h-[44px] rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-5 text-sm font-semibold">
            {pp.searchBtn}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="min-h-[42px] rounded-xl border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]" value={role} onChange={(e) => selectRole(e.target.value)} aria-label={pp.filters.roleAria}>
            <option value="all">{pp.filters.roleAll}</option>
            <option value="student">{pp.filters.roleStudents}</option>
            <option value="guardian">{pp.filters.roleGuardians}</option>
          </select>

          <select className="min-h-[42px] rounded-xl border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={pp.filters.statusAria}>
            <option value="all">{pp.filters.statusAll}</option>
            <option value="active">{pp.filters.statusActive}</option>
            <option value="inactive">{pp.filters.statusInactive}</option>
          </select>

          {role !== 'guardian' ? (
            <>
              <select
                className="min-h-[42px] rounded-xl border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                value={section}
                onChange={(e) => { setSection(e.target.value); setPage(1); }}
                aria-label={isRTL ? 'القسم الدراسي' : 'Section'}
              >
                <option value="all">{isRTL ? 'كل الأقسام' : 'All Sections'}</option>
                <option value="men_children">{isRTL ? 'قسم الرجال والأطفال' : 'Men & Children'}</option>
                <option value="ladies">{isRTL ? 'قسم السيدات' : 'Ladies Section'}</option>
              </select>

              <select
                className="min-h-[42px] rounded-xl border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                value={track}
                onChange={(e) => { setTrack(e.target.value); setPage(1); }}
                aria-label={fm.track}
              >
                <option value="all">{isRTL ? 'كل المسارات' : 'All Tracks'}</option>
                <option value="memorization">{fm.tracks.memorization}</option>
                <option value="tajweed_ijazah">{fm.tracks.tajweed_ijazah}</option>
                <option value="kids_foundation">{fm.tracks.kids_foundation}</option>
              </select>

              <select
                className="min-h-[42px] rounded-xl border border-[var(--wn-border)] px-3 py-1.5 text-xs font-semibold bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                value={focus}
                onChange={(e) => { setFocus(e.target.value); if (e.target.value !== 'all') setRole('student'); setPage(1); }}
                aria-label={isRTL ? 'فلتر المتابعة الذكية' : 'Smart operational filter'}
              >
                <option value="all">{isRTL ? 'كل حالات المتابعة' : 'All Operational States'}</option>
                <option value="awaiting_placement">{isRTL ? 'مدفوع وبانتظار التسكين' : 'Paid · Awaiting Placement'}</option>
                <option value="low_balance">{isRTL ? 'رصيد منخفض (≤ حصتين)' : 'Low Balance (≤ 2 credits)'}</option>
                <option value="unassigned">{isRTL ? 'غير مسكّن في حلقة' : 'Not in a Circle'}</option>
                <option value="minors_without_guardian">{isRTL ? 'قاصر (< 18) بلا ولي أمر' : 'Minor (< 18) without Guardian'}</option>
              </select>
            </>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[42px] px-3 py-1.5 text-xs font-bold text-[var(--wn-link)] hover:underline"
            >
              {isRTL ? 'مسح الفلاتر' : 'Reset Filters'}
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} aria-hidden="true" />
            <span className="font-semibold text-sm">{error}</span>
          </div>
          <button type="button" onClick={() => setRefresh((x) => x + 1)} className="wn-btn wn-btn--secondary min-h-[44px]">
            {t.adminPortal.common.retry}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2.5" role="status" aria-label={pp.loading}>
          {[1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : !error && data.people?.length === 0 ? (
        <EmptyState icon={Users} title={pp.empty} />
      ) : (
        <div className="space-y-2.5">
          {(data.people || []).map((person) => {
            const isStudent = person.role === 'student';
            const sub = person.activeSubscription;
            const waHref = whatsappLink(person.whatsappPhone || person.phone);
            const resolvedSec = person.enrollmentSection || (person.gender === 'female' ? 'ladies' : 'men_children');
            const isLowBalance = sub && ['active', 'placed'].includes(sub.status) && Number(sub.sessionsRemaining ?? 99) <= 2;
            const isMinorUnlinked = isStudent && Number(person.age ?? 18) < 18 && Number(person.guardiansCount || 0) === 0;

            return (
              <article
                key={person._id}
                className="w-full text-start grid grid-cols-1 lg:grid-cols-12 items-center gap-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 hover:border-[var(--wn-emerald)] transition"
              >
                {/* Identity & Contact */}
                <button
                  type="button"
                  onClick={() => open(person)}
                  className="lg:col-span-4 min-h-[44px] text-start flex items-center gap-3 min-w-0 cursor-pointer"
                >
                  <span className="shrink-0 w-11 h-11 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)] flex items-center justify-center font-extrabold">
                    {person.name ? person.name.trim().slice(0, 1) : (isStudent ? <Users size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm text-[var(--wn-heading)] truncate">{person.name || pp.search.noName}</strong>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 font-bold ${person.isActive === false ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]' : 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]'}`}>
                        {person.isActive === false ? pp.statusLabels.inactive : pp.statusLabels.active}
                      </span>
                    </span>
                    <small className="block text-xs text-[var(--wn-text-secondary)] truncate">
                      {person.email || pp.search.noEmail}
                      {person.phone ? ` · ${person.phone}` : ''}
                    </small>
                  </span>
                </button>

                {/* Demographics / Section / Track */}
                <div className="lg:col-span-4 flex flex-wrap items-center gap-1.5 text-xs">
                  {isStudent ? (
                    <>
                      <span className="rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-1 font-semibold text-[var(--wn-text-primary)]">
                        {resolvedSec === 'ladies'
                          ? (isRTL ? 'قسم السيدات' : 'Ladies')
                          : (isRTL ? 'الرجال والأطفال' : 'Men & Kids')}
                        {person.age != null ? ` · ${person.age} ${isRTL ? 'سنة' : 'y'}` : ''}
                      </span>
                      {person.currentLevel ? (
                        <span className="rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-1 text-[var(--wn-text-secondary)]">
                          {fm.levels?.[person.currentLevel] || person.currentLevel}
                        </span>
                      ) : null}
                      {isMinorUnlinked ? (
                        <span className="rounded-lg border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] px-2 py-0.5 font-bold">
                          {isRTL ? 'قاصر بلا ولي أمر' : 'No guardian linked'}
                        </span>
                      ) : person.guardiansCount > 0 ? (
                        <span className="rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-emerald-dark)] px-2 py-0.5 font-semibold">
                          {isRTL ? `ولي أمر (${person.guardiansCount})` : `${person.guardiansCount} Guardian`}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-emerald-dark)] px-2.5 py-1 font-bold inline-flex items-center gap-1">
                      <ShieldCheck size={13} aria-hidden="true" />
                      <span>
                        {isRTL
                          ? `ولي أمر · ${person.childrenCount ?? 0} أبناء مرتبطون`
                          : `Guardian · ${person.childrenCount ?? 0} linked children`}
                      </span>
                    </span>
                  )}
                </div>

                {/* Live Placement & Package Status */}
                <div className="lg:col-span-2 text-xs space-y-1 min-w-0">
                  {isStudent ? (
                    sub ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${
                            isLowBalance
                              ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]'
                              : sub.status === 'awaiting_placement'
                                ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]'
                                : 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                          }`}>
                            {sub.sessionsRemaining}/{sub.sessionCount} {isRTL ? 'حصة' : 'left'}
                          </span>
                          {sub.isScholarship ? (
                            <span className="rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] px-2 py-0.5 font-bold">
                              {isRTL ? 'منحة' : 'Scholarship'}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[var(--wn-text-secondary)] truncate flex items-center gap-1">
                          <GraduationCap size={12} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {person.circle?.name || subStatusLabel(sub.status)}
                            {sub.teacherName ? ` · ${sub.teacherName}` : ''}
                          </span>
                        </p>
                      </>
                    ) : (
                      <span className="text-[var(--wn-text-tertiary)]">
                        {person.circle?.name || (isRTL ? 'بدون اشتراك نشط' : 'No active package')}
                      </span>
                    )
                  ) : null}
                </div>

                {/* Safe Operational Actions (No accidental 1-click hard delete!) */}
                <div className="lg:col-span-2 flex flex-wrap items-center justify-end gap-2">
                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={isRTL ? 'تواصل عبر واتساب' : 'Message on WhatsApp'}
                      aria-label={isRTL ? 'تواصل عبر واتساب' : 'Message on WhatsApp'}
                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] transition"
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => open(person)}
                    className="min-h-[42px] text-xs text-[var(--wn-text-inverse)] font-bold px-3.5 py-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] transition cursor-pointer"
                  >
                    {pp.open360}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center gap-3 text-sm text-[var(--wn-text-secondary)]">
        <span>{formatMsg(pp.pagination.summary, { total: data.total ?? 0, page, pages: data.pages || 1 })}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center border border-[var(--wn-border)] rounded-lg p-2 disabled:opacity-40" aria-label={pp.pagination.prevAria}>
            <PrevIcon size={18} aria-hidden="true" />
          </button>
          <button type="button" disabled={page >= (data.pages || 1) || loading} onClick={() => setPage((n) => n + 1)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center border border-[var(--wn-border)] rounded-lg p-2 disabled:opacity-40" aria-label={pp.pagination.nextAria}>
            <NextIcon size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
