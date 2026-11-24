export type GameTier = 'all' | 'beginner' | 'intermediate' | 'advanced';

export interface AyahPuzzleItem {
  id: string;
  tier: Exclude<GameTier, 'all'>;
  surahAr: string;
  surahEn: string;
  ayahNumber: number;
  words: string[];
}

export interface MissingWordItem {
  id: string;
  tier: Exclude<GameTier, 'all'>;
  surahAr: string;
  ayahNumber: number;
  before: string;
  after: string;
  answer: string;
  options: string[];
}

export interface TajweedQuestion {
  id: string;
  tier: Exclude<GameTier, 'all'>;
  surahAr: string;
  excerpt: string;
  highlighted: string;
  answer: string;
  options: string[];
  explanationAr: string;
  explanationEn: string;
}

export interface MutashabihatQuestion {
  id: string;
  tier: Exclude<GameTier, 'all'>;
  opening: string;
  promptAr: string;
  promptEn: string;
  answer: string;
  options: string[];
  tipAr: string;
}

export const AYAH_PUZZLES: AyahPuzzleItem[] = [
  // Beginner (Al-Fatihah & Juz Amma)
  { id: 'p1', tier: 'beginner', surahAr: 'الفاتحة', surahEn: 'Al-Fatihah', ayahNumber: 5, words: ['إِيَّاكَ', 'نَعْبُدُ', 'وَإِيَّاكَ', 'نَسْتَعِينُ'] },
  { id: 'p2', tier: 'beginner', surahAr: 'الإخلاص', surahEn: 'Al-Ikhlas', ayahNumber: 1, words: ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ'] },
  { id: 'p3', tier: 'beginner', surahAr: 'العصر', surahEn: 'Al-Asr', ayahNumber: 2, words: ['إِنَّ', 'الْإِنسَانَ', 'لَفِي', 'خُسْرٍ'] },
  { id: 'p4', tier: 'beginner', surahAr: 'الشرح', surahEn: 'Ash-Sharh', ayahNumber: 5, words: ['فَإِنَّ', 'مَعَ', 'الْعُسْرِ', 'يُسْرًا'] },
  { id: 'p5', tier: 'beginner', surahAr: 'القدر', surahEn: 'Al-Qadr', ayahNumber: 3, words: ['لَيْلَةُ', 'الْقَدْرِ', 'خَيْرٌ', 'مِّنْ', 'أَلْفِ', 'شَهْرٍ'] },
  { id: 'p6', tier: 'beginner', surahAr: 'الضحى', surahEn: 'Ad-Duhaa', ayahNumber: 4, words: ['وَلَلْآخِرَةُ', 'خَيْرٌ', 'لَّكَ', 'مِنَ', 'الْأُولَىٰ'] },
  { id: 'p7', tier: 'beginner', surahAr: 'الكوثر', surahEn: 'Al-Kawthar', ayahNumber: 2, words: ['فَصَلِّ', 'لِرَبِّكَ', 'وَانْحَرْ'] },
  { id: 'p8', tier: 'beginner', surahAr: 'قريش', surahEn: 'Quraysh', ayahNumber: 3, words: ['فَلْيَعْبُدُوا', 'رَبَّ', 'هَٰذَا', 'الْبَيْتِ'] },
  { id: 'p9', tier: 'beginner', surahAr: 'التين', surahEn: 'At-Tin', ayahNumber: 4, words: ['لَقَدْ', 'خَلَقْنَا', 'الْإِنسَانَ', 'فِي', 'أَحْسَنِ', 'تَقْوِيمٍ'] },
  { id: 'p10', tier: 'beginner', surahAr: 'العلق', surahEn: 'Al-Alaq', ayahNumber: 1, words: ['اقْرَأْ', 'بِاسْمِ', 'رَبِّكَ', 'الَّذِي', 'خَلَقَ'] },
  // Intermediate (Juz Tabarak, Yasin, Qamar, Rahman)
  { id: 'p11', tier: 'intermediate', surahAr: 'الملك', surahEn: 'Al-Mulk', ayahNumber: 1, words: ['تَبَارَكَ', 'الَّذِي', 'بِيَدِهِ', 'الْمُلْكُ', 'وَهُوَ', 'عَلَىٰ', 'كُلِّ', 'شَيْءٍ', 'قَدِيرٌ'] },
  { id: 'p12', tier: 'intermediate', surahAr: 'القمر', surahEn: 'Al-Qamar', ayahNumber: 17, words: ['وَلَقَدْ', 'يَسَّرْنَا', 'الْقُرْآنَ', 'لِلذِّكْرِ', 'فَهَلْ', 'مِن', 'مُّدَّكِرٍ'] },
  { id: 'p13', tier: 'intermediate', surahAr: 'المزمل', surahEn: 'Al-Muzzammil', ayahNumber: 4, words: ['أَوْ', 'زِدْ', 'عَلَيْهِ', 'وَرَتِّلِ', 'الْقُرْآنَ', 'تَرْتِيلًا'] },
  { id: 'p14', tier: 'intermediate', surahAr: 'يس', surahEn: 'Ya-Sin', ayahNumber: 82, words: ['إِنَّمَا', 'أَمْرُهُ', 'إِذَا', 'أَرَادَ', 'شَيْئًا', 'أَن', 'يَقُولَ', 'لَهُ', 'كُن', 'فَيَكُونُ'] },
  { id: 'p15', tier: 'intermediate', surahAr: 'الرحمن', surahEn: 'Ar-Rahman', ayahNumber: 60, words: ['هَلْ', 'جَزَاءُ', 'الْإِحْسَانِ', 'إِلَّا', 'الْإِحْسَانُ'] },
  // Advanced (Al-Baqarah, Ali Imran, Al-Isra, Al-Kahf)
  { id: 'p16', tier: 'advanced', surahAr: 'البقرة', surahEn: 'Al-Baqarah', ayahNumber: 2, words: ['ذَٰلِكَ', 'الْكِتَابُ', 'لَا', 'رَيْبَ', 'فِيهِ', 'هُدًى', 'لِّلْمُتَّقِينَ'] },
  { id: 'p17', tier: 'advanced', surahAr: 'البقرة', surahEn: 'Al-Baqarah', ayahNumber: 152, words: ['فَاذْكُرُونِي', 'أَذْكُرْكُمْ', 'وَاشْكُرُوا', 'لِي', 'وَلَا', 'تَكْفُرُونِ'] },
  { id: 'p18', tier: 'advanced', surahAr: 'البقرة', surahEn: 'Al-Baqarah', ayahNumber: 286, words: ['لَا', 'يُكَلِّفُ', 'اللَّهُ', 'نَفْسًا', 'إِلَّا', 'وُسْعَهَا'] },
  { id: 'p19', tier: 'advanced', surahAr: 'آل عمران', surahEn: 'Ali Imran', ayahNumber: 8, words: ['رَبَّنَا', 'لَا', 'تُزِغْ', 'قُلُوبَنَا', 'بَعْدَ', 'إِذْ', 'هَدَيْتَنَا'] },
  { id: 'p20', tier: 'advanced', surahAr: 'الإسراء', surahEn: 'Al-Isra', ayahNumber: 9, words: ['إِنَّ', 'هَٰذَا', 'الْقُرْآنَ', 'يَهْدِي', 'لِلَّتِي', 'هِيَ', 'أَقْوَمُ'] },
];

export const MISSING_WORD_QUESTIONS: MissingWordItem[] = [
  // Beginner
  { id: 'm1', tier: 'beginner', surahAr: 'الفلق', ayahNumber: 1, before: 'قُلْ أَعُوذُ بِرَبِّ', after: '', answer: 'الْفَلَقِ', options: ['الْفَلَقِ', 'النَّاسِ', 'الْعَالَمِينَ', 'الْبَيْتِ'] },
  { id: 'm2', tier: 'beginner', surahAr: 'الكوثر', ayahNumber: 1, before: 'إِنَّا أَعْطَيْنَاكَ', after: '', answer: 'الْكَوْثَرَ', options: ['الْكَوْثَرَ', 'الْكِتَابَ', 'الْحِكْمَةَ', 'الْفُرْقَانَ'] },
  { id: 'm3', tier: 'beginner', surahAr: 'النبأ', ayahNumber: 2, before: 'عَنِ النَّبَإِ', after: '', answer: 'الْعَظِيمِ', options: ['الْعَظِيمِ', 'الْكَرِيمِ', 'الْمُبِينِ', 'الْحَكِيمِ'] },
  { id: 'm4', tier: 'beginner', surahAr: 'الأعلى', ayahNumber: 1, before: 'سَبِّحِ اسْمَ رَبِّكَ', after: '', answer: 'الْأَعْلَى', options: ['الْأَعْلَى', 'الْعَظِيمِ', 'الْكَرِيمِ', 'الْأَكْرَمِ'] },
  { id: 'm5', tier: 'beginner', surahAr: 'العلق', ayahNumber: 1, before: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي', after: '', answer: 'خَلَقَ', options: ['خَلَقَ', 'عَلَّمَ', 'رَزَقَ', 'هَدَىٰ'] },
  { id: 'm6', tier: 'beginner', surahAr: 'الشمس', ayahNumber: 9, before: 'قَدْ أَفْلَحَ مَن', after: '', answer: 'زَكَّاهَا', options: ['زَكَّاهَا', 'دَسَّاهَا', 'سَوَّاهَا', 'بَنَاهَا'] },
  { id: 'm7', tier: 'beginner', surahAr: 'الضحى', ayahNumber: 9, before: 'فَأَمَّا الْيَتِيمَ فَلَا', after: '', answer: 'تَقْهَرْ', options: ['تَقْهَرْ', 'تَنْهَرْ', 'تَحْزَنْ', 'تَخَفْ'] },
  { id: 'm8', tier: 'beginner', surahAr: 'الفيل', ayahNumber: 3, before: 'وَأَرْسَلَ عَلَيْهِمْ طَيْرًا', after: '', answer: 'أَبَابِيلَ', options: ['أَبَابِيلَ', 'سِجِّيلٍ', 'مَّأْكُولٍ', 'تَضْلِيلٍ'] },
  // Intermediate
  { id: 'm9', tier: 'intermediate', surahAr: 'الملك', ayahNumber: 2, before: 'لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ', after: '', answer: 'عَمَلًا', options: ['عَمَلًا', 'قَوْلًا', 'صَبْرًا', 'ذِكْرًا'] },
  { id: 'm10', tier: 'intermediate', surahAr: 'القلم', ayahNumber: 4, before: 'وَإِنَّكَ لَعَلَىٰ خُلُقٍ', after: '', answer: 'عَظِيمٍ', options: ['عَظِيمٍ', 'كَرِيمٍ', 'قَوِيمٍ', 'مُسْتَقِيمٍ'] },
  { id: 'm11', tier: 'intermediate', surahAr: 'نوح', ayahNumber: 10, before: 'فَقُلْتُ اسْتَغْفِرُوا رَبَّكُمْ إِنَّهُ كَانَ', after: '', answer: 'غَفَّارًا', options: ['غَفَّارًا', 'رَحِيمًا', 'تَوَّابًا', 'عَلِيمًا'] },
  { id: 'm12', tier: 'intermediate', surahAr: 'الإنسان', ayahNumber: 9, before: 'إِنَّمَا نُطْعِمُكُمْ لِوَجْهِ اللَّهِ لَا نُرِيدُ مِنكُمْ جَزَاءً وَلَا', after: '', answer: 'شُكُورًا', options: ['شُكُورًا', 'أَجْرًا', 'عِوَضًا', 'ثَوَابًا'] },
  // Advanced
  { id: 'm13', tier: 'advanced', surahAr: 'الكهف', ayahNumber: 10, before: 'رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا', after: '', answer: 'رَشَدًا', options: ['رَشَدًا', 'مَخْرَجًا', 'فَرَجًا', 'سَدَادًا'] },
  { id: 'm14', tier: 'advanced', surahAr: 'الرعد', ayahNumber: 28, before: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ', after: '', answer: 'الْقُلُوبُ', options: ['الْقُلُوبُ', 'النُّفُوسُ', 'الصُّدُورُ', 'الْعُقُولُ'] },
  { id: 'm15', tier: 'advanced', surahAr: 'طه', ayahNumber: 114, before: 'وَقُل رَّبِّ زِدْنِي', after: '', answer: 'عِلْمًا', options: ['عِلْمًا', 'حِلْمًا', 'هُدًى', 'فَهْمًا'] },
  { id: 'm16', tier: 'advanced', surahAr: 'الفرقان', ayahNumber: 63, before: 'وَعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ', after: '', answer: 'هَوْنًا', options: ['هَوْنًا', 'سَكِينَةً', 'وَقَارًا', 'صِدْقًا'] },
];

export const TAJWEED_QUESTIONS: TajweedQuestion[] = [
  // Beginner
  { id: 't1', tier: 'beginner', surahAr: 'الزلزلة', excerpt: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ', highlighted: 'فَمَن يَعْمَلْ', answer: 'إدغام بغنة', options: ['إدغام بغنة', 'إظهار حلقي', 'إقلاب', 'قلقلة'], explanationAr: 'نون ساكنة جاء بعدها حرف الياء (من حروف ينمو) فالحكم إدغام بغنة بمقدار حركتين.', explanationEn: 'Noon Sakinah + Ya (ينمو) → Idgham with Ghunnah.' },
  { id: 't2', tier: 'beginner', surahAr: 'الإخلاص', excerpt: 'قُلْ هُوَ اللَّهُ أَحَدٌ', highlighted: 'أَحَدٌ (عند الوقف)', answer: 'قلقلة كبرى', options: ['قلقلة كبرى', 'إدغام بغير غنة', 'إخفاء حقيقي', 'مد متصل'], explanationAr: 'الدال من حروف القلقلة (قطب جد)، وعند الوقف عليها تكون قلقلة كبرى واضحة.', explanationEn: 'Dal (قطب جد) at stop → Qalqalah Kubra.' },
  { id: 't3', tier: 'beginner', surahAr: 'الكوثر', excerpt: 'فَصَلِّ لِرَبِّكَ وَانْحَرْ', highlighted: 'وَانْحَرْ', answer: 'إظهار حلقي', options: ['إظهار حلقي', 'إخفاء حقيقي', 'إدغام بغنة', 'إقلاب'], explanationAr: 'نون ساكنة جاء بعدها حرف الحاء (من حروف الحلق) فتُظهر النون بوضوح.', explanationEn: 'Noon Sakinah + Ha (throat letter) → Izhar Halqi.' },
  { id: 't4', tier: 'beginner', surahAr: 'الناس', excerpt: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', highlighted: 'مِن شَرِّ', answer: 'إخفاء حقيقي', options: ['إخفاء حقيقي', 'إظهار حلقي', 'إقلاب', 'إدغام بغير غنة'], explanationAr: 'نون ساكنة جاء بعدها حرف الشين (من حروف الإخفاء) فتُخفى النون بغنة حركتين.', explanationEn: 'Noon Sakinah + Sheen → Ikhfa Haqiqi.' },
  { id: 't5', tier: 'beginner', surahAr: 'النبأ', excerpt: 'عَمَّ يَتَسَاءَلُونَ', highlighted: 'عَمَّ', answer: 'ميم مشددة بغنة', options: ['ميم مشددة بغنة', 'إظهار شفوي', 'قلقلة', 'مد طبيعي'], explanationAr: 'الميم المشددة يجب فيها الغنة أكمل ما تكون بمقدار حركتين.', explanationEn: 'Meem Mushaddadah carries full Ghunnah (2 counts).' },
  // Intermediate
  { id: 't6', tier: 'intermediate', surahAr: 'البقرة', excerpt: 'مِن بَعْدِ مَا جَاءَتْهُمُ الْبَيِّنَاتُ', highlighted: 'مِن بَعْدِ', answer: 'إقلاب', options: ['إقلاب', 'إظهار حلقي', 'إدغام بغنة', 'مد لازم'], explanationAr: 'نون ساكنة جاء بعدها حرف الباء فتُقلب ميماً مخفاة بغنة.', explanationEn: 'Noon Sakinah + Ba → Iqlab with Ghunnah.' },
  { id: 't7', tier: 'intermediate', surahAr: 'النصر', excerpt: 'إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ', highlighted: 'جَاءَ', answer: 'مد واجب متصل', options: ['مد واجب متصل', 'مد جائز منفصل', 'قلقلة صغرى', 'إخفاء شفوي'], explanationAr: 'حرف المد وبعده الهمزة في كلمة واحدة → مد واجب متصل (4 أو 5 حركات).', explanationEn: 'Madd + Hamzah in one word → Madd Wajib Muttasil.' },
  { id: 't8', tier: 'intermediate', surahAr: 'الفيل', excerpt: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ', highlighted: 'تَرْمِيهِم بِحِجَارَةٍ', answer: 'إخفاء شفوي', options: ['إخفاء شفوي', 'إقلاب', 'إظهار شفوي', 'إدغام شفوي'], explanationAr: 'ميم ساكنة جاء بعدها حرف الباء فالحكم إخفاء شفوي بغنة حركتين.', explanationEn: 'Meem Sakinah + Ba → Ikhfa Shafawi.' },
  { id: 't9', tier: 'intermediate', surahAr: 'قريش', excerpt: 'الَّذِي أَطْعَمَهُم مِّن جُوعٍ', highlighted: 'أَطْعَمَهُم مِّن', answer: 'إدغام مثلين صغير', options: ['إدغام مثلين صغير', 'إظهار شفوي', 'إخفاء شفوي', 'إقلاب'], explanationAr: 'ميم ساكنة جاء بعدها ميم متحركة فتُدغم فيها مع غنة حركتين.', explanationEn: 'Meem Sakinah + Meem → Idgham Shafawi.' },
  { id: 't10', tier: 'intermediate', surahAr: 'الكوثر', excerpt: 'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', highlighted: 'إِنَّا أَعْطَيْنَاكَ', answer: 'مد جائز منفصل', options: ['مد جائز منفصل', 'مد واجب متصل', 'مد لازم', 'مد عوض'], explanationAr: 'حرف المد في آخر كلمة والهمزة في أول الكلمة التالية → مد جائز منفصل.', explanationEn: 'Madd at end of word + Hamzah at start of next → Madd Munfasil.' },
  // Advanced
  { id: 't11', tier: 'advanced', surahAr: 'الفاتحة', excerpt: 'وَلَا الضَّالِّينَ', highlighted: 'الضَّالِّينَ', answer: 'مد لازم كلمي مثقّل', options: ['مد لازم كلمي مثقّل', 'مد واجب متصل', 'مد عارض للسكون', 'مد لين'], explanationAr: 'جاء بعد حرف المد حرف مشدد (اللام المشددة) في كلمة واحدة فيُمد 6 حركات لزوماً.', explanationEn: 'Madd followed by Shaddah in one word → Madd Lazim (6 counts).' },
  { id: 't12', tier: 'advanced', surahAr: 'البقرة', excerpt: 'هُدًى لِّلْمُتَّقِينَ', highlighted: 'هُدًى لِّلْمُتَّقِينَ', answer: 'إدغام بغير غنة', options: ['إدغام بغير غنة', 'إدغام بغنة', 'إخفاء حقيقي', 'إظهار حلقي'], explanationAr: 'تنوين جاء بعده حرف اللام (من حروف ل، ر) فالحكم إدغام كامل بغير غنة.', explanationEn: 'Tanween + Lam (ل / ر) → Idgham without Ghunnah.' },
  { id: 't13', tier: 'advanced', surahAr: 'الإخلاص', excerpt: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', highlighted: 'لَمْ يَلِدْ', answer: 'إظهار شفوي', options: ['إظهار شفوي', 'إدغام شفوي', 'إخفاء شفوي', 'إدغام بغنة'], explanationAr: 'ميم ساكنة جاء بعدها ياء (ليست ميماً ولا باءً) فتُظهر الميم بوضوح.', explanationEn: 'Meem Sakinah + Ya → Izhar Shafawi.' },
  { id: 't14', tier: 'advanced', surahAr: 'العاديات', excerpt: 'وَالْعَادِيَاتِ ضَبْحًا', highlighted: 'ضَبْحًا (عند الوقف)', answer: 'مد عوض', options: ['مد عوض', 'مد متصل', 'مد لين', 'مد لازم'], explanationAr: 'الوقف على تنوين الفتح بألف مدية بمقدار حركتين يُسمى مد عوض.', explanationEn: 'Stopping on Fathatayn with a 2-count Alif → Madd Iwad.' },
];

export const MUTASHABIHAT_QUESTIONS: MutashabihatQuestion[] = [
  { id: 'mu1', tier: 'beginner', opening: 'وَمَا أَدْرَاكَ مَا ...', promptAr: 'أي سورة تبدأ بـ «الْقَارِعَةُ ۝ مَا الْقَارِعَةُ ۝ وَمَا أَدْرَاكَ مَا الْقَارِعَةُ»؟', promptEn: 'Which Surah opens with "Al-Qariah..."?', answer: 'سورة القارعة', options: ['سورة القارعة', 'سورة الحاقة', 'سورة الهمزة', 'سورة الطارق'], tipAr: 'تكرّر أسلوب «ما ... وما أدراك ما ...» في القارعة والحاقة والطارق والقدر.' },
  { id: 'mu2', tier: 'beginner', opening: 'قُلْ يَا أَيُّهَا ...', promptAr: 'في سورة الكافرون «قُلْ يَا أَيُّهَا الْكَافِرُونَ»، فما الآية التي تليها مباشرة؟', promptEn: 'What immediately follows "Qul ya ayyuhal-kafirun"?', answer: 'لَا أَعْبُدُ مَا تَعْبُدُونَ', options: ['لَا أَعْبُدُ مَا تَعْبُدُونَ', 'وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ', 'لَكُمْ دِينُكُمْ وَلِيَ دِينِ', 'وَلَا أَنَا عَابِدٌ مَّا عَبَدتُّمْ'], tipAr: 'تذكّر الترتيب: لا أعبد ← ولا أنتم عابدون ← ولا أنا عابد ← ولا أنتم عابدون.' },
  { id: 'mu3', tier: 'beginner', opening: 'وَيْلٌ لِّكُلِّ ...', promptAr: '«وَيْلٌ لِّلْمُطَفِّفِينَ» في سورة المطففين، ففي أي سورة «وَيْلٌ لِّكُلِّ هُمَزَةٍ لُّمَزَةٍ»؟', promptEn: 'Which Surah begins with "Waylun likulli humazatin lumazah"?', answer: 'سورة الهمزة', options: ['سورة الهمزة', 'سورة المطففين', 'سورة الماعون', 'سورة التكاثر'], tipAr: 'سورتان فقط في القرآن تبدآن بلفظ «ويل»: المطففين والهمزة!' },
  { id: 'mu4', tier: 'intermediate', opening: 'تَبَارَكَ الَّذِي ...', promptAr: '«تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ» في سورة الملك، ففي أي سورة «تَبَارَكَ الَّذِي نَزَّلَ الْفُرْقَانَ»؟', promptEn: 'Where does "Tabarakalladhi nazzalal-Furqan" appear?', answer: 'سورة الفرقان', options: ['سورة الفرقان', 'سورة الملك', 'سورة الزخرف', 'سورة الأعراف'], tipAr: 'سورتان فقط في القرآن تبدآن بـ «تبارك الذي»: الفرقان والملك!' },
  { id: 'mu5', tier: 'intermediate', opening: 'إِنَّا أَنزَلْنَاهُ ...', promptAr: 'في سورة القدر «إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ»، ففي أي سورة «إِنَّا أَنزَلْنَاهُ فِي لَيْلَةٍ مُّبَارَكَةٍ»؟', promptEn: 'Which Surah says "fi laylatin mubarakah"?', answer: 'سورة الدخان', options: ['سورة الدخان', 'سورة القدر', 'سورة يوسف', 'سورة طه'], tipAr: '«ليلة مباركة» في مطلع سورة الدخان، و«ليلة القدر» في سورة القدر.' },
  { id: 'mu6', tier: 'intermediate', opening: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', promptAr: 'كم مرة وردت آية «فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ» في سورة الرحمن؟', promptEn: 'How many times does this refrain repeat in Ar-Rahman?', answer: '31 مرة', options: ['31 مرة', '21 مرة', '19 مرة', '40 مرة'], tipAr: 'وردت 31 مرة في سورة الرحمن، و«ويل يومئذ للمكذبين» 10 مرات في المرسلات.' },
  { id: 'mu7', tier: 'advanced', opening: 'الْحَمْدُ لِلَّهِ الَّذِي ...', promptAr: 'كم سورة في القرآن الكريم تبدأ بلفظ «الْحَمْدُ لِلَّهِ»؟', promptEn: 'How many Surahs start with "Alhamdulillah"?', answer: '5 سور', options: ['5 سور', '3 سور', '4 سور', '7 سور'], tipAr: 'السور الخمس هي: الفاتحة، الأنعام، الكهف، سبأ، فاطر!' },
  { id: 'mu8', tier: 'advanced', opening: 'يَسْأَلُونَكَ عَنِ ...', promptAr: 'في سورة الأنفال «يَسْأَلُونَكَ عَنِ الْأَنفَالِ»، ففي أي سورة «يَسْأَلُونَكَ عَنِ الْأَهِلَّةِ»؟', promptEn: 'Where does "Yasalunaka anil-ahillah" appear?', answer: 'سورة البقرة', options: ['سورة البقرة', 'سورة الأنفال', 'سورة المائدة', 'سورة الأعراف'], tipAr: 'سورة البقرة تضم أشهر الأسئلة التشريعية: الأهلة، الخمر، اليتامى، المحيض، الإنفاق.' },
  { id: 'mu9', tier: 'advanced', opening: 'وَبَشِّرِ الصَّابِرِينَ', promptAr: 'في أي سورة وردت آية «وَلَنَبْلُوَنَّكُم بِشَيْءٍ مِّنَ الْخَوْفِ وَالْجُوعِ... وَبَشِّرِ الصَّابِرِينَ»؟', promptEn: 'In which Surah is "Wa bashshiris-sabirin"?', answer: 'سورة البقرة', options: ['سورة البقرة', 'سورة آل عمران', 'سورة العنكبوت', 'سورة لقمان'], tipAr: 'وردت في سورة البقرة آية 155، وعقبها مباشرة «الذين إذا أصابتهم مصيبة قالوا إنا لله وإنا إليه راجعون».' },
  { id: 'mu10', tier: 'advanced', opening: 'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ', promptAr: 'على لسان أي نبي وردت الآية الكريمة «وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ» في سورة هود؟', promptEn: 'Which prophet spoke this verse in Surah Hud?', answer: 'شعيب عليه السلام', options: ['شعيب عليه السلام', 'هود عليه السلام', 'صالح عليه السلام', 'نوح عليه السلام'], tipAr: 'قالها نبي الله شعيب عليه السلام لقومه في سورة هود آية 88.' },
];

export const ENCOURAGEMENT_QUOTES_AR = [
  '«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — رواه البخاري',
  '«الْمَاهِرُ بِالْقُرْآنِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ» — متفق عليه',
  '«اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا»',
  'كل حرف تقرأه بحسنة والحسنة بعشر أمثالها — استمر يا بطل!',
];
