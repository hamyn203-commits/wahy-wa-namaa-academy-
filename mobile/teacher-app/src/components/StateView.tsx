import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Inbox } from 'lucide-react-native';
import { colors, fonts, radius, shadows, spacing } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';

interface StateViewProps {
  mode: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StateView({ mode, title, description, actionLabel, onAction }: StateViewProps) {
  return (
    <View style={styles.box}>
      {mode === 'loading' ? (
        <ActivityIndicator size="large" color={colors.emerald} />
      ) : mode === 'error' ? (
        <View style={[styles.iconWrap, styles.errorBg]}>
          <AlertCircle size={28} color={colors.danger} />
        </View>
      ) : (
        <View style={[styles.iconWrap, styles.emptyBg]}>
          <Inbox size={28} color={colors.emerald} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          variant={mode === 'error' ? 'primary' : 'secondary'}
          style={styles.btn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBg: { backgroundColor: colors.emeraldSoft },
  errorBg: { backgroundColor: colors.dangerSoft },
  title: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  btn: {
    marginTop: spacing.xs,
    minWidth: 170,
  },
});
