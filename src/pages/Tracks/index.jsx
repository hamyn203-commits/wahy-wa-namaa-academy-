import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Award,
  Sparkles,
  CheckCircle,
  Calendar,
  Layers,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Bookmark,
  Compass
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

const TRACKS_UI = {
  ar: {
    pageTitle: 'المسارات التعليمية التخصصية | أكاديمية وَحْيٌ وَنَمَاء',
    pageDesc: 'اكتشف مسارات التحفيظ والمراجعة، والتجويد المتقدم والإجازة عند الأهلية، وتأسيس الأطفال بخطوات تعليمية متدرجة.',
    home: 'الرئيسية',
    breadcrumb: 'المسارات التعليمية',
    eyebrow: 'مسارات تعليمية متدرجة',
    heroTitle: 'المسارات التعليمية التخصصية',
    heroLead: 'ثلاثة مسارات تعليمية تساعد الطالب على الانتقال من التأسيس إلى الحفظ والإتقان، مع وضوح في الأهداف والمراجعة والخطوة التالية.',
    switcherLabel: 'اختيار المسار التعليمي',
    matnSwitcherLabel: 'اختيار المتن التجويدي',
    tabs: {
      memorization: 'مسار التحفيظ والمراجعة',
      ijazah: 'مسار الإجازة والمتون',
      kids: 'مسار تأسيس الأطفال',
    },
    selectPlan: 'تحديد الخطة',
    selectedPlan: 'خطة محددة',
    enrollPlan: 'التسجيل في هذه الخطة',
    ctaTitle: 'ابدأ رحلتك القرآنية اليوم في المسار المناسب لك',
    ctaLead: 'جلسة تعريفية مجانية لتحديد المستوى وفهم الهدف واقتراح المسار المناسب لك أو لطفلك.',
    ctaTrial: 'احجز حصتك التجريبية الآن',
    ctaCourses: 'استعراض كافة الدورات',
  },
  en: {
    pageTitle: 'Educational Tracks | Wahy Wa Namaa Academy',
    pageDesc: 'Explore the 3 educational tracks: Memorization & Revision, Ijazah & Tajweed Matn, and Kids Quranic Foundation.',
    home: 'Home',
    breadcrumb: 'Educational Tracks',
    eyebrow: 'STRUCTURED QURAN LEARNING',
    heroTitle: 'Specialized Quranic Educational Tracks',
    heroLead: 'Three structured learning paths that guide students from foundations to memorization and advanced recitation goals.',
    switcherLabel: 'Choose educational track',
    matnSwitcherLabel: 'Choose Tajweed text',
    tabs: {
      memorization: 'Memorization & Revision',
      ijazah: 'Ijazah & Matn Texts',
      kids: 'Kids Foundation',
    },
    selectPlan: 'Select plan',
    selectedPlan: 'Selected plan',
    enrollPlan: 'Enroll in this plan',
    ctaTitle: 'Begin Your Quranic Journey Today in Your Selected Track',
    ctaLead: 'A free introductory assessment to understand your level and recommend a suitable learning path.',
    ctaTrial: 'Book Your Free Trial Now',
    ctaCourses: 'Browse All Courses',
  },
  fr: {
    pageTitle: 'Parcours éducatifs | Académie Wahy Wa Namaa',
    pageDesc: 'Découvrez nos 3 parcours : Mémorisation & Révision, Ijazah & Textes de Tajwid, et Initiation Enfants.',
    home: 'Accueil',
    breadcrumb: 'Parcours éducatifs',
    eyebrow: 'APPRENTISSAGE STRUCTURÉ DU CORAN',
    heroTitle: 'Parcours éducatifs spécialisés',
    heroLead: 'Trois parcours structurés pour accompagner l’élève des bases jusqu’à la mémorisation et la maîtrise avancée.',
    switcherLabel: 'Choisir un parcours',
    matnSwitcherLabel: 'Choisir un texte de Tajwid',
    tabs: {
      memorization: 'Mémorisation & Révision',
      ijazah: 'Ijazah & Mutun',
      kids: 'Initiation Enfants',
    },
    selectPlan: 'Sélectionner ce plan',
    selectedPlan: 'Plan sélectionné',
    enrollPlan: 'S’inscrire à ce plan',
    ctaTitle: 'Commencez votre parcours coranique dès aujourd’hui',
    ctaLead: 'Une séance d’évaluation gratuite pour déterminer votre niveau et recommander le parcours adapté.',
    ctaTrial: 'Réserver votre essai gratuit',
    ctaCourses: 'Parcourir tous les cours',
  },
  de: {
    pageTitle: 'Lernpfade | Wahy Wa Namaa Akademie',
    pageDesc: 'Entdecken Sie unsere 3 Lernpfade: Auswendiglernen & Wiederholung, Idschaza & Tadschwid-Texte sowie Kinder-Grundlagen.',
    home: 'Startseite',
    breadcrumb: 'Lernpfade',
    eyebrow: 'STRUKTURIERTES KORANLERNEN',
    heroTitle: 'Spezialisierte Koran-Lernpfade',
    heroLead: 'Drei strukturierte Lernwege von den Grundlagen bis zum Auswendiglernen und fortgeschrittener Rezitation.',
    switcherLabel: 'Lernpfad wählen',
    matnSwitcherLabel: 'Tadschwid-Lehrgedicht wählen',
    tabs: {
      memorization: 'Auswendiglernen & Wiederholung',
      ijazah: 'Idschaza & Mutun',
      kids: 'Kinder-Grundlagen',
    },
    selectPlan: 'Plan auswählen',
    selectedPlan: 'Ausgewählter Plan',
    enrollPlan: 'Für diesen Plan anmelden',
    ctaTitle: 'Beginnen Sie noch heute Ihre Koran-Reise im passenden Pfad',
    ctaLead: 'Eine kostenlose Einführungssitzung zur Einstufung und Empfehlung des passenden Lernpfads.',
    ctaTrial: 'Kostenlose Probestunde buchen',
    ctaCourses: 'Alle Kurse ansehen',
  },
  tr: {
    pageTitle: 'Eğitim Yolları | Wahy Wa Namaa Akademisi',
    pageDesc: '3 eğitim yolunu keşfedin: Ezber ve Tekrar, İcazet ve Tecvid Metinleri, Çocuklar İçin Temel Eğitim.',
    home: 'Ana Sayfa',
    breadcrumb: 'Eğitim Yolları',
    eyebrow: 'YAPILANDIRILMIŞ KUR’AN EĞİTİMİ',
    heroTitle: 'Uzmanlaşmış Kur’an Eğitim Yolları',
    heroLead: 'Öğrenciyi temelden ezbere ve ileri düzey tilavet hedeflerine taşıyan üç yapılandırılmış eğitim yolu.',
    switcherLabel: 'Eğitim yolu seçin',
    matnSwitcherLabel: 'Tecvid metni seçin',
    tabs: {
      memorization: 'Ezber ve Tekrar',
      ijazah: 'İcazet ve Metinler',
      kids: 'Çocuk Temel Eğitimi',
    },
    selectPlan: 'Planı seç',
    selectedPlan: 'Seçili plan',
    enrollPlan: 'Bu plana kaydol',
    ctaTitle: 'Size Uygun Eğitim Yolunda Bugün Başlayın',
    ctaLead: 'Seviyenizi belirlemek ve en uygun öğrenim yolunu önermek için ücretsiz tanışma dersi.',
    ctaTrial: 'Ücretsiz Deneme Dersi Ayırtın',
    ctaCourses: 'Tüm Kursları İncele',
  },
  ur: {
    pageTitle: 'تخصصی تعلیمی راستے | وحی و نما اکیڈمی',
    pageDesc: 'تین تعلیمی راستے دریافت کریں: حفظ و دہرائی، تجوید و اجازہ متون، اور بچوں کی بنیادی تعلیم۔',
    home: 'صفحہ اول',
    breadcrumb: 'تعلیمی راستے',
    eyebrow: 'منظم قرآنی تعلیم',
    heroTitle: 'تخصصی قرآنی تعلیمی راستے',
    heroLead: 'تین منظم تعلیمی راستے جو طالب علم کو بنیاد سے حفظ اور مہارت تک مرحلہ وار لے جاتے ہیں۔',
    switcherLabel: 'تعلیمی راستہ منتخب کریں',
    matnSwitcherLabel: 'تجوید کا متن منتخب کریں',
    tabs: {
      memorization: 'حفظ و دہرائی',
      ijazah: 'اجازہ اور متون',
      kids: 'بچوں کی بنیاد',
    },
    selectPlan: 'پلان منتخب کریں',
    selectedPlan: 'منتخب شدہ پلان',
    enrollPlan: 'اس پلان میں داخلہ لیں',
    ctaTitle: 'اپنے لیے موزوں راستے میں آج ہی قرآنی سفر شروع کریں',
    ctaLead: 'سطح جانچنے اور مناسب تعلیمی راستے کی تجویز کے لیے مفت تعارفی سیشن۔',
    ctaTrial: 'ابھی مفت آزمائشی سبق بک کریں',
    ctaCourses: 'تمام کورسز دیکھیں',
  },
  id: {
    pageTitle: 'Jalur Pembelajaran | Akademi Wahy Wa Namaa',
    pageDesc: 'Jelajahi 3 jalur pendidikan: Tahfidz & Murajaah, Ijazah & Matan Tajwid, serta Dasar Al-Qur’an Anak.',
    home: 'Beranda',
    breadcrumb: 'Jalur Pembelajaran',
    eyebrow: 'PEMBELAJARAN AL-QUR’AN TERSTRUKTUR',
    heroTitle: 'Jalur Pendidikan Al-Qur’an Khusus',
    heroLead: 'Tiga jalur terstruktur yang membimbing siswa dari dasar hingga hafalan dan penguasaan bacaan tingkat lanjut.',
    switcherLabel: 'Pilih jalur pembelajaran',
    matnSwitcherLabel: 'Pilih matan tajwid',
    tabs: {
      memorization: 'Tahfidz & Murajaah',
      ijazah: 'Ijazah & Matan',
      kids: 'Dasar Anak',
    },
    selectPlan: 'Pilih paket',
    selectedPlan: 'Paket terpilih',
    enrollPlan: 'Daftar paket ini',
    ctaTitle: 'Mulai Perjalanan Al-Qur’an Anda Hari Ini',
    ctaLead: 'Sesi asesmen gratis untuk memahami level Anda dan merekomendasikan jalur belajar yang tepat.',
    ctaTrial: 'Pesan Kelas Percobaan Gratis',
    ctaCourses: 'Lihat Semua Kursus',
  },
  ms: {
    pageTitle: 'Laluan Pembelajaran | Akademi Wahy Wa Namaa',
    pageDesc: 'Terokai 3 laluan pendidikan: Hafazan & Ulang Kaji, Ijazah & Matan Tajwid, dan Asas Kanak-Kanak.',
    home: 'Utama',
    breadcrumb: 'Laluan Pembelajaran',
    eyebrow: 'PEMBELAJARAN AL-QURAN BERSTRUKTUR',
    heroTitle: 'Laluan Pendidikan Al-Quran Khusus',
    heroLead: 'Tiga laluan berstruktur yang membimbing pelajar daripada asas hingga hafazan dan penguasaan bacaan lanjutan.',
    switcherLabel: 'Pilih laluan pembelajaran',
    matnSwitcherLabel: 'Pilih matan tajwid',
    tabs: {
      memorization: 'Hafazan & Ulang Kaji',
      ijazah: 'Ijazah & Matan',
      kids: 'Asas Kanak-Kanak',
    },
    selectPlan: 'Pilih pelan',
    selectedPlan: 'Pelan dipilih',
    enrollPlan: 'Daftar pelan ini',
    ctaTitle: 'Mulakan Perjalanan Al-Quran Anda Hari Ini',
    ctaLead: 'Sesi penilaian percuma untuk mengenal pasti tahap anda dan mencadangkan laluan terbaik.',
    ctaTrial: 'Tempah Kelas Percubaan Percuma',
    ctaCourses: 'Layari Semua Kursus',
  },
  ku: {
    pageTitle: 'ڕێڕەوە فێرکارییە تایبەتەکان | ئەکادیمیای وەحی و نەما',
    pageDesc: 'سێ ڕێڕەوی فێرکاری بدۆزەرەوە: لەبەرکردن و پێداچوونەوە، ئیجازە و دەقەکانی تەجوید، و بنەمای منداڵان.',
    home: 'سەرەتا',
    breadcrumb: 'ڕێڕەوە فێرکارییەکان',
    eyebrow: 'فێربوونی ڕێکخراوی قورئان',
    heroTitle: 'ڕێڕەوە فێرکارییە تایبەتەکانی قورئان',
    heroLead: 'سێ ڕێڕەوی ڕێکخراو کە فێرخواز لە بنەماوە بەرەو لەبەرکردن و لێهاتوویی دەبەن بە ئامانجی ڕوونەوە.',
    switcherLabel: 'ڕێڕەوی فێرکاری هەڵبژێرە',
    matnSwitcherLabel: 'دەقی تەجوید هەڵبژێرە',
    tabs: {
      memorization: 'لەبەرکردن و پێداچوونەوە',
      ijazah: 'ئیجازە و دەقەکان',
      kids: 'بنەمای منداڵان',
    },
    selectPlan: 'پلان هەڵبژێرە',
    selectedPlan: 'پلانی هەڵبژێردراو',
    enrollPlan: 'تۆماربوون لەم پلانە',
    ctaTitle: 'ئەمڕۆ گەشتە قورئانییەکەت دەست پێبکە',
    ctaLead: 'وانەیەکی هەڵسەنگاندنی خۆڕایی بۆ دیاریکردنی ئاست و پێشنیارکردنی ڕێڕەوی گونجاو.',
    ctaTrial: 'وانەی تاقیکاری خۆڕایی حەجز بکە',
    ctaCourses: 'بینینی هەموو خولەکان',
  },
};

export default function TracksPage() {
  const { locale, isRTL, dir } = useI18n();
  const ui = TRACKS_UI[locale] || (isRTL ? TRACKS_UI.ar : TRACKS_UI.en);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const [activeTrack, setActiveTrack] = useState('memorization');
  const [activePlan, setActivePlan] = useState('full');
  const [activeMatn, setActiveMatn] = useState('tuhfa');
  const trackTabRefs = useRef({});
  const matnTabRefs = useRef({});

  const trackIds = ['memorization', 'ijazah', 'kids'];
  const matnIds = ['tuhfa', 'jazariya', 'shatibiyyah'];

  const handleRovingKeyDown = (e, ids, currentId, setter, refsMap) => {
    const idx = ids.indexOf(currentId);
    if (idx === -1) return;
    const prevKey = isRTL ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = isRTL ? 'ArrowLeft' : 'ArrowRight';
    let targetIdx = null;
    if (e.key === nextKey || e.key === 'ArrowDown') targetIdx = (idx + 1) % ids.length;
    else if (e.key === prevKey || e.key === 'ArrowUp') targetIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') targetIdx = 0;
    else if (e.key === 'End') targetIdx = ids.length - 1;
    if (targetIdx !== null) {
      e.preventDefault();
      const nextId = ids[targetIdx];
      setter(nextId);
      refsMap.current[nextId]?.focus();
    }
  };

  // Track 1: التحفيظ والمراجعة المتقنة
  const memorizationPlans = [
    {
      id: 'amma',
      title: isRTL ? 'خطة جزء عم والمفصل' : 'Juz Amma & Mufassal Plan',
      duration: isRTL ? 'شهرين (8 أسابيع)' : '2 Months (8 Weeks)',
      target: isRTL ? 'للمبتدئين والناشئة لتأسيس الحفظ الصحيح وتثبيت قصار السور' : 'For beginners and youth to build solid memorization of short surahs',
      dailyWorkload: isRTL ? 'نصف صفحة إلى صفحة يومياً مع التلقين المباشر' : 'Half to 1 page daily with live dictation',
      reviewSystem: isRTL ? 'مراجعة الماضي القريب (السور الـ 3 السابقة يومياً) والماضي البعيد نهاية الأسبوع' : 'Daily review of last 3 surahs, weekly review of all saved',
      highlight: isRTL ? 'أنسب بداية لمن يرغب بالانطلاق في مدارج القرآن' : 'Ideal kickoff for systematic Quran learning'
    },
    {
      id: 'five-juz',
      title: isRTL ? 'خطة الـ 5 أجزاء (المرحلة الفضية)' : '5 Juz Silver Plan',
      duration: isRTL ? '6 إلى 8 أشهر' : '6 to 8 Months',
      target: isRTL ? 'إتقان حفظ الأجزاء الخمسة الأخيرة (من الأحقاف إلى الناس) أو أول 5 أجزاء' : 'Mastery of 5 Juz (Ahqaf to Nas or first 5 Juz)',
      dailyWorkload: isRTL ? 'صفحة يومياً تسميعاً وضبطاً بالأحكام' : '1 page daily with full Tajweed rules',
      reviewSystem: isRTL ? 'مراجعة حزب يومياً (نصف جزء) وفق جدول الماضي والحاضر الراسخ' : '1 Hizb daily revision (half juz) via Past & Present rule',
      highlight: isRTL ? 'بناء قاعدة قوية تنقلك لمرحلة الحفظ الكامل' : 'Solid stepping stone to complete memorization'
    },
    {
      id: 'full',
      title: isRTL ? 'خطة القرآن كاملاً (حفظ الحذاق)' : 'Complete Quran Master Plan',
      duration: isRTL ? 'سنتان إلى 3 سنوات' : '2 to 3 Years',
      target: isRTL ? 'حفظ القرآن كاملاً عن ظهر قلب مع التثبيت الراسخ وضبط المتشابهات' : 'Full memorization of the Noble Quran with solid retention',
      dailyWorkload: isRTL ? 'وجه إلى وجهين يومياً مع اختبار أسبوعي متدرج' : '1 to 2 pages daily with progressive weekly testing',
      reviewSystem: isRTL ? 'المراجعة القريبة (آخر 10 أوجه) + المراجعة البعيدة (جزء إلى جزأين يومياً)' : 'Near review (last 10 pages) + Far review (1-2 Juz daily)',
      highlight: isRTL ? 'خطة طويلة المدى تجمع الحفظ الجديد بالمراجعة المستمرة' : 'A long-term plan combining new memorization with structured review'
    }
  ];

  // Track 2: المتون التجويدية والسند المتصل
  const matnDetails = {
    tuhfa: {
      name: isRTL ? 'متن تحفة الأطفال والغلمان' : 'Tuhfat Al-Atfal',
      author: isRTL ? 'العلامة الشيخ سليمان الجمزوري رحمه الله' : 'Sheikh Sulaiman Al-Jamzuri',
      verses: isRTL ? '61 بيتاً من بحر الرجز' : '61 poetic verses',
      level: isRTL ? 'المستوى الأول (تأسيس أحكام التجويد)' : 'Level 1 (Tajweed Foundation)',
      description: isRTL
        ? 'المنظومة الأوسع انتشاراً وقبولاً في العالم الإسلامي للمبتدئين، تشتمل على أحكام النون الساكنة والتنوين، والميم والنون المشددتين، والميم الساكنة، وحكم اللامات، وأحكام المثلين والمتقاربين والمتجانسين، وأقسام المد وأحكامه.'
        : 'The most popular didactic poem for beginners covering nun sakina, tanween, meem, idgham, and lengthening rules.',
      topics: isRTL ? [
        'أحكام النون الساكنة والتنوين (الإظهار، الإدغام، الإقلاب، الإخفاء)',
        'حكم الميم والنون المشددتين والميم الساكنة',
        'حكم لام أل ولام الفعل',
        'في المثلين والمتقاربين والمتجانسين',
        'أقسام المد وأحكامه وتفصيل المد الأصلي والفرعي'
      ] : [
        'Rules of Nun Sakinah and Tanween (Izhar, Idgham, Iqlab, Ikhfa)',
        'Rules of Meem & Nun Mushaddadatayn and Meem Sakinah',
        'Rules of Lam in definite article and verbs',
        'Similar, close, and homogenous letter pairs',
        'Divisions and rulings of Madd (primary and secondary)'
      ]
    },
    jazariya: {
      name: isRTL ? 'متن المقدمة الجزرية' : 'Al-Muqaddimah Al-Jazariyyah',
      author: isRTL ? 'الإمام الحافظ شمس الدين ابن الجزري رحمه الله' : 'Imam Ibn Al-Jazari',
      verses: isRTL ? '107 أبيات' : '107 poetic verses',
      level: isRTL ? 'المستوى المتقدم (عمدة علم التجويد لطلاب الإجازة)' : 'Advanced Level (The Core of Tajweed for Ijazah)',
      description: isRTL
        ? 'المرجع الأساسي الأعظم لكل قارئ ومقرئ على وجه الأرض، تفصّل مخارج الحروف الـ 17 وصفاتها اللازمة والعارضة، والتفخيم والترقيق، والمقطوع والموصول من الكلمات في رسم المصحف العثماني، وباب همز الوصل.'
        : 'The universal masterpiece required for all Ijazah aspirants, detailing the 17 letter articulation points and characteristics.',
      topics: isRTL ? [
        'باب مخارج الحروف وصفاتها اللازمة والمتضادة',
        'باب التجويد وتفصيل مراتب التفخيم والترقيق',
        'أحكام الراءات واللامات وتخليص الحروف المتجاورة',
        'باب المقطوع والموصول والتاءات في المصحف الشريف',
        'أحكام الوقف والابتداء وهمز الوصل وتفصيل الأداء'
      ] : [
        'The 17 points of articulation and letter characteristics',
        'Tajweed science, levels of heavy and light letters',
        'Rulings of Raa and Laam',
        'Connected and disconnected words in Ottoman script',
        'Waqf (stopping), Ibtida (starting), and Hamzatul Wasl'
      ]
    },
    shatibiyyah: {
      name: isRTL ? 'متن الشاطبية (حرز الأماني ووجه التهاني)' : 'Al-Shatibiyyah (Hirz Al-Amani)',
      author: isRTL ? 'الإمام أبو القاسم الشاطبي الرعيني الأندلسي' : 'Imam Al-Qasim bin Firruh Al-Shatibi',
      verses: isRTL ? '1173 بيتاً في القراءات السبع' : '1173 poetic verses',
      level: isRTL ? 'المستوى العالي (القراءات السبع المتواترة)' : 'Expert Level (The 7 Mutawatir Qira\'at)',
      description: isRTL
        ? 'درّة المتون القرآنية وتاج كتب القراءات، نظمت القراءات السبع من طريق التيسير للإمام الداني برمزية بديعة وسلاسة لا نظير لها، تمهد للإجازة الكبرى في القراءات السبع.'
        : 'The pinnacle text for the 7 canonical Quranic readings with intricate poetic codes and comprehensive rules.',
      topics: isRTL ? [
        'رموز القراء السبعة ورواتهم الأربعة عشر',
        'باب الاستعاذة والبسملة وسورة أم القرآن',
        'باب الإدغام الكبير وهاء الكناية والمد والقصر',
        'باب الهمزتين من كلمة ومن كلمتين ونقل الحركة',
        'فرش الحروف لكل سور القرآن من البقرة إلى الناس'
      ] : [
        'Codes and symbols of the 7 reciters and their 14 transmitters',
        'Rules of Isti\'adha, Basmalah, and Surah Al-Fatihah',
        'Major assimilation (Idgham Kabeer), pronouns, elongation',
        'Rules for single and paired Hamzas, and vocal transfer',
        'Detailed word-by-word variations from Baqarah to An-Nas'
      ]
    }
  };

  return (
    <>
      <SEOHead
        page={{
          url: '/tracks',
          title: ui.pageTitle,
          description: ui.pageDesc,
          schema: [
            createWebPageSchema({
              name: ui.pageTitle,
              description: ui.pageDesc,
              url: '/tracks',
              type: 'CollectionPage',
            }),
            createBreadcrumbSchema([
              { name: ui.home, url: '/' },
              { name: ui.breadcrumb, url: '/tracks' },
            ]),
          ],
        }}
      />
      <GlobalHeader />

      <main className="wn-program-shell" dir={dir}>
        {/* ═══ Hero Section ═══ */}
        <section className="wn-public-hero">
          <div className="absolute inset-0 opacity-10 pointer-events-none" />
          <div className="page-container relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--wn-gold)]/20 border border-[var(--wn-gold)]/40 text-[var(--wn-gold)] text-sm font-semibold mb-6">
              <Sparkles size={16} />
              <span>{ui.eyebrow}</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              {ui.heroTitle}
            </h1>
            <p className="text-[var(--wn-text-inverse)]/90 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10">
              {ui.heroLead}
            </p>

            {/* Quick Track Switcher Pills */}
            <div
              role="tablist"
              aria-label={ui.switcherLabel}
              className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto"
            >
              {[
                { id: 'memorization', label: ui.tabs.memorization, icon: BookOpen },
                { id: 'ijazah', label: ui.tabs.ijazah, icon: Award },
                { id: 'kids', label: ui.tabs.kids, icon: Sparkles },
              ].map((tabItem) => {
                const Icon = tabItem.icon;
                const active = activeTrack === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    ref={(el) => { trackTabRefs.current[tabItem.id] = el; }}
                    id={`track-tab-${tabItem.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`track-panel-${tabItem.id}`}
                    tabIndex={active ? 0 : -1}
                    type="button"
                    onClick={() => setActiveTrack(tabItem.id)}
                    onKeyDown={(e) => handleRovingKeyDown(e, trackIds, tabItem.id, setActiveTrack, trackTabRefs)}
                    className={`min-h-[44px] flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm md:text-base transition-all shadow-md ${
                      active
                        ? 'bg-[var(--wn-gold)] text-[var(--wn-emerald-deep)] ring-2 ring-[var(--wn-white)] shadow-lg'
                        : 'bg-[var(--wn-white)]/10 hover:bg-[var(--wn-white)]/20 text-[var(--wn-text-inverse)] border border-[var(--wn-white)]/25'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{tabItem.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Content Sections ═══ */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <AnimatePresence mode="wait">
            {/* ══════════════════════════════════════════════════════════════════════════
                1. مسار التحفيظ والمراجعة المتقنة
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'memorization' && (
              <motion.div
                key="memorization"
                id="track-panel-memorization"
                role="tabpanel"
                aria-labelledby="track-tab-memorization"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header Card */}
                <div className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border-mint)] shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)]">
                        {isRTL ? 'المسار الأول — رعاية الوحي' : 'Track 1 — Quran Memorization'}
                      </span>
                      <h2 className="text-3xl font-black text-[var(--wn-heading)]">
                        {isRTL ? 'مسار التحفيظ والمراجعة المتقنة' : 'Quran Memorization & Mastery Track'}
                      </h2>
                      <p className="text-[var(--wn-text-secondary)] max-w-2xl text-base leading-relaxed">
                        {isRTL
                          ? 'خطة حفظ تجمع التلقين المباشر بالحفظ الجديد والمراجعة المنظمة تحت إشراف معلمين متخصصين.'
                          : 'A proven memorization paradigm combining 1-on-1 recitation with the dual Past & Present retention method.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/free-trial', locale)}
                      className="min-h-[44px] inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isRTL ? 'احجز حصة تقييم مجانية' : 'Book Free Evaluation'}</span>
                      <ArrowIcon size={18} />
                    </Link>
                  </div>
                </div>

                {/* منهجية الماضي والحاضر التوضيحية */}
                <div className="bg-[var(--wn-surface-soft)] rounded-3xl p-8 border border-[var(--wn-border-strong)] shadow-sm">
                  <div className="text-center max-w-2xl mx-auto mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] flex items-center justify-center mx-auto mb-3 border border-[var(--wn-border)]">
                      <Compass size={28} />
                    </div>
                    <h3 className="text-2xl font-bold text-[var(--wn-heading)] mb-2">
                      {isRTL ? 'منهجية الماضي والحاضر: سر الحفظ الراسخ' : 'The Past & Present Memorization Formula'}
                    </h3>
                    <p className="text-[var(--wn-text-secondary)] text-sm">
                      {isRTL
                        ? 'القرآن أشد تفلتاً من الإبل في عقلها؛ لذا تعتمد أكاديمية وَحْيٌ وَنَمَاء على هذا الثلاثي الذهبي اليومي:'
                        : 'Retention requires disciplined stratification between new memorization and structured historical revision:'}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-[var(--wn-surface)] rounded-2xl p-6 border border-[var(--wn-border-mint)] shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] flex items-center justify-center font-bold text-sm">1</span>
                        <span className="text-xs font-bold text-[var(--wn-heading)] bg-[var(--wn-emerald-soft)] px-2.5 py-0.5 rounded-full">{isRTL ? 'الحاضر' : 'Present'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? 'الحفظ الجديد (المقدار اليومي)' : 'New Daily Memorization'}</h4>
                      <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">
                        {isRTL
                          ? 'قراءة وتصحيح التلاوة وتوضيح معاني الكلمات مع الشيخ قبل البدء بالحفظ، ثم تسميع المقدار المحدد بدون أي لحن.'
                          : 'Live recitation verification with the teacher before memorizing, ensuring zero mispronunciation.'}
                      </p>
                    </div>

                    <div className="bg-[var(--wn-surface)] rounded-2xl p-6 border border-[var(--wn-border)] shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-[var(--wn-gold-dark)] text-[var(--wn-text-inverse)] flex items-center justify-center font-bold text-sm">2</span>
                        <span className="text-xs font-bold text-[var(--wn-text-gold)] bg-[var(--wn-gold-soft)] px-2.5 py-0.5 rounded-full">{isRTL ? 'الماضي القريب' : 'Near Past'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? 'مراجعة الأيام الأخيرة' : 'Recent Days Review'}</h4>
                      <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">
                        {isRTL
                          ? 'تسميع آخر 5 إلى 10 أوجه حفظها الطالب خلال الأسبوع المنصرم يومياً قبل الشروع في حفظ الوجه الجديد لربط الآيات.'
                          : 'Mandatory daily recitation of the last 5-10 pages learned over the preceding week to connect sequences.'}
                      </p>
                    </div>

                    <div className="bg-[var(--wn-surface)] rounded-2xl p-6 border border-[var(--wn-border-mint)] shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-[var(--wn-teal-dark)] text-[var(--wn-text-inverse)] flex items-center justify-center font-bold text-sm">3</span>
                        <span className="text-xs font-bold text-[var(--wn-heading)] bg-[var(--wn-mint-soft)] px-2.5 py-0.5 rounded-full">{isRTL ? 'الماضي البعيد' : 'Far Past'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? 'الورد التثبيتي العام' : 'Cumulative Maintenance'}</h4>
                      <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">
                        {isRTL
                          ? 'جدول أسبوعي وشهري لمراجعة كامل المحفوظ القديم (جزء إلى جزأين يومياً) حتى لا يتفلت أي حرف على مر الشهور.'
                          : 'Rolling weekly and monthly cycles reciting 1-2 Juz daily to permanently stabilize old retention.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* الخطط الثلاث التفاعلية */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-[var(--wn-heading)]">{isRTL ? 'خطط الحفظ المخصصة' : 'Tailored Memorization Plans'}</h3>
                      <p className="text-[var(--wn-text-secondary)] text-sm">{isRTL ? 'اختر الخطة المناسبة لوقتك وأهدافك الشخصية' : 'Select the plan that fits your target and daily schedule'}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    {memorizationPlans.map((p) => {
                      const isSelected = activePlan === p.id;
                      return (
                        <article
                          key={p.id}
                          className={`rounded-3xl p-6 border transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[var(--wn-surface)] border-[var(--wn-emerald)] shadow-xl ring-2 ring-[var(--wn-emerald)]/30'
                              : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] hover:border-[var(--wn-teal)] shadow-sm'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-4 end-4 text-[var(--wn-link)]" aria-hidden="true">
                              <CheckCircle size={22} />
                            </span>
                          )}

                          <div className="space-y-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-surface-sunken)] text-[var(--wn-text-primary)] border border-[var(--wn-border)]">
                              <Calendar size={13} /> {p.duration}
                            </span>
                            <h4 className="text-xl font-bold text-[var(--wn-heading)]">{p.title}</h4>
                            <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">{p.target}</p>

                            <div className="border-t border-[var(--wn-border)] pt-4 space-y-2 text-xs text-[var(--wn-text-secondary)]">
                              <div className="flex items-start gap-2">
                                <Bookmark size={14} className="text-[var(--wn-link)] mt-0.5 shrink-0" />
                                <span><strong className="text-[var(--wn-text-primary)]">{isRTL ? 'المقدار اليومي: ' : 'Daily: '}</strong>{p.dailyWorkload}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <ShieldCheck size={14} className="text-[var(--wn-text-gold)] mt-0.5 shrink-0" />
                                <span><strong className="text-[var(--wn-text-primary)]">{isRTL ? 'نظام المراجعة: ' : 'Revision: '}</strong>{p.reviewSystem}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-[var(--wn-border)] flex flex-col gap-2">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setActivePlan(p.id)}
                              className={`min-h-[44px] w-full py-2.5 px-4 rounded-xl font-bold text-sm transition border ${
                                isSelected
                                  ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border-[var(--wn-emerald)]'
                                  : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-emerald)]'
                              }`}
                            >
                              {isSelected ? ui.selectedPlan : ui.selectPlan}
                            </button>
                            <Link
                              to={localizedPath(`/register/student?plan=${p.id}`, locale)}
                              className={`min-h-[44px] w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${
                                isSelected
                                  ? 'bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] shadow-sm'
                                  : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-emerald-soft)] hover:text-[var(--wn-heading)]'
                              }`}
                            >
                              <span>{ui.enrollPlan}</span>
                              <ArrowIcon size={15} />
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                2. مسار الإجازة وشرح المتون التجويدية
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'ijazah' && (
              <motion.div
                key="ijazah"
                id="track-panel-ijazah"
                role="tabpanel"
                aria-labelledby="track-tab-ijazah"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header */}
                <div className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border-strong)] shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border)]">
                        {isRTL ? 'المسار الثاني — تاج الإسناد' : 'Track 2 — Sanad & Ijazah'}
                      </span>
                      <h2 className="text-3xl font-black text-[var(--wn-heading)]">
                        {isRTL ? 'مسار التجويد المتقدم والإجازة' : 'Advanced Tajweed & Ijazah'}
                      </h2>
                      <p className="text-[var(--wn-text-secondary)] max-w-2xl text-base leading-relaxed">
                        {isRTL
                          ? 'دراسة معمقة للمتون التجويدية الثلاثة الكبرى (تحفة الأطفال، الجزرية، الشاطبية) واجتياز اختباراتها وضوابطها لنيل الإجازة القرآنية بسند متصل لرسول الله ﷺ.'
                          : 'In-depth study of classical Tajweed texts leading to certified Ijazah in Hafs, Asim, and the 10 Qira\'at.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/register/student?track=ijazah', locale)}
                      className="min-h-[44px] inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[var(--wn-gold-dark)] hover:bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isRTL ? 'التقديم لاختبار القبول' : 'Apply for Audition'}</span>
                      <ArrowIcon size={18} />
                    </Link>
                  </div>
                </div>

                {/* متون التجويد المعتمدة */}
                <div className="space-y-6">
                  <div
                    role="tablist"
                    aria-label={ui.matnSwitcherLabel}
                    className="flex flex-wrap gap-2 border-b border-[var(--wn-border)] pb-4"
                  >
                    {[
                      { id: 'tuhfa', label: isRTL ? '1. متن تحفة الأطفال' : '1. Tuhfat Al-Atfal' },
                      { id: 'jazariya', label: isRTL ? '2. متن المقدمة الجزرية' : '2. Al-Muqaddimah Al-Jazariyyah' },
                      { id: 'shatibiyyah', label: isRTL ? '3. متن الشاطبية (القراءات السبع)' : '3. Al-Shatibiyyah' }
                    ].map((m) => {
                      const active = activeMatn === m.id;
                      return (
                        <button
                          key={m.id}
                          ref={(el) => { matnTabRefs.current[m.id] = el; }}
                          id={`matn-tab-${m.id}`}
                          role="tab"
                          aria-selected={active}
                          aria-controls="matn-details-panel"
                          tabIndex={active ? 0 : -1}
                          type="button"
                          onClick={() => setActiveMatn(m.id)}
                          onKeyDown={(e) => handleRovingKeyDown(e, matnIds, m.id, setActiveMatn, matnTabRefs)}
                          className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                            active
                              ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-md'
                              : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] border border-[var(--wn-border)]'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Matn Details Card */}
                  <div
                    id="matn-details-panel"
                    role="tabpanel"
                    aria-labelledby={`matn-tab-${activeMatn}`}
                    className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border)] shadow-sm grid md:grid-cols-3 gap-8"
                  >
                    <div className="md:col-span-2 space-y-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-[var(--wn-heading)]">{matnDetails[activeMatn].name}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] font-semibold border border-[var(--wn-border)]">
                          {matnDetails[activeMatn].verses}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] font-semibold border border-[var(--wn-border-mint)]">
                          {matnDetails[activeMatn].level}
                        </span>
                      </div>

                      <p className="text-sm text-[var(--wn-text-secondary)] font-medium">
                        {isRTL ? 'الناظم المحقق: ' : 'Author: '}
                        <span className="text-[var(--wn-text-primary)] font-bold">{matnDetails[activeMatn].author}</span>
                      </p>

                      <p className="text-[var(--wn-text-secondary)] leading-relaxed text-base">
                        {matnDetails[activeMatn].description}
                      </p>

                      <div className="space-y-2 pt-2">
                        <h4 className="font-bold text-[var(--wn-heading)] text-sm flex items-center gap-2">
                          <Layers size={16} className="text-[var(--wn-link)]" />
                          <span>{isRTL ? 'أهم الأبواب والمسائل التي يدرسها الطالب:' : 'Core Topics Covered:'}</span>
                        </h4>
                        <ul className="grid sm:grid-cols-2 gap-2 text-xs text-[var(--wn-text-primary)]">
                          {matnDetails[activeMatn].topics.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 bg-[var(--wn-surface-soft)] p-2.5 rounded-lg border border-[var(--wn-border)]">
                              <CheckCircle size={14} className="text-[var(--wn-link)] shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-[var(--wn-gold-soft)] rounded-2xl p-6 border border-[var(--wn-border-strong)] flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--wn-gold-dark)] text-[var(--wn-text-inverse)] flex items-center justify-center shadow-md">
                          <GraduationCap size={26} />
                        </div>
                        <h4 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? 'مزايا دراسة المتن بالأكاديمية' : 'Academy Matn Features'}</h4>
                        <ul className="text-xs text-[var(--wn-text-primary)] space-y-2">
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                            <span>{isRTL ? 'شرح تحليلي متدرج بيتًا بيتًا' : 'Detailed verse-by-verse explanation'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                            <span>{isRTL ? 'اختبار حفظ المتن تحريرياً وشفهياً' : 'Written and oral memorization exam'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                            <span>{isRTL ? 'إجازة وسند خاص بالمتن من كبار الشيوخ' : 'Special Matn certificate from senior Sheikhs'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                            <span>{isRTL ? 'نسخة محققة وميسّرة مجاناً' : 'Free verified study edition'}</span>
                          </li>
                        </ul>
                      </div>

                      <Link
                        to={localizedPath('/library', locale)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] text-[var(--wn-heading)] text-xs font-bold shadow-sm hover:bg-[var(--wn-surface-soft)] transition"
                      >
                        <Bookmark size={14} />
                        <span>{isRTL ? 'تصفح نص المتن في المكتبة' : 'Browse Matn Text in Library'}</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* شروط السند المتصل والروايات المتاحة */}
                <div className="bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] rounded-3xl p-8 relative overflow-hidden border border-[var(--wn-border)]">
                  <div className="relative z-10 space-y-8">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                      <span className="text-xs font-bold text-[var(--wn-gold)] uppercase tracking-widest">{isRTL ? 'ضوابط الأمانة العلمية' : 'Academic & Spiritual Requirements'}</span>
                      <h3 className="text-2xl md:text-3xl font-black">{isRTL ? 'شروط التقدّم لمسار الإجازة' : 'Requirements for the Ijazah path'}</h3>
                      <p className="text-[var(--wn-text-inverse)]/80 text-sm">
                        {isRTL
                          ? 'السند أمانة دينية عظيمة، لا يُمنح إلا لمن استوفى الضوابط الموروثة عن أئمة القراءة جيلاً بعد جيل:'
                          : 'Sanad is a sacred chain of trust awarded only upon satisfying strict classical standards:'}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      {[
                        {
                          title: isRTL ? 'حفظ القرآن كاملاً' : 'Full Memorization',
                          desc: isRTL ? 'عن ظهر قلب بإتقان تام للآيات والمتشابهات بدون تردد.' : 'Complete retention from memory without hesitation.'
                        },
                        {
                          title: isRTL ? 'إتقان علم التجويد' : 'Mastery of Tajweed',
                          desc: isRTL ? 'دراسة واجتياز متن الجزرية وتحفة الأطفال وضبط المخارج والصفات.' : 'Full mastery and passing exams for Jazariyyah and Tuhfa.'
                        },
                        {
                          title: isRTL ? 'الختمة الكاملة غيباً' : 'Full Oral Recitation',
                          desc: isRTL ? 'قراءة ختمة كاملة من الفاتحة إلى الناس على الشيخ المجاز جلسة بجلسة.' : 'Reciting the entire Quran orally to the Sheikh session by session.'
                        },
                        {
                          title: isRTL ? 'الإجازة عند الأهلية' : 'Ijazah when eligible',
                          desc: isRTL ? 'إصدار الإجازة أو السند يعتمد على أهلية الطالب، وتوفر معلم مجاز، واستيفاء شروط البرنامج.' : 'Issuing an Ijazah or Sanad depends on learner eligibility, an appropriately qualified teacher, and program requirements.'
                        }
                      ].map((cond, i) => (
                        <div key={i} className="bg-[var(--wn-white)]/10 border border-[var(--wn-white)]/15 rounded-2xl p-5 space-y-2">
                          <span className="text-[var(--wn-gold)] font-mono text-sm font-bold">0{i+1}.</span>
                          <h4 className="font-bold text-base text-[var(--wn-text-inverse)]">{cond.title}</h4>
                          <p className="text-[var(--wn-text-inverse)]/80 text-xs leading-relaxed">{cond.desc}</p>
                        </div>
                      ))}
                    </div>

                    {/* الروايات والقراءات المتاحة */}
                    <div className="border-t border-[var(--wn-white)]/15 pt-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-[var(--wn-gold)]">{isRTL ? 'الروايات والقراءات المتاحة للإجازة:' : 'Available Narrations for Ijazah:'}</p>
                        <p className="text-sm text-[var(--wn-text-inverse)]/90">
                          {isRTL
                            ? 'رواية حفص عن عاصم • قراءة عاصم (حفص وشعبة) • قراءة الإمام نافع (ورش وقالون) • القراءات السبع • القراءات العشر الصغرى والكبرى'
                            : 'Hafs from Asim • Asim (Hafs & Shu\'bah) • Nafi\' (Warsh & Qalun) • 7 Qira\'at • 10 Minor & Major Qira\'at'}
                        </p>
                      </div>

                      <Link
                        to={localizedPath('/teachers?specialty=ijazah', locale)}
                        className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--wn-gold)] hover:bg-[var(--wn-sand)] text-[var(--wn-emerald-deep)] font-bold text-xs transition"
                      >
                        {isRTL ? 'عرض شيوخ ومقرئي الإجازة' : 'View Certified Scholars'}
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                3. مسار تأسيس الأطفال والبراعم
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'kids' && (
              <motion.div
                key="kids"
                id="track-panel-kids"
                role="tabpanel"
                aria-labelledby="track-tab-kids"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header */}
                <div className="bg-[var(--wn-surface-soft)] rounded-3xl p-8 border border-[var(--wn-border-strong)] shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold)] text-[var(--wn-emerald-deep)] shadow-sm">
                        {isRTL ? 'المسار الثالث — براعم النور' : 'Track 3 — Young Buds Foundation'}
                      </span>
                      <h2 className="text-3xl font-black text-[var(--wn-heading)]">
                        {isRTL ? 'مسار تأسيس الأطفال: القاعدة النورانية ونور البيان' : 'Kids Quranic Foundation: Noorania & Noor Al-Bayan'}
                      </h2>
                      <p className="text-[var(--wn-text-secondary)] max-w-2xl text-base leading-relaxed">
                        {isRTL
                          ? 'رحلة مرحة ومتقنة تنقل الطفل من الصفر لتهجئة القرآن الكريم وقراءته برسم المصحف، مع تدريبات النطق السليم لمخارج الحروف والتلقين التفاعلي بالصوت والصورة.'
                          : 'A joyful and structured path taking children from basic letter recognition to reading directly from the Mushaf with correct articulation.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/programs/kids', locale)}
                      className="min-h-[44px] inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isRTL ? 'صفحة مسابقات وجوائز الأطفال' : 'Kids Contests & Awards'}</span>
                      <ArrowIcon size={18} />
                    </Link>
                  </div>
                </div>

                {/* المنهجان التأسيسيان */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* نور البيان */}
                  <div className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border)] shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)]">
                        {isRTL ? 'المنهج الأكثر شمولاً' : 'Most Comprehensive'}
                      </span>
                      <span className="text-xs text-[var(--wn-text-tertiary)] font-bold">{isRTL ? 'من 4 إلى 10 سنوات' : 'Ages 4-10'}</span>
                    </div>

                    <h3 className="text-2xl font-bold text-[var(--wn-heading)]">{isRTL ? 'منهج نور البيان لترتيل القرآن' : 'Noor Al-Bayan Curriculum'}</h3>
                    <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">
                      {isRTL
                        ? 'منهج تربوي مصري عريق يعتمد التدرج المنطقي: الحروف الهجائية، الحركات القصيرة (فتح، كسر، ضم)، المدود الثلاثة، التنوين، السكون، اللام الشمسية والقمرية، والشدة مع الترتيل.'
                        : 'A renowned pedagogical system teaching short vowels, three extensions (Madd), tanween, sukun, and shaddah directly applied to Quranic verses.'}
                    </p>

                    <div className="space-y-2 border-t border-[var(--wn-border)] pt-4">
                      <h4 className="text-xs font-bold text-[var(--wn-text-primary)]">{isRTL ? 'مخرجات تعلم نور البيان:' : 'Learning Outcomes:'}</h4>
                      <ul className="text-xs text-[var(--wn-text-secondary)] space-y-1.5">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-link)] shrink-0" />
                          <span>{isRTL ? 'القدرة على تهجئة وقراءة أي كلمة في المصحف الشريف' : 'Ability to spell and recite any word from the Mushaf'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-link)] shrink-0" />
                          <span>{isRTL ? 'التمييز البصري بين الرسم الإملائي والرسم العثماني' : 'Visual distinction between standard & Ottoman script'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-link)] shrink-0" />
                          <span>{isRTL ? 'تطبيق أحكام الغنن والقلقلة عملياً أثناء القراءة' : 'Practical application of Ghunnah and Qalqalah'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* القاعدة النورانية */}
                  <div className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border)] shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border)]">
                        {isRTL ? 'المنهج الصوتي العالمي' : 'Acoustic Precision'}
                      </span>
                      <span className="text-xs text-[var(--wn-text-tertiary)] font-bold">{isRTL ? 'لكل البراعم والمبتدئين' : 'All Young Beginners'}</span>
                    </div>

                    <h3 className="text-2xl font-bold text-[var(--wn-heading)]">{isRTL ? 'منهج القاعدة النورانية' : 'Al-Qa\'ida Al-Nooraniyya'}</h3>
                    <p className="text-[var(--wn-text-secondary)] text-sm leading-relaxed">
                      {isRTL
                        ? 'تأليف الشيخ نور محمد حقاني، ترتكز على الضبط النغمي والفونيمي الدقيق للحرف العربي، وتدريب عضلة اللسان والفك على مخارج الحروف من غير إرهاق.'
                        : 'Designed by Sheikh Noor Muhammad Haqqani, focusing on precise phonetics and exercising jaw muscles for authentic Arabic pronunciation.'}
                    </p>

                    <div className="space-y-2 border-t border-[var(--wn-border)] pt-4">
                      <h4 className="text-xs font-bold text-[var(--wn-text-primary)]">{isRTL ? 'مخرجات تعلم القاعدة النورانية:' : 'Learning Outcomes:'}</h4>
                      <ul className="text-xs text-[var(--wn-text-secondary)] space-y-1.5">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                          <span>{isRTL ? 'فصاحة اللسان وتفخيم وترقيق الحروف باحترافية' : 'Tongue eloquence and mastering heavy & light letters'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                          <span>{isRTL ? 'التدريب التناغمي على الحروف المركبة والمقطعة' : 'Harmonious practice on compound and disjointed letters'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-[var(--wn-text-gold)] shrink-0" />
                          <span>{isRTL ? 'تجهيز الطفل للانخراط الفوري في مسار التحفيظ' : 'Immediate readiness for full Quran memorization track'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* تدريبات مخارج الحروف المصورة */}
                <div className="bg-[var(--wn-surface)] rounded-3xl p-8 border border-[var(--wn-border)] shadow-sm space-y-6">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <h3 className="text-2xl font-bold text-[var(--wn-heading)]">{isRTL ? 'تدريبات النطق السليم ومخارج الحروف للأطفال' : 'Child-Friendly Articulation & Phonetics'}</h3>
                    <p className="text-[var(--wn-text-secondary)] text-sm">
                      {isRTL
                        ? 'شرح مبسط ومصور لمخارج الحروف الخمسة العامة بالرسوم التوضيحية والصوت التفاعلي:'
                        : 'Visual, simplified explanations of the 5 major articulation zones:'}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      {
                        name: isRTL ? 'الجوف' : 'Al-Jawf (Oral Cavity)',
                        letters: isRTL ? 'حروف المد الثلاثة (ا، و، ي)' : 'Madd letters (A, W, Y)',
                        color: 'border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-heading)]',
                        desc: isRTL ? 'مخرج مقدر يخرج منه الهواء الممدود براحة.' : 'Estimated outlet for long vowel airflow.'
                      },
                      {
                        name: isRTL ? 'الحلق' : 'Al-Halq (Throat)',
                        letters: isRTL ? 'أ، هـ، ع، ح، غ، خ' : 'Hamzah, Haa, Ayn, Haa, Ghayn, Khaa',
                        color: 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]',
                        desc: isRTL ? 'أقصى، وسط، وأدنى الحلق مع التمييز الواضح.' : 'Deep, middle, and upper throat sounds.'
                      },
                      {
                        name: isRTL ? 'اللسان' : 'Al-Lisan (Tongue)',
                        letters: isRTL ? '18 حرفاً (الضاد، القاف، الكاف...)' : '18 letters (Dhad, Qaf, Kaf...)',
                        color: 'border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-text-primary)]',
                        desc: isRTL ? 'المخرج الأوسع الذي نوليه تدريباً فردياً خاصاً.' : 'The largest zone receiving personalized drill.'
                      },
                      {
                        name: isRTL ? 'الشفتان' : 'Al-Shafatan (Lips)',
                        letters: isRTL ? 'الفاء، الباء، الميم، الواو' : 'Faa, Baa, Meem, Waw',
                        color: 'border-[var(--wn-women-border)] bg-[var(--wn-women-soft)] text-[var(--wn-text-primary)]',
                        desc: isRTL ? 'انطباق وانفتاح الشفتين بنطق طفولي نقي.' : 'Clean closure and rounding of the lips.'
                      },
                      {
                        name: isRTL ? 'الخيشوم' : 'Al-Khayshum (Nasal)',
                        letters: isRTL ? 'صوت الغنة (الميم والنون)' : 'Ghunnah sound (M & N)',
                        color: 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]',
                        desc: isRTL ? 'الرنين الأنفي الجميل الذي يزين التلاوة.' : 'Sweet nasal resonance enriching recitation.'
                      }
                    ].map((m, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 border ${m.color} space-y-2 flex flex-col justify-between`}>
                        <div className="space-y-1">
                          <h4 className="font-bold text-base">{m.name}</h4>
                          <p className="text-xs font-semibold opacity-90">{m.letters}</p>
                        </div>
                        <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed pt-2 border-t border-[var(--wn-border)]">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══ Bottom Call to Action ═══ */}
        <section className="bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] py-16 px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              {ui.ctaTitle}
            </h2>
            <p className="text-[var(--wn-text-inverse)]/85 text-base max-w-2xl mx-auto">
              {ui.ctaLead}
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link
                to={localizedPath('/free-trial', locale)}
                className="min-h-[44px] inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-bold bg-[var(--wn-gold)] hover:bg-[var(--wn-sand)] text-[var(--wn-emerald-deep)] shadow-lg hover:shadow-xl transition-all text-base"
              >
                {ui.ctaTrial}
              </Link>
              <Link
                to={localizedPath('/courses', locale)}
                className="min-h-[44px] inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-bold bg-[var(--wn-white)]/10 hover:bg-[var(--wn-white)]/20 border border-[var(--wn-white)]/25 text-[var(--wn-text-inverse)] transition-all text-base"
              >
                {ui.ctaCourses}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
