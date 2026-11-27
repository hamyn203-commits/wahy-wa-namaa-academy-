import { useId, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Check, Edit3, ExternalLink, Loader2, Search, Sparkles, Trash2, Upload, Video, X,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { localizedValue } from './adminFormat';

const PROGRAM_KEYS = ['kids', 'reverts', 'women', 'general'];

export default function AdminCoursesTab({
  courses,
  approved,
  selectedCourse,
  lessons,
  loadingLessons = false,
  courseForm,
  setCourseForm,
  lessonForm,
  setLessonForm,
  courseProgramFilter,
  setCourseProgramFilter,
  seeding,
  seedingCatalog = false,
  uploading,
  creatingCourse,
  addingLesson,
  togglingCourseId,
  onSeedDemoCourse,
  onSeedOfficialCatalog,
  onAddCourse,
  onUpdateCourse = null,
  onSelectCourse,
  onToggleCourseStatus,
  onDeleteItem,
  onAddLesson,
  onUpdateLesson = null,
  onUploadVideo,
}) {
  const { locale, isRTL, t } = useI18n();
  const tc = t.adminPortal.tabs.courses;
  const formId = useId();
  const courseFormRef = useRef(null);
  const showDemoSeedCard = Boolean(import.meta.env.DEV);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [savingCourseEdit, setSavingCourseEdit] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [savingLessonEdit, setSavingLessonEdit] = useState(false);

  const stats = useMemo(() => {
    const published = courses.filter((c) => c.status === 'published').length;
    const drafts = courses.filter((c) => c.status !== 'published').length;
    const enrolled = courses.reduce((sum, c) => sum + Number(c.stats?.enrolled || 0), 0);
    return { total: courses.length, published, drafts, enrolled };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      if (courseProgramFilter !== 'all' && !(c.programs || []).includes(courseProgramFilter)) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!term) return true;
      const titleText = localizedValue(c.title, locale) || '';
      const instructorName = c.instructor?.user?.name || c.instructor?.personalInfo?.fullName || '';
      return [titleText, c.slug, instructorName].some((val) => String(val || '').toLowerCase().includes(term));
    });
  }, [courses, courseProgramFilter, statusFilter, searchQuery, locale]);

  const startEditingCourse = (course) => {
    setEditingCourseId(course._id);
    setCourseForm({
      titleAr: course.title?.ar || localizedValue(course.title, locale) || '',
      slug: course.slug || '',
      instructorId: course.instructor?._id || course.instructor || '',
      price: Number(course.price || 0),
      priceEgp: course.regionalPrices?.EG != null ? Number(course.regionalPrices.EG) : '',
      descAr: course.description?.ar || localizedValue(course.description, locale) || '',
      programs: Array.isArray(course.programs) ? [...course.programs] : [],
    });
    courseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEditingCourse = () => {
    setEditingCourseId(null);
    setCourseForm({ titleAr: '', slug: '', instructorId: '', price: 0, priceEgp: '', descAr: '', programs: [] });
  };

  const handleCourseFormSubmit = async (e) => {
    if (!editingCourseId || !onUpdateCourse) {
      await onAddCourse(e);
      return;
    }
    e.preventDefault();
    if (savingCourseEdit) return;
    setSavingCourseEdit(true);
    try {
      const ok = await onUpdateCourse(editingCourseId, {
        ...courseForm,
        priceEgp: courseForm.priceEgp === '' ? undefined : Number(courseForm.priceEgp),
      });
      if (ok !== false) {
        cancelEditingCourse();
      }
    } finally {
      setSavingCourseEdit(false);
    }
  };

  const startEditingLesson = (lesson) => {
    setEditingLessonId(lesson._id);
    const vidUrl = lesson.content?.video?.url || '';
    const isYt = vidUrl.includes('youtube') || vidUrl.includes('youtu.be');
    setLessonForm({
      titleAr: lesson.title?.ar || localizedValue(lesson.title, locale) || '',
      type: lesson.type || 'video',
      videoUrl: isYt ? '' : vidUrl,
      youtubeUrl: isYt ? vidUrl : '',
      textAr: lesson.content?.text?.ar || '',
      duration: Number(lesson.duration || 10),
      order: Number(lesson.order || 1),
    });
  };

  const cancelEditingLesson = () => {
    setEditingLessonId(null);
    setLessonForm({ titleAr: '', type: 'video', videoUrl: '', youtubeUrl: '', textAr: '', duration: 10 });
  };

  const handleLessonFormSubmit = async (e) => {
    if (!editingLessonId || !onUpdateLesson) {
      await onAddLesson(e);
      return;
    }
    e.preventDefault();
    if (savingLessonEdit) return;
    setSavingLessonEdit(true);
    try {
      const videoSrc = String(lessonForm.videoUrl || lessonForm.youtubeUrl || '').trim();
      const ok = await onUpdateLesson(editingLessonId, {
        titleAr: lessonForm.titleAr,
        order: lessonForm.order,
        ...(lessonForm.type === 'video' ? { videoUrl: videoSrc || undefined } : { textAr: lessonForm.textAr || '' }),
      });
      if (ok !== false) {
        cancelEditingLesson();
      }
    } finally {
      setSavingLessonEdit(false);
    }
  };

  const isCourseSubmitting = creatingCourse || savingCourseEdit;
  const isLessonSubmitting = addingLesson || savingLessonEdit;

  return (
    <div className="space-y-6">
      {/* KPI Pulse Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="wn-dashboard-surface p-3.5">
          <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
            {isRTL ? 'إجمالي الدورات' : 'Total Courses'}
          </span>
          <strong className="text-2xl font-extrabold text-[var(--wn-heading)] mt-1 block">{stats.total}</strong>
        </div>
        <div className="wn-dashboard-surface p-3.5">
          <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
            {isRTL ? 'منشورة للجمهور' : 'Published'}
          </span>
          <strong className="text-2xl font-extrabold text-[var(--wn-emerald)] mt-1 block">{stats.published}</strong>
        </div>
        <div className="wn-dashboard-surface p-3.5">
          <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
            {isRTL ? 'مسودات وأرشيف' : 'Drafts & Archived'}
          </span>
          <strong className="text-2xl font-extrabold text-[var(--wn-heading)] mt-1 block">{stats.drafts}</strong>
        </div>
        <div className="wn-dashboard-surface p-3.5">
          <span className="text-xs font-semibold text-[var(--wn-text-secondary)] block">
            {isRTL ? 'إجمالي الملتحقين' : 'Total Enrollments'}
          </span>
          <strong className="text-2xl font-extrabold text-[var(--wn-heading)] mt-1 block">{stats.enrolled}</strong>
        </div>
      </section>

      {onSeedOfficialCatalog ? (
        <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
              <Sparkles size={17} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>
                {isRTL
                  ? 'نشر / تحديث كتالوج الدورات الرسمي (5 دورات بتسعير مصر والدولي)'
                  : 'Publish / Sync Official 5-Course Catalog (EGP & Regional USD)'}
              </span>
            </h3>
            <p className="text-xs text-[var(--wn-text-secondary)] mt-1 leading-6">
              {isRTL
                ? 'ينشر دورة الفاتحة المجانية لجذب المشتركين + 4 دورات تأسيس وتجويد وحفظ وجزرية بأسعار مدروسة لمصر (149–249 ج.م) والخليج وأوروبا (9–29 دولار).'
                : 'Publishes the Free Al-Fatiha Lead-Magnet course + 4 structured courses with calibrated EGP (149–249 EGP) and regional USD pricing.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSeedOfficialCatalog}
            disabled={seedingCatalog || approved.length === 0}
            className="min-h-[44px] px-4 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {seedingCatalog && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            <span>
              {seedingCatalog
                ? tc.creating
                : (isRTL ? 'نشر الكتالوج الرسمي الآن' : 'Publish Official Catalog')}
            </span>
          </button>
        </div>
      ) : null}

      {showDemoSeedCard ? (
        <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[var(--wn-heading)]">{tc.demoTitle}</h3>
            <p className="text-sm text-[var(--wn-text-secondary)] mt-1">{tc.demoDesc}</p>
          </div>
          <button
            type="button"
            onClick={onSeedDemoCourse}
            disabled={seeding}
            className="min-h-[44px] px-4 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {seeding && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            <span>{seeding ? tc.creating : tc.demoBtn}</span>
          </button>
        </div>
      ) : null}

      <form ref={courseFormRef} onSubmit={handleCourseFormSubmit} className="wn-dashboard-surface grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
            {editingCourseId ? <Edit3 size={18} className="text-[var(--wn-emerald)]" aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
            <span>
              {editingCourseId
                ? (isRTL ? 'تعديل بيانات الدورة المختارة' : 'Edit Selected Course')
                : tc.newTitle}
            </span>
          </h3>
          {editingCourseId ? (
            <button
              type="button"
              onClick={cancelEditingCourse}
              className="min-h-[36px] px-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-secondary)] inline-flex items-center gap-1"
            >
              <X size={14} aria-hidden="true" />
              <span>{isRTL ? 'إلغاء التعديل' : 'Cancel Edit'}</span>
            </button>
          ) : null}
        </div>
        <div>
          <label htmlFor={`${formId}-title`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tc.fields.titleAr}
          </label>
          <input
            id={`${formId}-title`}
            required
            placeholder={tc.fields.titleAr}
            value={courseForm.titleAr}
            onChange={(e) => setCourseForm((p) => ({ ...p, titleAr: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-slug`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tc.fields.slug}
          </label>
          <input
            id={`${formId}-slug`}
            required
            placeholder={tc.fields.slug}
            value={courseForm.slug}
            onChange={(e) => setCourseForm((p) => ({ ...p, slug: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-instructor`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tc.fields.instructor}
          </label>
          <select
            id={`${formId}-instructor`}
            required
            value={courseForm.instructorId}
            onChange={(e) => setCourseForm((p) => ({ ...p, instructorId: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">{tc.fields.selectInstructor}</option>
            {approved.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.user?.name || teacher.personalInfo?.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${formId}-price-egp`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
              {isRTL ? 'السعر لمصر (ج.م)' : 'Egypt Price (EGP)'}
            </label>
            <input
              id={`${formId}-price-egp`}
              type="number"
              min="0"
              placeholder={isRTL ? 'مثال: 179' : 'e.g. 179'}
              value={courseForm.priceEgp ?? ''}
              onChange={(e) => setCourseForm((p) => ({ ...p, priceEgp: e.target.value === '' ? '' : Number(e.target.value) }))}
              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-price`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
              {isRTL ? 'السعر الدولي ($)' : tc.fields.price}
            </label>
            <input
              id={`${formId}-price`}
              type="number"
              min="0"
              placeholder={tc.fields.price}
              value={courseForm.price}
              onChange={(e) => setCourseForm((p) => ({ ...p, price: Number(e.target.value) }))}
              className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`${formId}-desc`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tc.fields.descAr}
          </label>
          <textarea
            id={`${formId}-desc`}
            placeholder={tc.fields.descAr}
            value={courseForm.descAr}
            onChange={(e) => setCourseForm((p) => ({ ...p, descAr: e.target.value }))}
            className="w-full border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
            rows={2}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-[var(--wn-text-secondary)]">{tc.fields.programs}:</span>
          {PROGRAM_KEYS.map((prog) => (
            <label key={prog} className="inline-flex items-center gap-2 min-h-[44px] px-2 text-sm text-[var(--wn-text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={courseForm.programs.includes(prog)}
                onChange={(e) =>
                  setCourseForm((p) => ({
                    ...p,
                    programs: e.target.checked
                      ? [...p.programs, prog]
                      : p.programs.filter((x) => x !== prog),
                  }))
                }
                className="w-4 h-4 accent-[var(--wn-emerald)]"
              />
              <span>{tc.programs?.[prog] || prog}</span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isCourseSubmitting}
          className="md:col-span-2 min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isCourseSubmitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          <span>
            {editingCourseId
              ? (savingCourseEdit ? (isRTL ? 'جارٍ حفظ التعديلات...' : 'Saving...') : (isRTL ? 'حفظ تعديلات الدورة' : 'Save Course Changes'))
              : (creatingCourse ? tc.creatingBtn : tc.createBtn)}
          </span>
        </button>
      </form>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="wn-dashboard-surface space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-[var(--wn-heading)]">
              {tc.listTitle.replace('{count}', String(filteredCourses.length))}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={isRTL ? 'تصفية حالة الدورة' : 'Filter course status'}
                className="min-h-[40px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              >
                <option value="all">{isRTL ? 'كل الحالات' : 'All statuses'}</option>
                <option value="published">{isRTL ? 'منشورة' : 'Published'}</option>
                <option value="draft">{isRTL ? 'مسودة' : 'Draft'}</option>
                <option value="archived">{isRTL ? 'مؤرشفة' : 'Archived'}</option>
              </select>
              <select
                value={courseProgramFilter}
                onChange={(e) => setCourseProgramFilter(e.target.value)}
                aria-label={tc.filterAria}
                className="min-h-[40px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              >
                <option value="all">{tc.allPrograms}</option>
                {PROGRAM_KEYS.map((p) => (
                  <option key={p} value={p}>{tc.programs?.[p] || p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'بحث بعنوان الدورة أو الرابط أو المعلم...' : 'Search course title, slug, instructor...'}
              className="w-full min-h-[40px] ps-9 pe-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs text-[var(--wn-text-primary)]"
            />
          </div>

          {filteredCourses.length === 0 ? (
            <EmptyState icon={BookOpen} title={tc.empty} />
          ) : (
            filteredCourses.map((c) => {
              const titleText = localizedValue(c.title, locale) || c.slug;
              const isSelected = selectedCourse === c._id;
              const isToggling = togglingCourseId === c._id;
              return (
                <div
                  key={c._id}
                  className={`border rounded-lg p-3 transition flex flex-wrap items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-surface-mint)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCourse(c._id)}
                    className="flex-1 min-w-0 text-start min-h-[44px] rounded-md px-1"
                  >
                    <p className="font-semibold text-[var(--wn-heading)] truncate">{titleText}</p>
                    <p className="text-xs text-[var(--wn-text-secondary)]">
                      {c.slug} — {c.status} — {c.regionalPrices?.EG != null ? `${c.regionalPrices.EG} ج.م / ` : ''}{c.price}$ {(c.programs || []).length ? `[${c.programs.join(',')}]` : ''}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {c.slug && c.status === 'published' ? (
                      <a
                        href={localizedPath(`/courses/${encodeURIComponent(c.slug)}`, locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={isRTL ? 'معاينة الدورة' : 'Preview course'}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald)]"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                    {onUpdateCourse ? (
                      <button
                        type="button"
                        onClick={() => startEditingCourse(c)}
                        aria-label={isRTL ? `تعديل ${titleText}` : `Edit ${titleText}`}
                        className="min-h-[40px] text-xs px-2.5 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onToggleCourseStatus(c)}
                      disabled={isToggling}
                      className="min-h-[40px] text-xs px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isToggling && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                      <span>{c.status === 'published' ? tc.unpublish : tc.publish}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem('course', c._id, titleText)}
                      aria-label={tc.deleteAria}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedCourse && (
          <div className="wn-dashboard-surface">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
                <Video size={18} aria-hidden="true" />
                <span>{tc.lessonsTitle}</span>
              </h3>
              {editingLessonId ? (
                <button
                  type="button"
                  onClick={cancelEditingLesson}
                  className="min-h-[34px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-semibold text-[var(--wn-text-secondary)] inline-flex items-center gap-1"
                >
                  <X size={13} aria-hidden="true" />
                  <span>{isRTL ? 'إلغاء تعديل الدرس' : 'Cancel Lesson Edit'}</span>
                </button>
              ) : null}
            </div>
            <form onSubmit={handleLessonFormSubmit} className="space-y-2 mb-4 p-3 bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] rounded-lg">
              <div>
                <label htmlFor={`${formId}-lesson-title`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                  {tc.lessonFields.titleAr}
                </label>
                <input
                  id={`${formId}-lesson-title`}
                  required
                  placeholder={tc.lessonFields.titleAr}
                  value={lessonForm.titleAr}
                  onChange={(e) => setLessonForm((p) => ({ ...p, titleAr: e.target.value }))}
                  className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`${formId}-lesson-type`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                  {tc.lessonFields.type}
                </label>
                <select
                  id={`${formId}-lesson-type`}
                  value={lessonForm.type}
                  disabled={Boolean(editingLessonId)}
                  onChange={(e) => setLessonForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="video">{tc.lessonTypes.video}</option>
                  <option value="text">{tc.lessonTypes.text}</option>
                </select>
              </div>
              {lessonForm.type === 'video' ? (
                <>
                  <div>
                    <label htmlFor={`${formId}-lesson-yt`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                      {tc.lessonFields.youtubeUrl}
                    </label>
                    <input
                      id={`${formId}-lesson-yt`}
                      placeholder={tc.lessonFields.youtubeUrl}
                      value={lessonForm.youtubeUrl}
                      onChange={(e) => setLessonForm((p) => ({ ...p, youtubeUrl: e.target.value }))}
                      className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="flex-1 min-h-[44px] flex items-center gap-2 px-3 py-2 border border-[var(--wn-border)] rounded-lg cursor-pointer text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)]">
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload size={16} aria-hidden="true" />
                      )}
                      <span>{uploading ? tc.lessonFields.uploading : tc.lessonFields.uploadVideo}</span>
                      <input type="file" accept="video/*" className="hidden" onChange={onUploadVideo} disabled={uploading} />
                    </label>
                    {lessonForm.videoUrl && (
                      <span className="text-xs text-[var(--wn-status-success-text)] inline-flex items-center gap-1 font-semibold">
                        <Check size={14} aria-hidden="true" />
                        <span>{tc.lessonFields.uploaded}</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor={`${formId}-lesson-text`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                    {isRTL ? 'محتوى الدرس النصي' : 'Lesson Text Content'}
                  </label>
                  <textarea
                    id={`${formId}-lesson-text`}
                    rows={4}
                    value={lessonForm.textAr || ''}
                    onChange={(e) => setLessonForm((p) => ({ ...p, textAr: e.target.value }))}
                    placeholder={isRTL ? 'اكتب شرح الدرس والمحاور العلمية هنا...' : 'Write lesson content here...'}
                    className="w-full border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={isLessonSubmitting || uploading}
                className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLessonSubmitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                <span>
                  {editingLessonId
                    ? (savingLessonEdit ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ تعديل الدرس' : 'Save Lesson Changes'))
                    : (addingLesson ? tc.lessonFields.addingLessonBtn : tc.lessonFields.addLessonBtn)}
                </span>
              </button>
            </form>

            {loadingLessons ? (
              <div className="space-y-2" role="status" aria-label={t.adminPortal.common.loading}>
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : lessons.map((l) => {
              const lessonTitle = localizedValue(l.title, locale) || l.slug || '';
              return (
                <div
                  key={l._id}
                  className="border border-[var(--wn-border)] rounded-lg px-3 py-2 mb-2 flex items-center justify-between gap-2 text-sm text-[var(--wn-text-primary)]"
                >
                  <span className="truncate">{l.order}. {lessonTitle} ({l.type})</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateLesson ? (
                      <button
                        type="button"
                        onClick={() => startEditingLesson(l)}
                        aria-label={isRTL ? `تعديل الدرس ${lessonTitle}` : `Edit lesson ${lessonTitle}`}
                        className="min-h-[38px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-semibold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] inline-flex items-center gap-1"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeleteItem('lesson', l._id, lessonTitle)}
                      aria-label={tc.lessonFields.deleteLessonAria}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
