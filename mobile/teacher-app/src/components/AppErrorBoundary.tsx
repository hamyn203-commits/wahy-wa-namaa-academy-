import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.card}>
            <Text style={styles.title}>حدث خطأ غير متوقع</Text>
            <Text style={styles.desc}>
              نعتذر عن هذا الخلل. اضغط على إعادة المحاولة لاستئناف استخدام تطبيق المعلم.
            </Text>
            <PrimaryButton label="إعادة المحاولة" onPress={this.handleReset} />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ivory,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDark,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
