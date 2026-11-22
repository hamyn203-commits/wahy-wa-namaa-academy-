import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import {
  Check,
  CheckCheck,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { API_BASE_URL, SITE_URL } from '../src/lib/config';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { SupportMessage } from '../src/types/academy';

const QUICK_REPLIES_AR = [
  'عندي استفسار عن الباقات والاشتراك',
  'أرغب في تعديل موعد حصتي',
  'محتاج مساعدة في تفعيل الاشتراك',
  'عندي سؤال بخصوص المعلم',
];

const QUICK_REPLIES_EN = [
  'I have a question about plans',
  'Need to reschedule my session',
  'Help activating my subscription',
  'Question about my teacher',
];

function formatDuration(sec?: number): string {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function dayDividerLabel(iso: string, locale: 'ar' | 'en'): string {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(d, now)) return locale === 'ar' ? 'اليوم' : 'Today';
  if (isSameDay(d, yesterday)) return locale === 'ar' ? 'أمس' : 'Yesterday';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const isGuardian = user?.role === 'guardian';
  const studentId = user?._id || user?.id || '';

  // Live chat state
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Voice recording & playback state
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  // Guardian contact form state
  const [subject, setSubject] = useState('');
  const [contactBody, setContactBody] = useState('');

  const listRef = useRef<FlatList<SupportMessage>>(null);
  const busyRef = useRef(false);
  const lastCountRef = useRef(0);
  const mountedRef = useRef(true);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
    setPlayingMsgId(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopPlayback();
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, [stopPlayback]);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const syncMessages = useCallback(async (silent = false) => {
    if (isGuardian || !studentId || busyRef.current) return;
    busyRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await api.get<{ messages?: SupportMessage[] }>(
        `/api/support/${encodeURIComponent(studentId)}/messages`,
        { auth: true }
      );
      if (!mountedRef.current) return;
      const incoming = res.messages ?? [];
      const hadMore = incoming.length > lastCountRef.current;
      lastCountRef.current = incoming.length;

      setMessages((prev) => {
        // Keep any still-pending optimistic items that haven't settled yet
        const optimistic = prev.filter((m) => m._optimistic);
        return [...incoming, ...optimistic];
      });

      if (hadMore) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      }

      const unreadAdmin = incoming.filter((m) => m.senderRole === 'admin' && !m.readAt);
      if (unreadAdmin.length > 0) {
        void api
          .put(
            `/api/support/${encodeURIComponent(studentId)}/read`,
            {
              through: unreadAdmin[unreadAdmin.length - 1]._id,
              messageIds: unreadAdmin.map((m) => m._id),
            },
            { auth: true }
          )
          .catch(() => {});
      }
    } catch {
      // keep existing messages quietly on transient poll error
    } finally {
      busyRef.current = false;
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, [isGuardian, studentId]);

  // Automatic real-time 3-second polling + immediate foreground sync (zero manual refresh needed!)
  useEffect(() => {
    if (isGuardian || !studentId) {
      setLoading(false);
      return;
    }
    void syncMessages(false);
    const interval = setInterval(() => {
      void syncMessages(true);
    }, 3000);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncMessages(true);
      }
    });

    return () => {
      clearInterval(interval);
      appSub.remove();
    };
  }, [isGuardian, studentId, syncMessages]);

  const sendTextMessage = async (overrideText?: string) => {
    const clean = (overrideText ?? draft).trim();
    if (!clean || !studentId || sending) return;
    setSending(true);
    if (!overrideText) setDraft('');

    const tempId = `tmp_${Date.now()}`;
    const optimisticMsg: SupportMessage = {
      _id: tempId,
      senderRole: 'student',
      text: clean,
      createdAt: new Date().toISOString(),
      readAt: null,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const clientId = `mob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await api.post<{ message?: SupportMessage }>(
        `/api/support/${encodeURIComponent(studentId)}/messages`,
        { text: clean, clientId },
        { auth: true }
      );
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m._id !== tempId);
        if (res.message && !withoutTemp.some((m) => m._id === res.message!._id)) {
          return [...withoutTemp, res.message];
        }
        return withoutTemp;
      });
      void syncMessages(true);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      if (!overrideText) setDraft(clean);
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSending(false);
    }
  };

  // Voice Note Recording Controls
  const startVoiceNote = async () => {
    await stopPlayback();
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.brandShort, t.homework.micDenied);
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordedUri(null);
      setRecordSeconds(0);
      setIsRecording(true);
    } catch {
      Alert.alert(t.brandShort, t.homework.micDenied);
    }
  };

  const stopVoiceNote = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (uri) setRecordedUri(uri);
    } catch {
      setIsRecording(false);
    }
  };

  const discardVoiceNote = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { /* ignore */ }
      recordingRef.current = null;
    }
    await stopPlayback();
    setIsRecording(false);
    setRecordedUri(null);
    setRecordSeconds(0);
  };

  const sendVoiceNote = async () => {
    if (!recordedUri || !studentId || sending) return;
    setSending(true);
    try {
      const clientId = `mob_aud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const form = new FormData();
      form.append('audio', {
        uri: recordedUri,
        name: `support-${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as unknown as Blob);
      form.append('clientId', clientId);
      form.append('durationSeconds', String(Math.max(1, recordSeconds)));
      if (draft.trim()) form.append('text', draft.trim());

      const res = await api.uploadMultipart<{ message?: SupportMessage }>(
        `/api/support/${encodeURIComponent(studentId)}/audio`,
        form
      );
      setRecordedUri(null);
      setRecordSeconds(0);
      setDraft('');
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m._id === res.message!._id) ? prev : [...prev, res.message!]
        );
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        void syncMessages(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.home.loadError;
      Alert.alert(
        t.brandShort,
        msg.includes('404')
          ? (locale === 'ar'
            ? 'الرسائل الصوتية في الدعم الفني قيد التفعيل على السيرفر الآن — يمكنك إرسال رسالة نصية مؤقتاً.'
            : 'Voice notes are being activated on the server — you can send a text message meanwhile.')
          : msg
      );
    } finally {
      setSending(false);
    }
  };

  const togglePlayAudioMessage = async (msg: SupportMessage) => {
    if (playingMsgId === msg._id) {
      await stopPlayback();
      return;
    }
    await stopPlayback();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const token = await api.hydrateToken();
      const uri = `${API_BASE_URL}/api/support/${encodeURIComponent(studentId)}/messages/${encodeURIComponent(msg._id)}/audio`;
      const { sound } = await Audio.Sound.createAsync(
        {
          uri,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Origin: SITE_URL,
          },
        },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingMsgId(msg._id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlayingMsgId(null);
      });
    } catch {
      Alert.alert(t.brandShort, t.home.loadError);
    }
  };

  const togglePreviewRecorded = async () => {
    if (!recordedUri) return;
    if (playingMsgId === 'preview') {
      await stopPlayback();
      return;
    }
    await stopPlayback();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingMsgId('preview');
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlayingMsgId(null);
      });
    } catch { /* ignore */ }
  };

  const submitGuardianContact = async () => {
    if (!contactBody.trim()) {
      Alert.alert(t.brandShort, t.auth.missingFields);
      return;
    }
    setSending(true);
    try {
      await api.post(
        '/api/contact',
        {
          name: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          subject: subject.trim() || 'استفسار ولي أمر من التطبيق',
          message: contactBody.trim(),
        },
        { auth: true }
      );
      setSubject('');
      setContactBody('');
      Alert.alert(
        t.common.success,
        locale === 'ar' ? 'تم إرسال رسالتك لفريق الدعم وسيتم التواصل معك قريباً.' : 'Your message has been sent to Academy Support.'
      );
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSending(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const quickReplies = useMemo(() => (locale === 'ar' ? QUICK_REPLIES_AR : QUICK_REPLIES_EN), [locale]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'الدعم الفني المباشر' : 'Live Academy Support'}
        subtitle={
          locale === 'ar'
            ? '● متصل الآن — تحديث تلقائي لحظي بدون الحاجة للتحديث اليدوي'
            : '● Live now — real-time automatic updates'
        }
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
        rightSlot={
          !isGuardian ? (
            <Pressable onPress={() => void syncMessages(true)} style={styles.refreshBtn} accessibilityRole="button">
              <RefreshCw size={17} color={colors.goldBright} />
            </Pressable>
          ) : null
        }
      />

      {isGuardian ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.formWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'إرسال رسالة مباشرة لإدارة الأكاديمية' : 'Message Academy Support'}
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={locale === 'ar' ? 'عنوان الاستفسار' : 'Subject'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { textAlign: align }]}
            />
            <TextInput
              value={contactBody}
              onChangeText={setContactBody}
              placeholder={locale === 'ar' ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={5}
              style={[styles.input, styles.textArea, { textAlign: align }]}
            />
            <PrimaryButton
              label={locale === 'ar' ? 'إرسال للدعم الفني' : 'Send to Support'}
              loading={sending}
              onPress={() => void submitGuardianContact()}
            />
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? (
                <StateView mode="loading" title={t.common.loading} />
              ) : (
                <View style={styles.emptyWrap}>
                  <StateView
                    mode="empty"
                    title={locale === 'ar' ? 'مرحباً بك في الدعم الفني المباشر' : 'Welcome to Live Support'}
                    description={
                      locale === 'ar'
                        ? 'اكتب استفسارك أو سجّل رسالة صوتية، وسيرد عليك فريق الأكاديمية هنا مباشرة.'
                        : 'Type a message or record a voice note and our team will reply live.'
                    }
                  />
                  <View style={styles.quickWrap}>
                    {quickReplies.map((q) => (
                      <Pressable
                        key={q}
                        onPress={() => void sendTextMessage(q)}
                        style={styles.quickChip}
                      >
                        <Text style={styles.quickChipText}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )
            }
            renderItem={({ item, index }) => {
              const isMe = item.senderRole === 'student';
              const prev = index > 0 ? messages[index - 1] : null;
              const currentDay = dayDividerLabel(item.createdAt, locale);
              const prevDay = prev ? dayDividerLabel(prev.createdAt, locale) : null;
              const showDay = currentDay !== prevDay;
              const isRead = Boolean(item.readAt);
              const isPlaying = playingMsgId === item._id;

              return (
                <View style={{ gap: 6 }}>
                  {showDay ? (
                    <View style={styles.dayDividerWrap}>
                      <Text style={styles.dayDividerText}>{currentDay}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.bubbleWrap, isMe ? styles.bubbleMeWrap : styles.bubbleAdminWrap]}>
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleAdmin]}>
                      {item.hasAudio ? (
                        <Pressable
                          onPress={() => void togglePlayAudioMessage(item)}
                          style={[styles.audioRow, { flexDirection: rowDir }]}
                        >
                          <View style={[styles.audioPlayBtn, isMe ? styles.audioPlayMe : styles.audioPlayAdmin]}>
                            {isPlaying ? (
                              <Pause size={15} color={isMe ? colors.emeraldDeep : colors.white} />
                            ) : (
                              <Play size={15} color={isMe ? colors.emeraldDeep : colors.white} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.waveBarTrack}>
                              <View style={[styles.waveBarFill, isMe && styles.waveBarMe, isPlaying && { width: '75%' }]} />
                            </View>
                            <Text style={[styles.audioDur, isMe && styles.bubbleMeTime]}>
                              {locale === 'ar' ? 'رسالة صوتية' : 'Voice note'} • {formatDuration(item.audioDuration)}
                            </Text>
                          </View>
                          <Volume2 size={15} color={isMe ? colors.goldBright : colors.emerald} />
                        </Pressable>
                      ) : null}

                      {item.text && (!item.hasAudio || item.text !== 'رسالة صوتية') ? (
                        <Text
                          style={[
                            styles.bubbleText,
                            isMe ? styles.bubbleMeText : styles.bubbleAdminText,
                            { textAlign: align },
                          ]}
                        >
                          {item.text}
                        </Text>
                      ) : null}

                      {/* WhatsApp-style timestamp + single / double / BLUE double-check receipt */}
                      <View style={[styles.metaRow, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}>
                        {isMe ? (
                          item._optimistic ? (
                            <Check size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.4} />
                          ) : isRead ? (
                            <CheckCheck size={15} color="#38BDF8" strokeWidth={2.5} />
                          ) : (
                            <CheckCheck size={15} color="rgba(255,255,255,0.75)" strokeWidth={2.3} />
                          )
                        ) : null}
                        <Text style={[styles.bubbleTime, isMe && styles.bubbleMeTime]}>
                          {new Date(item.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* Voice Recording / Preview Bar OR Standard Text + Mic Composer */}
          {isRecording || recordedUri ? (
            <View style={[styles.voiceBar, { flexDirection: rowDir }]}>
              <Pressable onPress={() => void discardVoiceNote()} style={styles.voiceCancelBtn}>
                <Trash2 size={18} color={colors.danger} />
              </Pressable>

              {isRecording ? (
                <View style={[styles.voiceCenter, { flexDirection: rowDir }]}>
                  <View style={styles.recDot} />
                  <Text style={styles.recTimer}>{formatDuration(recordSeconds)}</Text>
                  <Text style={styles.recHint}>
                    {locale === 'ar' ? 'جاري التسجيل...' : 'Recording...'}
                  </Text>
                </View>
              ) : (
                <Pressable onPress={() => void togglePreviewRecorded()} style={[styles.voiceCenter, { flexDirection: rowDir }]}>
                  {playingMsgId === 'preview' ? (
                    <Pause size={18} color={colors.emerald} />
                  ) : (
                    <Play size={18} color={colors.emerald} />
                  )}
                  <Text style={styles.recTimer}>{formatDuration(recordSeconds)}</Text>
                  <Text style={styles.recHint}>
                    {locale === 'ar' ? 'اضغط للمعاينة' : 'Tap to preview'}
                  </Text>
                </Pressable>
              )}

              {isRecording ? (
                <Pressable onPress={() => void stopVoiceNote()} style={styles.stopRecBtn}>
                  <Square size={16} color={colors.white} fill={colors.white} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void sendVoiceNote()}
                  disabled={sending}
                  style={[styles.sendBtn, sending && styles.sendDisabled]}
                >
                  <Send size={19} color={colors.white} />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={[styles.composer, { flexDirection: rowDir }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={locale === 'ar' ? 'اكتب رسالتك للدعم...' : 'Type your message...'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.composerInput, { textAlign: align }]}
                multiline
              />
              {draft.trim() ? (
                <Pressable
                  onPress={() => void sendTextMessage()}
                  disabled={sending}
                  style={[styles.sendBtn, sending && styles.sendDisabled]}
                  accessibilityRole="button"
                >
                  <Send size={19} color={colors.white} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void startVoiceNote()}
                  style={styles.micBtn}
                  accessibilityRole="button"
                  accessibilityLabel={locale === 'ar' ? 'تسجيل رسالة صوتية' : 'Record voice note'}
                >
                  <Mic size={20} color={colors.white} />
                </Pressable>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1, backgroundColor: colors.ivory },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatList: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  emptyWrap: { gap: spacing.md },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  quickChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderMint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    ...shadows.card,
  },
  quickChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  dayDividerWrap: { alignItems: 'center', marginVertical: spacing.xs },
  dayDividerText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    backgroundColor: colors.ivoryDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  bubbleWrap: { width: '100%' },
  bubbleMeWrap: { alignItems: 'flex-end' },
  bubbleAdminWrap: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '84%',
    minWidth: 110,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 5,
    ...shadows.card,
  },
  bubbleMe: {
    backgroundColor: colors.emerald,
    borderBottomRightRadius: 4,
  },
  bubbleAdmin: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: fonts.medium, lineHeight: 21 },
  bubbleMeText: { color: colors.textInverse },
  bubbleAdminText: { color: colors.textPrimary },
  metaRow: { alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  bubbleTime: { fontSize: 10, fontFamily: fonts.medium, color: colors.textTertiary },
  bubbleMeTime: { color: colors.mint },
  audioRow: { alignItems: 'center', gap: spacing.sm, minWidth: 195 },
  audioPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayMe: { backgroundColor: colors.gold },
  audioPlayAdmin: { backgroundColor: colors.emerald },
  waveBarTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  waveBarFill: {
    height: '100%',
    width: '35%',
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
  },
  waveBarMe: { backgroundColor: colors.goldBright },
  audioDur: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  composer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: TOUCH_MIN - 2,
    maxHeight: 110,
    backgroundColor: colors.ivory,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  voiceBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderMint,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  voiceCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCenter: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recTimer: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  recHint: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  stopRecBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formWrap: { padding: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md },
});
