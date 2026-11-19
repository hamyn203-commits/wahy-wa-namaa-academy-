import { useId } from 'react';
import { BookOpen, Check, Loader2, Trash2, Upload, Video } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { localizedValue } from './adminFormat';

const PROGRAM_KEYS = ['kids', 'reverts', 'women', 'general'];

export default function AdminCoursesTab({
  courses,
  approved,
  selectedCourse,
  lessons,
  courseForm,
  setCourseForm,
  lessonForm,
  setLessonForm,
  courseProgramFilter,
  setCourseProgramFilter,
  seeding,
  uploading,
  creatingCourse,
  addingLesson,
  togglingCourseId,
  onSeedDemoCourse,
  onAddCourse,
  onSelectCourse,
  onToggleCourseStatus,
  onDeleteItem,
  onAddLesson,
  onUploadVideo,
}) {
  const { locale, t } = useI18n();
  const tc = t.adminPortal.tabs.courses;
  const formId = useId();

  const filteredCourses = courses.filter(
    (c) => courseProgramFilter === 'all' || (c.programs || []).includes(courseProgramFilter)
  );

  return (
    <div className="space-y-6">
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

      <form onSubmit={onAddCourse} className="wn-dashboard-surface grid md:grid-cols-2 gap-3">
        <h3 className="font-bold text-[var(--wn-heading)] md:col-span-2 flex items-center gap-2">
          <BookOpen size={18} aria-hidden="true" />
          <span>{tc.newTitle}</span>
        </h3>
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
        <div>
          <label htmlFor={`${formId}-price`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tc.fields.price}
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
          disabled={creatingCourse}
          className="md:col-span-2 min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {creatingCourse && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          <span>{creatingCourse ? tc.creatingBtn : tc.createBtn}</span>
        </button>
      </form>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="wn-dashboard-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-bold text-[var(--wn-heading)]">
              {tc.listTitle.replace('{count}', String(filteredCourses.length))}
            </h3>
            <select
              value={courseProgramFilter}
              onChange={(e) => setCourseProgramFilter(e.target.value)}
              aria-label={tc.filterAria}
              className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">{tc.allPrograms}</option>
              {PROGRAM_KEYS.map((p) => (
                <option key={p} value={p}>{tc.programs?.[p] || p}</option>
              ))}
            </select>
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
                  className={`border rounded-lg p-3 mb-2 transition flex flex-wrap items-center justify-between gap-2 ${
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
                      {c.slug} — {c.status} — {c.price}$ {(c.programs || []).length ? `[${c.programs.join(',')}]` : ''}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleCourseStatus(c)}
                      disabled={isToggling}
                      className="min-h-[44px] text-xs px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isToggling && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                      <span>{c.status === 'published' ? tc.unpublish : tc.publish}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem('course', c._id, titleText)}
                      aria-label={tc.deleteAria}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
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
            <h3 className="font-bold text-[var(--wn-heading)] mb-4 flex items-center gap-2">
              <Video size={18} aria-hidden="true" />
              <span>{tc.lessonsTitle}</span>
            </h3>
            <form onSubmit={onAddLesson} className="space-y-2 mb-4 p-3 bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] rounded-lg">
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
                  onChange={(e) => setLessonForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="video">{tc.lessonTypes.video}</option>
                  <option value="text">{tc.lessonTypes.text}</option>
                </select>
              </div>
              {lessonForm.type === 'video' && (
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
              )}
              <button
                type="submit"
                disabled={addingLesson || uploading}
                className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {addingLesson && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                <span>{addingLesson ? tc.lessonFields.addingLessonBtn : tc.lessonFields.addLessonBtn}</span>
              </button>
            </form>

            {lessons.map((l) => {
              const lessonTitle = localizedValue(l.title, locale) || l.slug || '';
              return (
                <div
                  key={l._id}
                  className="border border-[var(--wn-border)] rounded-lg px-3 py-2 mb-2 flex items-center justify-between gap-2 text-sm text-[var(--wn-text-primary)]"
                >
                  <span>{l.order}. {lessonTitle} ({l.type})</span>
                  <button
                    type="button"
                    onClick={() => onDeleteItem('lesson', l._id, lessonTitle)}
                    aria-label={tc.lessonFields.deleteLessonAria}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
