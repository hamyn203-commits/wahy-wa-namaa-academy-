import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme/tokens';

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.titleBar} />
      {Array.from({ length: lines }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.line,
            idx === lines - 1 && styles.shortLine,
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.stack}>
      <SkeletonCard lines={3} />
      <View style={styles.grid}>
        <View style={styles.half}><SkeletonCard lines={1} /></View>
        <View style={styles.half}><SkeletonCard lines={1} /></View>
      </View>
      <SkeletonCard lines={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  grid: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  titleBar: {
    height: 16,
    width: '55%',
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    alignSelf: 'flex-end',
  },
  line: {
    height: 12,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
  },
  shortLine: {
    width: '68%',
    alignSelf: 'flex-end',
  },
});
