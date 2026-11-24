import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Award,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe,
  LogOut,
  Megaphone,
  Moon,
  Sparkles,
  Star,
  Sun,
  Timer,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { APP_VERSION } from '../../src/lib/config';
import { IslamicHero } from '../../src/components/IslamicHero';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function TeacherMoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, palette, toggleTheme } = useTheme();
  const { isRTL, t, toggleLocale } = useI18n();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const menuItems = [
    { key: 'mushaf', label: isRTL ? 'مصحف التصحيح وخريطة الختمة' : 'Mushaf Board & Khatmah', route: '/mushaf-board' as const, icon: BookOpenCheck, color: colors.emeraldDark, bg: colors.emeraldSoft },
    { key: 'queue', label: isRTL ? 'طابور التسميع الحي للحلقة' : 'Live Circle Queue', route: '/circle-queue' as const, icon: Timer, color: colors.teal, bg: colors.tealSoft },
    { key: 'ai', label: isRTL ? 'مساعد المعلم الذكي (AI)' : 'AI Teacher Copilot', route: '/ai-copilot' as const, icon: Sparkles, color: colors.emerald, bg: colors.emeraldSoft },
    { key: 'award', label: isRTL ? 'بطاقة إنجاز الطالب للواتساب' : 'Student Achievement Card', route: '/achievement-card' as const, icon: Award, color: colors.goldDark, bg: colors.goldSoft },
    { key: 'wallet', label: t.home.wallet, route: '/wallet' as const, icon: Wallet, color: colors.goldDark, bg: colors.goldSoft },
    { key: 'schedule', label: t.home.schedule, route: '/schedule' as const, icon: CalendarDays, color: colors.emerald, bg: colors.emeraldSoft },
    { key: 'updates', label: t.home.updates, route: '/updates' as const, icon: Megaphone, color: colors.teal, bg: colors.tealSoft },
    { key: 'analytics', label: t.home.analytics, route: '/analytics' as const, icon: BarChart3, color: colors.info, bg: colors.infoSoft },
    { key: 'reviews', label: t.home.reviews, route: '/reviews' as const, icon: Star, color: colors.goldDark, bg: colors.goldSoft },
    { key: 'notifications', label: t.home.notifications, route: '/notifications' as const, icon: Bell, color: colors.emeraldDark, bg: colors.emeraldSoft },
    { key: 'profile', label: t.home.profile, route: '/profile' as const, icon: UserRound, color: colors.emerald, bg: colors.emeraldSoft },
  ];

  const confirmLogout = () => {
    Alert.alert(t.more.logout, t.more.logoutConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.more.logout, style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <IslamicHero
          title={t.more.title}
          subtitle={`${user?.name || ''} • ${user?.email || ''}`}
          isRTL={isRTL}
          compact
        />

        <View style={styles.body}>
          <View style={styles.card}>
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.route)}
                  style={({ pressed }) => [
                    styles.row,
                    { flexDirection: rowDir },
                    idx > 0 && styles.borderTop,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <Text style={[styles.rowLabel, { textAlign: align }]}>{item.label}</Text>
                  <Chevron size={18} color={colors.textTertiary} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <Pressable
              onPress={toggleLocale}
              style={({ pressed }) => [styles.row, { flexDirection: rowDir }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: colors.tealSoft }]}>
                <Globe size={20} color={colors.teal} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { textAlign: align }]}>{t.more.language}</Text>
                <Text style={[styles.rowSub, { textAlign: align }]}>{t.more.switchToOther}</Text>
              </View>
              <Chevron size={18} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [
                styles.row,
                styles.borderTop,
                { flexDirection: rowDir },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: colors.goldSoft }]}>
                {isDark ? <Sun size={20} color={colors.goldDark} /> : <Moon size={20} color={colors.goldDark} />}
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { textAlign: align }]}>
                  {isRTL ? 'مظهر التطبيق' : 'App Theme'}
                </Text>
                <Text style={[styles.rowSub, { textAlign: align }]}>
                  {isDark ? (isRTL ? 'الوضع الليلي مفعّل — اضغط للنهاري' : 'Dark Mode') : (isRTL ? 'الوضع النهاري — اضغط لليلي' : 'Light Mode')}
                </Text>
              </View>
              <Chevron size={18} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={confirmLogout}
              style={({ pressed }) => [
                styles.row,
                styles.borderTop,
                { flexDirection: rowDir },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: colors.dangerSoft }]}>
                <LogOut size={20} color={colors.danger} />
              </View>
              <Text style={[styles.rowLabel, styles.dangerLabel, { textAlign: align }]}>
                {t.more.logout}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.versionText}>
            {t.more.versionLabel}: v{APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    minHeight: TOUCH_MIN + 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  pressed: { backgroundColor: colors.ivory },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  dangerLabel: { color: colors.danger },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
});
