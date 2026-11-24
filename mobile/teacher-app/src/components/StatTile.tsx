import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadows, spacing } from '../theme/tokens';

interface StatTileProps {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'gold' | 'teal';
  icon?: ReactNode;
  isRTL?: boolean;
  onPress?: () => void;
}

export function StatTile({
  label,
  value,
  accent = 'emerald',
  icon,
  isRTL = true,
  onPress,
}: StatTileProps) {
  const accentColor =
    accent === 'gold' ? colors.goldDark : accent === 'teal' ? colors.teal : colors.emerald;
  const softBg =
    accent === 'gold' ? colors.goldSoft : accent === 'teal' ? colors.tealSoft : colors.emeraldSoft;

  const content = (
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {icon ? <View style={[styles.iconHalo, { backgroundColor: softBg }]}>{icon}</View> : null}
      <View style={styles.textCol}>
        <Text
          style={[styles.value, { color: accentColor, textAlign: isRTL ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          {String(value)}
        </Text>
        <Text
          style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.tile}>{content}</View>;
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  row: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconHalo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  value: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    lineHeight: 26,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
