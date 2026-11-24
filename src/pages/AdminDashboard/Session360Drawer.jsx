import { useEffect } from 'react';
import {
  Award, BellRing, BookOpen, CalendarClock, CheckCircle2, Copy, Eye,
  GraduationCap, Loader2, MessageSquare, Radio, Star, UserRound, Users, X, XCircle,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { formatMsg } from './adminFormat';

export default function Session360Drawer({
  session,
  onClose,
  onOpenStudent,
  onOpenTeacher,
  onMessageStudent,
  onTriggerStatusModal,
  onQuickCompleteGroup,
  onNudgeTeacher,
  onCopyText,
  busyId = '',
}) {
  const { locale, dir, t } = useI18n();
  const sc = t.adminPortal.sessionControl;
  const dr = sc.drawer || {};
  const dash = t.adminPortal.common.dash;

  useEffect(() => {
    if (!session) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, onClose]);

  if (!session) return null;

  const isBusy = busyId === session._id;
  const isGroup = session.type === 'group_circle';
  const typeText = sc.types?.[session.type] || session.type;
  const statusText =
    session.status === 'no-show'
      ? sc.statuses?.noShow
      : sc.statuses?.[session.status] || session.status;
  const roomUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${localizedPath(`/live/${session.roomId || session._id}`, locale)}`;
  const unresolvedCount = Number(session.attendanceSummary?.unresolved || 0);
  const teacherEval = session.teacherEvaluation;
  const studentRev = session.studentRating;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={dr.title || 'Session 360'}
      onClick={onClose}
    >
      <aside
        className="w-full max-w-xl bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-s border-[var(--wn-border)] shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[var(--wn-surface)] border-b border-[var(--wn-border)] px-5 py-4 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)]">
                {typeText}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]">
                {statusText}
              </span>
              <button
                type="button"
                onClick={() => onCopyText?.(String(session._id), sc.labels?.copiedCode)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-xs font-mono text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)] cursor-pointer"
              >
                <span>{session.shortCode || `#${String(session._id).slice(-4).toUpperCase()}`}</span>
                <Copy size={12} aria-hidden="true" />
              </button>
            </div>
            <h2 className="text-lg font-extrabold text-[var(--wn-heading)] truncate">
              {dr.title}
            </h2>
            <p className="text-xs text-[var(--wn-text-secondary)] flex items-center gap-1.5">
              <CalendarClock size={14} aria-hidden="true" />
              <span>
                {formatSessionDateTime(session, locale, { dateStyle: 'medium', timeStyle: 'short' })} · {formatMsg(sc.meta.minutes, { count: session.duration || 60 })} · {sessionTimeZone(session)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dr.close}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] inline-flex items-center justify-center text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)] cursor-pointer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="p-5 space-y-5 flex-1">
          {/* Live Room Telemetry */}
          <section className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[var(--wn-heading)] flex items-center gap-2">
                <Radio size={16} className={session.liveRoom?.isLive ? 'text-[var(--wn-status-success-text)] animate-pulse' : 'text-[var(--wn-text-secondary)]'} aria-hidden="true" />
                <span>{dr.liveSection}</span>
              </h3>
              {session.liveRoom?.mushafPage ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border-strong)]">
                  {formatMsg(dr.mushafPage, { page: session.liveRoom.mushafPage })}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed">
              {session.liveRoom?.isLive
                ? dr.liveActiveDesc
                : session.liveRoom?.sessionEnded
                  ? dr.liveEndedDesc
                  : dr.liveIdleDesc}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {session.canObserveLive ? (
                <a
                  href={localizedPath(`/live/${session.roomId || session._id}`, locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Eye size={15} aria-hidden="true" />
                  <span>{sc.actions.joinObserver}</span>
                </a>
              ) : null}
              {session.status === 'accepted' ? (
                <button
                  type="button"
                  onClick={() => onCopyText?.(roomUrl, sc.labels?.copiedRoomLink)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={14} aria-hidden="true" />
                  <span>{sc.actions.copyRoomLink}</span>
                </button>
              ) : null}
              {session.liveRoom?.totalStars > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--wn-text-gold)] px-2.5 py-1 rounded-lg bg-[var(--wn-gold-soft)]">
                  <Award size={14} aria-hidden="true" />
                  {formatMsg(dr.starsAwarded, { count: session.liveRoom.totalStars })}
                </span>
              ) : null}
            </div>
          </section>

          {/* Participants Pair */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--wn-text-secondary)]">
              {dr.participantsSection}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[var(--wn-text-secondary)] flex items-center gap-1.5">
                  {isGroup ? <Users size={14} aria-hidden="true" /> : <UserRound size={14} aria-hidden="true" />}
                  <span>{isGroup ? sc.labels.circleRole : sc.labels.studentRole}</span>
                </div>
                <div>
                  <strong className="block text-sm font-extrabold text-[var(--wn-heading)] truncate">
                    {isGroup ? (session.circle?.name || sc.studentFallback) : (session.student?.name || sc.studentFallback)}
                  </strong>
                  <span className="block text-xs text-[var(--wn-text-secondary)] truncate">
                    {isGroup
                      ? formatMsg(sc.labels.groupRosterCount, {
                          attended: session.attendanceSummary?.attended || 0,
                          total: session.attendanceSummary?.total || 0,
                        })
                      : (session.student?.email || session.student?.phone || dash)}
                  </span>
                </div>
                {session.student?._id ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => { onClose?.(); onOpenStudent?.(session.student._id); }}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-link)] cursor-pointer"
                    >
                      {dr.openStudent360}
                    </button>
                    {onMessageStudent ? (
                      <button
                        type="button"
                        onClick={() => { onClose?.(); onMessageStudent(session.student._id); }}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare size={13} aria-hidden="true" />
                        <span>{sc.actions.messageStudent}</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[var(--wn-text-secondary)] flex items-center gap-1.5">
                  <GraduationCap size={14} aria-hidden="true" />
                  <span>{sc.labels.teacherRole}</span>
                </div>
                <div>
                  <strong className="block text-sm font-extrabold text-[var(--wn-heading)] truncate">
                    {session.teacher?.name || sc.teacherFallback}
                  </strong>
                  <span className="block text-xs text-[var(--wn-text-secondary)] truncate">
                    {session.teacher?.email || dash}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {session.teacher?._id ? (
                    <button
                      type="button"
                      onClick={() => { onClose?.(); onOpenTeacher?.(session.teacher._id); }}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-link)] cursor-pointer"
                    >
                      {dr.openTeacherDossier}
                    </button>
                  ) : null}
                  {['pending', 'accepted', 'completed'].includes(session.status) && session.teacher?._id ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onNudgeTeacher?.(session._id)}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <BellRing size={13} aria-hidden="true" />
                      <span>{sc.actions.nudgeTeacher}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Group Circle Attendance Roster & One-Click Resolver */}
          {isGroup && Array.isArray(session.attendance) && session.attendance.length > 0 ? (
            <section className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--wn-heading)] flex items-center gap-2">
                <Users size={16} aria-hidden="true" />
                <span>{dr.attendanceSection} ({session.attendance.length})</span>
              </h3>
              <div className="divide-y divide-[var(--wn-border)] max-h-48 overflow-y-auto">
                {session.attendance.map((item, idx) => (
                  <div key={String(item.studentId || idx)} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!item.studentId}
                      onClick={() => { if (item.studentId) { onClose?.(); onOpenStudent?.(item.studentId); } }}
                      className="font-bold text-[var(--wn-text-primary)] hover:underline text-start truncate cursor-pointer"
                    >
                      {item.studentName}
                    </button>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] font-semibold text-[var(--wn-text-secondary)]">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
              {session.status === 'accepted' && unresolvedCount > 0 ? (
                <div className="rounded-xl border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] p-3 space-y-2">
                  <p className="text-xs font-semibold text-[var(--wn-status-warn-text)]">{dr.resolveHint}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickCompleteGroup?.(session._id, 'attended')}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {dr.resolveAsAttended}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickCompleteGroup?.(session._id, 'absent')}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {dr.resolveAsAbsent}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Teacher Evaluation & Student Rating */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--wn-text-secondary)]">
              {dr.evaluationSection}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3.5 space-y-1.5 text-xs">
                <div className="font-extrabold text-[var(--wn-heading)] flex items-center gap-1.5">
                  <BookOpen size={14} aria-hidden="true" />
                  <span>{dr.teacherEvalTitle}</span>
                </div>
                {teacherEval ? (
                  <div className="space-y-1 text-[var(--wn-text-secondary)]">
                    {teacherEval.surahRecited ? (
                      <p className="font-semibold text-[var(--wn-text-primary)]">
                        {formatMsg(dr.surahRange, { surah: teacherEval.surahRecited })}
                      </p>
                    ) : null}
                    {(teacherEval.memorization || teacherEval.tajweed) ? (
                      <p>{formatMsg(dr.scoresLine, { mem: teacherEval.memorization || dash, taj: teacherEval.tajweed || dash })}</p>
                    ) : null}
                    {(teacherEval.recommendedTrack || teacherEval.recommendedLevel) ? (
                      <p className="text-[var(--wn-emerald-dark)] font-bold">
                        {formatMsg(dr.recommendedLine, {
                          track: teacherEval.recommendedTrack || dash,
                          level: teacherEval.recommendedLevel || dash,
                        })}
                      </p>
                    ) : null}
                    {teacherEval.overallNotes ? <p className="pt-1 border-t border-[var(--wn-border)]">{teacherEval.overallNotes}</p> : null}
                  </div>
                ) : (
                  <p className="text-[var(--wn-text-secondary)]">{dr.noTeacherEval}</p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3.5 space-y-1.5 text-xs">
                <div className="font-extrabold text-[var(--wn-heading)] flex items-center gap-1.5">
                  <Star size={14} className="text-[var(--wn-gold)]" aria-hidden="true" />
                  <span>{dr.studentReviewTitle}</span>
                </div>
                {studentRev ? (
                  <div className="space-y-1 text-[var(--wn-text-secondary)]">
                    <p className="text-sm font-extrabold text-[var(--wn-heading)]">
                      {studentRev.average} / 5 ({studentRev.count})
                    </p>
                    {studentRev.wouldContinue === true ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] font-bold">
                        {sc.labels.wantsContinue}
                      </span>
                    ) : null}
                    {studentRev.comment ? <p className="pt-1 border-t border-[var(--wn-border)]">{studentRev.comment}</p> : null}
                  </div>
                ) : (
                  <p className="text-[var(--wn-text-secondary)]">{dr.noStudentReview}</p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer Operational Actions */}
        <footer className="sticky bottom-0 bg-[var(--wn-surface)] border-t border-[var(--wn-border)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-[var(--wn-text-secondary)]">
            {session.type === 'trial' && session.financial?.amount === 0
              ? sc.labels.trialFree
              : formatMsg(sc.labels.earningSettled, { amount: session.financial?.amount || 0 })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.status === 'pending' ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onTriggerStatusModal?.(session, 'accepted')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isBusy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                <span>{sc.actions.acceptPending}</span>
              </button>
            ) : null}
            {session.status === 'accepted' ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onTriggerStatusModal?.(session, 'completed')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>{sc.actions.complete}</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onTriggerStatusModal?.(session, 'no-show')}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {sc.actions.noShow}
                </button>
              </>
            ) : null}
            {['pending', 'accepted'].includes(session.status) ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onTriggerStatusModal?.(session, 'cancelled')}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <XCircle size={14} aria-hidden="true" />
                <span>{sc.actions.cancel}</span>
              </button>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  );
}
