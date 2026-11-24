/**
 * بيانات وأدوات الغرفة القرآنية التفاعلية (V2.0)
 * تشمل: 6 أنماط ألعاب حية، توليد تحديات من الصفحة المفتوحة، مواضع السجدات الـ 15،
 * مرآة مخارج الحروف التفاعلية، اللوح النوراني، وأوسمة التشجيع الروحانية (صفر موسيقى).
 */

export const CLASSROOM_GAME_MODES = [
  { id: 'ayah_puzzle', icon: '🧩', labelAr: 'رتّب كلمات الآية', labelEn: 'Order the Verse', descAr: 'رتّب الكلمات المبعثرة لتكوين الآية الصحيحة' },
  { id: 'missing_word', icon: '🎯', labelAr: 'الكلمة المفقودة', labelEn: 'Missing Word', descAr: 'أكمل الفراغ في الآية الكريمة قبل انتهاء الوقت' },
  { id: 'intruder_word', icon: '🕵️', labelAr: 'اكتشف الكلمة الدخيلة', labelEn: 'Spot the Intruder', descAr: 'اكتشف اللفظ الخاطئ في فاصلة الآية لتثبيت المتشابهات' },
  { id: 'next_ayah', icon: '🔗', labelAr: 'سلسلة الآيات', labelEn: 'Next Verse Relay', descAr: 'اختر الآية التي تلي هذه الآية مباشرة' },
  { id: 'tajweed_hunter', icon: '🎙️', labelAr: 'صائد أحكام التجويد', labelEn: 'Tajweed Hunter', descAr: 'استخرج الحكم التجويدي الصحيح من الموضع القرآني' },
  { id: 'mutashabihat', icon: '⚡', labelAr: 'سباق المتشابهات', labelEn: 'Mutashabihat Sprint', descAr: 'فرّق بدقة بين الآيات المتشابهة في السور' },
];

export const QARI_OPTIONS = [
  { id: 'Husary_Muallim_128kbps', labelAr: 'الشيخ الحصري (المصحف المعلّم)', labelEn: 'Al-Husary (Teacher)' },
  { id: 'Minshawy_Murattal_128kbps', labelAr: 'الشيخ محمد صديق المنشاوي', labelEn: 'Al-Minshawi' },
  { id: 'Alafasy_128kbps', labelAr: 'الشيخ مشاري العفاسي', labelEn: 'Mishary Alafasy' },
];

export const SPIRITUAL_BADGES = [
  { key: 'mashallah', emoji: '🌟', labelAr: 'ما شاء الله تبارك الله!', labelEn: 'MashaAllah, blessed recitation!', stars: 2 },
  { key: 'tajweed_master', emoji: '🎙️', labelAr: 'تجويد متقن ومخارج صافية', labelEn: 'Masterful Tajweed!', stars: 2 },
  { key: 'rock_hifz', emoji: '🏆', labelAr: 'حفظ راسخ كالجبال', labelEn: 'Rock-solid memorization!', stars: 3 },
  { key: 'sweet_madd', emoji: '✨', labelAr: 'ضبط رائع للمدود والغُنن', labelEn: 'Excellent Madd & Ghunnah!', stars: 2 },
  { key: 'star', emoji: '⭐', labelAr: 'نجمة تميز وهمّة عالية', labelEn: 'Star of Excellence!', stars: 1 },
];

export const SESSION_RITUALS = {
  opening: {
    titleAr: 'افتتاح المجلس القرآني المبارك',
    titleEn: 'Opening the Quranic Circle',
    duaAr: '«اللَّهُمَّ افْتَحْ عَلَيْنَا فُتُوحَ الْعَارِفِينَ، وَعَلِّمْنَا مَا يَنْفَعُنَا، وَانْفَعْنَا بِمَا عَلَّمْتَنَا، وَزِدْنَا عِلْمًا وَعَمَلًا وَإِخْلَاصًا»',
    noteAr: 'استحضر نيّة التعلّم لله تعالى، وأدب الإنصات لكلام ربّ العالمين.',
  },
  closing: {
    titleAr: 'ختام المجلس وكفّارته',
    titleEn: 'Closing the Circle',
    duaAr: '«سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ»',
    noteAr: 'بارك الله في همّتك وجعل ما قرأته وحفظته نوراً لك في الدنيا والآخرة.',
  },
};

/**
 * مواضع سجدات التلاوة الـ 15 في المصحف المدني (604 صفحة)
 */
export const SAJDAH_PAGES_MAP = {
  176: { surah: 'الأعراف', ayah: 206, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  251: { surah: 'الرعد', ayah: 15, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  272: { surah: 'النحل', ayah: 50, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  293: { surah: 'الإسراء', ayah: 109, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  309: { surah: 'مريم', ayah: 58, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  334: { surah: 'الحج (الأولى)', ayah: 18, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  341: { surah: 'الحج (الثانية)', ayah: 77, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  365: { surah: 'الفرقان', ayah: 60, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  379: { surah: 'النمل', ayah: 26, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  416: { surah: 'السجدة', ayah: 15, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  454: { surah: 'ص', ayah: 24, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  480: { surah: 'فصلت', ayah: 38, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  528: { surah: 'النجم', ayah: 62, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  589: { surah: 'الانشقاق', ayah: 21, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
  597: { surah: 'العلق', ayah: 19, dua: 'سَجَدَ وَجْهِي لِلَّذِي خَلَقَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ' },
};

/**
 * مخارج الحروف التفاعلية (المناطق الخمس الكبرى + أهم الحروف الدقيقة)
 */
export const MAKHARIJ_ZONES = [
  { id: 'jawf', labelAr: 'الجوف', descAr: 'الخلاء الواقع داخل الحلق والفم — تخرج منه حروف المد الثلاثة (ا، و، ي).' },
  { id: 'halq', labelAr: 'الحلق', descAr: 'ينقسم لأقصى الحلق (ء، هـ)، وسطه (ع، ح)، وأدناه (غ، خ).' },
  { id: 'lisan', labelAr: 'اللسان', descAr: 'أوسع المخارج: يضم 10 مخارج لـ 18 حرفاً (ق، ك، ج، ش، ي، ض، ل، ن، ر، ط، د، ت، ص، ز، س، ظ، ذ، ث).' },
  { id: 'shafatan', labelAr: 'الشفتان', descAr: 'تخرج منهما الفاء (مع أطراف الثنايا العليا) والباء والميم والواو غير المدية.' },
  { id: 'khayshoom', labelAr: 'الخيشوم', descAr: 'أعلى الأنف — مخرج صفة الغنّة المركّبة في جسم النون والميم.' },
];

export const ARABIC_LETTERS_MAKHARIJ = [
  { letter: 'ق', zone: 'lisan', place: 'أقصى اللسان مع ما يحاذيه من الحنك اللحمي', sifat: 'جهر • شدة • استعلاء • انفتاح • قلقلة', drill: 'أَقْ — إِقْ — أُقْ — قَالَ', tip: 'احذر إبدالها كافاً مفخمة أو ترك قلقلتها عند السكون.' },
  { letter: 'ك', zone: 'lisan', place: 'أقصى اللسان مع الحنك اللحمي والعظمي أسفل القاف', sifat: 'همس • شدة • استفال • انفتاح', drill: 'أَكْ — إِكْ — أُكْ — كِتَابٌ', tip: 'أخرج همساً لطيفاً بعد انحباس الصوت ولا تفخّمها.' },
  { letter: 'ض', zone: 'lisan', place: 'إحدى حافتي اللسان أو كلتاهما مع ما يجاورها من الأضراس العليا', sifat: 'جهر • رخاوة • استعلاء • إطباق • استطالة', drill: 'أَضْ — إِضْ — وَلَا الضَّالِّينَ', tip: 'تجنب إخراجها دالاً مفخمة أو ظاءً بإخراج طرف اللسان.' },
  { letter: 'ظ', zone: 'lisan', place: 'طرف اللسان مع أطراف الثنايا العليا', sifat: 'جهر • رخاوة • استعلاء • إطباق', drill: 'أَظْ — إِظْ — ظَلَمُوا', tip: 'أخرج طرف اللسان قليلاً مع التفخيم والإطباق دون قلقلة.' },
  { letter: 'ذ', zone: 'lisan', place: 'طرف اللسان مع أطراف الثنايا العليا (مرقق)', sifat: 'جهر • رخاوة • استفال • انفتاح', drill: 'أَذْ — إِذْ — ذَٰلِكَ', tip: 'لا تخلطها بالزاي؛ لا بد من ملامسة طرف اللسان لأطراف الثنايا.' },
  { letter: 'ص', zone: 'lisan', place: 'منتهى طرف اللسان مع الصفحة الداخلية للثنايا السفلى', sifat: 'همس • رخاوة • استعلاء • إطباق • صفير', drill: 'أَصْ — إِصْ — الصِّرَاطَ', tip: 'حافظ على استعلاء الصاد قبل الكسر مثل «الصِّراط» لئلا تتحول سيناً.' },
  { letter: 'ع', zone: 'halq', place: 'وسط الحلق (لسان المزمار)', sifat: 'جهر • توسط (بينية) • استفال • انفتاح', drill: 'أَعْ — إِعْ — نَعْبُدُ', tip: 'تجنب عائمية العين أو بتر صوتها كالهمزة.' },
  { letter: 'ح', zone: 'halq', place: 'وسط الحلق', sifat: 'همس • رخاوة • استفال • انفتاح', drill: 'أَحْ — إِحْ — الرَّحْمَٰنِ', tip: 'صفِّ بُحّتها اللطيفة من وسط الحلق دون خشونة الخاء.' },
  { letter: 'خ', zone: 'halq', place: 'أدنى الحلق مما يلي الفم', sifat: 'همس • رخاوة • استعلاء • انفتاح', drill: 'أَخْ — إِخْ — خَالِدِينَ', tip: 'من حروف التفخيم السبعة (خص ضغط قظ) حتى في أدنى مراتبه.' },
  { letter: 'ر', zone: 'lisan', place: 'طرف اللسان مع لثة الثنايا العليا قريباً من ظهره', sifat: 'جهر • توسط • انحراف • تكرير منضبط', drill: 'أَرْ — إِرْ — الرَّحِيمِ', tip: 'احذر المبالغة في التكرير (ارتعاد اللسان أكثر من مرة) أو حصر الصوت تماماً.' },
  { letter: 'م', zone: 'shafatan', place: 'انطباق الشفتين مع غنة من الخيشوم', sifat: 'جهر • توسط • استفال • غنة', drill: 'أَمْ — إِمْ — عَمَّ', tip: 'عند التشديد (مّ) أتمّ الغنة بمقدار حركتين كاملتين.' },
  { letter: 'ن', zone: 'khayshoom', place: 'طرف اللسان مع لثة الثنايا العليا + غنة الخيشوم', sifat: 'جهر • توسط • استفال • غنة', drill: 'أَنْ — إِنْ — إِنَّا', tip: 'الغنة صفة لازمة للنون، وتظهر أكمل ما تكون في المشدد والمدغم والمخفى.' },
];

export const QAIDA_HARAKAT = [
  { id: 'fatha', labelAr: 'فتحة', combine: '\u064E', hintAr: 'افتح الفم اعتدالاً دون إمالة (حركة واحدة)' },
  { id: 'kasra', labelAr: 'كسرة', combine: '\u0650', hintAr: 'اخفض الفك السفلي بوضوح (حركة واحدة)' },
  { id: 'damma', labelAr: 'ضمة', combine: '\u064F', hintAr: 'ضمّ الشفتين ضماً تاماً للأمام (حركة واحدة)' },
  { id: 'sukoon', labelAr: 'سكون (مع همزة)', prefix: 'أَ', combine: '\u0652', hintAr: 'تصادم طرفي عضو النطق بلا حركة ولا تمطيط' },
  { id: 'shadda_fatha', labelAr: 'شدّة مع فتحة', prefix: 'أَ', combine: '\u0651\u064E', hintAr: 'حرفان: الأول ساكن والثاني متحرك بالفتح بنبر متماسك' },
  { id: 'tanween_fath', labelAr: 'تنوين فتح', combine: '\u064B\u0627', hintAr: 'نون ساكنة زائدة لفظاً لا خطاً (وعند الوقف: مد عوض حركتان)' },
  { id: 'madd_alif', labelAr: 'مد طبيعي بالألف', combine: '\u064E\u0627', hintAr: 'يمد بمقدار حركتين متساويتين من الجوف' },
];

export const CLASSROOM_QUESTION_BANK = {
  ayah_puzzle: [
    { id: 'ap1', tier: 'beginner', surahName: 'سورة الفاتحة', ayahNumber: 5, words: ['إِيَّاكَ', 'نَعْبُدُ', 'وَإِيَّاكَ', 'نَسْتَعِينُ'], explanation: 'الآية الخامسة من سورة الفاتحة: جمعٌ بين العبادة والاستعانة.' },
    { id: 'ap2', tier: 'beginner', surahName: 'سورة القدر', ayahNumber: 3, words: ['لَيْلَةُ', 'الْقَدْرِ', 'خَيْرٌ', 'مِّنْ', 'أَلْفِ', 'شَهْرٍ'], explanation: 'الآية الثالثة من سورة القدر.' },
    { id: 'ap3', tier: 'intermediate', surahName: 'سورة القمر', ayahNumber: 17, words: ['وَلَقَدْ', 'يَسَّرْنَا', 'الْقُرْآنَ', 'لِلذِّكْرِ', 'فَهَلْ', 'مِن', 'مُّدَّكِرٍ'], explanation: 'تكررت هذه الآية المباركة 4 مرات في سورة القمر.' },
    { id: 'ap4', tier: 'intermediate', surahName: 'سورة المزمل', ayahNumber: 4, words: ['أَوْ', 'زِدْ', 'عَلَيْهِ', 'وَرَتِّلِ', 'الْقُرْآنَ', 'تَرْتِيلًا'], explanation: 'الأمر الإلهي بترتيل القرآن وتحسين تلاوته.' },
    { id: 'ap5', tier: 'advanced', surahName: 'سورة الإسراء', ayahNumber: 9, words: ['إِنَّ', 'هَٰذَا', 'الْقُرْآنَ', 'يَهْدِي', 'لِلَّتِي', 'هِيَ', 'أَقْوَمُ'], explanation: 'الآية التاسعة من سورة الإسراء.' },
    { id: 'ap6', tier: 'advanced', surahName: 'سورة آل عمران', ayahNumber: 8, words: ['رَبَّنَا', 'لَا', 'تُزِغْ', 'قُلُوبَنَا', 'بَعْدَ', 'إِذْ', 'هَدَيْتَنَا'], explanation: 'من أدعية الراسخين في العلم في سورة آل عمران.' },
  ],
  missing_word: [
    { id: 'mw1', tier: 'beginner', surahName: 'سورة الضحى', ayahNumber: 9, prompt: 'فَأَمَّا الْيَتِيمَ فَلَا _____', options: ['تَقْهَرْ', 'تَنْهَرْ', 'تَحْزَنْ', 'تَبْخَلْ'], correctAnswer: 'تَقْهَرْ', explanation: 'مع اليتيم «فلا تقهر»، ومع السائل «فلا تنهر».' },
    { id: 'mw2', tier: 'beginner', surahName: 'سورة الفيل', ayahNumber: 3, prompt: 'وَأَرْسَلَ عَلَيْهِمْ طَيْرًا _____', options: ['أَبَابِيلَ', 'سِجِّيلٍ', 'مَّأْكُولٍ', 'صَافَّاتٍ'], correctAnswer: 'أَبَابِيلَ', explanation: 'طيراً أبابيل: جماعات متتابعة.' },
    { id: 'mw3', tier: 'intermediate', surahName: 'سورة الملك', ayahNumber: 2, prompt: 'لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ _____', options: ['عَمَلًا', 'قَوْلًا', 'صَبْرًا', 'ذِكْرًا'], correctAnswer: 'عَمَلًا', explanation: 'قال الفضيل بن عياض: أخلصه وأصوبه.' },
    { id: 'mw4', tier: 'intermediate', surahName: 'سورة نوح', ayahNumber: 10, prompt: 'فَقُلْتُ اسْتَغْفِرُوا رَبَّكُمْ إِنَّهُ كَانَ _____', options: ['غَفَّارًا', 'رَحِيمًا', 'تَوَّابًا', 'حَلِيمًا'], correctAnswer: 'غَفَّارًا', explanation: 'الآية العاشرة من سورة نوح بصيغة المبالغة «غفّاراً».' },
    { id: 'mw5', tier: 'advanced', surahName: 'سورة الكهف', ayahNumber: 10, prompt: 'رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا _____', options: ['رَشَدًا', 'مَخْرَجًا', 'فَرَجًا', 'سَدَادًا'], correctAnswer: 'رَشَدًا', explanation: 'دعاء الفتية أصحاب الكهف في الآية العاشرة.' },
    { id: 'mw6', tier: 'advanced', surahName: 'سورة الرعد', ayahNumber: 28, prompt: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ _____', options: ['الْقُلُوبُ', 'النُّفُوسُ', 'الصُّدُورُ', 'الْأَرْوَاحُ'], correctAnswer: 'الْقُلُوبُ', explanation: 'الآية 28 من سورة الرعد.' },
  ],
  intruder_word: [
    { id: 'iw1', tier: 'beginner', surahName: 'سورة الإخلاص', ayahNumber: 4, prompt: 'أين اللفظ الدخيل (الخطأ) في: «وَلَمْ يَكُن لَّهُ شَرِيكٌ أَحَدٌ»؟', options: ['شَرِيكٌ (الصواب: كُفُوًا)', 'يَكُن', 'لَّهُ', 'أَحَدٌ'], correctAnswer: 'شَرِيكٌ (الصواب: كُفُوًا)', explanation: 'نص الآية الكريمة: «وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ».' },
    { id: 'iw2', tier: 'beginner', surahName: 'سورة العاديات', ayahNumber: 11, prompt: 'أين اللفظ الدخيل في: «إِنَّ رَبَّهُم بِهِمْ يَوْمَئِذٍ لَّبَصِيرٌ»؟', options: ['لَّبَصِيرٌ (الصواب: لَّخَبِيرٌ)', 'رَبَّهُم', 'بِهِمْ', 'يَوْمَئِذٍ'], correctAnswer: 'لَّبَصِيرٌ (الصواب: لَّخَبِيرٌ)', explanation: 'خاتمة سورة العاديات: «إِنَّ رَبَّهُم بِهِمْ يَوْمَئِذٍ لَّخَبِيرٌ».' },
    { id: 'iw3', tier: 'intermediate', surahName: 'سورة الملك', ayahNumber: 2, prompt: 'أين اللفظ الدخيل في خاتمة الآية: «أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْغَفُورُ الرَّحِيمُ»؟', options: ['الْغَفُورُ الرَّحِيمُ (الصواب: الْعَزِيزُ الْغَفُورُ)', 'أَيُّكُمْ', 'أَحْسَنُ', 'عَمَلًا'], correctAnswer: 'الْغَفُورُ الرَّحِيمُ (الصواب: الْعَزِيزُ الْغَفُورُ)', explanation: 'خُتمت الآية بـ «وَهُوَ الْعَزِيزُ الْغَفُورُ» جمعاً بين العزة والمغفرة.' },
    { id: 'iw4', tier: 'advanced', surahName: 'سورة البقرة', ayahNumber: 255, prompt: 'أين اللفظ الدخيل في خاتمة آية الكرسي: «وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْكَبِيرُ»؟', options: ['الْكَبِيرُ (الصواب: الْعَظِيمُ)', 'يَئُودُهُ', 'حِفْظُهُمَا', 'الْعَلِيُّ'], correctAnswer: 'الْكَبِيرُ (الصواب: الْعَظِيمُ)', explanation: 'خاتمة آية الكرسي: «وَهُوَ الْعَلِيُّ الْعَظِيمُ»، بينما «العلي الكبير» في سور أخرى كالحج وسبأ وغافر.' },
  ],
  next_ayah: [
    { id: 'na1', tier: 'beginner', surahName: 'سورة الشرح', ayahNumber: 3, prompt: 'ما الآية التي تلي: «الَّذِي أَنقَضَ ظَهْرَكَ»؟', options: ['وَرَفَعْنَا لَكَ ذِكْرَكَ', 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', 'وَوَضَعْنَا عَنكَ وِزْرَكَ', 'وَإِلَىٰ رَبِّكَ فَارْغَب'], correctAnswer: 'وَرَفَعْنَا لَكَ ذِكْرَكَ', explanation: 'الترتيب: ووضعنا عنك وزرك ۝ الذي أنقض ظهرك ۝ ورفعنا لك ذكرك.' },
    { id: 'na2', tier: 'beginner', surahName: 'سورة التين', ayahNumber: 4, prompt: 'ما الآية التي تلي: «لَقَدْ خَلَقْنَا الْإِنسَانَ فِي أَحْسَنِ تَقْوِيمٍ»؟', options: ['ثُمَّ رَدَدْنَاهُ أَسْفَلَ سَافِلِينَ', 'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ', 'فَمَا يُكَذِّبُكَ بَعْدُ بِالدِّينِ', 'أَلَيْسَ اللَّهُ بِأَحْكَمِ الْحَاكِمِينَ'], correctAnswer: 'ثُمَّ رَدَدْنَاهُ أَسْفَلَ سَافِلِينَ', explanation: 'الآية الخامسة من سورة التين.' },
    { id: 'na3', tier: 'intermediate', surahName: 'سورة الملك', ayahNumber: 3, prompt: 'ما الآية التي تلي: «فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ»؟', options: ['ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ', 'وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ', 'وَلِلَّذِينَ كَفَرُوا بِرَبِّهِمْ عَذَابُ جَهَنَّمَ', 'تَكَادُ تَمَيَّزُ مِنَ الْغَيْظِ'], correctAnswer: 'ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ', explanation: 'الآية الرابعة من سورة الملك.' },
    { id: 'na4', tier: 'advanced', surahName: 'سورة البقرة', ayahNumber: 3, prompt: 'ما الآية التي تلي: «الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ»؟', options: ['وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ', 'أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ', 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ', 'إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ'], correctAnswer: 'وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ', explanation: 'الآية الرابعة من مطلع سورة البقرة.' },
  ],
  tajweed_hunter: [
    { id: 'tj1', tier: 'beginner', surahName: 'سورة الزلزلة', ayahNumber: 7, prompt: 'ما الحكم التجويدي في قوله تعالى: «فَمَن يَعْمَلْ»؟', options: ['إدغام بغنة', 'إظهار حلقي', 'إقلاب', 'قلقلة صغرى'], correctAnswer: 'إدغام بغنة', explanation: 'نون ساكنة جاء بعدها حرف الياء (من حروف ينمو) فتُدغم بغنة بمقدار حركتين.' },
    { id: 'tj2', tier: 'beginner', surahName: 'سورة الناس', ayahNumber: 4, prompt: 'ما الحكم التجويدي في: «مِن شَرِّ»؟', options: ['إخفاء حقيقي', 'إظهار حلقي', 'إقلاب', 'إدغام بغير غنة'], correctAnswer: 'إخفاء حقيقي', explanation: 'نون ساكنة جاء بعدها حرف الشين فتُخفى بغنة مرققة بمقدار حركتين.' },
    { id: 'tj3', tier: 'intermediate', surahName: 'سورة البقرة', ayahNumber: 253, prompt: 'ما الحكم التجويدي في: «مِن بَعْدِ»؟', options: ['إقلاب', 'إخفاء شفوي', 'إظهار حلقي', 'إدغام مثلين'], correctAnswer: 'إقلاب', explanation: 'نون ساكنة جاء بعدها حرف الباء فتُقلب ميماً مخفاة مع الغنة.' },
    { id: 'tj4', tier: 'intermediate', surahName: 'سورة الفيل', ayahNumber: 4, prompt: 'ما حكم الميم الساكنة في: «تَرْمِيهِم بِحِجَارَةٍ»؟', options: ['إخفاء شفوي', 'إقلاب', 'إظهار شفوي', 'إدغام شفوي'], correctAnswer: 'إخفاء شفوي', explanation: 'ميم ساكنة جاء بعدها حرف الباء فحكمها الإخفاء الشفوي بغنة حركتين.' },
    { id: 'tj5', tier: 'advanced', surahName: 'سورة الفاتحة', ayahNumber: 7, prompt: 'ما نوع المد في كلمة: «الضَّالِّينَ»؟', options: ['مد لازم كلمي مثقّل (6 حركات)', 'مد واجب متصل (4-5 حركات)', 'مد عارض للسكون', 'مد بدل'], correctAnswer: 'مد لازم كلمي مثقّل (6 حركات)', explanation: 'جاء بعد حرف المد حرف مشدد في كلمة واحدة فيُمد 6 حركات لزوماً.' },
    { id: 'tj6', tier: 'advanced', surahName: 'سورة البقرة', ayahNumber: 2, prompt: 'ما الحكم في قوله تعالى: «هُدًى لِّلْمُتَّقِينَ»؟', options: ['إدغام كامل بغير غنة', 'إدغام ناقص بغنة', 'إخفاء حقيقي', 'إظهار حلقي'], correctAnswer: 'إدغام كامل بغير غنة', explanation: 'تنوين جاء بعده حرف اللام (ل، ر) فيُدغم بلا غنة.' },
  ],
  mutashabihat: [
    { id: 'mu1', tier: 'beginner', surahName: 'جزء عمّ', ayahNumber: 1, prompt: '«وَيْلٌ لِّلْمُطَفِّفِينَ» في المطففين، ففي أي سورة: «وَيْلٌ لِّكُلِّ هُمَزَةٍ لُّمَزَةٍ»؟', options: ['سورة الهمزة', 'سورة الماعون', 'سورة التكاثر', 'سورة القارعة'], correctAnswer: 'سورة الهمزة', explanation: 'سورتان فقط في القرآن تبدآن بلفظ «ويل»: المطففين والهمزة.' },
    { id: 'mu2', tier: 'intermediate', surahName: 'الفرقان والملك', ayahNumber: 1, prompt: '«تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ» في الملك، ففي أي سورة: «تَبَارَكَ الَّذِي نَزَّلَ الْفُرْقَانَ»؟', options: ['سورة الفرقان', 'سورة الزخرف', 'سورة الأعراف', 'سورة المؤمنون'], correctAnswer: 'سورة الفرقان', explanation: 'مطلع سورة الفرقان هو الموضع الآخر الوحيد الذي يفتتح السورة بـ «تبارك الذي».' },
    { id: 'mu3', tier: 'intermediate', surahName: 'القدر والدخان', ayahNumber: 3, prompt: 'في أي سورة ورد قوله تعالى: «إِنَّا أَنزَلْنَاهُ فِي لَيْلَةٍ مُّبَارَكَةٍ»؟', options: ['سورة الدخان', 'سورة القدر', 'سورة البقرة', 'سورة المزمل'], correctAnswer: 'سورة الدخان', explanation: '«ليلة مباركة» في مطلع سورة الدخان، و«ليلة القدر» في سورة القدر.' },
    { id: 'mu4', tier: 'advanced', surahName: 'سور الحمد', ayahNumber: 1, prompt: 'كم سورة في القرآن الكريم تفتتح بقوله تعالى: «الْحَمْدُ لِلَّهِ»؟', options: ['5 سور (الفاتحة، الأنعام، الكهف، سبأ، فاطر)', '4 سور', '3 سور', '7 سور'], correctAnswer: '5 سور (الفاتحة، الأنعام، الكهف، سبأ، فاطر)', explanation: 'السور الخمس المفتتحة بالحمد: الفاتحة، الأنعام، الكهف، سبأ، فاطر.' },
  ],
};

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tokenizeAyahWords(text) {
  return String(text || '')
    .replace(/[۞۩﴿﴾]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * توليد تحدٍّ فوري حي من آيات صفحة المصحف المفتوحة حالياً أمام المعلم والطالب!
 */
export function buildChallengeFromPageVerses({ surahName, verses = [], mode = 'ayah_puzzle', preferredAyahNum = null }) {
  const cleanVerses = (verses || [])
    .map((v) => ({
      num: v.num,
      text: String(v.text || '').trim(),
      words: tokenizeAyahWords(v.text),
    }))
    .filter((v) => v.words.length >= 3);

  if (cleanVerses.length === 0) return null;

  const chosen = (preferredAyahNum && cleanVerses.find((v) => v.num === preferredAyahNum))
    || cleanVerses[Math.floor(Math.random() * cleanVerses.length)];

  if (mode === 'next_ayah' && cleanVerses.length >= 2) {
    const validFirsts = cleanVerses.slice(0, -1);
    const idx = Math.floor(Math.random() * validFirsts.length);
    const current = cleanVerses[idx];
    const nextVerse = cleanVerses[idx + 1];
    const otherVerses = cleanVerses
      .filter((_, i) => i !== idx && i !== idx + 1)
      .map((v) => v.text.slice(0, 90));
    const fallbackDistractors = [
      'إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
      'وَاللَّهُ عَلِيمٌ حَكِيمٌ',
      'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
    ];
    const correctShort = nextVerse.text.slice(0, 90);
    const distractors = [...otherVerses, ...fallbackDistractors]
      .filter((t) => t !== correctShort)
      .slice(0, 3);
    return {
      mode: 'next_ayah',
      surahName: surahName || 'الصفحة الحالية',
      ayahNumber: current.num,
      prompt: `ما الآية التي تلي قوله تعالى: «${current.text.slice(0, 110)}»؟`,
      options: shuffleArray([correctShort, ...distractors]),
      correctAnswer: correctShort,
      explanation: `الآية رقم (${nextVerse.num}) من ${surahName || 'السورة الحالية'}.`,
    };
  }

  if (mode === 'missing_word') {
    const targetWords = chosen.words.slice(0, 14);
    const hideIdx = Math.max(1, Math.min(targetWords.length - 1, Math.floor(targetWords.length * 0.65)));
    const answerWord = targetWords[hideIdx];
    const maskedWords = targetWords.map((w, idx) => (idx === hideIdx ? '_____' : w));
    const pageWordPool = Array.from(
      new Set(
        cleanVerses
          .flatMap((v) => v.words)
          .filter((w) => w.length >= 3 && w !== answerWord)
      )
    );
    const fallbackWords = ['الْعَظِيمِ', 'الْحَكِيمُ', 'مُّبِينٌ', 'الْعَالَمِينَ'];
    const distractors = shuffleArray([...pageWordPool, ...fallbackWords])
      .filter((w) => w !== answerWord)
      .slice(0, 3);

    return {
      mode: 'missing_word',
      surahName: surahName || 'الصفحة الحالية',
      ayahNumber: chosen.num,
      prompt: maskedWords.join(' '),
      options: shuffleArray([answerWord, ...distractors]),
      correctAnswer: answerWord,
      explanation: `النص الكامل للآية (${chosen.num}): «${targetWords.join(' ')}»`,
    };
  }

  // Default: ayah_puzzle (limit to 9 words so mobile & desktop chips are comfortable)
  const sliceWords = chosen.words.slice(0, 9);
  let scrambled = shuffleArray(sliceWords);
  if (scrambled.join(' ') === sliceWords.join(' ') && sliceWords.length > 1) {
    scrambled = [...sliceWords.slice(1), sliceWords[0]];
  }
  return {
    mode: 'ayah_puzzle',
    surahName: surahName || 'الصفحة الحالية',
    ayahNumber: chosen.num,
    prompt: `رتّب كلمات الآية (${chosen.num}) من ${surahName || 'السورة الحالية'}:`,
    words: scrambled,
    options: [],
    correctAnswer: sliceWords.join(' '),
    explanation: `الترتيب الصحيح: «${sliceWords.join(' ')}»`,
  };
}

export function createBankRoundPayload(modeId, selectedTier = 'all', durationSec = 25) {
  const pool = CLASSROOM_QUESTION_BANK[modeId] || CLASSROOM_QUESTION_BANK.missing_word;
  const filtered = selectedTier === 'all' ? pool : pool.filter((q) => q.tier === selectedTier);
  const candidates = filtered.length > 0 ? filtered : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  let words = [];
  let correctAnswer = picked.correctAnswer || '';
  let prompt = picked.prompt || '';

  if (modeId === 'ayah_puzzle' && Array.isArray(picked.words)) {
    correctAnswer = picked.words.join(' ');
    const shuffled = shuffleArray(picked.words);
    words = shuffled.join(' ') === correctAnswer && picked.words.length > 1
      ? [...picked.words.slice(1), picked.words[0]]
      : shuffled;
    prompt = `رتّب كلمات الآية (${picked.ayahNumber}) من ${picked.surahName}:`;
  }

  return {
    roundId: `bank_${modeId}_${Date.now()}`,
    status: 'active',
    mode: modeId,
    prompt,
    surahName: picked.surahName || '',
    ayahNumber: picked.ayahNumber || 0,
    words,
    options: picked.options || [],
    correctAnswer,
    explanation: picked.explanation || '',
    durationSec,
  };
}

export function createPageRoundPayload({ currentPageData, modeId = 'ayah_puzzle', durationSec = 25 }) {
  if (!currentPageData?.verses?.length) return null;
  const built = buildChallengeFromPageVerses({
    surahName: currentPageData.surahName,
    verses: currentPageData.verses,
    mode: modeId,
  });
  if (!built) return null;
  return {
    roundId: `page_${modeId}_${Date.now()}`,
    status: 'active',
    ...built,
    durationSec,
  };
}
