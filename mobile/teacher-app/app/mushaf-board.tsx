import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { swrCache } from '../src/lib/cache';
import { ActiveStudent } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SurahPickerModal } from '../src/components/SurahPickerModal';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

type AnnotationType = 'memorization' | 'tajweed' | 'tashkeel';
type JuzStatus = 'not_started' | 'in_progress' | 'memorized' | 'mastered';

interface JuzItem {
  juzNumber: number;
  status: JuzStatus;
  certifiedByName?: string;
}

interface AnnotationItem {
  _id: string;
  surahNumber: number;
  surahName?: string;
  ayahNumber: number;
  wordText?: string;
  type: AnnotationType;
  note?: string;
  resolved?: boolean;
  createdAt?: string;
}

interface MushafProgressPayload {
  khatmahJuz: JuzItem[];
  annotations: AnnotationItem[];
  summary: {
    masteredCount: number;
    memorizedCount: number;
    completionPercent: number;
    openAnnotationsCount: number;
  };
}

const JUZ_CYCLE: JuzStatus[] = ['not_started', 'in_progress', 'memorized', 'mastered'];

function buildEmptyProgress(): MushafProgressPayload {
  return {
    khatmahJuz: Array.from({ length: 30 }).map((_, i) => ({
      juzNumber: i + 1,
      status: 'not_started',
    })),
    annotations: [],
    summary: { masteredCount: 0, memorizedCount: 0, completionPercent: 0, openAnnotationsCount: 0 },
  };
}

export default function TeacherMushafBoardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string }>();
  const { isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [mode, setMode] = useState<'annotations' | 'khatmah'>('annotations');
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(String(params.studentId || ''));
  const [progress, setProgress] = useState<MushafProgressPayload>(buildEmptyProgress);
  const [refreshing, setRefreshing] = useState(false);

  // Add Annotation Form
  const [surahNumber, setSurahNumber] = useState(67);
  const [surahName, setSurahName] = useState('سورة الملك');
  const [ayahNumber, setAyahNumber] = useState('1');
  const [wordText, setWordText] = useState('');
  const [noteType, setNoteType] = useState<AnnotationType>('memorization');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [surahModalOpen, setSurahModalOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true });
        const list = res.students || [];
        setStudents(list);
        if (!selectedStudentId && list[0]?._id) {
          setSelectedStudentId(list[0]._id);
        }
      } catch {
        // Non-blocking
      }
    })();
  }, [selectedStudentId]);

  const loadStudentProgress = useCallback(
    async (sid: string, isRefresh = false) => {
      if (!sid) return;
      if (isRefresh) setRefreshing(true);
      const cacheKey = `mushaf_board_${sid}`;
      const cached = await swrCache.get<MushafProgressPayload>(cacheKey);
      if (cached && !isRefresh) setProgress(cached);

      try {
        const res = await api.get<MushafProgressPayload>(
          `/api/mushaf-progress/student/${encodeURIComponent(sid)}`,
          { auth: true }
        );
        if (res?.khatmahJuz) {
          setProgress(res);
          void swrCache.set(cacheKey, res);
        }
      } catch {
        // Keep local cache if endpoint is still deploying or offline
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedStudentId) {
      void loadStudentProgress(selectedStudentId, false);
    }
  }, [selectedStudentId, loadStudentProgress]);

  const handleAddAnnotation = async () => {
    if (!selectedStudentId || saving) return;
    const ayahNum = Math.max(1, Number(ayahNumber) || 1);
    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const optimistic: AnnotationItem = {
      _id: `local-${Date.now()}`,
      surahNumber,
      surahName,
      ayahNumber: ayahNum,
      wordText: wordText.trim(),
      type: noteType,
      note: note.trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await api.post<MushafProgressPayload>(
        `/api/mushaf-progress/student/${encodeURIComponent(selectedStudentId)}/annotations`,
        {
          surahNumber,
          surahName,
          ayahNumber: ayahNum,
          wordText: wordText.trim(),
          type: noteType,
          note: note.trim(),
        },
        { auth: true }
      );
      if (res?.khatmahJuz) {
        setProgress(res);
        void swrCache.set(`mushaf_board_${selectedStudentId}`, res);
      }
      setWordText('');
      setNote('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Offline / pre-deploy local persistence fallback
      const next: MushafProgressPayload = {
        ...progress,
        annotations: [optimistic, ...progress.annotations],
        summary: {
          ...progress.summary,
          openAnnotationsCount: progress.summary.openAnnotationsCount + 1,
        },
      };
      setProgress(next);
      void swrCache.set(`mushaf_board_${selectedStudentId}`, next);
      setWordText('');
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  const toggleResolve = async (item: AnnotationItem) => {
    if (!selectedStudentId) return;
    const nextResolved = !item.resolved;
    void Haptics.selectionAsync().catch(() => {});
    const updatedList = progress.annotations.map((a) =>
      a._id === item._id ? { ...a, resolved: nextResolved } : a
    );
    const nextState: MushafProgressPayload = {
      ...progress,
      annotations: updatedList,
      summary: {
        ...progress.summary,
        openAnnotationsCount: updatedList.filter((a) => !a.resolved).length,
      },
    };
    setProgress(nextState);
    void swrCache.set(`mushaf_board_${selectedStudentId}`, nextState);

    try {
      await api.patch(
        `/api/mushaf-progress/student/${encodeURIComponent(selectedStudentId)}/annotations/${encodeURIComponent(item._id)}`,
        { resolved: nextResolved },
        { auth: true }
      );
    } catch {
      // Cached locally
    }
  };

  const cycleJuzStatus = async (juz: JuzItem) => {
    if (!selectedStudentId) return;
    const currentIdx = JUZ_CYCLE.indexOf(juz.status);
    const nextStatus = JUZ_CYCLE[(currentIdx + 1) % JUZ_CYCLE.length];
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const updatedJuz = progress.khatmahJuz.map((j) =>
      j.juzNumber === juz.juzNumber ? { ...j, status: nextStatus } : j
    );
    const memorizedCount = updatedJuz.filter((j) => j.status === 'memorized' || j.status === 'mastered').length;
    const masteredCount = updatedJuz.filter((j) => j.status === 'mastered').length;
    const nextState: MushafProgressPayload = {
      ...progress,
      khatmahJuz: updatedJuz,
      summary: {
        ...progress.summary,
        memorizedCount,
        masteredCount,
        completionPercent: Math.round((memorizedCount / 30) * 100),
      },
    };
    setProgress(nextState);
    void swrCache.set(`mushaf_board_${selectedStudentId}`, nextState);

    try {
      await api.put(
        `/api/mushaf-progress/student/${encodeURIComponent(selectedStudentId)}/khatmah/${juz.juzNumber}`,
        { status: nextStatus },
        { auth: true }
      );
    } catch {
      // Cached locally
    }
  };

  const typeMeta = (tp: AnnotationType) => {
    if (tp === 'memorization') return { label: isRTL ? '🔴 خطأ حفظ' : '🔴 Hifz', bg: colors.dangerSoft, color: colors.danger };
    if (tp === 'tajweed') return { label: isRTL ? '🟠 تجويد' : '🟠 Tajweed', bg: colors.warningSoft, color: colors.warning };
    return { label: isRTL ? '🔵 تشكيل' : '🔵 Tashkeel', bg: colors.infoSoft, color: colors.info };
  };

  const juzColors = (st: JuzStatus) => {
    if (st === 'mastered') return { bg: colors.emerald, border: colors.gold, text: colors.white, tag: '🏆' };
    if (st === 'memorized') return { bg: colors.emeraldSoft, border: colors.emerald, text: colors.emeraldDark, tag: '✓' };
    if (st === 'in_progress') return { bg: colors.goldSoft, border: colors.gold, text: colors.goldDark, tag: '◐' };
    return { bg: palette.surfaceAlt, border: palette.border, text: palette.textSecondary, tag: '' };
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={isRTL ? 'مصحف التصحيح وخريطة الختمة' : 'Mushaf Board & Khatmah Map'}
        subtitle={isRTL ? 'سجّل أخطاء الحفظ والتجويد بالألوان واعتمد أجزاء الختمة الـ 30' : 'Color-coded corrections & 30-Juz mastery tracker'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadStudentProgress(selectedStudentId, true)}
            tintColor={colors.emerald}
          />
        }
      >
        {/* Student selector */}
        {students.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { flexDirection: rowDir }]}>
            {students.map((st) => {
              const active = selectedStudentId === st._id;
              return (
                <Pressable
                  key={st._id}
                  onPress={() => setSelectedStudentId(st._id)}
                  style={[styles.studentChip, active && styles.studentChipActive]}
                >
                  <Text style={[styles.studentChipText, active && styles.studentChipTextActive]}>
                    {st.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Mode Toggle */}
        <View style={[styles.segBar, { flexDirection: rowDir, backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable
            onPress={() => setMode('annotations')}
            style={[styles.segBtn, mode === 'annotations' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'annotations' && styles.segTextActive]}>
              {isRTL ? `مصحف التصحيح (${progress.summary.openAnnotationsCount})` : `Corrections (${progress.summary.openAnnotationsCount})`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('khatmah')}
            style={[styles.segBtn, mode === 'khatmah' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'khatmah' && styles.segTextActive]}>
              {isRTL ? `خريطة الختمة (${progress.summary.memorizedCount}/30)` : `Khatmah (${progress.summary.memorizedCount}/30)`}
            </Text>
          </Pressable>
        </View>

        {mode === 'annotations' ? (
          <>
            {/* Quick Add Color-Coded Correction */}
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  {isRTL ? 'إضافة علامة تصحيح على المصحف' : 'Add Mushaf Correction'}
                </Text>
                <Pressable onPress={() => setSurahModalOpen(true)} style={styles.surahBtn}>
                  <BookOpen size={14} color={colors.emeraldDark} />
                  <Text style={styles.surahBtnText}>{surahName}</Text>
                </Pressable>
              </View>

              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {(['memorization', 'tajweed', 'tashkeel'] as const).map((tp) => {
                  const meta = typeMeta(tp);
                  const active = noteType === tp;
                  return (
                    <Pressable
                      key={tp}
                      onPress={() => setNoteType(tp)}
                      style={[
                        styles.typeChip,
                        { backgroundColor: active ? meta.color : meta.bg, borderColor: meta.color },
                      ]}
                    >
                      <Text style={[styles.typeChipText, { color: active ? colors.white : meta.color }]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.twoCol, { flexDirection: rowDir }]}>
                <View style={styles.ayahBox}>
                  <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                    {isRTL ? 'رقم الآية' : 'Ayah #'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                    value={ayahNumber}
                    onChangeText={setAyahNumber}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                    {isRTL ? 'الكلمة أو الموضع' : 'Word / Phrase'}
                  </Text>
                  <TextInput
                    style={[styles.input, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                    value={wordText}
                    onChangeText={setWordText}
                    placeholder={isRTL ? 'مثال: مِن تَفَاوُتٍ' : 'e.g. min tafawut'}
                    placeholderTextColor={palette.textTertiary}
                  />
                </View>
              </View>

              <TextInput
                style={[styles.input, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                value={note}
                onChangeText={setNote}
                placeholder={isRTL ? 'ملاحظة التصحيح (مثال: أطل الغنة حركتين)...' : 'Correction note...'}
                placeholderTextColor={palette.textTertiary}
              />

              <PrimaryButton
                label={isRTL ? 'تثبيت العلامة على مصحف الطالب' : 'Pin Correction on Mushaf'}
                loading={saving}
                onPress={() => void handleAddAnnotation()}
                icon={<Plus size={16} color={colors.textInverse} />}
              />
            </View>

            {/* Existing Annotations (Open first for review!) */}
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { textAlign: align, color: palette.text }]}>
                {isRTL ? 'سجل مواضع المراجعة والتصحيح' : 'Student Review Heatmap'}
              </Text>
              {progress.annotations.length === 0 ? (
                <Text style={[styles.emptyText, { textAlign: align, color: palette.textSecondary }]}>
                  {isRTL ? 'لا توجد ملاحظات مسجلة لهذا الطالب بعد — أضف أول علامة بالأعلى.' : 'No corrections pinned yet.'}
                </Text>
              ) : (
                progress.annotations.map((ann) => {
                  const meta = typeMeta(ann.type);
                  return (
                    <View
                      key={ann._id}
                      style={[
                        styles.annRow,
                        { backgroundColor: palette.surfaceAlt, borderColor: ann.resolved ? colors.borderMint : meta.color },
                        ann.resolved && styles.annResolved,
                      ]}
                    >
                      <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                        <View style={[styles.smallTag, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.smallTagText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                        <Text style={[styles.annLoc, { color: palette.text }]}>
                          {ann.surahName || `سورة ${ann.surahNumber}`} • آية {ann.ayahNumber}
                        </Text>
                      </View>
                      {ann.wordText ? (
                        <Text style={[styles.annWord, { textAlign: align }]}>﴿ {ann.wordText} ﴾</Text>
                      ) : null}
                      {ann.note ? (
                        <Text style={[styles.annNote, { textAlign: align, color: palette.textSecondary }]}>{ann.note}</Text>
                      ) : null}
                      <Pressable
                        onPress={() => void toggleResolve(ann)}
                        style={[styles.resolveBtn, ann.resolved && styles.resolveBtnDone, { flexDirection: rowDir }]}
                      >
                        {ann.resolved ? (
                          <CheckCircle2 size={15} color={colors.emerald} />
                        ) : (
                          <CircleDot size={15} color={colors.goldDark} />
                        )}
                        <Text style={[styles.resolveText, ann.resolved && styles.resolveTextDone]}>
                          {ann.resolved
                            ? (isRTL ? 'تم الإتقان والمراجعة ✓' : 'Mastered ✓')
                            : (isRTL ? 'تحديد كـ «تم الإتقان»' : 'Mark as Mastered')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : (
          /* 30-Juz Visual Khatmah Grid */
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {isRTL ? 'خريطة الختمة التفاعلية (30 جزءاً)' : '30-Juz Interactive Khatmah'}
              </Text>
              <View style={styles.pctBadge}>
                <Sparkles size={13} color={colors.goldDark} />
                <Text style={styles.pctText}>{progress.summary.completionPercent}%</Text>
              </View>
            </View>
            <Text style={[styles.legendText, { textAlign: align, color: palette.textSecondary }]}>
              {isRTL
                ? 'اضغط على أي جزء لتحديث حالته: لم يبدأ ← ◐ قيد الحفظ ← ✓ محفوظ ← 🏆 متقن ومُجاز'
                : 'Tap any Juz to cycle: Not started → In progress → Memorized → Mastered 🏆'}
            </Text>

            <View style={styles.juzGrid}>
              {progress.khatmahJuz.map((juz) => {
                const jc = juzColors(juz.status);
                return (
                  <Pressable
                    key={juz.juzNumber}
                    onPress={() => void cycleJuzStatus(juz)}
                    style={[styles.juzTile, { backgroundColor: jc.bg, borderColor: jc.border }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.juzNum, { color: jc.text }]}>{juz.juzNumber}</Text>
                    <Text style={[styles.juzSub, { color: jc.text }]}>
                      {jc.tag || (isRTL ? 'جزء' : 'Juz')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <SurahPickerModal
        visible={surahModalOpen}
        isRTL={isRTL}
        onClose={() => setSurahModalOpen(false)}
        onSelect={(s) => {
          setSurahNumber(s.number);
          setSurahName(`سورة ${s.nameAr}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  chipRow: { gap: spacing.xs, flexWrap: 'wrap' },
  studentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  studentChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  studentChipTextActive: { color: colors.white },
  segBar: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: colors.emerald },
  segText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  segTextActive: { color: colors.white },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontFamily: fonts.extraBold },
  surahBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  surahBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 12, fontFamily: fonts.bold },
  twoCol: { gap: spacing.sm },
  ayahBox: { width: 88 },
  label: { fontSize: 12, fontFamily: fonts.bold, marginBottom: 4 },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  emptyText: { fontSize: 13, fontFamily: fonts.medium, lineHeight: 21 },
  annRow: { borderRadius: radius.md, borderWidth: 1.2, padding: spacing.md, gap: 6 },
  annResolved: { opacity: 0.65 },
  smallTag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  smallTagText: { fontSize: 11, fontFamily: fonts.bold },
  annLoc: { fontSize: 12, fontFamily: fonts.bold },
  annWord: { fontSize: 18, fontFamily: fonts.quranBold, color: colors.emeraldDark },
  annNote: { fontSize: 13, fontFamily: fonts.medium, lineHeight: 20 },
  resolveBtn: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
  },
  resolveBtnDone: { backgroundColor: colors.emeraldSoft },
  resolveText: { fontSize: 11, fontFamily: fonts.bold, color: colors.goldDark },
  resolveTextDone: { color: colors.emeraldDark },
  pctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pctText: { fontSize: 13, fontFamily: fonts.extraBold, color: colors.goldDark },
  legendText: { fontSize: 12, fontFamily: fonts.medium, lineHeight: 19 },
  juzGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  juzTile: {
    width: '18%',
    minWidth: 54,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzNum: { fontSize: 16, fontFamily: fonts.extraBold },
  juzSub: { fontSize: 10, fontFamily: fonts.bold },
});
