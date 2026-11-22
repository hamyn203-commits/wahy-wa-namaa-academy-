import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  valueText?: string;
  label?: string;
  color?: string;
  trackColor?: string;
}

export function ProgressRing({
  percent,
  size = 92,
  strokeWidth = 9,
  valueText,
  label,
  color = colors.emerald,
  trackColor = colors.emeraldSoft,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * clamped) / 100;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.value}>{valueText ?? `${Math.round(clamped)}%`}</Text>
        {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  value: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  label: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.textTertiary, marginTop: -2 },
});
