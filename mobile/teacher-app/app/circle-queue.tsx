import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
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
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Users,
} from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { formatSeconds } from '../src/lib/formatters';
import { TeacherCircle } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { ScoreStepper } from '../src/components/ScoreStepper';
import { StateView } from '../src/components/StateView';
import { SurahPickerModal } from '../src/components/SurahPickerModal';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

interface StudentQueueRow {
  studentId: string;
  name: string;
  done: boolean;
  memorization: number;
  tajweed: number;
  surah: string;
  note: string;
}

const TIMER_PRESETS_MIN = [2, 3, 4, 5] as const;

export default function LiveCircleQueueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ circleId?: string }>();
  const { isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [circles, setCircles] = useState<TeacherCircle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState(String(params.circleId || ''));
  const [queue, setQueue] = useState<StudentQueueRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Per-student countdown timer
  const [minutesPerStudent, setMinutesPerStudent] = useState<number>(4);
  const [secondsLeft, setSecondsLeft] = useState<number>(4 * 60);
  const [running, setRunning] = useState(false);
  const [surahModalOpen, setSurahModalOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ circles?: TeacherCircle[] }>('/api/teachers/dashboard/circles', { auth: true });
        const list = res.circles || [];
        setCircles(list);
        if (!selectedCircleId && list[0]?._id) {
          setSelectedCircleId(list[0]._id);
        }
      } catch {
        // Non-blocking
      }
    })();
  }, [selectedCircleId]);

  const activeCircle = useMemo(
    () => circles.find((c) => c._id === selectedCircleId) || circles[0] || null,
    [circles, selectedCircleId]
  );

  useEffect(() => {
    if (!activeCircle) {
      setQueue([]);
      return;
    }
    const rows: StudentQueueRow[] = (activeCircle.students || []).map((st) => ({
      studentId: st._id,
      name: st.name || 'طالب',
      done: false,
      memorization: 5,
      tajweed: 5,
      surah: '',
      note: '',
    }));
    setQueue(rows);
    setActiveIdx(0);
    setRunning(false);
    setSecondsLeft(minutesPerStudent * 60);
  }, [activeCircle, minutesPerStudent]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const currentRow = queue[activeIdx] || null;
  const completedCount = queue.filter((r) => r.done).length;

  const updateCurrent = (patch: Partial<StudentQueueRow>) => {
    setQueue((prev) =>
      prev.map((row, i) => (i === activeIdx ? { ...row, ...patch } : row))
    );
  };

  const markDoneAndNext = () => {
    if (!currentRow) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setQueue((prev) =>
      prev.map((row, i) => (i === activeIdx ? { ...row, done: true } : row))
    );
    setRunning(false);
    setSecondsLeft(minutesPerStudent * 60);
    if (activeIdx + 1 < queue.length) {
      setActiveIdx(activeIdx + 1);
    } else {
      Alert.alert(
        isRTL ? 'أحسنت! اكتمل طابور التسميع 🎉' : 'Queue Complete! 🎉',
        isRTL
          ? `تم تسميع جميع طلاب الحلقة (${queue.length} طالب). يمكنك الآن إنهاء الحصة الجماعية من تبويب الحصص.`
          : `All ${queue.length} students have been evaluated.`
      );
    }
  };

  const selectPresetMinutes = (mins: number) => {
    void Haptics.selectionAsync().catch(() => {});
    setMinutesPerStudent(mins);
    setSecondsLeft(mins * 60);
    setRunning(false);
  };

  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={isRTL ? 'طابور التسميع الحي للحلقة' : 'Live Circle Recitation Queue'}
        subtitle={isRTL ? 'مؤقت ذكي لكل طالب + تقييم سريع + انتقال فوري للطالب التالي' : 'Per-student timer & instant turn rotation'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {circles.length === 0 ? (
          <StateView
            mode="empty"
            title={t.students.emptyCircles}
            description={isRTL ? 'عند إسناد حلقة جماعية لك ستتمكن من إدارة طابور التسميع هنا.' : 'Assigned group circles will appear here.'}
          />
        ) : (
          <>
            {/* Circle selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { flexDirection: rowDir }]}>
              {circles.map((c) => {
                const active = activeCircle?._id === c._id;
                return (
                  <Pressable
                    key={c._id}
                    onPress={() => setSelectedCircleId(c._id)}
                    style={[styles.circleChip, active && styles.circleChipActive]}
                  >
                    <Users size={14} color={active ? colors.white : colors.emeraldDark} />
                    <Text style={[styles.circleChipText, active && styles.circleChipTextActive]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Student Roster Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { flexDirection: rowDir }]}>
              {queue.map((row, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <Pressable
                    key={row.studentId}
                    onPress={() => {
                      setActiveIdx(idx);
                      setRunning(false);
                      setSecondsLeft(minutesPerStudent * 60);
                    }}
                    style={[
                      styles.rosterPill,
                      row.done && styles.rosterDone,
                      isActive && styles.rosterActive,
                    ]}
                  >
                    <Text style={[styles.rosterText, (isActive || row.done) && styles.rosterTextActive]}>
                      {row.done ? '✓ ' : `${idx + 1}. `}{row.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {currentRow ? (
              <>
                {/* Live Countdown Card */}
                <View style={styles.timerCard}>
                  <Text style={styles.turnBadge}>
                    {isRTL
                      ? `الدور الآن (${activeIdx + 1} من ${queue.length}) • أتممت ${completedCount}`
                      : `Turn ${activeIdx + 1}/${queue.length} • Done ${completedCount}`}
                  </Text>
                  <Text style={styles.activeStudentName}>{currentRow.name}</Text>
                  <Text style={[styles.clockText, secondsLeft === 0 && styles.clockEnded]}>
                    {formatSeconds(secondsLeft)}
                  </Text>

                  <View style={styles.presetRow}>
                    {TIMER_PRESETS_MIN.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => selectPresetMinutes(m)}
                        style={[styles.presetBtn, minutesPerStudent === m && styles.presetBtnActive]}
                      >
                        <Text style={[styles.presetText, minutesPerStudent === m && styles.presetTextActive]}>
                          {m} {isRTL ? 'د' : 'm'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={[styles.timerControls, { flexDirection: rowDir }]}>
                    <PrimaryButton
                      label={running ? (isRTL ? 'إيقاف مؤقت' : 'Pause') : (isRTL ? 'ابدأ التسميع' : 'Start Timer')}
                      variant="gold"
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setRunning((r) => !r);
                      }}
                      icon={running ? <Pause size={16} color={colors.emeraldDeep} /> : <Play size={16} color={colors.emeraldDeep} />}
                      style={styles.flex}
                    />
                    <Pressable
                      onPress={() => {
                        setRunning(false);
                        setSecondsLeft(minutesPerStudent * 60);
                      }}
                      style={styles.resetBtn}
                      accessibilityRole="button"
                    >
                      <RotateCcw size={18} color={colors.white} />
                    </Pressable>
                  </View>
                </View>

                {/* Quick Inline Evaluation Card */}
                <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>
                      {isRTL ? `تقييم سريع لـ ${currentRow.name}` : `Quick Eval: ${currentRow.name}`}
                    </Text>
                    <Pressable onPress={() => setSurahModalOpen(true)} style={styles.surahBtn}>
                      <BookOpen size={13} color={colors.emeraldDark} />
                      <Text style={styles.surahBtnText}>
                        {currentRow.surah || (isRTL ? 'اختر سورة' : 'Surah')}
                      </Text>
                    </Pressable>
                  </View>

                  <ScoreStepper
                    label={t.sessions.scoreMemorization}
                    value={currentRow.memorization}
                    onChange={(val) => updateCurrent({ memorization: val })}
                    isRTL={isRTL}
                  />
                  <ScoreStepper
                    label={t.sessions.scoreTajweed}
                    value={currentRow.tajweed}
                    onChange={(val) => updateCurrent({ tajweed: val })}
                    isRTL={isRTL}
                  />

                  <TextInput
                    style={[styles.input, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                    value={currentRow.note}
                    onChangeText={(val) => updateCurrent({ note: val })}
                    placeholder={isRTL ? 'ملاحظة سريعة لهذا الطالب...' : 'Quick note for this student...'}
                    placeholderTextColor={palette.textTertiary}
                  />

                  <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                    <PrimaryButton
                      label={
                        activeIdx + 1 < queue.length
                          ? (isRTL ? 'اعتماد والانتقال للطالب التالي' : 'Done & Next Student')
                          : (isRTL ? 'اعتماد وإتمام الطابور ✓' : 'Finish Queue ✓')
                      }
                      onPress={markDoneAndNext}
                      icon={activeIdx + 1 < queue.length ? <NextIcon size={17} color={colors.textInverse} /> : <CheckCircle2 size={17} color={colors.textInverse} />}
                      style={styles.flex}
                    />
                  </View>

                  <PrimaryButton
                    label={isRTL ? 'فتح مصحف التصحيح لهذا الطالب' : 'Open Student Mushaf Board'}
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/mushaf-board',
                        params: { studentId: currentRow.studentId, studentName: currentRow.name },
                      })
                    }
                  />
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <SurahPickerModal
        visible={surahModalOpen}
        isRTL={isRTL}
        onClose={() => setSurahModalOpen(false)}
        onSelect={(s) => updateCurrent({ surah: `سورة ${s.nameAr}` })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  chipRow: { gap: spacing.xs, paddingVertical: 2 },
  circleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.borderMint,
  },
  circleChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  circleChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  circleChipTextActive: { color: colors.white },
  rosterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rosterDone: { backgroundColor: colors.emeraldSoft, borderColor: colors.emerald },
  rosterActive: { backgroundColor: colors.emeraldDeep, borderColor: colors.gold },
  rosterText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  rosterTextActive: { color: colors.goldBright },
  timerCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.elevated,
  },
  turnBadge: { fontSize: 12, fontFamily: fonts.bold, color: colors.mint },
  activeStudentName: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.white, textAlign: 'center' },
  clockText: { fontSize: 44, fontFamily: fonts.extraBold, color: colors.goldBright, letterSpacing: 2 },
  clockEnded: { color: '#FCA5A5' },
  presetRow: { flexDirection: 'row', gap: spacing.xs },
  presetBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  presetBtnActive: { backgroundColor: colors.gold },
  presetText: { fontSize: 12, fontFamily: fonts.bold, color: colors.mint },
  presetTextActive: { color: colors.emeraldDeep },
  timerControls: { width: '100%', gap: spacing.sm, marginTop: spacing.xs },
  resetBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontFamily: fonts.extraBold },
  surahBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
  },
  surahBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
