import { Link } from 'react-router-dom';
import { Gamepad2, Trophy, Medal, ArrowLeft, ArrowRight, ShieldCheck, BookOpen, RefreshCw } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';
import KidsQuizGame from '../../components/games/KidsQuizGame';
import KidsLettersGame from '../../components/games/KidsLettersGame';
import KidsCompetitionsAndAwards from '../../components/kids/KidsCompetitionsAndAwards';

const KIDS_COPY = {
  ar: {
    seoTitle: 'برنامج الأطفال',
    seoDesc: 'تعليم القرآن للأطفال بطريقة ممتعة',
    title: 'برنامج الأطفال',
    subtitle: 'حفظ القرآن والتجويد للأطفال — ألعاب ومكافآت ومسابقات',
    cta: 'سجّل طفلك',
    features: ['ألعاب تعليمية ممتعة', 'مكافآت ونقاط', 'مسابقات شهرية', 'بيئة آمنة للأطفال'],
    trackBadge: 'المسار المنهجي التأسيسي',
    trackTitle: 'مسار تأسيس الأطفال: القاعدة النورانية ونور البيان',
    trackDesc: 'منهج متكامل لضبط مخارج الحروف، التلقين بالصوت والصورة، والتهجئة بالرسم العثماني مع كبار المعلمين المتخصصين.',
    trackCta: 'استكشف مسار الأطفال',
    quizTitle: 'لعبة التجويد السريعة',
    lettersTitle: 'لعبة حروف الهجاء',
    loadingCourses: 'جاري تحميل دورات الأطفال...',
    errLoad: 'تعذر تحميل دورات الأطفال.',
    retry: 'إعادة المحاولة',
    coursesTitle: 'دورات الأطفال',
  },
  en: {
    seoTitle: 'Kids Program',
    seoDesc: 'Fun Quran learning for children',
    title: 'Kids Program',
    subtitle: 'Quran memorization for kids — games, rewards, and competitions',
    cta: 'Register Your Child',
    features: ['Fun educational games', 'Rewards & points', 'Monthly competitions', 'Safe environment for kids'],
    trackBadge: 'Foundational Track',
    trackTitle: 'Kids Foundation: Noorania & Noor Al-Bayan',
    trackDesc: 'Complete program for phonetics, interactive pronunciation, and reading directly from the Mushaf.',
    trackCta: 'Explore Kids Track',
    quizTitle: 'Quick Tajweed Quiz',
    lettersTitle: 'Arabic Letters Game',
    loadingCourses: 'Loading kids courses...',
    errLoad: 'Could not load kids courses.',
    retry: 'Retry',
    coursesTitle: 'Kids Courses',
  },
  fr: {
    seoTitle: 'Programme Enfants',
    seoDesc: 'Apprendre le Coran de façon ludique pour les enfants',
    title: 'Programme Enfants',
    subtitle: 'Mémorisation du Coran et Tajweed pour les enfants — jeux, récompenses et concours',
    cta: 'Inscrire votre enfant',
    features: ['Jeux éducatifs ludiques', 'Récompenses et points', 'Concours mensuels', 'Environnement sûr pour les enfants'],
    trackBadge: 'Parcours fondamental',
    trackTitle: 'Bases pour enfants : Noorania & Noor Al-Bayan',
    trackDesc: 'Programme complet de phonétique arabe, prononciation interactive et lecture fluide directement dans le Mushaf.',
    trackCta: 'Découvrir le parcours enfants',
    quizTitle: 'Quiz rapide de Tajweed',
    lettersTitle: 'Jeu des lettres arabes',
    loadingCourses: 'Chargement des cours pour enfants...',
    errLoad: 'Impossible de charger les cours pour enfants.',
    retry: 'Réessayer',
    coursesTitle: 'Cours pour enfants',
  },
  de: {
    seoTitle: 'Kinderprogramm',
    seoDesc: 'Spielerisches Koranlernen für Kinder',
    title: 'Kinderprogramm',
    subtitle: 'Koran-Auswendiglernen & Tadschwid für Kinder — Spiele, Belohnungen und Wettbewerbe',
    cta: 'Ihr Kind registrieren',
    features: ['Lernspiele mit Freude', 'Belohnungen & Punkte', 'Monatliche Wettbewerbe', 'Sichere Umgebung für Kinder'],
    trackBadge: 'Grundlagenpfad',
    trackTitle: 'Kindergrundlagen: Noorania & Noor Al-Bayan',
    trackDesc: 'Umfassendes Programm für Lautbildung, interaktive Aussprache und direktes Lesen aus dem Mushaf.',
    trackCta: 'Kinderpfad entdecken',
    quizTitle: 'Schnelles Tadschwid-Quiz',
    lettersTitle: 'Arabische-Buchstaben-Spiel',
    loadingCourses: 'Kinderkurse werden geladen...',
    errLoad: 'Kinderkurse konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
    coursesTitle: 'Kinderkurse',
  },
  tr: {
    seoTitle: 'Çocuk Programı',
    seoDesc: 'Çocuklar için eğlenceli Kur’an eğitimi',
    title: 'Çocuk Programı',
    subtitle: 'Çocuklar için Kur’an ezberi ve tecvid — oyunlar, ödüller ve yarışmalar',
    cta: 'Çocuğunuzu Kaydedin',
    features: ['Eğlenceli eğitici oyunlar', 'Ödüller ve puanlar', 'Aylık yarışmalar', 'Çocuklar için güvenli ortam'],
    trackBadge: 'Temel Eğitim Yolu',
    trackTitle: 'Çocuk Temel Eğitimi: Nuraniye & Nurü’l-Beyan',
    trackDesc: 'Harflerin mahreçleri, sesli-görselli telaffuz ve Mushaf’tan doğrudan okuma için bütüncül müfredat.',
    trackCta: 'Çocuk Yolunu Keşfet',
    quizTitle: 'Hızlı Tecvid Oyunu',
    lettersTitle: 'Arapça Harfler Oyunu',
    loadingCourses: 'Çocuk kursları yükleniyor...',
    errLoad: 'Çocuk kursları yüklenemedi.',
    retry: 'Tekrar dene',
    coursesTitle: 'Çocuk Kursları',
  },
  ur: {
    seoTitle: 'بچوں کا پروگرام',
    seoDesc: 'بچوں کے لیے دلچسپ انداز میں قرآن کی تعلیم',
    title: 'بچوں کا پروگرام',
    subtitle: 'بچوں کے لیے حفظِ قرآن اور تجوید — تعلیمی کھیل، انعامات اور مقابلے',
    cta: 'اپنے بچے کو رجسٹر کریں',
    features: ['دلچسپ تعلیمی کھیل', 'انعامات اور پوائنٹس', 'ماہانہ مقابلے', 'بچوں کے لیے محفوظ ماحول'],
    trackBadge: 'بنیادی تعلیمی راستہ',
    trackTitle: 'بچوں کی بنیاد: قاعدہ نورانیہ اور نور البیان',
    trackDesc: 'حروف کے مخارج، صوتی و بصری مشق اور مصحف سے براہِ راست درست تلاوت سکھانے کا جامع نصاب۔',
    trackCta: 'بچوں کا تعلیمی راستہ دیکھیں',
    quizTitle: 'فوری تجوید کوئز',
    lettersTitle: 'عربی حروف کا کھیل',
    loadingCourses: 'بچوں کے کورسز لوڈ ہو رہے ہیں...',
    errLoad: 'بچوں کے کورسز لوڈ نہیں ہو سکے۔',
    retry: 'دوبارہ کوشش کریں',
    coursesTitle: 'بچوں کے کورسز',
  },
  id: {
    seoTitle: 'Program Anak',
    seoDesc: 'Belajar Al-Quran dengan cara menyenangkan untuk anak-anak',
    title: 'Program Anak',
    subtitle: 'Hafalan Al-Quran & tajwid untuk anak — permainan, hadiah, dan kompetisi',
    cta: 'Daftarkan Anak Anda',
    features: ['Permainan edukatif seru', 'Hadiah & poin', 'Kompetisi bulanan', 'Lingkungan aman untuk anak'],
    trackBadge: 'Jalur Dasar Terstruktur',
    trackTitle: 'Fondasi Anak: Qaidah Noorania & Noor Al-Bayan',
    trackDesc: 'Program lengkap penguasaan makhraj huruf, pelafalan interaktif, dan membaca langsung dari Mushaf.',
    trackCta: 'Jelajahi Jalur Anak',
    quizTitle: 'Kuis Tajwid Cepat',
    lettersTitle: 'Permainan Huruf Hijaiyah',
    loadingCourses: 'Memuat kursus anak...',
    errLoad: 'Tidak dapat memuat kursus anak.',
    retry: 'Coba lagi',
    coursesTitle: 'Kursus Anak',
  },
  ms: {
    seoTitle: 'Program Kanak-Kanak',
    seoDesc: 'Pembelajaran Al-Quran yang menyeronokkan untuk kanak-kanak',
    title: 'Program Kanak-Kanak',
    subtitle: 'Hafazan Al-Quran & tajwid untuk kanak-kanak — permainan, ganjaran, dan pertandingan',
    cta: 'Daftar Anak Anda',
    features: ['Permainan pendidikan menyeronokkan', 'Ganjaran & mata', 'Pertandingan bulanan', 'Persekitaran selamat untuk kanak-kanak'],
    trackBadge: 'Laluan Asas Terancang',
    trackTitle: 'Asas Kanak-Kanak: Qaidah Noorania & Noor Al-Bayan',
    trackDesc: 'Program lengkap sebutan huruf, latihan audio-visual, dan bacaan terus daripada Mushaf.',
    trackCta: 'Terokai Laluan Kanak-Kanak',
    quizTitle: 'Kuiz Tajwid Pantas',
    lettersTitle: 'Permainan Huruf Arab',
    loadingCourses: 'Memuatkan kursus kanak-kanak...',
    errLoad: 'Tidak dapat memuatkan kursus kanak-kanak.',
    retry: 'Cuba lagi',
    coursesTitle: 'Kursus Kanak-Kanak',
  },
  ku: {
    seoTitle: 'بەرنامەی منداڵان',
    seoDesc: 'فێربوونی قورئان بۆ منداڵان بە شێوازێکی چێژبەخش',
    title: 'بەرنامەی منداڵان',
    subtitle: 'لەبەرکردنی قورئان و تەجوید بۆ منداڵان — یاری، پاداشت و پێشبڕکێکان',
    cta: 'منداڵەکەت تۆمار بکە',
    features: ['یاری فێرکاری چێژبەخش', 'پاداشت و خاڵەکان', 'پێشبڕکێی مانگانە', 'ژینگەیەکی پارێزراو بۆ منداڵان'],
    trackBadge: 'ڕێڕەوی بنەڕەتی ڕێکخراو',
    trackTitle: 'بنەڕەتی منداڵان: القاعدة النورانية و نور البيان',
    trackDesc: 'پڕۆگرامێکی تەواو بۆ ڕاستکردنەوەی مەخرەجی پیتەکان، ڕاهێنانی دەنگ و وێنە، و خوێندنەوە لە قورئاندا.',
    trackCta: 'ڕێڕەوی منداڵان ببینە',
    quizTitle: 'یاری خێرای تەجوید',
    lettersTitle: 'یاری پیتەکانی عەرەبی',
    loadingCourses: 'خولەکانی منداڵان باردەکرێن...',
    errLoad: 'بارکردنی خولەکانی منداڵان سەرکەوتوو نەبوو.',
    retry: 'دووبارە هەوڵبدەرەوە',
    coursesTitle: 'خولەکانی منداڵان',
  },
};

const FEATURE_ICONS = [Gamepad2, Trophy, Medal, ShieldCheck];

export default function KidsProgram() {
  const { locale, isRTL, dir, t } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = KIDS_COPY[locale] || KIDS_COPY.en;
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const loadCourses = useCallback(() => {
    setCoursesLoading(true);
    setCoursesError('');
    api.get('/api/courses?program=kids&limit=6')
      .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
      .catch(() =>
        api.get('/api/courses?category=children&limit=6')
          .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
          .catch((err) => {
            setCourses([]);
            setCoursesError(err?.message || copy.errLoad);
          })
      )
      .finally(() => setCoursesLoading(false));
  }, [copy.errLoad]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const pickText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[locale] || (isRTL ? (field.ar || field.en) : (field.en || field.ar)) || '';
  };

  return (
    <>
      <SEOHead page={{ url: '/programs/kids', title: copy.seoTitle, description: copy.seoDesc }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container max-w-3xl">
          <div className="wn-program-hero__icon"><Gamepad2 size={42} aria-hidden="true" /></div>
          <h1 className="text-4xl font-bold mb-4 text-[var(--wn-heading)]">{copy.title}</h1>
          <p className="text-[var(--wn-text-secondary)] text-lg mb-8">{copy.subtitle}</p>
          <Link to={localizedPath('/register/student', locale)} className="btn-primary min-h-[44px] inline-flex items-center gap-2">
            {copy.cta} <ArrowIcon size={18} aria-hidden="true" />
          </Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-20 grid md:grid-cols-2 gap-6">
          {copy.features.map((label, idx) => {
            const Icon = FEATURE_ICONS[idx];
            return (
              <div key={idx} className="wn-program-card p-6">
                <Icon className="text-[var(--wn-text-gold)] mb-3" size={32} aria-hidden="true" />
                <h2 className="font-bold text-lg text-[var(--wn-heading)]">{label}</h2>
              </div>
            );
          })}
        </section>

        <div className="max-w-6xl mx-auto px-4 pb-16">
          <KidsCompetitionsAndAwards />
        </div>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          <div className="bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] rounded-3xl p-8 shadow-xl border border-[var(--wn-border-mint)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-start">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold)]/20 text-[var(--wn-gold)]">
                {copy.trackBadge}
              </span>
              <h2 className="text-2xl font-bold">{copy.trackTitle}</h2>
              <p className="text-[var(--wn-text-inverse)]/85 text-sm max-w-xl">{copy.trackDesc}</p>
            </div>
            <Link
              to={localizedPath('/tracks', locale)}
              className="min-h-[44px] inline-flex items-center shrink-0 px-6 py-3 rounded-xl font-bold text-sm bg-[var(--wn-gold)] hover:bg-[var(--wn-sand)] text-[var(--wn-emerald-deep)] shadow-md transition"
            >
              {copy.trackCta}
            </Link>
          </div>
        </section>

        <section className="max-w-xl mx-auto px-4 pb-8">
          <h2 className="font-bold text-xl mb-4 text-center text-[var(--wn-heading)]">{copy.quizTitle}</h2>
          <KidsQuizGame locale={locale} />
        </section>

        <section className="max-w-xl mx-auto px-4 pb-12">
          <h2 className="font-bold text-xl mb-4 text-center text-[var(--wn-heading)]">{copy.lettersTitle}</h2>
          <KidsLettersGame locale={locale} />
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          {coursesLoading ? (
            <div className="grid md:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{t.common?.loading || copy.loadingCourses}</span>
              {Array.from({ length: 2 }, (_, idx) => (
                <div key={idx} className="wn-program-card p-4" aria-hidden="true">
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : coursesError ? (
            <div className="wn-public-empty" role="alert">
              <BookOpen size={36} aria-hidden="true" />
              <p>{coursesError}</p>
              <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-3 min-h-[44px]">
                <RefreshCw size={15} aria-hidden="true" />
                <span>{copy.retry}</span>
              </button>
            </div>
          ) : courses.length > 0 ? (
            <>
              <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-[var(--wn-heading)]">
                <BookOpen size={22} aria-hidden="true" /> {copy.coursesTitle}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {courses.map((c) => (
                  <Link key={c._id} to={localizedPath(`/courses/${c.slug}`, locale)} className="wn-program-card p-4">
                    <p className="font-bold text-[var(--wn-heading)]">{pickText(c.title)}</p>
                    <p className="text-sm text-[var(--wn-link)] mt-1">{c.price} {c.currency}</p>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
