/** Single source of truth for static indexable routes, localized metadata, and noindex rules. */

export const DEFAULT_SITE_URL = 'https://wahywanamaa.com';
export const SEO_LOCALES = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];
export const RTL_LOCALES = ['ar', 'ur', 'ku'];

export const OG_LOCALE = {
  ar: 'ar_EG',
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  tr: 'tr_TR',
  ur: 'ur_PK',
  id: 'id_ID',
  ms: 'ms_MY',
  ku: 'ku_IQ',
};

export const LOCALE_BRAND = {
  ar: {
    appName: 'وَحْيٌ وَنَمَاء',
    appNameFull: 'أكاديمية وَحْيٌ وَنَمَاء',
    slogan: 'نتعلم القرآن، نحفظه، وننمو به.',
    seoDescription: 'وَحْيٌ وَنَمَاء — أكاديمية رقمية لتعلّم القرآن الكريم والحفظ والتجويد عبر برامج ومسارات تعليمية حديثة.',
    seoKeywords: 'وحي ونماء, أكاديمية وحي ونماء, نتعلم القرآن نحفظه وننمو به, قرآن, تجويد, تحفيظ, إجازة بالسند المتصل',
  },
  en: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Wahy Wa Namaa Academy',
    slogan: 'Learn the Quran. Memorize it. Grow through it.',
    seoDescription: 'Wahy Wa Namaa — International Quran Academy for memorization, Tajweed and continuous Sanad. Learn the Quran. Memorize it. Grow through it.',
    seoKeywords: 'Wahy Wa Namaa, Wahy Wa Namaa Academy, Learn the Quran, Quran Academy, Online Quran Tajweed, Sanad Ijazah',
  },
  fr: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Académie WAHY WA NAMAA',
    slogan: 'Apprendre le Coran, le mémoriser, et grandir avec lui.',
    seoDescription: 'WAHY WA NAMAA — Académie mondiale du Saint Coran, Tajweed et récitation par Sanad ininterrompu.',
    seoKeywords: 'WAHY WA NAMAA, Académie WAHY WA NAMAA, Coran en ligne, Tajweed, Sanad, mémorisation Coran',
  },
  de: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Wahy Wa Namaa Akademie',
    slogan: 'Lerne den Koran, bewahre ihn, und wachse durch ihn.',
    seoDescription: 'WAHY WA NAMAA — globale Akademie für Quran, Tajweed und authentischen Sanad.',
    seoKeywords: 'WAHY WA NAMAA, Wahy Wa Namaa Akademie, Quran Akademie, Online Quran, Tajweed, Sanad',
  },
  tr: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Wahy Wa Namaa Akademisi',
    slogan: "Kuran'ı öğreniyoruz, ezberliyoruz ve onunla büyüyoruz.",
    seoDescription: 'WAHY WA NAMAA — Kuran, Tecvid ve kesintisiz Senet icazeti için küresel akademi.',
    seoKeywords: 'WAHY WA NAMAA, Wahy Wa Namaa Akademisi, Kuran akademisi, online Kuran, Tecvid, Senet, İcazet',
  },
  ur: {
    appName: 'وحی و نماء',
    appNameFull: 'اکیڈمی وحی و نماء',
    slogan: 'قرآن سیکھیں، حفظ کریں اور اس کے ذریعے نمو پائیں۔',
    seoDescription: 'وحی و نماء — قرآن، تجوید اور متصل سند کی عالمی اکیڈمی۔',
    seoKeywords: 'وحی و نماء, اکیڈمی وحی و نماء, WAHY WA NAMAA, قرآن آن لائن, تجوید, حفظ, سند',
  },
  id: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Akademi WAHY WA NAMAA',
    slogan: 'Pelajari Al-Quran, hafalkan, dan bertumbuh dengannya.',
    seoDescription: 'WAHY WA NAMAA — Akademi global Al-Quran, Tajwid dan Sanad bersambung.',
    seoKeywords: 'WAHY WA NAMAA, Akademi WAHY WA NAMAA, Quran online, Tajwid, Sanad, Tahfidz',
  },
  ms: {
    appName: 'WAHY WA NAMAA',
    appNameFull: 'Akademi WAHY WA NAMAA',
    slogan: 'Pelajari Al-Quran, hafalkannya, dan berkembang melaluinya.',
    seoDescription: 'WAHY WA NAMAA — Akademi global Al-Quran, Tajwid dan Sanad bersambung.',
    seoKeywords: 'WAHY WA NAMAA, Akademi WAHY WA NAMAA, Quran online, Tajwid, Sanad, Tahfiz',
  },
  ku: {
    appName: 'وەحی و نەما',
    appNameFull: 'ئەکادیمیای وەحی و نەما',
    slogan: 'فێری قورئان دەبین، لەبەری دەکەین، و گەشەی پێ دەکەین.',
    seoDescription: 'وەحی و نەما — ئەکادیمیای جیهانی بۆ قورئان و تەجوید و سەنەدی بەستراوە.',
    seoKeywords: 'وەحی و نەما, WAHY WA NAMAA, قورئان, تەجوید, لەبەرکردن, سەنەد',
  },
};

export const STATIC_SEO_ROUTES = [
  {
    path: '/',
    priority: '1.0',
    changefreq: 'weekly',
    schemaType: 'WebPage',
    title: {
      ar: 'وَحْيٌ وَنَمَاء | نتعلم القرآن، نحفظه، وننمو به',
      en: 'Wahy Wa Namaa Academy | Learn. Memorize. Grow.',
      fr: 'WAHY WA NAMAA | Apprendre le Coran, le mémoriser, et grandir avec lui',
      de: 'WAHY WA NAMAA | Lerne den Koran, bewahre ihn, und wachse durch ihn',
      tr: "WAHY WA NAMAA | Kuran'ı öğreniyoruz, ezberliyoruz ve onunla büyüyoruz",
      ur: 'وحی و نماء | قرآن سیکھیں، حفظ کریں اور اس کے ذریعے نمو پائیں',
      id: 'WAHY WA NAMAA | Pelajari Al-Quran, hafalkan, dan bertumbuh dengannya',
      ms: 'WAHY WA NAMAA | Pelajari Al-Quran, hafalkannya, dan berkembang melaluinya',
      ku: 'وەحی و نەما | فێری قورئان دەبین، لەبەری دەکەین، و گەشەی پێ دەکەین',
    },
    description: Object.fromEntries(
      Object.entries(LOCALE_BRAND).map(([loc, brand]) => [loc, brand.seoDescription])
    ),
  },
  {
    path: '/free-trial',
    priority: '0.95',
    changefreq: 'weekly',
    title: {
      ar: 'حصة تجريبية مجانية | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Free Trial Session | Wahy Wa Namaa Academy',
      fr: 'Séance d’essai gratuite | Académie WAHY WA NAMAA',
      de: 'Kostenlose Probestunde | Wahy Wa Namaa Akademie',
      tr: 'Ücretsiz Deneme Dersi | Wahy Wa Namaa Akademisi',
      ur: 'مفت آزمائشی کلاس | اکیڈمی وحی و نماء',
      id: 'Sesi Uji Coba Gratis | Akademi WAHY WA NAMAA',
      ms: 'Sesi Percubaan Percuma | Akademi WAHY WA NAMAA',
      ku: 'وانەی تاقیکردنەوەی بێبەرامبەر | ئەکادیمیای وەحی و نەما',
    },
    description: {
      ar: 'احجز حصتك التجريبية المجانية لتحديد المستوى واختيار المعلم والبدء في حفظ القرآن الكريم وتجويده.',
      en: 'Book your free Quran placement trial session and meet a certified tutor online.',
      fr: 'Réservez votre séance d’essai gratuite pour évaluer votre niveau et commencer le Coran.',
      de: 'Buchen Sie Ihre kostenlose Probestunde zur Einstufung und lernen Sie den Koran online.',
      tr: 'Seviye belirleme ve sertifikalı hoca ile tanışmak için ücretsiz deneme dersi alın.',
      ur: 'اپنی سطح کی جانچ اور مستند استاد کے انتخاب کے لیے مفت آزمائشی سیشن بک کریں۔',
      id: 'Jadwalkan sesi uji coba gratis untuk evaluasi bacaan Al-Quran dan pilih guru terbaik.',
      ms: 'Tempah sesi percubaan percuma untuk penilaian bacaan Al-Quran dan pilih guru bertauliah.',
      ku: 'وانەی تاقیکردنەوەی بێبەرامبەر تۆمار بکە بۆ هەڵسەنگاندنی ئاست و هەڵبژاردنی مامۆستا.',
    },
  },
  {
    path: '/teachers',
    priority: '0.9',
    changefreq: 'daily',
    schemaType: 'CollectionPage',
    title: {
      ar: 'معلمو ومعلمات القرآن الكريم | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Certified Quran Teachers | Wahy Wa Namaa Academy',
      fr: 'Enseignants de Coran certifiés | Académie WAHY WA NAMAA',
      de: 'Zertifizierte Koran-Lehrer | Wahy Wa Namaa Akademie',
      tr: 'Sertifikalı Kuran Hocaları | Wahy Wa Namaa Akademisi',
      ur: 'مستند قرآن اساتذہ | اکیڈمی وحی و نماء',
      id: 'Guru Al-Quran Bersertifikat | Akademi WAHY WA NAMAA',
      ms: 'Guru Al-Quran Bertauliah | Akademi WAHY WA NAMAA',
      ku: 'مامۆستایانی مۆڵەتپێدراوی قورئان | ئەکادیمیای وەحی و نەما',
    },
    description: {
      ar: 'تصفح نخبة معلمي ومعلمات القرآن الكريم والتجويد والإجازات بالسند المتصل واختر المعلم الأنسب لك.',
      en: 'Browse verified male and female Quran, Tajweed, and Ijazah tutors and choose your teacher.',
      fr: 'Découvrez nos enseignants certifiés de Coran, Tajweed et Ijazah en ligne.',
      de: 'Finden Sie geprüfte Lehrerinnen und Lehrer für Quran, Tajweed und Ijazah.',
      tr: 'Kuran, Tecvid ve İcazet alanlarında onaylı hocaları inceleyin ve size uygun olanı seçin.',
      ur: 'قرآن، تجوید اور اجازہ کے مستند اساتذہ اور معلمات کی فہرست دیکھیں۔',
      id: 'Jelajahi guru Al-Quran, Tajwid, dan Sanad yang terverifikasi untuk belajar daring.',
      ms: 'Terokai guru Al-Quran, Tajwid dan Ijazah bertauliah untuk pembelajaran dalam talian.',
      ku: 'مامۆستایانی متمانەپێدراوی قورئان و تەجوید و ئیجازە بگەڕێ و هەڵیبژێرە.',
    },
  },
  {
    path: '/courses',
    priority: '0.9',
    changefreq: 'daily',
    schemaType: 'CollectionPage',
    title: {
      ar: 'البرامج والدورات القرآنية | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Quran & Tajweed Courses | Wahy Wa Namaa Academy',
      fr: 'Cours de Coran et Tajweed | Académie WAHY WA NAMAA',
      de: 'Quran- und Tajweed-Kurse | Wahy Wa Namaa Akademie',
      tr: 'Kuran ve Tecvid Kursları | Wahy Wa Namaa Akademisi',
      ur: 'قرآن و تجوید کورسز | اکیڈمی وحی و نماء',
      id: 'Kursus Al-Quran & Tajwid | Akademi WAHY WA NAMAA',
      ms: 'Kursus Al-Quran & Tajwid | Akademi WAHY WA NAMAA',
      ku: 'خوولەکانی قورئان و تەجوید | ئەکادیمیای وەحی و نەما',
    },
    description: {
      ar: 'من التأسيس والحفظ إلى التجويد والإجازة، استكشف دورات وبرامج أكاديمية وحي ونماء.',
      en: 'Explore structured Quran memorization, Tajweed, Arabic, and Ijazah courses.',
      fr: 'Explorez nos programmes de mémorisation, Tajweed et maîtrise du Coran.',
      de: 'Entdecken Sie strukturierte Kurse für Quran-Auswendiglernen, Tajweed und Grundlagen.',
      tr: 'Temel eğitimden hafızlığa, Tecvid ve icazete kadar tüm kurslarımızı inceleyin.',
      ur: 'بنیادی ناظرہ اور حفظ سے لے کر تجوید و اجازہ تک تمام کورسز دیکھیں۔',
      id: 'Jelajahi kursus tahfidz, tajwid, bahasa Arab, dan program sanad terstruktur.',
      ms: 'Terokai kursus hafazan, tajwid, bahasa Arab dan program bersanad yang tersusun.',
      ku: 'لە بنەڕەت و لەبەرکردنەوە تا تەجوید و ئیجازە، خوولەکانمان ببینە.',
    },
  },
  {
    path: '/tracks',
    priority: '0.85',
    changefreq: 'weekly',
    title: {
      ar: 'المسارات التعليمية التخصصية | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Educational Tracks | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'مسارات تعليمية متدرجة: الحفظ والمراجعة، التجويد والمتون والإجازة، وتأسيس الأطفال.',
      en: 'Structured tracks for Memorization & Revision, Tajweed & Ijazah, and Kids Foundation.',
    },
  },
  {
    path: '/plans',
    priority: '0.85',
    changefreq: 'weekly',
    title: {
      ar: 'خطط الاشتراك والأسعار | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Subscription Plans | Wahy Wa Namaa Academy',
      fr: 'Tarifs et Abonnements | Académie WAHY WA NAMAA',
      de: 'Preise & Tarife | Wahy Wa Namaa Akademie',
      tr: 'Abonelik Planları | Wahy Wa Namaa Akademisi',
      ur: 'فیس اور پیکجز | اکیڈمی وحی و نماء',
      id: 'Paket Langganan | Akademi WAHY WA NAMAA',
      ms: 'Pelan Langganan | Akademi WAHY WA NAMAA',
      ku: 'پاکێج و نرخەکان | ئەکادیمیای وەحی و نەما',
    },
    description: {
      ar: 'خطط مرنة لتعلّم القرآن تبدأ من 10 جنيه للحصة مع حلقات جماعية ومجموعات مركزة وحصص فردية وقسم سيدات.',
      en: 'Flexible Quran learning plans including group circles, focused circles, private sessions, and women-only sections.',
    },
  },
  {
    path: '/blog',
    priority: '0.85',
    changefreq: 'daily',
    schemaType: 'CollectionPage',
    title: {
      ar: 'مكتبة المقالات | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Articles Library | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'مقالات تعليمية حول حفظ القرآن الكريم، التجويد، وتدبر الآيات وتعليم الأطفال.',
      en: 'Published articles on Quran memorization, Tajweed rules, and consistent learning.',
    },
  },
  {
    path: '/library',
    priority: '0.8',
    changefreq: 'weekly',
    title: {
      ar: 'مكتبة التلاوات والمواد التعليمية | وَحْيٌ وَنَمَاء',
      en: 'Audio & Video Library | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'مكتبة مرئية ومسموعة لدروس التجويد والتلاوة والمواد المساندة لطلبة القرآن.',
      en: 'Curated recitations, Tajweed lessons, and learning resources at Wahy Wa Namaa.',
    },
  },
  {
    path: '/programs/kids',
    priority: '0.8',
    changefreq: 'weekly',
    title: {
      ar: 'برنامج تحفيظ الأطفال | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Kids Quran Program | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'تعليم وتحفيظ القرآن الكريم للأطفال بأسلوب تربوي محفّز وتفاعلي عبر الإنترنت.',
      en: 'Engaging and structured online Quran memorization and foundation for children.',
    },
  },
  {
    path: '/programs/reverts',
    priority: '0.8',
    changefreq: 'weekly',
    title: {
      ar: 'برنامج المسلمين الجدد | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'New Muslims Program | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'مسار تأسيسي مخصص للمسلمين الجدد لتعلّم قراءة القرآن وأساسيات التلاوة بلغات متعددة.',
      en: 'Guided beginner learning track designed for new Muslims in multiple languages.',
    },
  },
  {
    path: '/women',
    priority: '0.8',
    changefreq: 'weekly',
    title: {
      ar: 'قسم أكاديمية النساء | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Women Academy Section | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'قسم مستقل للنساء — معلمات مجازات وطالبات فقط في بيئة آمنة ومنظمة.',
      en: 'Dedicated women-only section with certified female Quran teachers and learners.',
    },
  },
  {
    path: '/markets',
    priority: '0.75',
    changefreq: 'weekly',
    title: {
      ar: 'الأسواق والمناطق العالمية | وَحْيٌ وَنَمَاء',
      en: 'Global Markets & Regions | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'اختر المنطقة الأقرب لك لعرض العملة والمناطق الزمنية وخيارات الدراسة المحلية.',
      en: 'Choose your region for localized timezone, currency, and Quran academy services.',
    },
  },
  {
    path: '/markets/arab-world',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'العالم العربي | أكاديمية وَحْيٌ وَنَمَاء', en: 'Arab World | Wahy Wa Namaa Academy' },
    description: { ar: 'برامج وحلقات القرآن الكريم لطلبة مصر والسعودية والإمارات والعالم العربي.', en: 'Quran classes and circles tailored for learners across the Arab World.' },
  },
  {
    path: '/markets/americas',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'أمريكا وكندا | أكاديمية وَحْيٌ وَنَمَاء', en: 'Americas | Wahy Wa Namaa Academy' },
    description: { ar: 'حصص قرآن وتجويد متوافقة مع التوقيت الأمريكي والكندي للأطفال والكبار.', en: 'Online Quran classes scheduled for North and South America timezones.' },
  },
  {
    path: '/markets/europe',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'أوروبا وبريطانيا | أكاديمية وَحْيٌ وَنَمَاء', en: 'Europe & UK | Wahy Wa Namaa Academy' },
    description: { ar: 'تعليم القرآن الكريم باللغات العربية والإنجليزية والفرنسية والألمانية لطلبة أوروبا.', en: 'Multilingual online Quran academy tailored for families across Europe and the UK.' },
  },
  {
    path: '/markets/turkey',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'تركيا | أكاديمية وَحْيٌ وَنَمَاء', en: 'Turkey | Wahy Wa Namaa Academy' },
    description: { ar: 'حلقات تحفيظ وتجويد لطلبة تركيا باللغتين العربية والتركية.', en: 'Online Quran and Tajweed circles supporting learners across Turkey.' },
  },
  {
    path: '/markets/indonesia-malaysia',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'إندونيسيا وماليزيا | أكاديمية وَحْيٌ وَنَمَاء', en: 'Indonesia & Malaysia | Wahy Wa Namaa Academy' },
    description: { ar: 'مسارات تحفيظ القرآن والتجويد المتوافقة مع توقيت إندونيسيا وماليزيا.', en: 'Structured Quran and Tajweed classes timed for Indonesia and Malaysia.' },
  },
  {
    path: '/markets/south-asia',
    priority: '0.7',
    changefreq: 'monthly',
    title: { ar: 'جنوب آسيا | أكاديمية وَحْيٌ وَنَمَاء', en: 'South Asia | Wahy Wa Namaa Academy' },
    description: { ar: 'تعليم القرآن الكريم وتجويده لطلبة باكستان والهند وبنغلاديش.', en: 'Online Quran memorization and Tajweed academy supporting South Asia.' },
  },
  {
    path: '/global-platform',
    priority: '0.75',
    changefreq: 'monthly',
    title: {
      ar: 'منظومة وحي ونماء الرقمية | وَحْيٌ وَنَمَاء',
      en: 'Wahy Wa Namaa Digital Platform',
    },
    description: {
      ar: 'استكشف وحدات المنصة التعليمية التفاعلية وبوابة الطالب والمعلم وولي الأمر.',
      en: 'Explore the digital classroom, progress tracking, and family portal features.',
    },
  },
  {
    path: '/start',
    priority: '0.85',
    changefreq: 'monthly',
    title: {
      ar: 'ابدأ رحلتك القرآنية | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Start Your Quran Journey | Wahy Wa Namaa',
    },
    description: {
      ar: 'اختر قسم الرجال والأطفال أو قسم السيدات وأنشئ حسابك لبدء حفظ وتلاوة القرآن الكريم.',
      en: 'Choose your learning division and start your Quran memorization journey today.',
    },
  },
  {
    path: '/about',
    priority: '0.75',
    changefreq: 'monthly',
    schemaType: 'AboutPage',
    title: {
      ar: 'عن أكاديمية وَحْيٌ وَنَمَاء',
      en: 'About Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'تعرف على رؤية ورسالة ومنهجية أكاديمية وحي ونماء لتعليم القرآن الكريم بالسند المتصل.',
      en: 'Discover the vision, methodology, and Azhar heritage behind Wahy Wa Namaa Academy.',
    },
  },
  {
    path: '/contact',
    priority: '0.7',
    changefreq: 'monthly',
    schemaType: 'ContactPage',
    title: {
      ar: 'تواصل معنا | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Contact Us | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'تواصل مع فريق أكاديمية وحي ونماء للاستفسارات، التسجيل، أو الشراكات التعليمية.',
      en: 'Get in touch with Wahy Wa Namaa Academy for enrollment, support, or partnerships.',
    },
  },
  {
    path: '/faq',
    priority: '0.75',
    changefreq: 'monthly',
    schemaType: 'FAQPage',
    title: {
      ar: 'الأسئلة الشائعة | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Frequently Asked Questions | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'إجابات وافية عن نظام الحلقات، المعلمين، الأسعار، الدفع، والشهادات في أكاديمية وحي ونماء.',
      en: 'Clear answers about classes, certified tutors, pricing, payments, and certificates.',
    },
  },
  {
    path: '/careers',
    priority: '0.6',
    changefreq: 'monthly',
    title: {
      ar: 'الفرص والانضمام لفريق المعلمين | وَحْيٌ وَنَمَاء',
      en: 'Careers & Teaching Opportunities | Wahy Wa Namaa',
    },
    description: {
      ar: 'استعرض الفرص المتاحة للانضمام إلى فريق المعلمين والمحفظين في أكاديمية وحي ونماء.',
      en: 'Explore open teaching positions and apply as a certified Quran tutor.',
    },
  },
  {
    path: '/register/teacher',
    priority: '0.65',
    changefreq: 'monthly',
    title: {
      ar: 'التقديم كمعلم قرآن كريم | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Apply as a Quran Teacher | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'قدّم للانضمام كمعلم أو معلمة قرآن كريم وتجويد وإجازات في أكاديمية وحي ونماء.',
      en: 'Submit your Quran teaching application and credentials to join Wahy Wa Namaa.',
    },
  },
  {
    path: '/donate',
    priority: '0.6',
    changefreq: 'monthly',
    title: {
      ar: 'دعم ومساهمات تعليم القرآن | وَحْيٌ وَنَمَاء',
      en: 'Support Quran Education | Wahy Wa Namaa',
    },
    description: {
      ar: 'تعرف على مسارات المساهمة والدعم التعليمي المتاحة في أكاديمية وحي ونماء.',
      en: 'Learn about available contribution options supporting Quran learning.',
    },
  },
  {
    path: '/app',
    priority: '0.6',
    changefreq: 'monthly',
    title: {
      ar: 'تطبيق وحي ونماء على الهاتف | وَحْيٌ وَنَمَاء',
      en: 'Wahy Wa Namaa Mobile App',
    },
    description: {
      ar: 'ثبّت منصة وحي ونماء كتطبيق ويب سريع على هاتفك لمتابعة الحصص والحفظ.',
      en: 'Install Wahy Wa Namaa as a progressive web app for easy access on your phone.',
    },
  },
  {
    path: '/privacy',
    priority: '0.3',
    changefreq: 'yearly',
    title: {
      ar: 'سياسة الخصوصية | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Privacy Policy | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'سياسة الخصوصية وحماية بيانات الطلاب والمعلمين وأولياء الأمور في أكاديمية وحي ونماء.',
      en: 'Privacy policy explaining how Wahy Wa Namaa protects student, guardian, and teacher data.',
    },
  },
  {
    path: '/terms',
    priority: '0.3',
    changefreq: 'yearly',
    title: {
      ar: 'الشروط والأحكام | أكاديمية وَحْيٌ وَنَمَاء',
      en: 'Terms & Conditions | Wahy Wa Namaa Academy',
    },
    description: {
      ar: 'الشروط والأحكام المنظمة لاستخدام منصة أكاديمية وحي ونماء وخدماتها التعليمية.',
      en: 'Terms and conditions governing use of the Wahy Wa Namaa Academy platform.',
    },
  },
];

const NOINDEX_SEGMENT_RE =
  /^(?:\/(?:ar|en|fr|de|tr|ur|id|ms|ku))?\/(?:login|register(?:\/(?:student|guardian))?|forgot-password|reset-password|admin(?:\/.*)?|student(?:\/.*)?|teacher\/dashboard(?:\/.*)?|guardian(?:\/.*)?|live(?:\/.*)?|meeting(?:\/.*)?|payment(?:\/.*)?|profile(?:\/.*)?|notifications(?:\/.*)?|settings(?:\/.*)?|ai|journey|verify-certificate(?:\/.*)?|book-trial(?:\/.*)?|courses\/[^/]+\/learn(?:\/.*)?)$/i;

export function isNoIndexPath(pathname = '/') {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
  return NOINDEX_SEGMENT_RE.test(clean);
}

export function resolveRouteMeta(route, locale) {
  const brand = LOCALE_BRAND[locale] || LOCALE_BRAND.ar;
  const fallbackLang = locale === 'ar' || locale === 'ur' || locale === 'ku' ? 'ar' : 'en';
  const title = route.title?.[locale] || route.title?.[fallbackLang] || route.title?.en || brand.appNameFull;
  const description = route.description?.[locale] || route.description?.[fallbackLang] || brand.seoDescription;
  return { brand, title, description };
}
