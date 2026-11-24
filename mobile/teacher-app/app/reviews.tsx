import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { formatShortDate } from '../src/lib/formatters';
import { TeacherReviewItem } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

export default function TeacherReviewsScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [reviews, setReviews] = useState<TeacherReviewItem[]>([]);

  const loadReviews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get<{
        reviews?: TeacherReviewItem[];
        averageRating?: number;
        totalReviews?: number;
      }>('/api/teachers/dashboard/reviews', { auth: true });
      setReviews(res.reviews || []);
      setAverage(Number(res.averageRating || 0));
      setTotal(Number(res.totalReviews || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadReviews(false);
  }, [loadReviews]);

  const renderReview = useCallback(
    ({ item }: { item: TeacherReviewItem }) => (
      <View style={styles.card}>
        <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
          <Text style={styles.studentName}>{item.student?.name || t.common.studentFallback}</Text>
          <View style={styles.starRow}>
            <Star size={14} color={colors.goldDark} fill={colors.gold} />
            <Text style={styles.ratingVal}>{Number(item.rating || 0).toFixed(1)}</Text>
          </View>
        </View>
        {item.comment ? <Text style={[styles.comment, { textAlign: align }]}>{item.comment}</Text> : null}
        <Text style={[styles.dateText, { textAlign: align }]}>{formatShortDate(item.createdAt, locale)}</Text>
      </View>
    ),
    [align, locale, rowDir, t.common.studentFallback]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.reviews.title}
        subtitle={t.reviews.subtitle}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadReviews(false)}
          />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadReviews(true)} tintColor={colors.emerald} />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <Star size={30} color={colors.gold} fill={colors.gold} />
              <Text style={styles.bigAvg}>{average.toFixed(1)} / 5.0</Text>
              <Text style={styles.totalLabel}>{total} {t.reviews.totalReviews}</Text>
            </View>
          }
          ListEmptyComponent={<StateView mode="empty" title={t.reviews.empty} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  pad: { padding: spacing.lg, gap: spacing.md },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
    ...shadows.elevated,
  },
  bigAvg: { color: colors.goldBright, fontSize: 28, fontFamily: fonts.extraBold },
  totalLabel: { color: colors.mint, fontSize: 13, fontFamily: fonts.semiBold },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between' },
  studentName: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.textPrimary },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  ratingVal: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.goldDark },
  comment: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },
  dateText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
});
