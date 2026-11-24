import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Bell, BookOpen, PhoneOff, Radio, Trophy } from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { SITE_URL } from '../../src/lib/config';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, spacing } from '../../src/theme/tokens';

interface StudentRemoteClassroomState {
  mushaf?: {
    page?: number;
    ayahKey?: string;
    hifzVeilMode?: string;
  };
  activeGame?: {
    roundId?: string;
    status?: 'idle' | 'active' | 'revealed';
    prompt?: string;
    surahName?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
  };
  engagement?: {
    totalStars?: number;
    lastReaction?: {
      id: string;
      label: string;
      emoji: string;
      timestamp: number;
    } | null;
  };
  whiteboard?: {
    permission?: string;
    boardsFrozen?: boolean;
  };
  controls?: {
    micPolicy?: string;
    allowHandRaise?: boolean;
  };
}

/**
 * In-App Student Live Classroom Screen V2.0
 * Embeds the synced Mushaf & Video classroom + Native Live Companion HUD:
 * - Haptic Spiritual Badge celebration banner (zero music)
 * - 1-tap Active Listener Bell for group circles
 * - Instant Native Challenge Overlay when the teacher launches a multiple-choice game!
 */
export default function LiveClassroomScreen() {
  useKeepAwake();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { locale, isRTL, t } = useI18n();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [roomState, setRoomState] = useState<StudentRemoteClassroomState>({});
  const [celebrationBanner, setCelebrationBanner] = useState<{ emoji: string; label: string } | null>(null);
  const [bellNotice, setBellNotice] = useState(false);
  const [answeredRoundId, setAnsweredRoundId] = useState('');
  const [answerResultText, setAnswerResultText] = useState('');

  const lastReactionIdRef = useRef('');
  const webViewRef = useRef<WebView | null>(null);
  const pushedWebTokenRef = useRef<string | null>(null);
  const rawRoom = String(roomId || '').trim();
  const cleanRoom = encodeURIComponent(rawRoom);

  const pushTokenToWebView = useCallback((nextToken: string | null) => {
    if (!nextToken || nextToken === pushedWebTokenRef.current || !webViewRef.current) return;
    pushedWebTokenRef.current = nextToken;
    const escaped = JSON.stringify(nextToken);
    webViewRef.current.injectJavaScript(
      `try { window.sessionStorage.setItem('wwn_mobile_token', ${escaped}); window.dispatchEvent(new CustomEvent('wwn:mobile-token', { detail: { token: ${escaped} } })); } catch (e) {} true;`
    );
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await Audio.requestPermissionsAsync();
      } catch {
        // non-blocking
      }
      const accessToken = await api.hydrateToken();
      if (active) {
        pushedWebTokenRef.current = accessToken;
        setToken(accessToken);
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const pollClassroomState = useCallback(async () => {
    if (!rawRoom) return;
    try {
      const res = await api.get<{ classroomState?: StudentRemoteClassroomState }>(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/state`,
        { auth: true }
      );
      pushTokenToWebView(api.getAccessToken());
      if (res?.classroomState) {
        setRoomState(res.classroomState);
        const rx = res.classroomState.engagement?.lastReaction;
        if (rx?.id && rx.id !== lastReactionIdRef.current) {
          lastReactionIdRef.current = rx.id;
          if (Date.now() - (rx.timestamp || 0) < 12000) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCelebrationBanner({ emoji: rx.emoji || '🌟', label: rx.label || 'ما شاء الله!' });
            setTimeout(() => setCelebrationBanner(null), 4000);
          }
        }
      }
    } catch {
      // non-blocking
    }
  }, [pushTokenToWebView, rawRoom]);

  useEffect(() => {
    if (!ready || !rawRoom) return undefined;
    void pollClassroomState();
    const timer = setInterval(() => {
      void pollClassroomState();
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, rawRoom, pollClassroomState]);

  const handleListenerBell = async () => {
    if (!rawRoom || bellNotice) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/listener-bell`,
        {
          page: roomState.mushaf?.page || 1,
          ayahKey: roomState.mushaf?.ayahKey || '',
        },
        { auth: true }
      );
      setBellNotice(true);
      setTimeout(() => setBellNotice(false), 5000);
    } catch {
      // cooldown active
    }
  };

  const handleNativeGameAnswer = async (opt: string) => {
    const roundId = roomState.activeGame?.roundId || '';
    if (!rawRoom || !roundId || answeredRoundId === roundId) return;
    setAnsweredRoundId(roundId);
    try {
      const res = await api.post<{ submission?: { isCorrect: boolean; starsAwarded: number } }>(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/game-answer`,
        { answer: opt },
        { auth: true }
      );
      if (res?.submission?.isCorrect) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnswerResultText(`ما شاء الله! إجابة صحيحة 🌟 (+${res.submission.starsAwarded} نجوم)`);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAnswerResultText('تم إرسال إجابتك — تابع كشف النتيجة مع المعلم');
      }
    } catch {
      setAnswerResultText('تم إرسال إجابتك بالفعل');
    }
  };

  const classroomUrl = `${SITE_URL}/${locale}/live/${cleanRoom}`;
  const injectedAuthJs = token
    ? `try { window.sessionStorage.setItem('wwn_mobile_token', ${JSON.stringify(token)}); } catch (e) {} true;`
    : 'true;';

  const totalStars = roomState.engagement?.totalStars ?? 0;
  const syncedPage = roomState.mushaf?.page ?? 1;
  const activeGame = roomState.activeGame;
  const showNativeQuickQuiz =
    activeGame?.status === 'active' &&
    Boolean(activeGame.roundId) &&
    Array.isArray(activeGame.options) &&
    activeGame.options.length > 0 &&
    answeredRoundId !== activeGame.roundId;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.liveBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Radio size={14} color={colors.goldBright} />
          <Text style={styles.liveTitle} numberOfLines={1}>
            {locale === 'ar' ? 'الحلقة التفاعلية' : 'Interactive Room'}
          </Text>
          <View style={styles.metaChip}>
            <BookOpen size={11} color={colors.mint} />
            <Text style={styles.metaChipText}>ص {syncedPage}</Text>
          </View>
          {roomState.whiteboard?.permission === 'all_miniboards' ? (
            <View style={styles.starsChip}>
              <Text style={styles.starsText}>🎨 لوحك مفتوح</Text>
            </View>
          ) : null}
          <View style={styles.starsChip}>
            <Trophy size={11} color={colors.goldBright} />
            <Text style={styles.starsText}>{totalStars}</Text>
          </View>
        </View>

        <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {roomState.controls?.allowHandRaise !== false ? (
            <Pressable
              onPress={() => void handleListenerBell()}
              style={({ pressed }) => [styles.bellBtn, bellNotice && styles.bellBtnSent, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Bell size={13} color={bellNotice ? colors.emeraldNight : colors.goldBright} />
              <Text style={[styles.bellText, bellNotice && styles.bellTextSent]}>
                {bellNotice ? (locale === 'ar' ? 'أُرسل ✓' : 'Sent') : (locale === 'ar' ? 'يقظ' : 'Alert')}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.exitBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <PhoneOff size={14} color={colors.white} />
            <Text style={styles.exitText}>{locale === 'ar' ? 'خروج' : 'Leave'}</Text>
          </Pressable>
        </View>
      </View>

      {/* شارة التشجيع الروحانية الفورية بدون موسيقى */}
      {celebrationBanner ? (
        <View style={styles.celebrationBar}>
          <Text style={styles.celebrationText}>
            {celebrationBanner.emoji} {celebrationBanner.label}
          </Text>
        </View>
      ) : null}

      <View style={styles.webWrap}>
        {!ready ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingText}>{t.common.loading}</Text>
          </View>
        ) : loadFailed ? (
          <View style={styles.errorWrap}>
            <StateView
              mode="error"
              title={locale === 'ar' ? 'تعذر تحميل الحلقة المباشرة' : 'Unable to load classroom'}
              description={locale === 'ar' ? 'تأكد من اتصال الإنترنت وحاول إعادة الدخول.' : 'Check your internet connection and retry.'}
              actionLabel={t.common.retry}
              onAction={() => setLoadFailed(false)}
            />
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{
              uri: classroomUrl,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }}
            injectedJavaScriptBeforeContentLoaded={injectedAuthJs}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            allowsFullscreenVideo
            originWhitelist={['https://wahywanamaa.com', 'https://*.wahywanamaa.com']}
            onError={() => setLoadFailed(true)}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.overlayLoad}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>
                  {locale === 'ar' ? 'جاري تجهيز قاعة الحلقة التفاعلية...' : 'Preparing classroom...'}
                </Text>
              </View>
            )}
          />
        )}

        {/* بطاقة التحدي القرآني الفوري الأصلية للطالب على الهاتف */}
        {showNativeQuickQuiz && activeGame ? (
          <View style={styles.quizSheet}>
            <Text style={styles.quizBadge}>🎮 تحدٍّ مباشر من المعلم • {activeGame.surahName || 'قرآن كريم'}</Text>
            <Text style={styles.quizPrompt}>{activeGame.prompt}</Text>
            <View style={styles.quizGrid}>
              {(activeGame.options || []).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => void handleNativeGameAnswer(opt)}
                  style={({ pressed }) => [styles.quizOptBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.quizOptText}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : answerResultText && activeGame?.roundId === answeredRoundId ? (
          <Pressable onPress={() => setAnswerResultText('')} style={styles.resultPill}>
            <Text style={styles.resultPillText}>{answerResultText}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  topBar: {
    backgroundColor: colors.emeraldNight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 107, 0.25)',
    gap: spacing.xs,
  },
  liveBadge: { alignItems: 'center', gap: 6, flex: 1 },
  liveTitle: { color: colors.textInverse, fontSize: 13, fontFamily: fonts.bold, flexShrink: 1 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  metaChipText: { color: colors.mint, fontSize: 11, fontFamily: fonts.bold },
  starsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.2)',
  },
  starsText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  actionsRow: { alignItems: 'center', gap: 6 },
  bellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.16)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  bellBtnSent: { backgroundColor: colors.goldBright },
  bellText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  bellTextSent: { color: colors.emeraldNight },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.85 },
  exitText: { color: colors.white, fontSize: 11, fontFamily: fonts.bold },
  celebrationBar: {
    backgroundColor: colors.goldBright,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  celebrationText: { color: colors.emeraldNight, fontSize: 13, fontFamily: fonts.bold },
  webWrap: { flex: 1, backgroundColor: colors.emeraldDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  overlayLoad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { color: colors.mint, fontSize: 14, fontFamily: fonts.bold },
  errorWrap: { flex: 1, backgroundColor: colors.ivory, padding: spacing.lg, justifyContent: 'center' },
  quizSheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.ivory,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.gold,
    gap: spacing.sm,
    elevation: 10,
  },
  quizBadge: { color: colors.emerald, fontSize: 11, fontFamily: fonts.bold, textAlign: 'center' },
  quizPrompt: { color: colors.emeraldNight, fontSize: 16, fontFamily: fonts.quranBold, textAlign: 'center' },
  quizGrid: { gap: 8 },
  quizOptBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  quizOptText: { color: colors.emeraldDeep, fontSize: 14, fontFamily: fonts.bold },
  resultPill: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  resultPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
});
