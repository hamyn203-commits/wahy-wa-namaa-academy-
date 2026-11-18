import { Link } from 'react-router-dom';
import { HeartHandshake, Globe2, Users, ArrowLeft, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const REVERTS_COPY = {
  ar: {
    seoTitle: 'برنامج المسلمين الجدد',
    seoDesc: 'مسار تعليمي للمسلمين الجدد',
    title: 'برنامج المسلمين الجدد',
    subtitle: 'رحلة تعليمية لطيفة من الأساسيات إلى إتقان القرآن — بلغتك',
    cta: 'ابدأ الآن',
    errLoad: 'تعذر تحميل المسارات حالياً.',
    loadingPaths: 'جاري تحميل المسارات...',
    retry: 'إعادة المحاولة',
    pathsTitle: 'مسارات للمسلمين الجدد',
    features: [
      'دعم بالإنجليزية والفرنسية',
      'مسارات تعليمية مخصصة',
      'مرافقة فردية',
      'مجتمع داعم',
    ],
  },
  en: {
    seoTitle: 'New Muslims Program',
    seoDesc: 'Learning path for new Muslims',
    title: 'New Muslims Program',
    subtitle: 'A gentle journey from basics to Quran mastery — in your language',
    cta: 'Start Now',
    errLoad: 'Could not load paths right now.',
    loadingPaths: 'Loading paths...',
    retry: 'Retry',
    pathsTitle: 'New Muslim Paths',
    features: [
      'Support in English & French',
      'Custom learning paths',
      'One-on-one mentoring',
      'Supportive community',
    ],
  },
  fr: {
    seoTitle: 'Programme Nouveaux Musulmans',
    seoDesc: 'Parcours d’apprentissage pour les nouveaux musulmans',
    title: 'Programme Nouveaux Musulmans',
    subtitle: 'Un accompagnement doux des bases jusqu’à la maîtrise du Coran — dans votre langue',
    cta: 'Commencer',
    errLoad: 'Impossible de charger les parcours pour le moment.',
    loadingPaths: 'Chargement des parcours...',
    retry: 'Réessayer',
    pathsTitle: 'Parcours pour nouveaux musulmans',
    features: [
      'Accompagnement en français et anglais',
      'Parcours d’apprentissage personnalisés',
      'Suivi individuel dédié',
      'Communauté bienveillante',
    ],
  },
  de: {
    seoTitle: 'Programm für Neue Muslime',
    seoDesc: 'Lernpfad für neue Muslime',
    title: 'Programm für Neue Muslime',
    subtitle: 'Ein behutsamer Weg von den Grundlagen bis zur sicheren Koranlesung — in Ihrer Sprache',
    cta: 'Jetzt starten',
    errLoad: 'Lernpfade konnten derzeit nicht geladen werden.',
    loadingPaths: 'Lernpfade werden geladen...',
    retry: 'Erneut versuchen',
    pathsTitle: 'Lernpfade für Neue Muslime',
    features: [
      'Begleitung auf Deutsch, Englisch & Französisch',
      'Individuelle Lernpfade',
      'Persönliche 1-zu-1-Betreuung',
      'Unterstützende Gemeinschaft',
    ],
  },
  tr: {
    seoTitle: 'Yeni Müslümanlar Programı',
    seoDesc: 'Yeni Müslümanlar için öğrenim yolu',
    title: 'Yeni Müslümanlar Programı',
    subtitle: 'Temel bilgilerden Kur’an’da ustalığa uzanan nazik bir yolculuk — kendi dilinizde',
    cta: 'Şimdi Başla',
    errLoad: 'Programlar şu anda yüklenemedi.',
    loadingPaths: 'Programlar yükleniyor...',
    retry: 'Tekrar dene',
    pathsTitle: 'Yeni Müslüman Yol Haritaları',
    features: [
      'Çok dilli rehberlik desteği',
      'Kişiye özel öğrenim yolları',
      'Birebir mentorluk',
      'Destekleyici topluluk',
    ],
  },
  ur: {
    seoTitle: 'نو مسلم پروگرام',
    seoDesc: 'نئے مسلمانوں کے لیے تعلیمی راستہ',
    title: 'نو مسلم پروگرام',
    subtitle: 'بنیادی باتوں سے قرآن کی مہارت تک ایک پُرسکون اور آسان سفر — آپ کی اپنی زبان میں',
    cta: 'ابھی شروع کریں',
    errLoad: 'اس وقت تعلیمی راستے لوڈ نہیں ہو سکے۔',
    loadingPaths: 'راستے لوڈ ہو رہے ہیں...',
    retry: 'دوبارہ کوشش کریں',
    pathsTitle: 'نو مسلم طلباء کے لیے پروگرام',
    features: [
      'انگریزی، فرانسیسی اور دیگر زبانوں میں سہولت',
      'خصوصی تعلیمی راستے',
      'انفرادی رہنمائی',
      'معاون تعلیمی ماحول',
    ],
  },
  id: {
    seoTitle: 'Program Mualaf',
    seoDesc: 'Jalur pembelajaran untuk mualaf',
    title: 'Program Mualaf',
    subtitle: 'Perjalanan belajar yang ramah dari dasar hingga mahir Al-Quran — dalam bahasa Anda',
    cta: 'Mulai Sekarang',
    errLoad: 'Tidak dapat memuat jalur belajar saat ini.',
    loadingPaths: 'Memuat jalur belajar...',
    retry: 'Coba lagi',
    pathsTitle: 'Jalur Belajar Mualaf',
    features: [
      'Dukungan dalam berbagai bahasa',
      'Jalur pembelajaran yang disesuaikan',
      'Pendampingan satu-lawan-satu',
      'Komunitas yang mendukung',
    ],
  },
  ms: {
    seoTitle: 'Program Saudara Baru',
    seoDesc: 'Laluan pembelajaran untuk saudara baru',
    title: 'Program Saudara Baru',
    subtitle: 'Perjalanan pembelajaran yang lembut daripada asas hingga penguasaan Al-Quran — dalam bahasa anda',
    cta: 'Mulakan Sekarang',
    errLoad: 'Tidak dapat memuatkan laluan buat masa ini.',
    loadingPaths: 'Memuatkan laluan...',
    retry: 'Cuba lagi',
    pathsTitle: 'Laluan Saudara Baru',
    features: [
      'Sokongan dalam pelbagai bahasa',
      'Laluan pembelajaran tersuai',
      'Bimbingan satu-sama-satu',
      'Komuniti yang menyokong',
    ],
  },
  ku: {
    seoTitle: 'بەرنامەی موسڵمانانی نوێ',
    seoDesc: 'ڕێڕەوی فێرکاری بۆ موسڵمانانی نوێ',
    title: 'بەرنامەی موسڵمانانی نوێ',
    subtitle: 'گەشتێکی فێرکاری نەرم و ئاسان لە بنەڕەتەوە تا شارەزایی لە قورئاندا — بە زمانی خۆت',
    cta: 'ئێستا دەست پێ بکە',
    errLoad: 'لە ئێستادا بارکردنی ڕێڕەوەکان سەرکەوتوو نەبوو.',
    loadingPaths: 'ڕێڕەوەکان باردەکرێن...',
    retry: 'دووبارە هەوڵبدەرەوە',
    pathsTitle: 'ڕێڕەوەکانی موسڵمانانی نوێ',
    features: [
      'پشتگیری بە ئینگلیزی و فەڕەنسی',
      'ڕێڕەوی فێرکاری تایبەتکراو',
      'هاوڕێیەتی و ڕێنمایی تاکەکەسی',
      'کۆمەڵگایەکی پشتیوان',
    ],
  },
};

const FEATURE_ICONS = [Globe2, BookOpen, Users, HeartHandshake];

export default function RevertsProgram() {
  const { locale, isRTL, dir, t } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = REVERTS_COPY[locale] || REVERTS_COPY.en;
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadCourses = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/courses?program=reverts&limit=6')
      .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
      .catch(() =>
        api.get('/api/courses?category=islamic&level=beginner&limit=6')
          .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
          .catch((err) => {
            setCourses([]);
            setFetchError(err?.message || copy.errLoad);
          })
      )
      .finally(() => setLoading(false));
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
      <SEOHead page={{ url: '/programs/reverts', title: copy.seoTitle, description: copy.seoDesc }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container max-w-3xl">
          <div className="wn-program-hero__icon"><HeartHandshake size={42} aria-hidden="true" /></div>
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
                <Icon className="text-[var(--wn-link)] mb-3" size={32} aria-hidden="true" />
                <h2 className="font-bold text-lg text-[var(--wn-heading)]">{label}</h2>
              </div>
            );
          })}
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{t.common?.loading || copy.loadingPaths}</span>
              {Array.from({ length: 2 }, (_, idx) => (
                <div key={idx} className="wn-program-card p-4" aria-hidden="true">
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="wn-public-empty" role="alert">
              <BookOpen size={36} aria-hidden="true" />
              <p>{fetchError}</p>
              <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-3 min-h-[44px]">
                <RefreshCw size={15} aria-hidden="true" />
                <span>{copy.retry}</span>
              </button>
            </div>
          ) : courses.length > 0 ? (
            <>
              <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-[var(--wn-heading)]">
                <BookOpen size={22} aria-hidden="true" /> {copy.pathsTitle}
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
