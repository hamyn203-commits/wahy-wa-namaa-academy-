import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpenCheck, Check, Clock3,
  Crown, Heart, ShieldCheck, Sparkles, Users, UserRound
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import LocalizedLink from '../../components/LocalizedLink';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useSEO } from '../../hooks/useSEO';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { localizedPath } from '../../lib/locale';
import './plans.css';

const PLAN_DEFS = [
  {
    id: 'community',
    nameAr: 'الحلقة الاقتصادية الكبرى',
    nameEn: 'Community Circle',
    price: 10,
    studentsAr: 'من 15 إلى 20 طالب',
    studentsEn: '15–20 students',
    image: '/images/plans/men-community.jpg',
    imageWomen: '/images/plans/women-community.jpg',
    badgeAr: 'الأوفر',
    badgeEn: 'Best value',
    tone: 'mint',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['حلقة جماعية منظمة', 'تسميع بالدور', 'مناسبة للاستمرار بتكلفة منخفضة'],
    featuresEn: ['Structured group circle', 'Turn-based recitation', 'Lowest-cost continuous learning'],
  },
  {
    id: 'group',
    nameAr: 'الحلقة الجماعية',
    nameEn: 'Group Circle',
    price: 20,
    studentsAr: 'من 5 إلى 10 طلاب',
    studentsEn: '5–10 students',
    image: '/images/plans/men-group.jpg',
    imageWomen: '/images/plans/women-group.jpg',
    badgeAr: 'الأكثر طلبًا',
    badgeEn: 'Most popular',
    tone: 'emerald',
    featured: true,
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['متابعة أكبر لكل طالب', 'وقت تسميع أفضل', 'توازن ممتاز بين السعر والمتابعة'],
    featuresEn: ['More attention per learner', 'More recitation time', 'Strong price-to-attention balance'],
  },
  {
    id: 'focused',
    nameAr: 'الحلقة المركزة',
    nameEn: 'Focused Circle',
    price: 35,
    studentsAr: 'من 3 إلى 5 طلاب',
    studentsEn: '3–5 students',
    image: '/images/plans/men-focused.jpg',
    imageWomen: '/images/plans/women-focused.jpg',
    badgeAr: 'متابعة أقوى',
    badgeEn: 'More focus',
    tone: 'teal',
    durationAr: 'ساعة ونصف',
    durationEn: '90 minutes',
    featuresAr: ['مجموعة صغيرة', 'تصحيح وتوجيه أكثر', 'مناسبة للحفظ والمراجعة المكثفة'],
    featuresEn: ['Small group', 'More correction and coaching', 'Ideal for focused memorization'],
  },
  {
    id: 'mini',
    nameAr: 'الحلقة المصغرة',
    nameEn: 'Mini Circle',
    price: 50,
    studentsAr: 'من 2 إلى 3 طلاب',
    studentsEn: '2–3 students',
    image: '/images/plans/men-mini.jpg',
    imageWomen: '/images/plans/women-mini.jpg',
    badgeAr: 'شبه فردي',
    badgeEn: 'Semi-private',
    tone: 'gold',
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    featuresAr: ['اهتمام شبه فردي', 'وقت أكبر للتسميع', 'خطة متابعة أدق'],
    featuresEn: ['Near-private attention', 'More recitation time', 'More precise follow-up'],
  },
  {
    id: 'private',
    nameAr: 'الحصة الفردية',
    nameEn: 'Private Session',
    price: 100,
    studentsAr: 'طالب واحد',
    studentsEn: '1 student',
    image: '/images/plans/men-private.jpg',
    imageWomen: '/images/plans/women-private.jpg',
    badgeAr: 'أعلى متابعة',
    badgeEn: 'Maximum attention',
    tone: 'ink',
    from: true,
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    featuresAr: ['طالب واحد مع المعلم', 'خطة مخصصة بالكامل', 'أقصى مرونة وتركيز'],
    featuresEn: ['One learner with the tutor', 'Fully personalized plan', 'Maximum flexibility and focus'],
  },
];

const PLANS_COPY = {
  ar: {
    pageTitle: 'خطط الاشتراك | أكاديمية وحي ونماء',
    pageDesc: 'خطط مرنة لتعلّم القرآن تبدأ من 10 جنيه للحصة مع حلقات جماعية، مجموعات مركزة، وحصص فردية، وقسم سيدات مستقل.',
    home: 'الرئيسية',
    breadcrumb: 'خطط الاشتراك',
    kicker: 'خطط تناسب كل بيت',
    heroTitle: 'ابدأ رحلتك مع القرآن من 10 جنيه للحصة',
    heroDesc: 'كلما صغر حجم الحلقة زاد وقت المتابعة والتسميع لكل طالب. اختر المستوى الذي يناسب ميزانيتك واحتياجك.',
    proof1: 'معلمون ومعلمات معتمدون',
    proof2: 'حفظ وتجويد وتأسيس',
    proof3: 'مدة مرنة حسب نوع الخطة',
    startAt: 'تبدأ من',
    currencyLong: 'جنيه',
    currencyShort: 'ج',
    perSession: 'للحصة',
    sectionLabel: 'اختيار القسم',
    menTitle: 'قسم الرجال والأطفال',
    menDesc: 'رجال وأطفال حسب العمر والمستوى',
    womenTitle: 'قسم السيدات',
    womenDesc: 'معلمات متخصصات وبيئة مريحة',
    sessionsAria: 'عدد الحصص في الباقة',
    sessionsLabel: 'عدد الحصص',
    sessionsWord: 'حصص',
    sessionWordSingle: 'حصة',
    catalogKicker: '5 خطط واضحة',
    catalogTitle: 'كلما قل العدد، زادت المتابعة',
    catalogDesc: 'السعر المعروض هو سعر الطالب للحصة الواحدة. اختر 4 أو 8 أو 12 أو 24 حصة، وسيظهر إجمالي الباقة تلقائيًا.',
    durationLabel: 'مدة الحصة:',
    fromWord: 'من ',
    perSessionUnit: '/ الحصة',
    inPackage: 'في الباقة',
    saving: 'جاري الحفظ...',
    renewBtn: 'تجديد الباقة',
    chooseBtn: 'اختيار الخطة',
    compareTitle: 'جدول المقارنة السريع بين الخطط',
    compareDesc: 'مقارنة شاملة حسب عدد الطلاب ومدة الحصة والتكلفة الإجمالية للباقة المختارة.',
    colPlan: 'الخطة',
    colSize: 'عدد الطلاب',
    colDuration: 'مدة الحصة',
    colPerSession: 'سعر الحصة',
    colTotal: 'إجمالي',
    bottomKicker: 'لسه محتار؟',
    bottomTitle: 'ابدأ بالتجربة، وبعدها نرشح لك الخطة الأنسب',
    bottomBtn: 'اختيار معلم',
  },
  en: {
    pageTitle: 'Subscription Plans | Wahy Wa Namaa Academy',
    pageDesc: 'Flexible Quran learning plans starting from 10 EGP per session, with group, focused, private, and women-only learning options.',
    home: 'Home',
    breadcrumb: 'Plans & Pricing',
    kicker: 'Plans for every learner',
    heroTitle: 'Start your Quran journey from 10 EGP per session',
    heroDesc: 'Smaller circles give each learner more recitation and tutor attention. Choose the balance that fits your goals and budget.',
    proof1: 'Approved tutors',
    proof2: 'Hifz, Tajweed & foundation',
    proof3: 'Flexible duration by plan',
    startAt: 'Starting at',
    currencyLong: 'EGP',
    currencyShort: 'EGP',
    perSession: 'per session',
    sectionLabel: 'Choose section',
    menTitle: 'Men & children',
    menDesc: 'Men and children by age and level',
    womenTitle: 'Women’s section',
    womenDesc: 'Female tutors in a comfortable environment',
    sessionsAria: 'Sessions in package',
    sessionsLabel: 'Sessions',
    sessionsWord: 'sessions',
    sessionWordSingle: 'sessions',
    catalogKicker: '5 clear plans',
    catalogTitle: 'Fewer learners. More tutor attention.',
    catalogDesc: 'Prices are per learner, per session. Choose 4, 8, 12, or 24 sessions and the package total updates automatically.',
    durationLabel: 'Session duration:',
    fromWord: 'from ',
    perSessionUnit: '/ session',
    inPackage: 'in package',
    saving: 'Saving...',
    renewBtn: 'Renew package',
    chooseBtn: 'Choose plan',
    compareTitle: 'Quick Plan Comparison',
    compareDesc: 'Side-by-side comparison of group size, session duration, and package total.',
    colPlan: 'Plan',
    colSize: 'Group size',
    colDuration: 'Session duration',
    colPerSession: 'Per session',
    colTotal: 'Total',
    bottomKicker: 'Not sure yet?',
    bottomTitle: 'Start with a trial, then we recommend the best plan',
    bottomBtn: 'Choose a tutor',
  },
  fr: {
    pageTitle: 'Forfaits d’abonnement | Académie Wahy Wa Namaa',
    home: 'Accueil',
    breadcrumb: 'Forfaits & Tarifs',
    kicker: 'Des forfaits pour chaque foyer',
    heroTitle: 'Commencez votre parcours coranique dès 10 EGP par séance',
    heroDesc: 'Plus le cercle est restreint, plus chaque élève bénéficie d’écoute et d’attention personnalisée.',
    proof1: 'Enseignants certifiés',
    proof2: 'Hifz, Tajwid & Bases',
    proof3: 'Durée flexible selon le forfait',
    startAt: 'À partir de',
    perSession: 'par séance',
    sectionLabel: 'Choisir la section',
    menTitle: 'Section Hommes & Enfants',
    menDesc: 'Hommes et enfants selon l’âge et le niveau',
    womenTitle: 'Section Femmes',
    womenDesc: 'Enseignantes dédiées dans un cadre serein',
    sessionsLabel: 'Séances',
    sessionsWord: 'séances',
    sessionWordSingle: 'séances',
    saving: 'Enregistrement...',
    renewBtn: 'Renouveler le forfait',
    chooseBtn: 'Choisir ce forfait',
    bottomKicker: 'Vous hésitez encore ?',
    bottomTitle: 'Commencez par un essai, puis nous vous conseillons le meilleur forfait',
    bottomBtn: 'Choisir un enseignant',
  },
  de: {
    pageTitle: 'Abo-Pläne | Wahy Wa Namaa Akademie',
    home: 'Startseite',
    breadcrumb: 'Pläne & Preise',
    kicker: 'Pläne für jeden Lernenden',
    heroTitle: 'Starten Sie Ihre Koran-Reise ab 10 EGP pro Sitzung',
    heroDesc: 'Kleinere Lerngruppen bieten mehr Rezitationszeit und persönliche Betreuung.',
    proof1: 'Geprüfte Lehrkräfte',
    proof2: 'Hifz, Tadschwid & Grundlagen',
    proof3: 'Flexible Dauer je Plan',
    startAt: 'Ab',
    perSession: 'pro Sitzung',
    sectionLabel: 'Bereich wählen',
    menTitle: 'Bereich Männer & Kinder',
    menDesc: 'Männer und Kinder nach Alter und Niveau',
    womenTitle: 'Bereich Frauen',
    womenDesc: 'Weibliche Lehrkräfte in geschützter Umgebung',
    sessionsLabel: 'Sitzungen',
    sessionsWord: 'Sitzungen',
    sessionWordSingle: 'Sitzungen',
    saving: 'Speichern...',
    renewBtn: 'Paket verlängern',
    chooseBtn: 'Plan wählen',
    bottomKicker: 'Noch unsicher?',
    bottomTitle: 'Mit einer Probestunde starten und den besten Plan finden',
    bottomBtn: 'Lehrkraft wählen',
  },
  tr: {
    pageTitle: 'Abonelik Planları | Wahy Wa Namaa Akademisi',
    home: 'Ana Sayfa',
    breadcrumb: 'Planlar ve Fiyatlar',
    kicker: 'Herkese uygun planlar',
    heroTitle: 'Ders başına 10 EGP’den başlayan fiyatlarla Kur’an yolculuğunuza başlayın',
    heroDesc: 'Halka küçüldükçe her öğrenciye ayrılan dinleme ve takip süresi artar.',
    proof1: 'Onaylı eğitmenler',
    proof2: 'Hıfz, Tecvid ve Temel Eğitim',
    proof3: 'Plana göre esnek süre',
    startAt: 'Başlangıç',
    perSession: 'ders başı',
    sectionLabel: 'Bölüm seçin',
    menTitle: 'Erkekler ve Çocuklar Bölümü',
    menDesc: 'Yaş ve seviyeye göre erkekler ve çocuklar',
    womenTitle: 'Hanımlar Bölümü',
    womenDesc: 'Rahat bir ortamda kadın hocalar',
    sessionsLabel: 'Ders sayısı',
    sessionsWord: 'ders',
    sessionWordSingle: 'ders',
    saving: 'Kaydediliyor...',
    renewBtn: 'Paketi yenile',
    chooseBtn: 'Planı seç',
    bottomKicker: 'Hâlâ kararsız mısınız?',
    bottomTitle: 'Deneme dersiyle başlayın, size en uygun planı önerelim',
    bottomBtn: 'Eğitmen seç',
  },
  ur: {
    pageTitle: 'سبسکرپشن پلانز | وحی و نما اکیڈمی',
    home: 'صفحہ اول',
    breadcrumb: 'پلانز اور قیمتیں',
    kicker: 'ہر گھرانے کے لیے موزوں پلانز',
    heroTitle: 'فی سیشن 10 EGP سے اپنا قرآنی سفر شروع کریں',
    heroDesc: 'حلقہ جتنا چھوٹا ہوگا، ہر طالب علم کو اتنا ہی زیادہ وقت اور توجہ ملے گی۔',
    proof1: 'مستند معلمین و معلمات',
    proof2: 'حفظ، تجوید اور بنیاد',
    proof3: 'پلان کے مطابق لچکدار دورانیہ',
    startAt: 'ابتداء از',
    perSession: 'فی سیشن',
    sectionLabel: 'شعبہ منتخب کریں',
    menTitle: 'مرد و بچوں کا شعبہ',
    menDesc: 'عمر اور سطح کے مطابق مرد اور بچے',
    womenTitle: 'خواتین کا شعبہ',
    womenDesc: 'آرام دہ ماحول میں ماہر معلمات',
    sessionsLabel: 'سیشنز',
    sessionsWord: 'سیشنز',
    sessionWordSingle: 'سیشنز',
    saving: 'محفوظ ہو رہا ہے...',
    renewBtn: 'پیکج کی تجدید کریں',
    chooseBtn: 'پلان منتخب کریں',
    bottomKicker: 'ابھی فیصلہ نہیں کیا؟',
    bottomTitle: 'آزمائشی کلاس سے شروع کریں، پھر ہم بہترین پلان تجویز کریں گے',
    bottomBtn: 'استاد منتخب کریں',
  },
  id: {
    pageTitle: 'Paket Langganan | Akademi Wahy Wa Namaa',
    home: 'Beranda',
    breadcrumb: 'Paket & Harga',
    kicker: 'Paket untuk setiap pelajar',
    heroTitle: 'Mulai perjalanan Al-Qur’an dari 10 EGP per sesi',
    heroDesc: 'Semakin kecil kelompok, semakin banyak waktu setoran dan perhatian pengajar untuk setiap siswa.',
    proof1: 'Pengajar terverifikasi',
    proof2: 'Tahfidz, Tajwid & Dasar',
    proof3: 'Durasi fleksibel sesuai paket',
    startAt: 'Mulai dari',
    perSession: 'per sesi',
    sectionLabel: 'Pilih bagian',
    menTitle: 'Bagian Putra & Anak',
    menDesc: 'Putra dan anak sesuai usia dan level',
    womenTitle: 'Bagian Muslimah',
    womenDesc: 'Pengajar wanita di lingkungan nyaman',
    sessionsLabel: 'Jumlah sesi',
    sessionsWord: 'sesi',
    sessionWordSingle: 'sesi',
    saving: 'Menyimpan...',
    renewBtn: 'Perbarui paket',
    chooseBtn: 'Pilih paket',
    bottomKicker: 'Masih bingung?',
    bottomTitle: 'Mulai dengan kelas percobaan, lalu kami rekomendasikan paket terbaik',
    bottomBtn: 'Pilih pengajar',
  },
  ms: {
    pageTitle: 'Pelan Langganan | Akademi Wahy Wa Namaa',
    home: 'Utama',
    breadcrumb: 'Pelan & Harga',
    kicker: 'Pelan untuk setiap pelajar',
    heroTitle: 'Mulakan perjalanan Al-Quran daripada 10 EGP setiap sesi',
    heroDesc: 'Kumpulan yang lebih kecil memberi lebih masa bacaan dan perhatian guru kepada setiap pelajar.',
    proof1: 'Guru bertauliah',
    proof2: 'Hafazan, Tajwid & Asas',
    proof3: 'Tempoh fleksibel mengikut pelan',
    startAt: 'Bermula dari',
    perSession: 'setiap sesi',
    sectionLabel: 'Pilih bahagian',
    menTitle: 'Bahagian Lelaki & Kanak-Kanak',
    menDesc: 'Lelaki dan kanak-kanak mengikut umur dan tahap',
    womenTitle: 'Bahagian Wanita',
    womenDesc: 'Guru wanita dalam suasana selesa',
    sessionsLabel: 'Bilangan sesi',
    sessionsWord: 'sesi',
    sessionWordSingle: 'sesi',
    saving: 'Menyimpan...',
    renewBtn: 'Perbaharui pelan',
    chooseBtn: 'Pilih pelan',
    bottomKicker: 'Masih belum pasti?',
    bottomTitle: 'Mulakan dengan kelas percubaan, kemudian kami cadangkan pelan terbaik',
    bottomBtn: 'Pilih guru',
  },
  ku: {
    pageTitle: 'پلانەکانی بەشداریکردن | ئەکادیمیای وەحی و نەما',
    home: 'سەرەتا',
    breadcrumb: 'پلان و نرخەکان',
    kicker: 'پلان بۆ هەموو ماڵێک',
    heroTitle: 'گەشتە قورئانییەکەت لە 10 EGP بۆ هەر وانەیەک دەست پێبکە',
    heroDesc: 'تا ژمارەی فێرخوازان کەمتر بێت، کاتی گوێگرتن و بەدواداچوون بۆ هەر فێرخوازێک زیاتر دەبێت.',
    proof1: 'مامۆستایانی باوەڕپێکراو',
    proof2: 'لەبەرکردن، تەجوید و بنەما',
    proof3: 'ماوەی گونجاو بەپێی پلان',
    startAt: 'دەست پێدەکات لە',
    perSession: 'بۆ هەر وانەیەک',
    sectionLabel: 'هەڵبژاردنی بەش',
    menTitle: 'بەشی پیاوان و منداڵان',
    menDesc: 'پیاوان و منداڵان بەپێی تەمەن و ئاست',
    womenTitle: 'بەشی خانمان',
    womenDesc: 'مامۆستایانی ئافرەت و ژینگەیەکی ئارام',
    sessionsLabel: 'ژمارەی وانەکان',
    sessionsWord: 'وانە',
    sessionWordSingle: 'وانە',
    saving: 'پاشەکەوت دەکرێت...',
    renewBtn: 'نوێکردنەوەی پلان',
    chooseBtn: 'هەڵبژاردنی پلان',
    bottomKicker: 'هێشتا دوودڵیت؟',
    bottomTitle: 'بە تاقیکردنەوە دەست پێبکە، پاشان باشترین پلانت بۆ پێشنیار دەکەین',
    bottomBtn: 'هەڵبژاردنی مامۆستا',
  },
};

export default function PlansPage() {
  const { locale, isRTL, dir } = useI18n();
  const baseCopy = isRTL ? PLANS_COPY.ar : PLANS_COPY.en;
  const copy = { ...baseCopy, ...(PLANS_COPY[locale] || {}) };
  const { user, isAuthenticated, isLoading } = useAuth();
  const { createOfferCatalogSchema, createBreadcrumbSchema } = useSEO();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const renewalId = searchParams.get('renew') || '';
  const targetStudentId = searchParams.get('student') || '';
  const requestedPlanId = searchParams.get('plan') || '';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [audience, setAudience] = useState(() => (
    searchParams.get('section') === 'women' || searchParams.get('section') === 'ladies' ? 'women' : 'general'
  ));
  const enrolledSection = user?.role === 'student' && ['men_children', 'ladies'].includes(user?.enrollmentSection)
    ? user.enrollmentSection : null;
  const [sessionCount, setSessionCount] = useState(() => {
    const requestedSessions = Number(searchParams.get('sessions'));
    return [4, 8, 12, 24].includes(requestedSessions) ? requestedSessions : 8;
  });
  const [catalog, setCatalog] = useState(null);
  const [selection, setSelection] = useState(null);
  const [selectingPlan, setSelectingPlan] = useState('');
  const [renewalSource, setRenewalSource] = useState(null);
  const generalTabRef = useRef(null);
  const womenTabRef = useRef(null);

  useEffect(() => {
    if (!renewalId && enrolledSection) setTimeout(() => setAudience(enrolledSection === 'ladies' ? 'women' : 'general'), 0);
  }, [enrolledSection, renewalId]);

  useEffect(() => {
    let cancelled = false;

    api.get('/api/subscriptions/plans')
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        // Keep the embedded catalog as a resilient display fallback.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!renewalId || !isAuthenticated || !['student', 'guardian'].includes(user?.role)) return;

    let cancelled = false;
    api.get('/api/subscriptions/' + encodeURIComponent(renewalId), { auth: true })
      .then((data) => {
        if (cancelled || !data?.subscription) return;
        const source = data.subscription;
        setRenewalSource(source);
        setSessionCount(Number(source.sessionCount || 8));
        setAudience(source.section === 'ladies' ? 'women' : 'general');
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || (isRTL ? 'تعذر تحميل بيانات التجديد.' : 'Could not load renewal details.'));
      });

    return () => {
      cancelled = true;
    };
  }, [renewalId, isAuthenticated, user?.role, toast, isRTL]);

  const serverPlans = useMemo(
    () => new Map((catalog?.plans || []).map((plan) => [plan.key, plan])),
    [catalog]
  );

  const packageOptions = Array.isArray(catalog?.sessionPacks) && catalog.sessionPacks.length
    ? catalog.sessionPacks
    : [4, 8, 12, 24];

  const plans = useMemo(() => PLAN_DEFS.map((plan) => {
    const serverPlan = serverPlans.get(plan.id);
    const price = serverPlan ? serverPlan.pricePerSessionMinor / 100 : plan.price;
    const minStudents = serverPlan?.minStudents;
    const maxStudents = serverPlan?.maxStudents;

    return {
      ...plan,
      price,
      studentsAr: minStudents && maxStudents
        ? (minStudents === maxStudents ? `${minStudents === 1 ? 'طالب واحد' : minStudents + ' طلاب'}` : `من ${minStudents} إلى ${maxStudents} طالب`)
        : plan.studentsAr,
      studentsEn: minStudents && maxStudents
        ? (minStudents === maxStudents ? `${minStudents} student` : `${minStudents}–${maxStudents} students`)
        : plan.studentsEn,
      durationAr: serverPlan?.durationLabel?.ar || plan.durationAr,
      durationEn: serverPlan?.durationLabel?.en || plan.durationEn,
      packageTotal: price * sessionCount,
    };
  }), [serverPlans, sessionCount]);

  const visiblePlans = renewalSource
    ? plans.filter((plan) => plan.id === renewalSource.planKey)
    : plans;

  const handleSegmentKeyDown = (e) => {
    if (renewalSource || enrolledSection) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const next = audience === 'general' ? 'women' : 'general';
      setAudience(next);
      (next === 'women' ? womenTabRef.current : generalTabRef.current)?.focus();
    }
  };

  const handlePlanSelect = async (plan) => {
    if (isLoading || selectingPlan) return;

    if (!isAuthenticated) {
      const returnTo = (location.pathname || localizedPath('/plans', locale)) + (location.search || '');
      navigate(localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(returnTo));
      return;
    }

    if (user?.role !== 'student' && !(user?.role === 'guardian' && (targetStudentId || renewalId))) {
      toast.warning(isRTL ? 'اختيار باقات الطلاب متاح من حساب الطالب.' : 'Student packages can only be selected from a student account.');
      return;
    }

    setSelectingPlan(plan.id);
    try {
      const data = renewalSource
        ? await api.post(
            '/api/subscriptions/' + encodeURIComponent(renewalSource._id) + '/renew',
            { sessionCount },
            { auth: true }
          )
        : await api.post('/api/subscriptions/select', {
            planKey: plan.id,
            studentId: targetStudentId || undefined,
            section: enrolledSection || (audience === 'women' ? 'ladies' : 'men_children'),
            sessionCount,
          }, { auth: true });

      setSelection(data.subscription || null);
      toast.success(
        renewalSource
          ? (isRTL
              ? 'تم إنشاء التجديد بنفس المعلم والجروب. أكمل التحويل.'
              : 'Renewal created for the same tutor and group. Complete the transfer.')
          : (isRTL
              ? 'تم حفظ اختيارك. اختر الشيخ ثم ارفع إثبات التحويل.'
              : 'Your selection is saved. Choose your tutor, then upload the transfer proof.')
      );

      if (data.subscription?._id) {
        navigate(
          localizedPath('/payment/manual', locale)
          + '?subscription='
          + encodeURIComponent(data.subscription._id)
          + (targetStudentId ? '&student=' + encodeURIComponent(targetStudentId) : '')
        );
      }
    } catch (error) {
      toast.error(error.message || (isRTL ? 'تعذر حفظ اختيار الباقة.' : 'Could not save the package selection.'));
    } finally {
      setSelectingPlan('');
    }
  };

  const plansSchemas = [
    createOfferCatalogSchema({
      name: copy.pageTitle,
      description: copy.pageDesc,
      url: '/plans',
      offers: PLAN_DEFS.map((plan) => ({
        name: isRTL ? plan.nameAr : plan.nameEn,
        description: [
          isRTL ? plan.studentsAr : plan.studentsEn,
          isRTL ? plan.durationAr : plan.durationEn,
          ...((isRTL ? plan.featuresAr : plan.featuresEn) || []),
        ]
          .filter(Boolean)
          .join(' • '),
        price: plan.price,
        currency: 'EGP',
      })),
    }),
    createBreadcrumbSchema([
      { name: copy.home, url: '/' },
      { name: copy.breadcrumb, url: '/plans' },
    ]),
  ];

  return (
    <>
      <SEOHead
        page={{
          title: copy.pageTitle,
          description: copy.pageDesc,
          url: '/plans',
          type: 'website',
          schema: plansSchemas,
        }}
      />
      <GlobalHeader />

      <main className="wn-plans-page" dir={dir}>
        <section className="wn-plans-hero">
          <div className="wn-plans-hero__glow" aria-hidden="true" />
          <div className="wn-plans-container wn-plans-hero__grid">
            <div className="wn-plans-hero__copy">
              <span className="wn-plans-kicker"><Sparkles size={16} aria-hidden="true" /> {copy.kicker}</span>
              <h1>{copy.heroTitle}</h1>
              <p>{copy.heroDesc}</p>
              <div className="wn-plans-hero__proof">
                <span><ShieldCheck size={18} aria-hidden="true" /> {copy.proof1}</span>
                <span><BookOpenCheck size={18} aria-hidden="true" /> {copy.proof2}</span>
                <span><Clock3 size={18} aria-hidden="true" /> {copy.proof3}</span>
              </div>
            </div>

            <div className="wn-plans-hero__visual">
              <img
                src={audience === 'women' ? '/images/plans/women-group.jpg' : '/images/plans/men-group.jpg'}
                decoding="async"
                alt={isRTL
                  ? (audience === 'women' ? 'حلقة قرآن لقسم السيدات' : 'طلاب في حلقة قرآن جماعية')
                  : (audience === 'women' ? 'Women Quran learning circle' : 'Students in a group Quran circle')}
              />
              <div className="wn-plans-hero__price">
                <small>{copy.startAt}</small>
                <strong>10 <em>{copy.currencyLong}</em></strong>
                <span>{copy.perSession}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="wn-plans-control-shell">
          <div className="wn-plans-container">
            <div className="wn-plans-controls">
              <div
                className="wn-plans-segment"
                role="tablist"
                aria-label={copy.sectionLabel}
                onKeyDown={handleSegmentKeyDown}
              >
                <button
                  ref={generalTabRef}
                  id="plans-tab-general"
                  type="button"
                  role="tab"
                  aria-selected={audience === 'general'}
                  aria-controls="plans-catalog-panel"
                  tabIndex={audience === 'general' ? 0 : -1}
                  className={audience === 'general' ? 'is-active' : ''}
                  disabled={Boolean(renewalSource) || enrolledSection === 'ladies'}
                  onClick={() => !renewalSource && !enrolledSection && setAudience('general')}
                >
                  <Users size={18} aria-hidden="true" />
                  <span>
                    <strong>{isRTL ? 'قسم الرجال والأطفال' : copy.menTitle}</strong>
                    <small>{copy.menDesc}</small>
                  </span>
                </button>
                <button
                  ref={womenTabRef}
                  id="plans-tab-women"
                  type="button"
                  role="tab"
                  aria-selected={audience === 'women'}
                  aria-controls="plans-catalog-panel"
                  tabIndex={audience === 'women' ? 0 : -1}
                  className={audience === 'women' ? 'is-active is-women' : 'is-women'}
                  disabled={Boolean(renewalSource) || enrolledSection === 'men_children'}
                  onClick={() => !renewalSource && !enrolledSection && setAudience('women')}
                >
                  <Heart size={18} aria-hidden="true" />
                  <span>
                    <strong>{isRTL ? 'قسم السيدات' : copy.womenTitle}</strong>
                    <small>{copy.womenDesc}</small>
                  </span>
                </button>
              </div>

              <div className="wn-plans-frequency" role="group" aria-label={copy.sessionsAria}>
                <span>{copy.sessionsLabel}</span>
                {packageOptions.map((count) => (
                  <button
                    type="button"
                    key={count}
                    aria-pressed={sessionCount === count}
                    className={sessionCount === count ? 'is-active' : ''}
                    onClick={() => setSessionCount(count)}
                  >
                    {count} {count === 12 ? copy.sessionWordSingle : copy.sessionsWord}
                  </button>
                ))}
              </div>
            </div>

            {renewalSource && (
              <aside className="wn-plans-selection" role="status">
                <BadgeCheck size={22} aria-hidden="true" />
                <div>
                  <strong>{isRTL ? 'تجديد سريع لنفس الحلقة' : 'Fast renewal for the same circle'}</strong>
                  <p>
                    {isRTL
                      ? 'الخطة والمعلم والجروب ثابتون. اختر فقط عدد الحصص الجديدة ثم أكمل التحويل.'
                      : 'Plan, tutor, and group stay the same. Choose only the new session count, then complete the transfer.'}
                  </p>
                </div>
              </aside>
            )}

            {selection && (
              <aside className="wn-plans-selection" role="status">
                <BadgeCheck size={22} aria-hidden="true" />
                <div>
                  <strong>{isRTL ? 'تم حفظ اختيار الباقة' : 'Package selection saved'}</strong>
                  <p>
                    {isRTL
                      ? `${selection.sessionCount} حصة · الإجمالي ${selection.totalAmountMinor / 100} جنيه · لم يتم الدفع بعد`
                      : `${selection.sessionCount} sessions · total ${selection.totalAmountMinor / 100} EGP · payment not completed`}
                  </p>
                </div>
              </aside>
            )}

            {audience === 'women' && (
              <aside className="wn-plans-women-banner">
                <div className="wn-plans-women-banner__icon"><Heart size={24} aria-hidden="true" /></div>
                <div>
                  <span>{isRTL ? 'قسم السيدات' : copy.womenTitle}</span>
                  <h2>{isRTL ? 'نفس الخطط والأسعار — مع معلمات فقط' : 'Same plans and pricing — female tutors only'}</h2>
                  <p>{isRTL ? 'يتم توزيع الطالبات حسب السن والمستوى، مع الحفاظ على الخصوصية وجودة المتابعة.' : 'Learners are grouped by age and level with privacy and consistent academic follow-up.'}</p>
                </div>
                <img src="/images/plans/women-mini.jpg" alt="" aria-hidden="true" loading="lazy" decoding="async" />
              </aside>
            )}
          </div>
        </section>

        <section
          id="plans-catalog-panel"
          role="tabpanel"
          aria-labelledby={audience === 'women' ? 'plans-tab-women' : 'plans-tab-general'}
          className="wn-plans-catalog"
        >
          <div className="wn-plans-container">
            <div className="wn-plans-heading">
              <span>{copy.catalogKicker}</span>
              <h2>{copy.catalogTitle}</h2>
              <p>{copy.catalogDesc}</p>
            </div>

            <div className="wn-plans-grid">
              {visiblePlans.map((plan) => (
                <article
                  key={plan.id}
                  id={'plan-' + plan.id}
                  className={
                    'wn-plan-card is-' + plan.tone
                    + (plan.featured ? ' is-featured' : '')
                    + (requestedPlanId === plan.id ? ' ring-2 ring-[var(--wn-emerald)]' : '')
                  }
                >
                  <div className="wn-plan-card__media">
                    <img
                      src={audience === 'women' ? plan.imageWomen : plan.image}
                      alt={isRTL ? plan.nameAr : plan.nameEn}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="wn-plan-card__badge">{isRTL ? plan.badgeAr : plan.badgeEn}</span>
                  </div>

                  <div className="wn-plan-card__body">
                    <div className="wn-plan-card__title">
                      <div>
                        <span>{isRTL ? plan.studentsAr : plan.studentsEn}</span>
                        <h3>{isRTL ? plan.nameAr : plan.nameEn}</h3>
                      </div>
                      {plan.featured ? <Crown size={22} aria-hidden="true" /> : <BadgeCheck size={21} aria-hidden="true" />}
                    </div>

                    <div className="wn-plan-card__duration">
                      <Clock3 size={15} aria-hidden="true" />
                      <span>{copy.durationLabel}</span>
                      <strong>{isRTL ? plan.durationAr : plan.durationEn}</strong>
                    </div>

                    <div className="wn-plan-card__price">
                      <span>{plan.from ? copy.fromWord : ''}</span>
                      <strong>{plan.price}</strong>
                      <div>
                        <b>{copy.currencyLong}</b>
                        <small>{copy.perSessionUnit}</small>
                      </div>
                    </div>

                    <div className="wn-plan-card__monthly">
                      <span>{sessionCount} {sessionCount === 12 ? copy.sessionWordSingle : copy.sessionsWord} {copy.inPackage}</span>
                      <strong>{plan.from ? copy.fromWord : ''}{plan.packageTotal} {copy.currencyShort}</strong>
                    </div>

                    <ul>
                      {(isRTL ? plan.featuresAr : plan.featuresEn).map((feature) => (
                        <li key={feature}><Check size={15} aria-hidden="true" /> {feature}</li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="wn-plan-card__cta"
                      onClick={() => handlePlanSelect(plan)}
                      disabled={Boolean(selectingPlan)}
                      aria-busy={selectingPlan === plan.id}
                    >
                      {selectingPlan === plan.id ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                          <span>{copy.saving}</span>
                        </>
                      ) : (
                        <>
                          <span>{renewalSource ? copy.renewBtn : copy.chooseBtn}</span>
                          <ArrowIcon size={17} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {visiblePlans.length > 1 && (
              <div className="wn-plans-compare">
                <div className="wn-plans-compare__header">
                  <h3>{copy.compareTitle}</h3>
                  <p>{copy.compareDesc}</p>
                </div>
                <div className="wn-plans-compare__scroll">
                  <table className="wn-plans-compare__table">
                    <thead>
                      <tr>
                        <th>{copy.colPlan}</th>
                        <th>{copy.colSize}</th>
                        <th>{copy.colDuration}</th>
                        <th>{copy.colPerSession}</th>
                        <th>{`${copy.colTotal} (${sessionCount} ${sessionCount === 12 ? copy.sessionWordSingle : copy.sessionsWord})`}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlans.map((plan) => (
                        <tr key={plan.id} className={plan.featured ? 'is-featured' : ''}>
                          <td>
                            <div className="wn-plans-compare__plan-name">
                              <span>{isRTL ? plan.nameAr : plan.nameEn}</span>
                              <span className="wn-plans-compare__tag">{isRTL ? plan.badgeAr : plan.badgeEn}</span>
                            </div>
                          </td>
                          <td>{isRTL ? plan.studentsAr : plan.studentsEn}</td>
                          <td>{isRTL ? plan.durationAr : plan.durationEn}</td>
                          <td><strong>{plan.from ? copy.fromWord : ''}{plan.price} {copy.currencyShort}</strong></td>
                          <td><strong>{plan.from ? copy.fromWord : ''}{plan.packageTotal} {copy.currencyShort}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="wn-plans-note">
              <UserRound size={21} aria-hidden="true" />
              <div>
                <strong>{isRTL ? 'التسكين حسب المستوى والعمر' : 'Placement by level and age'}</strong>
                <p>{isRTL ? 'بعد الحصة التجريبية نرشح الحلقة الأنسب للطالب. الحلقة الاقتصادية 10 جنيه تبدأ عند اكتمال الحد الأدنى المناسب للتشغيل.' : 'After the trial, we recommend the best-fit circle. The 10 EGP community plan starts once the minimum viable group is formed.'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="wn-plans-bottom-cta">
          <div className="wn-plans-container">
            <div>
              <span>{copy.bottomKicker}</span>
              <h2>{copy.bottomTitle}</h2>
            </div>
            <LocalizedLink to="/teachers" locale={locale} className="wn-plans-bottom-cta__button">
              {copy.bottomBtn}
              <ArrowIcon size={18} aria-hidden="true" />
            </LocalizedLink>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
