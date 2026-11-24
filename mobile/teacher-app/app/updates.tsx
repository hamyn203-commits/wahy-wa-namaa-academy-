import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Plus, Send, Trash2, X } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { formatDateTime } from '../src/lib/formatters';
import { ActiveStudent, TeacherUpdateItem } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

export default function TeacherUpdatesScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updates, setUpdates] = useState<TeacherUpdateItem[]>([]);
  const [students, setStudents] = useState<ActiveStudent[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceMode, setAudienceMode] = useState<'all-active' | 'selected'>('all-active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const loadUpdates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [updRes, studRes] = await Promise.all([
        api.get<{ updates?: TeacherUpdateItem[] }>('/api/teacher-updates/teacher', { auth: true }),
        api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true }),
      ]);
      setUpdates(updRes.updates || []);
      setStudents(studRes.students || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadUpdates(false);
  }, [loadUpdates]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handlePublish = async () => {
    if (publishing) return;
    if (!title.trim()) {
      Alert.alert(t.common.errorTitle, 'عنوان الرسالة مطلوب.');
      return;
    }
    setPublishing(true);
    try {
      await api.post(
        '/api/teacher-updates/teacher',
        {
          title: title.trim(),
          message: message.trim(),
          audienceMode,
          studentIds: audienceMode === 'selected' ? selectedIds : [],
        },
        { auth: true }
      );
      setModalOpen(false);
      setTitle('');
      setMessage('');
      setSelectedIds([]);
      await loadUpdates(true);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setPublishing(false);
    }
  };

  const confirmDelete = (item: TeacherUpdateItem) => {
    Alert.alert(t.common.delete, t.teacherUpdates.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.delete(`/api/teacher-updates/teacher/${item._id}`, { auth: true });
              await loadUpdates(true);
            } catch (err) {
              Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
            }
          })();
        },
      },
    ]);
  };

  const renderUpdate = useCallback(
    ({ item }: { item: TeacherUpdateItem }) => (
      <View style={styles.card}>
        <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
          <Text style={styles.dateText}>{formatDateTime(item.publishedAt || item.createdAt, locale)}</Text>
          <Pressable onPress={() => confirmDelete(item)} style={styles.delBtn} accessibilityRole="button">
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
        </View>
        <Text style={[styles.title, { textAlign: align }]}>{item.title}</Text>
        {item.message ? <Text style={[styles.body, { textAlign: align }]}>{item.message}</Text> : null}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [align, locale, rowDir]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.teacherUpdates.title}
        subtitle={t.teacherUpdates.subtitle}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
        rightSlot={
          <Pressable onPress={() => setModalOpen(true)} style={styles.addBtn} accessibilityRole="button">
            <Plus size={18} color={colors.emeraldDeep} />
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadUpdates(false)}
          />
        </View>
      ) : (
        <FlatList
          data={updates}
          keyExtractor={(item) => item._id}
          renderItem={renderUpdate}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadUpdates(true)} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <StateView
              mode="empty"
              title={t.teacherUpdates.empty}
              actionLabel={t.teacherUpdates.newBtn}
              onAction={() => setModalOpen(true)}
            />
          }
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.teacherUpdates.newBtn}</Text>
              <Pressable onPress={() => setModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.modeRow, { flexDirection: rowDir }]}>
                <Pressable
                  onPress={() => setAudienceMode('all-active')}
                  style={[styles.modeBtn, audienceMode === 'all-active' && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeText, audienceMode === 'all-active' && styles.modeTextActive]}>
                    {t.teacherUpdates.audienceAll}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAudienceMode('selected')}
                  style={[styles.modeBtn, audienceMode === 'selected' && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeText, audienceMode === 'selected' && styles.modeTextActive]}>
                    {t.teacherUpdates.audienceSelected}
                  </Text>
                </Pressable>
              </View>

              {audienceMode === 'selected' ? (
                <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                  {students.map((st) => {
                    const active = selectedIds.includes(st._id);
                    return (
                      <Pressable
                        key={st._id}
                        onPress={() => toggleStudent(st._id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.teacherUpdates.titleLabel}</Text>
              <TextInput
                style={[styles.input, { textAlign: align }]}
                value={title}
                onChangeText={setTitle}
                placeholder="..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.teacherUpdates.messageLabel}</Text>
              <TextInput
                style={[styles.textArea, { textAlign: align }]}
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder="..."
                placeholderTextColor={colors.textTertiary}
              />

              <PrimaryButton
                label={t.teacherUpdates.publishBtn}
                onPress={() => void handlePublish()}
                loading={publishing}
                icon={<Send size={16} color={colors.textInverse} />}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  pad: { padding: spacing.lg, gap: spacing.md },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary },
  delBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.textPrimary },
  body: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 39, 29, 0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
    gap: spacing.md,
  },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { gap: spacing.sm, paddingBottom: spacing.xl },
  modeRow: { gap: spacing.sm },
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
  modeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  modeTextActive: { color: colors.white },
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
    minHeight: 96,
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
