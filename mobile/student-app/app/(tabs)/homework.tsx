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
  BookOpenCheck,
  CheckCircle2,
  Mic,
  Play,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { API_BASE_URL, SITE_URL } from '../../src/lib/config';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';
import { GuardianChildSummary, GuardianFamilyOverview, HomeworkItem } from '../../src/types/academy';

type FilterTab = 'pending' | 'done' | 'all';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function HomeworkScreen() {
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const isGuardian = user?.role === 'guardian';

  const [filter, setFilter] = useState<FilterTab>('pending');
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [children, setChildren] = useState<GuardianChildSummary[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Audio playback state (teacher feedback or local preview)
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Recorder modal state
  const [activeHomework, setActiveHomework] = useState<HomeworkItem | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => {
    return () => {
      void stopSound();
    };
  }, [stopSound]);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const loadHomework = useCallback(async (isPull = false, childIdOverride?: string) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      if (isGuardian) {
        let targetId = childIdOverride || selectedChildId;
        if (!children.length || isPull) {
          const fam = await api.get<GuardianFamilyOverview>('/api/guardian/family-overview', { auth: true });
          const list = fam.children ?? [];
          setChildren(list);
          if (!targetId && list[0]?.student?._id) {
            targetId = list[0].student._id;
            setSelectedChildId(targetId);
          }
        }
        if (targetId) {
          const data = await api.get<{ homework?: HomeworkItem[] } | HomeworkItem[]>(
            `/api/guardian/homework/${encodeURIComponent(targetId)}`,
            { auth: true }
          );
          setItems(Array.isArray(data) ? data : data.homework ?? []);
        } else {
          setItems([]);
        }
      } else {
        const data = await api.get<{ homework?: HomeworkItem[] } | HomeworkItem[]>(
          '/api/homework/student',
          { auth: true }
        );
        setItems(Array.isArray(data) ? data : data.homework ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.homework.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [children.length, isGuardian, selectedChildId, t.homework.loadError]);

  useEffect(() => {
    void loadHomework(false);
  }, [loadHomework]);

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return items.filter((h) => h.status === 'pending' || h.status === 'overdue');
    }
    if (filter === 'done') {
      return items.filter((h) => ['submitted', 'done', 'reviewed'].includes(h.status));
    }
    return items;
  }, [filter, items]);

  const toggleFeedbackAudio = async (hw: HomeworkItem) => {
    if (playingId === hw._id) {
      await stopSound();
      return;
    }
    await stopSound();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const token = await api.hydrateToken();
      const uri = `${API_BASE_URL}/api/homework/tasks/${encodeURIComponent(hw._id)}/feedback-audio`;
      const { sound } = await Audio.Sound.createAsync(
        {
          uri,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Origin: SITE_URL,
          },
        },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingId(hw._id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch {
      Alert.alert(t.brandShort, t.homework.loadError);
    }
  };

  const openRecorder = (hw: HomeworkItem) => {
    setActiveHomework(hw);
    setRecordedUri(null);
    setRecordSeconds(0);
    setNotes('');
    setIsRecording(false);
  };

  const closeRecorder = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { /* ignore */ }
      recordingRef.current = null;
    }
    await stopSound();
    setIsRecording(false);
    setActiveHomework(null);
  };

  const startRecording = async () => {
    await stopSound();
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.brandShort, t.homework.micDenied);
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordedUri(null);
      setRecordSeconds(0);
      setIsRecording(true);
    } catch {
      Alert.alert(t.brandShort, t.homework.micDenied);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (uri) setRecordedUri(uri);
    } catch {
      setIsRecording(false);
    }
  };

  const previewRecording = async () => {
    if (!recordedUri) return;
    if (playingId === 'preview') {
      await stopSound();
      return;
    }
    await stopSound();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId('preview');
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlayingId(null);
      });
    } catch { /* ignore */ }
  };

  const submitRecording = async () => {
    if (!activeHomework || !recordedUri) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('submission', {
        uri: recordedUri,
        name: `recitation-${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as unknown as Blob);
      if (notes.trim()) form.append('notes', notes.trim());

      await api.uploadMultipart(
        `/api/homework/${encodeURIComponent(activeHomework._id)}/submit`,
        form
      );

      Alert.alert(t.common.success, t.homework.submittedOk);
      await closeRecorder();
      void loadHomework(true);
    } catch (err) {
      Alert.alert(
        t.brandShort,
        err instanceof Error ? err.message : t.homework.loadError
      );
    } finally {
      setSubmitting(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={t.homework.title}
        subtitle={t.homework.subtitle}
        isRTL={isRTL}
        compact
      />

      {isGuardian && children.length > 0 ? (
        <View style={styles.childBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childChips}>
            {children.map((c) => {
              const id = c.student?._id || '';
              const active = selectedChildId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setSelectedChildId(id);
                    void loadHomework(false, id);
                  }}
                  style={[styles.childChip, active && styles.childChipActive]}
                >
                  <Text style={[styles.childChipText, active && styles.childChipTextActive]}>
                    {c.student?.name || t.common.student}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.filterWrap}>
        <View style={[styles.filterBar, { flexDirection: rowDir }]}>
          {(['pending', 'done', 'all'] as FilterTab[]).map((tab) => {
            const active = filter === tab;
            const label =
              tab === 'pending'
                ? t.homework.filterPending
                : tab === 'done'
                  ? t.homework.filterDone
                  : t.homework.filterAll;
            return (
              <Pressable
                key={tab}
                onPress={() => setFilter(tab)}
                style={[styles.filterTab, active && styles.filterTabActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={loading || error ? [] : filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHomework(true)}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : error ? (
            <StateView
              mode="error"
              title={t.homework.loadError}
              description={error}
              actionLabel={t.common.retry}
              onAction={() => loadHomework(false)}
            />
          ) : (
            <StateView
              mode="empty"
              title={t.homework.emptyTitle}
              description={t.homework.emptyDesc}
            />
          )
        }
        renderItem={({ item }) => {
          const isPending = item.status === 'pending' || item.status === 'overdue';
          const statusLabel = t.homework.status[item.status] || item.status;
          const title = item.title || item.surah || t.homework.title;

          return (
            <View style={styles.card}>
              <View style={[styles.cardTop, { flexDirection: rowDir }]}>
                <View style={[styles.titleRow, { flexDirection: rowDir }]}>
                  <BookOpenCheck size={18} color={colors.emerald} />
                  <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
                </View>
                <View style={[styles.statusPill, isPending ? styles.pendingPill : styles.donePill]}>
                  <Text style={[styles.statusText, isPending ? styles.pendingText : styles.doneText]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {item.circleName ? (
                <Text style={[styles.circleTag, { textAlign: align }]}>{item.circleName}</Text>
              ) : null}

              {item.description ? (
                <Text style={[styles.desc, { textAlign: align }]}>{item.description}</Text>
              ) : null}

              {item.dueDate ? (
                <Text style={[styles.meta, { textAlign: align }]}>
                  {t.homework.duePrefix} {new Date(item.dueDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                </Text>
              ) : null}

              {item.teacherFeedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={[styles.feedbackLabel, { textAlign: align }]}>
                    {t.homework.teacherFeedback}
                  </Text>
                  <Text style={[styles.feedbackText, { textAlign: align }]}>{item.teacherFeedback}</Text>
                </View>
              ) : null}

              {item.hasTeacherFeedbackAudio ? (
                <PrimaryButton
                  label={playingId === item._id ? t.homework.stopPlayback : t.homework.playFeedback}
                  variant="secondary"
                  icon={<Volume2 size={17} color={colors.emeraldDark} />}
                  onPress={() => void toggleFeedbackAudio(item)}
                />
              ) : null}

              {isPending && !isGuardian ? (
                <PrimaryButton
                  label={t.homework.recordAndSubmit}
                  icon={<Mic size={17} color={colors.textInverse} />}
                  onPress={() => openRecorder(item)}
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          );
        }}
      />

      {/* In-App Voice Recitation Recorder Modal */}
      <Modal
        visible={Boolean(activeHomework)}
        animationType="slide"
        transparent
        onRequestClose={() => void closeRecorder()}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.homework.recorderTitle}</Text>
              <Pressable onPress={() => void closeRecorder()} hitSlop={10}>
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.modalSub, { textAlign: align }]}>
              {activeHomework?.title || activeHomework?.description || t.homework.recorderHint}
            </Text>

            <View style={styles.recorderBox}>
              <Pressable
                onPress={() => void (isRecording ? stopRecording() : startRecording())}
                style={[styles.micCircle, isRecording && styles.micCircleActive]}
              >
                {isRecording ? (
                  <Square size={28} color={colors.white} fill={colors.white} />
                ) : (
                  <Mic size={32} color={colors.white} />
                )}
              </Pressable>
              <Text style={styles.timerText}>{formatClock(recordSeconds)}</Text>
              <Text style={styles.recorderStatus}>
                {isRecording
                  ? t.homework.stopRecording
                  : recordedUri
                    ? t.common.success
                    : t.homework.startRecording}
              </Text>

              {recordedUri && !isRecording ? (
                <Pressable onPress={() => void previewRecording()} style={styles.previewPill}>
                  <Play size={14} color={colors.emerald} />
                  <Text style={styles.previewText}>
                    {playingId === 'preview' ? t.homework.stopPlayback : t.homework.previewRecording}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={locale === 'ar' ? 'ملاحظة اختيارية للمعلم...' : 'Optional note for teacher...'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.noteInput, { textAlign: align }]}
            />

            <PrimaryButton
              label={submitting ? t.homework.uploading : t.homework.sendRecording}
              icon={<Send size={16} color={colors.textInverse} />}
              disabled={!recordedUri || isRecording}
              loading={submitting}
              onPress={() => void submitRecording()}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  childBar: { backgroundColor: colors.ivory, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  childChips: { gap: spacing.sm },
  childChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  childChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  childChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  childChipTextActive: { color: colors.textInverse },
  filterWrap: {
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterBar: {
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
    ...shadows.card,
  },
  filterTab: {
    flex: 1,
    minHeight: TOUCH_MIN - 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: colors.emerald },
  filterText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  filterTextActive: { color: colors.textInverse },
  listContent: {
    flexGrow: 1,
    backgroundColor: colors.ivory,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardTop: { justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  titleRow: { flex: 1, alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  circleTag: { fontSize: 12, fontFamily: fonts.bold, color: colors.emerald },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pendingPill: { backgroundColor: colors.goldSoft },
  donePill: { backgroundColor: colors.emeraldSoft },
  statusText: { fontSize: 12, fontFamily: fonts.bold },
  pendingText: { color: colors.goldDark },
  doneText: { color: colors.emeraldDark },
  desc: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },
  meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary },
  feedbackBox: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  feedbackLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  feedbackText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 20 },
  actionBtn: { marginTop: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  modalSub: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  recorderBox: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  micCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated,
  },
  micCircleActive: { backgroundColor: colors.danger },
  timerText: { fontSize: 24, fontFamily: fonts.extraBold, color: colors.textPrimary },
  recorderStatus: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    marginTop: 4,
  },
  previewText: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  noteInput: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
});
