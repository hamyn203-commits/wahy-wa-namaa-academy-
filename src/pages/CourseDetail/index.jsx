import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Users, Star, CheckCircle, Play, Sparkles, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import LocalizedLink from '../../components/LocalizedLink';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath } from '../../lib/locale';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import '../../styles/public-experience.css';

const COURSE_DETAIL_COPY = {
  ar: {
    home: 'الرئيسية',
    courses: 'الدورات',
    free: 'مجاني',
    errDetails: 'تعذر تحميل تفاصيل الدورة.',
    errReach: 'تعذر الاتصال بالخادم.',
    errTransfersConfig: 'طرق التحويل قيد الإعداد حاليًا. تواصل معنا للمساعدة.',
    enrollSuccess: 'تم التسجيل بنجاح',
    errPhone: 'أضف رقم هاتف صالح إلى حسابك قبل الدفع.',
    errTransfersDisabled: 'طرق التحويل غير مفعّلة بعد.',
    errEnroll: 'تعذر التسجيل',
    loadingDetails: 'جاري تحميل تفاصيل الدورة...',
    errTitle: 'تعذر تحميل الدورة',
    retry: 'إعادة المحاولة',
    notFound: 'الدورة غير موجودة',
    browseCourses: 'عرض جميع الدورات',
    fallbackProgram: 'برنامج قرآني',
    hours: 'ساعة',
    lessons: 'درس',
    enrolled: 'ملتحق',
    contentEyebrow: 'محتوى الدورة',
    journeyTitle: 'رحلة التعلم',
    lessonPrefix: 'الدرس ',
    previewTag: 'معاينة',
    prepTitle: 'المحتوى قيد التجهيز',
    prepDesc: 'سيظهر محتوى الدورة هنا عند نشر الدروس.',
    yourProgress: 'تقدمك في الدورة',
    continueLearning: 'متابعة التعلم',
    startLearning: 'ابدأ التعلم',
    preparing: 'جاري التحضير...',
    transfersConfiguring: 'طرق التحويل قيد الإعداد',
    transferProof: 'التحويل وإرسال الإثبات',
    enrollCourse: 'الالتحاق بالدورة',
    signInFirst: 'تسجيل الدخول أولًا',
    askQuestion: 'لديك سؤال عن هذه الدورة؟',
  },
  en: {
    home: 'Home',
    courses: 'Courses',
    free: 'Free',
    errDetails: 'Could not load course details.',
    errReach: 'Could not reach the server.',
    errTransfersConfig: 'Transfer methods are currently being configured. Contact us for help.',
    enrollSuccess: 'Enrollment completed',
    errPhone: 'Add a valid phone number to your account before payment.',
    errTransfersDisabled: 'Transfer methods are not enabled yet.',
    errEnroll: 'Enrollment failed',
    loadingDetails: 'Loading course details...',
    errTitle: 'Unable to load course',
    retry: 'Retry',
    notFound: 'Course not found',
    browseCourses: 'Browse courses',
    fallbackProgram: 'Quran program',
    hours: 'hours',
    lessons: 'lessons',
    enrolled: 'enrolled',
    contentEyebrow: 'COURSE CONTENT',
    journeyTitle: 'Learning journey',
    lessonPrefix: 'Lesson ',
    previewTag: 'Preview',
    prepTitle: 'Content is being prepared',
    prepDesc: 'Course lessons will appear here once they are published.',
    yourProgress: 'Your progress',
    continueLearning: 'Continue learning',
    startLearning: 'Start learning',
    preparing: 'Preparing...',
    transfersConfiguring: 'Transfer methods are being configured',
    transferProof: 'Transfer and submit proof',
    enrollCourse: 'Enroll in course',
    signInFirst: 'Sign in first',
    askQuestion: 'Have a question about this course?',
  },
  fr: {
    home: 'Accueil',
    courses: 'Cours',
    free: 'Gratuit',
    errDetails: 'Impossible de charger les détails du cours.',
    errReach: 'Impossible de joindre le serveur.',
    errTransfersConfig: 'Les moyens de virement sont en cours de configuration. Contactez-nous pour obtenir de l’aide.',
    enrollSuccess: 'Inscription confirmée',
    errPhone: 'Ajoutez un numéro de téléphone valide à votre compte avant le paiement.',
    errTransfersDisabled: 'Les moyens de virement ne sont pas encore activés.',
    errEnroll: 'Échec de l’inscription',
    loadingDetails: 'Chargement des détails du cours...',
    errTitle: 'Impossible de charger le cours',
    retry: 'Réessayer',
    notFound: 'Cours introuvable',
    browseCourses: 'Voir tous les cours',
    fallbackProgram: 'Programme coranique',
    hours: 'heures',
    lessons: 'leçons',
    enrolled: 'inscrits',
    contentEyebrow: 'CONTENU DU COURS',
    journeyTitle: 'Parcours d’apprentissage',
    lessonPrefix: 'Leçon ',
    previewTag: 'Aperçu',
    prepTitle: 'Contenu en préparation',
    prepDesc: 'Les leçons apparaîtront ici dès leur publication.',
    yourProgress: 'Votre progression',
    continueLearning: 'Continuer l’apprentissage',
    startLearning: 'Commencer le cours',
    preparing: 'Préparation...',
    transfersConfiguring: 'Moyens de virement en configuration',
    transferProof: 'Virement et envoi du justificatif',
    enrollCourse: 'S’inscrire au cours',
    signInFirst: 'Se connecter d’abord',
    askQuestion: 'Une question sur ce cours ?',
  },
  de: {
    home: 'Startseite',
    courses: 'Kurse',
    free: 'Kostenlos',
    errDetails: 'Kursdetails konnten nicht geladen werden.',
    errReach: 'Server konnte nicht erreicht werden.',
    errTransfersConfig: 'Überweisungswege werden derzeit eingerichtet. Kontaktieren Sie uns gerne.',
    enrollSuccess: 'Einschreibung abgeschlossen',
    errPhone: 'Bitte hinterlegen Sie vor der Zahlung eine gültige Telefonnummer.',
    errTransfersDisabled: 'Überweisungswege sind noch nicht aktiviert.',
    errEnroll: 'Einschreibung fehlgeschlagen',
    loadingDetails: 'Kursdetails werden geladen...',
    errTitle: 'Kurs konnte nicht geladen werden',
    retry: 'Erneut versuchen',
    notFound: 'Kurs nicht gefunden',
    browseCourses: 'Alle Kurse ansehen',
    fallbackProgram: 'Koran-Programm',
    hours: 'Stunden',
    lessons: 'Lektionen',
    enrolled: 'Teilnehmer',
    contentEyebrow: 'KURSINHALT',
    journeyTitle: 'Lernweg',
    lessonPrefix: 'Lektion ',
    previewTag: 'Vorschau',
    prepTitle: 'Inhalt wird vorbereitet',
    prepDesc: 'Die Lektionen erscheinen hier, sobald sie veröffentlicht sind.',
    yourProgress: 'Ihr Fortschritt',
    continueLearning: 'Weiterlernen',
    startLearning: 'Lernen starten',
    preparing: 'Wird vorbereitet...',
    transfersConfiguring: 'Überweisungswege werden eingerichtet',
    transferProof: 'Überweisen & Beleg senden',
    enrollCourse: 'Für Kurs einschreiben',
    signInFirst: 'Zuerst anmelden',
    askQuestion: 'Haben Sie eine Frage zu diesem Kurs?',
  },
  tr: {
    home: 'Ana Sayfa',
    courses: 'Kurslar',
    free: 'Ücretsiz',
    errDetails: 'Kurs detayları yüklenemedi.',
    errReach: 'Sunucuya ulaşılamadı.',
    errTransfersConfig: 'Havale yöntemleri şu anda hazırlanıyor. Yardım için bize ulaşın.',
    enrollSuccess: 'Kayıt tamamlandı',
    errPhone: 'Ödeme öncesinde hesabınıza geçerli bir telefon numarası ekleyin.',
    errTransfersDisabled: 'Havale yöntemleri henüz etkin değil.',
    errEnroll: 'Kayıt başarısız',
    loadingDetails: 'Kurs detayları yükleniyor...',
    errTitle: 'Kurs yüklenemedi',
    retry: 'Tekrar dene',
    notFound: 'Kurs bulunamadı',
    browseCourses: 'Tüm kurslara göz at',
    fallbackProgram: 'Kur’an programı',
    hours: 'saat',
    lessons: 'ders',
    enrolled: 'kayıtlı',
    contentEyebrow: 'KURS İÇERİĞİ',
    journeyTitle: 'Öğrenim yolculuğu',
    lessonPrefix: 'Ders ',
    previewTag: 'Önizleme',
    prepTitle: 'İçerik hazırlanıyor',
    prepDesc: 'Dersler yayımlandığında kurs içeriği burada görünecektir.',
    yourProgress: 'İlerlemeniz',
    continueLearning: 'Öğrenmeye devam et',
    startLearning: 'Öğrenmeye başla',
    preparing: 'Hazırlanıyor...',
    transfersConfiguring: 'Havale yöntemleri hazırlanıyor',
    transferProof: 'Havale yap ve dekont gönder',
    enrollCourse: 'Kursa kaydol',
    signInFirst: 'Önce giriş yapın',
    askQuestion: 'Bu kurs hakkında sorunuz mu var?',
  },
  ur: {
    home: 'ہوم',
    courses: 'کورسز',
    free: 'مفت',
    errDetails: 'کورس کی تفصیلات لوڈ نہیں ہو سکیں۔',
    errReach: 'سرور سے رابطہ نہیں ہو سکا۔',
    errTransfersConfig: 'منتقلی کے طریقے فی الحال ترتیب دیے جا رہے ہیں۔ مدد کے لیے ہم سے رابطہ کریں۔',
    enrollSuccess: 'داخلہ مکمل ہو گیا',
    errPhone: 'ادائیگی سے پہلے اپنے اکاؤنٹ میں درست فون نمبر شامل کریں۔',
    errTransfersDisabled: 'منتقلی کے طریقے ابھی فعال نہیں ہیں۔',
    errEnroll: 'داخلہ مکمل نہیں ہو سکا',
    loadingDetails: 'کورس کی تفصیلات لوڈ ہو رہی ہیں...',
    errTitle: 'کورس لوڈ نہیں ہو سکا',
    retry: 'دوبارہ کوشش کریں',
    notFound: 'کورس دستیاب نہیں',
    browseCourses: 'تمام کورسز دیکھیں',
    fallbackProgram: 'قرآنی پروگرام',
    hours: 'گھنٹے',
    lessons: 'اسباق',
    enrolled: 'طلباء',
    contentEyebrow: 'کورس کا مواد',
    journeyTitle: 'تعلیمی سفر',
    lessonPrefix: 'سبق ',
    previewTag: 'مفت نمونہ',
    prepTitle: 'مواد تیار کیا جا رہا ہے',
    prepDesc: 'اسباق شائع ہونے پر کورس کا مواد یہاں ظاہر ہوگا۔',
    yourProgress: 'آپ کی پیش رفت',
    continueLearning: 'تعلیم جاری رکھیں',
    startLearning: 'سیکھنا شروع کریں',
    preparing: 'تیاری ہو رہی ہے...',
    transfersConfiguring: 'منتقلی کے طریقے ترتیب دیے جا رہے ہیں',
    transferProof: 'رقم منتقل کریں اور ثبوت بھیجیں',
    enrollCourse: 'کورس میں داخلہ لیں',
    signInFirst: 'پہلے لاگ ان کریں',
    askQuestion: 'کیا اس کورس کے بارے میں کوئی سوال ہے؟',
  },
  id: {
    home: 'Beranda',
    courses: 'Kursus',
    free: 'Gratis',
    errDetails: 'Tidak dapat memuat detail kursus.',
    errReach: 'Tidak dapat terhubung ke server.',
    errTransfersConfig: 'Metode transfer sedang disiapkan. Hubungi kami untuk bantuan.',
    enrollSuccess: 'Pendaftaran berhasil',
    errPhone: 'Tambahkan nomor telepon yang valid ke akun Anda sebelum pembayaran.',
    errTransfersDisabled: 'Metode transfer belum diaktifkan.',
    errEnroll: 'Pendaftaran gagal',
    loadingDetails: 'Memuat detail kursus...',
    errTitle: 'Gagal memuat kursus',
    retry: 'Coba lagi',
    notFound: 'Kursus tidak ditemukan',
    browseCourses: 'Lihat semua kursus',
    fallbackProgram: 'Program Al-Quran',
    hours: 'jam',
    lessons: 'pelajaran',
    enrolled: 'terdaftar',
    contentEyebrow: 'ISI KURSUS',
    journeyTitle: 'Perjalanan belajar',
    lessonPrefix: 'Pelajaran ',
    previewTag: 'Pratinjau',
    prepTitle: 'Materi sedang disiapkan',
    prepDesc: 'Daftar pelajaran akan tampil di sini setelah diterbitkan.',
    yourProgress: 'Kemajuan Anda',
    continueLearning: 'Lanjutkan belajar',
    startLearning: 'Mulai belajar',
    preparing: 'Menyiapkan...',
    transfersConfiguring: 'Metode transfer sedang disiapkan',
    transferProof: 'Transfer & kirim bukti pembayaran',
    enrollCourse: 'Daftar kursus',
    signInFirst: 'Masuk terlebih dahulu',
    askQuestion: 'Punya pertanyaan tentang kursus ini?',
  },
  ms: {
    home: 'Laman Utama',
    courses: 'Kursus',
    free: 'Percuma',
    errDetails: 'Tidak dapat memuatkan butiran kursus.',
    errReach: 'Tidak dapat menghubungi pelayan.',
    errTransfersConfig: 'Kaedah pindahan sedang disediakan. Hubungi kami untuk bantuan.',
    enrollSuccess: 'Pendaftaran berjaya',
    errPhone: 'Sila tambah nombor telefon yang sah pada akaun anda sebelum pembayaran.',
    errTransfersDisabled: 'Kaedah pindahan belum diaktifkan lagi.',
    errEnroll: 'Pendaftaran gagal',
    loadingDetails: 'Memuatkan butiran kursus...',
    errTitle: 'Tidak dapat memuatkan kursus',
    retry: 'Cuba lagi',
    notFound: 'Kursus tidak ditemui',
    browseCourses: 'Layari semua kursus',
    fallbackProgram: 'Program Al-Quran',
    hours: 'jam',
    lessons: 'pelajaran',
    enrolled: 'berdaftar',
    contentEyebrow: 'KANDUNGAN KURSUS',
    journeyTitle: 'Perjalanan pembelajaran',
    lessonPrefix: 'Pelajaran ',
    previewTag: 'Pratonton',
    prepTitle: 'Kandungan sedang disediakan',
    prepDesc: 'Pelajaran kursus akan dipaparkan di sini setelah diterbitkan.',
    yourProgress: 'Kemajuan anda',
    continueLearning: 'Teruskan pembelajaran',
    startLearning: 'Mulakan pembelajaran',
    preparing: 'Menyediakan...',
    transfersConfiguring: 'Kaedah pindahan sedang disediakan',
    transferProof: 'Pindah & hantar bukti pembayaran',
    enrollCourse: 'Daftar kursus',
    signInFirst: 'Log masuk dahulu',
    askQuestion: 'Ada soalan tentang kursus ini?',
  },
  ku: {
    home: 'سەرەکی',
    courses: 'خولەکان',
    free: 'بەخۆڕایی',
    errDetails: 'بارکردنی وردەکارییەکانی خول سەرکەوتوو نەبوو.',
    errReach: 'پەیوەندی بە ڕاژەکارەوە نەکرا.',
    errTransfersConfig: 'ڕێگاکانی ناردنی پارە لە ئێستادا ئامادە دەکرێن. بۆ یارمەتی پەیوەندیمان پێوە بکە.',
    enrollSuccess: 'تۆمارکردن بە سەرکەوتوویی ئەنجامدرا',
    errPhone: 'پێش پارەدان ژمارەیەکی تەلەفۆنی دروست بخەرە سەر هەژمارەکەت.',
    errTransfersDisabled: 'ڕێگاکانی ناردنی پارە هێشتا چالاک نەکراون.',
    errEnroll: 'تۆمارکردن سەرکەوتوو نەبوو',
    loadingDetails: 'وردەکارییەکانی خول باردەکرێن...',
    errTitle: 'بارکردنی خول سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    notFound: 'خولەکە نەدۆزرایەوە',
    browseCourses: 'بینینی هەموو خولەکان',
    fallbackProgram: 'بەرنامەی قورئانی',
    hours: 'کاتژمێر',
    lessons: 'وانە',
    enrolled: 'بەشداربوو',
    contentEyebrow: 'ناوەڕۆکی خول',
    journeyTitle: 'گەشتی فێربوون',
    lessonPrefix: 'وانەی ',
    previewTag: 'پێشبینین',
    prepTitle: 'ناوەڕۆک لە ئامادەکاریدایە',
    prepDesc: 'وانەکانی خول لێرە دەردەکەون هەر کە بڵاوکرانەوە.',
    yourProgress: 'پێشکەوتنت لە خولەکەدا',
    continueLearning: 'بەردەوامبوون لە فێربوون',
    startLearning: 'دەستپێکردنی فێربوون',
    preparing: 'ئامادە دەکرێت...',
    transfersConfiguring: 'ڕێگاکانی ناردن لە ئامادەکاریدان',
    transferProof: 'ناردنی پارە و بەڵگەنامە',
    enrollCourse: 'بەشداریکردن لە خولدا',
    signInFirst: 'سەرەتا بچۆ ژوورەوە',
    askQuestion: 'پرسیارت هەیە دەربارەی ئەم خولە؟',
  },
};

function textValue(value, locale, isRTL) {
  if (typeof value === 'string') return value;
  return value?.[locale] || (isRTL ? (value?.ar || value?.en) : (value?.en || value?.ar)) || '';
}

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, isRTL, dir, t } = useI18n();
  const { createCourseSchema, createBreadcrumbSchema } = useSEO();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = COURSE_DETAIL_COPY[locale] || COURSE_DETAIL_COPY.en;
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({ loaded: false, configured: false });

  const loadCourse = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/courses/' + slug)
      .then(async (data) => {
        setCourse(data);
        if (!authLoading && isAuthenticated) {
          try {
            const lms = await api.get('/api/lms/course/' + slug, { auth: true });
            setEnrollment(lms.enrollment);
          } catch {
            setEnrollment(null);
          }
        } else if (!authLoading) {
          setEnrollment(null);
        }
      })
      .catch((err) => {
        setCourse(null);
        if (err?.status && err.status !== 404) {
          setFetchError(err.message || copy.errDetails);
        } else if (!err?.status) {
          setFetchError(err?.message || copy.errReach);
        }
      })
      .finally(() => setLoading(false));
  }, [slug, authLoading, isAuthenticated, copy.errDetails, copy.errReach]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  useEffect(() => {
    api.get('/api/payments/config')
      .then((data) => setPaymentConfig({
        loaded: true,
        configured: Boolean(data?.configured),
        provider: data?.provider || null,
      }))
      .catch(() => setPaymentConfig({ loaded: true, configured: false }));
  }, []);

  const redirectTarget = (location.pathname || localizedPath('/courses/' + slug, locale)) + (location.search || '');
  const loginWithRedirect = localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(redirectTarget);

  const handleEnroll = async () => {
    if (enrolling) return;
    if (!isAuthenticated) {
      navigate(loginWithRedirect);
      return;
    }

    const paidCourse = Number(course?.price || 0) > 0;

    if (paidCourse && paymentConfig.loaded && !paymentConfig.configured) {
      toast.error(copy.errTransfersConfig);
      return;
    }

    setEnrolling(true);
    try {
      if (paidCourse) {
        navigate(
          localizedPath('/payment/manual', locale)
            + '?course=' + encodeURIComponent(slug)
        );
        return;
      }

      const data = await api.post('/api/lms/course/' + slug + '/enroll', {}, { auth: true });
      setEnrollment(data.enrollment);
      toast.success(copy.enrollSuccess);
    } catch (err) {
      const message = err.code === 'PAYMENT_PROFILE_INCOMPLETE'
        ? copy.errPhone
        : err.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
          ? copy.errTransfersDisabled
          : err.message || copy.errEnroll;

      toast.error(message);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell" dir={dir} role="status" aria-live="polite">
          <span className="sr-only">{t.common?.loading || copy.loadingDetails}</span>
          <section className="wn-detail-hero">
            <div className="page-container">
              <Skeleton className="mb-3 h-4 w-28" />
              <Skeleton className="mb-4 h-10 w-2/3" />
              <Skeleton className="mb-5 h-4 w-1/2" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </section>
          <div className="page-container wn-detail-layout">
            <section className="wn-detail-card">
              <div className="wn-detail-card__body grid gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-48" />
                {Array.from({ length: 4 }, (_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </section>
            <aside className="wn-detail-card wn-detail-aside grid gap-4">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </aside>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full" role="alert">
            <BookOpen size={48} aria-hidden="true" />
            <h3>{copy.errTitle}</h3>
            <p>{fetchError}</p>
            <button type="button" onClick={loadCourse} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{copy.retry}</span>
            </button>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!course) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full">
            <BookOpen size={48} aria-hidden="true" />
            <h3>{copy.notFound}</h3>
            <LocalizedLink to="/courses" locale={locale} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              {copy.browseCourses}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const title = textValue(course.title, locale, isRTL) || slug;
  const description = textValue(course.description, locale, isRTL);
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const ratingCount = Number(course.stats?.rating?.count || 0);
  const ratingAverage = Number(course.stats?.rating?.average || 0);
  const enrolled = Number(course.stats?.enrolled || 0);
  const progress = Number(enrollment?.progress?.percentage || 0);

  const isDone = (lessonId) => enrollment?.progress?.completedLessons?.some(
    (completed) => completed.lesson?.toString?.() === lessonId || completed.lesson === lessonId
  );

  const courseSchema = createCourseSchema({
    name: title,
    description,
    url: '/courses/' + slug,
    image: course.thumbnail || course.coverImage,
    level: course.level,
    price: course.price,
    currency: course.currency || 'USD',
    ratingValue: ratingAverage,
    ratingCount,
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: t.common?.home || copy.home, url: '/' },
    { name: t.courses?.title || copy.courses, url: '/courses' },
    { name: title, url: '/courses/' + slug },
  ]);

  return (
    <>
      <SEOHead page={{
        title,
        description,
        image: course.thumbnail || course.coverImage,
        url: '/courses/' + slug,
        type: 'course',
        schema: [courseSchema, breadcrumbSchema],
      }} />
      <GlobalHeader />

      <main className="wn-detail-shell" dir={dir}>
        <section className="wn-detail-hero">
          <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {course.category || copy.fallbackProgram}</span>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}

              <div className="wn-detail-meta">
                {course.durationInHours || course.duration ? <span><Clock size={14} aria-hidden="true" /> {course.durationInHours || course.duration} {course.durationInHours ? copy.hours : ''}</span> : null}
                <span><BookOpen size={14} aria-hidden="true" /> {lessons.length} {copy.lessons}</span>
                {enrolled > 0 ? <span><Users size={14} aria-hidden="true" /> {enrolled} {copy.enrolled}</span> : null}
                {ratingCount > 0 && ratingAverage > 0 ? <span><Star size={14} aria-hidden="true" /> {ratingAverage.toFixed(1)} ({ratingCount})</span> : null}
              </div>
            </motion.div>
          </div>
        </section>

        <div className="page-container wn-detail-layout">
          <section className="wn-detail-card">
            <div className="wn-detail-card__body">
              <span className="wn-public-eyebrow">{copy.contentEyebrow}</span>
              <h2>{copy.journeyTitle}</h2>

              <div className="wn-lesson-list">
                {lessons.length ? lessons.map((lesson, index) => (
                  <div key={lesson._id || index} className="wn-lesson-row">
                    <span className="wn-lesson-row__status">
                      {isDone(lesson._id) ? <CheckCircle size={15} aria-hidden="true" /> : <span className="text-xs font-bold">{index + 1}</span>}
                    </span>
                    <span className="wn-lesson-row__title">{textValue(lesson.title, locale, isRTL) || copy.lessonPrefix + (index + 1)}</span>
                    {lesson.isFree ? <span className="wn-lesson-row__tag">{copy.previewTag}</span> : enrollment && lesson.type ? <span className="text-xs text-[var(--wn-text-tertiary)]">{lesson.type}</span> : <span />}
                  </div>
                )) : (
                  <div className="wn-public-empty !py-10">
                    <BookOpen size={38} aria-hidden="true" />
                    <h3>{copy.prepTitle}</h3>
                    <p>{copy.prepDesc}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="wn-detail-card wn-detail-aside">
            {enrollment ? (
              <div className="wn-detail-progress">
                <div className="wn-detail-progress__head">
                  <span>{copy.yourProgress}</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="wn-detail-progress__bar"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%' }} /></div>
              </div>
            ) : null}

            <div className="wn-detail-price">
              {Number(course.price) > 0 ? course.price + ' ' + (course.currency || 'USD') : (t.courses?.free || copy.free)}
            </div>

            <div className="grid gap-2 mt-4">
              {enrollment ? (
                <button type="button" onClick={() => navigate(localizedPath('/courses/' + slug + '/learn', locale))} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px]">
                  <Play size={17} aria-hidden="true" />
                  {progress > 0 ? copy.continueLearning : copy.startLearning}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={enrolling || (Number(course.price) > 0 && paymentConfig.loaded && !paymentConfig.configured)}
                  aria-busy={enrolling}
                  className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px] disabled:opacity-60"
                >
                  {enrolling
                    ? copy.preparing
                    : Number(course.price) > 0
                      ? paymentConfig.loaded && !paymentConfig.configured
                        ? copy.transfersConfiguring
                        : copy.transferProof
                      : copy.enrollCourse}
                  {!enrolling ? <ArrowIcon size={16} aria-hidden="true" /> : null}
                </button>
              )}

              {!isAuthenticated ? (
                <LocalizedLink to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} locale={locale} className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px]">
                  {copy.signInFirst}
                </LocalizedLink>
              ) : null}
              <LocalizedLink to="/contact" locale={locale} className="min-h-[44px] inline-flex items-center justify-center text-center text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] py-2">
                {copy.askQuestion}
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
