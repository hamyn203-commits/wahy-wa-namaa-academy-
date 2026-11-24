import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, RotateCcw, Sparkles, Star, Trophy, XCircle } from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import {
  AYAH_PUZZLES,
  AyahPuzzleItem,
  ENCOURAGEMENT_QUOTES_AR,
  GameTier,
  MISSING_WORD_QUESTIONS,
  MissingWordItem,
  MUTASHABIHAT_QUESTIONS,
  MutashabihatQuestion,
  TAJWEED_QUESTIONS,
  TajweedQuestion,
} from '../../src/data/quranGamesData';
import { recordGameWin } from '../../src/lib/gameProgress';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

type RoundItem =
  | { kind: 'puzzle'; data: AyahPuzzleItem }
  | { kind: 'missing'; data: MissingWordItem }
  | { kind: 'tajweed'; data: TajweedQuestion }
  | { kind: 'mutashabihat'; data: MutashabihatQuestion };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function filterByTier<T extends { tier: string }>(arr: T[], tier: GameTier): T[] {
  if (!tier || tier === 'all') return arr;
  const matched = arr.filter((item) => item.tier === tier);
  return matched.length >= 3 ? matched : arr;
}

function buildDeck(mode: string, tier: GameTier = 'all'): RoundItem[] {
  const puzzles = filterByTier(AYAH_PUZZLES, tier);
  const missing = filterByTier(MISSING_WORD_QUESTIONS, tier);
  const tajweed = filterByTier(TAJWEED_QUESTIONS, tier);
  const mutash = filterByTier(MUTASHABIHAT_QUESTIONS, tier);

  if (mode === 'puzzle') {
    return shuffle(puzzles).slice(0, 6).map((data) => ({ kind: 'puzzle', data }));
  }
  if (mode === 'missing') {
    return shuffle(missing).slice(0, 6).map((data) => ({ kind: 'missing', data }));
  }
  if (mode === 'tajweed') {
    return shuffle(tajweed).slice(0, 6).map((data) => ({ kind: 'tajweed', data }));
  }
  if (mode === 'mutashabihat') {
    return shuffle(mutash).slice(0, 5).map((data) => ({ kind: 'mutashabihat', data }));
  }
  return [
    ...shuffle(puzzles).slice(0, 2).map((data): RoundItem => ({ kind: 'puzzle', data })),
    ...shuffle(missing).slice(0, 2).map((data): RoundItem => ({ kind: 'missing', data })),
    ...shuffle(tajweed).slice(0, 1).map((data): RoundItem => ({ kind: 'tajweed', data })),
    ...shuffle(mutash).slice(0, 1).map((data): RoundItem => ({ kind: 'mutashabihat', data })),
  ];
}

export default function PlayQuranGameScreen() {
  const router = useRouter();
  const { mode = 'daily', tier = 'all' } = useLocalSearchParams<{ mode?: string; tier?: GameTier }>();
  const { isRTL } = useI18n();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [deckSeed, setDeckSeed] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => buildDeck(String(mode), (tier as GameTier) || 'all'), [mode, tier, deckSeed]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Per-round interactive state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [pickedWordIndices, setPickedWordIndices] = useState<number[]>([]);

  const current = deck[index];

  const shuffledWords = useMemo(() => {
    if (!current || current.kind !== 'puzzle') return [];
    return shuffle(current.data.words.map((word, idx) => ({ word, origIdx: idx })));
  }, [current]);

  const shuffledOptions = useMemo(() => {
    if (!current || current.kind === 'puzzle') return [];
    return shuffle(current.data.options);
  }, [current]);

  const completeRound = (isCorrect: boolean) => {
    if (isCorrect) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((prev) => Math.max(prev, nextCombo));
      setCorrectCount((prev) => prev + 1);
      setScore((prev) => prev + 10 * Math.min(3, nextCombo));
      setRoundResult('correct');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setCombo(0);
      setRoundResult('wrong');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const handleOptionPress = (opt: string) => {
    if (roundResult !== 'idle' || !current || current.kind === 'puzzle') return;
    setSelectedOption(opt);
    completeRound(opt === current.data.answer);
  };

  const handleWordTap = (tileIndex: number) => {
    if (roundResult !== 'idle' || !current || current.kind !== 'puzzle') return;
    if (pickedWordIndices.includes(tileIndex)) return;
    void Haptics.selectionAsync().catch(() => {});

    const nextPicked = [...pickedWordIndices, tileIndex];
    setPickedWordIndices(nextPicked);

    if (nextPicked.length === current.data.words.length) {
      const builtSentence = nextPicked.map((i) => shuffledWords[i].word).join(' ');
      const targetSentence = current.data.words.join(' ');
      completeRound(builtSentence === targetSentence);
    }
  };

  const handleNext = async () => {
    if (index + 1 >= deck.length) {
      const earnedXp = score + (mode === 'daily' ? 30 : 15);
      await recordGameWin({
        earnedXp,
        bestCombo,
        perfect: correctCount === deck.length,
      });
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSelectedOption(null);
    setRoundResult('idle');
    setPickedWordIndices([]);
  };

  const handleReplay = () => {
    setDeckSeed((s) => s + 1);
    setIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    setFinished(false);
    setSelectedOption(null);
    setRoundResult('idle');
    setPickedWordIndices([]);
  };

  const titleMap: Record<string, string> = {
    puzzle: isRTL ? '🧩 رتّب الآية' : 'Ayah Puzzle',
    missing: isRTL ? '🔍 الكلمة المفقودة' : 'Missing Word',
    tajweed: isRTL ? '⚡ صائد التجويد' : 'Tajweed Hunter',
    mutashabihat: isRTL ? '⚔️ مبارزة المتشابهات' : 'Mutashabihat Duel',
    daily: isRTL ? '🔥 التحدي اليومي' : 'Daily Quest',
  };

  if (finished) {
    const perfect = correctCount === deck.length;
    const earnedXp = score + (mode === 'daily' ? 30 : 15);
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <IslamicHero
          title={isRTL ? 'أحسنت يا بطل القرآن! 🏆' : 'Well Done! 🏆'}
          isRTL={isRTL}
          onBack={() => router.back()}
          compact
        />
        <ScrollView contentContainerStyle={styles.victoryWrap}>
          <View style={styles.victoryCard}>
            <View style={styles.trophyCircle}>
              <Trophy size={42} color={colors.goldBright} />
            </View>
            <Text style={styles.victoryTitle}>
              {perfect
                ? (isRTL ? 'نتيجة كاملة ما شاء الله! 🌟' : 'Perfect Score! 🌟')
                : (isRTL ? 'جولة رائعة — استمر!' : 'Great Round!')}
            </Text>
            <Text style={styles.victoryScore}>
              {correctCount} / {deck.length}  •  +{earnedXp} XP
            </Text>
            <View style={styles.gardenReward}>
              <Sparkles size={18} color={colors.emerald} />
              <Text style={styles.gardenRewardText}>
                {perfect
                  ? (isRTL ? '🌳 نبتت شجرة وزهرة جديدة في حديقتك القرآنية!' : '🌳 A new tree & flower grew in your Quran Garden!')
                  : (isRTL ? '🌸 نبتت زهرة جديدة في حديقتك القرآنية!' : '🌸 A new flower grew in your Quran Garden!')}
              </Text>
            </View>
            {isRTL ? (
              <Text style={styles.hadithQuote}>
                {ENCOURAGEMENT_QUOTES_AR[deckSeed % ENCOURAGEMENT_QUOTES_AR.length]}
              </Text>
            ) : null}

            <PrimaryButton
              label={isRTL ? 'العب جولة جديدة' : 'Play Again'}
              variant="gold"
              onPress={handleReplay}
              icon={<RotateCcw size={17} color={colors.emeraldDeep} />}
              style={styles.fullBtn}
            />
            <PrimaryButton
              label={isRTL ? 'العودة لعالم الألعاب' : 'Back to Games'}
              variant="secondary"
              onPress={() => router.back()}
              style={styles.fullBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <IslamicHero
        title={titleMap[String(mode)] || titleMap.daily}
        subtitle={`${isRTL ? 'الجولة' : 'Round'} ${index + 1} / ${deck.length}  •  ${score} XP${combo >= 2 ? `  •  🔥 x${Math.min(3, combo)}` : ''}`}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress bar */}
        <View style={styles.progTrack}>
          <View style={[styles.progFill, { width: `${Math.round(((index + 1) / deck.length) * 100)}%` }]} />
        </View>

        {current.kind === 'puzzle' ? (
          <View style={styles.card}>
            <Text style={styles.surahPill}>
              📖 سورة {current.data.surahAr} — آية {current.data.ayahNumber}
            </Text>
            <Text style={[styles.prompt, { textAlign: align }]}>
              {isRTL ? 'اضغط على الكلمات بالترتيب الصحيح لتكوين الآية:' : 'Tap the words in the right order:'}
            </Text>

            {/* Built Answer Tray */}
            <View style={styles.tray}>
              {pickedWordIndices.length === 0 ? (
                <Text style={styles.trayPlaceholder}>
                  {isRTL ? 'ستظهر الآية هنا أثناء الترتيب...' : 'Verse appears here...'}
                </Text>
              ) : (
                <Text style={styles.quranDisplay}>
                  {pickedWordIndices.map((i) => shuffledWords[i].word).join(' ')}
                </Text>
              )}
            </View>

            {pickedWordIndices.length > 0 && roundResult === 'idle' ? (
              <Pressable onPress={() => setPickedWordIndices([])} style={styles.resetWordsBtn}>
                <RotateCcw size={14} color={colors.emeraldDark} />
                <Text style={styles.resetWordsText}>{isRTL ? 'إعادة الترتيب' : 'Reset'}</Text>
              </Pressable>
            ) : null}

            {/* Scrambled Word Tiles */}
            <View style={[styles.wordBank, { flexDirection: rowDir }]}>
              {shuffledWords.map((tile, idx) => {
                const used = pickedWordIndices.includes(idx);
                return (
                  <Pressable
                    key={`${tile.origIdx}-${idx}`}
                    disabled={used || roundResult !== 'idle'}
                    onPress={() => handleWordTap(idx)}
                    style={[styles.wordTile, used && styles.wordTileUsed]}
                  >
                    <Text style={[styles.wordTileText, used && styles.wordTileTextUsed]}>
                      {tile.word}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : current.kind === 'missing' ? (
          <View style={styles.card}>
            <Text style={styles.surahPill}>
              📖 سورة {current.data.surahAr} — آية {current.data.ayahNumber}
            </Text>
            <Text style={[styles.prompt, { textAlign: align }]}>
              {isRTL ? 'أكمل الكلمة الناقصة من الآية:' : 'Complete the missing Quranic word:'}
            </Text>
            <View style={styles.quranBox}>
              <Text style={styles.quranDisplay}>
                ﴿ {current.data.before} {' ______ '} {current.data.after} ﴾
              </Text>
            </View>
            <View style={styles.optionsList}>
              {shuffledOptions.map((opt) => {
                const isPicked = selectedOption === opt;
                const isAnswer = opt === current.data.answer;
                return (
                  <Pressable
                    key={opt}
                    disabled={roundResult !== 'idle'}
                    onPress={() => handleOptionPress(opt)}
                    style={[
                      styles.optBtn,
                      roundResult !== 'idle' && isAnswer && styles.optCorrect,
                      roundResult !== 'idle' && isPicked && !isAnswer && styles.optWrong,
                    ]}
                  >
                    <Text style={styles.optQuranText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : current.kind === 'tajweed' ? (
          <View style={styles.card}>
            <Text style={styles.surahPill}>⚡ {isRTL ? 'حكم تجويدي — سورة' : 'Tajweed — Surah'} {current.data.surahAr}</Text>
            <View style={styles.quranBox}>
              <Text style={styles.quranDisplay}>﴿ {current.data.excerpt} ﴾</Text>
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightText}>🎯 {current.data.highlighted}</Text>
              </View>
            </View>
            <Text style={[styles.prompt, { textAlign: align }]}>
              {isRTL ? 'ما هو الحكم التجويدي في الموضع المظلّل؟' : 'What is the Tajweed rule here?'}
            </Text>
            <View style={styles.optionsList}>
              {shuffledOptions.map((opt) => {
                const isPicked = selectedOption === opt;
                const isAnswer = opt === current.data.answer;
                return (
                  <Pressable
                    key={opt}
                    disabled={roundResult !== 'idle'}
                    onPress={() => handleOptionPress(opt)}
                    style={[
                      styles.optBtn,
                      roundResult !== 'idle' && isAnswer && styles.optCorrect,
                      roundResult !== 'idle' && isPicked && !isAnswer && styles.optWrong,
                    ]}
                  >
                    <Text style={styles.optText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.surahPill}>⚔️ {isRTL ? 'مبارزة المتشابهات' : 'Mutashabihat Duel'}</Text>
            <View style={styles.quranBox}>
              <Text style={styles.quranDisplay}>﴿ {current.data.opening} ﴾</Text>
            </View>
            <Text style={[styles.prompt, { textAlign: align }]}>
              {isRTL ? current.data.promptAr : current.data.promptEn}
            </Text>
            <View style={styles.optionsList}>
              {shuffledOptions.map((opt) => {
                const isPicked = selectedOption === opt;
                const isAnswer = opt === current.data.answer;
                return (
                  <Pressable
                    key={opt}
                    disabled={roundResult !== 'idle'}
                    onPress={() => handleOptionPress(opt)}
                    style={[
                      styles.optBtn,
                      roundResult !== 'idle' && isAnswer && styles.optCorrect,
                      roundResult !== 'idle' && isPicked && !isAnswer && styles.optWrong,
                    ]}
                  >
                    <Text style={styles.optText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Instant Educational Feedback Banner */}
        {roundResult !== 'idle' ? (
          <View style={[styles.feedbackCard, roundResult === 'correct' ? styles.fbCorrect : styles.fbWrong]}>
            <View style={[styles.fbHead, { flexDirection: rowDir }]}>
              {roundResult === 'correct' ? (
                <CheckCircle2 size={22} color={colors.emerald} />
              ) : (
                <XCircle size={22} color={colors.danger} />
              )}
              <Text style={[styles.fbTitle, roundResult === 'correct' ? styles.fbTitleGood : styles.fbTitleBad]}>
                {roundResult === 'correct'
                  ? (isRTL ? 'إجابة صحيحة! ما شاء الله ⭐' : 'Correct! MashaAllah ⭐')
                  : (isRTL ? 'حاول التركيز — هذه الإجابة الصحيحة:' : 'Good try — correct answer:')}
              </Text>
            </View>

            {current.kind === 'puzzle' ? (
              <Text style={styles.fbQuran}>﴿ {current.data.words.join(' ')} ﴾</Text>
            ) : current.kind === 'tajweed' ? (
              <Text style={[styles.fbExplain, { textAlign: align }]}>
                {isRTL ? current.data.explanationAr : current.data.explanationEn}
              </Text>
            ) : current.kind === 'mutashabihat' ? (
              <Text style={[styles.fbExplain, { textAlign: align }]}>{current.data.tipAr}</Text>
            ) : (
              <Text style={styles.fbQuran}>
                ﴿ {current.data.before} {current.data.answer} {current.data.after} ﴾
              </Text>
            )}

            <PrimaryButton
              label={index + 1 >= deck.length ? (isRTL ? 'عرض النتيجة النهائية 🏆' : 'See Final Score 🏆') : (isRTL ? 'الجولة التالية' : 'Next Round')}
              onPress={() => void handleNext()}
              icon={<Star size={16} color={colors.textInverse} />}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  progTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    overflow: 'hidden',
  },
  progFill: { height: '100%', backgroundColor: colors.emerald, borderRadius: radius.pill },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  surahPill: {
    alignSelf: 'center',
    backgroundColor: colors.goldSoft,
    color: colors.goldDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    fontSize: 12,
    fontFamily: fonts.bold,
    overflow: 'hidden',
  },
  prompt: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 22 },
  quranBox: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.sand,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  quranDisplay: {
    fontSize: 22,
    fontFamily: fonts.quranBold,
    color: colors.emeraldDeep,
    textAlign: 'center',
    lineHeight: 40,
  },
  highlightBadge: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  highlightText: { fontSize: 14, fontFamily: fonts.bold, color: colors.goldDark },
  tray: {
    minHeight: 74,
    backgroundColor: colors.mintSoft,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.emerald,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trayPlaceholder: { fontSize: 13, fontFamily: fonts.medium, color: colors.textTertiary },
  resetWordsBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
  },
  resetWordsText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  wordBank: { flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  wordTile: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadows.card,
  },
  wordTileUsed: { opacity: 0.25, borderColor: colors.border },
  wordTileText: { fontSize: 19, fontFamily: fonts.quranBold, color: colors.emeraldDeep },
  wordTileTextUsed: { color: colors.textTertiary },
  optionsList: { gap: spacing.sm },
  optBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optCorrect: { backgroundColor: colors.emeraldSoft, borderColor: colors.emerald },
  optWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  optText: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  optQuranText: { fontSize: 20, fontFamily: fonts.quranBold, color: colors.emeraldDeep, textAlign: 'center' },
  feedbackCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  fbCorrect: { backgroundColor: colors.emeraldSoft, borderColor: colors.emerald },
  fbWrong: { backgroundColor: colors.dangerSoft, borderColor: '#F3B8B2' },
  fbHead: { alignItems: 'center', gap: spacing.sm },
  fbTitle: { flex: 1, fontSize: 15, fontFamily: fonts.extraBold },
  fbTitleGood: { color: colors.emeraldDark },
  fbTitleBad: { color: colors.danger },
  fbQuran: { fontSize: 19, fontFamily: fonts.quranBold, color: colors.emeraldDeep, textAlign: 'center', lineHeight: 34 },
  fbExplain: { fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary, lineHeight: 21 },
  victoryWrap: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  victoryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.elevated,
  },
  trophyCircle: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryTitle: { fontSize: 20, fontFamily: fonts.extraBold, color: colors.emeraldDeep, textAlign: 'center' },
  victoryScore: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.goldDark },
  gardenReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emeraldSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  gardenRewardText: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark, textAlign: 'center' },
  hadithQuote: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.goldDark,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  fullBtn: { width: '100%' },
});
