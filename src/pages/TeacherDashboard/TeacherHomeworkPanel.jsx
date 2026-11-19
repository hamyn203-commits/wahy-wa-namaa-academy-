import { BookOpen, Calendar, CheckCircle2, Clock, Headphones, Loader2, MessageSquare, Plus, RotateCcw } from 'lucide-react';
import { resolveIntlLocale } from '../../lib/locale';
import { TeacherVoiceFeedbackRecorder } from '../../components/homework/VoiceFeedbackControls';
import EmptyState from '../../components/shared/EmptyState';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherHomeworkPanel({
  tasks,
  submittedTasks,
  taskTypeLabel,
  homeworkAudio,
  playHomeworkSubmission,
  taskReview,
  setTaskReview,
  taskFeedbackAudio,
  setTaskFeedbackAudio,
  reviewingTaskId,
  reviewTask,
  onOpenNewTask,
  locale,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const hw = tp.homework || {};
  const intlLocale = resolveIntlLocale(locale);

  return (
    <div className="wn-teacher-homework">
      <div className="wn-teacher-homework__intro">
        <div>
          <span>{hw.eyebrow || 'متابعة الواجبات'}</span>
          <h3>{hw.title || 'الواجبات والتسجيلات الصوتية'}</h3>
          <p>{hw.subtitle || 'استمع لتسليم الطالب، اكتب ملاحظتك، ثم اعتمد الواجب أو اطلب إعادة التسجيل.'}</p>
        </div>
        <div className="wn-teacher-homework__actions">
          {submittedTasks.length > 0 ? (
            <b>{formatMsg(hw.needsReviewCount || '{count} تحتاج مراجعة', { count: submittedTasks.length })}</b>
          ) : null}
          <button
            type="button"
            onClick={onOpenNewTask}
            className="wn-teacher-primary-action min-h-[44px]"
          >
            <Plus size={16} aria-hidden="true" /> {hw.newTaskBtn || 'واجب جديد'}
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={hw.emptyTitle || 'لا توجد واجبات بعد'}
          description={hw.emptyDesc || 'أنشئ واجبًا لطالب نشط ليظهر هنا.'}
        />
      ) : (
        <div className="wn-teacher-homework-list">
          {tasks.map((task) => {
            const isLoadingAudio = homeworkAudio.loading && homeworkAudio.taskId === task._id;
            const isReviewing = reviewingTaskId === task._id;
            const feedbackId = `task-feedback-${task._id}`;

            return (
              <article key={task._id} className={'wn-teacher-homework-card is-' + task.status}>
                <div className="wn-teacher-homework-card__top">
                  <span className="wn-teacher-homework-card__icon"><BookOpen size={18} aria-hidden="true" /></span>
                  <div>
                    <span>{taskTypeLabel(task.type)}</span>
                    <h4>{task.title}</h4>
                    <p>{task.student?.name || tp.requests?.studentFallback || 'طالب'}</p>
                    {task.circle?.name ? (
                      <small className="block text-xs text-[var(--wn-badge-emerald-text)] font-semibold">
                        {task.circle.name}
                      </small>
                    ) : null}
                  </div>
                  <span className="wn-teacher-homework-status">
                    {task.status === 'done'
                      ? (hw.statusDone || 'معتمد')
                      : task.status === 'submitted'
                        ? (hw.statusSubmitted || 'جاهز للمراجعة')
                        : (hw.statusPending || 'بانتظار الطالب')}
                  </span>
                </div>

                {task.description ? <p className="wn-teacher-homework-card__description">{task.description}</p> : null}

                <div className="wn-teacher-homework-card__meta">
                  <span>
                    <Calendar size={14} aria-hidden="true" />{' '}
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString(intlLocale) : (hw.noDueDate || 'بدون موعد')}
                  </span>
                  <span>
                    <Clock size={14} aria-hidden="true" />{' '}
                    {formatMsg(hw.createdAt || 'أُنشئ {date}', {
                      date: new Date(task.createdAt).toLocaleDateString(intlLocale),
                    })}
                  </span>
                </div>

                {task.status === 'submitted' && (
                  <div className="wn-teacher-homework-review">
                    <div className="wn-teacher-homework-audio">
                      <button
                        type="button"
                        onClick={() => playHomeworkSubmission(task)}
                        disabled={isLoadingAudio}
                        className="min-h-[44px] inline-flex items-center gap-2"
                      >
                        {isLoadingAudio ? (
                          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Headphones size={17} aria-hidden="true" />
                        )}
                        <span>{isLoadingAudio ? (hw.loadingAudio || 'جاري التحميل…') : (hw.listenSubmission || 'استماع لتسجيل الطالب')}</span>
                      </button>
                      {homeworkAudio.taskId === task._id && homeworkAudio.url ? (
                        <audio src={homeworkAudio.url} controls preload="metadata" />
                      ) : null}
                    </div>

                    <label htmlFor={feedbackId} className="sr-only">
                      {hw.feedbackPlaceholder || 'ملاحظة للطالب'}
                    </label>
                    <textarea
                      id={feedbackId}
                      rows={2}
                      className="input-field w-full"
                      placeholder={hw.feedbackPlaceholder || 'ملاحظة للطالب — مثال: ممتاز، راجع أحكام النون الساكنة في الآية 6'}
                      value={taskReview[task._id] || ''}
                      onChange={(event) => setTaskReview((current) => ({ ...current, [task._id]: event.target.value }))}
                    />

                    <TeacherVoiceFeedbackRecorder
                      value={taskFeedbackAudio[task._id] || null}
                      onChange={(val) => setTaskFeedbackAudio((current) => ({ ...current, [task._id]: val }))}
                      disabled={isReviewing}
                    />

                    <div className="wn-teacher-homework-review__actions">
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => reviewTask(task, 'approve')}
                        className="is-approve min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isReviewing ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 size={16} aria-hidden="true" />
                        )}
                        <span>{isReviewing ? (hw.savingBtn || 'جاري الحفظ…') : (hw.approveBtn || 'اعتماد الواجب')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => reviewTask(task, 'request-revision')}
                        className="is-revision min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isReviewing ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw size={16} aria-hidden="true" />
                        )}
                        <span>{hw.requestRevisionBtn || 'يحتاج إعادة'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {task.teacherFeedback ? (
                  <div className="wn-teacher-homework-feedback">
                    <MessageSquare size={15} aria-hidden="true" />
                    <div>
                      <strong>{hw.yourNote || 'ملاحظتك'}</strong>
                      <p>{task.teacherFeedback}</p>
                    </div>
                  </div>
                ) : null}
                {task.hasTeacherFeedbackAudio ? (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] px-3 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                    <Headphones size={13} aria-hidden="true" /> {hw.voiceFeedbackAttached || 'مرفق توجيه صوتي للطالب'}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
