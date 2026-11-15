import { useState, useEffect } from 'react';
import {
  MonitorPlay,
  Play,
  BookOpen,
  Download,
  Eye,
  Search,
  CheckCircle,
  FileText,
  Sparkles,
  Printer,
  X
} from 'lucide-react';
import { useI18n } from '../../i18n';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import api from '../../lib/api';
import '../../styles/public-experience.css';

// تصنيفات الفيديوهات
const VIDEO_CATS = [
  { id: '', ar: 'الكل', en: 'All' },
  { id: 'quran', ar: 'القرآن', en: 'Quran' },
  { id: 'tajweed', ar: 'التجويد', en: 'Tajweed' },
  { id: 'arabic', ar: 'العربية', en: 'Arabic' },
  { id: 'seerah', ar: 'السيرة', en: 'Seerah' },
  { id: 'kids', ar: 'أطفال', en: 'Kids' },
];

// تصنيفات المكتبة الرقمية (PDF)
const BOOK_CATS = [
  { id: 'all', ar: 'كافة الكتب والمتون', en: 'All Books & Texts' },
  { id: 'matn', ar: 'متون التجويد والقراءات', en: 'Tajweed & Qiraat Texts' },
  { id: 'mushaf', ar: 'مصاحف التجويد الملونة', en: 'Colored Tajweed Mushafs' },
  { id: 'kids', ar: 'تأسيس الأطفال والبراعم', en: 'Kids Foundation Books' },
  { id: 'tafseer', ar: 'شروح وتفاسير', en: 'Explanations & Tafseer' },
];

// مواد تعليمية ثابتة متاحة داخل مكتبة الأكاديمية
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

export default function LibraryPage() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';

  // Library mode: 'books' (default) or 'videos'
  const [mode, setMode] = useState('books');

  // Books state
  const [selectedBookCat, setSelectedBookCat] = useState('all');
  const [bookSearch, setBookSearch] = useState('');
  const [previewBook, setPreviewBook] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  // Video state
  const [videos, setVideos] = useState([]);
  const [category, setCategory] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loadingVideos, setLoadingVideos] = useState(false);

  useEffect(() => {
    if (mode === 'videos') {
      setLoadingVideos(true);
      const q = category ? `?category=${category}` : '';
      api.get(`/api/videos${q}`)
        .then((d) => setVideos(d.videos || []))
        .catch(() => setVideos([]))
        .finally(() => setLoadingVideos(false));
    }
  }, [mode, category]);

  // Filter books
  const filteredBooks = DIGITAL_BOOKS.filter((b) => {
    const matchesCat = selectedBookCat === 'all' || b.category === selectedBookCat;
    const matchesSearch =
      b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.titleEn.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.author.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.description.toLowerCase().includes(bookSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Handle direct PDF Download
  const handleDownload = (book) => {
    const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${book.title} | أكاديمية وَحْيٌ وَنَمَاء</title>
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
    <div class="logo">أكاديمية وَحْيٌ وَنَمَاء لتعليم القرآن الكريم والنمو الإنساني</div>
    <div class="meta">مادة تعليمية من مكتبة وحي ونماء</div>
    <div class="title">${book.title}</div>
    <div class="meta">الناظم / المحقق: ${book.author} | عدد الصفحات: ${book.pages} صفحة</div>
  </div>

  ${book.chapters.map((c) => `
    <div class="chapter">
      <div class="chapter-title">${c.title}</div>
      <div class="content">${c.content}</div>
    </div>
  `).join('')}

  <div class="footer">
    نسخة تعليمية تم إنشاؤها من مكتبة أكاديمية وَحْيٌ وَنَمَاء.
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

    setDownloadSuccess(book.title);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <>
      <SEOHead
        page={{
          url: '/library',
          title: isAr ? 'المكتبة التعليمية القرآنية | وَحْيٌ وَنَمَاء' : 'Digital Quranic Library & Texts | Wahy Wa Namaa',
          description: isAr
            ? 'مكتبة وَحْيٌ وَنَمَاء الرقمية: متون التجويد (تحفة الأطفال، الجزرية، الشاطبية)، مصاحف التجويد الملونة برواية حفص وورش، وكتب تأسيس الأطفال (نور البيان والقاعدة النورانية) مع إمكانية التحميل المباشر والقراءة.'
            : 'Download approved Tajweed texts (Tuhfa, Jazariyyah, Shatibiyyah), colored Tajweed Mushafs, and kids foundation books with free PDF download and preview.'
        }}
      />
      <GlobalHeader />

      <main className="wn-library-shell">
        {/* ═══ Header Section ═══ */}
        <section className="wn-library-hero">
          <div className="page-container wn-library-hero__inner">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--azhar-gold-bright)]/20 border border-[var(--azhar-gold-bright)]/40 text-[var(--azhar-gold-bright)] text-xs md:text-sm font-bold">
              <Sparkles size={16} />
              <span>{isAr ? 'المكتبة التعليمية' : 'LEARNING LIBRARY'}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black">
              {isAr ? 'المكتبة الرقمية والمصاحف المقروءة' : 'Digital Quranic & Tajweed Library'}
            </h1>
            <p className="text-emerald-100 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {isAr
                ? 'مواد تعليمية وكتب وفيديوهات تساعد الطالب على القراءة والمراجعة والتجويد من داخل المنصة.'
                : 'Learning materials, books, and recorded lessons to support reading, review, and Tajweed.'}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="flex justify-center pt-6">
              <div className="wn-library-switch">
                <button
                  type="button"
                  onClick={() => setMode('books')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${
                    mode === 'books'
                      ? 'is-active' : ''
                  }`}
                >
                  <BookOpen size={18} />
                  <span>{isAr ? 'المكتبة الرقمية والمصاحف (PDF)' : 'Digital Books & Mushafs (PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('videos')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${
                    mode === 'videos'
                      ? 'is-active' : ''
                  }`}
                >
                  <MonitorPlay size={18} />
                  <span>{isAr ? 'مكتبة الفيديوهات المسجلة' : 'Recorded Video Lessons'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Download Toast Notification ═══ */}
        {downloadSuccess && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-bounce">
            <CheckCircle size={22} className="text-emerald-400" />
            <span className="text-sm font-bold">
              {isAr ? `بدأ تحميل: ${downloadSuccess}` : `Downloading: ${downloadSuccess}`}
            </span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            MODE 1: DIGITAL BOOKS & PDF LIBRARY
        ══════════════════════════════════════════════════════════════════════════ */}
        {mode === 'books' && (
          <div className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
            {/* Search & Category Filter Bar */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder={isAr ? 'ابحث عن متن، مصحف، كتاب تأسيس...' : 'Search for a book, text, mushaf...'}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50"
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {BOOK_CATS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedBookCat(c.id)}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition ${
                        selectedBookCat === c.id
                          ? 'bg-[var(--azhar-green-deep)] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isAr ? c.ar : c.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Books Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Visual Cover Banner */}
                    <div className={`h-40 bg-gradient-to-br ${book.coverBg} text-white p-6 relative flex flex-col justify-between`}>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-sm border border-white/20">
                          {book.categoryName}
                        </span>
                        {book.featured && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--azhar-gold-bright)] text-slate-900 shadow-sm flex items-center gap-1">
                            <Sparkles size={12} /> {isAr ? 'مادة تعليمية' : 'Learning resource'}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-lg leading-tight line-clamp-2 text-white">
                          {book.title}
                        </h3>
                      </div>
                    </div>

                    {/* Book Metadata */}
                    <div className="p-6 space-y-4">
                      <p className="text-xs text-slate-500 font-medium line-clamp-1">
                        {isAr ? 'الناظم / المحقق: ' : 'Author: '}
                        <strong className="text-slate-800">{book.author}</strong>
                      </p>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {book.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <FileText size={13} /> {book.pages} {isAr ? 'صفحة' : 'pages'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download size={13} /> {isAr ? 'تنزيل المادة' : 'Download material'}
                        </span>
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                          {book.size}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Preview & Download) */}
                  <div className="p-6 pt-0 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewBook(book)}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Eye size={15} />
                      <span>{isAr ? 'قراءة مسبقة' : 'Preview'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(book)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition"
                    >
                      <Download size={15} />
                      <span>{isAr ? 'تحميل PDF' : 'Download PDF'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <BookOpen size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="font-bold text-slate-700">{isAr ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching books found'}</p>
                <p className="text-xs text-slate-400 mt-1">{isAr ? 'جرّب البحث باسم آخر أو إزالة التصنيف' : 'Try another query or remove category filter'}</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            MODE 2: RECORDED VIDEO LESSONS
        ══════════════════════════════════════════════════════════════════════════ */}
        {mode === 'videos' && (
          <div className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
            <div className="flex flex-wrap gap-2 justify-center">
              {VIDEO_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    category === c.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                  }`}
                >
                  {isAr ? c.ar : c.en}
                </button>
              ))}
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
                <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black max-w-4xl mx-auto">
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
              <div className="flex justify-center py-16"><div className="spinner spinner-lg" /></div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <MonitorPlay className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-600 font-medium">{isAr ? 'لا فيديوهات في هذا التصنيف حالياً' : 'No videos in this category yet'}</p>
                <p className="text-sm text-gray-400 mt-2">{isAr ? 'جرّب تصنيفاً آخر أو عد لاحقاً' : 'Try another category or check back later'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => setSelectedVideo(v)}
                    className="bg-white rounded-2xl shadow-md overflow-hidden text-right hover:shadow-lg transition"
                  >
                    <div className="aspect-video bg-emerald-100 flex items-center justify-center relative">
                      <Play className="text-emerald-600" size={40} />
                      {v.duration > 0 && (
                        <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                          {fmt(v.duration)}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold mb-1">{isAr ? v.title : (v.titleEn || v.title)}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <BookOpen size={12} /> {v.category} · {v.views || 0} {isAr ? 'مشاهدة' : 'views'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Book Preview Modal ═══ */}
        {previewBook && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-8 border border-slate-200">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">{previewBook.categoryName}</span>
                  <h3 className="text-xl font-black text-white leading-tight">{previewBook.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{previewBook.author}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewBook(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body: Book Chapters */}
              <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto space-y-6 bg-slate-50/50">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-center justify-between">
                  <span>{previewBook.description}</span>
                  <span className="shrink-0 font-bold bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-full mr-2">
                    {previewBook.pages} {isAr ? 'صفحة' : 'pages'}
                  </span>
                </div>

                {previewBook.chapters.map((ch, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                    <h4 className="font-bold text-base text-emerald-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      <span>{ch.title}</span>
                    </h4>
                    <div className="font-serif text-slate-800 text-base md:text-lg leading-loose whitespace-pre-line select-all bg-amber-50/30 p-4 rounded-xl border border-amber-100/50">
                      {ch.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="bg-white border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                >
                  <Printer size={15} />
                  <span>{isAr ? 'طباعة هذه المعاينة' : 'Print Preview'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewBook(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDownload(previewBook);
                      setPreviewBook(null);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 transition"
                  >
                    <Download size={15} />
                    <span>{isAr ? 'تحميل النسخة الكاملة' : 'Download Full Copy'}</span>
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
