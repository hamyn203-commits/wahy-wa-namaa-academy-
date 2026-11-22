import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, CheckCircle2, FileBadge2, Star, Trophy } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { ProgressRing } from '../src/components/ProgressRing';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { BadgeEntry, CertificateItem, EvaluationItem, LocalizedText } from '../src/types/academy';

type ProgressTab = 'juz' | 'evaluations' | 'awards';

function pickText(v: string | LocalizedText | undefined, locale: 'ar' | 'en'): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[locale] || v.ar || v.en || '';
}

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [tab, setTab] = useState<ProgressTab>('juz');
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const memorizedJuz = Math.min(30, Math.max(0, Number(user?.memorizedJuz ?? 0)));
  const percent = Math.round((memorizedJuz / 30) * 100);

  const loadAll = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const [evalRes, badgeRes, certRes] = await Promise.allSettled([
        api.get<{ evaluations?: EvaluationItem[] } | EvaluationItem[]>('/api/students/dashboard/evaluations', { auth: true }),
        api.get<{ unlocked?: BadgeEntry[] }>('/api/gamification/my-badges', { auth: true }),
        api.get<{ certificates?: CertificateItem[] } | CertificateItem[]>('/api/certificates/my-certificates', { auth: true }),
      ]);

      if (evalRes.status === 'fulfilled') {
        const raw = evalRes.value;
        setEvaluations(Array.isArray(raw) ? raw : raw.evaluations ?? []);
      }
      if (badgeRes.status === 'fulfilled') {
        setBadges(badgeRes.value.unlocked ?? []);
      }
      if (certRes.status === 'fulfilled') {
        const raw = certRes.value;
        setCertificates(Array.isArray(raw) ? raw : raw.certificates ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'رحلة الحفظ والإنجازات' : 'Memorization & Awards'}
        subtitle={locale === 'ar' ? 'تتبع الأجزاء المحفوظة وتقييمات معلمك وشهاداتك.' : 'Track memorized Juz, teacher evaluations, badges & certificates.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.emerald} />
        }
      >
        <View style={[styles.summaryCard, { flexDirection: rowDir }]}>
          <ProgressRing
            percent={percent}
            size={94}
            strokeWidth={9}
            valueText={`${memorizedJuz}/30`}
            label={t.home.juzUnit}
          />
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'إنجازك في كتاب الله' : 'Your Quran Milestone'}
            </Text>
            <Text style={[styles.summaryMeta, { textAlign: align }]}>
              {locale === 'ar'
                ? `${memorizedJuz} جزء محفوظ • ${badges.length} وسام • ${certificates.length} شهادة`
                : `${memorizedJuz} Juz • ${badges.length} Badges • ${certificates.length} Certificates`}
            </Text>
          </View>
        </View>

        <View style={[styles.tabBar, { flexDirection: rowDir }]}>
          {([
            { key: 'juz', ar: 'خريطة الأجزاء', en: '30 Juz' },
            { key: 'evaluations', ar: 'تقييمات المعلم', en: 'Evaluations' },
            { key: 'awards', ar: 'الأوسمة والشهادات', en: 'Awards' },
          ] as const).map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {locale === 'ar' ? item.ar : item.en}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <SkeletonCard lines={3} />
        ) : tab === 'juz' ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'أجزاء القرآن الكريم (30 جزءاً)' : '30 Juz Tracker'}
            </Text>
            <View style={styles.juzGrid}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
                const done = num <= memorizedJuz;
                return (
                  <View key={num} style={[styles.juzCell, done && styles.juzCellDone]}>
                    {done ? <CheckCircle2 size={13} color={colors.white} /> : null}
                    <Text style={[styles.juzNum, done && styles.juzNumDone]}>{num}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : tab === 'evaluations' ? (
          evaluations.length === 0 ? (
            <StateView
              mode="empty"
              title={locale === 'ar' ? 'لا توجد تقييمات مسجلة بعد' : 'No evaluations yet'}
              description={locale === 'ar' ? 'بعد إتمام كل حصة، ستظهر هنا درجات الحفظ والتجويد وملاحظات معلمك.' : 'After completing sessions, teacher ratings and notes will appear here.'}
            />
          ) : (
            evaluations.map((ev) => (
              <View key={ev._id} style={styles.card}>
                <View style={[styles.evalHead, { flexDirection: rowDir }]}>
                  <Text style={styles.cardTitle}>
                    {ev.teacherEvaluation?.surah
                      || ev.teacher?.personalInfo?.fullName
                      || ev.teacher?.user?.name
                      || (locale === 'ar' ? 'تقييم حصة' : 'Session Evaluation')}
                  </Text>
                  {ev.teacherEvaluation?.overallRating ? (
                    <View style={styles.starPill}>
                      <Star size={13} color={colors.goldDark} fill={colors.gold} />
                      <Text style={styles.starText}>{ev.teacherEvaluation.overallRating}/5</Text>
                    </View>
                  ) : null}
                </View>
                {ev.teacherEvaluation?.notes ? (
                  <Text style={[styles.noteText, { textAlign: align }]}>{ev.teacherEvaluation.notes}</Text>
                ) : null}
                {ev.scheduledAt ? (
                  <Text style={[styles.dateText, { textAlign: align }]}>
                    {new Date(ev.scheduledAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                  </Text>
                ) : null}
              </View>
            ))
          )
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.card}>
              <View style={[styles.evalHead, { flexDirection: rowDir }]}>
                <Trophy size={18} color={colors.goldDark} />
                <Text style={styles.cardTitle}>{locale === 'ar' ? 'الأوسمة المكتسبة' : 'Unlocked Badges'}</Text>
              </View>
              {badges.length === 0 ? (
                <Text style={[styles.noteText, { textAlign: align }]}>
                  {locale === 'ar' ? 'أكمل حصصك وواجباتك لفتح أول وسام لك!' : 'Complete classes and homework to unlock badges!'}
                </Text>
              ) : (
                badges.map((b) => (
                  <View key={b._id} style={[styles.awardRow, { flexDirection: rowDir }]}>
                    <Award size={18} color={colors.emerald} />
                    <Text style={styles.awardTitle}>{pickText(b.badge?.name, locale) || 'وسام'}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <View style={[styles.evalHead, { flexDirection: rowDir }]}>
                <FileBadge2 size={18} color={colors.emerald} />
                <Text style={styles.cardTitle}>{locale === 'ar' ? 'الشهادات' : 'Certificates'}</Text>
              </View>
              {certificates.length === 0 ? (
                <Text style={[styles.noteText, { textAlign: align }]}>
                  {locale === 'ar' ? 'ستظهر هنا شهادات الإتمام والإجازات الصادرة من الأكاديمية.' : 'Academy completion certificates will appear here.'}
                </Text>
              ) : (
                certificates.map((c) => (
                  <View key={c._id} style={[styles.awardRow, { flexDirection: rowDir }]}>
                    <FileBadge2 size={18} color={colors.goldDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.awardTitle, { textAlign: align }]}>
                        {pickText(c.title || c.course?.title, locale) || c.certificateId}
                      </Text>
                      {c.certificateId ? (
                        <Text style={[styles.dateText, { textAlign: align }]}>{c.certificateId}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderMint,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
    ...shadows.elevated,
  },
  summaryInfo: { flex: 1, gap: 4 },
  summaryTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  summaryMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 20 },
  tabBar: {
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
    ...shadows.card,
  },
  tabBtn: {
    flex: 1,
    minHeight: TOUCH_MIN - 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBtnActive: { backgroundColor: colors.emerald },
  tabText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, textAlign: 'center' },
  tabTextActive: { color: colors.textInverse },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  juzGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  juzCell: {
    width: '14%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  juzCellDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  juzNum: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  juzNumDone: { color: colors.white },
  evalHead: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  starText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  noteText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  dateText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
  awardRow: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  awardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
});
