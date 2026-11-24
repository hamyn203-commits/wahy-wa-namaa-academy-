import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Bell, BookOpen, CheckCircle, PhoneOff, Radio, Sparkles, Star, Trophy } from 'lucide-react-native';
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
    sessionEnded?: boolean;
    endedAtMs?: number;
  };
}

interface EndedSessionContext {
  sessionId?: string | null;
  sessionType?: 'trial' | 'regular' | 'group_circle' | string;
  teacherId?: string | null;
  teacherName?: string;
  title?: string;
}

const MOBILE_PRAISE_TAGS_AR = ['إتقان التجويد', 'صبر وتشجيع', 'شرح واضح', 'التزام بالموعد'];
const MOBILE_PRAISE_TAGS_EN = ['Great Tajweed', 'Patient & kind', 'Clear teaching', 'On time'];

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
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionContext, setSessionContext] = useState<EndedSessionContext | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [selectedPraise, setSelectedPraise] = useState<string[]>([]);
  const [ratingComment, setRatingComment] = useState('');
  const [wouldContinue, setWouldContinue] = useState(true);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const sessionEndedNotifiedRef = useRef(false);
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

  const triggerLearnerSessionEnd = useCallback((ctx?: EndedSessionContext | null) => {
    if (ctx) {
      setSessionContext((prev) => ({ ...(prev || {}), ...ctx }));
    }
    if (!sessionEndedNotifiedRef.current) {
      sessionEndedNotifiedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSessionEnded(true);
  }, []);

  const pollClassroomState = useCallback(async () => {
    if (!rawRoom || sessionEndedNotifiedRef.current) return;
    try {
      const res = await api.get<{
        sessionEnded?: boolean;
        sessionContext?: EndedSessionContext;
        classroomState?: StudentRemoteClassroomState;
      }>(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/state`,
        { auth: true }
      );
      pushTokenToWebView(api.getAccessToken());
      if (res?.sessionContext) {
        setSessionContext(res.sessionContext);
      }
      if (res?.sessionEnded || res?.classroomState?.controls?.sessionEnded) {
        triggerLearnerSessionEnd(res?.sessionContext || null);
        return;
      }
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
  }, [pushTokenToWebView, rawRoom, triggerLearnerSessionEnd]);

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

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.nativeEvent.data || '{}')) as {
          type?: string;
          sessionContext?: EndedSessionContext;
        };
        if (parsed?.type === 'WWN_SESSION_ENDED') {
          triggerLearnerSessionEnd(parsed.sessionContext || null);
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [triggerLearnerSessionEnd]
  );

  const togglePraiseChip = (chip: string) => {
    setSelectedPraise((prev) =>
      prev.includes(chip) ? prev.filter((item) => item !== chip) : [...prev, chip]
    );
  };

  const submitPostSessionRating = async () => {
    if (submittingRating) return;
    const sid = sessionContext?.sessionId || '';
    if (!sid) {
      router.replace('/(tabs)/sessions');
      return;
    }
    setSubmittingRating(true);
    setRatingError('');
    const finalComment = [
      selectedPraise.length ? selectedPraise.join(' · ') : '',
      ratingComment.trim(),
    ]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 1000);

    try {
      try {
        await api.post(
          '/api/reviews',
          {
            sessionId: sid,
            teacherId: sessionContext?.teacherId || undefined,
            rating: ratingStars,
            comment: finalComment,
            wouldContinue,
          },
          { auth: true }
        );
      } catch (revErr) {
        const msg = revErr instanceof Error ? revErr.message : '';
        if (!msg.toLowerCase().includes('already reviewed')) {
          throw revErr;
        }
      }
      await api
        .put(
          `/api/sessions/${encodeURIComponent(sid)}/feedback`,
          { rating: ratingStars, comment: finalComment, wouldContinue },
          { auth: true }
        )
        .catch(() => {});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/sessions');
    } catch (err) {
      setRatingError(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'تعذر إرسال التقييم حالياً'
            : 'Could not submit rating right now'
      );
      setSubmittingRating(false);
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

  if (sessionEnded) {
    const isAr = locale === 'ar';
    const tutorDisplay = sessionContext?.teacherName || (isAr ? 'معلم الحلقة' : 'Your Tutor');
    const sType = sessionContext?.sessionType || 'regular';
    const typeLabel =
      sType === 'trial'
        ? isAr ? 'حصة تجريبية' : 'Trial Session'
        : sType === 'group_circle'
          ? isAr ? 'حلقة جماعية' : 'Group Circle'
          : isAr ? 'حصة فردية' : '1-on-1 Session';
    const praiseList = isAr ? MOBILE_PRAISE_TAGS_AR : MOBILE_PRAISE_TAGS_EN;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.ratingScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.ratingCard}>
              <View style={styles.ratingHero}>
                <View style={styles.endedPill}>
                  <CheckCircle size={14} color={colors.goldBright} />
                  <Text style={styles.endedPillText}>{typeLabel}</Text>
                </View>
                <Text style={styles.endedSubText}>
                  {isAr ? 'تقبّل الله منكم — انتهت الحصة بحمد الله' : 'The session has ended'}
                </Text>
                <Text style={styles.ratingTitle}>
                  {isAr ? 'قيّم المعلم والحصة' : 'Rate Your Tutor & Session'}
                </Text>
                <Text style={styles.ratingTutorName}>{tutorDisplay}</Text>
              </View>

              <View style={styles.ratingBody}>
                <View style={[styles.starsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {[1, 2, 3, 4, 5].map((st) => {
                    const active = st <= ratingStars;
                    return (
                      <Pressable
                        key={st}
                        disabled={submittingRating}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setRatingStars(st);
                        }}
                        style={[styles.starBtn, active && styles.starBtnActive]}
                      >
                        <Star
                          size={26}
                          color={active ? colors.goldDark : colors.textTertiary}
                          fill={active ? colors.gold : 'transparent'}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.ratingScoreText}>{ratingStars} / 5</Text>

                <View style={[styles.praiseWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {praiseList.map((chip) => {
                    const chosen = selectedPraise.includes(chip);
                    return (
                      <Pressable
                        key={chip}
                        disabled={submittingRating}
                        onPress={() => togglePraiseChip(chip)}
                        style={[styles.praiseChip, chosen && styles.praiseChipActive]}
                      >
                        <Sparkles size={12} color={chosen ? colors.emeraldDark : colors.textSecondary} />
                        <Text style={[styles.praiseChipText, chosen && styles.praiseChipTextActive]}>
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  editable={!submittingRating}
                  multiline
                  numberOfLines={3}
                  placeholder={
                    isAr
                      ? 'اكتب انطباعك عن شرح المعلم وأسلوبه (اختياري)…'
                      : 'Share your feedback about the session (optional)…'
                  }
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.commentInput, { textAlign: isRTL ? 'right' : 'left' }]}
                />

                <View style={[styles.continueRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.continueLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {isAr
                      ? 'أرغب في الاستمرار بالدراسة مع هذا المعلم'
                      : 'I would like to continue with this tutor'}
                  </Text>
                  <Switch
                    value={wouldContinue}
                    onValueChange={setWouldContinue}
                    disabled={submittingRating}
                    trackColor={{ false: colors.borderSoft, true: colors.emerald }}
                  />
                </View>

                {ratingError ? <Text style={styles.ratingErrText}>{ratingError}</Text> : null}

                <Pressable
                  disabled={submittingRating}
                  onPress={() => void submitPostSessionRating()}
                  style={({ pressed }) => [
                    styles.submitRatingBtn,
                    (pressed || submittingRating) && styles.pressed,
                  ]}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.submitRatingText}>
                      {isAr ? 'إرسال التقييم والعودة لحصصي' : 'Submit Rating & Return'}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  disabled={submittingRating}
                  onPress={() => router.replace('/(tabs)/sessions')}
                  style={styles.skipRatingBtn}
                >
                  <Text style={styles.skipRatingText}>
                    {isAr ? 'تخطي الآن والعودة لحصصي' : 'Skip for now'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
            onMessage={handleWebViewMessage}
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
  ratingScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  ratingCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  ratingHero: {
    backgroundColor: colors.emeraldDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  endedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 107, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  endedPillText: { color: colors.goldBright, fontSize: 12, fontFamily: fonts.bold },
  endedSubText: { color: colors.mint, fontSize: 12, fontFamily: fonts.medium, textAlign: 'center' },
  ratingTitle: { color: colors.white, fontSize: 20, fontFamily: fonts.extraBold, textAlign: 'center' },
  ratingTutorName: { color: colors.goldBright, fontSize: 15, fontFamily: fonts.bold, textAlign: 'center' },
  ratingBody: { padding: spacing.lg, gap: spacing.md },
  starsRow: { justifyContent: 'center', alignItems: 'center', gap: 8 },
  starBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  ratingScoreText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.emeraldDark,
  },
  praiseWrap: { flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  praiseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.ivory,
  },
  praiseChipActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldSoft,
  },
  praiseChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  praiseChipTextActive: { color: colors.emeraldDark },
  commentInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  continueRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  continueLabel: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  ratingErrText: { fontSize: 12, fontFamily: fonts.bold, color: colors.danger, textAlign: 'center' },
  submitRatingBtn: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitRatingText: { color: colors.white, fontSize: 15, fontFamily: fonts.bold },
  skipRatingBtn: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipRatingText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bold },
});
