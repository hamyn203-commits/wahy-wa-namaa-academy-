import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import {
  CheckCircle2,
  Play,
  Plus,
  RotateCcw,
  Square,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { uploadTeacherFeedbackAudio } from '../../src/lib/directUpload';
import { formatShortDate } from '../../src/lib/formatters';
import { ActiveStudent, TeacherCircle, TeacherTaskItem } from '../../src/types/teacher';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { SurahPickerModal } from '../../src/components/SurahPickerModal';
import { VoiceDraft, VoiceFeedbackRecorder } from '../../src/components/VoiceFeedbackRecorder';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

type FilterStatus = 'all' | 'submitted' | 'pending' | 'done';
const TASK_TYPES = ['memorization', 'review-recent', 'review-far', 'audio', 'test'] as const;

export default function TeacherHomeworkScreen() {
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [filter, setFilter] = useState<FilterStatus>('submitted');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [tasks, setTasks] = useState<TeacherTaskItem[]>([]);
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [circles, setCircles] = useState<TeacherCircle[]>([]);

  // Audio playback state for student submissions
  const [playingTaskId, setPlayingTaskId] = useState('');
  const [loadingAudioTaskId, setLoadingAudioTaskId] = useState('');
  const soundRef = useRef<Audio.Sound | null>(null);

  // Per-task written feedback & recorded voice drafts
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [voiceMap, setVoiceMap] = useState<Record<string, VoiceDraft | null>>({});
  const [reviewingId, setReviewingId] = useState('');

  // Create Task Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<'student' | 'circle'>('student');
  const [targetId, setTargetId] = useState('');
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]>('memorization');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [surahModalOpen, setSurahModalOpen] = useState(false);

  const applyGameChallengePreset = (gameName: string) => {
    setTaskType('test');
    setTitle(`🎮 تحدي لعبة: ${gameName}`);
    setDescription(`افتح «عالم الألعاب القرآنية» في تطبيق الطالب وأكمل تحدي (${gameName}) لرفع نقاطك وتنمية حديقتك القرآنية!`);
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);

    try {
      const [tasksRes, studRes, circRes] = await Promise.all([
        api.get<{ tasks?: TeacherTaskItem[] }>('/api/teachers/dashboard/tasks', { auth: true }),
        api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true }),
        api.get<{ circles?: TeacherCircle[] }>('/api/teachers/dashboard/circles', { auth: true }),
      ]);
      const loadedTasks = tasksRes.tasks || [];
      setTasks(loadedTasks);
      setStudents(studRes.students || []);
      setCircles(circRes.circles || []);
      if (!isRefresh && loadedTasks.filter((item) => item.status === 'submitted').length === 0) {
        setFilter('all');
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((item) => item.status === filter);
  }, [filter, tasks]);

  const stopStudentAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlayingTaskId('');
  };

  const playStudentAudio = async (task: TeacherTaskItem) => {
    if (playingTaskId === task._id) {
      await stopStudentAudio();
      return;
    }
    await stopStudentAudio();
    setLoadingAudioTaskId(task._id);
    try {
      const localUri = await api.downloadAuthenticatedFile(
        `/api/homework/tasks/${task._id}/file`,
        `task-${task._id}.m4a`
      );
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingTaskId('');
            void sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        }
      );
      soundRef.current = sound;
      setPlayingTaskId(task._id);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoadingAudioTaskId('');
    }
  };

  const handleReview = async (task: TeacherTaskItem, action: 'approve' | 'request-revision') => {
    if (reviewingId) return;
    setReviewingId(task._id);
    try {
      const voiceDraft = voiceMap[task._id];
      let directAudioPayload: Record<string, unknown> | undefined;

      if (voiceDraft?.uri) {
        const ownerId = String(user?._id || user?.id || '');
        const uploadRes = await uploadTeacherFeedbackAudio({
          taskId: task._id,
          uri: voiceDraft.uri,
          ownerId,
          durationSeconds: voiceDraft.durationSeconds,
        });
        if (uploadRes.mode === 'direct') {
          directAudioPayload = uploadRes.feedbackAudio as unknown as Record<string, unknown>;
        }
      }

      await api.patch(
        `/api/teachers/dashboard/tasks/${task._id}`,
        {
          action,
          teacherFeedback: (feedbackMap[task._id] || '').trim(),
          ...(directAudioPayload ? { feedbackAudio: directAudioPayload } : {}),
        },
        { auth: true }
      );

      setFeedbackMap((prev) => {
        const copy = { ...prev };
        delete copy[task._id];
        return copy;
      });
      setVoiceMap((prev) => {
        const copy = { ...prev };
        delete copy[task._id];
        return copy;
      });
      await loadData(true);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setReviewingId('');
    }
  };

  const handleCreateTask = async () => {
    if (creating) return;
    if (!targetId || !title.trim()) {
      Alert.alert(t.common.errorTitle, 'اختر الطالب أو الحلقة وأدخل عنوان الواجب.');
      return;
    }
    setCreating(true);
    try {
      await api.post(
        '/api/teachers/dashboard/tasks',
        {
          ...(targetMode === 'student' ? { studentId: targetId } : { circleId: targetId }),
          type: taskType,
          title: title.trim(),
          description: description.trim(),
          ...(dueDate.trim() ? { dueDate: dueDate.trim() } : {}),
        },
        { auth: true }
      );
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      await loadData(true);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setCreating(false);
    }
  };

  const typeLabel = (tp: TeacherTaskItem['type']) => {
    switch (tp) {
      case 'memorization': return t.homework.typeMemorization;
      case 'review-recent': return t.homework.typeReviewRecent;
      case 'review-far': return t.homework.typeReviewFar;
      case 'audio': return t.homework.typeAudio;
      case 'test': return t.homework.typeTest;
    }
  };

  const renderTask = useCallback(
    ({ item }: { item: TeacherTaskItem }) => {
      const isSubmitted = item.status === 'submitted';
      const isDone = item.status === 'done';
      const isPlaying = playingTaskId === item._id;
      const isAudioLoading = loadingAudioTaskId === item._id;
      const isReviewing = reviewingId === item._id;

      return (
        <View style={styles.card}>
          <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
            <View
              style={[
                styles.statusBadge,
                isDone ? styles.badgeDone : isSubmitted ? styles.badgeSubmitted : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isDone ? styles.textDone : isSubmitted ? styles.textSubmitted : styles.textPending,
                ]}
              >
                {isDone ? t.homework.filterDone : isSubmitted ? t.homework.filterSubmitted : t.homework.filterPending}
              </Text>
            </View>
            <Text style={styles.typeChip}>{typeLabel(item.type)}</Text>
          </View>

          <Text style={[styles.taskTitle, { textAlign: align }]}>{item.title}</Text>
          <Text style={[styles.meta, { textAlign: align }]}>
            {item.student?.name || t.common.studentFallback}
            {item.circle?.name ? ` • ${item.circle.name}` : ''}
            {item.dueDate ? ` • ${formatShortDate(item.dueDate, locale)}` : ''}
          </Text>

          {item.description ? (
            <Text style={[styles.desc, { textAlign: align }]}>{item.description}</Text>
          ) : null}

          {item.submissionFile ? (
            <PrimaryButton
              label={
                isAudioLoading
                  ? t.homework.loadingAudio
                  : isPlaying
                    ? t.homework.stopAudio
                    : t.homework.playStudentAudio
              }
              variant={isPlaying ? 'danger' : 'secondary'}
              loading={isAudioLoading}
              onPress={() => void playStudentAudio(item)}
              icon={
                isPlaying ? (
                  <Square size={15} color={colors.danger} />
                ) : (
                  <Play size={15} color={colors.emeraldDark} />
                )
              }
            />
          ) : null}

          {isSubmitted ? (
            <View style={styles.reviewBox}>
              <TextInput
                style={[styles.feedbackInput, { textAlign: align }]}
                value={feedbackMap[item._id] || ''}
                onChangeText={(val) => setFeedbackMap((prev) => ({ ...prev, [item._id]: val }))}
                placeholder={t.homework.feedbackPlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
              />

              <VoiceFeedbackRecorder
                draft={voiceMap[item._id] || null}
                onChange={(draft) => setVoiceMap((prev) => ({ ...prev, [item._id]: draft }))}
              />

              <View style={[styles.btnRow, { flexDirection: rowDir }]}>
                <PrimaryButton
                  label={t.homework.approveBtn}
                  onPress={() => void handleReview(item, 'approve')}
                  loading={isReviewing}
                  icon={<CheckCircle2 size={15} color={colors.textInverse} />}
                  style={styles.flex}
                />
                <PrimaryButton
                  label={t.homework.revisionBtn}
                  variant="danger"
                  disabled={isReviewing}
                  onPress={() => void handleReview(item, 'request-revision')}
                  icon={<RotateCcw size={15} color={colors.danger} />}
                />
              </View>
            </View>
          ) : item.teacherFeedback ? (
            <View style={styles.doneFeedback}>
              <Text style={[styles.doneFeedbackText, { textAlign: align }]}>
                💬 {item.teacherFeedback}
              </Text>
            </View>
          ) : null}
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [align, rowDir, locale, playingTaskId, loadingAudioTaskId, reviewingId, feedbackMap, voiceMap, t]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.homework.title}
        subtitle={t.homework.subtitle}
        isRTL={isRTL}
        compact
        rightSlot={
          <Pressable
            onPress={() => {
              setCreateOpen(true);
              if (students.length > 0 && !targetId) setTargetId(students[0]._id);
            }}
            style={styles.addBtn}
            accessibilityRole="button"
          >
            <Plus size={18} color={colors.emeraldDeep} />
          </Pressable>
        }
      />

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filterBar, { flexDirection: rowDir }]}
      >
        {(
          [
            { key: 'submitted', label: t.homework.filterSubmitted },
            { key: 'pending', label: t.homework.filterPending },
            { key: 'done', label: t.homework.filterDone },
            { key: 'all', label: t.homework.filterAll },
          ] as const
        ).map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </View>
      ) : loadError ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={t.common.errorGeneric}
            actionLabel={t.common.retry}
            onAction={() => void loadData(false)}
          />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item._id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <StateView
              mode="empty"
              title={t.homework.empty}
              actionLabel={t.homework.newTaskBtn}
              onAction={() => setCreateOpen(true)}
            />
          }
        />
      )}

      {/* Assign New Task Modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.homework.createModalTitle}</Text>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.btnRow, { flexDirection: rowDir }]}>
                <Pressable
                  onPress={() => {
                    setTargetMode('student');
                    setTargetId(students[0]?._id || '');
                  }}
                  style={[styles.modeBtn, targetMode === 'student' && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeText, targetMode === 'student' && styles.modeTextActive]}>
                    {t.homework.targetStudent}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setTargetMode('circle');
                    setTargetId(circles[0]?._id || '');
                  }}
                  style={[styles.modeBtn, targetMode === 'circle' && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeText, targetMode === 'circle' && styles.modeTextActive]}>
                    {t.homework.targetCircle}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.homework.selectTarget}</Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {(targetMode === 'student' ? students : circles).map((entry) => {
                  const selected = targetId === entry._id;
                  return (
                    <Pressable
                      key={entry._id}
                      onPress={() => setTargetId(entry._id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {entry.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.homework.taskType}</Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {TASK_TYPES.map((tp) => {
                  const selected = taskType === tp;
                  return (
                    <Pressable
                      key={tp}
                      onPress={() => setTaskType(tp)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {typeLabel(tp)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { textAlign: align }]}>
                {locale === 'ar' ? '🎮 أو اختر تحدي لعبة تفاعلية سريع (ضد الملل):' : '🎮 Quick Interactive Game Challenge:'}
              </Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {[
                  'رتّب الآية 🧩',
                  'الكلمة المفقودة 🔍',
                  'صائد التجويد ⚡',
                  'التحدي اليومي 🔥',
                ].map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => applyGameChallengePreset(g)}
                    style={[styles.chip, { backgroundColor: colors.goldSoft, borderColor: colors.sand }]}
                  >
                    <Text style={[styles.chipText, { color: colors.goldDark }]}>{g}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.homework.titleLabel}</Text>
                <Pressable onPress={() => setSurahModalOpen(true)} style={[styles.chip, { backgroundColor: colors.emeraldSoft, borderColor: colors.borderMint }]}>
                  <Text style={[styles.chipText, { color: colors.emeraldDark }]}>{locale === 'ar' ? 'اختر سورة 📖' : 'Pick Surah 📖'}</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { textAlign: align }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t.homework.titlePlaceholder}
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.homework.descLabel}</Text>
              <TextInput
                style={[styles.textArea, { textAlign: align }]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.homework.dueLabel}</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-11-30"
                placeholderTextColor={colors.textTertiary}
              />

              <PrimaryButton
                label={t.homework.newTaskBtn}
                onPress={() => void handleCreateTask()}
                loading={creating}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <SurahPickerModal
        visible={surahModalOpen}
        isRTL={isRTL}
        onClose={() => setSurahModalOpen(false)}
        onSelect={(s) => {
          setTitle(`حفظ ومراجعة سورة ${s.nameAr}`);
          if (!description) setDescription(`من آية 1 إلى ${Math.min(10, s.ayahs)} مع إتقان أحكام التجويد.`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  filterText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  filterTextActive: { color: colors.white },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeDone: { backgroundColor: colors.emeraldSoft },
  badgeSubmitted: { backgroundColor: colors.warningSoft },
  badgePending: { backgroundColor: colors.ivoryDeep },
  statusText: { fontSize: 11, fontFamily: fonts.bold },
  textDone: { color: colors.emeraldDark },
  textSubmitted: { color: colors.warning },
  textPending: { color: colors.textSecondary },
  typeChip: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary },
  taskTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  desc: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  reviewBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedbackInput: {
    minHeight: 62,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  doneFeedback: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  doneFeedbackText: { fontSize: 13, fontFamily: fonts.medium, color: colors.emeraldDark },
  btnRow: { gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
    gap: spacing.md,
  },
  modalScroll: { gap: spacing.sm, paddingBottom: spacing.xl },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  modeText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  modeTextActive: { color: colors.white },
  fieldLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
  chipRow: { flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
  },
  chipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
});
