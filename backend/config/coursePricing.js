'use strict';

const { getTierForCountry } = require('./geoPricing');

function toFiniteNonNegative(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/**
 * Resolves dynamic Geo-IP regional course pricing while preserving 100% backward
 * compatibility with courses that only define legacy `course.price` + `course.currency`.
 */
function resolveCoursePricing(course, countryCode = 'EG') {
  const tier = getTierForCountry(countryCode);
  const regionalMap = course?.regionalPrices;
  const compareMap = course?.compareAtPrices;

  const regionalPrice = regionalMap && typeof regionalMap === 'object'
    ? toFiniteNonNegative(regionalMap[tier.region])
    : null;

  if (regionalPrice !== null) {
    const currency = tier.currency;
    const amountMinor = Math.round(regionalPrice * 100);
    const rawCompare = compareMap && typeof compareMap === 'object'
      ? toFiniteNonNegative(compareMap[tier.region])
      : null;
    const compareAtPrice = rawCompare !== null && rawCompare > regionalPrice ? rawCompare : null;
    const discountPercent = compareAtPrice
      ? Math.round(((compareAtPrice - regionalPrice) / compareAtPrice) * 100)
      : 0;

    return {
      region: tier.region,
      countryCode: tier.countryCode,
      regionLabel: tier.regionLabel,
      price: regionalPrice,
      currency,
      amountMinor,
      isFree: amountMinor === 0,
      compareAtPrice,
      discountPercent,
      localCurrencyHint: currency === 'USD' ? tier.localCurrencyHint : null,
      hasRegionalOverride: true,
    };
  }

  const fallbackPrice = toFiniteNonNegative(course?.price) ?? 0;
  const fallbackCurrency = String(course?.currency || 'USD').trim().toUpperCase() === 'EGP' ? 'EGP' : 'USD';
  const fallbackMinor = Math.round(fallbackPrice * 100);

  return {
    region: tier.region,
    countryCode: tier.countryCode,
    regionLabel: tier.regionLabel,
    price: fallbackPrice,
    currency: fallbackCurrency,
    amountMinor: fallbackMinor,
    isFree: fallbackMinor === 0,
    compareAtPrice: null,
    discountPercent: 0,
    localCurrencyHint: fallbackCurrency === 'USD' ? tier.localCurrencyHint : null,
    hasRegionalOverride: false,
  };
}

function buildRegionalCoursePrices({ priceUsd = 0, priceEgp = null, compareAtUsd = null, compareAtEgp = null } = {}) {
  const cleanUsd = toFiniteNonNegative(priceUsd) ?? 0;
  const cleanEgp = toFiniteNonNegative(priceEgp);

  if (cleanEgp === null) {
    return { regionalPrices: undefined, compareAtPrices: undefined };
  }

  if (cleanEgp === 0 && cleanUsd === 0) {
    return {
      regionalPrices: { EG: 0, GCC: 0, WEST: 0, INTL: 0 },
      compareAtPrices: undefined,
    };
  }

  const gccUsd = Math.max(0, Math.round(cleanUsd * 0.8));
  const intlUsd = Math.max(0, Math.round(cleanUsd * 0.65));

  const regionalPrices = {
    EG: cleanEgp,
    GCC: gccUsd,
    WEST: cleanUsd,
    INTL: intlUsd,
  };

  const cleanCompareEgp = toFiniteNonNegative(compareAtEgp);
  const cleanCompareUsd = toFiniteNonNegative(compareAtUsd);

  const compareAtPrices = (cleanCompareEgp !== null || cleanCompareUsd !== null)
    ? {
        EG: cleanCompareEgp !== null ? cleanCompareEgp : Math.round(cleanEgp * 1.65),
        GCC: cleanCompareUsd !== null ? Math.round(cleanCompareUsd * 0.8) : Math.round(gccUsd * 1.65),
        WEST: cleanCompareUsd !== null ? cleanCompareUsd : Math.round(cleanUsd * 1.65),
        INTL: cleanCompareUsd !== null ? Math.round(cleanCompareUsd * 0.65) : Math.round(intlUsd * 1.65),
      }
    : undefined;

  return { regionalPrices, compareAtPrices };
}

const OFFICIAL_ACADEMY_COURSES = Object.freeze([
  Object.freeze({
    slug: 'fatiha-short-surahs-starter',
    category: 'quran',
    programs: ['general', 'reverts', 'women'],
    level: 'beginner',
    price: 0,
    currency: 'USD',
    regionalPrices: { EG: 0, GCC: 0, WEST: 0, INTL: 0 },
    duration: '4 أسابيع • 8 دروس تطبيقية',
    durationInHours: 4,
    image: '/images/programs/program-tajweed.jpg',
    title: {
      ar: 'تصحيح الفاتحة وقصار السور — انطلاقة مجانية متقنة',
      en: 'Perfecting Al-Fatiha & Short Surahs — Free Starter Course',
    },
    description: {
      ar: 'دورة تأسيسية مجانية لتصحيح أبرز الأخطاء الشائعة في سورة الفاتحة وقصار السور لتبدأ صلاتك وتلاوتك بإتقان وطمأنينة.',
      en: 'A practical free starter course to correct common recitation mistakes in Surah Al-Fatiha and short Surahs used in daily prayer.',
    },
    learningOutcomes: {
      ar: [
        'إتقان قراءة سورة الفاتحة بلا لحن جلي أو خفي شائع',
        'ضبط مخارج الحروف الأساسية في قصار السور من جزء عمّ',
        'الاستعداد العملي للانتقال إلى حلقات التسميع المباشر',
      ],
      en: [
        'Recite Surah Al-Fatiha accurately without common articulation errors',
        'Apply essential Tajweed checkpoints across short daily Surahs',
        'Build readiness for live 1-on-1 or small-group recitation circles',
      ],
    },
    starterLessons: [
      {
        slug: 'fatiha-common-mistakes',
        order: 1,
        type: 'text',
        duration: 15,
        isFree: true,
        title: {
          ar: 'الدرس الأول: الميزان العملي لضبط سورة الفاتحة آيةً آية',
          en: 'Lesson 1: Verse-by-Verse Accuracy in Surah Al-Fatiha',
        },
        text: {
          ar: '## ضبط سورة الفاتحة\n\n1. تحقيق الكسرات في الاستعاذة والبسملة.\n2. التمييز بين الصاد والسين في «اهدنا الصراط المستقيم».\n3. إتمام زمن المد اللازم في «ولا الضالين» ست حركات كاملة.',
          en: '## Mastering Surah Al-Fatiha\n\n1. Precise vowel clarity in Basmalah.\n2. Distinguishing emphatic Sad from Seen in Al-Sirat.\n3. Holding the 6-count necessary Madd in Wala Al-Dalleen.',
        },
      },
      {
        slug: 'three-quls-mastery',
        order: 2,
        type: 'text',
        duration: 15,
        isFree: true,
        title: {
          ar: 'الدرس الثاني: إتقان الإخلاص والمعوذتين مع القلقلة والغنة',
          en: 'Lesson 2: Al-Ikhlas, Al-Falaq & An-Nas with Qalqalah & Ghunnah',
        },
        text: {
          ar: '## الإخلاص والمعوذتان\n\n1. قلقلة الدال في «أحد» و«الصمد» و«يلد» و«يولد».\n2. غنة النون المشددة بمقدار حركتين في سورة الناس.\n3. خطة مراجعة يومية في الصلوات الخمس.',
          en: '## Al-Ikhlas, Al-Falaq & An-Nas\n\n1. Clear Qalqalah bounce on Dal stops.\n2. Two-beat nasal Ghunnah on doubled Noon in Surah An-Nas.\n3. Daily prayer recitation checklist.',
        },
      },
    ],
  }),
  Object.freeze({
    slug: 'noor-al-bayan-kids-foundation',
    category: 'arabic',
    programs: ['kids', 'reverts'],
    level: 'beginner',
    price: 15,
    currency: 'USD',
    regionalPrices: { EG: 149, GCC: 12, WEST: 15, INTL: 9 },
    compareAtPrices: { EG: 260, GCC: 22, WEST: 29, INTL: 16 },
    duration: '6 أسابيع • 16 درساً تدريجياً',
    durationInHours: 10,
    image: '/images/programs/program-kids.jpg',
    title: {
      ar: 'تأسيس القراءة العربية ونور البيان للأطفال والمبتدئين',
      en: 'Noor Al-Bayan & Quranic Reading Foundation',
    },
    description: {
      ar: 'منهج متدرج ممتع ينقل الطفل أو المبتدئ من حروف الهجاء والحركات والمدود إلى القراءة المباشرة من المصحف بثقة وطلاقة.',
      en: 'Step-by-step Noor Al-Bayan methodology taking children and beginners from Arabic letters and vowels to fluent Mushaf reading.',
    },
    learningOutcomes: {
      ar: [
        'تمييز الحروف العربية بأشكالها ومواضعها المختلفة في الكلمة',
        'إتقان الحركات الثلاث والمدود والسكون والتنوين والشدة',
        'تهجّي وقراءة الآيات القرآنية القصيرة مباشرة من المصحف',
      ],
      en: [
        'Recognize all Arabic letter forms across word positions',
        'Master short vowels, elongations (Madd), Sukoon, Tanween, and Shaddah',
        'Read Quranic words and short verses directly from the Mushaf',
      ],
    },
    starterLessons: [
      {
        slug: 'arabic-letters-and-fatha',
        order: 1,
        type: 'text',
        duration: 15,
        isFree: true,
        title: {
          ar: 'الدرس الأول (معاينة مجانية): خريطة الحروف الهجائية وحركة الفتح',
          en: 'Lesson 1 (Free Preview): Arabic Alphabet Map & Fatha Vowel',
        },
        text: {
          ar: '## خريطة الحروف وحركة الفتح\n\nنبدأ بنطق الحروف مفخمة ومرققة بصوت صافٍ مع حركة الفتح دون إشباع يتحول إلى ألف مدية.',
          en: '## Alphabet Map & Short Fatha\n\nLearn crisp pronunciation of heavy and light letters with a clean 1-beat Fatha vowel.',
        },
      },
      {
        slug: 'madd-and-sukoon-drills',
        order: 2,
        type: 'text',
        duration: 20,
        isFree: false,
        title: {
          ar: 'الدرس الثاني: تدريبات المدود الثلاثة ومهارة الوصل بالسكون',
          en: 'Lesson 2: Natural Elongations & Sukoon Blending Drills',
        },
        text: {
          ar: '## المدود والسكون\n\nتدريبات تطبيقية على الجمع بين الحرف المتحرك والحرف الساكن من كلمات القرآن الكريم.',
          en: '## Elongations & Sukoon\n\nGuided blending exercises using authentic Quranic vocabulary.',
        },
      },
    ],
  }),
  Object.freeze({
    slug: 'applied-tajweed-tuhfat-al-atfal',
    category: 'tajweed',
    programs: ['general', 'women'],
    level: 'beginner',
    price: 19,
    currency: 'USD',
    regionalPrices: { EG: 179, GCC: 15, WEST: 19, INTL: 12 },
    compareAtPrices: { EG: 320, GCC: 28, WEST: 35, INTL: 22 },
    duration: '8 أسابيع • 18 درساً تطبيقياً',
    durationInHours: 12,
    image: '/images/programs/program-tajweed.jpg',
    title: {
      ar: 'إتقان التجويد التطبيقي وشرح تحفة الأطفال',
      en: 'Applied Tajweed Mastery & Tuhfat Al-Atfal',
    },
    description: {
      ar: 'شرح مبسط وتطبيقي لأحكام النون والميم الساكنتين والمدود والقلقلة مع متن تحفة الأطفال وأمثلة عملية من المصحف.',
      en: 'Clear applied mastery of Noon/Meem rules, Madd, and Qalqalah paired with Tuhfat Al-Atfal verses and Mushaf examples.',
    },
    learningOutcomes: {
      ar: [
        'تطبيق أحكام النون الساكنة والتنوين والميم الساكنة أثناء التلاوة',
        'ضبط أزمنة الغنن ومراتب المدود الطبيعية والفرعية بدقة',
        'فهم وحفظ أبيات منظومة تحفة الأطفال بأسلوب ميسّر',
      ],
      en: [
        'Apply Noon Sakinah, Tanween, and Meem Sakinah rules naturally while reciting',
        'Calibrate Ghunnah timing and Madd counts accurately',
        'Understand the classic Tuhfat Al-Atfal poem with practical examples',
      ],
    },
    starterLessons: [
      {
        slug: 'noon-sakinah-overview',
        order: 1,
        type: 'text',
        duration: 18,
        isFree: true,
        title: {
          ar: 'الدرس الأول (معاينة مجانية): مدخل التجويد التطبيقي وأحكام النون الساكنة',
          en: 'Lesson 1 (Free Preview): Applied Tajweed & Noon Sakinah Foundations',
        },
        text: {
          ar: '## مدخل التجويد العملي\n\nالهدف من التجويد صون اللسان عن الخطأ في كتاب الله وتحقيق الأداء القرآني المتلقّى بالمشافهة.',
          en: '## Applied Tajweed Foundations\n\nLearn the four practical rules of Noon Sakinah and Tanween with clear Mushaf checkpoints.',
        },
      },
      {
        slug: 'meem-sakinah-and-madd',
        order: 2,
        type: 'text',
        duration: 22,
        isFree: false,
        title: {
          ar: 'الدرس الثاني: أحكام الميم الساكنة وميزان المدود',
          en: 'Lesson 2: Meem Sakinah Rules & Madd Timing Scale',
        },
        text: {
          ar: '## الميم الساكنة والمدود\n\nالإخفاء الشفوي، الإدغام الصغير، والإظهار الشفوي مع تطبيقات عملية.',
          en: '## Meem Sakinah & Madd Scale\n\nLabial concealment, assimilation, and clear pronunciation drills.',
        },
      },
    ],
  }),
  Object.freeze({
    slug: 'hifz-mastery-amma-tabarak',
    category: 'quran',
    programs: ['general', 'kids', 'women'],
    level: 'intermediate',
    price: 22,
    currency: 'USD',
    regionalPrices: { EG: 199, GCC: 17, WEST: 22, INTL: 14 },
    compareAtPrices: { EG: 360, GCC: 32, WEST: 39, INTL: 25 },
    duration: '10 أسابيع • 20 درساً وخطة ورد',
    durationInHours: 15,
    image: '/images/programs/program-hifz.jpg',
    title: {
      ar: 'منهج الحفظ المتقن لجزءَي عمّ وتبارك بلا نسيان',
      en: 'Mastered Memorization: Juz Amma & Tabarak Without Forgetting',
    },
    description: {
      ar: 'نظام عملي يجمع بين التفسير الميسر والربط الموضوعي والحصون الخمسة لتثبيت جزءَي عمّ وتبارك بإتقان راسخ.',
      en: 'A structured Hifz system combining thematic verse linking, simplified meaning, and the 5-Fortresses revision method.',
    },
    learningOutcomes: {
      ar: [
        'بناء خطة حفظ ومراجعة أسبوعية تمنع تفلت المحفوظ',
        'ربط الآيات بالمعاني والمقاصد السياقية لتيسير الاستحضار',
        'ضبط المتشابهات اللفظية في جزءَي عمّ وتبارك',
      ],
      en: [
        'Build a sustainable weekly Hifz & revision schedule that prevents forgetting',
        'Anchor verses through meaning and thematic flow',
        'Master similar verse endings across Juz Amma and Juz Tabarak',
      ],
    },
    starterLessons: [
      {
        slug: 'five-fortresses-hifz-method',
        order: 1,
        type: 'text',
        duration: 18,
        isFree: true,
        title: {
          ar: 'الدرس الأول (معاينة مجانية): قاعدة الحصون الخمسة للحفظ الراسخ',
          en: 'Lesson 1 (Free Preview): The 5-Fortresses Method for Lasting Hifz',
        },
        text: {
          ar: '## الحصون الخمسة\n\nالقراءة المستمرة، التحضير القبلي، الحفظ الجديد، مراجعة القريب، ومراجعة البعيد بانتظام.',
          en: '## The 5 Fortresses of Hifz\n\nPreparation, new memorization, near-term anchoring, and spaced long-term revision.',
        },
      },
      {
        slug: 'surah-mulk-thematic-map',
        order: 2,
        type: 'text',
        duration: 22,
        isFree: false,
        title: {
          ar: 'الدرس الثاني: الخريطة الموضوعية وتثبيت سورة الملك',
          en: 'Lesson 2: Thematic Map & Memorization Anchors of Surah Al-Mulk',
        },
        text: {
          ar: '## الخريطة الموضوعية لسورة الملك\n\nتقسيم السورة إلى مقاطع معنوية مترابطة تيسر الحفظ والمراجعة.',
          en: '## Surah Al-Mulk Thematic Map\n\nChunking verses into meaningful thematic blocks for effortless recall.',
        },
      },
    ],
  }),
  Object.freeze({
    slug: 'al-jazariyyah-ijazah-prep',
    category: 'ijazah',
    programs: ['general', 'women'],
    level: 'advanced',
    price: 29,
    currency: 'USD',
    regionalPrices: { EG: 249, GCC: 22, WEST: 29, INTL: 18 },
    compareAtPrices: { EG: 450, GCC: 39, WEST: 49, INTL: 32 },
    duration: '12 أسبوعاً • 24 درساً تخصصياً',
    durationInHours: 18,
    image: '/images/programs/program-ijazah.jpg',
    title: {
      ar: 'شرح المقدمة الجزرية والتأهيل للإجازة بالسند المتصل',
      en: 'Al-Jazariyyah Mastery & Connected Sanad Ijazah Prep',
    },
    description: {
      ar: 'دورة تأهيلية متقدمة في مخارج الحروف وصفاتها والوقف والابتداء وشرح منظومة ابن الجزري استعداداً لعرض الختمة ونيل الإجازة.',
      en: 'Advanced preparation covering precise Makharij, Sifat, Waqf & Ibtida, and Ibn Al-Jazari’s poem for Sanad Ijazah candidates.',
    },
    learningOutcomes: {
      ar: [
        'إتقان مخارج الحروف السبعة عشر وصفاتها اللازمة والعارضة',
        'فهم أبواب التجويد والوقف والابتداء والمقطوع والموصول في الجزرية',
        'الجاهزية العلمية والعملية للالتحاق بالباقة الفردية المكثفة للإجازة',
      ],
      en: [
        'Master the 17 articulation points and intrinsic/contextual letter qualities',
        'Understand Waqf, Ibtida, and Rasm rules in Al-Muqaddimah Al-Jazariyyah',
        'Prepare thoroughly for 60-minute 1-on-1 Sanad recitation sessions',
      ],
    },
    starterLessons: [
      {
        slug: 'makharij-al-huroof-precision',
        order: 1,
        type: 'text',
        duration: 20,
        isFree: true,
        title: {
          ar: 'الدرس الأول (معاينة مجانية): التحقيق الدقيق لمخارج الحروف السبعة عشر',
          en: 'Lesson 1 (Free Preview): Precision Map of the 17 Articulation Points',
        },
        text: {
          ar: '## مخارج الحروف عند ابن الجزري\n\nمدخل تطبيقي لتحقيق مخارج الجوف والحلق واللسان والشفتين والخيشوم بدقة المشافهة.',
          en: '## Ibn Al-Jazari’s 17 Articulation Points\n\nDiagnostic checkpoints for throat, tongue, lip, and nasal articulation.',
        },
      },
      {
        slug: 'sifat-al-huroof-and-waqf',
        order: 2,
        type: 'text',
        duration: 25,
        isFree: false,
        title: {
          ar: 'الدرس الثاني: الصفات المتضادة وأصول الوقف والابتداء',
          en: 'Lesson 2: Contrasting Letter Qualities & Rules of Waqf and Ibtida',
        },
        text: {
          ar: '## صفات الحروف والوقف والابتداء\n\nالهمس والجهر، الشدة والرخاوة، الاستعلاء والاستفال، وأثرها في فصاحة التلاوة.',
          en: '## Letter Qualities & Stopping Rules\n\nHow Sifat and Waqf choices preserve Quranic meaning and recitation beauty.',
        },
      },
    ],
  }),
]);

module.exports = {
  resolveCoursePricing,
  buildRegionalCoursePrices,
  OFFICIAL_ACADEMY_COURSES,
};
