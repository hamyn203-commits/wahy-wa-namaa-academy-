import React, { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../theme/tokens';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        variant === 'primary' && shadows.card,
        variant === 'gold' && shadows.gold,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? colors.emerald : colors.textInverse}
        />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.emerald,
  },
  secondary: {
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.borderMint,
  },
  gold: {
    backgroundColor: colors.gold,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F3B8B2',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  primaryLabel: {
    color: colors.textInverse,
  },
  secondaryLabel: {
    color: colors.emeraldDark,
  },
  goldLabel: {
    color: colors.emeraldDeep,
  },
  dangerLabel: {
    color: colors.danger,
  },
  ghostLabel: {
    color: colors.emeraldDark,
  },
});
