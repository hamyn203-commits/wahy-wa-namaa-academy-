import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Flame,
  Gamepad2,
  HelpCircle,
  Puzzle,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { GameTier } from '../../src/data/quranGamesData';
import { loadGameProgress, QuranGameProgress } from '../../src/lib/gameProgress';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

export default function QuranGamesHubScreen() {
  const router = useRouter();
  const { isRTL } = useI18n();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [tier, setTier] = useState<GameTier>('all');
  const [progress, setProgress] = useState<QuranGameProgress>({
    xp: 0,
    gamesWon: 0,
    streakDays: 0,
    lastPlayedDate: '',
    gardenTrees: 1,
    gardenFlowers: 2,
    gardenLanterns: 0,
    bestCombo: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void loadGameProgress().then(setProgress);
    }, [])
  );

  const level = Math.floor(progress.xp / 150) + 1;
  const levelPct = Math.min(100, Math.round(((progress.xp % 150) / 150) * 100));

  const games = [
    {
      mode: 'puzzle',
      titleAr: '🧩 رتّب الآية',
      titleEn: '🧩 Ayah Word Puzzle',
      descAr: 'رتّب كلمات الآية بالترتيب الصحيح لتثبيت حفظك بسرعة ومتعة',
      descEn: 'Tap scrambled Quranic words in exact order to lock in Hifz',
      xp: '+40 XP',
      bg: colors.emeraldSoft,
      color: colors.emeraldDark,
      icon: Puzzle,
    },
    {
      mode: 'missing',
      titleAr: '🔍 اكتشف الكلمة المفقودة',
      titleEn: '🔍 Missing Word Quest',
      descAr: 'اختر الكلمة الناقصة من الآية الكريمة وتدرّب على قوة الاستحضار',
      descEn: 'Pick the missing Quranic word from 4 smart choices',
      xp: '+35 XP',
      bg: colors.goldSoft,
      color: colors.goldDark,
      icon: HelpCircle,
    },
    {
      mode: 'tajweed',
      titleAr: '⚡ صائد أحكام التجويد',
      titleEn: '⚡ Tajweed Hunter',
      descAr: 'اصطد الحكم التجويدي الصحيح (إدغام / إخفاء / قلقلة / مد) مع الشرح',
      descEn: 'Spot Tajweed rules in real verses with instant explanations',
      xp: '+45 XP',
      bg: colors.infoSoft,
      color: colors.info,
      icon: Zap,
    },
    {
      mode: 'mutashabihat',
      titleAr: '⚔️ مبارزة المتشابهات',
      titleEn: '⚔️ Mutashabihat Duel',
      descAr: 'ميّز بين الآيات والسور المتشابهة — تحدي الأبطال والحفّاظ!',
      descEn: 'Master similar Quranic verses and sharpen precision',
      xp: '+50 XP',
      bg: colors.tealSoft,
      color: colors.teal,
      icon: Swords,
    },
  ] as const;

  const openGame = (mode: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/games/play', params: { mode, tier } });
  };

  const unlockedBadges = [
    { key: 'seed', label: isRTL ? '🌱 بذرة الحفظ' : '🌱 First Win', unlocked: progress.gamesWon >= 1 },
    { key: 'streak', label: isRTL ? '🔥 ملتزم يومياً' : '🔥 Streak', unlocked: progress.streakDays >= 2 },
    { key: 'combo', label: isRTL ? '⚡ بطل الدقة' : '⚡ Combo Pro', unlocked: progress.bestCombo >= 4 },
    { key: 'master', label: isRTL ? '🏆 نجم وحي ونماء' : '🏆 Quran Star', unlocked: progress.xp >= 200 },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        badge={isRTL ? 'بدون موسيقى • تعلّم بمتعة' : 'Ad-Free • Fun Hifz'}
        title={isRTL ? 'عالم الألعاب القرآنية' : 'Quran Games Arcade'}
        subtitle={isRTL ? 'العب وتحدَّ نفسك يومياً لتثبيت الحفظ والتجويد بدون ملل!' : 'Play daily Quran & Tajweed quests — never get bored!'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Player Stats & My Quran Garden */}
        <View style={styles.gardenCard}>
          <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
            <View style={[styles.statPill, { flexDirection: rowDir }]}>
              <Trophy size={15} color={colors.goldBright} />
              <Text style={styles.statPillText}>
                {isRTL ? `المستوى ${level}` : `Lvl ${level}`} • {progress.xp} XP
              </Text>
            </View>
            <View style={[styles.statPill, { flexDirection: rowDir }]}>
              <Flame size={15} color="#FF9F43" />
              <Text style={styles.statPillText}>
                {progress.streakDays} {isRTL ? 'أيام متتالية' : 'day streak'}
              </Text>
            </View>
          </View>

          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.max(8, levelPct)}%` }]} />
          </View>

          <Text style={[styles.gardenTitle, { textAlign: align }]}>
            🌱 {isRTL ? 'حديقتك القرآنية التفاعلية' : 'Your Interactive Quran Garden'}
          </Text>
          <Text style={[styles.gardenSub, { textAlign: align }]}>
            {isRTL
              ? 'كل لعبة تكسبها تُنبت زهرة جديدة، والنتيجة الكاملة تزرع شجرة في حديقتك!'
              : 'Every win grows a flower; a perfect score plants a new tree!'}
          </Text>

          <View style={styles.gardenCanvas}>
            <Text style={styles.gardenEmojis}>
              {'🌳'.repeat(Math.min(8, progress.gardenTrees))}
              {'🌸'.repeat(Math.min(10, progress.gardenFlowers))}
              {'🏮'.repeat(Math.min(6, progress.gardenLanterns))}
            </Text>
            <Text style={styles.gardenCounts}>
              {progress.gardenTrees} 🌳  •  {progress.gardenFlowers} 🌸  •  {progress.gardenLanterns} 🏮
            </Text>
          </View>
        </View>

        {/* 2-Minute Daily Quest CTA */}
        <View style={styles.dailyCard}>
          <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
            <View style={styles.dailyIcon}>
              <Sparkles size={22} color={colors.emeraldDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.dailyTitle, { textAlign: align }]}>
                🔥 {isRTL ? 'التحدي اليومي في دقيقتين' : '2-Minute Daily Quest'}
              </Text>
              <Text style={[styles.dailySub, { textAlign: align }]}>
                {isRTL ? '6 جولات متنوعة (حفظ + تجويد + متشابهات) بضعف النقاط!' : '6 mixed rounds for double XP!'}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={isRTL ? 'ابدأ التحدي اليومي الآن' : 'Start Daily Quest'}
            variant="gold"
            onPress={() => openGame('daily')}
            icon={<Gamepad2 size={18} color={colors.emeraldDeep} />}
          />
        </View>

        {/* Difficulty Tier Selector */}
        <View style={styles.tierCard}>
          <Text style={[styles.sectionTitle, { textAlign: align, marginTop: 0 }]}>
            {isRTL ? '🎯 اختر مستوى التحدي' : '🎯 Select Difficulty'}
          </Text>
          <View style={[styles.tierRow, { flexDirection: rowDir }]}>
            {(
              [
                { id: 'all', ar: 'الكل (60 سؤالاً)', en: 'All (60)' },
                { id: 'beginner', ar: 'مبتدئ — جزء عمّ', en: 'Beginner' },
                { id: 'intermediate', ar: 'متوسط', en: 'Intermediate' },
                { id: 'advanced', ar: 'متقدم — حفّاظ', en: 'Advanced' },
              ] as const
            ).map((opt) => {
              const active = tier === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setTier(opt.id);
                  }}
                  style={[styles.tierChip, active && styles.tierChipActive]}
                >
                  <Text style={[styles.tierChipText, active && styles.tierChipTextActive]}>
                    {isRTL ? opt.ar : opt.en}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Badges Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tierRow, { flexDirection: rowDir }]}>
          {unlockedBadges.map((b) => (
            <View key={b.key} style={[styles.badgeItem, !b.unlocked && styles.badgeLocked]}>
              <Text style={[styles.badgeText, !b.unlocked && styles.badgeTextLocked]}>{b.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Individual Games */}
        <Text style={[styles.sectionTitle, { textAlign: align }]}>
          {isRTL ? 'اختر لعبتك المفضلة' : 'Choose Your Game'}
        </Text>

        {games.map((g) => {
          const Icon = g.icon;
          return (
            <Pressable
              key={g.mode}
              onPress={() => openGame(g.mode)}
              style={({ pressed }) => [styles.gameCard, { flexDirection: rowDir }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.gameIcon, { backgroundColor: g.bg }]}>
                <Icon size={24} color={g.color} />
              </View>
              <View style={styles.flex}>
                <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                  <Text style={[styles.gameTitle, { textAlign: align }]}>
                    {isRTL ? g.titleAr : g.titleEn}
                  </Text>
                  <View style={styles.xpBadge}>
                    <Text style={styles.xpBadgeText}>{g.xp}</Text>
                  </View>
                </View>
                <Text style={[styles.gameDesc, { textAlign: align }]}>
                  {isRTL ? g.descAr : g.descEn}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  gardenCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  statPill: {
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
  xpTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: colors.goldBright, borderRadius: radius.pill },
  gardenTitle: { color: colors.goldBright, fontSize: 15, fontFamily: fonts.extraBold, marginTop: 4 },
  gardenSub: { color: colors.mint, fontSize: 12, fontFamily: fonts.medium },
  gardenCanvas: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,107,0.30)',
  },
  gardenEmojis: { fontSize: 22, textAlign: 'center', lineHeight: 32 },
  gardenCounts: { color: colors.textInverse, fontSize: 12, fontFamily: fonts.bold },
  dailyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  dailyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  dailySub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  sectionTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary, marginTop: 4 },
  gameCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  gameIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.textPrimary },
  gameDesc: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 19, marginTop: 2 },
  xpBadge: {
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  xpBadgeText: { fontSize: 11, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  tierCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  tierRow: { flexWrap: 'wrap', gap: spacing.xs },
  tierChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  tierChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  tierChipTextActive: { color: colors.white },
  badgeItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeLocked: { backgroundColor: colors.ivoryDeep, borderColor: colors.border, opacity: 0.6 },
  badgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  badgeTextLocked: { color: colors.textTertiary },
});
