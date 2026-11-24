import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Play, Square, Trash2 } from 'lucide-react-native';
import { useI18n } from '../i18n/I18nProvider';
import { formatSeconds } from '../lib/formatters';
import { colors, fonts, radius, spacing } from '../theme/tokens';

export interface VoiceDraft {
  uri: string;
  durationSeconds: number;
}

interface VoiceFeedbackRecorderProps {
  draft: VoiceDraft | null;
  onChange: (next: VoiceDraft | null) => void;
}

export function VoiceFeedbackRecorder({ draft, onChange }: VoiceFeedbackRecorderProps) {
  const { isRTL, t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);

  const recRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recRef.current) {
        void recRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.common.errorTitle, 'يرجى السماح بصلاحية الميكروفون لتسجيل الملاحظة الصوتية.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: created } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recRef.current = created;
      secondsRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= 180) {
          void stopRecording();
        }
      }, 1000);
    } catch {
      Alert.alert(t.common.errorTitle, t.common.errorGeneric);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const activeRec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!activeRec) return;

    try {
      await activeRec.stopAndUnloadAsync();
      const uri = activeRec.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (uri) {
        onChange({ uri, durationSeconds: Math.max(1, secondsRef.current) });
      }
    } catch {
      // Ignore cleanup errors.
    }
  };

  const togglePlayback = async () => {
    if (!draft?.uri) return;
    if (playing && soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
      setPlaying(false);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: draft.uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false);
            void sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        }
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  if (draft) {
    return (
      <View style={[styles.readyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => void togglePlayback()} style={styles.playBtn} accessibilityRole="button">
          {playing ? <Square size={15} color={colors.white} /> : <Play size={15} color={colors.white} />}
        </Pressable>
        <Text style={[styles.readyText, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t.homework.voiceReady.replace('{sec}', formatSeconds(draft.durationSeconds))}
        </Text>
        <Pressable
          onPress={() => onChange(null)}
          style={styles.trashBtn}
          accessibilityRole="button"
          accessibilityLabel={t.homework.deleteVoice}
        >
          <Trash2 size={16} color={colors.danger} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void (recording ? stopRecording() : startRecording())}
      style={[
        styles.recBtn,
        recording && styles.recBtnActive,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
      accessibilityRole="button"
    >
      {recording ? (
        <Square size={16} color={colors.danger} />
      ) : (
        <Mic size={16} color={colors.emerald} />
      )}
      <Text style={[styles.recText, recording && styles.recTextActive]}>
        {recording ? `${t.homework.stopRecording} (${formatSeconds(seconds)})` : t.homework.recordVoice}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMint,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  recBtnActive: {
    borderColor: '#F3B8B2',
    backgroundColor: colors.dangerSoft,
  },
  recText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.emeraldDark,
  },
  recTextActive: {
    color: colors.danger,
  },
  readyRow: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMint,
    backgroundColor: colors.mintSoft,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.emeraldDark,
  },
  trashBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
