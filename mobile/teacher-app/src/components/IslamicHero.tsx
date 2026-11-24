import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { colors, fonts, radius, spacing, TOUCH_MIN } from '../theme/tokens';

interface IslamicHeroProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  isRTL?: boolean;
  onBack?: () => void;
  rightSlot?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
}

export function IslamicHero({
  title,
  subtitle,
  badge,
  isRTL = true,
  onBack,
  rightSlot,
  children,
  compact = false,
  style,
}: IslamicHeroProps) {
  const align = isRTL ? 'right' : 'left';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 220">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colors.emeraldNight} />
              <Stop offset="55%" stopColor={colors.emeraldDeep} />
              <Stop offset="100%" stopColor={colors.emerald} />
            </LinearGradient>
            <LinearGradient id="goldGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colors.gold} stopOpacity="0.22" />
              <Stop offset="100%" stopColor={colors.gold} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="400" height="220" fill="url(#heroGrad)" />
          <Circle cx="350" cy="36" r="78" fill="url(#goldGlow)" />
          <Circle cx="350" cy="36" r="56" stroke={colors.gold} strokeOpacity="0.14" strokeWidth="1" fill="none" />
          <Circle cx="350" cy="36" r="36" stroke={colors.gold} strokeOpacity="0.18" strokeWidth="1" fill="none" />
          <Path
            d="M350 4 L359 27 L382 36 L359 45 L350 68 L341 45 L318 36 L341 27 Z"
            stroke={colors.gold}
            strokeOpacity="0.20"
            strokeWidth="1"
            fill="none"
          />
          <Circle cx="36" cy="188" r="62" stroke={colors.teal} strokeOpacity="0.14" strokeWidth="1" fill="none" />
        </Svg>
      </View>

      {(onBack || rightSlot || badge) ? (
        <View style={[styles.topRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <BackIcon size={20} color={colors.textInverse} />
            </Pressable>
          ) : badge ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : <View style={styles.spacer} />}

          <View style={styles.rightSlot}>{rightSlot}</View>
        </View>
      ) : null}

      {title ? (
        <Text style={[styles.title, { textAlign: align }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}

      {subtitle ? (
        <Text style={[styles.subtitle, { textAlign: align }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.emeraldDeep,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    gap: 6,
  },
  wrapCompact: {
    paddingBottom: spacing.xl,
  },
  topRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: TOUCH_MIN - 4,
    height: TOUCH_MIN - 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78 },
  spacer: { width: 44 },
  rightSlot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.45)',
  },
  badgeText: {
    color: colors.goldBright,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  title: {
    color: colors.textInverse,
    fontSize: 22,
    fontFamily: fonts.extraBold,
    lineHeight: 32,
  },
  subtitle: {
    color: colors.mint,
    fontSize: 13,
    fontFamily: fonts.medium,
    lineHeight: 20,
  },
});
