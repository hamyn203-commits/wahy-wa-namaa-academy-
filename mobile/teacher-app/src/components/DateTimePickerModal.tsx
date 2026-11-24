import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, Clock, Minus, Plus, X } from 'lucide-react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';

interface DateTimePickerModalProps {
  visible: boolean;
  initialValue?: string; // YYYY-MM-DDTHH:MM
  title: string;
  isRTL?: boolean;
  onClose: () => void;
  onConfirm: (formatted: string) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DateTimePickerModal({
  visible,
  initialValue,
  title,
  isRTL = true,
  onClose,
  onConfirm,
}: DateTimePickerModalProps) {
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const parsedInitial = useMemo(() => {
    if (initialValue && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(initialValue)) {
      const d = new Date(initialValue);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const def = new Date(Date.now() + 2 * 60 * 60 * 1000);
    def.setMinutes(0, 0, 0);
    return def;
  }, [initialValue]);

  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [hour, setHour] = useState(parsedInitial.getHours());
  const [minute, setMinute] = useState(Math.floor(parsedInitial.getMinutes() / 15) * 15);

  const dayOptions = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }).map((_, offset) => {
      const d = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
      const label =
        offset === 0
          ? (isRTL ? 'اليوم' : 'Today')
          : offset === 1
            ? (isRTL ? 'غداً' : 'Tomorrow')
            : d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      return { offset, date: d, label };
    });
  }, [isRTL]);

  const applyQuickPlus = (hoursAhead: number) => {
    void Haptics.selectionAsync().catch(() => {});
    const target = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tDay = new Date(target);
    tDay.setHours(0, 0, 0, 0);
    const diffDays = Math.max(0, Math.round((tDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
    setSelectedDayOffset(Math.min(13, diffDays));
    setHour(target.getHours());
    setMinute(Math.floor(target.getMinutes() / 15) * 15);
  };

  const adjustHour = (delta: number) => {
    void Haptics.selectionAsync().catch(() => {});
    setHour((prev) => (prev + delta + 24) % 24);
  };

  const adjustMinute = (delta: number) => {
    void Haptics.selectionAsync().catch(() => {});
    setMinute((prev) => (prev + delta + 60) % 60);
  };

  const selectedDate = dayOptions[selectedDayOffset]?.date || new Date();
  const formattedResult = `${formatDateKey(selectedDate)}T${pad(hour)}:${pad(minute)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={[styles.head, { flexDirection: rowDir }]}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Quick Presets */}
          <View style={[styles.quickRow, { flexDirection: rowDir }]}>
            {[
              { label: isRTL ? 'بعد ساعة' : '+1h', h: 1 },
              { label: isRTL ? 'بعد ساعتين' : '+2h', h: 2 },
              { label: isRTL ? 'بعد 4 ساعات' : '+4h', h: 4 },
            ].map((q) => (
              <Pressable key={q.h} onPress={() => applyQuickPlus(q.h)} style={styles.quickChip}>
                <Text style={styles.quickText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Day Horizontal Strip */}
          <View style={[styles.subHead, { flexDirection: rowDir }]}>
            <Calendar size={15} color={colors.emerald} />
            <Text style={styles.subLabel}>{isRTL ? 'اختر اليوم' : 'Select Day'}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.daysRow, { flexDirection: rowDir }]}
          >
            {dayOptions.map((d) => {
              const active = selectedDayOffset === d.offset;
              return (
                <Pressable
                  key={d.offset}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setSelectedDayOffset(d.offset);
                  }}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Time Steppers */}
          <View style={[styles.subHead, { flexDirection: rowDir }]}>
            <Clock size={15} color={colors.emerald} />
            <Text style={styles.subLabel}>{isRTL ? 'اختر الساعة والدقيقة' : 'Select Time'}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.stepperBox}>
              <Text style={styles.stepperTitle}>{isRTL ? 'الساعة' : 'Hour'}</Text>
              <View style={styles.stepperControls}>
                <Pressable onPress={() => adjustHour(-1)} style={styles.stepBtn}>
                  <Minus size={18} color={colors.emeraldDark} />
                </Pressable>
                <Text style={styles.stepVal}>{pad(hour)}</Text>
                <Pressable onPress={() => adjustHour(1)} style={styles.stepBtn}>
                  <Plus size={18} color={colors.emeraldDark} />
                </Pressable>
              </View>
            </View>

            <Text style={styles.colon}>:</Text>

            <View style={styles.stepperBox}>
              <Text style={styles.stepperTitle}>{isRTL ? 'الدقيقة' : 'Min'}</Text>
              <View style={styles.stepperControls}>
                <Pressable onPress={() => adjustMinute(-15)} style={styles.stepBtn}>
                  <Minus size={18} color={colors.emeraldDark} />
                </Pressable>
                <Text style={styles.stepVal}>{pad(minute)}</Text>
                <Pressable onPress={() => adjustMinute(15)} style={styles.stepBtn}>
                  <Plus size={18} color={colors.emeraldDark} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{formattedResult.replace('T', '  •  ')}</Text>
          </View>

          <PrimaryButton
            label={isRTL ? 'اعتماد هذا الموعد' : 'Confirm Date & Time'}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onConfirm(formattedResult);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  head: { alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quickRow: { gap: spacing.sm },
  quickChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  subHead: { alignItems: 'center', gap: 6 },
  subLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  daysRow: { gap: spacing.xs, paddingVertical: 2 },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  dayChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  dayChipTextActive: { color: colors.white },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepperBox: { flex: 1, alignItems: 'center', gap: 6 },
  stepperTitle: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    minWidth: 38,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDeep,
  },
  colon: { fontSize: 24, fontFamily: fonts.extraBold, color: colors.emerald, marginTop: 18 },
  previewBox: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  previewText: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.emeraldDark },
});
