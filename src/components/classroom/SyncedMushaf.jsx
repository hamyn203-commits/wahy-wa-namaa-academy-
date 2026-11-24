import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronRight, ChevronLeft, BookOpen, Sparkles,
  ZoomIn, ZoomOut, Lock, Unlock,
  Sun, Moon, Eye, RotateCcw, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../i18n';
import Modal from '../shared/Modal';
import MushafWordInspectorBar from './MushafWordInspectorBar';
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

const SAMPLE_PAGE_VERSES = {
  1: {
    surahName: 'سورة الفاتحة',
    isBismillah: false,
    verses: [
      { num: 1, surahNum: 1, key: '1:1', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
      { num: 2, surahNum: 1, key: '1:2', text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
      { num: 3, surahNum: 1, key: '1:3', text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
      { num: 4, surahNum: 1, key: '1:4', text: 'مَالِكِ يَوْمِ الدِّينِ' },
      { num: 5, surahNum: 1, key: '1:5', text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ' },
      { num: 6, surahNum: 1, key: '1:6', text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ' },
      { num: 7, surahNum: 1, key: '1:7', text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' }
    ]
  },
  2: {
    surahName: 'سورة البقرة',
    isBismillah: true,
    verses: [
      { num: 1, surahNum: 2, key: '2:1', text: 'الم' },
      { num: 2, surahNum: 2, key: '2:2', text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ' },
      { num: 3, surahNum: 2, key: '2:3', text: 'الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ' },
      { num: 4, surahNum: 2, key: '2:4', text: 'وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ' },
      { num: 5, surahNum: 2, key: '2:5', text: 'أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ' }
    ]
  },
  562: {
    surahName: 'سورة الملك',
    isBismillah: true,
    verses: [
      { num: 1, surahNum: 67, key: '67:1', text: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ' },
      { num: 2, surahNum: 67, key: '67:2', text: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ' },
      { num: 3, surahNum: 67, key: '67:3', text: 'الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ ۖ فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ' },
      { num: 4, surahNum: 67, key: '67:4', text: 'ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ' },
      { num: 5, surahNum: 67, key: '67:5', text: 'وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ وَجَعَلْنَاهَا رُجُومًا لِّلشَّيَاطِينِ ۖ وَأَعْتَدْنَا لَهُمْ عَذَابَ السَّعِيرِ' }
    ]
  },
  604: {
    surahName: 'سورة الإخلاص والمعوذتين',
    isBismillah: true,
    verses: [
      { num: 1, surahNum: 112, key: '112:1', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
      { num: 2, surahNum: 112, key: '112:2', text: 'اللَّهُ الصَّمَدُ' },
      { num: 3, surahNum: 112, key: '112:3', text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ' },
      { num: 4, surahNum: 112, key: '112:4', text: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ' },
      { num: 1, surahNum: 113, key: '113:1', text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ' },
      { num: 2, surahNum: 113, key: '113:2', text: 'مِن شَرِّ مَا خَلَقَ' },
      { num: 3, surahNum: 113, key: '113:3', text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ' },
      { num: 4, surahNum: 113, key: '113:4', text: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ' },
      { num: 5, surahNum: 113, key: '113:5', text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ' },
      { num: 1, surahNum: 114, key: '114:1', text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ' },
      { num: 2, surahNum: 114, key: '114:2', text: 'مَلِكِ النَّاسِ' },
      { num: 3, surahNum: 114, key: '114:3', text: 'إِلَٰهِ النَّاسِ' },
      { num: 4, surahNum: 114, key: '114:4', text: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ' },
      { num: 5, surahNum: 114, key: '114:5', text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ' },
      { num: 6, surahNum: 114, key: '114:6', text: 'مِنَ الْجِنَّةِ وَالنَّاسِ' }
    ]
  }
};

function getJuzFromPage(page) {
  if (page <= 21) return 1;
  return Math.min(30, Math.ceil((page - 1) / 20));
}

function getSurahForPage(page) {
  for (let i = QURAN_SURAHS.length - 1; i >= 0; i--) {
    if (page >= QURAN_SURAHS[i].startPage) {
      return QURAN_SURAHS[i];
    }
  }
  return QURAN_SURAHS[0];
}

function isWordHiddenByVeil(veilMode, wordIdx) {
  if (!veilMode || veilMode === 'none') return false;
  if (veilMode === 'heads') return wordIdx >= 2;
  if (veilMode === 'alternating') return wordIdx % 2 === 1;
  if (veilMode === 'full') return true;
  return false;
}

/**
 * مكون المصحف الرقمي المتزامن الخارق (V2.0)
 * يدعم: المؤشر الذهبي كلمة بكلمة، ستار التسميع الغيبي مع فتح الـ 3 ثوانٍ،
 * ختم الأخطاء الفوري بملف الطالب، المقرئ المتزامن، ومنبّه السجدات الـ 15.
 */
export default function SyncedMushaf({
  room,
  localParticipant,
  isTeacher = false,
  isObserver = false,
  onAyahClick = null,
  mushafState = null,
  studentOpenMistakes = [],
  onSyncMushaf = null,
  onPinMistake = null,
  onUndoOrResolveMistake = null,
  onRingListenerBell = null,
  onOpenTajweedLab = null,
  onTeleportToWhiteboard = null,
  onStudentPointWord = null,
  allowHandRaise = true,
  studentPointerAllowed = false,
  onPageDataReady = null,
}) {
  const { isRTL, dir, t } = useI18n();
  const [currentPage, setCurrentPage] = useState(() => mushafState?.page || 1);
  const [highlightedAyah, setHighlightedAyah] = useState(() => mushafState?.ayahKey || null);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState(() => mushafState?.wordIndex ?? -1);
  const [selectedWordInfo, setSelectedWordInfo] = useState(null);

  const [allowIndependentReading, setAllowIndependentReading] = useState(false);
  const [isIndependentMode, setIsIndependentMode] = useState(false);
  const [teacherPage, setTeacherPage] = useState(1);
  const [syncToast, setSyncToast] = useState(null);
  const [bellSentNotice, setBellSentNotice] = useState(false);

  const [theme, setTheme] = useState('parchment');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showSurahModal, setShowSurahModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [viewMode, setViewMode] = useState('interactive');
  const [imageError, setImageError] = useState(false);
  const [ayahFetchError, setAyahFetchError] = useState(false);
  const [ayahRetryNonce, setAyahRetryNonce] = useState(0);
  const [dynamicPageVerses, setDynamicPageVerses] = useState({});

  const [selectedReciter, setSelectedReciter] = useState('Husary_Muallim_128kbps');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const containerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const audioRef = useRef(null);
  const lastAudioNonceRef = useRef(mushafState?.qariAudio?.nonce || 0);

  const showSyncToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSyncToast(message);
    toastTimerRef.current = setTimeout(() => {
      setSyncToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // Reconcile incoming persistent classroom mushafState (late joiner & dual-engine sync)
  useEffect(() => {
    if (!mushafState) return;
    if (mushafState.page) {
      setTeacherPage(mushafState.page);
      if (!isTeacher && !isIndependentMode && mushafState.page !== currentPage) {
        setCurrentPage(mushafState.page);
        setImageError(false);
      }
    }
    if (!isTeacher && !isIndependentMode) {
      setHighlightedAyah(mushafState.ayahKey || null);
      setHighlightedWordIdx(mushafState.wordIndex ?? -1);
    }
    setAllowIndependentReading(Boolean(mushafState.allowIndependent));
    if (!mushafState.allowIndependent) {
      setIsIndependentMode(false);
    }
  }, [
    mushafState?.page,
    mushafState?.ayahKey,
    mushafState?.wordIndex,
    mushafState?.allowIndependent,
    isTeacher,
    isIndependentMode,
    currentPage,
    mushafState,
  ]);

  // Timer for 3.5-second Teacher Word Peek auto-expiry
  useEffect(() => {
    const exp = Number(mushafState?.peekExpiresAt) || 0;
    if (!exp || exp <= Date.now()) return undefined;
    setNowMs(Date.now());
    const timer = setTimeout(() => {
      setNowMs(Date.now());
    }, Math.max(100, exp - Date.now() + 80));
    return () => clearTimeout(timer);
  }, [mushafState?.peekWordKey, mushafState?.peekExpiresAt]);

  // Synced Master Qari Audio playback across both Teacher & Student devices
  useEffect(() => {
    const qAudio = mushafState?.qariAudio;
    if (!qAudio || qAudio.nonce === lastAudioNonceRef.current) return undefined;
    lastAudioNonceRef.current = qAudio.nonce;

    if (!qAudio.playing) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsAudioPlaying(false);
      return undefined;
    }

    const sPad = String(qAudio.surah || 1).padStart(3, '0');
    const aPad = String(qAudio.ayah || 1).padStart(3, '0');
    const url = `https://everyayah.com/data/${qAudio.reciter || 'Husary_Muallim_128kbps'}/${sPad}${aPad}.mp3`;
    let remainingPlays = Math.max(1, Math.min(5, Number(qAudio.repeat) || 1));

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const player = audioRef.current;
    player.pause();
    player.src = url;
    setIsAudioPlaying(true);

    const onEnded = () => {
      remainingPlays -= 1;
      if (remainingPlays > 0) {
        player.currentTime = 0;
        player.play().catch(() => setIsAudioPlaying(false));
      } else {
        setIsAudioPlaying(false);
      }
    };
    const onError = () => setIsAudioPlaying(false);

    player.onended = onEnded;
    player.onerror = onError;
    player.play().catch(() => setIsAudioPlaying(false));

    return () => {
      player.onended = null;
      player.onerror = null;
    };
  }, [mushafState?.qariAudio]);

  const currentSurah = useMemo(() => getSurahForPage(currentPage), [currentPage]);
  const currentJuz = useMemo(() => getJuzFromPage(currentPage), [currentPage]);

  const surahTypeLabel = (type) => (type === 'مدنية' ? t.live.mushaf.medina : t.live.mushaf.mecca);

  const pageImageSrc = useMemo(() => {
    return `https://cdn.jsdelivr.net/gh/spa5k/quran-images@master/quran-images-webp/${currentPage}.webp`;
  }, [currentPage]);

  const broadcastMushafAction = useCallback((action, payload = {}) => {
    if (room && localParticipant?.localParticipant) {
      const messageData = {
        type: 'MUSHAF_ACTION',
        action,
        page: payload.page ?? currentPage,
        ayahId: payload.ayahId ?? highlightedAyah,
        wordIndex: payload.wordIndex ?? highlightedWordIdx,
        allowIndependent: payload.allowIndependent ?? allowIndependentReading,
        senderRole: isTeacher ? 'teacher' : 'student',
        timestamp: Date.now()
      };
      try {
        localParticipant.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(messageData)),
          { reliable: true }
        );
      } catch {
        // fallback handled by onSyncMushaf
      }
    }
  }, [room, localParticipant, currentPage, highlightedAyah, highlightedWordIdx, allowIndependentReading, isTeacher]);

  useEffect(() => {
    if (!room) return undefined;

    const handleDataReceived = (payload, participant) => {
      try {
        const senderIdentity = String(participant?.identity || '');
        if (!senderIdentity.startsWith('teacher:') && !senderIdentity.startsWith('admin:')) {
          return;
        }
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== 'MUSHAF_ACTION') return;

        const clampMushafPage = (val) => {
          const parsed = Number.parseInt(val, 10);
          if (!Number.isFinite(parsed)) return null;
          return Math.max(1, Math.min(604, parsed));
        };
        const safeAyahId = data.ayahId ? String(data.ayahId).slice(0, 24) : null;

        if (data.action === 'PAGE_CHANGE') {
          const safePage = clampMushafPage(data.page);
          if (!safePage) return;
          setTeacherPage(safePage);
          if (!isTeacher && !isIndependentMode) {
            setCurrentPage(safePage);
            setHighlightedAyah(safeAyahId);
            setHighlightedWordIdx(-1);
            showSyncToast(`${t.live.mushaf.movedToPage} ${safePage}`);
          }
        } else if (data.action === 'AYAH_HIGHLIGHT') {
          if (!isTeacher && !isIndependentMode) {
            setHighlightedAyah(safeAyahId);
            setHighlightedWordIdx(Number.isInteger(data.wordIndex) ? data.wordIndex : -1);
          }
        } else if (data.action === 'MODE_TOGGLE') {
          setAllowIndependentReading(Boolean(data.allowIndependent));
          if (!data.allowIndependent) {
            setIsIndependentMode(false);
            const safePage = clampMushafPage(data.page);
            if (safePage) setCurrentPage(safePage);
          }
        }
      } catch {
        // ignore non-matching packets
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, isTeacher, isIndependentMode, showSyncToast, t]);

  const syncTeacherPageChange = useCallback((nextPage) => {
    const surahObj = getSurahForPage(nextPage);
    setCurrentPage(nextPage);
    setHighlightedAyah(null);
    setHighlightedWordIdx(-1);
    setSelectedWordInfo(null);
    setImageError(false);

    if (isTeacher) {
      broadcastMushafAction('PAGE_CHANGE', { page: nextPage, ayahId: null, wordIndex: -1 });
      onSyncMushaf?.({
        page: nextPage,
        surahNumber: surahObj.id,
        ayahKey: '',
        wordIndex: -1,
        wordText: '',
        spotlightWord: '',
      });
    }
  }, [isTeacher, broadcastMushafAction, onSyncMushaf]);

  const goToNextPage = useCallback(() => {
    if (currentPage >= 604) return;
    syncTeacherPageChange(currentPage + 1);
  }, [currentPage, syncTeacherPageChange]);

  const goToPrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    syncTeacherPageChange(currentPage - 1);
  }, [currentPage, syncTeacherPageChange]);

  const jumpToPage = useCallback((pageNum) => {
    const activeVeil = mushafState?.hifzVeilMode || 'none';
    if (!isTeacher && (!isIndependentMode || activeVeil !== 'none')) return;
    const validPage = Math.max(1, Math.min(604, parseInt(pageNum, 10) || 1));
    setShowSurahModal(false);
    syncTeacherPageChange(validPage);
  }, [isTeacher, isIndependentMode, mushafState?.hifzVeilMode, syncTeacherPageChange]);

  const jumpToSurahNumber = useCallback((surahNumber) => {
    const found = QURAN_SURAHS.find((s) => s.id === Number(surahNumber));
    if (found) jumpToPage(found.startPage);
  }, [jumpToPage]);

  const handleWordOrAyahSelect = (ayah, wordIdx, wordStr) => {
    if (isObserver) return;
    const ayahIdentifier = String(ayah.key || `${currentSurah.id}:${ayah.num}`);

    if (!isTeacher) {
      if (!studentPointerAllowed || wordIdx < 0 || !wordStr) return;
      onStudentPointWord?.({
        page: currentPage,
        ayahKey: ayahIdentifier,
        wordIndex: wordIdx,
        wordText: wordStr,
      });
      showSyncToast(`تم إرسال إشارتك على كلمة «${wordStr}» للمعلم ✅`);
      return;
    }

    const isSameSelection = highlightedAyah === ayahIdentifier && highlightedWordIdx === wordIdx;

    const nextAyah = isSameSelection ? null : ayahIdentifier;
    const nextWordIdx = isSameSelection ? -1 : wordIdx;
    const nextWordText = isSameSelection ? '' : wordStr;

    setHighlightedAyah(nextAyah);
    setHighlightedWordIdx(nextWordIdx);
    setSelectedWordInfo(
      isSameSelection
        ? null
        : {
            ayahNum: ayah.num,
            surahNumber: ayah.surahNum || currentSurah.id,
            ayahKey: ayahIdentifier,
            wordIndex: wordIdx,
            wordText: wordStr || ayah.text,
            ayahFullText: ayah.text,
          }
    );

    if (onAyahClick) onAyahClick(ayahIdentifier);

    if (isTeacher) {
      broadcastMushafAction('AYAH_HIGHLIGHT', { ayahId: nextAyah, wordIndex: nextWordIdx, page: currentPage });
      const activeVeil = mushafState?.hifzVeilMode || 'none';
      const wordCompositeKey = `${ayahIdentifier}:${wordIdx}`;
      onSyncMushaf?.({
        page: currentPage,
        surahNumber: ayah.surahNum || currentSurah.id,
        ayahKey: nextAyah || '',
        wordIndex: nextWordIdx,
        wordText: nextWordText,
        ...(activeVeil !== 'none' && !isSameSelection
          ? { peekWordKey: wordCompositeKey, peekDurationMs: 3500 }
          : {}),
      });
    }
  };

  const toggleAllowIndependent = () => {
    if (!isTeacher) return;
    const nextState = !allowIndependentReading;
    setAllowIndependentReading(nextState);
    broadcastMushafAction('MODE_TOGGLE', { allowIndependent: nextState, page: currentPage });
    onSyncMushaf?.({ allowIndependent: nextState, page: currentPage });
  };

  const returnToTeacherSync = () => {
    setIsIndependentMode(false);
    setCurrentPage(teacherPage);
    showSyncToast(t.live.mushaf.returnedToSync);
  };

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return QURAN_SURAHS;
    return QURAN_SURAHS.filter((s) =>
      s.name.includes(searchQuery.trim()) || String(s.id) === searchQuery.trim()
    );
  }, [searchQuery]);

  const pageVerseData = SAMPLE_PAGE_VERSES[currentPage] || dynamicPageVerses[currentPage];

  useEffect(() => {
    if (pageVerseData && onPageDataReady) {
      onPageDataReady(pageVerseData);
    }
  }, [pageVerseData, onPageDataReady]);

  useEffect(() => {
    if (SAMPLE_PAGE_VERSES[currentPage] || dynamicPageVerses[currentPage]) {
      setAyahFetchError(false);
      return undefined;
    }
    let cancelled = false;
    setAyahFetchError(false);
    fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Fetch failed'))))
      .then((json) => {
        if (cancelled) return;
        if (!json?.data?.ayahs?.length) {
          setAyahFetchError(true);
          return;
        }
        const ayahs = json.data.ayahs;
        const firstSurah = ayahs[0]?.surah?.name || '';
        setDynamicPageVerses((prev) => ({
          ...prev,
          [currentPage]: {
            surahName: firstSurah,
            isBismillah: false,
            verses: ayahs.map((a) => ({
              num: a.numberInSurah,
              surahNum: a.surah?.number || currentSurah.id,
              key: `${a.surah?.number || currentSurah.id}:${a.numberInSurah}`,
              text: a.text,
            })),
          },
        }));
      })
      .catch(() => {
        if (!cancelled) setAyahFetchError(true);
      });
    return () => { cancelled = true; };
  }, [currentPage, dynamicPageVerses, ayahRetryNonce, currentSurah.id]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (!isTeacher && !isIndependentMode) return;
      if (e.key === 'ArrowLeft') {
        if (isRTL) goToNextPage();
        else goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        if (isRTL) goToPrevPage();
        else goToNextPage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRTL, isTeacher, isIndependentMode, goToNextPage, goToPrevPage]);

  const hifzVeilMode = mushafState?.hifzVeilMode || 'none';
  const spotlightWord = mushafState?.spotlightWord || '';
  const studentPointer = mushafState?.studentPointer || null;
  const pinnedMistakes = Array.isArray(mushafState?.pinnedMistakes) ? mushafState.pinnedMistakes : [];
  const activePeekKey = (mushafState?.peekExpiresAt || 0) > nowMs ? mushafState?.peekWordKey : '';
  const canLearnerNavigate = isTeacher || (allowIndependentReading && isIndependentMode && hifzVeilMode === 'none');
  const effectiveViewMode = !isTeacher && hifzVeilMode !== 'none' ? 'interactive' : viewMode;

  const handlePlayQari = (repeatCount = 1) => {
    if (!isTeacher) return;
    const targetSurah = selectedWordInfo?.surahNumber || currentSurah.id;
    const targetAyah = selectedWordInfo?.ayahNum || 1;
    onSyncMushaf?.({
      qariAudio: {
        reciter: selectedReciter,
        surah: targetSurah,
        ayah: targetAyah,
        repeat: repeatCount,
        playing: true,
      },
    });
  };

  const handleStopQari = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    if (isTeacher) {
      onSyncMushaf?.({
        qariAudio: {
          reciter: selectedReciter,
          surah: currentSurah.id,
          ayah: 1,
          repeat: 1,
          playing: false,
        },
      });
    }
  };

  const handlePinWordMistake = async (type) => {
    if (!isTeacher || !selectedWordInfo || !onPinMistake) return;
    await onPinMistake({
      surahNumber: selectedWordInfo.surahNumber || currentSurah.id,
      surahName: currentSurah.name,
      ayahNumber: selectedWordInfo.ayahNum || 1,
      wordText: selectedWordInfo.wordText || '',
      type,
    });
    showSyncToast('تم ختم الملاحظة على مصحف الطالب وحفظها في سجله ✅');
  };

  const handleStudentBell = async () => {
    if (!onRingListenerBell) return;
    try {
      await onRingListenerBell(currentPage, highlightedAyah || '');
      setBellSentNotice(true);
      setTimeout(() => setBellSentNotice(false), 4000);
    } catch {
      // ignore cooldown
    }
  };

  return (
    <div className={`synced-mushaf-container mushaf-theme-${theme}`} ref={containerRef} dir={dir}>
      <div className="mushaf-top-bar">
        <div className="mushaf-meta-info">
          <div className="surah-badge">
            <BookOpen size={20} className="text-[var(--wn-text-gold)] shrink-0" aria-hidden="true" />
            <span>{currentSurah.name}</span>
          </div>
          <span className="page-indicator">
            {t.live.mushaf.pageLabel} {currentPage} {t.live.mushaf.ofLabel} 604
          </span>
          <span className="page-indicator">{t.live.mushaf.juzLabel} {currentJuz}</span>

          {isTeacher ? (
            <span className="sync-status-pill sync-status-synced">
              <Sparkles size={13} aria-hidden="true" />
              {t.live.mushaf.teacherBroadcast}
            </span>
          ) : isIndependentMode ? (
            <span className="sync-status-pill sync-status-independent">
              <Eye size={13} aria-hidden="true" />
              {t.live.mushaf.independentMode}
            </span>
          ) : (
            <span className="sync-status-pill sync-status-synced">
              <Sparkles size={13} aria-hidden="true" />
              {t.live.mushaf.syncedWithTeacher}
            </span>
          )}
        </div>

        <div className="mushaf-actions-group">
          {(isTeacher || (allowIndependentReading && hifzVeilMode === 'none')) && (
            <button
              type="button"
              className="mushaf-icon-btn"
              onClick={() => setShowSurahModal(true)}
              aria-label={t.live.mushaf.surahIndexTitle}
              title={t.live.mushaf.surahIndexTitle}
            >
              <Search size={16} aria-hidden="true" />
            </button>
          )}

          {(isTeacher || hifzVeilMode === 'none') && (
            <button
              type="button"
              className={`mushaf-icon-btn ${effectiveViewMode === 'image' ? 'active' : ''}`}
              onClick={() => setViewMode((v) => (v === 'interactive' ? 'image' : 'interactive'))}
              aria-label={effectiveViewMode === 'interactive' ? t.live.mushaf.viewImage : t.live.mushaf.viewInteractive}
              title={effectiveViewMode === 'interactive' ? t.live.mushaf.viewImage : t.live.mushaf.viewInteractive}
            >
              <BookOpen size={16} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className="mushaf-icon-btn"
            onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
            aria-label={t.live.mushaf.zoomInTitle}
            title={t.live.mushaf.zoomInTitle}
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mushaf-icon-btn"
            onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
            aria-label={t.live.mushaf.zoomOutTitle}
            title={t.live.mushaf.zoomOutTitle}
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="mushaf-icon-btn"
            onClick={() => setTheme((prev) => (prev === 'parchment' ? 'night' : prev === 'night' ? 'white' : 'parchment'))}
            aria-label={t.live.mushaf.changeTheme}
            title={t.live.mushaf.changeTheme}
          >
            {theme === 'night' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>

          {isTeacher && (
            <button
              type="button"
              className={`mushaf-icon-btn ${allowIndependentReading ? 'text-[var(--wn-text-gold)]' : ''}`}
              onClick={toggleAllowIndependent}
              aria-pressed={allowIndependentReading}
              aria-label={allowIndependentReading ? t.live.mushaf.allowIndependentOn : t.live.mushaf.allowIndependentOff}
              title={allowIndependentReading ? t.live.mushaf.allowIndependentOn : t.live.mushaf.allowIndependentOff}
            >
              {allowIndependentReading ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
            </button>
          )}

          {isTeacher && highlightedAyah && (
            <button
              type="button"
              className="mushaf-icon-btn text-[var(--wn-text-gold)]"
              onClick={() => {
                setHighlightedAyah(null);
                setHighlightedWordIdx(-1);
                setSelectedWordInfo(null);
                broadcastMushafAction('AYAH_HIGHLIGHT', { ayahId: null, wordIndex: -1, page: currentPage });
                onSyncMushaf?.({ ayahKey: '', wordIndex: -1, wordText: '', spotlightWord: '' });
              }}
              aria-label={t.live.mushaf.clearHighlight}
              title={t.live.mushaf.clearHighlight}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* شريط الأدوات القرآنية المتقدم: ستار الحفظ، المقرئ المتزامن، وختم الأخطاء */}
      <MushafWordInspectorBar
        isTeacher={isTeacher}
        isObserver={isObserver}
        currentPage={currentPage}
        currentSurah={currentSurah}
        selectedWordInfo={selectedWordInfo}
        hifzVeilMode={hifzVeilMode}
        spotlightWord={spotlightWord}
        isAudioPlaying={isAudioPlaying}
        selectedReciter={selectedReciter}
        onChangeReciter={setSelectedReciter}
        onPlayQariAyah={handlePlayQari}
        onStopQariAyah={handleStopQari}
        onChangeVeilMode={(mode) => onSyncMushaf?.({ hifzVeilMode: mode, peekWordKey: '' })}
        onToggleSpotlight={(word) => onSyncMushaf?.({ spotlightWord: word })}
        onPinMistake={handlePinWordMistake}
        pinnedMistakes={pinnedMistakes}
        studentOpenMistakes={studentOpenMistakes}
        onUndoOrResolveMistake={onUndoOrResolveMistake}
        onJumpToSurahNumber={jumpToSurahNumber}
        onRingListenerBell={handleStudentBell}
        onOpenTajweedLab={onOpenTajweedLab}
        onTeleportToWhiteboard={onTeleportToWhiteboard}
        allowHandRaise={allowHandRaise}
        studentPointerAllowed={studentPointerAllowed}
        studentPointer={studentPointer}
        bellSentNotice={bellSentNotice}
      />

      <AnimatePresence>
        {syncToast && (
          <motion.div
            role="status"
            aria-live="polite"
            className="observer-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!isTeacher && !isObserver && allowIndependentReading && hifzVeilMode === 'none' && (
        <div className="independent-reading-alert flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>{t.live.mushaf.independentAllowed}</span>
            {!isIndependentMode ? (
              <button
                type="button"
                className="min-h-[44px] px-3 underline font-bold text-[var(--wn-badge-gold-text)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                onClick={() => setIsIndependentMode(true)}
              >
                {t.live.mushaf.enableIndependent}
              </button>
            ) : (
              <span>{t.live.mushaf.readingIndependently}</span>
            )}
          </div>
          {isIndependentMode && (
            <button
              type="button"
              className="min-h-[44px] px-3 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] rounded-lg text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              onClick={returnToTeacherSync}
            >
              {t.live.mushaf.returnToTeacherSync} ({t.live.mushaf.pageLabel} {teacherPage})
            </button>
          )}
        </div>
      )}

      <div className="mushaf-viewport">
        <button
          type="button"
          className="mushaf-nav-btn mushaf-nav-prev"
          onClick={goToPrevPage}
          disabled={currentPage <= 1 || !canLearnerNavigate}
          aria-label={t.live.mushaf.prevPage}
          title={t.live.mushaf.prevPage}
        >
          {isRTL ? <ChevronRight size={24} aria-hidden="true" /> : <ChevronLeft size={24} aria-hidden="true" />}
        </button>

        <button
          type="button"
          className="mushaf-nav-btn mushaf-nav-next"
          onClick={goToNextPage}
          disabled={currentPage >= 604 || !canLearnerNavigate}
          aria-label={t.live.mushaf.nextPage}
          title={t.live.mushaf.nextPage}
        >
          {isRTL ? <ChevronLeft size={24} aria-hidden="true" /> : <ChevronRight size={24} aria-hidden="true" />}
        </button>

        <div
          className="mushaf-page-frame"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          <div className="mushaf-page-inner-border" />

          <div className="surah-header-ornament">
            <h2 className="surah-name-title">{currentSurah.name}</h2>
            <div className="text-xs text-[var(--wn-badge-gold-text)] mt-1">
              {surahTypeLabel(currentSurah.type)} • {currentSurah.verses} {t.live.mushaf.ayahsLabel}
            </div>
          </div>

          {currentSurah.id !== 9 && currentPage === currentSurah.startPage && (
            <div className="bismillah-text">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          {effectiveViewMode === 'interactive' && pageVerseData ? (
            <div className="mushaf-verses-flow">
              {pageVerseData.verses.map((ayah) => {
                const ayahIdentifier = String(ayah.key || `${ayah.surahNum || currentSurah.id}:${ayah.num}`);
                const isAyahHighlighted = String(highlightedAyah) === ayahIdentifier || highlightedAyah === ayah.num;
                const words = String(ayah.text || '').split(/\s+/).filter(Boolean);

                return (
                  <span
                    key={ayahIdentifier}
                    className={`mushaf-verse-span ${isAyahHighlighted && highlightedWordIdx < 0 ? 'mushaf-verse-highlighted' : ''}`}
                  >
                    {words.map((word, wIdx) => {
                      const wordCompositeKey = `${ayahIdentifier}:${wIdx}`;
                      const isLaserWord = isAyahHighlighted && highlightedWordIdx === wIdx;
                      const isStudentPointedWord =
                        studentPointer &&
                        studentPointer.page === currentPage &&
                        String(studentPointer.ayahKey) === ayahIdentifier &&
                        studentPointer.wordIndex === wIdx;
                      const isPeeked = activePeekKey === wordCompositeKey;
                      const hiddenForLearner = !isTeacher && !isIndependentMode && isWordHiddenByVeil(hifzVeilMode, wIdx) && !isPeeked;
                      const veiledPreviewForTeacher = isTeacher && isWordHiddenByVeil(hifzVeilMode, wIdx);

                      const mistakeMatch = pinnedMistakes.find(
                        (m) =>
                          m.surahNumber === (ayah.surahNum || currentSurah.id) &&
                          m.ayahNumber === ayah.num &&
                          m.wordText === word
                      );

                      return (
                        <span
                          key={wordCompositeKey}
                          role={isObserver || (!isTeacher && !studentPointerAllowed) ? undefined : 'button'}
                          tabIndex={isObserver || (!isTeacher && !studentPointerAllowed) ? -1 : 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWordOrAyahSelect(ayah, wIdx, word);
                          }}
                          onKeyDown={(e) => {
                            if (!isObserver && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleWordOrAyahSelect(ayah, wIdx, word);
                            }
                          }}
                          title={
                            isTeacher && veiledPreviewForTeacher
                              ? 'انقر لفتح هذه الكلمة للطالب لمدة ٣ ثوانٍ'
                              : isTeacher
                                ? 'انقر لتوجيه المؤشر الذهبي أو ختم ملاحظة'
                                : studentPointerAllowed
                                  ? 'انقر للإشارة إلى هذه الكلمة أمام المعلم'
                                  : undefined
                          }
                          className={`inline-block mx-0.5 px-1 rounded transition-all duration-200 ${
                            hiddenForLearner
                              ? 'blur-sm select-none opacity-20 bg-[var(--wn-gold-soft)]'
                              : isPeeked
                                ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] ring-2 ring-[var(--wn-emerald)] font-bold scale-105'
                                : isLaserWord
                                  ? 'mushaf-verse-highlighted ring-2 ring-[var(--wn-gold)] font-bold scale-105'
                                  : isStudentPointedWord
                                    ? 'bg-[var(--wn-mint)] text-[var(--wn-heading)] ring-2 ring-[var(--wn-teal)] font-bold scale-105'
                                    : veiledPreviewForTeacher
                                      ? 'opacity-70 border-b border-dashed border-[var(--wn-gold)]'
                                      : ''
                          } ${
                            mistakeMatch?.type === 'memorization'
                              ? 'underline decoration-wavy decoration-[var(--wn-danger)]'
                              : mistakeMatch?.type === 'tajweed'
                                ? 'underline decoration-wavy decoration-[var(--wn-warning)]'
                                : mistakeMatch?.type === 'tashkeel'
                                  ? 'underline decoration-wavy decoration-[var(--wn-emerald)]'
                                  : ''
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                    <span
                      role={isObserver ? undefined : 'button'}
                      tabIndex={isObserver ? -1 : 0}
                      onClick={() => handleWordOrAyahSelect(ayah, -1, '')}
                      onKeyDown={(e) => {
                        if (!isObserver && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleWordOrAyahSelect(ayah, -1, '');
                        }
                      }}
                      className="ayah-number-badge cursor-pointer"
                    >
                      ﴿{ayah.num}﴾
                    </span>
                  </span>
                );
              })}
            </div>
          ) : effectiveViewMode === 'interactive' && ayahFetchError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-3 my-auto">
              <BookOpen size={40} className="opacity-60 text-[var(--wn-text-gold)]" aria-hidden="true" />
              <p className="font-bold text-base">{t.live.mushaf.pageLabel} {currentPage} — {currentSurah.name}</p>
              <p className="text-sm text-[var(--wn-text-secondary)] max-w-sm">
                {t.live.mushaf.fallbackDesc}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setAyahRetryNonce((n) => n + 1)}
                  className="btn-primary min-h-[44px]"
                >
                  {t.common.retry}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageError(false);
                    setViewMode('image');
                  }}
                  className="btn-secondary min-h-[44px]"
                >
                  {t.live.mushaf.viewImage}
                </button>
              </div>
            </div>
          ) : (
            <div className="mushaf-page-image-wrapper">
              {!imageError ? (
                <img
                  src={pageImageSrc}
                  alt={`${t.live.mushaf.pageAlt} ${currentPage}`}
                  className="mushaf-page-image"
                  onError={() => setImageError(true)}
                  loading="eager"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--wn-badge-gold-text)]">
                  <BookOpen size={48} className="mb-4 opacity-50" aria-hidden="true" />
                  <p className="font-bold text-lg mb-2">{t.live.mushaf.pageLabel} {currentPage} — {currentSurah.name}</p>
                  <p className="text-sm text-[var(--wn-text-secondary)] max-w-sm mb-4">
                    {t.live.mushaf.fallbackDesc}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImageError(false)}
                      className="btn-secondary min-h-[44px]"
                    >
                      {t.common.retry}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('interactive')}
                      className="btn-primary min-h-[44px]"
                    >
                      {t.live.mushaf.switchInteractive}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto pt-4 text-center text-xs text-[var(--wn-text-secondary)] font-mono font-bold">
            — {currentPage} —
          </div>
        </div>
      </div>

      <Modal
        isOpen={showSurahModal}
        onClose={() => setShowSurahModal(false)}
        title={t.live.mushaf.surahModalTitle}
        maxWidth="460px"
      >
        <div className="space-y-3" dir={dir}>
          <div className="p-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2.5">
            <div className="relative">
              <label htmlFor="mushaf-surah-search" className="sr-only">
                {t.live.mushaf.searchPlaceholder}
              </label>
              <input
                id="mushaf-surah-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.live.mushaf.searchPlaceholder}
                className="w-full min-h-[44px] ps-3 pe-9 py-2 border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)]"
              />
              <Search size={16} className="absolute end-3 top-3.5 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
            </div>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (jumpPageInput) jumpToPage(jumpPageInput);
              }}
            >
              <label htmlFor="mushaf-jump-page" className="text-xs text-[var(--wn-text-secondary)] font-semibold">
                {t.live.mushaf.jumpToPage}
              </label>
              <input
                id="mushaf-jump-page"
                type="number"
                min="1"
                max="604"
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder="1-604"
                className="w-24 min-h-[44px] px-2.5 py-1.5 text-sm border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)]"
              />
              <button
                type="submit"
                disabled={!jumpPageInput}
                className="btn-secondary min-h-[44px] px-3 text-xs"
              >
                {t.common.open}
              </button>
            </form>
          </div>

          <div className="max-h-[52vh] overflow-y-auto divide-y divide-[var(--wn-border)] rounded-xl border border-[var(--wn-border)]">
            {filteredSurahs.map((surah) => (
              <button
                key={surah.id}
                type="button"
                onClick={() => jumpToPage(surah.startPage)}
                className="w-full min-h-[44px] text-start p-3 hover:bg-[var(--wn-emerald-soft)] flex items-center justify-between gap-2 transition group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] font-bold text-xs flex items-center justify-center shrink-0">
                    {surah.id}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-base text-[var(--wn-text-primary)] group-hover:text-[var(--wn-heading)] font-amiri truncate">
                      {surah.name}
                    </div>
                    <div className="text-xs text-[var(--wn-text-secondary)]">
                      {surahTypeLabel(surah.type)} • {surah.verses} {t.live.mushaf.ayahsLabel}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[var(--wn-badge-emerald-text)] bg-[var(--wn-emerald-soft)] px-2.5 py-1 rounded font-mono shrink-0">
                  {t.live.mushaf.pageAbbr} {surah.startPage}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
