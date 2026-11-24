import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic, Play, Send, Square } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { uploadSessionChatAudioDirect } from '../../src/lib/directUpload';
import { formatDateTime, formatSeconds } from '../../src/lib/formatters';
import { SessionChatMessage } from '../../src/types/teacher';
import { IslamicHero } from '../../src/components/IslamicHero';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function SessionChatScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState('');

  // Native Voice Recording in Session Chat
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recRef = useRef<Audio.Recording | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (recRef.current) void recRef.current.stopAndUnloadAsync().catch(() => {});
      if (soundRef.current) void soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!sessionId) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.get<{ messages?: SessionChatMessage[] }>(
          `/api/sessions/${encodeURIComponent(String(sessionId))}/translate/messages?lang=${encodeURIComponent(locale)}`,
          { auth: true }
        );
        setMessages(res.messages || []);
        setError('');
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t.common.errorGeneric);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [sessionId, locale, t.common.errorGeneric]
  );

  useEffect(() => {
    void loadMessages(false);
    const interval = setInterval(() => void loadMessages(true), 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async () => {
    const clean = text.trim();
    if (!clean || sending || !sessionId) return;
    setSending(true);
    try {
      await api.post(
        `/api/sessions/${encodeURIComponent(String(sessionId))}/translate/messages`,
        { text: clean, lang: locale, kind: 'text' },
        { auth: true }
      );
      setText('');
      void Haptics.selectionAsync().catch(() => {});
      await loadMessages(true);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSending(false);
    }
  };

  const toggleRecordVoice = async () => {
    if (!sessionId) return;
    if (recording) {
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      const activeRec = recRef.current;
      recRef.current = null;
      setRecording(false);
      if (!activeRec) return;

      setSending(true);
      try {
        await activeRec.stopAndUnloadAsync();
        const uri = activeRec.getURI();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (uri) {
          const uploaded = await uploadSessionChatAudioDirect({
            uri,
            ownerId: String(user?._id || user?.id || ''),
          });
          await api.post(
            `/api/sessions/${encodeURIComponent(String(sessionId))}/translate/messages`,
            {
              kind: 'audio',
              lang: locale,
              storageFile: uploaded,
              durationSeconds: Math.max(1, recSecRef.current),
            },
            { auth: true }
          );
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          await loadMessages(true);
        }
      } catch (err) {
        Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.common.errorTitle, 'يرجى السماح بصلاحية الميكروفون لإرسال رسالة صوتية.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: created } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recRef.current = created;
      recSecRef.current = 0;
      setRecordSec(0);
      setRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      recTimerRef.current = setInterval(() => {
        recSecRef.current += 1;
        setRecordSec(recSecRef.current);
        if (recSecRef.current >= 120) {
          void toggleRecordVoice();
        }
      }, 1000);
    } catch {
      Alert.alert(t.common.errorTitle, t.common.errorGeneric);
    }
  };

  const toggleVoiceNote = async (msg: SessionChatMessage) => {
    if (!msg.audioUrl) return;
    if (playingId === msg._id) {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setPlayingId('');
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const audioPath = msg.audioUrl.startsWith('/') ? msg.audioUrl : `/${msg.audioUrl}`;
      const uri = await api.downloadAuthenticatedFile(audioPath, `chat-${msg._id}.m4a`);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId('');
            void sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        }
      );
      soundRef.current = sound;
      setPlayingId(msg._id);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    }
  };

  const renderMessage = useCallback(
    ({ item }: { item: SessionChatMessage }) => {
      const isMe = Boolean(item.isMe || item.senderRole === 'teacher');
      const body = item.originalText || item.text || '';
      const isPlaying = playingId === item._id;

      return (
        <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapOther]}>
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
            ]}
          >
            {item.senderName ? (
              <Text style={[styles.senderName, isMe && styles.senderNameMe, { textAlign: align }]}>
                {item.senderName}
              </Text>
            ) : null}
            {body ? (
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : { color: palette.text }, { textAlign: align }]}>
                {body}
              </Text>
            ) : null}
            {item.audioUrl ? (
              <Pressable
                onPress={() => void toggleVoiceNote(item)}
                style={[styles.voicePill, isMe ? styles.voicePillMe : styles.voicePillOther]}
              >
                {isPlaying ? (
                  <Square size={14} color={isMe ? colors.white : colors.emeraldDark} />
                ) : (
                  <Play size={14} color={isMe ? colors.white : colors.emeraldDark} />
                )}
                <Text style={[styles.voiceText, isMe && styles.msgTextMe]}>
                  {item.audioDuration ? formatSeconds(item.audioDuration) : 'رسالة صوتية'}
                </Text>
              </Pressable>
            ) : null}
            <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
              {formatDateTime(item.createdAt, locale)}
            </Text>
          </View>
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [align, locale, playingId, palette]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <IslamicHero
        title={t.sessions.chat}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.pad}>
            <StateView mode="loading" title={t.common.loading} />
          </View>
        ) : error ? (
          <View style={styles.pad}>
            <StateView
              mode="error"
              title={t.common.errorTitle}
              description={error}
              actionLabel={t.common.retry}
              onAction={() => void loadMessages(false)}
            />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <StateView
                mode="empty"
                title={locale === 'ar' ? 'ابدأ المحادثة مع الطالب' : 'Start chatting with your student'}
              />
            }
          />
        )}

        <View
          style={[
            styles.composer,
            { flexDirection: rowDir, backgroundColor: palette.surface, borderTopColor: palette.border },
          ]}
        >
          <Pressable
            onPress={() => void toggleRecordVoice()}
            disabled={sending}
            style={[styles.micBtn, recording && styles.micBtnActive]}
            accessibilityRole="button"
          >
            {recording ? <Square size={17} color={colors.white} /> : <Mic size={18} color={colors.emeraldDark} />}
          </Pressable>

          {recording ? (
            <View style={styles.recStatus}>
              <Text style={styles.recText}>
                🎙️ {locale === 'ar' ? 'جاري التسجيل... اضغط لإرسال' : 'Recording... tap to send'} ({formatSeconds(recordSec)})
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={[
                  styles.input,
                  { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text },
                ]}
                value={text}
                onChangeText={setText}
                placeholder={locale === 'ar' ? 'اكتب رسالتك هنا...' : 'Write a message...'}
                placeholderTextColor={palette.textTertiary}
                multiline
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={sending || !text.trim()}
                style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
                accessibilityRole="button"
              >
                <Send size={18} color={colors.white} />
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  bubbleWrap: { width: '100%' },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  bubbleMe: { backgroundColor: colors.emerald },
  senderName: { fontSize: 11, fontFamily: fonts.bold, color: colors.emeraldDark },
  senderNameMe: { color: colors.goldBright },
  msgText: { fontSize: 14, fontFamily: fonts.medium, lineHeight: 21 },
  msgTextMe: { color: colors.white },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  voicePillMe: { backgroundColor: colors.emeraldDark },
  voicePillOther: { backgroundColor: colors.emeraldSoft },
  voiceText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  timeText: { fontSize: 10, fontFamily: fonts.regular, color: colors.textTertiary },
  timeTextMe: { color: colors.mint },
  composer: {
    padding: spacing.md,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  micBtn: {
    width: TOUCH_MIN - 2,
    height: TOUCH_MIN - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: colors.danger },
  recStatus: {
    flex: 1,
    minHeight: TOUCH_MIN - 4,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  recText: { fontSize: 13, fontFamily: fonts.bold, color: colors.danger },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN - 4,
    maxHeight: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  sendBtn: {
    width: TOUCH_MIN - 2,
    height: TOUCH_MIN - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
