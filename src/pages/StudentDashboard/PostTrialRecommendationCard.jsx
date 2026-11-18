import { Award, BookOpen, Compass, CreditCard, Sparkles, Star } from 'lucide-react';

function levelLabel(level, locale) {
  const ar = {
    beginner: 'مبتدئ (تأسيس وقصار السور)',
    intermediate: 'متوسط (حفظ مع التجويد الأساسي)',
    advanced: 'متقدم (إتقان ومراجعة مكثفة)',
    ijazah: 'مؤهل لمسار الإجازة والسند',
  };
  const en = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    ijazah: 'Ijazah ready',
  };
  return (locale === 'ar' ? ar : en)[level] || level || '';
}

function trackLabel(track, locale) {
  const ar = {
    memorization: 'مسار الحفظ والمراجعة',
    tajweed_ijazah: 'مسار التجويد والإجازة',
    kids_foundation: 'مسار تأسيس الأطفال والبراعم',
  };
  const en = {
    memorization: 'Memorization & Revision',
    tajweed_ijazah: 'Tajweed & Ijazah',
    kids_foundation: 'Kids Foundation',
  };
  return (locale === 'ar' ? ar : en)[track] || track || '';
}

export default function PostTrialRecommendationCard({ session, locale = 'ar', onSubscribe }) {
  const isAr = locale === 'ar';
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
    || (isAr ? 'الشيخ' : 'Your tutor');

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800 px-3 py-1 text-xs font-bold text-white">
          <Sparkles size={13} />
          {isAr ? `توصية ${teacherName} لرحلتك` : `${teacherName}'s recommendation`}
        </span>
        {(ev.memorization || ev.tajweed) && (
          <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900">
            <Star size={14} className="text-amber-500 fill-amber-400" />
            {isAr
              ? `الحفظ ${ev.memorization ?? '—'}/5 · التجويد ${ev.tajweed ?? '—'}/5`
              : `Memorization ${ev.memorization ?? '—'}/5 · Tajweed ${ev.tajweed ?? '—'}/5`}
          </span>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ev.recommendedLevel && (
          <div className="rounded-xl border border-emerald-100 bg-white p-3">
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Award size={13} className="text-emerald-700" />
              {isAr ? 'المستوى المعتمد' : 'Recommended level'}
            </span>
            <strong className="mt-0.5 block text-xs sm:text-sm font-extrabold text-slate-900">
              {levelLabel(ev.recommendedLevel, locale)}
            </strong>
          </div>
        )}
        {ev.recommendedTrack && (
          <div className="rounded-xl border border-emerald-100 bg-white p-3">
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Compass size={13} className="text-emerald-700" />
              {isAr ? 'المسار المرشح لك' : 'Recommended track'}
            </span>
            <strong className="mt-0.5 block text-xs sm:text-sm font-extrabold text-slate-900">
              {trackLabel(ev.recommendedTrack, locale)}
            </strong>
          </div>
        )}
      </div>

      {(ev.surahRecited || ev.nextHomework || ev.overallNotes) && (
        <div className="rounded-xl border border-amber-200/70 bg-white/90 p-3 text-xs space-y-1 text-slate-700">
          {ev.surahRecited && (
            <p className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-emerald-700 shrink-0" />
              <strong>{isAr ? 'تم تقييمك في:' : 'Evaluated on:'}</strong> {ev.surahRecited}
            </p>
          )}
          {ev.nextHomework && (
            <p>
              <strong>{isAr ? 'خطة البداية المقترحة:' : 'Suggested starting plan:'}</strong> {ev.nextHomework}
            </p>
          )}
          {ev.overallNotes && (
            <p>
              <strong>{isAr ? 'رسالة المعلم لك:' : 'Tutor note:'}</strong> {ev.overallNotes}
            </p>
          )}
        </div>
      )}

      {onSubscribe && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onSubscribe}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-extrabold text-white transition"
          >
            <CreditCard size={14} />
            {isAr ? 'اشترك الآن وابدأ في المسار المرشح مع الشيخ' : 'Subscribe and start this track'}
          </button>
        </div>
      )}
    </div>
  );
}
