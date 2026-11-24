import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BookOpen, CheckCircle2, Flame, Star } from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { formatDateTime } from '../../src/lib/formatters';
import { StudentSummaryResponse } from '../../src/types/teacher';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonDashboard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { StatTile } from '../../src/components/StatTile';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

export default function StudentDetailScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<StudentSummaryResponse | null>(null);

  const loadSummary = useCallback(
    async (isRefresh = false) => {
      if (!studentId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const res = await api.get<StudentSummaryResponse>(
          `/api/teachers/dashboard/students/${encodeURIComponent(String(studentId))}/summary`,
          { auth: true }
        );
        setSummary(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.errorGeneric);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [studentId, t.common.errorGeneric]
  );

  useEffect(() => {
    void loadSummary(false);
  }, [loadSummary]);

  const student = summary?.student;
  const progress = summary?.progress;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={student?.name || t.students.viewSummary}
        subtitle={
          student
            ? `${student.preferredTrack || t.common.unspecified} • ${student.currentLevel || t.common.unspecified}`
            : undefined
        }
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadSummary(true)} tintColor={colors.emerald} />
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
            onAction={() => void loadSummary(false)}
          />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatTile
                label={t.students.sessionsCompleted}
                value={progress?.completedSessions ?? 0}
                accent="emerald"
                isRTL={isRTL}
                icon={<CheckCircle2 size={18} color={colors.emerald} />}
              />
              <StatTile
                label={locale === 'ar' ? 'الآيات المحفوظة' : 'Ayahs'}
                value={progress?.totalMemorizedAyahs ?? 0}
                accent="gold"
                isRTL={isRTL}
                icon={<BookOpen size={18} color={colors.goldDark} />}
              />
              <StatTile
                label={t.sessions.scoreMemorization}
                value={(progress?.averageMemorization ?? 0).toFixed(1)}
                accent="teal"
                isRTL={isRTL}
                icon={<Star size={18} color={colors.teal} />}
              />
              <StatTile
                label={locale === 'ar' ? 'السلسلة (أيام)' : 'Streak'}
                value={progress?.streakDays ?? 0}
                accent="gold"
                isRTL={isRTL}
                icon={<Flame size={18} color={colors.goldDark} />}
              />
            </View>

            {/* Direct Teacher Actions for this Student */}
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <PrimaryButton
                label={locale === 'ar' ? '📖 مصحف التصحيح وخريطة الختمة (30 جزءاً)' : '📖 Mushaf Board & 30-Juz Map'}
                onPress={() =>
                  router.push({
                    pathname: '/mushaf-board',
                    params: { studentId: String(studentId || ''), studentName: student?.name || '' },
                  })
                }
                icon={<BookOpen size={17} color={colors.textInverse} />}
              />
              <PrimaryButton
                label={locale === 'ar' ? '🏅 إرسال بطاقة إنجاز وتكريم لولي الأمر' : '🏅 Send Award Card to Parent'}
                variant="gold"
                onPress={() =>
                  router.push({
                    pathname: '/achievement-card',
                    params: {
                      studentId: String(studentId || ''),
                      studentName: student?.name || '',
                      surah: progress?.currentSurah || 'القرآن الكريم',
                    },
                  })
                }
                icon={<Award size={17} color={colors.emeraldDeep} />}
              />
            </View>

            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { textAlign: align }]}>
                {locale === 'ar' ? 'آخر الحصص والتقييمات' : 'Recent Sessions'}
              </Text>
              {(summary?.recentSessions || []).length === 0 ? (
                <Text style={[styles.emptyLine, { textAlign: align }]}>{t.sessions.emptyCompleted}</Text>
              ) : (
                (summary?.recentSessions || []).slice(0, 8).map((sess) => (
                  <View key={sess._id} style={styles.rowItem}>
                    <Text style={[styles.itemTitle, { textAlign: align }]}>
                      {formatDateTime(sess.scheduledAt, locale)}
                    </Text>
                    {sess.evaluation?.surahRecited ? (
                      <Text style={[styles.itemSub, { textAlign: align }]}>
                        📖 {sess.evaluation.surahRecited} ({sess.evaluation.fromAyah || '-'} - {sess.evaluation.toAyah || '-'})
                      </Text>
                    ) : null}
                    {sess.evaluation?.overallNotes ? (
                      <Text style={[styles.itemSub, { textAlign: align }]}>{sess.evaluation.overallNotes}</Text>
                    ) : null}
                  </View>
                ))
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
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
  rowItem: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
    gap: 3,
  },
  itemTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  itemSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 19 },
});
