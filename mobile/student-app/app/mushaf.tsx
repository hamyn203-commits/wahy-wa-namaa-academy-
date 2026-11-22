import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Volume2,
  X,
} from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { SURAHS } from '../src/lib/surahs';
import { IslamicHero } from '../src/components/IslamicHero';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { SurahMeta } from '../src/types/academy';

interface AyahItem {
  number: number; // Global ayah number 1..6236 (used for audio URL!)
  numberInSurah: number;
  text: string;
  page?: number;
  juz?: number;
}

type ReaderTheme = 'parchment' | 'white' | 'night';
type ReaderMode = 'mushaf' | 'verses';

const RECITERS = [
  { id: 'ar.banna', ar: 'الشيخ محمود علي البنا', shortAr: 'محمود علي البنا', en: 'Mahmoud Ali Al-Banna', styleAr: 'مرتّل مصري أصيل', styleEn: 'Egyptian Murattal' },
  { id: 'ar.husary', ar: 'الشيخ محمود خليل الحصري', shortAr: 'الحصري (مرتّل)', en: 'Mahmoud Al-Husary', styleAr: 'مرتّل تعليمي', styleEn: 'Educational' },
  { id: 'ar.husarymujawwad', ar: 'الشيخ محمود خليل الحصري (مجود)', shortAr: 'الحصري (مجوّد)', en: 'Al-Husary (Mujawwad)', styleAr: 'مجوّد', styleEn: 'Mujawwad' },
  { id: 'ar.minshawi', ar: 'الشيخ محمد صديق المنشاوي', shortAr: 'المنشاوي', en: 'Muhammad Al-Minshawi', styleAr: 'مرتّل خاشع', styleEn: 'Murattal' },
  { id: 'ar.abdulbasitmurattal', ar: 'الشيخ عبد الباسط عبد الصمد', shortAr: 'عبد الباسط', en: 'Abdul Basit', styleAr: 'مرتّل', styleEn: 'Murattal' },
  { id: 'ar.mahermuaiqly', ar: 'الشيخ ماهر المعيقلي', shortAr: 'ماهر المعيقلي', en: 'Maher Al-Muaiqly', styleAr: 'إمام الحرم', styleEn: 'Haram Imam' },
  { id: 'ar.hudhaify', ar: 'الشيخ علي بن عبد الرحمن الحذيفي', shortAr: 'علي الحذيفي', en: 'Ali Al-Hudhaify', styleAr: 'المسجد النبوي', styleEn: 'Madinah' },
] as const;

function buildAyahAudioUrl(reciterId: string, surahNumber: number, ayah: AyahItem): string {
  if (reciterId === 'ar.banna') {
    const sss = String(surahNumber).padStart(3, '0');
    const aaa = String(ayah.numberInSurah).padStart(3, '0');
    return `https://everyayah.com/data/mahmoud_ali_al_banna_32kbps/${sss}${aaa}.mp3`;
  }
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${ayah.number}.mp3`;
}

function getOfflineSurahDir(reciterId: string, surahNumber: number): string {
  return `${FileSystem.documentDirectory || ''}quran-audio/${reciterId}/${surahNumber}/`;
}

function getOfflineAyahPath(reciterId: string, surahNumber: number, ayahInSurah: number): string {
  return `${getOfflineSurahDir(reciterId, surahNumber)}${ayahInSurah}.mp3`;
}

const RECITER_KEY = 'wwn_preferred_reciter';

const REPEAT_OPTIONS = [1, 2, 3, 5, 7, 10] as const;

const ADHKAR_LIST = [
  { id: 'subhan', ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', target: 33 },
  { id: 'alhamd', ar: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', target: 33 },
  { id: 'akbar', ar: 'اللَّهُ أَكْبَرُ', target: 33 },
  { id: 'istighfar', ar: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ', target: 100 },
  { id: 'salawat', ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', target: 10 },
];

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

/**
 * Strips the prepended Basmalah returned by alquran.cloud on Ayah 1 of Surahs 2..114 (except 9)
 * so the Basmalah is never duplicated under the ornamental Surah banner.
 */
function cleanAyahText(raw: string, surahNumber: number, ayahNumberInSurah: number): string {
  let text = String(raw || '').trim();
  if (surahNumber !== 1 && surahNumber !== 9 && ayahNumberInSurah === 1) {
    // Handles both Uthmani Alef-Wasla (ٱ) and regular Alef (ا) variants cleanly
    text = text.replace(
      /^بِسْمِ\s+[ٱا]للَّهِ\s+[ٱا]لرَّحْمَٰنِ\s+[ٱا]لرَّحِيمِ\s*/u,
      ''
    );
    text = text.replace(/^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/u, '');
    // Fallback by Unicode normalization if diacritics differ slightly
    if (text.startsWith('بِسْمِ') && text.length > 42) {
      const idx = text.indexOf('الرَّحِيمِ');
      const idx2 = text.indexOf('ٱلرَّحِيمِ');
      const cut = idx !== -1 ? idx + 'الرَّحِيمِ'.length : idx2 !== -1 ? idx2 + 'ٱلرَّحِيمِ'.length : -1;
      if (cut > 0) text = text.slice(cut).trim();
    }
  }
  return text.trim();
}

const BOOKMARK_KEY = 'wwn_mushaf_bookmark_v2';

interface SavedBookmark {
  surahNumber: number;
  ayahNumberInSurah?: number;
  page?: number;
}

function SurahCartouche({ surah, night }: { surah: SurahMeta; night: boolean }) {
  return (
    <View style={styles.cartoucheWrap}>
      <Svg width="100%" height={66} viewBox="0 0 340 66" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cartoucheGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={night ? '#123127' : '#094331'} />
            <Stop offset="50%" stopColor={night ? '#194738' : '#0F6B4F'} />
            <Stop offset="100%" stopColor={night ? '#123127' : '#094331'} />
          </LinearGradient>
        </Defs>
        <Rect x="2" y="2" width="336" height="62" rx="14" fill="url(#cartoucheGrad)" stroke="#D4AF6B" strokeWidth="1.6" />
        <Rect x="7" y="7" width="326" height="52" rx="10" fill="none" stroke="rgba(212,175,107,0.45)" strokeWidth="0.9" />
        {/* Ornamental side medallions */}
        <Path d="M22 33 L30 22 L38 33 L30 44 Z" fill="rgba(212,175,107,0.28)" stroke="#D4AF6B" strokeWidth="1" />
        <Path d="M302 33 L310 22 L318 33 L310 44 Z" fill="rgba(212,175,107,0.28)" stroke="#D4AF6B" strokeWidth="1" />
      </Svg>
      <Text style={styles.cartoucheTitle}>سورة {surah.nameAr}</Text>
      <Text style={styles.cartoucheSub}>
        {surah.revelation === 'meccan' ? 'مكية' : 'مدنية'} • {toArabicNum(surah.ayahs)} آية • الجزء {toArabicNum(surah.juz)}
      </Text>
    </View>
  );
}

export default function MushafScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();

  const [homeTab, setHomeTab] = useState<'surahs' | 'adhkar'>('surahs');
  const [search, setSearch] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta | null>(null);
  const [bookmark, setBookmark] = useState<SavedBookmark | null>(null);

  // Reader state
  const [ayahs, setAyahs] = useState<AyahItem[]>([]);
  const [tafsirMap, setTafsirMap] = useState<Record<number, string>>({});
  const [showTafsir, setShowTafsir] = useState(false);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [surahError, setSurahError] = useState('');
  const [fontSize, setFontSize] = useState(25);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('parchment');
  const [readerMode, setReaderMode] = useState<ReaderMode>('mushaf');
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Audio recitation & memorization repeat state
  const [reciter, setReciter] = useState<string>(RECITERS[0].id);
  const [reciterModalOpen, setReciterModalOpen] = useState(false);
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [currentRepeat, setCurrentRepeat] = useState<number>(1);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [playingAyahNum, setPlayingAyahNum] = useState<number | null>(null);
  const [loadingAudioNum, setLoadingAudioNum] = useState<number | null>(null);

  // Offline Surah audio download state (expo-file-system)
  const [isSurahOffline, setIsSurahOffline] = useState(false);
  const [downloadingOffline, setDownloadingOffline] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const downloadCancelledRef = useRef(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackSessionIdRef = useRef(0);
  const reciterRef = useRef<string>(RECITERS[0].id);
  const repeatCountRef = useRef<number>(1);
  const selectedSurahRef = useRef<SurahMeta | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    reciterRef.current = reciter;
  }, [reciter]);

  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

  useEffect(() => {
    selectedSurahRef.current = selectedSurah;
  }, [selectedSurah]);

  const activeReciter = useMemo(
    () => RECITERS.find((r) => r.id === reciter) || RECITERS[0],
    [reciter]
  );

  // Adhkar counter
  const [tasbeehCounts, setTasbeehCounts] = useState<Record<string, number>>({});

  const unloadCurrentSound = useCallback(async () => {
    const active = soundRef.current;
    soundRef.current = null;
    if (active) {
      try {
        active.setOnPlaybackStatusUpdate(null);
        await active.stopAsync();
      } catch { /* ignore */ }
      try {
        await active.unloadAsync();
      } catch { /* ignore */ }
    }
  }, []);

  const stopAudio = useCallback(async () => {
    // Invalidate every in-flight load/callback immediately so two Qaris can NEVER overlap
    playbackSessionIdRef.current += 1;
    setIsPlayingSequence(false);
    setPlayingAyahNum(null);
    setLoadingAudioNum(null);
    setCurrentRepeat(1);
    await unloadCurrentSound();
  }, [unloadCurrentSound]);

  const selectReciter = (id: string) => {
    void stopAudio();
    reciterRef.current = id;
    setReciter(id);
    setReciterModalOpen(false);
    void SecureStore.setItemAsync(RECITER_KEY, id).catch(() => {});
  };

  useEffect(() => {
    return () => {
      void stopAudio();
    };
  }, [stopAudio]);

  useEffect(() => {
    void SecureStore.getItemAsync(BOOKMARK_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as SavedBookmark;
        if (parsed?.surahNumber >= 1 && parsed.surahNumber <= 114) {
          setBookmark(parsed);
        }
      })
      .catch(() => {});

    void SecureStore.getItemAsync(RECITER_KEY)
      .then((savedId) => {
        if (savedId && RECITERS.some((r) => r.id === savedId)) {
          setReciter(savedId);
        }
      })
      .catch(() => {});
  }, []);

  const saveBookmark = (next: SavedBookmark) => {
    setBookmark(next);
    void SecureStore.setItemAsync(BOOKMARK_KEY, JSON.stringify(next)).catch(() => {});
  };

  const openSurah = useCallback(async (surah: SurahMeta, targetPage?: number) => {
    await stopAudio();
    setSelectedSurah(surah);
    setAyahs([]);
    setTafsirMap({});
    setSurahError('');
    setLoadingSurah(true);
    setActivePageIndex(0);
    saveBookmark({ surahNumber: surah.number, page: targetPage });

    try {
      const textCachePath = `${FileSystem.documentDirectory || ''}quran-text/surah-${surah.number}.json`;
      const [quranRes, tafsirRes] = await Promise.allSettled([
        fetch(`https://api.alquran.cloud/v1/surah/${surah.number}/quran-uthmani`).then((r) => {
          if (!r.ok) throw new Error('HTTP');
          return r.json();
        }),
        fetch(`https://api.alquran.cloud/v1/surah/${surah.number}/ar.muyassar`).then((r) => (r.ok ? r.json() : null)),
      ]);

      let rawAyahs: AyahItem[] = [];
      if (quranRes.status === 'fulfilled') {
        rawAyahs = ((quranRes.value as { data?: { ayahs?: AyahItem[] } })?.data?.ayahs ?? []).map((a) => ({
          ...a,
          text: cleanAyahText(a.text, surah.number, a.numberInSurah),
        }));
        if (rawAyahs.length) {
          void FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory || ''}quran-text/`, { intermediates: true })
            .then(() => FileSystem.writeAsStringAsync(textCachePath, JSON.stringify(rawAyahs)))
            .catch(() => {});
        }
      } else {
        // Offline fallback: load cached Surah text from phone storage if previously opened
        const cachedInfo = await FileSystem.getInfoAsync(textCachePath).catch(() => ({ exists: false }));
        if (cachedInfo.exists) {
          const cachedRaw = await FileSystem.readAsStringAsync(textCachePath);
          rawAyahs = JSON.parse(cachedRaw) as AyahItem[];
        }
      }
      if (!rawAyahs.length) throw new Error('Empty');
      setAyahs(rawAyahs);

      if (targetPage) {
        const distinctPages = Array.from(new Set(rawAyahs.map((a) => a.page || 1)));
        const idx = distinctPages.indexOf(targetPage);
        if (idx >= 0) setActivePageIndex(idx);
      }

      if (tafsirRes.status === 'fulfilled' && tafsirRes.value) {
        const tList = (tafsirRes.value as { data?: { ayahs?: Array<{ numberInSurah: number; text: string }> } })?.data?.ayahs ?? [];
        const map: Record<number, string> = {};
        for (const item of tList) {
          map[item.numberInSurah] = item.text;
        }
        setTafsirMap(map);
      }
    } catch {
      setSurahError(
        locale === 'ar'
          ? 'تعذر تحميل آيات السورة الآن — تحقق من اتصال الإنترنت وحاول مجدداً.'
          : 'Unable to load verses right now — please check your internet connection.'
      );
    } finally {
      setLoadingSurah(false);
    }
  }, [locale, stopAudio]);

  // Group ayahs into authentic Madinah Mushaf pages
  const mushafPages = useMemo(() => {
    const map = new Map<number, AyahItem[]>();
    for (const a of ayahs) {
      const p = a.page || 1;
      const arr = map.get(p) ?? [];
      arr.push(a);
      map.set(p, arr);
    }
    return Array.from(map.entries()).map(([pageNum, list]) => ({
      pageNum,
      juz: list[0]?.juz || selectedSurah?.juz || 1,
      ayahs: list,
    }));
  }, [ayahs, selectedSurah?.juz]);

  const currentPageObj = mushafPages[activePageIndex] || mushafPages[0] || null;

  const playSequenceFrom = useCallback(
    async (ayah: AyahItem, autoAdvanceList: AyahItem[] | undefined, sessionId: number) => {
      if (sessionId !== playbackSessionIdRef.current) return;

      await unloadCurrentSound();
      if (sessionId !== playbackSessionIdRef.current) return;

      setPlayingAyahNum(ayah.number);
      setLoadingAudioNum(ayah.number);
      setCurrentRepeat(1);

      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        if (sessionId !== playbackSessionIdRef.current) return;

        const surahNum = selectedSurahRef.current?.number || 1;
        const localPath = getOfflineAyahPath(reciterRef.current, surahNum, ayah.numberInSurah);
        const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
        const audioUri = localInfo.exists
          ? localPath
          : buildAyahAudioUrl(reciterRef.current, surahNum, ayah);
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: false });

        // Critical guard: if user switched reciter / tapped stop / chose another ayah during load, kill this sound immediately!
        if (sessionId !== playbackSessionIdRef.current) {
          try {
            await sound.unloadAsync();
          } catch { /* ignore */ }
          return;
        }

        soundRef.current = sound;
        setLoadingAudioNum(null);

        let playedTimes = 1;
        let handlingFinish = false;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (sessionId !== playbackSessionIdRef.current) return;
          if (!status.isLoaded || !status.didJustFinish || handlingFinish) return;
          handlingFinish = true;

          const targetRepeats = Math.max(1, repeatCountRef.current);
          if (playedTimes < targetRepeats) {
            playedTimes += 1;
            setCurrentRepeat(playedTimes);
            void sound
              .setPositionAsync(0)
              .then(() => {
                if (sessionId !== playbackSessionIdRef.current) return;
                handlingFinish = false;
                return sound.playAsync();
              })
              .catch(() => {
                if (sessionId === playbackSessionIdRef.current) void stopAudio();
              });
            return;
          }

          // Completed all repeats for this Ayah -> smoothly advance to next Ayah without flickering button state!
          if (autoAdvanceList) {
            const idx = autoAdvanceList.findIndex((x) => x.number === ayah.number);
            if (idx >= 0 && idx + 1 < autoAdvanceList.length) {
              void playSequenceFrom(autoAdvanceList[idx + 1], autoAdvanceList, sessionId);
              return;
            }
          }

          // Finished the whole page / surah cleanly
          void stopAudio();
        });

        await sound.playAsync();
      } catch {
        if (sessionId === playbackSessionIdRef.current) {
          await stopAudio();
        }
      }
    },
    [stopAudio, unloadCurrentSound]
  );

  const playAyah = useCallback(
    async (ayah: AyahItem, autoAdvanceList?: AyahItem[]) => {
      if (isPlayingSequence && playingAyahNum === ayah.number) {
        await stopAudio();
        return;
      }
      // Start a brand-new exclusive playback session
      playbackSessionIdRef.current += 1;
      const newSessionId = playbackSessionIdRef.current;
      setIsPlayingSequence(true);
      await playSequenceFrom(ayah, autoAdvanceList, newSessionId);
    },
    [isPlayingSequence, playSequenceFrom, playingAyahNum, stopAudio]
  );

  useEffect(() => {
    downloadCancelledRef.current = true;
    setDownloadingOffline(false);
    if (!selectedSurah || !ayahs.length) {
      setIsSurahOffline(false);
      return;
    }
    let active = true;
    const lastAyah = ayahs[ayahs.length - 1];
    const checkPath = getOfflineAyahPath(reciter, selectedSurah.number, lastAyah.numberInSurah);
    void FileSystem.getInfoAsync(checkPath)
      .then((info) => {
        if (active) setIsSurahOffline(Boolean(info.exists));
      })
      .catch(() => {
        if (active) setIsSurahOffline(false);
      });
    return () => {
      active = false;
    };
  }, [ayahs, reciter, selectedSurah]);

  const handleDownloadSurahOffline = async () => {
    if (!selectedSurah || !ayahs.length) return;
    if (downloadingOffline) {
      downloadCancelledRef.current = true;
      setDownloadingOffline(false);
      return;
    }

    const dir = getOfflineSurahDir(reciter, selectedSurah.number);
    if (isSurahOffline) {
      try {
        await FileSystem.deleteAsync(dir, { idempotent: true });
        setIsSurahOffline(false);
      } catch { /* ignore */ }
      return;
    }

    downloadCancelledRef.current = false;
    setDownloadingOffline(true);
    setDownloadProgress({ done: 0, total: ayahs.length });

    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      let completed = 0;
      const batchSize = 4;

      for (let i = 0; i < ayahs.length; i += batchSize) {
        if (downloadCancelledRef.current) return;
        const batch = ayahs.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (a) => {
            if (downloadCancelledRef.current) return;
            const dest = getOfflineAyahPath(reciter, selectedSurah.number, a.numberInSurah);
            const existing = await FileSystem.getInfoAsync(dest);
            if (!existing.exists) {
              const url = buildAyahAudioUrl(reciter, selectedSurah.number, a);
              await FileSystem.downloadAsync(url, dest);
            }
            completed += 1;
            if (!downloadCancelledRef.current) {
              setDownloadProgress({ done: completed, total: ayahs.length });
            }
          })
        );
      }

      if (!downloadCancelledRef.current) {
        setIsSurahOffline(true);
      }
    } catch {
      setIsSurahOffline(false);
    } finally {
      setDownloadingOffline(false);
    }
  };

  const cycleTheme = () => {
    setReaderTheme((prev) => (prev === 'parchment' ? 'night' : prev === 'night' ? 'white' : 'parchment'));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.nameAr.includes(q)
        || s.nameEn.toLowerCase().includes(q)
        || String(s.number) === q
    );
  }, [search]);

  const bookmarkedSurah = bookmark ? SURAHS.find((s) => s.number === bookmark.surahNumber) : null;
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  // ==================== AUTHENTIC MUSHAF READER VIEW ====================
  if (selectedSurah) {
    const isNight = readerTheme === 'night';
    const isWhite = readerTheme === 'white';
    const pageBg = isNight ? '#0B1713' : isWhite ? '#F7F7F5' : '#F3E9D2';
    const sheetBg = isNight ? '#10231C' : isWhite ? '#FFFFFF' : '#FCF7EA';
    const textColor = isNight ? '#F4EFE1' : '#1A241E';
    const goldColor = isNight ? '#E6C682' : '#9B7225';
    const borderColor = isNight ? 'rgba(212,175,107,0.36)' : '#D5B87A';

    const prevSurah = SURAHS.find((s) => s.number === selectedSurah.number - 1) || null;
    const nextSurah = SURAHS.find((s) => s.number === selectedSurah.number + 1) || null;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <IslamicHero
          title={`سورة ${selectedSurah.nameAr}`}
          subtitle={
            currentPageObj
              ? `صفحة ${toArabicNum(currentPageObj.pageNum)} • الجزء ${toArabicNum(currentPageObj.juz)} • ${toArabicNum(selectedSurah.ayahs)} آية`
              : `${toArabicNum(selectedSurah.ayahs)} آية • الجزء ${toArabicNum(selectedSurah.juz)}`
          }
          isRTL={isRTL}
          onBack={() => {
            void stopAudio();
            setSelectedSurah(null);
          }}
          compact
          rightSlot={
            <View style={styles.fontControls}>
              <Pressable onPress={cycleTheme} style={styles.fontBtn} accessibilityRole="button">
                {isNight ? <Sun size={17} color={colors.goldBright} /> : <Moon size={17} color={colors.goldBright} />}
              </Pressable>
              <Pressable onPress={() => setFontSize((s) => Math.max(19, s - 2))} style={styles.fontBtn}>
                <Minus size={16} color={colors.goldBright} />
              </Pressable>
              <Pressable onPress={() => setFontSize((s) => Math.min(36, s + 2))} style={styles.fontBtn}>
                <Plus size={16} color={colors.goldBright} />
              </Pressable>
            </View>
          }
        />

        {/* Reader Mode Bar + Reciter Strip */}
        <View style={[styles.readerToolbar, isNight && styles.readerToolbarNight]}>
          <View style={[styles.modeSwitch, { flexDirection: rowDir }]}>
            <Pressable
              onPress={() => setReaderMode('mushaf')}
              style={[styles.modePill, readerMode === 'mushaf' && styles.modePillActive]}
            >
              <BookOpen size={14} color={readerMode === 'mushaf' ? colors.white : colors.emeraldDark} />
              <Text style={[styles.modePillText, readerMode === 'mushaf' && styles.modePillTextActive]}>
                صفحات المصحف
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setReaderMode('verses')}
              style={[styles.modePill, readerMode === 'verses' && styles.modePillActive]}
            >
              <List size={14} color={readerMode === 'verses' ? colors.white : colors.emeraldDark} />
              <Text style={[styles.modePillText, readerMode === 'verses' && styles.modePillTextActive]}>
                آية بآية (صوت وتفسير)
              </Text>
            </Pressable>
          </View>

          {/* Sleek Reciter Picker Dropdown + Contextual Action */}
          <View style={[styles.controlsRow, { flexDirection: rowDir }]}>
            <Pressable
              onPress={() => setReciterModalOpen(true)}
              style={({ pressed }) => [
                styles.reciterSelector,
                { flexDirection: rowDir },
                isNight && styles.reciterSelectorNight,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.reciterSelectorIcon}>
                <Volume2 size={15} color={colors.goldDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reciterSelectorLabel, { textAlign: align }]}>
                  {locale === 'ar' ? 'القارئ' : 'Reciter'}
                </Text>
                <Text
                  style={[
                    styles.reciterSelectorName,
                    { textAlign: align },
                    isNight && { color: colors.textInverse },
                  ]}
                  numberOfLines={1}
                >
                  {locale === 'ar' ? activeReciter.shortAr : activeReciter.en}
                </Text>
              </View>
              <ChevronDown size={16} color={isNight ? colors.goldBright : colors.emeraldDark} />
            </Pressable>

            <Pressable
              onPress={() => void handleDownloadSurahOffline()}
              style={[
                styles.offlineBtn,
                isSurahOffline && styles.offlineBtnDone,
                downloadingOffline && styles.offlineBtnActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'تحميل السورة بدون نت' : 'Download offline'}
            >
              {downloadingOffline ? (
                <Text style={styles.offlineProgressText}>
                  {toArabicNum(downloadProgress.done)}/{toArabicNum(downloadProgress.total)}
                </Text>
              ) : isSurahOffline ? (
                <CheckCircle2 size={17} color={colors.white} />
              ) : (
                <Download size={17} color={colors.emeraldDark} />
              )}
            </Pressable>

            {readerMode === 'verses' ? (
              <Pressable
                onPress={() => setShowTafsir((v) => !v)}
                style={[
                  styles.tafsirToggleBtn,
                  showTafsir && styles.tafsirToggleBtnActive,
                ]}
                accessibilityRole="button"
              >
                <Sparkles size={14} color={showTafsir ? colors.emeraldDeep : colors.emeraldDark} />
                <Text style={[styles.tafsirToggleText, showTafsir && styles.tafsirToggleTextActive]}>
                  {locale === 'ar' ? 'التفسير الميسر' : 'Tafsir'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  const firstAyah = currentPageObj?.ayahs?.[0];
                  if (isPlayingSequence) void stopAudio();
                  else if (firstAyah && currentPageObj) void playAyah(firstAyah, currentPageObj.ayahs);
                }}
                style={[
                  styles.tafsirToggleBtn,
                  isPlayingSequence && styles.tafsirToggleBtnActive,
                ]}
                accessibilityRole="button"
              >
                {isPlayingSequence ? (
                  <Pause size={14} color={colors.emeraldDeep} />
                ) : (
                  <Play size={14} color={colors.emeraldDark} />
                )}
                <Text style={[styles.tafsirToggleText, isPlayingSequence && styles.tafsirToggleTextActive]}>
                  {isPlayingSequence
                    ? repeatCount > 1
                      ? `${toArabicNum(currentRepeat)}/${toArabicNum(repeatCount)}`
                      : (locale === 'ar' ? 'إيقاف' : 'Stop')
                    : (locale === 'ar' ? 'تلاوة' : 'Listen')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Memorization Repeat Counter Bar (1x / 2x / 3x / 5x / 7x / 10x per Ayah) */}
          <View style={[styles.repeatRow, { flexDirection: rowDir }]}>
            <View style={[styles.repeatLabelWrap, { flexDirection: rowDir }]}>
              <Repeat size={13} color={isNight ? colors.goldBright : colors.emerald} />
              <Text style={[styles.repeatLabel, isNight && { color: colors.mint }]}>
                {locale === 'ar' ? 'تكرار الآية للحفظ:' : 'Repeat Ayah:'}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.repeatChips}>
              {REPEAT_OPTIONS.map((cnt) => {
                const active = repeatCount === cnt;
                return (
                  <Pressable
                    key={cnt}
                    onPress={() => setRepeatCount(cnt)}
                    style={[
                      styles.repeatChip,
                      isNight && styles.repeatChipNight,
                      active && styles.repeatChipActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.repeatChipText,
                        isNight && { color: colors.mint },
                        active && styles.repeatChipTextActive,
                      ]}
                    >
                      {toArabicNum(cnt)}×
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={[styles.readerScroll, { backgroundColor: pageBg }]}
          contentContainerStyle={styles.readerContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingSurah ? (
            <View style={styles.readerCenter}>
              <ActivityIndicator size="large" color={isNight ? colors.goldBright : colors.emerald} />
              <Text style={[styles.loadingText, isNight && { color: colors.goldBright }]}>{t.common.loading}</Text>
            </View>
          ) : surahError ? (
            <StateView
              mode="error"
              title={surahError}
              actionLabel={t.common.retry}
              onAction={() => void openSurah(selectedSurah)}
            />
          ) : readerMode === 'mushaf' && currentPageObj ? (
            <>
              {/* Authentic Double-Bordered Madinah Mushaf Parchment Page */}
              <View style={[styles.mushafOuterFrame, { backgroundColor: sheetBg, borderColor }]}>
                <View style={[styles.mushafInnerFrame, { borderColor }]}>
                  {activePageIndex === 0 ? (
                    <>
                      <SurahCartouche surah={selectedSurah} night={isNight} />
                      {selectedSurah.number !== 1 && selectedSurah.number !== 9 ? (
                        <Text style={[styles.basmalah, { color: isNight ? colors.goldBright : colors.emeraldDark }]}>
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  <Text
                    style={[
                      styles.mushafParagraph,
                      {
                        color: textColor,
                        fontSize,
                        lineHeight: fontSize * 2.15,
                      },
                    ]}
                  >
                    {currentPageObj.ayahs.map((a) => (
                      <Text
                        key={a.number}
                        onPress={() => void playAyah(a, currentPageObj.ayahs)}
                        style={
                          playingAyahNum === a.number
                            ? { backgroundColor: isNight ? 'rgba(212,175,107,0.22)' : 'rgba(15,107,79,0.12)' }
                            : undefined
                        }
                      >
                        {a.text}{' '}
                        <Text style={[styles.verseRosette, { color: goldColor, fontSize: fontSize * 0.84 }]}>
                          ﴿{toArabicNum(a.numberInSurah)}﴾{' '}
                        </Text>
                      </Text>
                    ))}
                  </Text>

                  {/* Page Footer Ribbon */}
                  <View style={[styles.pageFooter, { borderTopColor: borderColor }]}>
                    <Text style={[styles.pageFooterText, { color: goldColor }]}>
                      الجزء {toArabicNum(currentPageObj.juz)}
                    </Text>
                    <View style={[styles.pageNumPill, { borderColor }]}>
                      <Text style={[styles.pageNumText, { color: isNight ? colors.goldBright : colors.emeraldDark }]}>
                        {toArabicNum(currentPageObj.pageNum)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        const firstAyah = currentPageObj.ayahs[0];
                        if (isPlayingSequence) void stopAudio();
                        else if (firstAyah) void playAyah(firstAyah, currentPageObj.ayahs);
                      }}
                      style={styles.playPageBtn}
                    >
                      {isPlayingSequence ? (
                        <Pause size={14} color={colors.emerald} />
                      ) : (
                        <Play size={14} color={colors.emerald} />
                      )}
                      <Text style={styles.playPageText}>
                        {isPlayingSequence
                          ? repeatCount > 1
                            ? `إيقاف (${toArabicNum(currentRepeat)}/${toArabicNum(repeatCount)})`
                            : 'إيقاف'
                          : 'استماع للصفحة'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Page Pagination Controls */}
              {mushafPages.length > 1 ? (
                <View style={[styles.pagerRow, { flexDirection: rowDir }]}>
                  <Pressable
                    disabled={activePageIndex === 0}
                    onPress={() => {
                      const nextIdx = Math.max(0, activePageIndex - 1);
                      setActivePageIndex(nextIdx);
                      saveBookmark({ surahNumber: selectedSurah.number, page: mushafPages[nextIdx]?.pageNum });
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    style={[styles.pagerBtn, activePageIndex === 0 && styles.pagerDisabled]}
                  >
                    <ChevronRight size={18} color={colors.emeraldDark} />
                    <Text style={styles.pagerText}>الصفحة السابقة</Text>
                  </Pressable>

                  <Text style={[styles.pagerCounter, isNight && { color: colors.goldBright }]}>
                    {toArabicNum(activePageIndex + 1)} / {toArabicNum(mushafPages.length)}
                  </Text>

                  <Pressable
                    disabled={activePageIndex >= mushafPages.length - 1}
                    onPress={() => {
                      const nextIdx = Math.min(mushafPages.length - 1, activePageIndex + 1);
                      setActivePageIndex(nextIdx);
                      saveBookmark({ surahNumber: selectedSurah.number, page: mushafPages[nextIdx]?.pageNum });
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    style={[styles.pagerBtn, activePageIndex >= mushafPages.length - 1 && styles.pagerDisabled]}
                  >
                    <Text style={styles.pagerText}>الصفحة التالية</Text>
                    <ChevronLeft size={18} color={colors.emeraldDark} />
                  </Pressable>
                </View>
              ) : null}

              {/* Surah Navigation */}
              <View style={[styles.surahNavRow, { flexDirection: rowDir }]}>
                {prevSurah ? (
                  <Pressable onPress={() => void openSurah(prevSurah)} style={styles.surahNavBtn}>
                    <Text style={styles.surahNavLabel}>السورة السابقة</Text>
                    <Text style={styles.surahNavName}>{prevSurah.nameAr}</Text>
                  </Pressable>
                ) : <View style={{ flex: 1 }} />}
                {nextSurah ? (
                  <Pressable onPress={() => void openSurah(nextSurah)} style={styles.surahNavBtn}>
                    <Text style={styles.surahNavLabel}>السورة التالية</Text>
                    <Text style={styles.surahNavName}>{nextSurah.nameAr}</Text>
                  </Pressable>
                ) : <View style={{ flex: 1 }} />}
              </View>
            </>
          ) : (
            /* Verse-by-Verse Interactive Mode (Audio + Tafsir + Bookmark) */
            <View style={{ gap: spacing.md }}>
              <SurahCartouche surah={selectedSurah} night={isNight} />
              {selectedSurah.number !== 1 && selectedSurah.number !== 9 ? (
                <Text style={[styles.basmalah, { color: isNight ? colors.goldBright : colors.emeraldDark }]}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </Text>
              ) : null}

              {ayahs.map((a) => {
                const isPlaying = playingAyahNum === a.number;
                const isLoadingAud = loadingAudioNum === a.number;
                const isBookmarked =
                  bookmark?.surahNumber === selectedSurah.number
                  && bookmark?.ayahNumberInSurah === a.numberInSurah;

                return (
                  <View
                    key={a.number}
                    style={[
                      styles.verseCard,
                      { backgroundColor: sheetBg, borderColor: isPlaying ? colors.emerald : borderColor },
                    ]}
                  >
                    <View style={[styles.verseCardTop, { flexDirection: rowDir }]}>
                      <View style={[styles.verseLeftCluster, { flexDirection: rowDir }]}>
                        <View style={styles.ayahNumBadge}>
                          <Text style={styles.ayahNumText}>{toArabicNum(a.numberInSurah)}</Text>
                        </View>
                        {isPlaying && repeatCount > 1 ? (
                          <View style={styles.liveRepeatPill}>
                            <Repeat size={11} color={colors.emeraldDeep} />
                            <Text style={styles.liveRepeatText}>
                              تكرار {toArabicNum(currentRepeat)} / {toArabicNum(repeatCount)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => void playAyah(a, ayahs)}
                          style={[styles.verseIconBtn, isPlaying && styles.verseIconBtnActive]}
                        >
                          {isLoadingAud ? (
                            <ActivityIndicator size="small" color={colors.emerald} />
                          ) : isPlaying ? (
                            <Pause size={15} color={colors.white} />
                          ) : (
                            <Play size={15} color={colors.emerald} />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            saveBookmark({
                              surahNumber: selectedSurah.number,
                              ayahNumberInSurah: a.numberInSurah,
                              page: a.page,
                            })
                          }
                          style={[styles.verseIconBtn, isBookmarked && styles.verseIconBtnGold]}
                        >
                          <Bookmark
                            size={15}
                            color={isBookmarked ? colors.white : colors.goldDark}
                            fill={isBookmarked ? colors.white : 'none'}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.verseText,
                        { color: textColor, fontSize, lineHeight: fontSize * 2.05 },
                      ]}
                    >
                      {a.text}{' '}
                      <Text style={[styles.verseRosette, { color: goldColor, fontSize: fontSize * 0.82 }]}>
                        ﴿{toArabicNum(a.numberInSurah)}﴾
                      </Text>
                    </Text>

                    {showTafsir && tafsirMap[a.numberInSurah] ? (
                      <View style={[styles.tafsirBox, isNight && styles.tafsirBoxNight]}>
                        <Text style={styles.tafsirLabel}>التفسير الميسر</Text>
                        <Text style={[styles.tafsirText, isNight && { color: colors.mint }]}>
                          {tafsirMap[a.numberInSurah]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Premium Reciter Picker Bottom Sheet Modal */}
        <Modal
          visible={reciterModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setReciterModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { textAlign: align }]}>
                    {locale === 'ar' ? 'اختر القارئ المفضل' : 'Choose Your Reciter'}
                  </Text>
                  <Text style={[styles.modalSub, { textAlign: align }]}>
                    {locale === 'ar'
                      ? 'سيتم حفظ اختيارك تلقائياً لكل السور'
                      : 'Your selection will be saved automatically'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReciterModalOpen(false)}
                  style={styles.modalCloseBtn}
                  accessibilityRole="button"
                >
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
                  {RECITERS.map((r) => {
                    const active = r.id === reciter;
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => selectReciter(r.id)}
                        style={({ pressed }) => [
                          styles.reciterRow,
                          { flexDirection: rowDir },
                          active && styles.reciterRowActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.reciterAvatar, active && styles.reciterAvatarActive]}>
                          <Volume2 size={18} color={active ? colors.goldBright : colors.emerald} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reciterFullName, { textAlign: align }]}>
                            {locale === 'ar' ? r.ar : r.en}
                          </Text>
                          <Text style={[styles.reciterStyleText, { textAlign: align }]}>
                            {locale === 'ar' ? r.styleAr : r.styleEn}
                          </Text>
                        </View>
                        {active ? (
                          <View style={styles.reciterCheck}>
                            <Check size={15} color={colors.white} strokeWidth={3} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==================== SURAH INDEX & ADHKAR HOME ====================
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'المصحف الشريف والأذكار' : 'Holy Mushaf & Adhkar'}
        subtitle={locale === 'ar' ? 'مصحف المدينة بخط أميري العثماني مع التلاوة الصوتية والتفسير الميسر.' : 'Madinah Mushaf with classical script, audio recitation & Tafsir.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <View style={styles.switchWrap}>
        <View style={[styles.switchBar, { flexDirection: rowDir }]}>
          <Pressable
            onPress={() => setHomeTab('surahs')}
            style={[styles.switchBtn, homeTab === 'surahs' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, homeTab === 'surahs' && styles.switchTextActive]}>
              {locale === 'ar' ? 'سور القرآن (١١٤)' : 'Surahs (114)'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setHomeTab('adhkar')}
            style={[styles.switchBtn, homeTab === 'adhkar' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, homeTab === 'adhkar' && styles.switchTextActive]}>
              {locale === 'ar' ? 'أذكار ومسبحة' : 'Adhkar & Tasbeeh'}
            </Text>
          </Pressable>
        </View>
      </View>

      {homeTab === 'surahs' ? (
        <View style={styles.body}>
          {bookmarkedSurah ? (
            <Pressable
              onPress={() => void openSurah(bookmarkedSurah, bookmark?.page)}
              style={[styles.bookmarkCard, { flexDirection: rowDir }]}
            >
              <View style={styles.bookmarkIcon}>
                <Bookmark size={18} color={colors.goldDark} fill={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookmarkLabel, { textAlign: align }]}>
                  {locale === 'ar' ? 'متابعة القراءة من آخر موضع' : 'Continue Reading'}
                </Text>
                <Text style={[styles.bookmarkTitle, { textAlign: align }]}>
                  سورة {bookmarkedSurah.nameAr}
                  {bookmark?.page ? ` • صفحة ${toArabicNum(bookmark.page)}` : ` • الجزء ${toArabicNum(bookmarkedSurah.juz)}`}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={[styles.searchBox, { flexDirection: rowDir }]}>
            <Search size={18} color={colors.emerald} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={locale === 'ar' ? 'ابحث باسم السورة أو رقمها...' : 'Search surah name or number...'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { textAlign: align }]}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.number)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void openSurah(item)}
                style={({ pressed }) => [styles.surahRow, { flexDirection: rowDir }, pressed && styles.pressed]}
              >
                <View style={styles.numBadge}>
                  <Text style={styles.numText}>{toArabicNum(item.number)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.surahAr, { textAlign: align }]}>سورة {item.nameAr}</Text>
                  <Text style={[styles.surahMeta, { textAlign: align }]}>
                    {item.revelation === 'meccan' ? 'مكية' : 'مدنية'} • {toArabicNum(item.ayahs)} آية • الجزء {toArabicNum(item.juz)}
                  </Text>
                </View>
                <Text style={styles.surahEn}>{item.nameEn}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {ADHKAR_LIST.map((dhikr) => {
            const count = tasbeehCounts[dhikr.id] || 0;
            const done = count >= dhikr.target;
            return (
              <Pressable
                key={dhikr.id}
                onPress={() =>
                  setTasbeehCounts((prev) => ({ ...prev, [dhikr.id]: (prev[dhikr.id] || 0) + 1 }))
                }
                style={({ pressed }) => [
                  styles.dhikrCard,
                  done && styles.dhikrCardDone,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dhikrText}>{dhikr.ar}</Text>
                <View style={[styles.dhikrFooter, { flexDirection: rowDir }]}>
                  <View style={[styles.countPill, done && styles.countPillDone]}>
                    <Text style={[styles.countPillText, done && styles.countPillTextDone]}>
                      {toArabicNum(count)} / {toArabicNum(dhikr.target)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setTasbeehCounts((prev) => ({ ...prev, [dhikr.id]: 0 }))}
                    hitSlop={10}
                    style={styles.resetBtn}
                  >
                    <RotateCcw size={15} color={colors.textTertiary} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  switchWrap: { backgroundColor: colors.ivory, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  switchBar: {
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
    ...shadows.card,
  },
  switchBtn: {
    flex: 1,
    minHeight: TOUCH_MIN - 6,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnActive: { backgroundColor: colors.emerald },
  switchText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  switchTextActive: { color: colors.textInverse },
  body: { flex: 1, backgroundColor: colors.ivory, padding: spacing.lg, gap: spacing.md },
  bookmarkCard: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  bookmarkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.goldDark },
  bookmarkTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  searchBox: {
    minHeight: TOUCH_MIN,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  surahRow: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.86 },
  numBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.borderMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 15, fontFamily: fonts.quranBold, color: colors.emeraldDark },
  surahAr: { fontSize: 18, fontFamily: fonts.quranBold, color: colors.textPrimary },
  surahMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  surahEn: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textTertiary },
  fontControls: { flexDirection: 'row', gap: spacing.xs },
  fontBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,107,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerToolbar: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.sm,
  },
  readerToolbarNight: {
    backgroundColor: '#0E2019',
    borderBottomColor: 'rgba(212,175,107,0.22)',
  },
  modeSwitch: { gap: spacing.sm },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
  },
  modePillActive: { backgroundColor: colors.emerald },
  modePillText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  modePillTextActive: { color: colors.white },
  controlsRow: { gap: spacing.sm, alignItems: 'center' },
  reciterSelector: {
    flex: 1,
    minHeight: 46,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    alignItems: 'center',
    gap: spacing.sm,
  },
  reciterSelectorNight: {
    backgroundColor: '#132B23',
    borderColor: 'rgba(212,175,107,0.35)',
  },
  reciterSelectorIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reciterSelectorLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    lineHeight: 13,
  },
  reciterSelectorName: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDark,
    lineHeight: 18,
  },
  tafsirToggleBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1.2,
    borderColor: colors.borderMint,
  },
  tafsirToggleBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.goldDark,
  },
  tafsirToggleText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.emeraldDark,
  },
  tafsirToggleTextActive: {
    color: colors.emeraldDeep,
  },
  offlineBtn: {
    minWidth: 46,
    height: 46,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1.2,
    borderColor: colors.borderMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBtnDone: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  offlineBtnActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },
  offlineProgressText: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDark,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.58)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  modalSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reciterRow: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    borderWidth: 1.2,
    borderColor: colors.borderSoft,
  },
  reciterRowActive: {
    backgroundColor: colors.emeraldSoft,
    borderColor: colors.emerald,
  },
  reciterAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reciterAvatarActive: {
    backgroundColor: colors.emeraldDeep,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  reciterFullName: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
  },
  reciterStyleText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  reciterCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerScroll: { flex: 1 },
  readerContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  readerCenter: { paddingVertical: 64, alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: 14, fontFamily: fonts.bold, color: colors.emeraldDark },
  mushafOuterFrame: {
    borderRadius: radius.xl,
    borderWidth: 2,
    padding: 5,
    ...shadows.elevated,
  },
  mushafInnerFrame: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cartoucheWrap: {
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  cartoucheTitle: {
    fontSize: 21,
    fontFamily: fonts.quranBold,
    color: colors.goldBright,
    lineHeight: 28,
  },
  cartoucheSub: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.mint,
  },
  basmalah: {
    fontSize: 24,
    fontFamily: fonts.quranBold,
    textAlign: 'center',
    marginVertical: 4,
  },
  mushafParagraph: {
    fontFamily: fonts.quran,
    textAlign: 'justify',
    writingDirection: 'rtl',
  },
  verseRosette: {
    fontFamily: fonts.quranBold,
  },
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
  },
  pageFooterText: { fontSize: 12, fontFamily: fonts.bold },
  pageNumPill: {
    minWidth: 42,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pageNumText: { fontSize: 15, fontFamily: fonts.bold, lineHeight: 20, includeFontPadding: false },
  repeatRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 2,
  },
  repeatLabelWrap: { alignItems: 'center', gap: 4 },
  repeatLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  repeatChips: { gap: 6 },
  repeatChip: {
    minWidth: 38,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatChipNight: {
    backgroundColor: '#132B23',
    borderColor: 'rgba(212,175,107,0.32)',
  },
  repeatChipActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  repeatChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  repeatChipTextActive: { color: colors.white },
  verseLeftCluster: { alignItems: 'center', gap: 8 },
  liveRepeatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveRepeatText: { fontSize: 11, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  playPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  playPageText: { fontSize: 11, fontFamily: fonts.bold, color: colors.emeraldDark },
  pagerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderMint,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...shadows.card,
  },
  pagerDisabled: { opacity: 0.4 },
  pagerText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  pagerCounter: { fontSize: 13, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  surahNavRow: { gap: spacing.md },
  surahNavBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
    ...shadows.card,
  },
  surahNavLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
  surahNavName: { fontSize: 16, fontFamily: fonts.quranBold, color: colors.emeraldDark },
  verseCard: {
    borderRadius: radius.lg,
    borderWidth: 1.2,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  verseCardTop: { alignItems: 'center', justifyContent: 'space-between' },
  ayahNumBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ayahNumText: { fontSize: 14, fontFamily: fonts.quranBold, color: colors.emeraldDark },
  verseIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseIconBtnActive: { backgroundColor: colors.emerald },
  verseIconBtnGold: { backgroundColor: colors.goldDark },
  verseText: {
    fontFamily: fonts.quran,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tafsirBox: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    marginTop: 4,
  },
  tafsirBoxNight: { backgroundColor: 'rgba(15,107,79,0.22)' },
  tafsirLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.goldDark, textAlign: 'right' },
  tafsirText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'right', lineHeight: 21 },
  dhikrCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  dhikrCardDone: { borderColor: colors.emerald, backgroundColor: colors.emeraldSoft },
  dhikrText: { fontSize: 22, fontFamily: fonts.quranBold, color: colors.emeraldDark, textAlign: 'center', lineHeight: 38 },
  dhikrFooter: { alignItems: 'center', justifyContent: 'space-between' },
  countPill: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  countPillDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  countPillText: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.goldDark },
  countPillTextDone: { color: colors.white },
  resetBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
