import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpenCheck, CalendarClock, TrendingUp, Wallet } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { formatCurrency } from '../src/lib/formatters';
import { TeacherAnalytics } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { SkeletonDashboard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { StatTile } from '../src/components/StatTile';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

export default function TeacherAnalyticsScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<TeacherAnalytics | null>(null);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get<TeacherAnalytics>('/api/teachers/dashboard/analytics', { auth: true });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadAnalytics(false);
  }, [loadAnalytics]);

  const maxCount = Math.max(1, ...(data?.monthlySessions || []).map((m) => m.count));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.analytics.title}
        subtitle={t.analytics.subtitle}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadAnalytics(true)} tintColor={colors.emerald} />
        }
      >
        {loading ? (
          <SkeletonDashboard />
        ) : error ? (
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadAnalytics(false)}
          />
        ) : (
          <>
            <View style={styles.grid}>
              <StatTile
                label={t.analytics.dailyEarn}
                value={formatCurrency(data?.earnings?.daily ?? 0, 'EGP', locale)}
                accent="gold"
                isRTL={isRTL}
                icon={<Wallet size={18} color={colors.goldDark} />}
              />
              <StatTile
                label={t.analytics.monthlyEarn}
                value={formatCurrency(data?.earnings?.monthly ?? 0, 'EGP', locale)}
                accent="emerald"
                isRTL={isRTL}
                icon={<Wallet size={18} color={colors.emerald} />}
              />
              <StatTile
                label={t.analytics.conversion}
                value={`${data?.trialConversion?.rate ?? 0}%`}
                accent="teal"
                isRTL={isRTL}
                icon={<TrendingUp size={18} color={colors.teal} />}
              />
              <StatTile
                label={t.analytics.hwRate}
                value={`${data?.homework?.completionRate ?? 0}%`}
                accent="emerald"
                isRTL={isRTL}
                icon={<BookOpenCheck size={18} color={colors.emerald} />}
              />
              <StatTile
                label={t.analytics.upcoming7}
                value={data?.upcomingSevenDays ?? 0}
                accent="gold"
                isRTL={isRTL}
                icon={<CalendarClock size={18} color={colors.goldDark} />}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={[styles.sectionTitle, { textAlign: align }]}>
                {t.analytics.monthlyChartTitle}
              </Text>
              {(data?.monthlySessions || []).length === 0 ? (
                <Text style={[styles.emptyLine, { textAlign: align }]}>{t.sessions.emptyCompleted}</Text>
              ) : (
                (data?.monthlySessions || []).map((row) => {
                  const pct = Math.max(8, Math.round((row.count / maxCount) * 100));
                  return (
                    <View key={row.month} style={[styles.barRow, { flexDirection: rowDir }]}>
                      <Text style={styles.monthText}>{row.month}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.countText}>{row.count}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  emptyLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  barRow: { alignItems: 'center', gap: spacing.sm },
  monthText: { width: 64, fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.emerald },
  countText: { width: 32, fontSize: 13, fontFamily: fonts.extraBold, color: colors.emeraldDark, textAlign: 'center' },
});
