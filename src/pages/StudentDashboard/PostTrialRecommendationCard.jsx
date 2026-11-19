import { Award, BookOpen, Compass, CreditCard, Sparkles, Star } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function PostTrialRecommendationCard({ session, onSubscribe }) {
  const { t } = useI18n();
  const pt = t?.student?.marketplace?.postTrial || {};
  const ptLevels = pt.levels || {};
  const ptTracks = pt.tracks || {};

  const ev = session?.teacherEvaluation;
  if (!session || !ev) return null;

  const hasAssessment = Boolean(
    ev.recommendedLevel
    || ev.recommendedTrack
    || ev.surahRecited
    || ev.overallNotes
    || ev.nextHomework
  );
  if (!hasAssessment) return null;

  const teacherName = session.teacher?.user?.name
    || session.teacher?.personalInfo?.fullName
    || (t?.student?.dashboard?.sessionCard?.tutorFallback || 'Tutor');

  const levelLabel = (level) => ptLevels[level] || level || '';
  const trackLabel = (track) => ptTracks[track] || track || '';

  return (
    <div className="mt-4 rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald-deep)] px-3 py-1 text-xs font-bold text-[var(--wn-text-inverse)]">
          <Sparkles size={13} aria-hidden="true" />
          {pt.recommendationTitle || 'Tutor recommendation for your journey'} ({teacherName})
        </span>
        {(ev.memorization || ev.tajweed) && (
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)]">
            <Star size={14} className="text-[var(--wn-gold)] fill-current" aria-hidden="true" />
            {pt.memScore || 'Memorization'} {ev.memorization ?? '—'}/5 · {pt.tajweedScore || 'Tajweed'} {ev.tajweed ?? '—'}/5
          </span>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ev.recommendedLevel && (
          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3">
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--wn-text-secondary)]">
              <Award size={13} className="text-[var(--wn-link)]" aria-hidden="true" />
              {pt.recommendedLevel || 'Recommended level'}
            </span>
            <strong className="mt-0.5 block text-xs sm:text-sm font-extrabold text-[var(--wn-text-primary)]">
              {levelLabel(ev.recommendedLevel)}
            </strong>
          </div>
        )}
        {ev.recommendedTrack && (
          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3">
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--wn-text-secondary)]">
              <Compass size={13} className="text-[var(--wn-link)]" aria-hidden="true" />
              {pt.recommendedTrack || 'Recommended track'}
            </span>
            <strong className="mt-0.5 block text-xs sm:text-sm font-extrabold text-[var(--wn-text-primary)]">
              {trackLabel(ev.recommendedTrack)}
            </strong>
          </div>
        )}
      </div>

      {(ev.surahRecited || ev.nextHomework || ev.overallNotes) && (
        <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3 text-xs space-y-1 text-[var(--wn-text-secondary)]">
          {ev.surahRecited && (
            <p className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
              <strong className="text-[var(--wn-text-primary)]">{pt.evaluatedOn || 'Evaluated on:'}</strong> {ev.surahRecited}
            </p>
          )}
          {ev.nextHomework && (
            <p>
              <strong className="text-[var(--wn-text-primary)]">{pt.suggestedPlan || 'Suggested starting plan:'}</strong> {ev.nextHomework}
            </p>
          )}
          {ev.overallNotes && (
            <p>
              <strong className="text-[var(--wn-text-primary)]">{pt.tutorNote || 'Tutor note:'}</strong> {ev.overallNotes}
            </p>
          )}
        </div>
      )}

      {onSubscribe && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onSubscribe}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-4 py-2 text-xs font-extrabold text-[var(--wn-text-inverse)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            <CreditCard size={14} aria-hidden="true" />
            {pt.subscribeBtn || 'Subscribe and start this track'}
          </button>
        </div>
      )}
    </div>
  );
}

