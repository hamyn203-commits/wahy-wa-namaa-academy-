import {
  Award,
  BadgeCheck,
  Banknote,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Gamepad2,
  Gift,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Languages,
  LibraryBig,
  MapPinned,
  Medal,
  MessageCircleQuestion,
  MonitorPlay,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

export const v4Markets = [
  {
    slug: 'arab-world',
    region: 'العالم العربي',
    regionEn: 'Arab World',
    regionByLocale: {
      ar: 'العالم العربي',
      en: 'Arab World',
      fr: 'Monde arabe',
      de: 'Arabische Welt',
      tr: 'Arap Dünyası',
      ur: 'عرب دنیا',
      id: 'Dunia Arab',
      ms: 'Dunia Arab',
      ku: 'جیهانی عەرەبی',
    },
    countries: ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن', 'العراق', 'المغرب', 'الجزائر', 'تونس'],
    countriesEn: ['Egypt', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Iraq', 'Morocco', 'Algeria', 'Tunisia'],
    countriesByLocale: {
      ar: ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن', 'العراق', 'المغرب', 'الجزائر', 'تونس'],
      en: ['Egypt', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Iraq', 'Morocco', 'Algeria', 'Tunisia'],
      fr: ['Égypte', 'Arabie saoudite', 'Émirats arabes unis', 'Koweït', 'Qatar', 'Bahreïn', 'Oman', 'Jordanie', 'Irak', 'Maroc', 'Algérie', 'Tunisie'],
      de: ['Ägypten', 'Saudi-Arabien', 'VAE', 'Kuwait', 'Katar', 'Bahrain', 'Oman', 'Jordanien', 'Irak', 'Marokko', 'Algerien', 'Tunesien'],
      tr: ['Mısır', 'Suudi Arabistan', 'BAE', 'Kuveyt', 'Katar', 'Bahreyn', 'Umman', 'Ürdün', 'Irak', 'Fas', 'Cezayir', 'Tunus'],
      ur: ['مصر', 'سعودی عرب', 'متحدہ عرب امارات', 'کویت', 'قطر', 'بحرین', 'عمان', 'اردن', 'عراق', 'مراکش', 'الجزائر', 'تونس'],
      id: ['Mesir', 'Arab Saudi', 'UEA', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Yordania', 'Irak', 'Maroko', 'Aljazair', 'Tunisia'],
      ms: ['Mesir', 'Arab Saudi', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Iraq', 'Maghribi', 'Algeria', 'Tunisia'],
      ku: ['میسر', 'سعوودیە', 'ئیمارات', 'کوەیت', 'قەتەر', 'بەحرەین', 'عومان', 'ئوردن', 'عێراق', 'مەغریب', 'جەزائیر', 'تونس'],
    },
    services: ['تحفيظ القرآن', 'التجويد', 'الإجازات', 'اللغة العربية', 'الدراسات الإسلامية'],
    servicesEn: ['Quran Memorization', 'Tajweed', 'Ijazah', 'Arabic Language', 'Islamic Studies'],
    servicesByLocale: {
      ar: ['تحفيظ القرآن', 'التجويد', 'الإجازات', 'اللغة العربية', 'الدراسات الإسلامية'],
      en: ['Quran Memorization', 'Tajweed', 'Ijazah', 'Arabic Language', 'Islamic Studies'],
      fr: ['Mémorisation du Coran', 'Tajweed', 'Ijazah', 'Langue arabe', 'Études islamiques'],
      de: ['Koran-Auswendiglernen', 'Tadschwid', 'Idschaza', 'Arabische Sprache', 'Islamwissenschaften'],
      tr: ['Kur’an Ezberi', 'Tecvid', 'İcazet', 'Arapça', 'İslami İlimler'],
      ur: ['حفظِ قرآن', 'تجوید', 'اجازت و سند', 'عربی زبان', 'اسلامی علوم'],
      id: ['Hafalan Al-Quran', 'Tajwid', 'Ijazah', 'Bahasa Arab', 'Studi Islam'],
      ms: ['Hafazan Al-Quran', 'Tajwid', 'Ijazah', 'Bahasa Arab', 'Pengajian Islam'],
      ku: ['لەبەرکردنی قورئان', 'تەجوید', 'ئیجازە', 'زمانی عەرەبی', 'زانیاری ئیسلامی'],
    },
    currency: 'SAR',
    language: 'ar',
    timezone: 'Asia/Riyadh',
  },
  {
    slug: 'americas',
    region: 'السوق الأمريكي',
    regionEn: 'Americas',
    regionByLocale: {
      ar: 'السوق الأمريكي',
      en: 'Americas',
      fr: 'Amériques',
      de: 'Amerika',
      tr: 'Amerika',
      ur: 'امریکہ',
      id: 'Amerika',
      ms: 'Amerika',
      ku: 'ئەمریکا',
    },
    countries: ['الولايات المتحدة', 'كندا'],
    countriesEn: ['United States', 'Canada'],
    countriesByLocale: {
      ar: ['الولايات المتحدة', 'كندا'],
      en: ['United States', 'Canada'],
      fr: ['États-Unis', 'Canada'],
      de: ['Vereinigte Staaten', 'Kanada'],
      tr: ['Amerika Birleşik Devletleri', 'Kanada'],
      ur: ['ریاستہائے متحدہ امریکہ', 'کینیڈا'],
      id: ['Amerika Serikat', 'Kanada'],
      ms: ['Amerika Syarikat', 'Kanada'],
      ku: ['ویلایەتە یەکگرتووەکان', 'کەنەدا'],
    },
    services: ['تحفيظ القرآن', 'اللغة العربية', 'الدراسات الإسلامية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
    servicesEn: ['Quran Memorization', 'Arabic Language', 'Islamic Studies', 'Kids Programs', 'Reverts Programs'],
    servicesByLocale: {
      ar: ['تحفيظ القرآن', 'اللغة العربية', 'الدراسات الإسلامية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
      en: ['Quran Memorization', 'Arabic Language', 'Islamic Studies', 'Kids Programs', 'Reverts Programs'],
      fr: ['Mémorisation du Coran', 'Langue arabe', 'Études islamiques', 'Programmes enfants', 'Nouveaux musulmans'],
      de: ['Koran-Auswendiglernen', 'Arabische Sprache', 'Islamwissenschaften', 'Kinderprogramme', 'Neue Muslime'],
      tr: ['Kur’an Ezberi', 'Arapça', 'İslami İlimler', 'Çocuk Programları', 'Yeni Müslümanlar'],
      ur: ['حفظِ قرآن', 'عربی زبان', 'اسلامی علوم', 'بچوں کے پروگرام', 'نو مسلم پروگرام'],
      id: ['Hafalan Al-Quran', 'Bahasa Arab', 'Studi Islam', 'Program Anak', 'Program Mualaf'],
      ms: ['Hafazan Al-Quran', 'Bahasa Arab', 'Pengajian Islam', 'Program Kanak-Kanak', 'Program Saudara Baru'],
      ku: ['لەبەرکردنی قورئان', 'زمانی عەرەبی', 'زانیاری ئیسلامی', 'بەرنامەی منداڵان', 'بەرنامەی موسڵمانانی نوێ'],
    },
    currency: 'USD',
    language: 'en',
    timezone: 'America/New_York',
  },
  {
    slug: 'europe',
    region: 'السوق الأوروبي',
    regionEn: 'Europe',
    regionByLocale: {
      ar: 'السوق الأوروبي',
      en: 'Europe',
      fr: 'Europe',
      de: 'Europa',
      tr: 'Avrupa',
      ur: 'یورپ',
      id: 'Eropa',
      ms: 'Eropah',
      ku: 'ئەوروپا',
    },
    countries: ['بريطانيا', 'فرنسا', 'ألمانيا', 'هولندا', 'بلجيكا', 'السويد'],
    countriesEn: ['United Kingdom', 'France', 'Germany', 'Netherlands', 'Belgium', 'Sweden'],
    countriesByLocale: {
      ar: ['بريطانيا', 'فرنسا', 'ألمانيا', 'هولندا', 'بلجيكا', 'السويد'],
      en: ['United Kingdom', 'France', 'Germany', 'Netherlands', 'Belgium', 'Sweden'],
      fr: ['Royaume-Uni', 'France', 'Allemagne', 'Pays-Bas', 'Belgique', 'Suède'],
      de: ['Vereinigtes Königreich', 'Frankreich', 'Deutschland', 'Niederlande', 'Belgien', 'Schweden'],
      tr: ['Birleşik Krallık', 'Fransa', 'Almanya', 'Hollanda', 'Belçika', 'İsveç'],
      ur: ['برطانیہ', 'فرانس', 'جرمنی', 'نیدرلینڈز', 'بلجیم', 'سویڈن'],
      id: ['Inggris', 'Prancis', 'Jerman', 'Belanda', 'Belgia', 'Swedia'],
      ms: ['United Kingdom', 'Perancis', 'Jerman', 'Belanda', 'Belgium', 'Sweden'],
      ku: ['بەریتانیا', 'فەڕەنسا', 'ئەڵمانیا', 'هۆڵەندا', 'بەلجیکا', 'سوید'],
    },
    services: ['تعليم القرآن', 'تعليم العربية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
    servicesEn: ['Quran Learning', 'Arabic Learning', 'Kids Programs', 'New Muslims Programs'],
    servicesByLocale: {
      ar: ['تعليم القرآن', 'تعليم العربية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
      en: ['Quran Learning', 'Arabic Learning', 'Kids Programs', 'New Muslims Programs'],
      fr: ['Apprentissage du Coran', 'Apprentissage de l’arabe', 'Programmes enfants', 'Nouveaux musulmans'],
      de: ['Koran lernen', 'Arabisch lernen', 'Kinderprogramme', 'Neue Muslime'],
      tr: ['Kur’an Öğrenimi', 'Arapça Öğrenimi', 'Çocuk Programları', 'Yeni Müslümanlar'],
      ur: ['تعلیمِ قرآن', 'عربی تعلیم', 'بچوں کے پروگرام', 'نو مسلم پروگرام'],
      id: ['Belajar Al-Quran', 'Belajar Bahasa Arab', 'Program Anak', 'Program Mualaf'],
      ms: ['Pembelajaran Al-Quran', 'Pembelajaran Arab', 'Program Kanak-Kanak', 'Program Saudara Baru'],
      ku: ['فێربوونی قورئان', 'فێربوونی عەرەبی', 'بەرنامەی منداڵان', 'بەرنامەی موسڵمانانی نوێ'],
    },
    currency: 'EUR',
    language: 'fr',
    timezone: 'Europe/London',
  },
  {
    slug: 'turkey',
    region: 'السوق التركي',
    regionEn: 'Turkey',
    regionByLocale: {
      ar: 'السوق التركي',
      en: 'Turkey',
      fr: 'Turquie',
      de: 'Türkei',
      tr: 'Türkiye',
      ur: 'ترکی',
      id: 'Turki',
      ms: 'Turki',
      ku: 'تورکیا',
    },
    countries: ['تركيا'],
    countriesEn: ['Turkey'],
    countriesByLocale: {
      ar: ['تركيا'],
      en: ['Turkey'],
      fr: ['Turquie'],
      de: ['Türkei'],
      tr: ['Türkiye'],
      ur: ['ترکی'],
      id: ['Turki'],
      ms: ['Turki'],
      ku: ['تورکیا'],
    },
    services: ['القرآن الكريم', 'اللغة العربية', 'التجويد'],
    servicesEn: ['Holy Quran', 'Arabic Language', 'Tajweed'],
    servicesByLocale: {
      ar: ['القرآن الكريم', 'اللغة العربية', 'التجويد'],
      en: ['Holy Quran', 'Arabic Language', 'Tajweed'],
      fr: ['Saint Coran', 'Langue arabe', 'Tajweed'],
      de: ['Heiliger Koran', 'Arabische Sprache', 'Tadschwid'],
      tr: ['Kur’an-ı Kerim', 'Arapça', 'Tecvid'],
      ur: ['قرآنِ مجید', 'عربی زبان', 'تجوید'],
      id: ['Al-Quran Al-Karim', 'Bahasa Arab', 'Tajwid'],
      ms: ['Al-Quran Al-Karim', 'Bahasa Arab', 'Tajwid'],
      ku: ['قورئانی پیرۆز', 'زمانی عەرەبی', 'تەجوید'],
    },
    currency: 'TRY',
    language: 'tr',
    timezone: 'Europe/Istanbul',
  },
  {
    slug: 'indonesia-malaysia',
    region: 'السوق الإندونيسي والماليزي',
    regionEn: 'Indonesia & Malaysia',
    regionByLocale: {
      ar: 'السوق الإندونيسي والماليزي',
      en: 'Indonesia & Malaysia',
      fr: 'Indonésie et Malaisie',
      de: 'Indonesien & Malaysia',
      tr: 'Endonezya ve Malezya',
      ur: 'انڈونیشیا اور ملائیشیا',
      id: 'Indonesia & Malaysia',
      ms: 'Indonesia & Malaysia',
      ku: 'ئەندەنوسیا و مالیزیا',
    },
    countries: ['إندونيسيا', 'ماليزيا'],
    countriesEn: ['Indonesia', 'Malaysia'],
    countriesByLocale: {
      ar: ['إندونيسيا', 'ماليزيا'],
      en: ['Indonesia', 'Malaysia'],
      fr: ['Indonésie', 'Malaisie'],
      de: ['Indonesien', 'Malaysia'],
      tr: ['Endonezya', 'Malezya'],
      ur: ['انڈونیشیا', 'ملائیشیا'],
      id: ['Indonesia', 'Malaysia'],
      ms: ['Indonesia', 'Malaysia'],
      ku: ['ئەندەنوسیا', 'مالیزیا'],
    },
    services: ['حفظ القرآن', 'تعليم العربية', 'برامج الأطفال'],
    servicesEn: ['Quran Memorization', 'Arabic Learning', 'Kids Programs'],
    servicesByLocale: {
      ar: ['حفظ القرآن', 'تعليم العربية', 'برامج الأطفال'],
      en: ['Quran Memorization', 'Arabic Learning', 'Kids Programs'],
      fr: ['Mémorisation du Coran', 'Apprentissage de l’arabe', 'Programmes enfants'],
      de: ['Koran-Auswendiglernen', 'Arabisch lernen', 'Kinderprogramme'],
      tr: ['Kur’an Ezberi', 'Arapça Öğrenimi', 'Çocuk Programları'],
      ur: ['حفظِ قرآن', 'عربی تعلیم', 'بچوں کے پروگرام'],
      id: ['Hafalan Al-Quran', 'Belajar Bahasa Arab', 'Program Anak'],
      ms: ['Hafazan Al-Quran', 'Pembelajaran Arab', 'Program Kanak-Kanak'],
      ku: ['لەبەرکردنی قورئان', 'فێربوونی عەرەبی', 'بەرنامەی منداڵان'],
    },
    currency: 'IDR',
    language: 'id',
    timezone: 'Asia/Jakarta',
  },
  {
    slug: 'south-asia',
    region: 'السوق الباكستاني والهندي',
    regionEn: 'South Asia',
    regionByLocale: {
      ar: 'السوق الباكستاني والهندي',
      en: 'South Asia',
      fr: 'Asie du Sud',
      de: 'Südasien',
      tr: 'Güney Asya',
      ur: 'جنوبی ایشیا',
      id: 'Asia Selatan',
      ms: 'Asia Selatan',
      ku: 'باشووری ئاسیا',
    },
    countries: ['باكستان', 'الهند'],
    countriesEn: ['Pakistan', 'India'],
    countriesByLocale: {
      ar: ['باكستان', 'الهند'],
      en: ['Pakistan', 'India'],
      fr: ['Pakistan', 'Inde'],
      de: ['Pakistan', 'Indien'],
      tr: ['Pakistan', 'Hindistan'],
      ur: ['پاکستان', 'بھارت'],
      id: ['Pakistan', 'India'],
      ms: ['Pakistan', 'India'],
      ku: ['پاکستان', 'هیندستان'],
    },
    services: ['تحفيظ القرآن', 'التجويد', 'الإجازات'],
    servicesEn: ['Quran Memorization', 'Tajweed', 'Ijazah'],
    servicesByLocale: {
      ar: ['تحفيظ القرآن', 'التجويد', 'الإجازات'],
      en: ['Quran Memorization', 'Tajweed', 'Ijazah'],
      fr: ['Mémorisation du Coran', 'Tajweed', 'Ijazah'],
      de: ['Koran-Auswendiglernen', 'Tadschwid', 'Idschaza'],
      tr: ['Kur’an Ezberi', 'Tecvid', 'İcazet'],
      ur: ['حفظِ قرآن', 'تجوید', 'اجازت و سند'],
      id: ['Hafalan Al-Quran', 'Tajwid', 'Ijazah'],
      ms: ['Hafazan Al-Quran', 'Tajwid', 'Ijazah'],
      ku: ['لەبەرکردنی قورئان', 'تەجوید', 'ئیجازە'],
    },
    currency: 'PKR',
    language: 'ur',
    timezone: 'Asia/Karachi',
  },
];

export function getMarketRegion(market, locale = 'en') {
  if (!market) return '';
  return market.regionByLocale?.[locale] || market.regionByLocale?.en || market.regionEn || market.region || '';
}

export function getMarketCountries(market, locale = 'en') {
  if (!market) return [];
  return market.countriesByLocale?.[locale] || market.countriesByLocale?.en || market.countriesEn || market.countries || [];
}

export function getMarketServices(market, locale = 'en') {
  if (!market) return [];
  return market.servicesByLocale?.[locale] || market.servicesByLocale?.en || market.servicesEn || market.services || [];
}

export const v4Languages = [
  { code: 'ar', name: 'العربية', dir: 'RTL', seo: 'ar/wahy-namaa-quran-academy' },
  { code: 'en', name: 'English', dir: 'LTR', seo: 'en/quran-memorization-online' },
  { code: 'fr', name: 'Français', dir: 'LTR', seo: 'fr/apprendre-le-coran' },
  { code: 'tr', name: 'Türkçe', dir: 'LTR', seo: 'tr/online-kuran-egitimi' },
  { code: 'de', name: 'Deutsch', dir: 'LTR', seo: 'de/koran-online-lernen' },
  { code: 'ur', name: 'الأردية', dir: 'RTL', seo: 'ur/quran-academy' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'LTR', seo: 'id/akademi-alquran-online' },
  { code: 'ms', name: 'Malay', dir: 'LTR', seo: 'ms/akademi-al-quran' },
  { code: 'ku', name: 'کوردی', dir: 'RTL', seo: 'ku/quran-academy' },
];

export const v4Currencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'PKR', 'IDR'];

export const v4TimeZones = [
  { city: 'نيويورك', zone: 'America/New_York' },
  { city: 'لندن', zone: 'Europe/London' },
  { city: 'الرياض', zone: 'Asia/Riyadh' },
  { city: 'إسطنبول', zone: 'Europe/Istanbul' },
  { city: 'القاهرة', zone: 'Africa/Cairo' },
  { city: 'جاكرتا', zone: 'Asia/Jakarta' },
];

export const v4TeacherPipeline = [
  'البيانات الشخصية',
  'المؤهلات والشهادات',
  'الإجازات والسند',
  'فيديوهات التلاوة',
  'تسجيلات صوتية',
  'مقابلة شخصية',
  'OTP وTelegram وWhatsApp وEmail Verification',
  'تقييم التجويد والصوت والخبرة والالتزام وتقييم الطلاب',
];

export const v4PortalSections = [
  {
    title: 'لوحة المعلم V4',
    icon: PanelsTopLeft,
    items: ['الأرباح اليومية والأسبوعية والشهرية', 'إدارة الطلاب والملاحظات والتقارير', 'الواجبات والاختبارات والتسجيلات الصوتية', 'المواعيد والإجازات والحصص المتاحة'],
  },
  {
    title: 'لوحة الطالب العالمية',
    icon: GraduationCap,
    items: ['الملف الأكاديمي والمستوى والإنجازات والشهادات', 'الحصص القادمة والسابقة والتسجيلات', 'رفع الواجبات والتسجيلات', 'تحميل جميع الشهادات'],
  },
  {
    title: 'لوحة ولي الأمر',
    icon: Users,
    items: ['الحضور والغياب', 'الواجبات والتقييمات', 'متابعة الحفظ والتقدم', 'ملخص أسبوعي للأسرة'],
  },
];

export const v4AiSystems = [
  {
    title: 'تقييم التلاوة بالذكاء الاصطناعي',
    icon: Bot,
    items: ['تحليل المدود', 'الغنة', 'أحكام النون الساكنة', 'الوقف والابتداء', 'مخارج الحروف', 'تقرير فوري قابل للمراجعة'],
  },
  {
    title: 'مساعد قرآني ذكي',
    icon: MessageCircleQuestion,
    items: ['خطة حفظ يومية', 'مراجعة ذكية', 'شرح التجويد', 'تدريب اللغة العربية'],
  },
  {
    title: 'مساعد للمعلمين',
    icon: Sparkles,
    items: ['إعداد الواجبات', 'إعداد الاختبارات', 'كتابة التقارير', 'اقتراح تدخلات تعليمية'],
  },
];

export const v4LearningSystems = [
  { title: 'LMS عالمي', icon: LibraryBig, items: ['دورات', 'مستويات', 'اختبارات', 'شهادات', 'تقييمات', 'واجبات'] },
  { title: 'نظام الاختبارات', icon: ClipboardCheck, items: ['اختيار من متعدد', 'صح وخطأ', 'صوتي', 'شفوي', 'عملي'] },
  { title: 'الشهادات الذكية', icon: FileCheck2, items: ['PDF تلقائي', 'QR Code', 'رقم تحقق', 'رابط تحقق إلكتروني'] },
  { title: 'نظام الاجتماعات', icon: Video, items: ['Zoom', 'Google Meet', 'مشاركة الشاشة', 'سبورة تفاعلية', 'تسجيل'] },
  { title: 'مكتبة الفيديو العالمية', icon: MonitorPlay, items: ['القرآن', 'التجويد', 'العربية', 'العقيدة', 'الفقه', 'السيرة'] },
];

export const v4GrowthSystems = [
  { title: 'المسلمون الجدد', icon: HeartHandshake, items: ['برامج تعريفية', 'إنجليزية وفرنسية وإسبانية', 'مسارات دعم فردية'] },
  { title: 'قسم الأطفال', icon: Gamepad2, items: ['ألعاب تعليمية', 'مكافآت', 'مسابقات', 'بيئة آمنة'] },
  { title: 'Gamification', icon: Medal, items: ['نقاط', 'أوسمة', 'مستويات', 'بطولات شهرية'] },
  { title: 'نظام السفراء', icon: Gift, items: ['دعوات الطلاب', 'خصومات', 'نقاط', 'حصص مجانية'] },
  { title: 'تطبيق الهاتف', icon: Smartphone, items: ['Android', 'iOS', 'إشعارات', 'حصص', 'تسجيلات', 'شهادات'] },
  { title: 'أكاديمية النساء', icon: ShieldCheck, items: ['قسم مستقل بالكامل', 'معلمات فقط', 'طالبات فقط'] },
  { title: 'نظام التبرعات', icon: CircleDollarSign, items: ['كفالة طالب', 'كفالة معلم', 'كفالة حلقة قرآن'] },
  { title: 'مركز التوظيف', icon: BriefcaseBusiness, items: ['معلمين', 'مترجمين', 'مشرفين'] },
];

export const v4Kpis = [
  { label: 'دولة مستهدفة', value: '100+', icon: Globe2 },
  { label: 'لغة مدعومة', value: '9', icon: Languages },
  { label: 'عملة عالمية', value: '9', icon: Banknote },
  { label: 'لوحة تشغيل', value: '3', icon: ChartNoAxesCombined },
  { label: 'مسارات AI', value: '3', icon: Bot },
  { label: 'نظام تعليمي', value: '5+', icon: BookOpen },
];

export const v4Roadmap = [
  { phase: 'المرحلة 1', title: 'التوسع العالمي', status: 'جاهز بالواجهة', icon: MapPinned },
  { phase: 'المرحلة 2', title: 'لوحات التشغيل العالمية', status: 'جاهز كنموذج تشغيلي', icon: PanelsTopLeft },
  { phase: 'المرحلة 3', title: 'AI وLMS والشهادات', status: 'جاهز للتوصيل بالـ API', icon: BadgeCheck },
  { phase: 'المرحلة 4', title: 'النمو والموبايل والتوظيف', status: 'منشور v4.2', icon: Award },
  { phase: 'المرحلة 5', title: 'PWA + إدارة النمو + Bedrock', status: 'منشور v4.3', icon: CalendarClock },
  { phase: 'V5', title: 'منصة تخدم مليون طالب', status: 'منشور v6.1', icon: Smartphone },
  { phase: 'V6', title: 'تجربة مستخدم + AI + PWA', status: 'منشور v6.1', icon: CalendarClock },
];

export function formatCurrencyPreview(currency, locale = 'ar-EG') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(45);
}

export function formatZoneTime(zone, locale = 'ar-EG') {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  }).format(new Date());
}

export const v4QuickActions = [
  { label: 'اختيار المسار', icon: BookOpen, path: '/courses' },
  { label: 'حجز حصة تجريبية', icon: Clock3, path: '/teachers' },
  { label: 'رفع تلاوة', icon: Bot, path: '/ai' },
  { label: 'إصدار شهادة', icon: FileCheck2, path: '/student/dashboard' },
];
