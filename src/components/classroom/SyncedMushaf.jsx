import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ChevronRight, ChevronLeft, BookOpen, Sparkles, 
  Maximize2, Minimize2, ZoomIn, ZoomOut, Lock, Unlock, 
  Sun, Moon, Eye, RotateCcw, Check, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './classroom.css';

/**
 * فهرس سور القرآن الكريم (114 سورة مع صفحة البداية وعدد الآيات ونوع السورة)
 */
export const QURAN_SURAHS = [
  { id: 1, name: 'الفاتحة', startPage: 1, verses: 7, type: 'مكية' },
  { id: 2, name: 'البقرة', startPage: 2, verses: 286, type: 'مدنية' },
  { id: 3, name: 'آل عمران', startPage: 50, verses: 200, type: 'مدنية' },
  { id: 4, name: 'النساء', startPage: 77, verses: 176, type: 'مدنية' },
  { id: 5, name: 'المائدة', startPage: 106, verses: 120, type: 'مدنية' },
  { id: 6, name: 'الأنعام', startPage: 128, verses: 165, type: 'مكية' },
  { id: 7, name: 'الأعراف', startPage: 151, verses: 206, type: 'مكية' },
  { id: 8, name: 'الأنفال', startPage: 177, verses: 75, type: 'مدنية' },
  { id: 9, name: 'التوبة', startPage: 187, verses: 129, type: 'مدنية' },
  { id: 10, name: 'يونس', startPage: 208, verses: 109, type: 'مكية' },
  { id: 11, name: 'هود', startPage: 221, verses: 123, type: 'مكية' },
  { id: 12, name: 'يوسف', startPage: 235, verses: 111, type: 'مكية' },
  { id: 13, name: 'الرعد', startPage: 249, verses: 43, type: 'مدنية' },
  { id: 14, name: 'إبراهيم', startPage: 255, verses: 52, type: 'مكية' },
  { id: 15, name: 'الحجر', startPage: 262, verses: 99, type: 'مكية' },
  { id: 16, name: 'النحل', startPage: 267, verses: 128, type: 'مكية' },
  { id: 17, name: 'الإسراء', startPage: 282, verses: 111, type: 'مكية' },
  { id: 18, name: 'الكهف', startPage: 293, verses: 110, type: 'مكية' },
  { id: 19, name: 'مريم', startPage: 305, verses: 98, type: 'مكية' },
  { id: 20, name: 'طه', startPage: 312, verses: 135, type: 'مكية' },
  { id: 21, name: 'الأنبياء', startPage: 322, verses: 112, type: 'مكية' },
  { id: 22, name: 'الحج', startPage: 332, verses: 78, type: 'مدنية' },
  { id: 23, name: 'المؤمنون', startPage: 342, verses: 118, type: 'مكية' },
  { id: 24, name: 'النور', startPage: 350, verses: 64, type: 'مدنية' },
  { id: 25, name: 'الفرقان', startPage: 359, verses: 77, type: 'مكية' },
  { id: 26, name: 'الشعراء', startPage: 367, verses: 227, type: 'مكية' },
  { id: 27, name: 'النمل', startPage: 377, verses: 93, type: 'مكية' },
  { id: 28, name: 'القصص', startPage: 385, verses: 88, type: 'مكية' },
  { id: 29, name: 'العنكبوت', startPage: 396, verses: 69, type: 'مكية' },
  { id: 30, name: 'الروم', startPage: 404, verses: 60, type: 'مكية' },
  { id: 31, name: 'لقمان', startPage: 411, verses: 34, type: 'مكية' },
  { id: 32, name: 'السجدة', startPage: 415, verses: 30, type: 'مكية' },
  { id: 33, name: 'الأحزاب', startPage: 418, verses: 73, type: 'مدنية' },
  { id: 34, name: 'سبأ', startPage: 428, verses: 54, type: 'مكية' },
  { id: 35, name: 'فاطر', startPage: 434, verses: 45, type: 'مكية' },
  { id: 36, name: 'يس', startPage: 440, verses: 83, type: 'مكية' },
  { id: 37, name: 'الصافات', startPage: 446, verses: 182, type: 'مكية' },
  { id: 38, name: 'ص', startPage: 453, verses: 88, type: 'مكية' },
  { id: 39, name: 'الزمر', startPage: 458, verses: 75, type: 'مكية' },
  { id: 40, name: 'غافر', startPage: 467, verses: 85, type: 'مكية' },
  { id: 41, name: 'فصلت', startPage: 477, verses: 54, type: 'مكية' },
  { id: 42, name: 'الشورى', startPage: 483, verses: 53, type: 'مكية' },
  { id: 43, name: 'الزخرف', startPage: 489, verses: 89, type: 'مكية' },
  { id: 44, name: 'الدخان', startPage: 496, verses: 59, type: 'مكية' },
  { id: 45, name: 'الجاثية', startPage: 499, verses: 37, type: 'مكية' },
  { id: 46, name: 'الأحقاف', startPage: 502, verses: 35, type: 'مكية' },
  { id: 47, name: 'محمد', startPage: 507, verses: 38, type: 'مدنية' },
  { id: 48, name: 'الفتح', startPage: 511, verses: 29, type: 'مدنية' },
  { id: 49, name: 'الحجرات', startPage: 515, verses: 18, type: 'مدنية' },
  { id: 50, name: 'ق', startPage: 518, verses: 45, type: 'مكية' },
  { id: 51, name: 'الذاريات', startPage: 520, verses: 60, type: 'مكية' },
  { id: 52, name: 'الطور', startPage: 523, verses: 49, type: 'مكية' },
  { id: 53, name: 'النجم', startPage: 526, verses: 62, type: 'مكية' },
  { id: 54, name: 'القمر', startPage: 528, verses: 55, type: 'مكية' },
  { id: 55, name: 'الرحمن', startPage: 531, verses: 78, type: 'مدنية' },
  { id: 56, name: 'الواقعة', startPage: 534, verses: 96, type: 'مكية' },
  { id: 57, name: 'الحديد', startPage: 537, verses: 29, type: 'مدنية' },
  { id: 58, name: 'المجادلة', startPage: 542, verses: 22, type: 'مدنية' },
  { id: 59, name: 'الحشر', startPage: 545, verses: 24, type: 'مدنية' },
  { id: 60, name: 'الممتحنة', startPage: 549, verses: 13, type: 'مدنية' },
  { id: 61, name: 'الصف', startPage: 551, verses: 14, type: 'مدنية' },
  { id: 62, name: 'الجمعة', startPage: 553, verses: 11, type: 'مدنية' },
  { id: 63, name: 'المنافقون', startPage: 554, verses: 11, type: 'مدنية' },
  { id: 64, name: 'التغابن', startPage: 556, verses: 18, type: 'مدنية' },
  { id: 65, name: 'الطلاق', startPage: 558, verses: 12, type: 'مدنية' },
  { id: 66, name: 'التحريم', startPage: 560, verses: 12, type: 'مدنية' },
  { id: 67, name: 'الملك', startPage: 562, verses: 30, type: 'مكية' },
  { id: 68, name: 'القلم', startPage: 564, verses: 52, type: 'مكية' },
  { id: 69, name: 'الحاقة', startPage: 566, verses: 52, type: 'مكية' },
  { id: 70, name: 'المعارج', startPage: 568, verses: 44, type: 'مكية' },
  { id: 71, name: 'نوح', startPage: 570, verses: 28, type: 'مكية' },
  { id: 72, name: 'الجن', startPage: 572, verses: 28, type: 'مكية' },
  { id: 73, name: 'المزمل', startPage: 574, verses: 20, type: 'مكية' },
  { id: 74, name: 'المدثر', startPage: 575, verses: 56, type: 'مكية' },
  { id: 75, name: 'القيامة', startPage: 577, verses: 40, type: 'مكية' },
  { id: 76, name: 'الإنسان', startPage: 578, verses: 31, type: 'مدنية' },
  { id: 77, name: 'المرسلات', startPage: 580, verses: 50, type: 'مكية' },
  { id: 78, name: 'النبأ', startPage: 582, verses: 40, type: 'مكية' },
  { id: 79, name: 'النازعات', startPage: 583, verses: 46, type: 'مكية' },
  { id: 80, name: 'عبس', startPage: 585, verses: 42, type: 'مكية' },
  { id: 81, name: 'التكوير', startPage: 586, verses: 29, type: 'مكية' },
  { id: 82, name: 'الانفطار', startPage: 587, verses: 19, type: 'مكية' },
  { id: 83, name: 'المطففين', startPage: 587, verses: 36, type: 'مكية' },
  { id: 84, name: 'الانشقاق', startPage: 589, verses: 25, type: 'مكية' },
  { id: 85, name: 'البروج', startPage: 590, verses: 22, type: 'مكية' },
  { id: 86, name: 'الطارق', startPage: 591, verses: 17, type: 'مكية' },
  { id: 87, name: 'الأعلى', startPage: 591, verses: 19, type: 'مكية' },
  { id: 88, name: 'الغاشية', startPage: 592, verses: 26, type: 'مكية' },
  { id: 89, name: 'الفجر', startPage: 593, verses: 30, type: 'مكية' },
  { id: 90, name: 'البلد', startPage: 594, verses: 20, type: 'مكية' },
  { id: 91, name: 'الشمس', startPage: 595, verses: 15, type: 'مكية' },
  { id: 92, name: 'الليل', startPage: 595, verses: 21, type: 'مكية' },
  { id: 93, name: 'الضحى', startPage: 596, verses: 11, type: 'مكية' },
  { id: 94, name: 'الشرح', startPage: 596, verses: 8, type: 'مكية' },
  { id: 95, name: 'التين', startPage: 597, verses: 8, type: 'مكية' },
  { id: 96, name: 'العلق', startPage: 597, verses: 19, type: 'مكية' },
  { id: 97, name: 'القدر', startPage: 598, verses: 5, type: 'مكية' },
  { id: 98, name: 'البينة', startPage: 598, verses: 8, type: 'مدنية' },
  { id: 99, name: 'الزلزلة', startPage: 599, verses: 8, type: 'مدنية' },
  { id: 100, name: 'العاديات', startPage: 599, verses: 11, type: 'مكية' },
  { id: 101, name: 'القارعة', startPage: 600, verses: 11, type: 'مكية' },
  { id: 102, name: 'التكاثر', startPage: 600, verses: 8, type: 'مكية' },
  { id: 103, name: 'العصر', startPage: 601, verses: 3, type: 'مكية' },
  { id: 104, name: 'الهمزة', startPage: 601, verses: 9, type: 'مكية' },
  { id: 105, name: 'الفيل', startPage: 601, verses: 5, type: 'مكية' },
  { id: 106, name: 'قريش', startPage: 602, verses: 4, type: 'مكية' },
  { id: 107, name: 'الماعون', startPage: 602, verses: 7, type: 'مكية' },
  { id: 108, name: 'الكوثر', startPage: 602, verses: 3, type: 'مكية' },
  { id: 109, name: 'الكافرون', startPage: 603, verses: 6, type: 'مكية' },
  { id: 110, name: 'النصر', startPage: 603, verses: 3, type: 'مدنية' },
  { id: 111, name: 'المسد', startPage: 603, verses: 5, type: 'مكية' },
  { id: 112, name: 'الإخلاص', startPage: 604, verses: 4, type: 'مكية' },
  { id: 113, name: 'الفلق', startPage: 604, verses: 5, type: 'مكية' },
  { id: 114, name: 'الناس', startPage: 604, verses: 6, type: 'مكية' }
];

/**
 * نصوص الآيات التفاعلية النموذجية لصفحات البداية وسور الحفظ الشائعة
 */
const SAMPLE_PAGE_VERSES = {
  1: {
    surahName: 'سورة الفاتحة',
    isBismillah: false,
    verses: [
      { num: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
      { num: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
      { num: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
      { num: 4, text: 'مَالِكِ يَوْمِ الدِّينِ' },
      { num: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ' },
      { num: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ' },
      { num: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' }
    ]
  },
  2: {
    surahName: 'سورة البقرة',
    isBismillah: true,
    verses: [
      { num: 1, text: 'الم' },
      { num: 2, text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ' },
      { num: 3, text: 'الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ' },
      { num: 4, text: 'وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ' },
      { num: 5, text: 'أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ' }
    ]
  },
  562: {
    surahName: 'سورة الملك',
    isBismillah: true,
    verses: [
      { num: 1, text: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ' },
      { num: 2, text: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ' },
      { num: 3, text: 'الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ ۖ فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ' },
      { num: 4, text: 'ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ' },
      { num: 5, text: 'وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ وَجَعَلْنَاهَا رُجُومًا لِّلشَّيَاطِينِ ۖ وَأَعْتَدْنَا لَهُمْ عَذَابَ السَّعِيرِ' }
    ]
  },
  604: {
    surahName: 'سورة الإخلاص والمعوذتين',
    isBismillah: true,
    verses: [
      { num: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
      { num: 2, text: 'اللَّهُ الصَّمَدُ' },
      { num: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ' },
      { num: 4, text: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ' },
      { num: 101, text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ' },
      { num: 102, text: 'مِن شَرِّ مَا خَلَقَ' },
      { num: 103, text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ' },
      { num: 104, text: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ' },
      { num: 105, text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ' },
      { num: 201, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ' },
      { num: 202, text: 'مَلِكِ النَّاسِ' },
      { num: 203, text: 'إِلَٰهِ النَّاسِ' },
      { num: 204, text: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ' },
      { num: 205, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ' },
      { num: 206, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ' }
    ]
  }
};

/**
 * حساب رقم الجزء القرآني (Juz) من رقم الصفحة تقريبياً
 */
function getJuzFromPage(page) {
  if (page <= 21) return 1;
  return Math.min(30, Math.ceil((page - 1) / 20));
}

/**
 * معرفة السورة المرتبطة برقم الصفحة
 */
function getSurahForPage(page) {
  for (let i = QURAN_SURAHS.length - 1; i >= 0; i--) {
    if (page >= QURAN_SURAHS[i].startPage) {
      return QURAN_SURAHS[i];
    }
  }
  return QURAN_SURAHS[0];
}

/**
 * مكون المصحف الرقمي المتزامن عبر LiveKit Data Channel
 */
export default function SyncedMushaf({
  room,
  localParticipant,
  isTeacher = false,
  isObserver = false,
  onAyahClick = null,
}) {
  // حالة الصفحة
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  
  // صلاحيات وتزامن
  const [allowIndependentReading, setAllowIndependentReading] = useState(false);
  const [isIndependentMode, setIsIndependentMode] = useState(false);
  const [teacherPage, setTeacherPage] = useState(1);
  const [syncToast, setSyncToast] = useState(null);

  // إعدادات العرض
  const [theme, setTheme] = useState('parchment'); // 'parchment' | 'night' | 'white'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showSurahModal, setShowSurahModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('interactive'); // 'interactive' | 'image'
  const [imageError, setImageError] = useState(false);
  const [dynamicPageVerses, setDynamicPageVerses] = useState({});

  const containerRef = useRef(null);

  // السورة والجزء الحالي
  const currentSurah = useMemo(() => getSurahForPage(currentPage), [currentPage]);
  const currentJuz = useMemo(() => getJuzFromPage(currentPage), [currentPage]);

  // روابط صور صفحات المصحف عالية الدقة (High-Res CDN)
  const pageImageSrc = useMemo(() => {
    // 3 مصادر موثوقة لصفحات المصحف الشريف
    const padded = String(currentPage).padStart(3, '0');
    return `https://cdn.jsdelivr.net/gh/spa5k/quran-images@master/quran-images-webp/${currentPage}.webp`;
  }, [currentPage]);

  // إرسال رسالة التزامن عبر LiveKit Data Channel
  const broadcastMushafAction = useCallback((action, payload = {}) => {
    if (!room || !localParticipant?.localParticipant) return;

    const messageData = {
      type: 'MUSHAF_ACTION',
      action, // 'PAGE_CHANGE' | 'AYAH_HIGHLIGHT' | 'MODE_TOGGLE'
      page: payload.page ?? currentPage,
      ayahId: payload.ayahId ?? highlightedAyah,
      allowIndependent: payload.allowIndependent ?? allowIndependentReading,
      senderRole: isTeacher ? 'teacher' : 'student',
      timestamp: Date.now()
    };

    try {
      localParticipant.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(messageData)),
        { reliable: true }
      );
    } catch (err) {
      console.error('Failed to broadcast Mushaf action:', err);
    }
  }, [room, localParticipant, currentPage, highlightedAyah, allowIndependentReading, isTeacher]);

  // الاستماع لرسائل التزامن القادمة من المعلم
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== 'MUSHAF_ACTION') return;

        // إذا كان المرسل هو المعلم ونحن لسنا في وضع القراءة الحرة
        if (data.action === 'PAGE_CHANGE') {
          setTeacherPage(data.page);
          if (!isTeacher && !isIndependentMode) {
            setCurrentPage(data.page);
            setHighlightedAyah(data.ayahId || null);
            setSyncToast(`انتقل الشيخ إلى صفحة ${data.page}`);
            setTimeout(() => setSyncToast(null), 3000);
          }
        } else if (data.action === 'AYAH_HIGHLIGHT') {
          if (!isTeacher && !isIndependentMode) {
            setHighlightedAyah(data.ayahId);
          }
        } else if (data.action === 'MODE_TOGGLE') {
          setAllowIndependentReading(Boolean(data.allowIndependent));
          if (!data.allowIndependent) {
            // المعلم أغلق القراءة الحرة -> إعادة الطالب للتزامن الإجباري
            setIsIndependentMode(false);
            if (data.page) setCurrentPage(data.page);
          }
        }
      } catch (e) {
        // تجاهل الرسائل غير المطابقة (مثل رسائل الشات العادية)
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, isTeacher, isIndependentMode]);

  // تقليب الصفحة للأمام
  const goToNextPage = useCallback(() => {
    if (currentPage >= 604) return;
    const next = currentPage + 1;
    setCurrentPage(next);
    setHighlightedAyah(null);
    setImageError(false);

    if (isTeacher) {
      broadcastMushafAction('PAGE_CHANGE', { page: next, ayahId: null });
    }
  }, [currentPage, isTeacher, broadcastMushafAction]);

  // تقليب الصفحة للخلف
  const goToPrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    const prev = currentPage - 1;
    setCurrentPage(prev);
    setHighlightedAyah(null);
    setImageError(false);

    if (isTeacher) {
      broadcastMushafAction('PAGE_CHANGE', { page: prev, ayahId: null });
    }
  }, [currentPage, isTeacher, broadcastMushafAction]);

  // الانتقال لصفحة معينة
  const jumpToPage = useCallback((pageNum) => {
    const validPage = Math.max(1, Math.min(604, parseInt(pageNum, 10) || 1));
    setCurrentPage(validPage);
    setHighlightedAyah(null);
    setImageError(false);
    setShowSurahModal(false);

    if (isTeacher) {
      broadcastMushafAction('PAGE_CHANGE', { page: validPage, ayahId: null });
    }
  }, [isTeacher, broadcastMushafAction]);

  // تظليل الآية
  const handleAyahClick = (ayahNum) => {
    // المراقب لا يستطيع التظليل
    if (isObserver) return;

    const newHighlight = highlightedAyah === ayahNum ? null : ayahNum;
    setHighlightedAyah(newHighlight);

    if (onAyahClick) onAyahClick(ayahNum);

    // المعلم يبث التظليل للجميع
    if (isTeacher) {
      broadcastMushafAction('AYAH_HIGHLIGHT', { ayahId: newHighlight, page: currentPage });
    }
  };

  // تبديل إذن القراءة الفردية للطالب من قبل المعلم
  const toggleAllowIndependent = () => {
    if (!isTeacher) return;
    const nextState = !allowIndependentReading;
    setAllowIndependentReading(nextState);
    broadcastMushafAction('MODE_TOGGLE', { allowIndependent: nextState, page: currentPage });
  };

  // عودة الطالب للتزامن مع الشيخ
  const returnToTeacherSync = () => {
    setIsIndependentMode(false);
    setCurrentPage(teacherPage);
    setSyncToast('تم العودة للتزامن اللحظي مع الشيخ');
    setTimeout(() => setSyncToast(null), 3000);
  };

  // تصفية السور للبحث السريع
  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return QURAN_SURAHS;
    return QURAN_SURAHS.filter(s => 
      s.name.includes(searchQuery) || String(s.id) === searchQuery
    );
  }, [searchQuery]);

  // الحصول على الآيات التفاعلية للصفحة الحالية إن وُجدت
  const pageVerseData = SAMPLE_PAGE_VERSES[currentPage] || dynamicPageVerses[currentPage];

  useEffect(() => {
    if (SAMPLE_PAGE_VERSES[currentPage] || dynamicPageVerses[currentPage]) return undefined;
    let cancelled = false;
    fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.data?.ayahs?.length) return;
        const ayahs = json.data.ayahs;
        const firstSurah = ayahs[0]?.surah?.name || '';
        setDynamicPageVerses((prev) => ({
          ...prev,
          [currentPage]: {
            surahName: firstSurah,
            isBismillah: false,
            verses: ayahs.map((a) => ({
              num: a.numberInSurah,
              key: `${a.surah?.number || 0}:${a.numberInSurah}`,
              text: a.text,
            })),
          },
        }));
      })
      .catch(() => { /* fallback to image mode if offline */ });
    return () => { cancelled = true; };
  }, [currentPage, dynamicPageVerses]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showSurahModal) {
        setShowSurahModal(false);
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (!isTeacher && !isIndependentMode) return;
      if (e.key === 'ArrowLeft') goToNextPage();
      else if (e.key === 'ArrowRight') goToPrevPage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSurahModal, isTeacher, isIndependentMode, goToNextPage, goToPrevPage]);

  return (
    <div className={`synced-mushaf-container mushaf-theme-${theme}`} ref={containerRef}>
      {/* ── الشريط العلوي لأدوات المصحف ── */}
      <div className="mushaf-top-bar">
        <div className="mushaf-meta-info">
          <div className="surah-badge">
            <BookOpen size={20} className="text-amber-600" />
            <span>{currentSurah.name}</span>
          </div>
          <span className="page-indicator">صفحة {currentPage} من 604</span>
          <span className="page-indicator">الجزء {currentJuz}</span>

          {/* شارة حالة التزامن */}
          {isTeacher ? (
            <span className="sync-status-pill sync-status-synced">
              <Sparkles size={13} />
              بث مباشر للمصحف (أنت المعلم)
            </span>
          ) : isIndependentMode ? (
            <span className="sync-status-pill sync-status-independent">
              <Eye size={13} />
              وضع القراءة الحرة
            </span>
          ) : (
            <span className="sync-status-pill sync-status-synced">
              <Sparkles size={13} />
              متزامن مع الشيخ
            </span>
          )}
        </div>

        {/* أدوات التحكم والخيارات */}
        <div className="mushaf-actions-group">
          {/* اختيار السورة */}
          <button 
            className="mushaf-icon-btn" 
            onClick={() => setShowSurahModal(true)}
            title="فهرس السور والانتقال"
          >
            <Search size={16} />
          </button>

          {/* تبديل طريقة العرض (تفاعلي / صورة أصلية) */}
          <button
            className={`mushaf-icon-btn ${viewMode === 'image' ? 'active' : ''}`}
            onClick={() => setViewMode(v => v === 'interactive' ? 'image' : 'interactive')}
            title={viewMode === 'interactive' ? 'عرض الصفحة المصورة' : 'عرض الخط التفاعلي'}
          >
            <BookOpen size={16} />
          </button>

          {/* تكبير / تصغير */}
          <button 
            className="mushaf-icon-btn" 
            onClick={() => setZoomLevel(z => Math.min(140, z + 10))}
            title="تكبير الخط"
          >
            <ZoomIn size={16} />
          </button>
          <button 
            className="mushaf-icon-btn" 
            onClick={() => setZoomLevel(z => Math.max(80, z - 10))}
            title="تصغير الخط"
          >
            <ZoomOut size={16} />
          </button>

          {/* تبديل النمط الليلي / المصحفي */}
          <button 
            className="mushaf-icon-btn"
            onClick={() => setTheme(t => t === 'parchment' ? 'night' : t === 'night' ? 'white' : 'parchment')}
            title="تغيير المظهر"
          >
            {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* المعلم: زر السماح للطلاب بالقراءة الفردية */}
          {isTeacher && (
            <button
              className={`mushaf-icon-btn ${allowIndependentReading ? 'text-amber-600' : ''}`}
              onClick={toggleAllowIndependent}
              title={allowIndependentReading ? 'السماح بالقراءة الحرة مفعل' : 'السماح للطلاب بالقراءة الفردية'}
            >
              {allowIndependentReading ? <Unlock size={16} /> : <Lock size={16} />}
            </button>
          )}

          {/* المعلم: مسح التظليل الذهبي */}
          {isTeacher && highlightedAyah && (
            <button
              className="mushaf-icon-btn text-amber-600"
              onClick={() => handleAyahClick(highlightedAyah)}
              title="إلغاء تظليل الآية"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* شريط تنبيه تزامن / عودة */}
      <AnimatePresence>
        {syncToast && (
          <motion.div 
            className="observer-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* شريط وضع القراءة الفردية للطالب */}
      {!isTeacher && !isObserver && allowIndependentReading && (
        <div className="independent-reading-alert">
          <div className="flex items-center gap-2">
            <span>سمح المعلم بالقراءة الفردية للطلاب.</span>
            {!isIndependentMode ? (
              <button 
                className="underline font-bold text-amber-800 hover:text-amber-950"
                onClick={() => setIsIndependentMode(true)}
              >
                تفعيل القراءة الحرة
              </button>
            ) : (
              <span>أنت تقرأ بحرية الآن.</span>
            )}
          </div>
          {isIndependentMode && (
            <button 
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
              onClick={returnToTeacherSync}
            >
              العودة لتزامن الشيخ (صفحة {teacherPage})
            </button>
          )}
        </div>
      )}

      {/* ── منطقة عرض الصفحة القرآنية ── */}
      <div className="mushaf-viewport">
        {/* أزرار التنقل الجانبية العائمة */}
        <button 
          className="mushaf-nav-btn mushaf-nav-prev"
          onClick={goToPrevPage}
          disabled={currentPage <= 1 || (!isTeacher && !isIndependentMode)}
          title="الصفحة السابقة"
        >
          <ChevronRight size={24} />
        </button>

        <button 
          className="mushaf-nav-btn mushaf-nav-next"
          onClick={goToNextPage}
          disabled={currentPage >= 604 || (!isTeacher && !isIndependentMode)}
          title="الصفحة التالية"
        >
          <ChevronLeft size={24} />
        </button>

        {/* إطار صفحة المصحف */}
        <div 
          className="mushaf-page-frame"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          <div className="mushaf-page-inner-border" />

          {/* رأس السورة المزخرف */}
          <div className="surah-header-ornament">
            <h2 className="surah-name-title">{currentSurah.name}</h2>
            <div className="text-xs text-amber-700 mt-1">
              سورة {currentSurah.type} • آياتها {currentSurah.verses}
            </div>
          </div>

          {/* البسملة الشريفة (إلا سورة التوبة) */}
          {currentSurah.id !== 9 && currentPage === currentSurah.startPage && (
            <div className="bismillah-text">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          {/* محتوى الصفحة: إما نص تفاعلي أو صورة عالية الدقة */}
          {viewMode === 'interactive' && pageVerseData ? (
            <div className="mushaf-verses-flow">
              {pageVerseData.verses.map((ayah) => {
                const ayahIdentifier = ayah.key || ayah.num;
                const isHighlighted = highlightedAyah === ayahIdentifier || highlightedAyah === ayah.num;
                return (
                  <span
                    key={ayahIdentifier}
                    onClick={() => handleAyahClick(ayahIdentifier)}
                    className={`mushaf-verse-span ${isHighlighted ? 'mushaf-verse-highlighted' : ''}`}
                    title={isTeacher ? "انقر لتظليل الآية عند جميع طلاب الحلقة" : "آية قرآنية كريمة"}
                  >
                    {ayah.text}
                    <span className="ayah-number-badge">﴿{ayah.num}﴾</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="mushaf-page-image-wrapper">
              {!imageError ? (
                <img 
                  src={pageImageSrc}
                  alt={`صفحة المصحف الشريف ${currentPage}`}
                  className="mushaf-page-image"
                  onError={() => setImageError(true)}
                  loading="eager"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-amber-800">
                  <BookOpen size={48} className="mb-4 opacity-50" />
                  <p className="font-bold text-lg mb-2">صفحة {currentPage} — {currentSurah.name}</p>
                  <p className="text-sm text-gray-500 max-w-sm mb-4">
                    يمكنك القراءة والتسميع مع الشيخ من خلال هذه الصفحة القرآنية.
                  </p>
                  <button 
                    onClick={() => setViewMode('interactive')}
                    className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold"
                  >
                    التبديل إلى الوضع التفاعلي
                  </button>
                </div>
              )}
            </div>
          )}

          {/* تذييل الصفحة برقمها */}
          <div className="mt-auto pt-4 text-center text-xs text-amber-900/60 font-mono font-bold">
            — {currentPage} —
          </div>
        </div>
      </div>

      {/* ── نافذة فهرس السور والانتقال السريع ── */}
      <AnimatePresence>
        {showSurahModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="p-4 border-b flex items-center justify-between bg-emerald-800 text-white">
                <div className="flex items-center gap-2 font-bold text-lg font-amiri">
                  <BookOpen size={20} />
                  <span>فهرس سور القرآن الكريم</span>
                </div>
                <button 
                  onClick={() => setShowSurahModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              {/* حقل البحث أو القفز برقم الصفحة */}
              <div className="p-3 border-b bg-gray-50 space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم السورة أو رقمها..."
                    className="w-full px-3 py-2 border rounded-lg text-sm pr-9 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">انتقال لصفحة:</span>
                  <input
                    type="number"
                    min="1"
                    max="604"
                    placeholder="1-604"
                    className="w-20 px-2 py-1 text-sm border rounded"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') jumpToPage(e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* قائمة السور */}
              <div className="overflow-y-auto flex-1 p-2 divide-y divide-gray-100">
                {filteredSurahs.map((surah) => (
                  <button
                    key={surah.id}
                    onClick={() => jumpToPage(surah.startPage)}
                    className="w-full text-right p-3 hover:bg-emerald-50 rounded-lg flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                        {surah.id}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-gray-900 group-hover:text-emerald-900 font-amiri text-base">
                          {surah.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {surah.type} • {surah.verses} آيات
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-mono">
                      ص {surah.startPage}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
