import { Flame, Sparkles, Trophy, BookOpen, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n';

const DAILY_DUA_KEYS = [
  ['d1', 's1'],
  ['d2', 's2'],
  ['d3', 's3'],
  ['d4', 's4'],
  ['d5', 's5'],
  ['d6', 's6'],
  ['d7', 's7'],
];

const DAILY_DUAS_FALLBACK = [
  {
    ar: '﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾ — اللهم اجعل القرآن العظيم ربيع قلوبنا ونور صدورنا.',
    en: '“And recite the Quran with measured recitation.” — O Allah, make the Quran the spring of our hearts.',
    sourceAr: 'سورة المزمل · آية ٤',
    sourceEn: 'Surah Al-Muzzammil · 73:4',
  },
  {
    ar: '﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾ — اللهم يسّر لنا حفظ كتابك والعمل به.',
    en: '“And We have certainly made the Quran easy for remembrance.” — O Allah, make memorizing Your Book easy for us.',
    sourceAr: 'سورة القمر · آية ١٧',
    sourceEn: 'Surah Al-Qamar · 54:17',
  },
  {
    ar: '﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾ — اللهم علّمنا ما ينفعنا وانفعنا بما علّمتنا وزدنا علماً.',
    en: '“And say: My Lord, increase me in knowledge.” — O Allah, benefit us with what You have taught us.',
    sourceAr: 'سورة طه · آية ١١٤',
    sourceEn: 'Surah Taha · 20:114',
  },
  {
    ar: '«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — هنيئاً لك خطواتك المباركة في صحبة كتاب الله.',
    en: '“The best of you are those who learn the Quran and teach it.” — Blessed are your steps with the Book of Allah.',
    sourceAr: 'حديث شريف · صحيح البخاري',
    sourceEn: 'Sahih Al-Bukhari',
  },
  {
    ar: '﴿إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ﴾ — اللهم اهدنا بهديك وثبّت قلوبنا على طاعتك.',
    en: '“Indeed, this Quran guides to that which is most suitable.” — O Allah, guide us and keep our hearts steadfast.',
    sourceAr: 'سورة الإسراء · آية ٩',
    sourceEn: 'Surah Al-Isra · 17:9',
  },
  {
    ar: '﴿كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ﴾ — اللهم ارزقنا الفهم والتدبر والعمل.',
    en: '“A blessed Book which We have revealed to you, that they might reflect upon its verses.”',
    sourceAr: 'سورة ص · آية ٢٩',
    sourceEn: 'Surah Sad · 38:29',
  },
  {
    ar: '«اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ» — داوم على وردك ولو بقليل مستمر.',
    en: '“Read the Quran, for it will come as an intercessor for its companions on the Day of Resurrection.”',
    sourceAr: 'حديث شريف · صحيح مسلم',
    sourceEn: 'Sahih Muslim',
  },
];

function getTimeGreeting(locale, qw) {
  const hour = new Date().getHours();
  if (qw) {
    if (hour < 12) return qw.morningGreeting || 'Blessed morning';
    if (hour < 17) return qw.afternoonGreeting || 'Peaceful afternoon';
    return qw.eveningGreeting || 'Blessed evening';
  }
  if (locale === 'ar') {
    if (hour < 12) return 'صباح النور والبركة';
    if (hour < 17) return 'طاب يومك بذكر الله';
    return 'مساء السكينة والهدى';
  }
  if (hour < 12) return 'Blessed morning';
  if (hour < 17) return 'Peaceful afternoon';
  return 'Blessed evening';
}

export function ProgressRing({ percent = 0, size = 76, strokeWidth = 7, label }) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--wn-emerald-soft)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--wn-emerald)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <strong className="text-sm font-black text-[var(--wn-heading)]">{clamped}%</strong>
        {label ? <span className="text-[10px] font-bold text-[var(--wn-link)]">{label}</span> : null}
      </div>
    </div>
  );
}

export function getDailyQuranicDua(locale = 'ar', qw = null) {
  const isAr = locale === 'ar';
  const dayIndex = new Date().getDay();
  const idx = dayIndex % DAILY_DUA_KEYS.length;
  const [textKey, sourceKey] = DAILY_DUA_KEYS[idx];
  const fallback = DAILY_DUAS_FALLBACK[idx];
  return {
    text: qw?.duas?.[textKey] || (isAr ? fallback.ar : fallback.en),
    source: qw?.duas?.[sourceKey] || (isAr ? fallback.sourceAr : fallback.sourceEn),
    greeting: getTimeGreeting(locale, qw),
  };
}

export function StudentInspirationStrip({
  studentFirstName,
  locale: propLocale,
  streak = 0,
  totalPoints = 0,
  completedSessions = 0,
  homeworkSubmitted = 0,
  homeworkPending = 0,
  subscription = null,
}) {
  const { locale: ctxLocale, t } = useI18n();
  const activeLocale = propLocale || ctxLocale || 'ar';
  const qw = t?.student?.quranWidgets || {};
  const dua = getDailyQuranicDua(activeLocale, qw);

  const sessionTarget = subscription?.sessionCount || 8;
  const sessionsUsed = subscription ? Number(subscription.sessionsUsed || 0) : Number(completedSessions || 0);
  const ringPercent = sessionTarget > 0 ? Math.min(100, Math.round((sessionsUsed / sessionTarget) * 100)) : 0;

  const totalHw = Number(homeworkSubmitted || 0) + Number(homeworkPending || 0);
  const hwPercent = totalHw > 0 ? Math.round((Number(homeworkSubmitted || 0) / totalHw) * 100) : (completedSessions > 0 ? 100 : 0);

  return (
    <section
      className="mb-5 grid gap-4 lg:grid-cols-12"
      aria-label={qw.stripAria || 'Daily inspiration and progress'}
    >
      {/* Daily Greeting & Quranic Dua Card */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald-deep)] px-3 py-1 text-xs font-bold text-[var(--wn-gold)]">
            <Sparkles size={13} aria-hidden="true" />
            {dua.greeting}{studentFirstName ? `، ${studentFirstName}` : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Number(streak) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-extrabold text-[var(--wn-text-gold)]">
                <Flame size={13} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                {streak} {qw.dayStreak || 'day streak'}
              </span>
            )}
            {Number(totalPoints) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-extrabold text-[var(--wn-badge-emerald-text)]">
                <Trophy size={13} className="text-[var(--wn-link)]" aria-hidden="true" />
                {totalPoints} {qw.ptsUnit || 'pts'}
              </span>
            )}
            {Number(streak) === 0 && Number(totalPoints) === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                <BookOpen size={13} className="text-[var(--wn-link)]" aria-hidden="true" />
                {qw.blessedJourney || 'Blessed Quran journey'}
              </span>
            )}
          </div>
        </div>

        <blockquote className="my-3.5 border-s-4 border-[var(--wn-emerald)] ps-3.5">
          <p className={`${activeLocale === 'ar' ? 'font-arabic ' : ''}text-base font-bold leading-relaxed text-[var(--wn-text-primary)]`}>
            {dua.text}
          </p>
          <footer className="mt-1 text-xs font-semibold text-[var(--wn-text-secondary)]">
            {dua.source}
          </footer>
        </blockquote>
      </div>

      {/* Visual Progress Ring & Homework Mastery Card */}
      <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 shadow-sm">
        <ProgressRing
          percent={ringPercent}
          size={82}
          strokeWidth={8}
          label={qw.goalLabel || 'Goal'}
        />
        <div className="flex-1 w-full min-w-0 space-y-2.5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-[var(--wn-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <BookOpen size={13} className="text-[var(--wn-link)]" aria-hidden="true" />
                {subscription
                  ? (qw.packageSessions || 'Package sessions')
                  : (qw.completedSessions || 'Completed sessions')}
              </span>
              <span className="text-[var(--wn-heading)]">
                {subscription
                  ? `${sessionsUsed} / ${sessionTarget} ${qw.sessionsUnit || 'sessions'}`
                  : `${sessionsUsed} ${qw.completedUnit || 'completed'}`}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--wn-emerald-soft)]">
              <div
                className="h-full rounded-full bg-[var(--wn-emerald)] transition-all duration-500"
                style={{ width: `${ringPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-[var(--wn-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={13} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                {qw.homeworkCompletion || 'Homework completion'}
              </span>
              <span className="text-[var(--wn-text-gold)]">{hwPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--wn-gold-soft)]">
              <div
                className="h-full rounded-full bg-[var(--wn-gold)] transition-all duration-500"
                style={{ width: `${hwPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

