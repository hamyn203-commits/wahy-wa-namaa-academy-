import { useEffect, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
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

export default function AdminPeopleDirectory({ onOpenStudent, onOpenGuardian, selectedRole = 'all', approvedTeachers = [] }) {
  const toast = useToast();
  const { dir, isRTL, t } = useI18n();
  const pp = t.adminPortal.people;
  const fm = pp.form;
  const dm = pp.deleteModal;

  const [role, setRole] = useState(selectedRole);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ people: [], total: 0, pages: 1, counts: { student: null, guardian: null } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState(INITIAL_STUDENT_FORM);
  const [savingStudent, setSavingStudent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ role, status, page: String(page), limit: '15' });
    if (search) params.set('q', search);
    api.get('/api/admin/people/directory?' + params, { auth: true, signal: controller.signal })
      .then((result) => { if (current) setData(result); })
      .catch((err) => { if (current && err?.name !== 'AbortError') setError(err.message || pp.loadError); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [role, status, page, search, refresh, pp.loadError]);

  useEffect(() => { setRole(selectedRole); setPage(1); }, [selectedRole]);

  const selectRole = (next) => { setRole(next); setPage(1); };
  const selectStatus = (next) => { setStatus(next); setPage(1); };
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

  const handleDeleteStudent = async () => {
    if (!deleteTarget || deletingStudent) return;
    setDeletingStudent(true);
    try {
      await api.delete(`/api/admin/people/students/${deleteTarget._id}`, { auth: true });
      toast.success(t.adminPortal.toasts.studentDeleted);
      setDeleteTarget(null);
      setRefresh((x) => x + 1);
    } catch (err) {
      toast.error(err.message || t.adminPortal.toasts.studentDeleteFailed);
    } finally {
      setDeletingStudent(false);
    }
  };

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <section className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 md:p-7 space-y-5" dir={dir} aria-label={pp.directoryAria}>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--wn-heading)]">{pp.directoryTitle}</h2>
          <p className="text-sm text-[var(--wn-text-secondary)] mt-1">{pp.directoryDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                    {approvedTeachers.map((teacherItem) => (
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => selectRole('student')}
          className={`rounded-xl border p-4 text-start min-h-[44px] ${role === 'student' ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]' : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)]'}`}
        >
          <Users size={20} className="text-[var(--wn-emerald)] mb-2" aria-hidden="true" />
          <strong className="block text-[var(--wn-heading)]">{pp.counts.students}</strong>
          <span className="text-xl font-bold text-[var(--wn-text-primary)]">{loading && data.counts?.student == null ? '…' : (data.counts?.student ?? t.adminPortal.common.dash)}</span>
        </button>
        <button
          type="button"
          onClick={() => selectRole('guardian')}
          className={`rounded-xl border p-4 text-start min-h-[44px] ${role === 'guardian' ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]' : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)]'}`}
        >
          <ShieldCheck size={20} className="text-[var(--wn-emerald)] mb-2" aria-hidden="true" />
          <strong className="block text-[var(--wn-heading)]">{pp.counts.guardians}</strong>
          <span className="text-xl font-bold text-[var(--wn-text-primary)]">{loading && data.counts?.guardian == null ? '…' : (data.counts?.guardian ?? t.adminPortal.common.dash)}</span>
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[190px] flex items-center gap-2 border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-xl px-3">
          <Search size={17} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
          <input
            className="w-full min-h-[44px] py-2 outline-none bg-transparent text-[var(--wn-text-primary)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pp.searchPlaceholder}
            aria-label={pp.searchAria}
          />
        </div>
        <button type="submit" className="min-h-[44px] rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-5 font-semibold">
          {pp.searchBtn}
        </button>
        <select className="min-h-[44px] rounded-xl border border-[var(--wn-border)] px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" value={role} onChange={(e) => selectRole(e.target.value)} aria-label={pp.filters.roleAria}>
          <option value="all">{pp.filters.roleAll}</option>
          <option value="student">{pp.filters.roleStudents}</option>
          <option value="guardian">{pp.filters.roleGuardians}</option>
        </select>
        <select className="min-h-[44px] rounded-xl border border-[var(--wn-border)] px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" value={status} onChange={(e) => selectStatus(e.target.value)} aria-label={pp.filters.statusAria}>
          <option value="all">{pp.filters.statusAll}</option>
          <option value="active">{pp.filters.statusActive}</option>
          <option value="inactive">{pp.filters.statusInactive}</option>
        </select>
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
        <div className="space-y-2" role="status" aria-label={pp.loading}>
          {[1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : !error && data.people?.length === 0 ? (
        <EmptyState icon={Users} title={pp.empty} />
      ) : (
        <div className="space-y-2">
          {(data.people || []).map((person) => (
            <div key={person._id} className="w-full text-start flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 hover:bg-[var(--wn-emerald-soft)] transition">
              <button type="button" onClick={() => open(person)} className="flex-1 min-w-[200px] min-h-[44px] text-start flex items-center gap-3">
                <span className="rounded-full bg-[var(--wn-surface)] p-3 text-[var(--wn-emerald)]">
                  {person.role === 'student' ? <Users size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
                </span>
                <span>
                  <strong className="block text-[var(--wn-heading)]">{person.name || pp.search.noName}</strong>
                  <small className="text-[var(--wn-text-secondary)]">
                    {person.email || pp.search.noEmail} · {person.role === 'student' ? pp.search.roles.student : pp.search.roles.guardian}
                  </small>
                </span>
              </button>
              <span className={`text-xs rounded-full px-3 py-1 font-semibold ${person.isActive === false ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]' : 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]'}`}>
                {person.isActive === false ? pp.statusLabels.inactive : pp.statusLabels.active}
              </span>
              <button type="button" onClick={() => open(person)} className="min-h-[44px] text-sm text-[var(--wn-heading)] font-semibold px-3 py-2 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)]">
                {pp.open360}
              </button>
              {person.role === 'student' ? (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(person)}
                  className="min-h-[44px] text-xs text-[var(--wn-status-danger-text)] font-semibold px-3 py-2 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] inline-flex items-center gap-1"
                  title={pp.deleteTitle}
                >
                  <Trash2 size={14} aria-hidden="true" /> {pp.deleteBtn}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!deletingStudent) setDeleteTarget(null); }}
        title={dm.title}
        disableClose={deletingStudent}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{formatMsg(dm.body, { name: deleteTarget.name || '', email: deleteTarget.email || '' })}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button type="button" disabled={deletingStudent} onClick={() => setDeleteTarget(null)} className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)] disabled:opacity-50">
                {dm.cancel}
              </button>
              <button
                type="button"
                disabled={deletingStudent}
                onClick={handleDeleteStudent}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {deletingStudent ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {deletingStudent ? dm.deleting : dm.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

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
