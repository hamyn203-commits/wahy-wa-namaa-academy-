import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpenCheck, Check, Clock3,
  Crown, Globe, Heart, ShieldCheck, Sparkles, Users, UserRound, Video, X
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
import {
  currencyLabelsFor,
  formatLocalEquivalent,
  formatMajorNumber,
  formatRegionalMoney,
  usdLocalEquivalentNote,
} from '../../lib/regionalPricing';
import './plans.css';

const LIVE_ONLINE_LABEL = {
  ar: 'مباشر أونلاين',
  en: 'Live Online',
  fr: 'En direct en ligne',
  de: 'Live online',
  tr: 'Canlı Çevrimiçi',
  ur: 'لائیو آن لائن',
  id: 'Online Langsung',
  ms: 'Dalam Talian Langsung',
  ku: 'ڕاستەوخۆ ئۆنلاین',
};

const PROGRAM_CONTEXT = {
  kids: {
    recommendedPlan: 'private',
    titleAr: 'تحفيظ القرآن وتأسيس الأطفال',
    titleEn: 'Quran Memorization & Kids Foundation',
    noteAr: 'رشّحنا لك «الباقة الفردية المركّزة (30 دقيقة)» لأنها أنسب لتركيز الطفل وتبدأ فوراً، ويمكنك اختيار حلقة الإخوة (2–3 طلاب) أو الحلقة الجماعية المركّزة (3–5 طلاب) بحرية.',
    noteEn: 'We highlighted the 30-minute Private 1-on-1 Plan for focused child attention and immediate start — or choose Siblings/Dual or Focused Group below.',
  },
  hifz: {
    recommendedPlan: 'private',
    titleAr: 'الحفظ والمراجعة المتقنة',
    titleEn: 'Mastered Hifz & Revision',
    noteAr: 'رشّحنا لك «الباقة الفردية المركّزة (1-on-1)» لبداية فورية وتسميع متقن، كما يمكنك اختيار الحلقة الجماعية المركّزة (3–5 طلاب) أو الفردية المكثّفة (60 دقيقة).',
    noteEn: 'We highlighted the Focused Private 1-on-1 Plan for immediate start and dedicated revision — or choose any other plan below.',
  },
  tajweed: {
    recommendedPlan: 'private',
    titleAr: 'تصحيح التلاوة والتجويد',
    titleEn: 'Recitation Correction & Tajweed',
    noteAr: 'رشّحنا لك «الباقة الفردية المركّزة (1-on-1)» لتصحيح المخارج وأحكام التجويد عملياً مع المعلم بدقة أكبر، أو اختر الفردية المكثّفة (60 دقيقة).',
    noteEn: 'We highlighted the Private 1-on-1 Plan for thorough live articulation and Tajweed coaching.',
  },
  understanding: {
    recommendedPlan: 'focused',
    titleAr: 'الفهم والتدبر واللسان العربي',
    titleEn: 'Understanding, Tadabbur & Arabic',
    noteAr: 'رشّحنا لك «الحلقة الجماعية المركّزة (3–5 طلاب)» لتبادل التدبر وبناء الصلة بالمعاني القرآنية بتكلفة اقتصادية مدروسة.',
    noteEn: 'We highlighted the Focused Group Circle (3–5 learners) for engaging reflection and Arabic fluency.',
  },
  ijazah: {
    recommendedPlan: 'private_intensive',
    titleAr: 'الإجازة والسند المتصل',
    titleEn: 'Ijazah & Connected Sanad',
    noteAr: 'رشّحنا لك «الفردية المكثّفة والإجازة (60 دقيقة)» لتفرّغ الشيخ أو المعلمة المجازة بالكامل لعرض ختمتك بالضبط والإتقان.',
    noteEn: 'We highlighted the 60-minute Intensive Private & Ijazah Plan for dedicated Sanad recitation with a certified scholar.',
  },
};

const PLAN_DEFS = [
  {
    id: 'focused',
    nameAr: 'الحلقة الجماعية المركّزة',
    nameEn: 'Focused Group Circle',
    price: 19,
    anchorPrice: 25,
    packPricesMinorEg: { 8: 2500, 12: 2000, 24: 1900 },
    allowedSessionPacks: [8, 12, 24],
    studentsAr: 'من 3 إلى 5 طلاب',
    studentsEn: '3–5 students',
    image: '/images/plans/men-focused.jpg?v=2',
    imageWomen: '/images/plans/women-focused.jpg?v=2',
    badgeAr: 'تبدأ من 19 ج • 3–5 طلاب',
    badgeEn: 'Focused • 3–5 learners',
    tone: 'mint',
    durationAr: '45 دقيقة',
    durationEn: '45 minutes',
    featuresAr: [
      'مجموعة صغيرة مركّزة من 3 إلى 5 طلاب فقط',
      'مدة ثابتة 45 دقيقة تضمن تسميعاً وافراً لكل طالب',
      'خصم باقات يصل إلى 24% (19 ج لباقة 24 حصة و20 ج لـ 12 حصة)',
    ],
    featuresEn: [
      'Small focused circle of only 3 to 5 learners',
      'Fixed 45-minute live session with generous recitation time',
      'Progressive pack savings on 12 & 24 monthly sessions',
    ],
  },
  {
    id: 'mini',
    nameAr: 'حلقة الإخوة والثنائية',
    nameEn: 'Siblings & Dual Circle',
    price: 35,
    anchorPrice: 45,
    packPricesMinorEg: { 8: 4500, 12: 3900, 24: 3500 },
    allowedSessionPacks: [8, 12, 24],
    studentsAr: 'من 2 إلى 3 طلاب (إخوة أو ثنائي)',
    studentsEn: '2–3 students (siblings or dual)',
    image: '/images/plans/men-mini.jpg?v=2',
    imageWomen: '/images/plans/women-mini.jpg?v=2',
    badgeAr: 'مثالية للإخوة • بدون انتظار',
    badgeEn: 'Siblings & Dual • Fast start',
    tone: 'gold',
    durationAr: '45 دقيقة',
    durationEn: '45 minutes',
    featuresAr: [
      'مثالية لأخوين أو 3 إخوة في حلقة عائلية واحدة',
      'تبدأ فوراً للإخوة بدون انتظار اكتمال مجموعة',
      'اهتمام شبه فردي 45 دقيقة وتوفير حتى 22% للباقات الأكبر',
    ],
    featuresEn: [
      'Ideal for 2 or 3 siblings together with one tutor',
      'Starts immediately for siblings with zero waiting',
      'Near-individual coaching • 45 minutes per session',
    ],
  },
  {
    id: 'private',
    nameAr: 'الباقة الفردية المركّزة (1-on-1)',
    nameEn: 'Focused Private 1-on-1',
    price: 60,
    anchorPrice: 85,
    packPricesMinorEg: { 4: 8500, 8: 7500, 12: 6900, 24: 6000 },
    allowedSessionPacks: [4, 8, 12, 24],
    studentsAr: 'طالب واحد فقط (1-on-1)',
    studentsEn: '1 student (1-on-1)',
    image: '/images/plans/men-private.jpg?v=2',
    imageWomen: '/images/plans/women-private.jpg?v=2',
    badgeAr: 'الأكثر طلبًا • يبدأ فوراً',
    badgeEn: 'Most popular • Instant start',
    tone: 'emerald',
    featured: true,
    durationAr: '30 دقيقة',
    durationEn: '30 minutes',
    featuresAr: [
      'معلم أو معلمة مخصصة للطالب وحده (1-on-1)',
      'بداية فورية ومرونة كاملة في اختيار المواعيد',
      '30 دقيقة مركّزة مع توفير يصل إلى 29% على الباقات الكبيرة',
    ],
    featuresEn: [
      'Dedicated 1-on-1 tutor with undivided attention',
      'Immediate start & flexible personal scheduling',
      'Focused 30-minute session with up to 38% pack savings',
    ],
  },
  {
    id: 'private_intensive',
    nameAr: 'الفردية المكثّفة والإجازة (1-on-1)',
    nameEn: 'Intensive Private & Ijazah',
    price: 110,
    anchorPrice: 150,
    packPricesMinorEg: { 4: 15000, 8: 13500, 12: 12500, 24: 11000 },
    allowedSessionPacks: [4, 8, 12, 24],
    studentsAr: 'طالب واحد • ختم وإجازة',
    studentsEn: '1 student • Intensive & Ijazah',
    image: '/images/programs/program-ijazah.jpg',
    imageWomen: '/images/plans/women-private.jpg?v=2',
    badgeAr: 'ساعة كاملة • إتقان وسند',
    badgeEn: 'Full 60 min • Mastery & Sanad',
    tone: 'ink',
    durationAr: '60 دقيقة',
    durationEn: '60 minutes',
    featuresAr: [
      'ساعة كاملة فردية خالصة (60 دقيقة 1-on-1)',
      'مخصصة للختم والمراجعة الكبيرة والإجازة بالسند',
      'خطة فردية مخصصة مع كبار المعلمين وتوفير حتى 27%',
    ],
    featuresEn: [
      'Full 60-minute 1-on-1 private session',
      'Designed for intensive revision, Khatmah & Sanad Ijazah',
      'Personalized curriculum with certified scholars',
    ],
  },
];

// Used strictly when an existing subscriber opens ?renew=<id> for a legacy plan.
const LEGACY_RENEWAL_DEFS = {
  community: {
    id: 'community',
    nameAr: 'الحلقة الاقتصادية الكبرى',
    nameEn: 'Community Circle',
    price: 10,
    allowedSessionPacks: [4, 8, 12, 24],
    studentsAr: 'حلقة جماعية قائمة',
    studentsEn: 'Existing community circle',
    image: '/images/plans/men-community.jpg?v=2',
    imageWomen: '/images/plans/women-community.jpg?v=2',
    badgeAr: 'تجديد باقة قائمة',
    badgeEn: 'Legacy renewal',
    tone: 'mint',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['تجديد لنفس الحلقة والمعلم الحالي'],
    featuresEn: ['Renewal for your current circle and tutor'],
  },
  group: {
    id: 'group',
    nameAr: 'الحلقة الجماعية',
    nameEn: 'Group Circle',
    price: 20,
    allowedSessionPacks: [4, 8, 12, 24],
    studentsAr: 'حلقة جماعية قائمة',
    studentsEn: 'Existing group circle',
    image: '/images/plans/men-group.jpg?v=2',
    imageWomen: '/images/plans/women-group.jpg?v=2',
    badgeAr: 'تجديد باقة قائمة',
    badgeEn: 'Legacy renewal',
    tone: 'emerald',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['تجديد لنفس الحلقة والمعلم الحالي'],
    featuresEn: ['Renewal for your current circle and tutor'],
  },
};

const PLANS_COPY = {
  ar: {
    pageTitle: 'خطط الاشتراك والأسعار | أكاديمية وحي ونماء',
    pageDesc: 'باقات فردية خاصة (30 و60 دقيقة)، حلقات إخوة وثنائية، وحلقات جماعية مركّزة (3–5 طلاب) تبدأ من 19 جنيه للحصة مع خصم باقات يصل إلى 29%.',
    home: 'الرئيسية',
    breadcrumb: 'خطط الاشتراك',
    kicker: 'باقات مدروسة تبدأ معك فوراً',
    heroTitle: 'ابدأ رحلتك القرآنية بحلقات مركّزة وحصص فردية متقنة',
    heroDesc: 'اختر بين الخصوصية الفردية الكاملة (1-on-1)، أو حلقة الإخوة العائلية، أو المجموعة المركّزة الصغيرة (3 إلى 5 طلاب فقط).',
    proof1: 'معلمون ومعلمات معتمدون',
    proof2: 'تبدأ الفردية والإخوة فوراً بدون انتظار',
    proof3: 'مدة حصة ثابتة ومحددة بدقة',
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
    sessionsLabel: 'عدد الحصص شهرياً',
    sessionsWord: 'حصص',
    sessionWordSingle: 'حصة',
    catalogKicker: '4 باقات واضحة ومتوازنة',
    catalogTitle: 'اختر مستوى الخصوصية والمدة الأنسب لك أو لطفلك',
    catalogDesc: 'الحصص الفردية وحلقات الإخوة تبدأ فوراً. الحلقات الجماعية المركّزة (3–5 طلاب) متاحة باشتراك 8 أو 12 أو 24 حصة لضمان الاستقرار.',
    durationLabel: 'مدة الحصة:',
    fromWord: 'من ',
    perSessionUnit: '/ الحصة',
    inPackage: 'في الباقة',
    saving: 'جاري الحفظ...',
    renewBtn: 'تجديد الباقة',
    chooseBtn: 'اختيار الخطة',
    compareTitle: 'جدول المقارنة السريع بين الباقات',
    compareDesc: 'مقارنة شاملة حسب عدد الطلاب ومدة الحصة والتكلفة الإجمالية للباقة المختارة.',
    colPlan: 'الباقة',
    colSize: 'عدد الطلاب',
    colDuration: 'مدة الحصة',
    colPerSession: 'سعر الحصة',
    colTotal: 'إجمالي الباقة',
    bottomKicker: 'لسه محتار؟',
    bottomTitle: 'ابدأ بحصة تجريبية مجانية، وبعدها نرشح لك الباقة الأنسب',
    bottomBtn: 'اختيار معلم',
  },
  en: {
    pageTitle: 'Subscription Plans & Pricing | Wahy Wa Namaa Academy',
    pageDesc: 'Private 1-on-1 Quran sessions (30 & 60 min), Siblings/Dual circles (2–3 learners), and Focused Group circles (3–5 learners).',
    home: 'Home',
    breadcrumb: 'Plans & Pricing',
    kicker: 'Clear plans built for real progress',
    heroTitle: 'Focused 1-on-1 & small-circle Quran plans',
    heroDesc: 'Choose dedicated 1-on-1 private coaching, an immediate siblings circle, or a small focused circle of 3 to 5 learners.',
    proof1: 'Approved certified tutors',
    proof2: 'Instant start on private & sibling plans',
    proof3: 'Fixed, transparent session durations',
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
    sessionsLabel: 'Monthly sessions',
    sessionsWord: 'sessions',
    sessionWordSingle: 'sessions',
    catalogKicker: '4 clear plans',
    catalogTitle: 'More focus, faster progress, zero overcrowded rooms',
    catalogDesc: 'Private 1-on-1 plans offer 4, 8, 12, or 24 sessions. Focused group (3–5) and dual/siblings (2–3) circles use 8, 12, or 24 sessions.',
    durationLabel: 'Session duration:',
    fromWord: 'from ',
    perSessionUnit: '/ session',
    inPackage: 'in package',
    saving: 'Saving...',
    renewBtn: 'Renew package',
    chooseBtn: 'Choose plan',
    compareTitle: 'Quick Plan Comparison',
    compareDesc: 'Compare group size, fixed session duration, and package total.',
    colPlan: 'Plan',
    colSize: 'Learners',
    colDuration: 'Duration',
    colPerSession: 'Per session',
    colTotal: 'Package total',
    bottomKicker: 'Not sure yet?',
    bottomTitle: 'Start with a free trial, then we recommend the best plan',
    bottomBtn: 'Choose a tutor',
  },
  fr: {
    pageTitle: 'Forfaits d’abonnement | Académie Wahy Wa Namaa',
    home: 'Accueil',
    breadcrumb: 'Forfaits & Tarifs',
    kicker: 'Des forfaits clairs pour chaque foyer',
    heroDesc: 'Cours particuliers 1-on-1 (30 ou 60 min), formule fratrie (2–3 élèves) ou petit cercle concentré (3–5 élèves).',
    proof1: 'Enseignants certifiés',
    proof2: 'Hifz, Tajwid & Ijazah',
    proof3: 'Durée fixe et transparente',
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
    kicker: 'Klare Pläne für nachhaltigen Lernerfolg',
    heroDesc: '1-zu-1 Einzelunterricht (30 oder 60 Min.), Geschwistergruppe (2–3) oder Fokusgruppe (3–5 Lernende).',
    proof1: 'Zertifizierte Lehrkräfte',
    proof2: 'Hifz, Tadschwid & Idschaza',
    proof3: 'Feste Unterrichtsdauer',
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
    kicker: 'Her öğrenciye uygun net planlar',
    heroDesc: 'Birebir özel ders (30/60 dk), kardeş halkası (2–3 kişi) veya odaklı küçük grup (3–5 öğrenci).',
    proof1: 'Onaylı eğitmenler',
    proof2: 'Hıfz, Tecvid ve İcazet',
    proof3: 'Sabit ve net ders süresi',
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
    heroDesc: 'انفرادی 1-on-1 کلاسز (30 یا 60 منٹ)، بہن بھائیوں کا حلقہ (2–3 طلبہ)، یا مختصر گروپ (3–5 طلبہ)۔',
    proof1: 'مستند معلمین و معلمات',
    proof2: 'حفظ، تجوید اور اجازہ',
    proof3: 'مقررہ اور واضح دورانیہ',
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
    kicker: 'Paket terarah untuk setiap pelajar',
    heroDesc: 'Kelas privat 1-on-1 (30/60 menit), kelas kakak-adik (2–3 siswa), atau kelompok fokus kecil (3–5 siswa).',
    proof1: 'Pengajar terverifikasi',
    proof2: 'Tahfidz, Tajwid & Sanad',
    proof3: 'Durasi sesi tetap & jelas',
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
    kicker: 'Pelan jelas untuk setiap pelajar',
    heroDesc: 'Kelas peribadi 1-on-1 (30/60 minit), kelas adik-beradik (2–3 pelajar), atau kumpulan fokus kecil (3–5 pelajar).',
    proof1: 'Guru bertauliah',
    proof2: 'Hafazan, Tajwid & Sanad',
    proof3: 'Tempoh sesi tetap & jelas',
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
    kicker: 'پلانی ڕوون بۆ هەموو ماڵێک',
    heroDesc: 'وانەی تایبەتی تاکەکەسی (٣٠ یان ٦٠ خولەک)، بازنەی خوشک و براکان (٢–٣ قوتابی)، یان گرووپی بچووکی چڕ (٣–٥ قوتابی).',
    proof1: 'مامۆستایانی باوەڕپێکراو',
    proof2: 'لەبەرکردن، تەجوید و ئیجازە',
    proof3: 'ماوەی وانەی دیاریکراو',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const renewalId = searchParams.get('renew') || '';
  const targetStudentId = searchParams.get('student') || '';
  const requestedProgramId = searchParams.get('program') || '';
  const activeProgram = PROGRAM_CONTEXT[requestedProgramId] || null;
  const requestedPlanId = searchParams.get('plan') || activeProgram?.recommendedPlan || '';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [audience, setAudience] = useState(() => (
    searchParams.get('section') === 'women' || searchParams.get('section') === 'ladies' ? 'women' : 'general'
  ));
  const enrolledSection = user?.role === 'student' && ['men_children', 'ladies'].includes(user?.enrollmentSection)
    ? user.enrollmentSection : null;
  const [sessionCount, setSessionCount] = useState(() => {
    const requestedSessions = Number(searchParams.get('sessions'));
    return [4, 8, 12, 24].includes(requestedSessions) ? requestedSessions : 12;
  });
  const [catalog, setCatalog] = useState(null);
  const [selection, setSelection] = useState(null);
  const [selectingPlan, setSelectingPlan] = useState('');
  const [renewalSource, setRenewalSource] = useState(null);
  const generalTabRef = useRef(null);
  const womenTabRef = useRef(null);
  const didAutoScrollPlanRef = useRef(false);

  useEffect(() => {
    if (enrolledSection) {
      setAudience(enrolledSection === 'ladies' ? 'women' : 'general');
      return;
    }
    const requestedSection = searchParams.get('section');
    if (requestedSection === 'women' || requestedSection === 'ladies') {
      setAudience('women');
    } else if (requestedSection === 'men' || requestedSection === 'general' || requestedSection === 'men_children') {
      setAudience('general');
    }
  }, [enrolledSection, searchParams]);

  useEffect(() => {
    const requestedSessions = Number(searchParams.get('sessions'));
    if ([4, 8, 12, 24].includes(requestedSessions)) {
      setSessionCount(requestedSessions);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!requestedPlanId || didAutoScrollPlanRef.current) return;
    didAutoScrollPlanRef.current = true;
    const timer = window.setTimeout(() => {
      document.getElementById('plan-' + requestedPlanId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [requestedPlanId]);

  const clearProgramContext = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('program');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/api/subscriptions/plans')
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!renewalId || !isAuthenticated || !['student', 'guardian'].includes(user?.role)) {
      setRenewalSource(null);
      return undefined;
    }

    let cancelled = false;
    api.get('/api/subscriptions/me', { auth: true })
      .then((data) => {
        if (cancelled) return;
        const found = (data?.subscriptions || []).find((item) => String(item._id) === renewalId) || null;
        setRenewalSource(found);
        if (found) {
          setAudience(found.section === 'ladies' ? 'women' : 'general');
          if ([4, 8, 12, 24].includes(Number(found.sessionCount))) {
            setSessionCount(Number(found.sessionCount));
          }
        }
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

  const packageOptions = useMemo(
    () => (Array.isArray(catalog?.sessionPacks) && catalog.sessionPacks.length
      ? catalog.sessionPacks
      : [4, 8, 12, 24]),
    [catalog]
  );

  const billingCurrency = catalog?.currency === 'USD' ? 'USD' : 'EGP';
  const currencyLabels = currencyLabelsFor(billingCurrency, isRTL);
  const localCurrencyHint = catalog?.localCurrencyHint || null;
  const regionLabelText = isRTL
    ? (catalog?.regionLabel?.ar || 'مصر')
    : (catalog?.regionLabel?.en || 'Egypt');

  const activeDefs = useMemo(() => {
    if (renewalSource && LEGACY_RENEWAL_DEFS[renewalSource.planKey]) {
      return [LEGACY_RENEWAL_DEFS[renewalSource.planKey]];
    }
    return PLAN_DEFS;
  }, [renewalSource]);

  const plans = useMemo(() => activeDefs.map((plan) => {
    const serverPlan = serverPlans.get(plan.id);
    const allowedPacks = Array.isArray(serverPlan?.allowedSessionPacks) && serverPlan.allowedSessionPacks.length
      ? serverPlan.allowedSessionPacks
      : (plan.allowedSessionPacks || [4, 8, 12, 24]);
    const effectiveSessionCount = allowedPacks.includes(sessionCount)
      ? sessionCount
      : allowedPacks[0];

    const serverPackPrice = serverPlan?.packPricesMinor?.[effectiveSessionCount];
    const clientEgPackPrice = !serverPlan && billingCurrency === 'EGP'
      ? plan.packPricesMinorEg?.[effectiveSessionCount]
      : undefined;
    const hasPositiveNumber = (val) => val != null && Number.isFinite(Number(val)) && Number(val) > 0;
    const priceMinor = hasPositiveNumber(serverPackPrice)
      ? Number(serverPackPrice)
      : hasPositiveNumber(clientEgPackPrice)
        ? Number(clientEgPackPrice)
        : serverPlan
          ? Number(serverPlan.pricePerSessionMinor)
          : plan.price * 100;

    const minBaseMinor = serverPlan ? Number(serverPlan.pricePerSessionMinor) : plan.price * 100;
    const rawAnchorMinor = serverPlan && hasPositiveNumber(serverPlan.basePricePerSessionMinor)
      ? Number(serverPlan.basePricePerSessionMinor)
      : (plan.anchorPrice || plan.price) * 100;
    const anchorMinor = Math.max(priceMinor, rawAnchorMinor);
    const savingsPercent = anchorMinor > priceMinor
      ? Math.round(((anchorMinor - priceMinor) / anchorMinor) * 100)
      : 0;
    const packageTotalMinor = priceMinor * effectiveSessionCount;
    const totalSavingsMinor = Math.max(0, (anchorMinor - priceMinor) * effectiveSessionCount);

    return {
      ...plan,
      allowedPacks,
      effectiveSessionCount,
      minBaseMinor,
      anchorMinor,
      anchorDisplay: formatMajorNumber(anchorMinor),
      savingsPercent,
      totalSavingsMinor,
      priceMinor,
      price: priceMinor / 100,
      priceDisplay: formatMajorNumber(priceMinor),
      priceLocalHint: formatLocalEquivalent(priceMinor, billingCurrency, localCurrencyHint, isRTL),
      studentsAr: plan.studentsAr,
      studentsEn: plan.studentsEn,
      durationAr: serverPlan?.durationLabel?.ar || plan.durationAr,
      durationEn: serverPlan?.durationLabel?.en || plan.durationEn,
      packageTotalMinor,
      packageTotal: packageTotalMinor / 100,
      packageTotalDisplay: formatMajorNumber(packageTotalMinor),
      packageLocalHint: formatLocalEquivalent(packageTotalMinor, billingCurrency, localCurrencyHint, isRTL),
    };
  }), [activeDefs, serverPlans, sessionCount, billingCurrency, localCurrencyHint, isRTL]);

  const packMaxSavingsMap = useMemo(() => {
    const map = {};
    for (const count of packageOptions) {
      let maxPct = 0;
      for (const def of PLAN_DEFS) {
        const sPlan = serverPlans.get(def.id);
        const allowed = Array.isArray(sPlan?.allowedSessionPacks) ? sPlan.allowedSessionPacks : (def.allowedSessionPacks || []);
        if (!allowed.includes(count)) continue;
        const packVal = sPlan?.packPricesMinor?.[count] ?? (billingCurrency === 'EGP' ? def.packPricesMinorEg?.[count] : null);
        const anchorVal = sPlan?.basePricePerSessionMinor ?? ((def.anchorPrice || def.price) * 100);
        if (packVal && anchorVal > packVal) {
          const pct = Math.round(((anchorVal - packVal) / anchorVal) * 100);
          if (pct > maxPct) maxPct = pct;
        }
      }
      map[count] = maxPct;
    }
    return map;
  }, [packageOptions, serverPlans, billingCurrency]);

  const minPlan = plans.find((plan) => plan.id === 'focused') || plans[0];
  const minFormattedPrice = formatRegionalMoney(minPlan?.minBaseMinor ?? 1900, billingCurrency, locale);
  const minDisplayNum = formatMajorNumber(minPlan?.minBaseMinor ?? 1900);
  const dynamicHeroTitle = isRTL
    ? `ابدأ رحلتك القرآنية من ${minFormattedPrice} للحصة`
    : `Start your Quran journey from ${minFormattedPrice} per session`;

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

    const chosenSessionCount = plan.effectiveSessionCount || sessionCount;
    setSelectingPlan(plan.id);
    try {
      const data = renewalSource
        ? await api.post(
            '/api/subscriptions/' + encodeURIComponent(renewalSource._id) + '/renew',
            { sessionCount: chosenSessionCount },
            { auth: true }
          )
        : await api.post('/api/subscriptions/select', {
            planKey: plan.id,
            studentId: targetStudentId || undefined,
            section: enrolledSection || (audience === 'women' ? 'ladies' : 'men_children'),
            sessionCount: chosenSessionCount,
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
        currency: billingCurrency,
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
              <h1>{dynamicHeroTitle}</h1>
              <p>{copy.heroDesc}</p>
              <div className="wn-plans-hero__proof">
                <span><ShieldCheck size={18} aria-hidden="true" /> {copy.proof1}</span>
                <span><BookOpenCheck size={18} aria-hidden="true" /> {copy.proof2}</span>
                <span><Clock3 size={18} aria-hidden="true" /> {copy.proof3}</span>
                <span className="wn-plans-region-pill">
                  <Globe size={16} aria-hidden="true" />
                  {billingCurrency === 'USD'
                    ? (isRTL
                      ? `تسعير ${regionLabelText}: ${usdLocalEquivalentNote(true)}`
                      : `${regionLabelText}: ${usdLocalEquivalentNote(false)}`)
                    : (isRTL
                      ? `تسعير منطقتك: ${regionLabelText} (${billingCurrency})`
                      : `Regional pricing: ${regionLabelText} (${billingCurrency})`)}
                </span>
              </div>
            </div>

            <div className="wn-plans-hero__visual">
              <img
                src={audience === 'women' ? '/images/plans/women-private.jpg?v=2' : '/images/plans/men-private.jpg?v=2'}
                decoding="async"
                alt={isRTL
                  ? (audience === 'women' ? 'حصة قرآن مباشرة أونلاين لقسم السيدات من البيت' : 'حلقة قرآن مباشرة أونلاين لقسم الرجال والأطفال من البيت')
                  : (audience === 'women' ? 'Live online women Quran class from home' : 'Live online Quran class from home')}
              />
              <span className="wn-plan-card__live-tag wn-plan-card__live-tag--hero">
                <span className="wn-plan-card__live-dot" aria-hidden="true" />
                <Video size={13} aria-hidden="true" />
                <span>{LIVE_ONLINE_LABEL[locale] || (isRTL ? LIVE_ONLINE_LABEL.ar : LIVE_ONLINE_LABEL.en)}</span>
              </span>
              <div className="wn-plans-hero__price">
                <small>{copy.startAt}</small>
                <strong>
                  {billingCurrency === 'USD' ? '$' : ''}
                  {minDisplayNum || '20'}{' '}
                  <em>{currencyLabels.long}</em>
                </strong>
                <span>
                  {copy.perSession}
                  {minPlan?.priceLocalHint ? ` (${minPlan.priceLocalHint})` : ''}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="wn-plans-control-shell" id="plans-control-anchor">
          <div className="wn-plans-container">
            {activeProgram && !renewalSource && (
              <aside className="wn-plans-program-banner" role="status">
                <div className="wn-plans-program-banner__icon" aria-hidden="true">
                  <Sparkles size={20} />
                </div>
                <div className="wn-plans-program-banner__body">
                  <span>{isRTL ? 'المسار المختار من برامجنا القرآنية' : 'Selected Quranic pathway'}</span>
                  <strong>{isRTL ? activeProgram.titleAr : activeProgram.titleEn}</strong>
                  <p>{isRTL ? activeProgram.noteAr : activeProgram.noteEn}</p>
                </div>
                <div className="wn-plans-program-banner__actions">
                  <button
                    type="button"
                    className="wn-plans-program-banner__jump"
                    onClick={() => {
                      document
                        .getElementById('plan-' + activeProgram.recommendedPlan)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <span>{isRTL ? 'الباقة المرشّحة' : 'View recommended plan'}</span>
                    <ArrowIcon size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="wn-plans-program-banner__close"
                    onClick={clearProgramContext}
                    aria-label={isRTL ? 'إخفاء تخصيص المسار' : 'Clear selected pathway'}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </aside>
            )}

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
                {packageOptions.map((count) => {
                  const maxSave = packMaxSavingsMap[count] || 0;
                  return (
                    <button
                      type="button"
                      key={count}
                      aria-pressed={sessionCount === count}
                      className={sessionCount === count ? 'is-active' : ''}
                      onClick={() => setSessionCount(count)}
                    >
                      <span>{count} {count === 12 ? copy.sessionWordSingle : copy.sessionsWord}</span>
                      {maxSave > 0 ? (
                        <em className="wn-plans-frequency__save">
                          -{maxSave}%
                        </em>
                      ) : null}
                    </button>
                  );
                })}
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
                      ? `${selection.sessionCount} حصة · الإجمالي ${formatRegionalMoney(selection.totalAmountMinor, selection.currency || billingCurrency, locale)} · لم يتم الدفع بعد`
                      : `${selection.sessionCount} sessions · total ${formatRegionalMoney(selection.totalAmountMinor, selection.currency || billingCurrency, locale)} · payment not completed`}
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
                <img src="/images/plans/women-mini.jpg?v=2" alt="" aria-hidden="true" loading="lazy" decoding="async" />
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
            {!renewalSource && (
              <div className="wn-plans-heading">
                <span>{copy.catalogKicker}</span>
                <h2>{copy.catalogTitle}</h2>
                <p>{copy.catalogDesc}</p>
                {billingCurrency === 'USD' ? (
                  <div className="wn-plans-usd-note" role="note">
                    <Globe size={15} aria-hidden="true" />
                    <span>{usdLocalEquivalentNote(isRTL)}</span>
                  </div>
                ) : null}
              </div>
            )}

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
                    <span className="wn-plan-card__badge">
                      {activeProgram && activeProgram.recommendedPlan === plan.id
                        ? (isRTL ? 'الأنسب لمسارك' : 'Best fit for your track')
                        : (isRTL ? plan.badgeAr : plan.badgeEn)}
                    </span>
                    <span className="wn-plan-card__live-tag">
                      <span className="wn-plan-card__live-dot" aria-hidden="true" />
                      <Video size={12} aria-hidden="true" />
                      <span>{LIVE_ONLINE_LABEL[locale] || (isRTL ? LIVE_ONLINE_LABEL.ar : LIVE_ONLINE_LABEL.en)}</span>
                    </span>
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

                    {plan.savingsPercent > 0 ? (
                      <div className="wn-plan-card__savings-row">
                        <del className="wn-plan-card__anchor">
                          {billingCurrency === 'USD' ? '$' : ''}
                          {plan.anchorDisplay} {currencyLabels.short}
                        </del>
                        <span className="wn-plan-card__save-pill">
                          {isRTL ? `وفّر ${plan.savingsPercent}%` : `Save ${plan.savingsPercent}%`}
                        </span>
                      </div>
                    ) : null}

                    <div className="wn-plan-card__price">
                      <span>{plan.from ? copy.fromWord : ''}</span>
                      <strong>
                        {billingCurrency === 'USD' ? '$' : ''}
                        {plan.priceDisplay}
                      </strong>
                      <div>
                        <b>{currencyLabels.long}</b>
                        <small>{copy.perSessionUnit}</small>
                      </div>
                    </div>
                    {plan.priceLocalHint ? (
                      <div className="wn-plan-card__local-hint">
                        {plan.priceLocalHint} {copy.perSessionUnit}
                      </div>
                    ) : null}

                    <div className="wn-plan-card__monthly">
                      <span>{plan.effectiveSessionCount} {plan.effectiveSessionCount === 12 ? copy.sessionWordSingle : copy.sessionsWord} {copy.inPackage}</span>
                      <strong>
                        {plan.from ? copy.fromWord : ''}
                        {formatRegionalMoney(plan.packageTotalMinor, billingCurrency, locale)}
                        {plan.packageLocalHint ? <small className="wn-plan-card__monthly-hint"> ({plan.packageLocalHint})</small> : null}
                      </strong>
                    </div>
                    {plan.totalSavingsMinor > 0 ? (
                      <div className="wn-plan-card__saved-note">
                        {isRTL
                          ? `وفّرت ${formatRegionalMoney(plan.totalSavingsMinor, billingCurrency, locale)} في هذه الباقة`
                          : `You save ${formatRegionalMoney(plan.totalSavingsMinor, billingCurrency, locale)} on this pack`}
                      </div>
                    ) : null}

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

            {!renewalSource && (
              <div className="wn-plans-guarantees" aria-label={isRTL ? 'ضمانات أكاديمية وحي ونماء' : 'Academy guarantees'}>
                <div className="wn-plans-guarantee-item">
                  <ShieldCheck size={20} aria-hidden="true" />
                  <div>
                    <strong>{isRTL ? 'حصة تقييم مجانية أولاً' : 'Free trial assessment first'}</strong>
                    <p>{isRTL ? 'جرّب مستوى المعلم وجودة التلاوة مجاناً قبل دفع أي اشتراك.' : 'Experience your tutor and class quality free before paying.'}</p>
                  </div>
                </div>
                <div className="wn-plans-guarantee-item">
                  <BadgeCheck size={20} aria-hidden="true" />
                  <div>
                    <strong>{isRTL ? 'ضمان استبدال المعلم مجاناً' : 'Free tutor switch guarantee'}</strong>
                    <p>{isRTL ? 'يمكنك طلب تغيير المعلم أو الموعد في أي وقت دون أي رسوم إضافية.' : 'Switch your tutor or schedule anytime at zero extra cost.'}</p>
                  </div>
                </div>
                <div className="wn-plans-guarantee-item">
                  <BookOpenCheck size={20} aria-hidden="true" />
                  <div>
                    <strong>{isRTL ? 'بدون رسوم تسجيل أو مصاريف خفية' : 'Zero registration or hidden fees'}</strong>
                    <p>{isRTL ? 'تدفع قيمة حصصك فقط، ولا تُخصم الحصة عند الاعتذار المسبق.' : 'Pay strictly for your sessions; excused absences are preserved.'}</p>
                  </div>
                </div>
              </div>
            )}

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
                          <td>
                            <strong>
                              {plan.from ? copy.fromWord : ''}
                              {formatRegionalMoney(plan.priceMinor, billingCurrency, locale)}
                            </strong>
                            {plan.priceLocalHint ? <div className="wn-plans-compare__hint">{plan.priceLocalHint}</div> : null}
                          </td>
                          <td>
                            <strong>
                              {plan.from ? copy.fromWord : ''}
                              {formatRegionalMoney(plan.packageTotalMinor, billingCurrency, locale)}
                            </strong>
                            {plan.effectiveSessionCount !== sessionCount ? (
                              <div className="wn-plans-compare__hint">
                                ({plan.effectiveSessionCount} {plan.effectiveSessionCount === 12 ? copy.sessionWordSingle : copy.sessionsWord})
                              </div>
                            ) : null}
                            {plan.packageLocalHint ? <div className="wn-plans-compare__hint">{plan.packageLocalHint}</div> : null}
                          </td>
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
                <strong>{isRTL ? 'بداية فورية للفردي والإخوة وتسكين سريع للمجموعات المركّزة' : 'Instant start for Private & Siblings, fast placement for Focused Groups'}</strong>
                <p>
                  {isRTL
                    ? `الحصص الفردية وحلقات الإخوة تبدأ مباشرة مع المعلم المختار بدون انتظار. الحلقة الجماعية المركّزة (3 إلى 5 طلاب، تبدأ من ${minFormattedPrice}) تنطلق فور اكتمال 3 طلاب في نفس المستوى.`
                    : `Private 1-on-1 and Siblings circles start immediately with your chosen tutor. Focused Group circles (3–5 learners, from ${minFormattedPrice}) launch as soon as 3 matched learners enroll.`}
                </p>
              </div>
            </div>
            {!renewalSource && (
              <aside className="wn-plans-courses-upsell">
                <div>
                  <span className="wn-plans-courses-upsell__eyebrow">
                    <Sparkles size={14} aria-hidden="true" />
                    {isRTL ? 'دورات تأسيسية وتخصصية مسجّلة' : 'Structured Self-Paced Courses'}
                  </span>
                  <h3>
                    {isRTL
                      ? 'تبحث عن دورة تأسيس أو تجويد أو تحفة الأطفال والجزريّة بدفعة واحدة؟'
                      : 'Looking for one-time Tajweed, Noor Al-Bayan, or Jazariyyah courses?'}
                  </h3>
                  <p>
                    {isRTL
                      ? (billingCurrency === 'EGP'
                        ? 'استكشف دوراتنا المنهجية المتكاملة — تبدأ من دورة الفاتحة المجانية وحتى 149 ج.م فقط مع وصول مفتوح وشهادة إتمام.'
                        : 'Explore our structured self-paced courses — starting with our Free Al-Fatiha course and affordable lifetime access.')
                      : 'Explore our structured self-paced courses — starting from Free with lifetime access and verifiable certificates.'}
                  </p>
                </div>
                <LocalizedLink to="/courses" locale={locale} className="wn-plans-courses-upsell__cta">
                  <span>{isRTL ? 'تصفّح الدورات والأسعار' : 'Explore Courses'}</span>
                  <ArrowIcon size={16} aria-hidden="true" />
                </LocalizedLink>
              </aside>
            )}
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
