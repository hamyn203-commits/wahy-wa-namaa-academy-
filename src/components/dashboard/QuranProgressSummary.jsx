import { BookOpen, Sparkles, Target } from 'lucide-react';
import { useI18n } from '../../i18n';

function deriveProgress(evaluations = [], quranSummary = null) {
  if (quranSummary) {
    return {
      recitedSurahs: Array.isArray(quranSummary.recitedSurahs) ? quranSummary.recitedSurahs : [],
      lastRecitation: quranSummary.lastRecitation || null,
      avgMemorizationOutOf5: quranSummary.avgMemorizationOutOf5 ?? null,
      avgTajweedOutOf5: quranSummary.avgTajweedOutOf5 ?? null,
    };
  }

  const surahs = new Set();
  let lastRecitation = null;
  let memSum = 0;
  let memCount = 0;
  let tajSum = 0;
  let tajCount = 0;

  const sorted = [...evaluations].sort(
    (a, b) => new Date(b.scheduledAt || b.updatedAt || 0) - new Date(a.scheduledAt || a.updatedAt || 0)
  );

  for (const s of sorted) {
    const ev = s.teacherEvaluation || {};
    const report = (s.studentReports || [])[0] || {};
    const surah = String(ev.surahRecited || report.surahRecited || '').trim();
    const fromAyah = ev.fromAyah ?? report.fromAyah ?? null;
    const toAyah = ev.toAyah ?? report.toAyah ?? null;
    const nextHomework = String(ev.nextHomework || report.nextHomework || '').trim();
    const notes = String(ev.overallNotes || report.notes || '').trim();

    if (surah) surahs.add(surah);
    if (!lastRecitation && (surah || nextHomework || notes)) {
      lastRecitation = {
        surahRecited: surah,
        fromAyah,
        toAyah,
        nextHomework,
        notes,
        scheduledAt: s.scheduledAt,
      };
    }

    const mem = ev.memorization != null
      ? Number(ev.memorization)
      : report.memorizationScore != null
        ? Number(report.memorizationScore) / 2
        : null;
    const taj = ev.tajweed != null
      ? Number(ev.tajweed)
      : report.tajweedScore != null
        ? Number(report.tajweedScore) / 2
        : null;

    if (Number.isFinite(mem)) {
      memSum += mem;
      memCount += 1;
    }
    if (Number.isFinite(taj)) {
      tajSum += taj;
      tajCount += 1;
    }
  }

  return {
    recitedSurahs: [...surahs],
    lastRecitation,
    avgMemorizationOutOf5: memCount ? Math.round((memSum / memCount) * 10) / 10 : null,
    avgTajweedOutOf5: tajCount ? Math.round((tajSum / tajCount) * 10) / 10 : null,
  };
}

export default function QuranProgressSummary({
  evaluations = [],
  quranSummary = null,
  variant = 'student',
}) {
  const { t } = useI18n();
  const qw = t?.student?.quranWidgets || {};

  const summary = deriveProgress(evaluations, quranSummary);
  const { recitedSurahs, lastRecitation, avgMemorizationOutOf5, avgTajweedOutOf5 } = summary;
  const hasAnyData = Boolean(
    recitedSurahs.length
    || lastRecitation
    || avgMemorizationOutOf5 !== null
    || avgTajweedOutOf5 !== null
  );

  if (!hasAnyData) {
    if (variant !== 'teacher') return null;
    return (
      <div className="rounded-xl border border-dashed border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 text-xs text-[var(--wn-text-secondary)]">
        {qw.noRecitationsYet || 'No recorded Surah recitations yet for this learner.'}
      </div>
    );
  }

  const memPct = avgMemorizationOutOf5 != null ? Math.min(100, Math.round((avgMemorizationOutOf5 / 5) * 100)) : 0;
  const tajPct = avgTajweedOutOf5 != null ? Math.min(100, Math.round((avgTajweedOutOf5 / 5) * 100)) : 0;

  return (
    <section
      className="rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-4 sm:p-5 space-y-4"
      aria-label={qw.summaryAria || 'Quran progress summary'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]">
            <BookOpen size={16} aria-hidden="true" />
          </span>
          <div>
            <span className="block text-[11px] font-bold text-[var(--wn-link)]">
              {variant === 'teacher'
                ? (qw.teacherPrepCard || 'Pre-session prep card')
                : (qw.studentJourneyMap || 'Your Quran journey map')}
            </span>
            <h4 className="text-sm sm:text-base font-extrabold text-[var(--wn-heading)]">
              {qw.latestMastery || 'Latest recitation & mastery'}
            </h4>
          </div>
        </div>
        {recitedSurahs.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
            <Sparkles size={13} aria-hidden="true" />
            {recitedSurahs.length} {qw.surahsLogged || 'Surahs logged'}
          </span>
        )}
      </div>

      {lastRecitation && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3">
            <span className="block text-[11px] font-bold text-[var(--wn-text-secondary)]">
              {qw.lastRecited || 'Last recited passage'}
            </span>
            <strong className="mt-0.5 block text-sm font-extrabold text-[var(--wn-heading)]">
              {lastRecitation.surahRecited || (qw.generalEvaluation || 'General session evaluation')}
              {(lastRecitation.fromAyah || lastRecitation.toAyah)
                ? ` (${lastRecitation.fromAyah || '—'} – ${lastRecitation.toAyah || '—'})`
                : ''}
            </strong>
            {lastRecitation.notes ? (
              <p className="mt-1 text-xs text-[var(--wn-text-secondary)] line-clamp-2">{lastRecitation.notes}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--wn-text-gold)]">
              <Target size={12} aria-hidden="true" />
              {qw.nextTarget || 'Next target / homework'}
            </span>
            <p className="mt-0.5 text-sm font-bold text-[var(--wn-text-primary)]">
              {lastRecitation.nextHomework || (qw.continuePlan || 'Continue along your plan')}
            </p>
          </div>
        </div>
      )}

      {(avgMemorizationOutOf5 !== null || avgTajweedOutOf5 !== null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {avgMemorizationOutOf5 !== null && (
            <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-[var(--wn-text-secondary)]">{qw.memAvg || 'Memorization avg'}</span>
                <span className="text-[var(--wn-link)]">{avgMemorizationOutOf5} / 5</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--wn-emerald-soft)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--wn-emerald)] transition-all" style={{ width: `${memPct}%` }} />
              </div>
            </div>
          )}
          {avgTajweedOutOf5 !== null && (
            <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-[var(--wn-text-secondary)]">{qw.tajweedAvg || 'Tajweed avg'}</span>
                <span className="text-[var(--wn-text-gold)]">{avgTajweedOutOf5} / 5</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--wn-gold-soft)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--wn-gold)] transition-all" style={{ width: `${tajPct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {recitedSurahs.length > 0 && (
        <div>
          <span className="block text-[11px] font-bold text-[var(--wn-text-secondary)] mb-1.5">
            {qw.coveredSurahs || 'Covered Surahs / passages:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recitedSurahs.slice(0, 12).map((surah) => (
              <span
                key={surah}
                className="rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--wn-text-primary)]"
              >
                {surah}
              </span>
            ))}
            {recitedSurahs.length > 12 && (
              <span className="rounded-full bg-[var(--wn-surface)] border border-[var(--wn-border)] px-2.5 py-0.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                +{recitedSurahs.length - 12}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

