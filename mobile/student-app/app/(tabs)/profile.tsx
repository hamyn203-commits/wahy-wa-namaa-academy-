import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Globe,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  UserCog,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { APP_VERSION } from '../../src/lib/config';
import { registerForPushNotificationsAsync } from '../../src/lib/notifications';
import { reloadToApplyOtaUpdate, runFullUpdateCheck } from '../../src/lib/updates';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { locale, isRTL, t, setLocale } = useI18n();

  const [enablingPush, setEnablingPush] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [rotatingCode, setRotatingCode] = useState(false);
  const [guardianCode, setGuardianCode] = useState<string | null>(user?.guardianLinkCode || null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isGuardian = user?.role === 'guardian';
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (isGuardian) return;
    let active = true;
    void api
      .get<{ user?: { guardianLinkCode?: string | null } }>('/api/students/dashboard/profile', { auth: true })
      .then((res) => {
        if (active && res.user?.guardianLinkCode) {
          setGuardianCode(res.user.guardianLinkCode);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isGuardian]);

  const handleRotateCode = async () => {
    setRotatingCode(true);
    try {
      const res = await api.post<{ guardianLinkCode?: string }>(
        '/api/students/dashboard/guardian-link-code/rotate',
        {},
        { auth: true }
      );
      if (res.guardianLinkCode) {
        setGuardianCode(res.guardianLinkCode);
        void refreshUser();
      }
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setRotatingCode(false);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const { otaDownloaded, binary } = await runFullUpdateCheck();
      if (otaDownloaded) {
        Alert.alert(t.brandShort, t.updates.otaReadyBanner, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.updates.restartNow, onPress: () => void reloadToApplyOtaUpdate() },
        ]);
        return;
      }
      if (binary?.updateAvailable && binary.downloadUrl) {
        Alert.alert(
          t.brandShort,
          t.updates.softBanner.replace('{version}', binary.latestVersion),
          [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.updates.updateBtn, onPress: () => void Linking.openURL(binary.downloadUrl) },
          ]
        );
        return;
      }
      Alert.alert(t.brandShort, t.updates.upToDate);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const token = await registerForPushNotificationsAsync();
      Alert.alert(t.brandShort, token ? t.profile.pushEnabled : t.profile.pushFailed);
    } catch {
      Alert.alert(t.brandShort, t.profile.pushFailed);
    } finally {
      setEnablingPush(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(t.profile.logoutConfirmTitle, t.profile.logoutConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.logoutBtn,
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace('/(auth)/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const menuRows = [
    {
      key: 'edit',
      label: t.profile.editProfile,
      icon: <UserCog size={19} color={colors.emerald} />,
      onPress: () => router.push('/edit-profile'),
    },
    ...(isGuardian
      ? [
          {
            key: 'children',
            label: t.profile.manageChildren,
            icon: <Users size={19} color={colors.emerald} />,
            onPress: () => router.push('/guardian-child'),
          },
        ]
      : []),
    {
      key: 'plans',
      label: t.profile.plansAndSub,
      icon: <CreditCard size={19} color={colors.goldDark} />,
      onPress: () => router.push('/plans'),
    },
    {
      key: 'support',
      label: t.profile.supportChat,
      icon: <MessageCircle size={19} color={colors.teal} />,
      onPress: () => router.push('/support'),
    },
    {
      key: 'lang',
      label: locale === 'ar' ? t.profile.switchToEn : t.profile.switchToAr,
      icon: <Globe size={19} color={colors.emerald} />,
      onPress: () => void setLocale(locale === 'ar' ? 'en' : 'ar'),
    },
    {
      key: 'push',
      label: enablingPush ? t.common.loading : t.profile.pushNotifications,
      icon: <Bell size={19} color={colors.goldDark} />,
      onPress: () => void handleEnablePush(),
    },
    {
      key: 'updates',
      label: checkingUpdate ? t.updates.checking : t.updates.checkBtn,
      icon: <Sparkles size={19} color={colors.emerald} />,
      onPress: () => void handleCheckUpdates(),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <IslamicHero isRTL={isRTL}>
          <View style={styles.avatarCenter}>
            <View style={styles.avatar}>
              <User size={30} color={colors.goldBright} />
            </View>
            <Text style={styles.name}>{user?.name || t.common.student}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <ShieldCheck size={14} color={colors.goldBright} />
              <Text style={styles.roleText}>
                {isGuardian ? t.common.guardian : t.common.student}
              </Text>
            </View>
          </View>
        </IslamicHero>

        <View style={styles.body}>
          {guardianCode ? (
            <View style={styles.card}>
              <View style={[styles.codeHead, { flexDirection: rowDir }]}>
                <Text style={styles.cardLabel}>{t.profile.guardianCode}</Text>
                <Pressable
                  onPress={() => void handleRotateCode()}
                  disabled={rotatingCode}
                  style={[styles.rotateBtn, { flexDirection: rowDir }]}
                >
                  <RefreshCw size={13} color={colors.emerald} />
                  <Text style={styles.rotateText}>{t.profile.rotateCode}</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(guardianCode);
                  Alert.alert(t.brandShort, locale === 'ar' ? 'تم نسخ كود ربط ولي الأمر.' : 'Guardian link code copied.');
                }}
                style={styles.codeCopyWrap}
              >
                <Text style={styles.codeValue} selectable>{guardianCode}</Text>
                <Copy size={16} color={colors.emeraldDark} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.menuCard}>
            {menuRows.map((row, idx) => (
              <Pressable
                key={row.key}
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.menuRow,
                  { flexDirection: rowDir },
                  idx < menuRows.length - 1 && styles.menuDivider,
                  pressed && styles.menuPressed,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.menuIconWrap}>{row.icon}</View>
                <Text style={[styles.menuLabel, { textAlign: align }]}>{row.label}</Text>
                <Chevron size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>

          <PrimaryButton
            label={t.profile.logoutBtn}
            variant="danger"
            icon={<LogOut size={17} color={colors.danger} />}
            loading={loggingOut}
            onPress={confirmLogout}
          />

          <Text style={styles.version}>
            {t.profile.appVersionLabel}: v{APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { paddingBottom: spacing.xxl },
  avatarCenter: { alignItems: 'center', gap: 5, paddingTop: spacing.xs },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  name: { color: colors.textInverse, fontSize: 21, fontFamily: fonts.extraBold },
  email: { color: colors.mint, fontSize: 13, fontFamily: fonts.medium },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.18)',
  },
  roleText: { color: colors.goldBright, fontSize: 12, fontFamily: fonts.bold },
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  codeHead: { alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  rotateBtn: { alignItems: 'center', gap: 4 },
  rotateText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emerald },
  codeCopyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emeraldSoft,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  codeValue: {
    fontSize: 21,
    fontFamily: fonts.extraBold,
    letterSpacing: 2,
    color: colors.emeraldDark,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadows.card,
  },
  menuRow: {
    minHeight: TOUCH_MIN + 10,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  menuPressed: { backgroundColor: colors.ivory },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  version: { textAlign: 'center', fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary },
});
