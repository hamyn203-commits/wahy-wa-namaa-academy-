import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Star, Users, ArrowLeft, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { formatCourseRegionalDisplay } from '../../lib/regionalPricing';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const WOMEN_COPY = {
  ar: {
    seoTitle: 'أكاديمية النساء | وَحْيٌ وَنَمَاء',
    seoDesc: 'قسم مستقل — معلمات وطالبات فقط',
    title: 'أكاديمية النساء',
    subtitle: 'بيئة آمنة ومستقلة — معلمات متخصصات في تعليم القرآن للنساء والبنات',
    teachersStat: 'معلمة',
    studentsStat: 'طالبة',
    errLoad: 'تعذر تحميل بيانات قسم النساء الآن.',
    errTitle: 'تعذر تحميل البيانات',
    retry: 'إعادة المحاولة',
    coursesTitle: 'دورات النساء',
    loadingCourses: 'جاري تحميل الدورات...',
    coursesComingSoon: 'قريباً — دورات مخصصة للنساء',
    startNow: 'ابدئي الآن',
    teachersTitle: 'معلماتنا',
    loadingTeachers: 'جاري تحميل المعلمات...',
    noTeachers: 'لا توجد ملفات معلمات منشورة حاليًا — يمكنك بدء التسجيل',
    noRatings: 'بدون تقييم بعد',
    yrs: 'سنوات',
    viewProfile: 'عرض الملف',
    registerStudent: 'سجّلي كطالبة',
  },
  en: {
    seoTitle: 'Women Academy | Wahy Wa Namaa',
    seoDesc: 'Dedicated section — female teachers and students only',
    title: 'Women Academy',
    subtitle: 'Safe dedicated environment — female teachers specialized in Quran for women and girls',
    teachersStat: 'teachers',
    studentsStat: 'students',
    errLoad: 'Unable to load women section data right now.',
    errTitle: 'Unable to load content',
    retry: 'Retry',
    coursesTitle: 'Women Courses',
    loadingCourses: 'Loading courses...',
    coursesComingSoon: 'Coming soon — courses for women',
    startNow: 'Start now',
    teachersTitle: 'Our Teachers',
    loadingTeachers: 'Loading teachers...',
    noTeachers: 'No teacher profiles are published yet',
    noRatings: 'No ratings yet',
    yrs: 'yrs',
    viewProfile: 'View profile',
    registerStudent: 'Register as Student',
  },
  fr: {
    seoTitle: 'Académie des femmes | Wahy Wa Namaa',
    seoDesc: 'Espace dédié — exclusivement des enseignantes et des étudiantes',
    title: 'Académie des femmes',
    subtitle: 'Un cadre sûr et dédié — des enseignantes spécialisées dans l’enseignement du Coran pour les femmes et les jeunes filles',
    teachersStat: 'enseignantes',
    studentsStat: 'étudiantes',
    errLoad: 'Impossible de charger les données de la section femmes pour le moment.',
    errTitle: 'Impossible de charger les données',
    retry: 'Réessayer',
    coursesTitle: 'Cours pour femmes',
    loadingCourses: 'Chargement des cours...',
    coursesComingSoon: 'Bientôt — cours dédiés aux femmes',
    startNow: 'Commencer',
    teachersTitle: 'Nos enseignantes',
    loadingTeachers: 'Chargement des enseignantes...',
    noTeachers: 'Aucun profil d’enseignante publié pour le moment',
    noRatings: 'Pas encore d’avis',
    yrs: 'ans',
    viewProfile: 'Voir le profil',
    registerStudent: 'S’inscrire comme étudiante',
  },
  de: {
    seoTitle: 'Frauen-Akademie | Wahy Wa Namaa',
    seoDesc: 'Eigener Bereich — nur Lehrerinnen und Schülerinnen',
    title: 'Frauen-Akademie',
    subtitle: 'Eine sichere und geschützte Umgebung — spezialisierte Lehrerinnen für Frauen und Mädchen',
    teachersStat: 'Lehrerinnen',
    studentsStat: 'Schülerinnen',
    errLoad: 'Daten für den Frauenbereich konnten derzeit nicht geladen werden.',
    errTitle: 'Inhalt konnte nicht geladen werden',
    retry: 'Erneut versuchen',
    coursesTitle: 'Kurse für Frauen',
    loadingCourses: 'Kurse werden geladen...',
    coursesComingSoon: 'Demnächst — spezielle Kurse für Frauen',
    startNow: 'Jetzt starten',
    teachersTitle: 'Unsere Lehrerinnen',
    loadingTeachers: 'Lehrerinnen werden geladen...',
    noTeachers: 'Derzeit sind noch keine Lehrerinnenprofile veröffentlicht',
    noRatings: 'Noch keine Bewertungen',
    yrs: 'Jahre',
    viewProfile: 'Profil ansehen',
    registerStudent: 'Als Schülerin registrieren',
  },
  tr: {
    seoTitle: 'Hanımlar Akademisi | Wahy Wa Namaa',
    seoDesc: 'Bağımsız bölüm — yalnızca kadın hocalar ve kadın öğrenciler',
    title: 'Hanımlar Akademisi',
    subtitle: 'Güvenli ve müstakil ortam — hanımlar ve kız öğrenciler için uzman kadın Kur’an hocaları',
    teachersStat: 'kadın hoca',
    studentsStat: 'öğrenci',
    errLoad: 'Hanımlar bölümü verileri şu anda yüklenemedi.',
    errTitle: 'Veriler yüklenemedi',
    retry: 'Tekrar dene',
    coursesTitle: 'Hanımlara Özel Kurslar',
    loadingCourses: 'Kurslar yükleniyor...',
    coursesComingSoon: 'Yakında — hanımlara özel kurslar',
    startNow: 'Şimdi başla',
    teachersTitle: 'Kadın Hocalarımız',
    loadingTeachers: 'Hocalar yükleniyor...',
    noTeachers: 'Henüz yayınlanmış kadın hoca profili bulunmuyor',
    noRatings: 'Henüz değerlendirme yok',
    yrs: 'yıl',
    viewProfile: 'Profili görüntüle',
    registerStudent: 'Öğrenci olarak kayıt ol',
  },
  ur: {
    seoTitle: 'خواتین اکیڈمی | وحی و نماء',
    seoDesc: 'مستقل شعبہ — صرف معلمات اور طالبات کے لیے',
    title: 'خواتین اکیڈمی',
    subtitle: 'محفوظ اور علیحدہ ماحول — خواتین اور بچیوں کے لیے قرآن کی ماہر معلمات',
    teachersStat: 'معلمات',
    studentsStat: 'طالبات',
    errLoad: 'اس وقت خواتین کے شعبے کا ڈیٹا لوڈ نہیں ہو سکا۔',
    errTitle: 'ڈیٹا لوڈ نہیں ہو سکا',
    retry: 'دوبارہ کوشش کریں',
    coursesTitle: 'خواتین کے کورسز',
    loadingCourses: 'کورسز لوڈ ہو رہے ہیں...',
    coursesComingSoon: 'جلد آ رہے ہیں — خواتین کے لیے مخصوص کورسز',
    startNow: 'ابھی شروع کریں',
    teachersTitle: 'ہماری معلمات',
    loadingTeachers: 'معلمات لوڈ ہو رہی ہیں...',
    noTeachers: 'ابھی کوئی معلمہ پروفائل شائع نہیں ہوئی — آپ رجسٹریشن شروع کر سکتی ہیں',
    noRatings: 'ابھی کوئی درجہ بندی نہیں',
    yrs: 'سال',
    viewProfile: 'پروفائل دیکھیں',
    registerStudent: 'بطور طالبہ رجسٹر ہوں',
  },
  id: {
    seoTitle: 'Akademi Muslimah | Wahy Wa Namaa',
    seoDesc: 'Bagian khusus — hanya pengajar wanita dan siswi',
    title: 'Akademi Muslimah',
    subtitle: 'Lingkungan aman dan terpisah — pengajar wanita berpengalaman untuk muslimah dan anak perempuan',
    teachersStat: 'pengajar wanita',
    studentsStat: 'siswi',
    errLoad: 'Tidak dapat memuat data bagian muslimah saat ini.',
    errTitle: 'Gagal memuat data',
    retry: 'Coba lagi',
    coursesTitle: 'Kursus Muslimah',
    loadingCourses: 'Memuat kursus...',
    coursesComingSoon: 'Segera hadir — kursus khusus muslimah',
    startNow: 'Mulai sekarang',
    teachersTitle: 'Pengajar Kami',
    loadingTeachers: 'Memuat pengajar...',
    noTeachers: 'Belum ada profil pengajar wanita yang dipublikasikan',
    noRatings: 'Belum ada penilaian',
    yrs: 'thn',
    viewProfile: 'Lihat profil',
    registerStudent: 'Daftar sebagai Siswi',
  },
  ms: {
    seoTitle: 'Akademi Wanita | Wahy Wa Namaa',
    seoDesc: 'Bahagian berasingan — hanya guru wanita dan pelajar wanita',
    title: 'Akademi Wanita',
    subtitle: 'Persekitaran selamat dan berasingan — guru wanita bertauliah dalam pengajian Al-Quran untuk wanita dan remaja perempuan',
    teachersStat: 'guru wanita',
    studentsStat: 'pelajar',
    errLoad: 'Tidak dapat memuatkan data bahagian wanita buat masa ini.',
    errTitle: 'Tidak dapat memuatkan kandungan',
    retry: 'Cuba lagi',
    coursesTitle: 'Kursus Wanita',
    loadingCourses: 'Memuatkan kursus...',
    coursesComingSoon: 'Akan datang — kursus khas untuk wanita',
    startNow: 'Mulakan sekarang',
    teachersTitle: 'Guru-Guru Kami',
    loadingTeachers: 'Memuatkan guru...',
    noTeachers: 'Tiada profil guru diterbitkan lagi',
    noRatings: 'Tiada penilaian lagi',
    yrs: 'thn',
    viewProfile: 'Lihat profil',
    registerStudent: 'Daftar sebagai Pelajar',
  },
  ku: {
    seoTitle: 'ئەکادیمیای خانمان | وەحی و نەما',
    seoDesc: 'بەشێکی سەربەخۆ — تەنها مامۆستایانی ژن و قوتابیانی کچ و ژن',
    title: 'ئەکادیمیای خانمان',
    subtitle: 'ژینگەیەکی پارێزراو و سەربەخۆ — مامۆستایانی پسپۆڕ لە فێرکردنی قورئان بۆ خانمان و کچان',
    teachersStat: 'مامۆستا',
    studentsStat: 'قوتابی',
    errLoad: 'لە ئێستادا زانیارییەکانی بەشی خانمان بارنەکرا.',
    errTitle: 'بارکردنی زانیاری سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    coursesTitle: 'خولەکانی خانمان',
    loadingCourses: 'خولەکان باردەکرێن...',
    coursesComingSoon: 'بەم زووانە — خولی تایبەت بە خانمان',
    startNow: 'ئێستا دەست پێ بکە',
    teachersTitle: 'مامۆستاکانمان',
    loadingTeachers: 'مامۆستایان باردەکرێن...',
    noTeachers: 'هیچ پرۆفایلێکی مامۆستا بڵاونەکراوەتەوە — دەتوانیت ناونووسین دەست پێ بکەیت',
    noRatings: 'هێشتا هەڵسەنگاندنی نییە',
    yrs: 'ساڵ',
    viewProfile: 'بینینی پرۆفایل',
    registerStudent: 'وەک قوتابی تۆمار ببە',
  },
};

export default function WomenPortal() {
  const { locale, isRTL, dir, t: i18nT } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = WOMEN_COPY[locale] || WOMEN_COPY.en;
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ femaleTeachers: 0, studentsServed: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setFetchError('');
    Promise.all([
      api.get('/api/women/teachers?limit=12'),
      api.get('/api/women/stats'),
      api.get('/api/courses?program=women&limit=6'),
    ]).then(([tRes, sRes, cRes]) => {
      setTeachers(tRes.teachers || []);
      setStats(sRes || { femaleTeachers: 0, studentsServed: 0 });
      setCourses(cRes.courses || (Array.isArray(cRes) ? cRes : []));
    }).catch((err) => {
      setFetchError(err?.message || copy.errLoad);
    }).finally(() => setLoading(false));
  }, [copy.errLoad]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[locale] || (isRTL ? (field.ar || field.en) : (field.en || field.ar)) || '';
  };

  return (
    <>
      <SEOHead page={{
        url: '/women',
        title: copy.seoTitle,
        description: copy.seoDesc,
      }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container">
          <div className="wn-program-hero__icon"><ShieldCheck size={40} aria-hidden="true" /></div>
          <h1 className="text-4xl font-bold mb-3 text-[var(--wn-heading)]">{copy.title}</h1>
          <p className="text-[var(--wn-text-secondary)] max-w-xl mx-auto mb-6">
            {copy.subtitle}
          </p>
          <div className="flex justify-center gap-8 text-sm text-[var(--wn-text-primary)]">
            <span className="flex items-center gap-2">
              <Users size={18} className="text-[var(--wn-women-accent)]" aria-hidden="true" /> {stats.femaleTeachers} {copy.teachersStat}
            </span>
            <span className="flex items-center gap-2">
              <Star size={18} className="text-[var(--wn-women-accent)]" aria-hidden="true" /> {stats.studentsServed}+ {copy.studentsStat}
            </span>
          </div>
        </section>

        {fetchError ? (
          <section className="max-w-3xl mx-auto px-4 pb-16">
            <div className="wn-public-empty" role="alert">
              <ShieldCheck size={42} aria-hidden="true" />
              <h3>{copy.errTitle}</h3>
              <p>{fetchError}</p>
              <button type="button" onClick={loadData} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                <RefreshCw size={16} aria-hidden="true" />
                <span>{copy.retry}</span>
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="max-w-6xl mx-auto px-4 pb-12">
              <h2 className="text-2xl font-bold mb-6 text-[var(--wn-heading)]">{copy.coursesTitle}</h2>
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-live="polite">
                  <span className="sr-only">{i18nT.common?.loading || copy.loadingCourses}</span>
                  {Array.from({ length: 3 }, (_, idx) => (
                    <div key={idx} className="wn-program-card p-5" aria-hidden="true">
                      <Skeleton className="h-7 w-7 mb-3 rounded-lg" />
                      <Skeleton className="h-5 w-2/3 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : courses.length === 0 ? (
                <p className="text-center text-[var(--wn-text-secondary)] py-8 bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-2xl">
                  {copy.coursesComingSoon}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((c) => {
                    const pricing = formatCourseRegionalDisplay(c, locale, isRTL);
                    return (
                      <Link key={c._id} to={localizedPath(`/courses/${c.slug}`, locale)} className="wn-program-card p-5 flex flex-col justify-between">
                        <div>
                          <BookOpen className="text-[var(--wn-women-accent)] mb-3" size={28} aria-hidden="true" />
                          <h3 className="font-bold mb-1 text-[var(--wn-heading)]">{pickText(c.title)}</h3>
                          <p className="text-sm text-[var(--wn-text-secondary)] line-clamp-2">{pickText(c.description)}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-[var(--wn-emerald)]">
                            {pricing.isFree ? (i18nT.courses?.free || (isRTL ? 'مجاني' : 'Free')) : pricing.formattedPrice}
                          </span>
                          <span className="min-h-[44px] inline-flex items-center gap-1 text-[var(--wn-women-accent)] text-sm font-medium">
                            {copy.startNow} <ArrowIcon size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="max-w-6xl mx-auto px-4 pb-16">
              <h2 className="text-2xl font-bold mb-6 text-[var(--wn-heading)]">{copy.teachersTitle}</h2>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite">
                  <div className="spinner spinner-lg" aria-hidden="true" />
                  <span className="sr-only">{i18nT.common?.loading || copy.loadingTeachers}</span>
                </div>
              ) : teachers.length === 0 ? (
                <p className="text-center text-[var(--wn-text-secondary)] py-12">
                  {copy.noTeachers}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teachers.map((teacher) => (
                    <Link key={teacher._id} to={localizedPath(`/teachers/${teacher._id}`, locale)} className="wn-program-card p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-full bg-[var(--wn-women-soft)] border border-[var(--wn-women-border)] flex items-center justify-center text-[var(--wn-women-accent)] font-bold text-xl">
                          {(teacher.user?.name || teacher.personalInfo?.fullName || '?')[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-[var(--wn-heading)]">{teacher.user?.name || teacher.personalInfo?.fullName}</h3>
                          <p className="text-sm text-[var(--wn-text-secondary)] flex items-center gap-1">
                            <Star size={14} className="text-[var(--wn-gold)] fill-current" aria-hidden="true" />
                            {Number(teacher.rating?.count || 0) > 0 ? teacher.rating?.average?.toFixed(1) : copy.noRatings}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--wn-text-secondary)]">{teacher.personalInfo?.country} · {teacher.quranInfo?.teachingExperience || 0} {copy.yrs}</p>
                      <span className="min-h-[44px] inline-flex items-center gap-1 text-[var(--wn-women-accent)] text-sm mt-2 font-medium">
                        {copy.viewProfile} <ArrowIcon size={14} aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="text-center mt-10">
                <Link to={localizedPath('/register/student', locale) + '?section=women'} className="btn-primary min-h-[44px] inline-flex items-center justify-center">
                  {copy.registerStudent}
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
      <GlobalFooter />
    </>
  );
}
