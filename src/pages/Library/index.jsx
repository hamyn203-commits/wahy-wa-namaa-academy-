import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MonitorPlay,
  Play,
  BookOpen,
  Download,
  Eye,
  Search,
  FileText,
  Sparkles,
  Printer,
  X,
  RefreshCw
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const VIDEO_CATS = [
  { id: '', ar: 'الكل', en: 'All', fr: 'Tout', de: 'Alle', tr: 'Tümü', ur: 'سب', idLabel: 'Semua', ms: 'Semua', ku: 'هەموو' },
  { id: 'quran', ar: 'القرآن', en: 'Quran', fr: 'Coran', de: 'Koran', tr: 'Kur’an', ur: 'قرآن', idLabel: 'Al-Qur’an', ms: 'Al-Quran', ku: 'قورئان' },
  { id: 'tajweed', ar: 'التجويد', en: 'Tajweed', fr: 'Tajwid', de: 'Tadschwid', tr: 'Tecvid', ur: 'تجوید', idLabel: 'Tajwid', ms: 'Tajwid', ku: 'تەجوید' },
  { id: 'arabic', ar: 'العربية', en: 'Arabic', fr: 'Arabe', de: 'Arabisch', tr: 'Arapça', ur: 'عربی', idLabel: 'Arab', ms: 'Arab', ku: 'عەرەبی' },
  { id: 'seerah', ar: 'السيرة', en: 'Seerah', fr: 'Sîra', de: 'Sira', tr: 'Siyer', ur: 'سیرت', idLabel: 'Sirah', ms: 'Sirah', ku: 'ژیننامە' },
  { id: 'kids', ar: 'أطفال', en: 'Kids', fr: 'Enfants', de: 'Kinder', tr: 'Çocuklar', ur: 'بچے', idLabel: 'Anak', ms: 'Kanak-kanak', ku: 'منداڵان' },
];

const BOOK_CATS = [
  { id: 'all', ar: 'كافة الكتب والمتون', en: 'All Books & Texts', fr: 'Tous les livres', de: 'Alle Bücher & Texte', tr: 'Tüm Kitap ve Metinler', ur: 'تمام کتب اور متون', idLabel: 'Semua Buku & Matan', ms: 'Semua Buku & Teks', ku: 'هەموو کتێب و دەقەکان' },
  { id: 'matn', ar: 'متون التجويد والقراءات', en: 'Tajweed & Qiraat Texts', fr: 'Textes de Tajwid', de: 'Tadschwid-Texte', tr: 'Tecvid Metinleri', ur: 'تجوید و قراءات کے متون', idLabel: 'Matan Tajwid', ms: 'Matan Tajwid', ku: 'دەقەکانی تەجوید' },
  { id: 'mushaf', ar: 'مصاحف التجويد الملونة', en: 'Colored Tajweed Mushafs', fr: 'Mushafs de Tajwid', de: 'Farbige Tadschwid-Mushafs', tr: 'Renkli Tecvid Mushafları', ur: 'رنگین تجویدی مصاحف', idLabel: 'Mushaf Tajwid Berwarna', ms: 'Mushaf Tajwid Berwarna', ku: 'قورئانی تەجویدی ڕەنگاوڕەنگ' },
  { id: 'kids', ar: 'تأسيس الأطفال والبراعم', en: 'Kids Foundation Books', fr: 'Livres Enfants', de: 'Kinder-Grundlagen', tr: 'Çocuk Temel Kitapları', ur: 'بچوں کی بنیادی کتب', idLabel: 'Buku Dasar Anak', ms: 'Buku Asas Kanak-Kanak', ku: 'کتێبەکانی بنەمای منداڵان' },
  { id: 'tafseer', ar: 'شروح وتفاسير', en: 'Explanations & Tafseer', fr: 'Explications & Tafsir', de: 'Erklärungen & Tafsir', tr: 'Şerh ve Tefsirler', ur: 'شروحات و تفاسیر', idLabel: 'Syarah & Tafsir', ms: 'Syarahan & Tafsir', ku: 'شیکردنەوە و تەفسیر' },
];

const DIGITAL_BOOKS = [
  {
    id: 'tuhfat-al-atfal',
    title: 'متن تحفة الأطفال والغلمان في تجويد القرآن',
    titleEn: 'Tuhfat Al-Atfal (Poem of Tajweed for Beginners)',
    author: 'الشيخ سليمان بن حسين الجمزوري (ت: بعد 1198هـ)',
    category: 'matn',
    categoryName: 'متون التجويد',
    pages: 24,
    size: '2.4 MB',
    downloads: 0,
    featured: true,
    coverBg: 'from-amber-700 via-amber-800 to-amber-950',
    description: 'المنظومة الأشهر في أحكام التجويد للمبتدئين، محققة ومضبوطة بالشكل التام وفق رواية حفص عن عاصم مع شروحات ميسرة لأبيات المنظومة الـ 61.',
    chapters: [
      { title: 'المقدمة', content: 'يَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ * دَوْمًا سُلَيْمَانُ هُوَ الجَمْزُورِي\nالْحَمْدُ لِلَّهِ مُصَلِّيًا عَلَى * مُحَمَّدٍ وَآلِهِ وَمَنْ تَلاَ\nوَبَعْدُ: هَذَا النَّظْمُ لِلْمُرِيدِ * فِي النُّونِ وَالتَّنْوِينِ وَالْمُدُودِ\nسَمَّيْتُهُ بِتُحْفَةِ الأَطْفَالِ * عَنْ شَيْخِنَا الْمِيهِيِّ ذِي الكَمَالِ' },
      { title: 'أحكام النون الساكنة والتنوين', content: 'لِلنُّونِ إِنْ تَسْكُنْ وَلِلتَّنْوِينِ * أَرْبَعُ أَحْكَامٍ فَخُذْ تَبْيِينِي\nفَالأَوَّلُ الإِظْهَارُ قَبْلَ أَحْرُفِ * لِلْحَلْقِ سِتٌّ رُتِّبَتْ فَلْتَعْرِفِ\nهَمْزٌ فَهَاءٌ ثُمَّ عَيْنٌ حَاءُ * مُهْمَلَتَانِ ثُمَّ غَيْنٌ خَاءُ\nوَالثَّانِ إِدْغَامٌ بِسِتَّةٍ أَتَتْ * فِي (يَرْمُلُونَ) عِنْدَهُمْ قَدْ ثَبَتَتْ\nلَكِنَّهَا قِسْمَانِ قِسْمٌ يُدْغَمَا * فِيهِ بِغُنَّةٍ بِـ (يَنْمُو) عُلِمَا' },
      { title: 'أحكام الميم والنون المشددتين والميم الساكنة', content: 'وَغُنَّ نُونًا ثُمَّ مِيمًا شُدِّدَا * وَسَمِّ كُلاًّ حَرْفَ غُنَّةٍ بَدَا\nوَالمِيمُ إِنْ تَسْكُنْ تَجِي قَبْلَ الْهِجَا * لاَ أَلِفٍ لَيِّنَةٍ لِذِي الْحِجَا\nأَحْكَامُهَا ثَلاَثَةٌ لِمَنْ ضَبَطْ * إِخْفَاءٌ ادْغَامٌ وَإِظْهَارٌ فَقَطْ' },
      { title: 'أقسام المد وأحكامه', content: 'وَالمَدُّ أَصْلِيٌّ وَفَرْعِيٌّ لَهُ * وَسَمِّ أَوَّلاً طَبِيعِيًّا وَهُوْ\nمَا لاَ تَوَقُّفٌ لَهُ عَلَى سَبَبْ * وَلاَ بِدُونِهِ الحُرُوفُ تُجْتَلَبْ\nبَلْ أَيُّ حَرْفٍ غَيْرِ هَمْزٍ أَوْ سُكُونْ * جَا بَعْدَ مَدٍّ فَالطَّبِيعِيَّ يَكُونْ\nوَالآخَرُ الفَرْعِيُّ مَوْقُوفٌ عَلَى * سَبَبْ كَهَمْزٍ أَوْ سُكُونٍ مُسْجَلاَ' }
    ]
  },
  {
    id: 'al-jazariyyah',
    title: 'منظومة المقدمة الجزرية في علم التجويد',
    titleEn: 'Al-Muqaddimah Al-Jazariyyah',
    author: 'الإمام شمس الدين محمد بن محمد بن الجزري (ت: 833هـ)',
    category: 'matn',
    categoryName: 'متون التجويد',
    pages: 36,
    size: '3.1 MB',
    downloads: 0,
    featured: true,
    coverBg: 'from-emerald-800 via-emerald-900 to-slate-950',
    description: 'العمدة الكبرى في علم التجويد ومخارج الحروف وصفاتها لطلاب الإجازة والسند المتصل، مشتملة على 107 أبيات محققة ومخرجة الألفاظ بدقة متناهية.',
    chapters: [
      { title: 'المقدمة', content: 'يَقُولُ رَاجِي عَفْوِ رَبٍّ سَامِعِ * مُحَمَّدُ بْنُ الْجَزَرِيِّ الشَّافِعِي\nالْحَمْدُ لِلَّهِ وَصَلَّى اللَّهُ * عَلَى نَبِيِّهِ وَمُصْطَفَاهُ\nمُحَمَّدٍ وَآلِهِ وَصَحْبِهِ * وَمُقْرِئِ الْقُرْآنِ مَعْ مُحِبِّهِ\nوَبَعْدُ إِنَّ هَذِهِ مُقَدِّمَهْ * فِيمَا عَلَى قَارِئِهِ أَنْ يَعْلَمَهْ\nإِذْ وَاجِبٌ عَلَيْهِمُ مُحَتَّمُ * قَبْلَ الشُّرُوعِ أَوَّلاً أَنْ يَعْلَمُوا\nمَخَارِجَ الْحُرُوفِ وَالصِّفَاتِ * لِيَلْفِظُوا بِأَفْصَحِ اللُّغَاتِ' },
      { title: 'باب مخارج الحروف', content: 'مَخَارِجُ الْحُرُوفِ سَبْعَةَ عَشَرْ * عَلَى الَّذِي يَخْتَارُهُ مَنِ اخْتَبَرْ\nفَأَلِفُ الْجَوْفِ وَأُخْتَاهَا وَهِي * حُرُوفُ مَدٍّ لِلْهَوَاءِ تَنْتَهِي\nثُمَّ لأَقْصَى الحَلْقِ هَمْزٌ هَاءُ * ثُمَّ لِوَسْطِهِ فَعَيْنٌ حَاءُ\nأَدْنَاهُ غَيْنٌ خَاؤُهَا وَالْقَافُ * أَقْصَى اللِّسَانِ فَوْقُ ثُمَّ الْكَافُ\nأَسْفَلُ وَالْوَسْطُ فَجِيمُ الشِّينُ يَا * وَالضَّادُ مِنْ حَافَتِهِ إِذْ وَلِيَا' },
      { title: 'باب صفات الحروف', content: 'صِفَاتُهَا جَهْرٌ وَرِخْوٌ مُسْتَفِلْ * مُنْفَتِحٌ مُصْمَتَةٌ وَالضِّدَّ قُلْ\nمَهْمُوسُهَا (فَحَثَّهُ شَخْصٌ سَكَتْ) * شَدِيدُهَا لَفْظُ (أَجِدْ قَطٍ بَكَتْ)\nوَبَيْنَ رِخْوٍ وَالشَّدِيدِ (لِنْ عُمَرْ) * وَسَبْعُ عُلْوٍ (خُصَّ ضَغْطٍ قِظْ) حَصَرْ\nوَصَادُ ضَادٌ طَاءُ ظَاءٌ مُطْبَقَهْ * وَ(فِرَّ مِنْ لُبٍّ) الحُرُوفُ المُذْلَقَهْ' }
    ]
  },
  {
    id: 'al-shatibiyyah',
    title: 'متن الشاطبية (حرز الأماني ووجه التهاني)',
    titleEn: 'Matn Al-Shatibiyyah (Hirz Al-Amani in 7 Qira\'at)',
    author: 'الإمام أبو القاسم الشاطبي الرعيني (ت: 590هـ)',
    category: 'matn',
    categoryName: 'متون التجويد',
    pages: 112,
    size: '6.8 MB',
    downloads: 0,
    featured: false,
    coverBg: 'from-blue-900 via-indigo-950 to-slate-950',
    description: 'منظومة الشاطبية في القراءات السبع، مقدمة هنا كمادة تعليمية للمراجعة والدراسة.',
    chapters: [
      { title: 'مطلع القصيدة', content: 'بَدَأْتُ بِبِسْمِ اللَّهِ فِي النَّظْمِ أَوَّلاَ * تَبَارَكَ رَحْمَانًا رَحِيمًا وَمَوْئِلاَ\nوَثَنَّيْتُ صَلَّى اللَّهُ رَبِّي عَلَى الرِّضَا * مُحَمَّدٍ الْمُهْدَى إِلَى النَّاسِ رَسُلاَ\nوَثَلَّثْتُ أَنَّ الحَمْدَ لِلَّهِ دَائِمًا * وَمَا لَيْسَ مَبْدُوءًا بِهِ كَانَ أَبْتَلاَ\nوَبَعْدُ فَحَبْلُ اللَّهِ فِينَا كِتَابُهُ * فَجَاهِدْ بِهِ حَبْلَ الْعِدَا مُتَحَبِّلاَ' },
      { title: 'رموز القراء السبعة', content: 'جَعَلْتُ أَبَا جَادٍ عَلَى كُلِّ قَارِئٍ * دَلِيلاً عَلَى الْمَنْظُومِ أَوَّلَ أَوَّلاَ\nفَنَافِعٌ الطِّيبُ حَوَتْهُ نَفَائِسٌ * وَكُنْ لِعَلِيِّ الْقَوْلِ فِي الصِّدْقِ مَوْئِلاَ\nوَدُونَكَ مَكِيًّا وَفِي الْبَصْرِ نَازِلاً * وَشَامِيُّهُمْ يَهْدِي وَفِي الكُوفِ أَنْجَلاَ' }
    ]
  },
  {
    id: 'mushaf-tajweed-hafs',
    title: 'مصحف التجويد الملون برواية حفص عن عاصم',
    titleEn: 'Colored Tajweed Mushaf (Hafs an Asim)',
    author: 'نسخة تعليمية لأحكام التجويد',
    category: 'mushaf',
    categoryName: 'مصاحف التجويد',
    pages: 604,
    size: '85 MB',
    downloads: 0,
    featured: true,
    coverBg: 'from-teal-800 via-emerald-900 to-slate-900',
    description: 'المصحف الشريف كاملاً بالرسم العثماني مع الترميز الزمني اللوني لأحكام التجويد (المدود باللون الأحمر، الغنن بالأخضر، القلقلة بالأزرق، وعدم اللفظ بالرمادي).',
    chapters: [
      { title: 'دليل الألوان التجويدي', content: '1. اللون الأحمر بدرجاته: المد اللازم (6 حركات)، المد المتصل والمنفصل (4 أو 5 حركات)، مد البدل والعارض (2 أو 4 حركات).\n2. اللون الأخضر: الغنة الكاملة في الإخفاء، الإدغام بغنة، والميم والنون المشددتين (حركتان زمنيتان).\n3. اللون الأزرق الداكن: حروف القلقلة (قطب جد) عند سكونها.\n4. اللون الرمادي الفاتح: الحروف التي تكتب في الرسم العثماني ولا تلفظ وصلاً أو وقفاً.' },
      { title: 'سورة الفاتحة ومطلع البقرة', content: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ (1) الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ (2) الرَّحْمَنِ الرَّحِيمِ (3) مَالِكِ يَوْمِ الدِّينِ (4) إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ (5) اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ (6) صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ (7)' }
    ]
  },
  {
    id: 'mushaf-tajweed-warsh',
    title: 'مصحف التجويد الملون برواية ورش عن نافع (طريق الأزرق)',
    titleEn: 'Colored Tajweed Mushaf (Warsh an Nafi)',
    author: 'نسخة تعليمية برواية ورش عن نافع',
    category: 'mushaf',
    categoryName: 'مصاحف التجويد',
    pages: 604,
    size: '92 MB',
    downloads: 0,
    featured: false,
    coverBg: 'from-cyan-900 via-teal-950 to-slate-950',
    description: 'المصحف الشريف برواية ورش عن نافع المدني من طريق أبي يعقوب الأزرق، مبين فيه أحكام الإمالات، ترقيق الراءات، تغليظ اللامات، وتثليث البدل بالترميز اللوني.',
    chapters: [
      { title: 'خصوصيات رواية ورش', content: '1. نقل حركة الهمزة إلى الساكن قبلها إذا كان في آخر كلمة.\n2. إبدال الهمزة الساكنة حرف مد من جنس حركة ما قبلها.\n3. تغليظ اللام إذا كانت مفتوحة بعد (ص، ض، ط) مفتوحة أو ساكنة.\n4. ترقيق الراء المفتوحة والمضمومة إذا وقعت بعد ياء ساكنة سكوناً حياً أو ميتاً أو كسرة لازمة.\n5. تثليث مد البدل (القصر حركتان، التوسط 4 حركات، الطول 6 حركات).' }
    ]
  },
  {
    id: 'noor-al-bayan',
    title: 'كتاب نور البيان في تعليم القراءة بترتيل القرآن',
    titleEn: 'Noor Al-Bayan: Reading Through Quranic Recitation',
    author: 'الشيخ طارق السعيد ونخبة من معلمي القراءات',
    category: 'kids',
    categoryName: 'تأسيس الأطفال',
    pages: 80,
    size: '8.4 MB',
    downloads: 0,
    featured: true,
    coverBg: 'from-amber-600 via-orange-700 to-amber-900',
    description: 'منهج تعليمي متدرج لتدريب الأطفال والمبتدئين على القراءة العربية من خلال كلمات وآيات القرآن الكريم، متدرجاً من نطق الحروف المفردة إلى إتقان الترتيل.',
    chapters: [
      { title: 'المرحلة الأولى: الحروف الهجائية بالفتح', content: 'أَ بَ تَ ثَ جَ حَ خَ دَ ذَ رَ زَ سَ شَ صَ ضَ طَ ظَ عَ غَ فَ قَ كَ لَ مَ نَ هـَ وَ يَ\nقاعدة القراءة: فتح الفم بالحرف مع عدم المبالغة أو التمطيط في الصوت.\nأمثلة قرآنية: أَمَرَ، بَرَزَ، تَرَكَ، ثَقَبَ، جَعَلَ، حَسَدَ، خَلَقَ، دَخَلَ، ذَكَرَ، رَزَقَ، سَجَدَ.' },
      { title: 'المرحلة الثانية: الحركات الثلاث والمدود', content: '1. حركة الكسر: إِ بِ تِ ثِ جِ حِ خِ... أمثلة: إِبِلِ، يَئِسَ، حَبِطَ، رَكِبَ.\n2. حركة الضم: أُ بُ تُ ثُ جُ حُ خُ... أمثلة: أُذِنَ، بُهِتَ، جُمِعَ، ذُكِرَ.\n3. حروف المد الطبيعي (الألف الساكنة المفتوح ما قبلها، الياء الساكنة المكسور ما قبلها، الواو الساكنة المضموم ما قبلها).' },
      { title: 'المرحلة الثالثة: التنوين والسكون والشدة', content: 'التنوين نون ساكنة زائدة تلحق آخر الأسماء لفظاً لا خطاً (ـً ـٍ ـٌ).\nالسكون: حبس الصوت مع إظهار المخرج والقلقلة في حروف (ق، ط، ب، ج، د).\nالشدة: حرفان متماثلان الأول ساكن والثاني متحرك أُدغما فصارا حرفاً واحداً مشدداً.' }
    ]
  },
  {
    id: 'al-qaida-al-nooraniyya',
    title: 'متن القاعدة النورانية (ملونة وبالرسم العثماني)',
    titleEn: 'Al-Qa\'ida Al-Nooraniyyah (Color-Coded Ottoman Script)',
    author: 'الشيخ نور محمد حقاني (تحقيق: المهندس محمد فاروق الراعي)',
    category: 'kids',
    categoryName: 'تأسيس الأطفال',
    pages: 48,
    size: '5.2 MB',
    downloads: 0,
    featured: false,
    coverBg: 'from-yellow-700 via-amber-800 to-yellow-950',
    description: 'طريقة تعليمية لتدريب الطفل على نطق الحروف ومخارجها، وتدريب حباله الصوتية على مخارج الاستعلاء والاستفال برسم المصحف الشريف.',
    chapters: [
      { title: 'الدرس الأول: حروف الهجاء المفردة', content: 'أَلِفْ، بَاءْ، تَاءْ، ثَاءْ، جِيمْ، حَاءْ، خَاءْ، دَالْ، ذَالْ، رَاءْ، زَايْ، سِينْ، شِينْ، صَادْ، ضَادْ، طَاءْ، ظَاءْ، عَيْنْ، غَيْنْ، فَاءْ، قَافْ، كَافْ، لاَمْ، مِيمْ، نُونْ، وَاوْ، هَاءْ، هَمْزَةْ، يَاءْ.' },
      { title: 'الدرس الثاني: حروف الهجاء المركبة', content: 'لاَ، أَلِفْ، لاَمْ أَلِفْ، بَا أَلِفْ، لاَمْ أَلِفْ، تَا أَلِفْ، ثَا أَلِفْ، نُونْ أَلِفْ، يَا أَلِفْ، بَا سِينْ، كَافْ بَا، كَافْ تَا.' }
    ]
  },
  {
    id: 'letters-articulation-guide',
    title: 'دليل مخارج الحروف وصفاتها المصور للأطفال والناشئة',
    titleEn: 'Illustrated Phonetics & Articulation Guide for Kids',
    author: 'قسم المناهج والوسائل التعليمية — أكاديمية وَحْيٌ وَنَمَاء',
    category: 'kids',
    categoryName: 'تأسيس الأطفال',
    pages: 42,
    size: '12 MB',
    downloads: 0,
    featured: false,
    coverBg: 'from-rose-800 via-purple-900 to-slate-950',
    description: 'لوحات ورسوم كرتونية ملونة تشرح لأطفالنا أين تخرج الحروف العربية (الجوف، الحلق، اللسان، الشفتان، الخيشوم) مع تدريبات تفاعلية ممتعة.',
    chapters: [
      { title: 'رحلة الحرف العربي في الفم', content: 'الحرف هو صوت يعتمد على مخرج محقق أو مقدر.\n1. الجوف: غرفة الهواء الكبيرة التي تصدر منها مدود القرآن.\n2. الحلق: يبدأ من تفاحة آدم للأعلى، يخرج منه صوت الهمزة والهاء والعين والحاء والغين والخاء.\n3. اللسان: ملك الحروف، يخرج منه 18 حرفاً بأقسامه الأربعة (أقصى، وسط، حافة، طرف).\n4. الشفتان: أطباق ناعم ينطق الميم والباء، واستدارة تضم الواو، وعضة خفيفة للثنايا العليا مع الفاء.\n5. الخيشوم: التجويف الأنفي الساحر الذي يمنحنا رنين الغنة البديع.' }
    ]
  }
];

const LIBRARY_COPY = {
  ar: {
    seoTitle: 'المكتبة التعليمية القرآنية | وَحْيٌ وَنَمَاء',
    seoDesc: 'مكتبة وَحْيٌ وَنَمَاء الرقمية: متون التجويد، مصاحف التجويد الملونة، وكتب تأسيس الأطفال مع إمكانية القراءة المسبقة والتحميل للطباعة.',
    eyebrow: 'المكتبة التعليمية',
    title: 'المكتبة الرقمية والمصاحف المقروءة',
    subtitle: 'مواد تعليمية وكتب وفيديوهات تساعد الطالب على القراءة والمراجعة والتجويد من داخل المنصة.',
    switcherLabel: 'أقسام المكتبة',
    booksTab: 'المكتبة الرقمية والمتون (HTML / طباعة)',
    videosTab: 'مكتبة الفيديوهات المسجلة',
    searchPlaceholder: 'ابحث عن متن، مصحف، كتاب تأسيس...',
    searchAria: 'البحث في الكتب والمتون',
    featuredBadge: 'مادة تعليمية',
    authorLabel: 'الناظم / المحقق: ',
    pagesWord: 'صفحة',
    downloadHint: 'نسخة HTML للطباعة',
    previewBtn: 'قراءة مسبقة',
    downloadBtn: 'تحميل HTML للطباعة',
    downloadingToast: 'بدأ تنزيل الملف:',
    noBooks: 'لا توجد نتائج مطابقة لبحثك',
    noBooksHint: 'جرّب البحث باسم آخر أو إزالة التصنيف',
    loadingVideos: 'جاري تحميل الفيديوهات...',
    videoError: 'تعذر تحميل الفيديوهات الآن.',
    retryBtn: 'إعادة المحاولة',
    noVideos: 'لا فيديوهات في هذا التصنيف حالياً',
    noVideosHint: 'جرّب تصنيفاً آخر أو عد لاحقاً',
    viewsWord: 'مشاهدة',
    printPreview: 'طباعة هذه المعاينة',
    closeBtn: 'إغلاق',
    downloadFullCopy: 'تحميل نسخة HTML للطباعة',
  },
  en: {
    seoTitle: 'Digital Quranic Library & Texts | Wahy Wa Namaa',
    seoDesc: 'Browse Tajweed texts, colored Mushafs, and kids foundation books with live preview and printable HTML download.',
    eyebrow: 'LEARNING LIBRARY',
    title: 'Digital Quranic & Tajweed Library',
    subtitle: 'Learning materials, books, and recorded lessons to support reading, review, and Tajweed.',
    switcherLabel: 'Library sections',
    booksTab: 'Digital Books & Texts (Printable HTML)',
    videosTab: 'Recorded Video Lessons',
    searchPlaceholder: 'Search for a book, text, mushaf...',
    searchAria: 'Search books and texts',
    featuredBadge: 'Learning resource',
    authorLabel: 'Author: ',
    pagesWord: 'pages',
    downloadHint: 'Printable HTML',
    previewBtn: 'Preview',
    downloadBtn: 'Download HTML',
    downloadingToast: 'Downloading file:',
    noBooks: 'No matching books found',
    noBooksHint: 'Try another query or remove category filter',
    loadingVideos: 'Loading videos...',
    videoError: 'Could not load videos right now.',
    retryBtn: 'Retry',
    noVideos: 'No videos in this category yet',
    noVideosHint: 'Try another category or check back later',
    viewsWord: 'views',
    printPreview: 'Print Preview',
    closeBtn: 'Close',
    downloadFullCopy: 'Download Printable HTML',
  },
  fr: {
    seoTitle: 'Bibliothèque numérique | Académie Wahy Wa Namaa',
    eyebrow: 'BIBLIOTHÈQUE PÉDAGOGIQUE',
    title: 'Bibliothèque numérique & Mushafs',
    subtitle: 'Supports, livres et leçons enregistrées pour la lecture et la révision du Tajwid.',
    booksTab: 'Livres numériques (HTML imprimable)',
    videosTab: 'Cours vidéo enregistrés',
    searchPlaceholder: 'Rechercher un livre, texte, mushaf...',
    searchAria: 'Rechercher dans la bibliothèque',
    previewBtn: 'Aperçu',
    downloadBtn: 'Télécharger HTML',
    downloadingToast: 'Téléchargement :',
    noBooks: 'Aucun livre trouvé',
    loadingVideos: 'Chargement des vidéos...',
    videoError: 'Impossible de charger les vidéos.',
    retryBtn: 'Réessayer',
    noVideos: 'Aucune vidéo dans cette catégorie',
    printPreview: 'Imprimer l’aperçu',
    closeBtn: 'Fermer',
    downloadFullCopy: 'Télécharger en HTML imprimable',
  },
  de: {
    seoTitle: 'Digitale Bibliothek | Wahy Wa Namaa Akademie',
    eyebrow: 'LERNBIBLIOTHEK',
    title: 'Digitale Koran- & Tadschwid-Bibliothek',
    subtitle: 'Lernmaterialien, Bücher und aufgezeichnete Lektionen zum Lesen und Wiederholen.',
    booksTab: 'Digitale Bücher (druckbares HTML)',
    videosTab: 'Aufgezeichnete Videolektionen',
    searchPlaceholder: 'Nach Buch, Text oder Mushaf suchen...',
    searchAria: 'Bücher durchsuchen',
    previewBtn: 'Vorschau',
    downloadBtn: 'HTML herunterladen',
    downloadingToast: 'Download gestartet:',
    noBooks: 'Keine passenden Bücher gefunden',
    loadingVideos: 'Videos werden geladen...',
    videoError: 'Videos konnten nicht geladen werden.',
    retryBtn: 'Erneut versuchen',
    noVideos: 'Noch keine Videos in dieser Kategorie',
    printPreview: 'Vorschau drucken',
    closeBtn: 'Schließen',
    downloadFullCopy: 'Druckbares HTML herunterladen',
  },
  tr: {
    seoTitle: 'Dijital Kütüphane | Wahy Wa Namaa Akademisi',
    eyebrow: 'EĞİTİM KÜTÜPHANESİ',
    title: 'Dijital Kur’an ve Tecvid Kütüphanesi',
    subtitle: 'Okuma, tekrar ve tecvid çalışmaları için kitaplar, metinler ve kayıtlı dersler.',
    booksTab: 'Dijital Kitaplar (Yazdırılabilir HTML)',
    videosTab: 'Kayıtlı Video Dersler',
    searchPlaceholder: 'Kitap, metin veya mushaf ara...',
    searchAria: 'Kitap ve metinlerde ara',
    previewBtn: 'Önizle',
    downloadBtn: 'HTML İndir',
    downloadingToast: 'İndiriliyor:',
    noBooks: 'Eşleşen kitap bulunamadı',
    loadingVideos: 'Videolar yükleniyor...',
    videoError: 'Videolar şu anda yüklenemedi.',
    retryBtn: 'Tekrar Dene',
    noVideos: 'Bu kategoride henüz video yok',
    printPreview: 'Önizlemeyi Yazdır',
    closeBtn: 'Kapat',
    downloadFullCopy: 'Yazdırılabilir HTML İndir',
  },
  ur: {
    seoTitle: 'ڈیجیٹل قرآنی لائبریری | وحی و نما اکیڈمی',
    eyebrow: 'تعلیمی لائبریری',
    title: 'ڈیجیٹل کتب اور تجویدی مصاحف',
    subtitle: 'پڑھائی، دہرائی اور تجوید کی مشق کے لیے تعلیمی مواد، کتب اور ریکارڈ شدہ اسباق۔',
    booksTab: 'ڈیجیٹل کتب (پرنٹ ایبل HTML)',
    videosTab: 'ریکارڈ شدہ ویڈیو اسباق',
    searchPlaceholder: 'کتاب، متن یا مصحف تلاش کریں...',
    searchAria: 'کتب تلاش کریں',
    previewBtn: 'پیش نظارہ',
    downloadBtn: 'HTML ڈاؤن لوڈ کریں',
    downloadingToast: 'ڈاؤن لوڈ شروع ہو گیا:',
    noBooks: 'کوئی مماثل کتاب نہیں ملی',
    loadingVideos: 'ویڈیوز لوڈ ہو رہی ہیں...',
    videoError: 'اس وقت ویڈیوز لوڈ نہیں ہو سکیں۔',
    retryBtn: 'دوبارہ کوشش کریں',
    noVideos: 'اس زمرے میں فی الحال کوئی ویڈیو نہیں',
    printPreview: 'پیش نظارہ پرنٹ کریں',
    closeBtn: 'بند کریں',
    downloadFullCopy: 'پرنٹ ایبل HTML ڈاؤن لوڈ کریں',
  },
  id: {
    seoTitle: 'Perpustakaan Digital | Akademi Wahy Wa Namaa',
    eyebrow: 'PERPUSTAKAAN BELAJAR',
    title: 'Perpustakaan Digital Al-Qur’an & Tajwid',
    subtitle: 'Materi pembelajaran, buku, dan rekaman kelas untuk membaca, murajaah, dan tajwid.',
    booksTab: 'Buku Digital (HTML Cetak)',
    videosTab: 'Rekaman Pelajaran Video',
    searchPlaceholder: 'Cari buku, matan, atau mushaf...',
    searchAria: 'Cari buku dan matan',
    previewBtn: 'Pratinjau',
    downloadBtn: 'Unduh HTML',
    downloadingToast: 'Mengunduh berkas:',
    noBooks: 'Buku yang cocok tidak ditemukan',
    loadingVideos: 'Memuat video...',
    videoError: 'Tidak dapat memuat video saat ini.',
    retryBtn: 'Coba Lagi',
    noVideos: 'Belum ada video di kategori ini',
    printPreview: 'Cetak Pratinjau',
    closeBtn: 'Tutup',
    downloadFullCopy: 'Unduh HTML Siap Cetak',
  },
  ms: {
    seoTitle: 'Perpustakaan Digital | Akademi Wahy Wa Namaa',
    eyebrow: 'PERPUSTAKAAN PEMBELAJARAN',
    title: 'Perpustakaan Digital Al-Quran & Tajwid',
    subtitle: 'Bahan pembelajaran, buku, dan rakaman pelajaran untuk bacaan, ulang kaji, dan tajwid.',
    booksTab: 'Buku Digital (HTML Boleh Cetak)',
    videosTab: 'Rakaman Pelajaran Video',
    searchPlaceholder: 'Cari buku, matan, atau mushaf...',
    searchAria: 'Cari buku dan teks',
    previewBtn: 'Pratonton',
    downloadBtn: 'Muat Turun HTML',
    downloadingToast: 'Memuat turun fail:',
    noBooks: 'Tiada buku yang sepadan ditemui',
    loadingVideos: 'Memuatkan video...',
    videoError: 'Tidak dapat memuatkan video buat masa ini.',
    retryBtn: 'Cuba Lagi',
    noVideos: 'Tiada video dalam kategori ini buat masa ini',
    printPreview: 'Cetak Pratonton',
    closeBtn: 'Tutup',
    downloadFullCopy: 'Muat Turun HTML Boleh Cetak',
  },
  ku: {
    seoTitle: 'کتێبخانەی دیجیتاڵی قورئان | ئەکادیمیای وەحی و نەما',
    eyebrow: 'کتێبخانەی فێرکاری',
    title: 'کتێبخانەی دیجیتاڵی و موصحەفەکان',
    subtitle: 'کەرەستەی فێرکاری، کتێب و وانە تۆمارکراوەکان بۆ خوێندنەوە، پێداچوونەوە و تەجوید.',
    booksTab: 'کتێبە دیجیتاڵییەکان (HTML بۆ چاپ)',
    videosTab: 'کتێبخانەی ڤیدیۆ تۆمارکراوەکان',
    searchPlaceholder: 'گەڕان بۆ کتێب، دەق، موصحەف...',
    searchAria: 'گەڕان لە کتێبەکان',
    previewBtn: 'پێشبینین',
    downloadBtn: 'داگرتنی HTML',
    downloadingToast: 'داگرتن دەستی پێکرد:',
    noBooks: 'هیچ ئەنجامێکی گونجاو نەدۆزرایەوە',
    loadingVideos: 'ڤیدیۆکان باردەکرێن...',
    videoError: 'بارکردنی ڤیدیۆکان ئێستا سەرکەوتوو نەبوو.',
    retryBtn: 'دووبارە هەوڵبدەرەوە',
    noVideos: 'هیچ ڤیدیۆیەک لەم بەشەدا نییە',
    printPreview: 'چاپکردنی پێشبینین',
    closeBtn: 'داخستن',
    downloadFullCopy: 'داگرتنی وەشانی HTML بۆ چاپ',
  },
};

export default function LibraryPage() {
  const { locale, isRTL, dir } = useI18n();
  const toast = useToast();
  const baseCopy = isRTL ? LIBRARY_COPY.ar : LIBRARY_COPY.en;
  const copy = { ...baseCopy, ...(LIBRARY_COPY[locale] || {}) };

  const [mode, setMode] = useState('books');
  const [selectedBookCat, setSelectedBookCat] = useState('all');
  const [bookSearch, setBookSearch] = useState('');
  const [previewBook, setPreviewBook] = useState(null);

  const [videos, setVideos] = useState([]);
  const [category, setCategory] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState('');

  const lastTriggerRef = useRef(null);
  const closeModalBtnRef = useRef(null);

  const fetchVideos = useCallback((cat) => {
    setLoadingVideos(true);
    setVideoError('');
    const q = cat ? `?category=${encodeURIComponent(cat)}` : '';
    api.get(`/api/videos${q}`)
      .then((d) => setVideos(d.videos || []))
      .catch((err) => {
        setVideos([]);
        setVideoError(err?.message || copy.videoError);
      })
      .finally(() => setLoadingVideos(false));
  }, [copy.videoError]);

  useEffect(() => {
    if (mode === 'videos') {
      fetchVideos(category);
    }
  }, [mode, category, fetchVideos]);

  const closePreview = useCallback(() => {
    setPreviewBook(null);
    requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!previewBook) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeModalBtnRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePreview();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [previewBook, closePreview]);

  const catLabel = (c) => c[locale === 'id' ? 'idLabel' : locale] || (isRTL ? c.ar : c.en);

  const filteredBooks = DIGITAL_BOOKS.filter((b) => {
    const matchesCat = selectedBookCat === 'all' || b.category === selectedBookCat;
    const q = bookSearch.toLowerCase();
    const matchesSearch =
      b.title.toLowerCase().includes(q) ||
      b.titleEn.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleDownload = (book) => {
    const htmlContent = `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
<meta charset="UTF-8">
<title>${isRTL ? book.title : book.titleEn} | Wahy Wa Namaa Academy</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
  body { font-family: 'Amiri', serif; margin: 40px; background: #faf9f6; color: #1e293b; line-height: 1.8; }
  .header { border-bottom: 2px solid #065f46; padding-bottom: 20px; text-align: center; }
  .logo { font-size: 24px; font-weight: bold; color: #065f46; }
  .title { font-size: 28px; font-weight: bold; color: #92400e; margin: 20px 0 10px; }
  .meta { color: #64748b; font-size: 14px; }
  .chapter { margin-top: 30px; background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .chapter-title { font-size: 20px; font-weight: bold; color: #065f46; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; }
  .content { white-space: pre-line; font-size: 18px; line-height: 2.2; }
  .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center; font-size: 13px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">${isRTL ? 'أكاديمية وَحْيٌ وَنَمَاء لتعليم القرآن الكريم والنمو الإنساني' : 'Wahy Wa Namaa Academy'}</div>
    <div class="meta">${copy.featuredBadge}</div>
    <div class="title">${isRTL ? book.title : book.titleEn}</div>
    <div class="meta">${copy.authorLabel}${book.author} | ${book.pages} ${copy.pagesWord}</div>
  </div>

  ${book.chapters.map((c) => `
    <div class="chapter">
      <div class="chapter-title">${c.title}</div>
      <div class="content">${c.content}</div>
    </div>
  `).join('')}

  <div class="footer">
    Wahy Wa Namaa Academy — Digital Library
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${book.id}-wahy-namaa-academy.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${copy.downloadingToast} ${isRTL ? book.title : book.titleEn}`);
  };

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <>
      <SEOHead
        page={{
          url: '/library',
          title: copy.seoTitle,
          description: copy.seoDesc,
        }}
      />
      <GlobalHeader />

      <main className="wn-library-shell" dir={dir}>
        {/* Header Section */}
        <section className="wn-library-hero">
          <div className="page-container wn-library-hero__inner">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--wn-gold)]/20 border border-[var(--wn-gold)]/40 text-[var(--wn-gold)] text-xs md:text-sm font-bold">
              <Sparkles size={16} aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black">
              {copy.title}
            </h1>
            <p className="text-[var(--wn-text-inverse)]/85 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {copy.subtitle}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="flex justify-center pt-6">
              <div className="wn-library-switch" role="tablist" aria-label={copy.switcherLabel}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'books'}
                  aria-controls="library-books-panel"
                  onClick={() => setMode('books')}
                  className={`min-h-[44px] flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${
                    mode === 'books' ? 'is-active' : ''
                  }`}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  <span>{copy.booksTab}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'videos'}
                  aria-controls="library-videos-panel"
                  onClick={() => setMode('videos')}
                  className={`min-h-[44px] flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${
                    mode === 'videos' ? 'is-active' : ''
                  }`}
                >
                  <MonitorPlay size={18} aria-hidden="true" />
                  <span>{copy.videosTab}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* MODE 1: DIGITAL BOOKS */}
        {mode === 'books' && (
          <div id="library-books-panel" role="tabpanel" className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
            <div className="bg-[var(--wn-surface)] rounded-2xl p-6 border border-[var(--wn-border)] shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    aria-label={copy.searchAria}
                    placeholder={copy.searchPlaceholder}
                    className="w-full min-h-[44px] ps-10 pe-4 py-2.5 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] placeholder:text-[var(--wn-text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--wn-emerald)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label={copy.switcherLabel}>
                  {BOOK_CATS.map((c) => {
                    const active = selectedBookCat === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedBookCat(c.id)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition ${
                          active
                            ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-sm'
                            : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-emerald-soft)] border border-[var(--wn-border)]'
                        }`}
                      >
                        {catLabel(c)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map((book) => (
                <article
                  key={book.id}
                  className="bg-[var(--wn-surface)] rounded-3xl border border-[var(--wn-border)] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className={`h-40 bg-gradient-to-br ${book.coverBg} text-white p-6 relative flex flex-col justify-between`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/20">
                          {book.categoryName}
                        </span>
                        {book.featured && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold)] text-[var(--wn-emerald-deep)] shadow-sm flex items-center gap-1">
                            <Sparkles size={12} aria-hidden="true" /> {copy.featuredBadge}
                          </span>
                        )}
                      </div>

                      <div>
                        <h2 className="font-bold text-lg leading-tight line-clamp-2 text-white">
                          {isRTL ? book.title : book.titleEn}
                        </h2>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <p className="text-xs text-[var(--wn-text-secondary)] font-medium line-clamp-1">
                        {copy.authorLabel}
                        <strong className="text-[var(--wn-text-primary)]">{book.author}</strong>
                      </p>

                      <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed line-clamp-3">
                        {book.description}
                      </p>

                      <div className="flex items-center justify-between text-xs text-[var(--wn-text-secondary)] pt-2 border-t border-[var(--wn-border)]">
                        <span className="flex items-center gap-1">
                          <FileText size={13} aria-hidden="true" /> {book.pages} {copy.pagesWord}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download size={13} aria-hidden="true" /> {copy.downloadHint}
                        </span>
                        <span className="font-mono bg-[var(--wn-surface-sunken)] text-[var(--wn-text-primary)] px-2 py-0.5 rounded text-xs">
                          {book.size}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        lastTriggerRef.current = e.currentTarget;
                        setPreviewBook(book);
                      }}
                      className="min-h-[44px] w-full py-2.5 px-3 rounded-xl border border-[var(--wn-border-strong)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Eye size={15} aria-hidden="true" />
                      <span>{copy.previewBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(book)}
                      className="min-h-[44px] w-full py-2.5 px-3 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Download size={15} aria-hidden="true" />
                      <span>{copy.downloadBtn}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-20 bg-[var(--wn-surface)] rounded-3xl border border-dashed border-[var(--wn-border-strong)]">
                <BookOpen size={48} className="mx-auto text-[var(--wn-text-tertiary)] mb-3" aria-hidden="true" />
                <p className="font-bold text-[var(--wn-heading)]">{copy.noBooks}</p>
                <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{copy.noBooksHint}</p>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: RECORDED VIDEO LESSONS */}
        {mode === 'videos' && (
          <div id="library-videos-panel" role="tabpanel" className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
            <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label={copy.videosTab}>
              {VIDEO_CATS.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.id)}
                    className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition ${
                      active
                        ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                        : 'bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] text-[var(--wn-text-secondary)] hover:border-[var(--wn-emerald)] hover:text-[var(--wn-heading)]'
                    }`}
                  >
                    {catLabel(c)}
                  </button>
                );
              })}
            </div>

            {selectedVideo && (() => {
              let safeEmbedSrc = '';
              try {
                const parsed = new URL(String(selectedVideo.videoUrl || ''));
                const host = parsed.hostname.toLowerCase();
                if (
                  parsed.protocol === 'https:' &&
                  ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'youtu.be', 'player.vimeo.com'].includes(host)
                ) {
                  safeEmbedSrc = parsed.toString();
                }
              } catch {
                safeEmbedSrc = '';
              }
              return safeEmbedSrc ? (
                <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-[var(--wn-emerald-deep)] max-w-4xl mx-auto">
                  <iframe
                    title={selectedVideo.title}
                    src={safeEmbedSrc}
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : null;
            })()}

            {loadingVideos ? (
              <div role="status" className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner spinner-lg" aria-hidden="true" />
                <span className="sr-only">{copy.loadingVideos}</span>
              </div>
            ) : videoError ? (
              <div role="alert" className="text-center py-14 bg-[var(--wn-surface)] rounded-2xl border border-[var(--wn-danger)]/40 px-4">
                <p className="text-[var(--wn-text-danger,var(--wn-danger))] font-bold mb-4">{videoError}</p>
                <button
                  type="button"
                  onClick={() => fetchVideos(category)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-sm font-bold"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{copy.retryBtn}</span>
                </button>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16 bg-[var(--wn-surface)] rounded-2xl border border-dashed border-[var(--wn-border-strong)]">
                <MonitorPlay className="mx-auto text-[var(--wn-text-tertiary)] mb-4" size={48} aria-hidden="true" />
                <p className="text-[var(--wn-heading)] font-medium">{copy.noVideos}</p>
                <p className="text-sm text-[var(--wn-text-secondary)] mt-2">{copy.noVideosHint}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => setSelectedVideo(v)}
                    className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-2xl shadow-md overflow-hidden text-start hover:shadow-lg transition"
                  >
                    <div className="aspect-video bg-[var(--wn-emerald-soft)] flex items-center justify-center relative">
                      <Play className="text-[var(--wn-link)]" size={40} aria-hidden="true" />
                      {v.duration > 0 && (
                        <span className="absolute bottom-2 end-2 bg-black/75 text-white text-xs px-2 py-0.5 rounded">
                          {fmt(v.duration)}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[var(--wn-heading)] mb-1">{isRTL ? v.title : (v.titleEn || v.title)}</h3>
                      <p className="text-xs text-[var(--wn-text-secondary)] flex items-center gap-1">
                        <BookOpen size={12} aria-hidden="true" /> {v.category} · {v.views || 0} {copy.viewsWord}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accessible Book Preview Modal */}
        {previewBook && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-preview-title"
            onClick={closePreview}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--wn-surface)] w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-8 border border-[var(--wn-border)]"
            >
              {/* Modal Header */}
              <div className="bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] p-6 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[var(--wn-gold)] uppercase tracking-wider">{previewBook.categoryName}</span>
                  <h2 id="library-preview-title" className="text-xl font-black text-white leading-tight">
                    {isRTL ? previewBook.title : previewBook.titleEn}
                  </h2>
                  <p className="text-xs text-white/80 mt-1">{previewBook.author}</p>
                </div>
                <button
                  ref={closeModalBtnRef}
                  type="button"
                  onClick={closePreview}
                  aria-label={copy.closeBtn}
                  className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition shrink-0"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto space-y-6 bg-[var(--wn-surface-soft)]">
                <div className="bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-2xl p-4 text-xs text-[var(--wn-heading)] flex items-center justify-between gap-3">
                  <span>{previewBook.description}</span>
                  <span className="shrink-0 font-bold bg-[var(--wn-surface)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)] px-2.5 py-1 rounded-full ms-2">
                    {previewBook.pages} {copy.pagesWord}
                  </span>
                </div>

                {previewBook.chapters.map((ch, idx) => (
                  <div key={idx} className="bg-[var(--wn-surface)] rounded-2xl p-6 border border-[var(--wn-border)] shadow-sm space-y-3">
                    <h3 className="font-bold text-base text-[var(--wn-heading)] border-b border-[var(--wn-border)] pb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                      <span>{ch.title}</span>
                    </h3>
                    <div className="font-serif text-[var(--wn-text-primary)] text-base md:text-lg leading-loose whitespace-pre-line select-all bg-[var(--wn-gold-soft)] p-4 rounded-xl border border-[var(--wn-border)]">
                      {ch.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="bg-[var(--wn-surface)] border-t border-[var(--wn-border)] p-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[var(--wn-text-primary)] bg-[var(--wn-surface-sunken)] hover:bg-[var(--wn-emerald-soft)] transition"
                >
                  <Printer size={15} aria-hidden="true" />
                  <span>{copy.printPreview}</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={closePreview}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-sunken)] transition"
                  >
                    {copy.closeBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDownload(previewBook);
                      closePreview();
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-sm hover:bg-[var(--wn-emerald-hover)] transition"
                  >
                    <Download size={15} aria-hidden="true" />
                    <span>{copy.downloadFullCopy}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <GlobalFooter />
    </>
  );
}
