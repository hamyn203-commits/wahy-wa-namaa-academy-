import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
import { PhoneOff, Radio } from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { SITE_URL } from '../../src/lib/config';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, spacing } from '../../src/theme/tokens';

/**
 * In-App Live Classroom Screen (Zero External Browser).
 * Hosts the live Quran classroom (LiveKit video/audio + Synced Mushaf + Safe Chat)
 * right inside the native app shell with automatic microphone permission setup.
 */
export default function LiveClassroomScreen() {
  useKeepAwake();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { locale, isRTL, t } = useI18n();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await Audio.requestPermissionsAsync();
      } catch { /* non-blocking */ }
      const accessToken = await api.hydrateToken();
      if (active) {
        setToken(accessToken);
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cleanRoom = encodeURIComponent(String(roomId || ''));
  const classroomUrl = `${SITE_URL}/${locale}/live/${cleanRoom}`;

  // Injects the active mobile access token into sessionStorage so the embedded
  // classroom page can authenticate cleanly without asking the student to sign in again.
  const injectedAuthJs = token
    ? `try { window.sessionStorage.setItem('wwn_mobile_token', ${JSON.stringify(token)}); } catch (e) {} true;`
    : 'true;';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.liveBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Radio size={14} color={colors.goldBright} />
          <Text style={styles.liveTitle}>
            {locale === 'ar' ? 'الحلقة المباشرة — وحي ونماء' : 'Live Classroom — Wahy Wa Namaa'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.exitBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <PhoneOff size={15} color={colors.white} />
          <Text style={styles.exitText}>{locale === 'ar' ? 'خروج' : 'Leave'}</Text>
        </Pressable>
      </View>

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
            source={{
              uri: classroomUrl,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }}
            injectedJavaScriptBeforeContentLoaded={injectedAuthJs}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            originWhitelist={['https://wahywanamaa.com', 'https://*.wahywanamaa.com']}
            onError={() => setLoadFailed(true)}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.overlayLoad}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>
                  {locale === 'ar' ? 'جاري تجهيز قاعة الحلقة...' : 'Preparing classroom...'}
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
    backgroundColor: colors.emeraldNight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 107, 0.25)',
  },
  liveBadge: { alignItems: 'center', gap: spacing.sm },
  liveTitle: { color: colors.textInverse, fontSize: 14, fontFamily: fonts.bold },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.85 },
  exitText: { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
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
});
