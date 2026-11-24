import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
} from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { toLocalDateTimeInput } from '../../src/lib/formatters';
import { ActiveStudent, TeacherCircle } from '../../src/types/teacher';
import { DateTimePickerModal } from '../../src/components/DateTimePickerModal';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

export default function TeacherStudentsScreen() {
  const router = useRouter();
  const { isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const [tab, setTab] = useState<'students' | 'circles'>('students');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [circles, setCircles] = useState<TeacherCircle[]>([]);

  // Schedule Group Circle Session modal
  const [circleModal, setCircleModal] = useState<TeacherCircle | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);

    try {
      const [studRes, circRes] = await Promise.all([
        api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true }),
        api.get<{ circles?: TeacherCircle[] }>('/api/teachers/dashboard/circles', { auth: true }),
      ]);
      setStudents(studRes.students || []);
      setCircles(circRes.circles || []);
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

  const submitCircleSession = async () => {
    if (!circleModal || savingSession) return;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt.trim())) {
      Alert.alert(t.common.errorTitle, t.sessions.rescheduleHint);
      return;
    }
    setSavingSession(true);
    try {
      await api.post(
        '/api/sessions/group-circle',
        {
          circleId: circleModal._id,
          scheduledAt: scheduledAt.trim(),
          timezone: circleModal.timezone || 'Africa/Cairo',
          duration: Number(duration || circleModal.durationMaxMinutes || 60),
          notes: notes.trim(),
        },
        { auth: true }
      );
      setCircleModal(null);
      setNotes('');
      Alert.alert('تمت الجدولة', 'تم جدولة حصة الحلقة الجماعية وإشعار الطلاب بنجاح.');
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSavingSession(false);
    }
  };

  const renderStudent = useCallback(
    ({ item }: { item: ActiveStudent }) => {
      const initial = (item.name || 'ط').trim().charAt(0).toUpperCase();
      return (
        <Pressable
          onPress={() => router.push(`/student/${encodeURIComponent(item._id)}`)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={[styles.row, { flexDirection: rowDir }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.name, { textAlign: align }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.meta, { textAlign: align }]}>
                {item.completedSessions ?? 0} {t.students.sessionsCompleted}
                {item.pendingTasks ? ` • ${item.pendingTasks} ${t.students.pendingTasks}` : ''}
              </Text>
            </View>
            <Chevron size={18} color={colors.textTertiary} />
          </View>
        </Pressable>
      );
    },
    [align, rowDir, router, t.students.pendingTasks, t.students.sessionsCompleted, Chevron]
  );

  const renderCircle = useCallback(
    ({ item }: { item: TeacherCircle }) => (
      <View style={styles.card}>
        <View style={[styles.row, { flexDirection: rowDir }]}>
          <View style={[styles.avatar, styles.circleAvatar]}>
            <Users size={20} color={colors.emerald} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { textAlign: align }]}>{item.name}</Text>
            <Text style={[styles.meta, { textAlign: align }]}>
              {t.students.circleStudentsCount.replace('{count}', String(item.currentCount ?? item.students?.length ?? 0))}
              {item.track ? ` • ${item.track}` : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.btnRow, { flexDirection: rowDir }]}>
          <PrimaryButton
            label={t.students.scheduleCircleSession}
            onPress={() => {
              setCircleModal(item);
              setScheduledAt(toLocalDateTimeInput());
              setDuration(String(item.durationMaxMinutes || 60));
              setNotes('');
            }}
            icon={<CalendarPlus size={16} color={colors.textInverse} />}
            style={styles.flex}
          />
          <PrimaryButton
            label={t.students.assignTask}
            variant="secondary"
            onPress={() => router.push('/(tabs)/homework')}
            icon={<BookOpen size={16} color={colors.emeraldDark} />}
          />
        </View>
        <PrimaryButton
          label={isRTL ? '⏱️ بدء طابور التسميع الحي للحلقة' : '⏱️ Start Live Recitation Queue'}
          variant="gold"
          onPress={() => router.push({ pathname: '/circle-queue', params: { circleId: item._id } })}
        />
      </View>
    ),
    [align, rowDir, router, t.students.assignTask, t.students.circleStudentsCount, t.students.scheduleCircleSession]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.students.title}
        subtitle={t.students.subtitle}
        isRTL={isRTL}
        compact
      />

      <View style={[styles.segmentBar, { flexDirection: rowDir }]}>
        <Pressable
          onPress={() => setTab('students')}
          style={[styles.segBtn, tab === 'students' && styles.segBtnActive]}
          accessibilityRole="tab"
        >
          <Text style={[styles.segText, tab === 'students' && styles.segTextActive]}>
            {t.students.tabStudents.replace('{count}', String(students.length))}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('circles')}
          style={[styles.segBtn, tab === 'circles' && styles.segBtnActive]}
          accessibilityRole="tab"
        >
          <Text style={[styles.segText, tab === 'circles' && styles.segTextActive]}>
            {t.students.tabCircles.replace('{count}', String(circles.length))}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
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
      ) : tab === 'students' ? (
        <FlatList
          data={students}
          keyExtractor={(item) => item._id}
          renderItem={renderStudent}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor={colors.emerald} />
          }
          ListEmptyComponent={<StateView mode="empty" title={t.students.emptyStudents} />}
        />
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item) => item._id}
          renderItem={renderCircle}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor={colors.emerald} />
          }
          ListEmptyComponent={<StateView mode="empty" title={t.students.emptyCircles} />}
        />
      )}

      {/* Schedule Group Circle Session Modal */}
      <Modal visible={Boolean(circleModal)} transparent animationType="slide" onRequestClose={() => setCircleModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHead, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.students.circleModalTitle}</Text>
              <Pressable onPress={() => setCircleModal(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.circleNameLabel, { textAlign: align }]}>{circleModal?.name}</Text>

            <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.students.dateTimeLabel}</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[styles.input, { justifyContent: 'center' }]}
            >
              <Text style={{ fontFamily: fonts.bold, color: colors.emeraldDark, textAlign: 'center' }}>
                📅 {scheduledAt ? scheduledAt.replace('T', '  •  ') : 'اختر الموعد باللمس'}
              </Text>
            </Pressable>

            <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.students.durationLabel}</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.students.notesLabel}</Text>
            <TextInput
              style={[styles.textArea, { textAlign: align }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="..."
              placeholderTextColor={colors.textTertiary}
            />

            <PrimaryButton
              label={t.students.scheduleCircleSession}
              onPress={() => void submitCircleSession()}
              loading={savingSession}
            />
          </View>
        </View>
      </Modal>
      <DateTimePickerModal
        visible={datePickerOpen}
        initialValue={scheduledAt}
        title={t.students.circleModalTitle}
        isRTL={isRTL}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(val) => setScheduledAt(val)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  segmentBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: { backgroundColor: colors.emerald },
  segText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  segTextActive: { color: colors.white },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  row: { alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAvatar: { backgroundColor: colors.emeraldSoft },
  avatarText: { color: colors.goldBright, fontSize: 18, fontFamily: fonts.extraBold },
  name: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
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
    gap: spacing.sm,
  },
  modalHead: { alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  circleNameLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.emerald },
  fieldLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
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
    minHeight: 76,
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
