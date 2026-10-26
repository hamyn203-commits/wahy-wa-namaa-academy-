import { Flame, Sparkles, Trophy, BookOpen, CheckCircle2 } from 'lucide-react';

const DAILY_DUAS = [
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

function getTimeGreeting(locale) {
  const hour = new Date().getHours();
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
          stroke="rgba(15, 107, 79, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#0f6b4f"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <strong className="text-sm font-black text-emerald-950">{clamped}%</strong>
        {label ? <span className="text-[10px] font-bold text-emerald-700">{label}</span> : null}
      </div>
    </div>
  );
}

export function StudentInspirationStrip({
  studentFirstName,
  locale = 'ar',
  streak = 0,
  totalPoints = 0,
  completedSessions = 0,
  homeworkSubmitted = 0,
  homeworkPending = 0,
  subscription = null,
}) {
  const isAr = locale === 'ar';
  const dayIndex = new Date().getDay();
  const dua = DAILY_DUAS[dayIndex % DAILY_DUAS.length];
  const greeting = getTimeGreeting(locale);

  const sessionTarget = subscription?.sessionCount || 8;
  const sessionsUsed = subscription ? Number(subscription.sessionsUsed || 0) : Number(completedSessions || 0);
  const ringPercent = sessionTarget > 0 ? Math.min(100, Math.round((sessionsUsed / sessionTarget) * 100)) : 0;

  const totalHw = Number(homeworkSubmitted || 0) + Number(homeworkPending || 0);
  const hwPercent = totalHw > 0 ? Math.round((Number(homeworkSubmitted || 0) / totalHw) * 100) : (completedSessions > 0 ? 100 : 0);

  return (
    <section
      className="mb-5 grid gap-4 lg:grid-cols-12"
      aria-label={isAr ? 'إشراقة اليوم ومؤشر التقدم' : 'Daily inspiration and progress'}
    >
      {/* Daily Greeting & Quranic Dua Card */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-amber-200/70 bg-gradient-to-br from-[#fffdf7] via-[#fbf5e6] to-[#eef7f2] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/90 px-3 py-1 text-xs font-bold text-[#efd28e]">
            <Sparkles size={13} />
            {greeting}، {studentFirstName}
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800">
              <Flame size={13} className="text-amber-600" />
              {streak} {isAr ? 'يوم استمرارية' : 'day streak'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-extrabold text-emerald-800">
              <Trophy size={13} className="text-emerald-600" />
              {totalPoints} {isAr ? 'نقطة' : 'pts'}
            </span>
          </div>
        </div>

        <blockquote className="my-3.5 border-s-4 border-emerald-700 ps-3.5">
          <p className="font-arabic text-base font-bold leading-relaxed text-emerald-950">
            {isAr ? dua.ar : dua.en}
          </p>
          <footer className="mt-1 text-xs font-semibold text-emerald-700/80">
            {isAr ? dua.sourceAr : dua.sourceEn}
          </footer>
        </blockquote>
      </div>

      {/* Visual Progress Ring & Homework Mastery Card */}
      <div className="lg:col-span-5 flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <ProgressRing
          percent={ringPercent}
          size={82}
          strokeWidth={8}
          label={isAr ? 'الإنجاز' : 'Goal'}
        />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="inline-flex items-center gap-1">
                <BookOpen size={13} className="text-emerald-700" />
                {subscription
                  ? (isAr ? 'تقدم باقة الحصص' : 'Package sessions')
                  : (isAr ? 'هدف الحصص الشهري' : 'Monthly session goal')}
              </span>
              <span className="text-emerald-800">
                {sessionsUsed} / {sessionTarget} {isAr ? 'حصص' : 'sessions'}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-700 transition-all duration-500"
                style={{ width: `${ringPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={13} className="text-amber-600" />
                {isAr ? 'إنجاز الواجبات' : 'Homework completion'}
              </span>
              <span className="text-amber-800">{hwPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${hwPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
