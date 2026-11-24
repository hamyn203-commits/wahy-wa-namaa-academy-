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
import { useRouter } from 'expo-router';
import { Plus, Save, Trash2 } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { AvailabilityDay, AvailabilitySlot } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

const WEEK_DAYS: Array<{ id: AvailabilityDay['day']; ar: string; en: string }> = [
  { id: 'saturday', ar: 'السبت', en: 'Saturday' },
  { id: 'sunday', ar: 'الأحد', en: 'Sunday' },
  { id: 'monday', ar: 'الإثنين', en: 'Monday' },
  { id: 'tuesday', ar: 'الثلاثاء', en: 'Tuesday' },
  { id: 'wednesday', ar: 'الأربعاء', en: 'Wednesday' },
  { id: 'thursday', ar: 'الخميس', en: 'Thursday' },
  { id: 'friday', ar: 'الجمعة', en: 'Friday' },
];

export default function TeacherScheduleScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [slotsByDay, setSlotsByDay] = useState<Record<string, AvailabilitySlot[]>>({});

  const loadSchedule = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get<{ availability?: AvailabilityDay[]; timezone?: string }>(
        '/api/teachers/dashboard/availability',
        { auth: true }
      );
      if (res.timezone) setTimezone(res.timezone);
      const mapped: Record<string, AvailabilitySlot[]> = {};
      for (const item of res.availability || []) {
        mapped[item.day] = item.slots || [];
      }
      setSlotsByDay(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadSchedule(false);
  }, [loadSchedule]);

  const addSlot = (dayId: string) => {
    setSlotsByDay((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] || []), { startTime: '16:00', endTime: '20:00' }],
    }));
  };

  const updateSlot = (dayId: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    setSlotsByDay((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
  };

  const removeSlot = (dayId: string, index: number) => {
    setSlotsByDay((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const availability: AvailabilityDay[] = WEEK_DAYS.map((day) => ({
        day: day.id,
        slots: (slotsByDay[day.id] || []).map((s) => ({
          startTime: s.startTime.trim(),
          endTime: s.endTime.trim(),
        })),
      })).filter((d) => d.slots.length > 0);

      await api.put('/api/teachers/dashboard/availability', { availability, timezone }, { auth: true });
      Alert.alert('تم الحفظ', t.schedule.savedSuccess);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.schedule.title}
        subtitle={`${t.schedule.subtitle} (${timezone})`}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadSchedule(true)} tintColor={colors.emerald} />
        }
      >
        {loading ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        ) : error ? (
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadSchedule(false)}
          />
        ) : (
          <>
            {WEEK_DAYS.map((day) => {
              const slots = slotsByDay[day.id] || [];
              return (
                <View key={day.id} style={styles.dayCard}>
                  <View style={[styles.dayHead, { flexDirection: rowDir }]}>
                    <Text style={styles.dayName}>{locale === 'ar' ? day.ar : day.en}</Text>
                    <Pressable onPress={() => addSlot(day.id)} style={styles.addChip} accessibilityRole="button">
                      <Plus size={14} color={colors.emeraldDark} />
                      <Text style={styles.addChipText}>{t.schedule.addSlot}</Text>
                    </Pressable>
                  </View>

                  {slots.length === 0 ? (
                    <Text style={[styles.noSlots, { textAlign: align }]}>{t.schedule.noSlots}</Text>
                  ) : (
                    slots.map((slot, idx) => (
                      <View key={`${day.id}-${idx}`} style={[styles.slotRow, { flexDirection: rowDir }]}>
                        <TextInput
                          style={styles.timeInput}
                          value={slot.startTime}
                          onChangeText={(val) => updateSlot(day.id, idx, 'startTime', val)}
                          placeholder="16:00"
                          maxLength={5}
                        />
                        <Text style={styles.dash}>→</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={slot.endTime}
                          onChangeText={(val) => updateSlot(day.id, idx, 'endTime', val)}
                          placeholder="20:00"
                          maxLength={5}
                        />
                        <Pressable
                          onPress={() => removeSlot(day.id, idx)}
                          style={styles.delBtn}
                          accessibilityRole="button"
                        >
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            <PrimaryButton
              label={t.schedule.saveSchedule}
              onPress={() => void handleSave()}
              loading={saving}
              icon={<Save size={17} color={colors.textInverse} />}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  dayCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  dayHead: { alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.borderMint,
  },
  addChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  noSlots: { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary },
  slotRow: { alignItems: 'center', gap: spacing.sm },
  timeInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  dash: { fontSize: 14, color: colors.textTertiary, fontFamily: fonts.bold },
  delBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
