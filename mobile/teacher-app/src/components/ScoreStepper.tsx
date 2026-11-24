import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';

interface ScoreStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  isRTL?: boolean;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function ScoreStepper({ label, value, onChange, isRTL = true }: ScoreStepperProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.badge}>{value} / 5</Text>
      </View>
      <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {SCORES.map((num) => {
          const active = value === num;
          return (
            <Pressable
              key={num}
              onPress={() => onChange(num)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{num}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  badge: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: colors.emerald,
  },
  row: { gap: spacing.xs },
  pill: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  pillText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.white,
  },
});
