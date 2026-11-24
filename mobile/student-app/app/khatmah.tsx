import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Award, BookOpen, CheckCircle2, Sparkles } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

type JuzStatus = 'not_started' | 'in_progress' | 'memorized' | 'mastered';

interface KhatmahPayload {
  khatmahJuz: Array<{ juzNumber: number; status: JuzStatus; certifiedByName?: string }>;
  annotations: Array<{
    _id: string;
    surahNumber: number;
    surahName?: string;
    ayahNumber: number;
    wordText?: string;
    type: 'memorization' | 'tajweed' | 'tashkeel';
    note?: string;
    resolved?: boolean;
  }>;
  summary: {
    masteredCount: number;
    memorizedCount: number;
    completionPercent: number;
    openAnnotationsCount: number;
  };
}

function emptyKhatmah(): KhatmahPayload {
  return {
    khatmahJuz: Array.from({ length: 30 }).map((_, i) => ({ juzNumber: i + 1, status: 'not_started' })),
    annotations: [],
    summary: { masteredCount: 0, memorizedCount: 0, completionPercent: 0, openAnnotationsCount: 0 },
  };
}

export default function StudentKhatmahScreen() {
  const router = useRouter();
  const { isRTL } = useI18n();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<KhatmahPayload>(emptyKhatmah);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get<KhatmahPayload>('/api/mushaf-progress/my', { auth: true });
      if (res?.khatmahJuz) setData(res);
    } catch {
      // Graceful fallback if backend is still deploying
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const juzStyle = (st: JuzStatus) => {
    if (st === 'mastered') return { bg: colors.emerald, border: colors.gold, text: colors.white, tag: '🏆' };
    if (st === 'memorized') return { bg: colors.emeraldSoft, border: colors.emerald, text: colors.emeraldDark, tag: '✓' };
    if (st === 'in_progress') return { bg: colors.goldSoft, border: colors.gold, text: colors.goldDark, tag: '◐' };
    return { bg: colors.cream, border: colors.borderSoft, text: colors.textTertiary, tag: '' };
  };

  const openNotes = data.annotations.filter((a) => !a.resolved);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        badge={isRTL ? 'رحلة الختمة المباركة' : 'Blessed Khatmah Journey'}
        title={isRTL ? 'خريطة ختمتي وملاحظات شيخي' : 'My Khatmah & Teacher Notes'}
        subtitle={isRTL ? 'تابع الأجزاء التي أتممتها ومواضع المراجعة الملوّنة من معلمك' : 'Track your 30 Juz & teacher Mushaf notes'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.emerald} />}
      >
        {loading ? (
          <SkeletonCard lines={4} />
        ) : (
          <>
            {/* Summary Banner */}
            <View style={styles.banner}>
              <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                <View style={styles.flex}>
                  <Text style={[styles.bannerTitle, { textAlign: align }]}>
                    {isRTL
                      ? `أتممت ${data.summary.memorizedCount} من 30 جزءاً`
                      : `${data.summary.memorizedCount} / 30 Juz Memorized`}
                  </Text>
                  <Text style={[styles.bannerSub, { textAlign: align }]}>
                    {isRTL
                      ? `🏆 ${data.summary.masteredCount} أجزاء متقنة ومعتمدة من المعلم`
                      : `🏆 ${data.summary.masteredCount} Juz mastered & certified`}
                  </Text>
                </View>
                <View style={styles.pctCircle}>
                  <Award size={22} color={colors.goldBright} />
                  <Text style={styles.pctCircleText}>{data.summary.completionPercent}%</Text>
                </View>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(4, data.summary.completionPercent)}%` }]} />
              </View>
            </View>

            {/* 30 Juz Grid */}
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { textAlign: align }]}>
                {isRTL ? 'أجزاء القرآن الكريم (30 جزءاً)' : '30 Juz of the Holy Quran'}
              </Text>
              <View style={styles.juzGrid}>
                {data.khatmahJuz.map((j) => {
                  const st = juzStyle(j.status);
                  return (
                    <View key={j.juzNumber} style={[styles.juzTile, { backgroundColor: st.bg, borderColor: st.border }]}>
                      <Text style={[styles.juzNum, { color: st.text }]}>{j.juzNumber}</Text>
                      <Text style={[styles.juzTag, { color: st.text }]}>{st.tag || (isRTL ? 'جزء' : 'Juz')}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Color-Coded Teacher Notes */}
            <View style={styles.card}>
              <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                <Text style={[styles.sectionTitle, { textAlign: align }]}>
                  {isRTL ? `مواضع للمراجعة من معلمك (${openNotes.length})` : `Notes from Your Teacher (${openNotes.length})`}
                </Text>
                <Sparkles size={17} color={colors.goldDark} />
              </View>

              {openNotes.length === 0 ? (
                <View style={styles.allClean}>
                  <CheckCircle2 size={26} color={colors.emerald} />
                  <Text style={styles.allCleanText}>
                    {isRTL ? 'ما شاء الله! لا توجد أخطاء معلّقة على مصحفك حالياً.' : 'All clear! No pending Mushaf corrections.'}
                  </Text>
                </View>
              ) : (
                openNotes.map((ann) => {
                  const color =
                    ann.type === 'memorization' ? colors.danger : ann.type === 'tajweed' ? colors.warning : colors.info;
                  const bg =
                    ann.type === 'memorization' ? colors.dangerSoft : ann.type === 'tajweed' ? colors.warningSoft : colors.infoSoft;
                  const label =
                    ann.type === 'memorization'
                      ? (isRTL ? '🔴 مراجعة حفظ' : '🔴 Hifz')
                      : ann.type === 'tajweed'
                        ? (isRTL ? '🟠 انتبه للتجويد' : '🟠 Tajweed')
                        : (isRTL ? '🔵 ضبط التشكيل' : '🔵 Tashkeel');
                  return (
                    <View key={ann._id} style={[styles.noteCard, { borderColor: color }]}>
                      <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                        <View style={[styles.tag, { backgroundColor: bg }]}>
                          <Text style={[styles.tagText, { color }]}>{label}</Text>
                        </View>
                        <Text style={styles.locText}>
                          {ann.surahName || `سورة ${ann.surahNumber}`} • آية {ann.ayahNumber}
                        </Text>
                      </View>
                      {ann.wordText ? <Text style={[styles.wordText, { textAlign: align }]}>﴿ {ann.wordText} ﴾</Text> : null}
                      {ann.note ? <Text style={[styles.noteBody, { textAlign: align }]}>{ann.note}</Text> : null}
                    </View>
                  );
                })
              )}

              <PrimaryButton
                label={isRTL ? 'افتح المصحف للمراجعة الآن' : 'Open Mushaf to Review'}
                onPress={() => router.push('/mushaf')}
                icon={<BookOpen size={17} color={colors.textInverse} />}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  banner: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.elevated,
  },
  bannerTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.white },
  bannerSub: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.mint, marginTop: 2 },
  pctCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctCircleText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.goldBright },
  barTrack: { height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.goldBright, borderRadius: radius.pill },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.textPrimary },
  juzGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  juzTile: {
    width: '18%',
    minWidth: 54,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzNum: { fontSize: 16, fontFamily: fonts.extraBold },
  juzTag: { fontSize: 10, fontFamily: fonts.bold },
  allClean: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  allCleanText: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark, textAlign: 'center' },
  noteCard: { borderRadius: radius.md, borderWidth: 1.2, padding: spacing.md, gap: 6, backgroundColor: colors.cream },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { fontSize: 11, fontFamily: fonts.bold },
  locText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textPrimary },
  wordText: { fontSize: 18, fontFamily: fonts.quranBold, color: colors.emeraldDeep },
  noteBody: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 20 },
});
