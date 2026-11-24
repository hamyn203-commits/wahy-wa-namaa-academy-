import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { useI18n } from '../i18n/I18nProvider';
import {
  BinaryUpdateStatus,
  reloadToApplyOtaUpdate,
  runFullUpdateCheck,
} from '../lib/updates';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';

const MIN_CHECK_GAP_MS = 60 * 1000;
const PERIODIC_CHECK_MS = 5 * 60 * 1000;

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { locale, isRTL, t } = useI18n();
  const [otaReady, setOtaReady] = useState(false);
  const [otaModalVisible, setOtaModalVisible] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [binaryStatus, setBinaryStatus] = useState<BinaryUpdateStatus | null>(null);
  const [dismissedSoft, setDismissedSoft] = useState(false);

  const lastCheckAtRef = useRef(0);
  const checkingRef = useRef(false);
  const mountedRef = useRef(true);

  const triggerCheck = useCallback(async (force = false) => {
    if (checkingRef.current) return;
    const now = Date.now();
    if (!force && now - lastCheckAtRef.current < MIN_CHECK_GAP_MS) return;

    checkingRef.current = true;
    lastCheckAtRef.current = now;
    try {
      const { otaDownloaded, binary } = await runFullUpdateCheck();
      if (!mountedRef.current) return;
      if (otaDownloaded) {
        setOtaReady(true);
        setOtaModalVisible(true);
      }
      if (binary?.updateAvailable) {
        setBinaryStatus(binary);
      }
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void triggerCheck(true);

    const interval = setInterval(() => {
      void triggerCheck(false);
    }, PERIODIC_CHECK_MS);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void triggerCheck(false);
      }
    });

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      appSub.remove();
    };
  }, [triggerCheck]);

  const openDownload = () => {
    if (binaryStatus?.downloadUrl) {
      void Linking.openURL(binaryStatus.downloadUrl);
    }
  };

  const applyOta = async () => {
    setReloading(true);
    try {
      await reloadToApplyOtaUpdate();
    } finally {
      setReloading(false);
    }
  };

  if (binaryStatus?.forceUpdate) {
    const notes = locale === 'ar'
      ? binaryStatus.releaseNotes?.ar || binaryStatus.releaseNotes?.en
      : binaryStatus.releaseNotes?.en || binaryStatus.releaseNotes?.ar;

    return (
      <SafeAreaView style={styles.forceSafe}>
        <View style={styles.forceCard}>
          <View style={styles.forceIcon}>
            <Download size={28} color={colors.gold} />
          </View>
          <Text style={styles.forceTitle}>{t.updates.forceTitle}</Text>
          <Text style={styles.forceDesc}>
            {t.updates.forceDesc.replace('{version}', binaryStatus.latestVersion)}
          </Text>
          {notes ? <Text style={styles.forceNotes}>{notes}</Text> : null}
          <PrimaryButton
            label={t.updates.downloadApkBtn}
            onPress={openDownload}
            style={styles.forceBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.flex}>
      {otaReady && !otaModalVisible ? (
        <SafeAreaView edges={['top']} style={styles.bannerSafe}>
          <View style={[styles.banner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <RefreshCw size={16} color={colors.gold} />
            <Text style={[styles.bannerText, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.updates.otaReadyBanner}
            </Text>
            <Pressable
              onPress={() => void applyOta()}
              disabled={reloading}
              style={styles.bannerCta}
              accessibilityRole="button"
            >
              <Text style={styles.bannerCtaText}>{t.updates.restartNow}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : binaryStatus?.updateAvailable && !dismissedSoft ? (
        <SafeAreaView edges={['top']} style={styles.bannerSafe}>
          <View style={[styles.banner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Download size={16} color={colors.gold} />
            <Text style={[styles.bannerText, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.updates.softBanner.replace('{version}', binaryStatus.latestVersion)}
            </Text>
            <Pressable onPress={openDownload} style={styles.bannerCta} accessibilityRole="button">
              <Text style={styles.bannerCtaText}>{t.updates.updateBtn}</Text>
            </Pressable>
            <Pressable
              onPress={() => setDismissedSoft(true)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t.common.cancel}
            >
              <X size={16} color={colors.mint} />
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}

      {children}

      <Modal visible={otaModalVisible} transparent animationType="fade" onRequestClose={() => setOtaModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.forceIcon}>
              <Sparkles size={26} color={colors.gold} />
            </View>
            <Text style={styles.forceTitle}>{t.updates.otaReadyTitle}</Text>
            <Text style={styles.forceDesc}>{t.updates.otaReadyDesc}</Text>
            <PrimaryButton
              label={t.updates.restartNow}
              onPress={() => void applyOta()}
              loading={reloading}
              style={styles.forceBtn}
            />
            <PrimaryButton
              label={t.updates.later}
              variant="ghost"
              onPress={() => setOtaModalVisible(false)}
              style={styles.forceBtn}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bannerSafe: { backgroundColor: colors.emeraldDeep },
  banner: {
    backgroundColor: colors.emeraldDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 107, 0.25)',
  },
  bannerText: {
    flex: 1,
    color: colors.textInverse,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  bannerCta: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  bannerCtaText: {
    color: colors.emeraldDeep,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  closeBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceSafe: {
    flex: 1,
    backgroundColor: colors.ivory,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  forceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.elevated,
  },
  forceIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceTitle: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDark,
    textAlign: 'center',
  },
  forceDesc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  forceNotes: {
    width: '100%',
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  forceBtn: {
    width: '100%',
    minHeight: TOUCH_MIN,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.elevated,
  },
});
