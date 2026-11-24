import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  Award,
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  Gamepad2,
  PhoneOff,
  Radio,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { SITE_URL } from '../../src/lib/config';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, spacing } from '../../src/theme/tokens';

interface ListenerAlertItem {
  id: string;
  studentId: string;
  studentName: string;
  page: number;
}

interface RemoteClassroomState {
  mushaf?: {
    page?: number;
    hifzVeilMode?: 'none' | 'heads' | 'alternating' | 'full';
  };
  activeGame?: {
    roundId?: string;
    status?: 'idle' | 'active' | 'revealed';
    submissions?: Array<{ studentName: string; isCorrect: boolean }>;
  };
  engagement?: {
    totalStars?: number;
    activeListenerAlerts?: ListenerAlertItem[];
  };
  whiteboard?: {
    mode?: string;
    permission?: string;
    boardsFrozen?: boolean;
  };
  controls?: {
    micPolicy?: 'open' | 'reciter_only' | 'locked';
    cameraAllowed?: boolean;
  };
}

const QUICK_MOBILE_CHALLENGES = [
  {
    mode: 'missing_word',
    label: '🎯 الكلمة المفقودة',
    surahName: 'سورة الملك',
    ayahNumber: 2,
    prompt: 'لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ _____',
    options: ['عَمَلًا', 'قَوْلًا', 'صَبْرًا', 'ذِكْرًا'],
    correctAnswer: 'عَمَلًا',
    explanation: 'الآية الثانية من سورة الملك: أيكم أحسن عملاً.',
  },
  {
    mode: 'tajweed_hunter',
    label: '🎙️ صائد التجويد',
    surahName: 'سورة الفاتحة',
    ayahNumber: 7,
    prompt: 'ما نوع المد في كلمة: «الضَّالِّينَ»؟',
    options: ['مد لازم كلمي مثقّل (6 حركات)', 'مد واجب متصل', 'مد عارض للسكون', 'مد طبيعي'],
    correctAnswer: 'مد لازم كلمي مثقّل (6 حركات)',
    explanation: 'حرف مد تلاه حرف مشدد في كلمة واحدة فيُمد 6 حركات لزوماً.',
  },
  {
    mode: 'intruder_word',
    label: '🕵️ الكلمة الدخيلة',
    surahName: 'سورة العاديات',
    ayahNumber: 11,
    prompt: 'أين اللفظ الدخيل في: «إِنَّ رَبَّهُم بِهِمْ يَوْمَئِذٍ لَّبَصِيرٌ»؟',
    options: ['لَّبَصِيرٌ (الصواب: لَّخَبِيرٌ)', 'رَبَّهُم', 'بِهِمْ', 'يَوْمَئِذٍ'],
    correctAnswer: 'لَّبَصِيرٌ (الصواب: لَّخَبِيرٌ)',
    explanation: 'خاتمة سورة العاديات: «إِنَّ رَبَّهُم بِهِمْ يَوْمَئِذٍ لَّخَبِيرٌ».',
  },
];

/**
 * In-App Teacher Live Classroom Screen V2.0
 * Combines embedded LiveKit/Smart-Classroom WebView + Native Quick Control Dock
 * (1-tap spiritual badges, Hifz veil modes, Active-Listener rewards, and instant live challenges).
 */
export default function TeacherLiveClassroomScreen() {
  useKeepAwake();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { locale, isRTL, t } = useI18n();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [roomState, setRoomState] = useState<RemoteClassroomState>({});
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const prevAlertsCountRef = useRef(0);
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
        // Non-blocking
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

  const syncStateFromServer = useCallback(async () => {
    if (!rawRoom) return;
    try {
      const res = await api.get<{ classroomState?: RemoteClassroomState }>(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/state`,
        { auth: true }
      );
      pushTokenToWebView(api.getAccessToken());
      if (res?.classroomState) {
        const nextAlerts = res.classroomState.engagement?.activeListenerAlerts || [];
        if (nextAlerts.length > prevAlertsCountRef.current) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        prevAlertsCountRef.current = nextAlerts.length;
        setRoomState(res.classroomState);
      }
    } catch {
      // Room may still be provisioning
    }
  }, [pushTokenToWebView, rawRoom]);

  useEffect(() => {
    if (!ready || !rawRoom) return undefined;
    void syncStateFromServer();
    const timer = setInterval(() => {
      void syncStateFromServer();
    }, 3500);
    return () => clearInterval(timer);
  }, [ready, rawRoom, syncStateFromServer]);

  const sendHostPatch = async (patch: Record<string, unknown>, feedbackAr: string) => {
    if (!rawRoom) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.patch<{ classroomState?: RemoteClassroomState }>(
        `/api/live/sessions/${encodeURIComponent(rawRoom)}/state`,
        patch,
        { auth: true }
      );
      if (res?.classroomState) {
        setRoomState(res.classroomState);
      }
      setStatusFeedback(feedbackAr);
      setTimeout(() => setStatusFeedback(''), 2400);
    } catch {
      setStatusFeedback('تعذر إرسال الأمر للغرفة حالياً');
      setTimeout(() => setStatusFeedback(''), 2400);
    }
  };

  const classroomUrl = `${SITE_URL}/${locale}/live/${cleanRoom}`;
  const injectedAuthJs = token
    ? `try { window.sessionStorage.setItem('wwn_mobile_token', ${JSON.stringify(token)}); } catch (e) {} true;`
    : 'true;';

  const totalStars = roomState.engagement?.totalStars ?? 0;
  const currentVeil = roomState.mushaf?.hifzVeilMode || 'none';
  const listenerAlerts = roomState.engagement?.activeListenerAlerts || [];
  const activeGameStatus = roomState.activeGame?.status || 'idle';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.liveBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Radio size={14} color={colors.goldBright} />
          <Text style={styles.liveTitle} numberOfLines={1}>
            {locale === 'ar' ? 'قاعة المعلم الذكية' : 'Smart Teacher Room'}
          </Text>
          <View style={styles.starsChip}>
            <Trophy size={12} color={colors.goldBright} />
            <Text style={styles.starsText}>{totalStars}</Text>
          </View>
        </View>

        <View style={[styles.headerBtns, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => setDockExpanded((v) => !v)}
            style={({ pressed }) => [styles.dockToggleBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Sparkles size={13} color={colors.goldBright} />
            <Text style={styles.dockToggleText}>{locale === 'ar' ? 'أدواتي' : 'Tools'}</Text>
            {dockExpanded ? (
              <ChevronUp size={13} color={colors.goldBright} />
            ) : (
              <ChevronDown size={13} color={colors.goldBright} />
            )}
          </Pressable>

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

      {/* تنبيه فوري للمستمع اليقظ في الحلقات الجماعية */}
      {listenerAlerts.length > 0 ? (
        <View style={[styles.listenerBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Bell size={14} color={colors.emeraldDeep} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listenerScroll}>
            {listenerAlerts.map((al) => (
              <Pressable
                key={al.id}
                onPress={() =>
                  void sendHostPatch(
                    { rewardListenerAlertId: al.id },
                    `تم منح نجمة المستمع اليقظ لـ ${al.studentName} 🌟`
                  )
                }
                style={styles.listenerChip}
              >
                <Award size={12} color={colors.emerald} />
                <Text style={styles.listenerChipText}>
                  {al.studentName} (ص {al.page}) +⭐
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* شريط التحكم السريع الأصلي للمعلم (تشجيع فوري + ستار الحفظ + إطلاق تحدٍّ حي) */}
      {dockExpanded ? (
        <View style={styles.quickDock}>
          {statusFeedback ? <Text style={styles.feedbackToast}>{statusFeedback}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dockRow}>
            <Pressable
              onPress={() =>
                void sendHostPatch(
                  { reaction: { badgeKey: 'mashallah', label: 'ما شاء الله تبارك الله!', emoji: '🌟', starsDelta: 2 } },
                  'أُرسل وسام: ما شاء الله تبارك الله 🌟'
                )
              }
              style={styles.badgeBtn}
            >
              <Text style={styles.badgeBtnText}>🌟 ما شاء الله</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void sendHostPatch(
                  { reaction: { badgeKey: 'tajweed', label: 'تجويد متقن ومخارج صافية', emoji: '🎙️', starsDelta: 2 } },
                  'أُرسل وسام: تجويد متقن 🎙️'
                )
              }
              style={styles.badgeBtn}
            >
              <Text style={styles.badgeBtnText}>🎙️ تجويد متقن</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void sendHostPatch(
                  { reaction: { badgeKey: 'hifz', label: 'حفظ راسخ كالجبال', emoji: '🏆', starsDelta: 3 } },
                  'أُرسل وسام: حفظ راسخ 🏆'
                )
              }
              style={styles.badgeBtn}
            >
              <Text style={styles.badgeBtnText}>🏆 حفظ راسخ</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const curMic = roomState.controls?.micPolicy || 'open';
                const nextMic = curMic === 'open' ? 'reciter_only' : curMic === 'reciter_only' ? 'locked' : 'open';
                const msg =
                  nextMic === 'reciter_only'
                    ? 'المايك مفتوح للقارئ فقط 🎙️'
                    : nextMic === 'locked'
                      ? 'تم قفل ميكروفونات جميع الطلاب 🔇'
                      : 'الميكروفونات متاحة الآن';
                void sendHostPatch({ controls: { micPolicy: nextMic } }, msg);
              }}
              style={[styles.veilBtn, (roomState.controls?.micPolicy || 'open') !== 'open' && styles.veilBtnActive]}
            >
              <Text
                style={[
                  styles.veilBtnText,
                  (roomState.controls?.micPolicy || 'open') !== 'open' && styles.veilBtnTextActive,
                ]}
              >
                {(roomState.controls?.micPolicy || 'open') === 'open'
                  ? '🎙️ المايك: متاح'
                  : roomState.controls?.micPolicy === 'reciter_only'
                    ? '🎙️ المايك: للقارئ فقط'
                    : '🔇 المايك: مقفل'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void sendHostPatch(
                  {
                    whiteboard: {
                      mode: 'miniboards',
                      permission: roomState.whiteboard?.permission === 'all_miniboards' ? 'teacher_only' : 'all_miniboards',
                      teleport: true,
                    },
                  },
                  roomState.whiteboard?.permission === 'all_miniboards'
                    ? 'عادت السبورة لشرح المعلم فقط'
                    : 'تم فتح ألواح الكتابة المستقلة لجميع طلاب الحلقة 🧩'
                )
              }
              style={[styles.veilBtn, roomState.whiteboard?.permission === 'all_miniboards' && styles.veilBtnActive]}
            >
              <Text
                style={[
                  styles.veilBtnText,
                  roomState.whiteboard?.permission === 'all_miniboards' && styles.veilBtnTextActive,
                ]}
              >
                {roomState.whiteboard?.permission === 'all_miniboards' ? '🧩 إغلاق ألواح الطلاب' : '🎨 فتح ألواح الطلاب'}
              </Text>
            </Pressable>

            {roomState.whiteboard?.permission === 'all_miniboards' ? (
              <Pressable
                onPress={() =>
                  void sendHostPatch(
                    { whiteboard: { boardsFrozen: !roomState.whiteboard?.boardsFrozen } },
                    roomState.whiteboard?.boardsFrozen ? 'تم فك تجميد الألواح' : '❄️ تم تجميد ألواح الطلاب للمراجعة'
                  )
                }
                style={[styles.veilBtn, roomState.whiteboard?.boardsFrozen && styles.veilBtnActive]}
              >
                <Text style={[styles.veilBtnText, roomState.whiteboard?.boardsFrozen && styles.veilBtnTextActive]}>
                  {roomState.whiteboard?.boardsFrozen ? '❄️ فك التجميد' : '❄️ تجميد الألواح'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() =>
                void sendHostPatch(
                  { mushaf: { hifzVeilMode: currentVeil === 'none' ? 'heads' : currentVeil === 'heads' ? 'full' : 'none' } },
                  currentVeil === 'none'
                    ? 'تم تفعيل ستار رؤوس الآيات للطالب'
                    : currentVeil === 'heads'
                      ? 'تم تفعيل الاختبار الغيبي الكامل للطالب'
                      : 'تم إظهار المصحف كاملاً'
                )
              }
              style={[styles.veilBtn, currentVeil !== 'none' && styles.veilBtnActive]}
            >
              <Eye size={13} color={currentVeil !== 'none' ? colors.emeraldNight : colors.mint} />
              <Text style={[styles.veilBtnText, currentVeil !== 'none' && styles.veilBtnTextActive]}>
                {currentVeil === 'none'
                  ? 'ستار الحفظ: كامل'
                  : currentVeil === 'heads'
                    ? 'ستار: رؤوس الآيات'
                    : 'ستار: اختبار غيبي'}
              </Text>
            </Pressable>

            {activeGameStatus === 'active' ? (
              <Pressable
                onPress={() => void sendHostPatch({ activeGame: { status: 'revealed' } }, 'تم كشف الإجابة الصحيحة للطلاب ✅')}
                style={styles.revealBtn}
              >
                <Text style={styles.revealBtnText}>
                  ✅ كشف الإجابة ({roomState.activeGame?.submissions?.length || 0})
                </Text>
              </Pressable>
            ) : (
              QUICK_MOBILE_CHALLENGES.map((ch) => (
                <Pressable
                  key={ch.mode}
                  onPress={() =>
                    void sendHostPatch(
                      {
                        activeGame: {
                          roundId: `mob_${ch.mode}_${Date.now()}`,
                          status: 'active',
                          ...ch,
                          durationSec: 25,
                        },
                      },
                      `انطلق تحدي: ${ch.label}`
                    )
                  }
                  style={styles.gameBtn}
                >
                  <Gamepad2 size={13} color={colors.goldBright} />
                  <Text style={styles.gameBtnText}>{ch.label}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
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
              title={locale === 'ar' ? 'تعذر تحميل القاعة المباشرة' : 'Unable to load classroom'}
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
                  {locale === 'ar' ? 'جاري تجهيز قاعة الحلقة التفاعلية...' : 'Preparing interactive classroom...'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 107, 0.25)',
    gap: spacing.xs,
  },
  liveBadge: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  liveTitle: { color: colors.textInverse, fontSize: 13, fontFamily: fonts.bold, flexShrink: 1 },
  starsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.2)',
  },
  starsText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  headerBtns: { alignItems: 'center', gap: 6 },
  dockToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.35)',
  },
  dockToggleText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.8 },
  exitText: { color: colors.white, fontSize: 11, fontFamily: fonts.bold },
  listenerBar: {
    backgroundColor: colors.goldBright,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignItems: 'center',
    gap: spacing.xs,
  },
  listenerScroll: { gap: 6, alignItems: 'center' },
  listenerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  listenerChipText: { color: colors.emeraldDeep, fontSize: 11, fontFamily: fonts.bold },
  quickDock: {
    backgroundColor: colors.emeraldNight,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 107, 0.2)',
  },
  feedbackToast: {
    color: colors.goldBright,
    fontSize: 11,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 5,
  },
  dockRow: { paddingHorizontal: spacing.md, gap: 8, alignItems: 'center' },
  badgeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  badgeBtnText: { color: colors.textInverse, fontSize: 11, fontFamily: fonts.semiBold },
  veilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 107, 79, 0.35)',
    borderWidth: 1,
    borderColor: colors.mint,
  },
  veilBtnActive: { backgroundColor: colors.goldBright, borderColor: colors.goldBright },
  veilBtnText: { color: colors.mint, fontSize: 11, fontFamily: fonts.bold },
  veilBtnTextActive: { color: colors.emeraldNight },
  gameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.16)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  gameBtnText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  revealBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
  },
  revealBtnText: { color: colors.white, fontSize: 11, fontFamily: fonts.bold },
  webWrap: { flex: 1, backgroundColor: colors.emeraldNight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  overlayLoad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.emeraldNight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { color: colors.mint, fontSize: 14, fontFamily: fonts.semiBold },
  errorWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.ivory },
});
