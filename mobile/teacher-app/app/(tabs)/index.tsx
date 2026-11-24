import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Award,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Megaphone,
  MessageSquare,
  Moon,
  Radio,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Users,
  Video,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { swrCache } from '../../src/lib/cache';
import { formatCurrency, formatDateTime, getSessionTitle, isSessionLiveSoon } from '../../src/lib/formatters';
import { syncLocalSessionReminders } from '../../src/lib/reminders';
import {
  TeacherFinanceState,
  TeacherSession,
  TeacherStats,
  TeacherTaskItem,
} from '../../src/types/teacher';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonDashboard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { StatTile } from '../../src/components/StatTile';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

interface HomeSnapshot {
  stats: TeacherStats | null;
  pendingCount: number;
  submittedTasksCount: number;
  unreadNotifications: number;
  upcomingSessions: TeacherSession[];
  availableEgp: number;
}

const HOME_CACHE_KEY = 'teacher_home_v1';

function formatCountdown(targetIso: string, locale: 'ar' | 'en'): string | null {
  const diffSec = Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000);
  if (diffSec <= -1800) return null;
  if (diffSec <= 0) return locale === 'ar' ? 'الحصة بدأت الآن!' : 'Live now!';
  if (diffSec > 24 * 3600) return null;
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  return locale === 'ar' ? `تبدأ خلال ${clock}` : `Starts in ${clock}`;
}

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, palette, toggleTheme } = useTheme();
  const { locale, isRTL, t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [enteringRoom, setEnteringRoom] = useState(false);
  const [, setTick] = useState(0);

  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [submittedTasksCount, setSubmittedTasksCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState<TeacherSession[]>([]);
  const [availableEgp, setAvailableEgp] = useState(0);

  // Live 1-second tick for next-session countdown
  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 100000), 1000);
    return () => clearInterval(id);
  }, []);

  const applySnapshot = useCallback((snap: HomeSnapshot) => {
    setStats(snap.stats);
    setPendingCount(snap.pendingCount);
    setSubmittedTasksCount(snap.submittedTasksCount);
    setUnreadNotifications(snap.unreadNotifications);
    setUpcomingSessions(snap.upcomingSessions);
    setAvailableEgp(snap.availableEgp);
  }, []);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        const cached = await swrCache.get<HomeSnapshot>(HOME_CACHE_KEY);
        if (cached) {
          applySnapshot(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }
      setLoadError(false);

      try {
        const results = await Promise.allSettled([
          api.get<TeacherStats>('/api/teachers/dashboard/stats', { auth: true }),
          api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?type=trial&status=pending', { auth: true }),
          api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?type=regular&status=pending', { auth: true }),
          api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?status=accepted&limit=30', { auth: true }),
          api.get<{ tasks?: TeacherTaskItem[] }>('/api/teachers/dashboard/tasks', { auth: true }),
          api.get<TeacherFinanceState>('/api/finance/teacher/balance', { auth: true }),
          api.get<{ count?: number; unreadCount?: number }>('/api/notifications/unread-count', { auth: true }),
        ]);

        const [statsRes, trialsRes, regRes, upRes, tasksRes, finRes, notifRes] = results;

        const allFailed = results.every((r) => r.status === 'rejected');
        if (allFailed) {
          if (!stats) setLoadError(true);
          return;
        }

        const nextStats = statsRes.status === 'fulfilled' ? statsRes.value : stats;
        const pendingTrials = trialsRes.status === 'fulfilled' ? (trialsRes.value.sessions?.length || 0) : 0;
        const pendingReg = regRes.status === 'fulfilled' ? (regRes.value.sessions?.length || 0) : 0;
        const nextPending = pendingTrials + pendingReg;
        const nextUpcoming =
          upRes.status === 'fulfilled'
            ? [...(upRes.value.sessions || [])].sort(
                (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
              )
            : upcomingSessions;
        const nextSubmitted =
          tasksRes.status === 'fulfilled'
            ? (tasksRes.value.tasks || []).filter((item) => item.status === 'submitted').length
            : submittedTasksCount;
        const nextAvail =
          finRes.status === 'fulfilled'
            ? Number(finRes.value.balances?.EGP?.available || 0)
            : availableEgp;
        const nextUnread =
          notifRes.status === 'fulfilled'
            ? Number(notifRes.value.unreadCount ?? notifRes.value.count ?? 0)
            : unreadNotifications;

        const snapshot: HomeSnapshot = {
          stats: nextStats,
          pendingCount: nextPending,
          submittedTasksCount: nextSubmitted,
          unreadNotifications: nextUnread,
          upcomingSessions: nextUpcoming,
          availableEgp: nextAvail,
        };
        applySnapshot(snapshot);
        void swrCache.set(HOME_CACHE_KEY, snapshot);
        void syncLocalSessionReminders(nextUpcoming, locale);
      } catch {
        if (!stats) setLoadError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applySnapshot, locale]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const nextSession = upcomingSessions[0] || null;
  const countdownText = nextSession ? formatCountdown(nextSession.scheduledAt, locale) : null;

  const todaySessions = useMemo(() => {
    const todayKey = new Date().toDateString();
    return upcomingSessions.filter((s) => new Date(s.scheduledAt).toDateString() === todayKey);
  }, [upcomingSessions]);

  const handleEnterRoom = async (session: TeacherSession) => {
    if (enteringRoom) return;
    setEnteringRoom(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const isGroup = session.type === 'group_circle';
      const room = await api.post<{ roomId?: string }>(
        '/api/live/sessions',
        {
          title: isGroup
            ? (session.circle?.name || t.sessions.typeGroup)
            : `${locale === 'ar' ? 'حلقة' : 'Session'} ${session.student?.name || t.common.studentFallback}`,
          description: isGroup ? t.sessions.typeGroup : t.sessions.typeRegular,
          subject: 'quran',
          sessionId: session._id,
        },
        { auth: true }
      );
      if (room.roomId) {
        router.push(`/live/${encodeURIComponent(room.roomId)}`);
      }
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setEnteringRoom(false);
    }
  };

  const quickShortcuts = [
    { key: 'mushaf', label: isRTL ? 'مصحف التصحيح' : 'Mushaf Board', route: '/mushaf-board' as const, icon: BookOpenCheck, bg: colors.emeraldSoft, color: colors.emeraldDark },
    { key: 'queue', label: isRTL ? 'طابور التسميع' : 'Circle Queue', route: '/circle-queue' as const, icon: Users, bg: colors.tealSoft, color: colors.teal },
    { key: 'ai', label: isRTL ? 'المساعد الذكي AI' : 'AI Copilot', route: '/ai-copilot' as const, icon: Sparkles, bg: colors.emeraldSoft, color: colors.emerald },
    { key: 'award', label: isRTL ? 'بطاقة إنجاز' : 'Award Card', route: '/achievement-card' as const, icon: Award, bg: colors.goldSoft, color: colors.goldDark },
    { key: 'wallet', label: t.home.wallet, route: '/wallet' as const, icon: Wallet, bg: colors.goldSoft, color: colors.goldDark },
    { key: 'schedule', label: t.home.schedule, route: '/schedule' as const, icon: CalendarDays, bg: colors.emeraldSoft, color: colors.emerald },
    { key: 'updates', label: t.home.updates, route: '/updates' as const, icon: Megaphone, bg: colors.tealSoft, color: colors.teal },
    { key: 'analytics', label: t.home.analytics, route: '/analytics' as const, icon: BarChart3, bg: colors.infoSoft, color: colors.info },
  ];

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard(true)}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
      >
        <IslamicHero
          badge={t.brand.name}
          title={`${t.home.greeting} ${user?.name || ''}`}
          subtitle={t.brand.subtitle}
          isRTL={isRTL}
          rightSlot={
            <>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  toggleTheme();
                }}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Theme"
              >
                {isDark ? <Sun size={19} color={colors.goldBright} /> : <Moon size={19} color={colors.goldBright} />}
              </Pressable>
              <Pressable
                onPress={() => router.push('/notifications')}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t.home.notifications}
              >
                <Bell size={19} color={colors.textInverse} />
                {unreadNotifications > 0 ? (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </>
          }
        />

        <View style={styles.body}>
          {loading ? (
            <SkeletonDashboard />
          ) : loadError ? (
            <StateView
              mode="error"
              title={t.common.errorTitle}
              description={t.common.errorGeneric}
              actionLabel={t.common.retry}
              onAction={() => void loadDashboard(false)}
            />
          ) : (
            <>
              {pendingCount > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/sessions')}
                  style={[styles.alertCard, { flexDirection: rowDir }]}
                  accessibilityRole="button"
                >
                  <View style={styles.alertIcon}>
                    <Clock size={20} color={colors.warning} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.alertTitle, { textAlign: align }]}>
                      {t.home.pendingAlert.replace('{count}', String(pendingCount))}
                    </Text>
                  </View>
                  <View style={styles.alertChip}>
                    <Text style={styles.alertChipText}>{t.home.reviewNow}</Text>
                  </View>
                </Pressable>
              ) : null}

              {submittedTasksCount > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/homework')}
                  style={[styles.hwCard, { flexDirection: rowDir }]}
                  accessibilityRole="button"
                >
                  <View style={styles.hwIcon}>
                    <BookOpenCheck size={20} color={colors.emerald} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.hwTitle, { textAlign: align }]}>{t.home.pendingHomeworkTitle}</Text>
                    <Text style={[styles.hwSub, { textAlign: align }]}>
                      {t.home.pendingHomeworkSub.replace('{count}', String(submittedTasksCount))}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {/* Next Upcoming Session + Live Countdown */}
              <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.sectionHead, { flexDirection: rowDir }]}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{t.home.nextSession}</Text>
                  {countdownText ? (
                    <View style={styles.countdownPill}>
                      <Radio size={12} color={colors.danger} />
                      <Text style={styles.countdownText}>{countdownText}</Text>
                    </View>
                  ) : nextSession && isSessionLiveSoon(nextSession) ? (
                    <View style={styles.countdownPill}>
                      <Radio size={12} color={colors.danger} />
                      <Text style={styles.countdownText}>{t.home.liveBanner}</Text>
                    </View>
                  ) : null}
                </View>

                {nextSession ? (
                  <View style={[styles.nextBox, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
                    <Text style={[styles.nextName, { textAlign: align, color: palette.text }]}>
                      {getSessionTitle(nextSession, locale)}
                    </Text>
                    <Text style={[styles.nextMeta, { textAlign: align, color: palette.textSecondary }]}>
                      {formatDateTime(nextSession.scheduledAt, locale)} • {nextSession.duration || 60} {t.common.minutes}
                    </Text>
                    <View style={[styles.nextActions, { flexDirection: rowDir }]}>
                      <PrimaryButton
                        label={t.home.enterRoom}
                        onPress={() => void handleEnterRoom(nextSession)}
                        loading={enteringRoom}
                        icon={<Video size={16} color={colors.textInverse} />}
                        style={styles.flex}
                      />
                      <PrimaryButton
                        label={t.sessions.chat}
                        variant="secondary"
                        onPress={() => router.push(`/session-chat/${encodeURIComponent(nextSession._id)}`)}
                        icon={<MessageSquare size={16} color={colors.emeraldDark} />}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyNext}>
                    <Text style={[styles.emptyNextTitle, { color: palette.text }]}>{t.home.noUpcoming}</Text>
                    <Text style={[styles.emptyNextDesc, { color: palette.textSecondary }]}>{t.home.noUpcomingDesc}</Text>
                  </View>
                )}
              </View>

              {/* Today Visual Timeline */}
              {todaySessions.length > 0 ? (
                <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.sectionTitle, { textAlign: align, color: palette.text }]}>
                    {isRTL ? `جدول اليوم (${todaySessions.length} حصص)` : `Today's Timeline (${todaySessions.length})`}
                  </Text>
                  {todaySessions.map((sess) => {
                    const timeStr = new Date(sess.scheduledAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <Pressable
                        key={sess._id}
                        onPress={() => void handleEnterRoom(sess)}
                        style={[styles.timelineRow, { flexDirection: rowDir, borderColor: palette.border }]}
                      >
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>{timeStr}</Text>
                        </View>
                        <View style={styles.flex}>
                          <Text style={[styles.tlName, { textAlign: align, color: palette.text }]} numberOfLines={1}>
                            {getSessionTitle(sess, locale)}
                          </Text>
                          <Text style={[styles.tlSub, { textAlign: align, color: palette.textSecondary }]}>
                            {sess.duration || 60} {t.common.minutes}
                          </Text>
                        </View>
                        <Video size={17} color={colors.emerald} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* KPI Stats Grid */}
              <View style={styles.statsGrid}>
                <StatTile
                  label={t.home.statStudents}
                  value={stats?.totalStudents ?? 0}
                  accent="emerald"
                  isRTL={isRTL}
                  icon={<Users size={20} color={colors.emerald} />}
                  onPress={() => router.push('/(tabs)/students')}
                />
                <StatTile
                  label={t.home.statCompleted}
                  value={stats?.totalSessions ?? 0}
                  accent="teal"
                  isRTL={isRTL}
                  icon={<CheckCircle2 size={20} color={colors.teal} />}
                  onPress={() => router.push('/(tabs)/sessions')}
                />
                <StatTile
                  label={t.home.statAvailable}
                  value={formatCurrency(availableEgp, 'EGP', locale)}
                  accent="gold"
                  isRTL={isRTL}
                  icon={<Wallet size={20} color={colors.goldDark} />}
                  onPress={() => router.push('/wallet')}
                />
                <StatTile
                  label={t.home.statRating}
                  value={(stats?.averageRating ?? 0).toFixed(1)}
                  accent="gold"
                  isRTL={isRTL}
                  icon={<Star size={20} color={colors.goldDark} />}
                  onPress={() => router.push('/reviews')}
                />
              </View>

              {/* Quick Teacher Tools */}
              <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { textAlign: align, color: palette.text }]}>
                  {t.home.quickActions}
                </Text>
                <View style={styles.shortcutGrid}>
                  {quickShortcuts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => router.push(item.route)}
                        style={({ pressed }) => [
                          styles.shortcutCard,
                          { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <View style={[styles.shortcutIcon, { backgroundColor: item.bg }]}>
                          <Icon size={20} color={item.color} />
                        </View>
                        <Text style={[styles.shortcutLabel, { color: palette.text }]} numberOfLines={2}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.md },
  flex: { flex: 1 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,107,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: { color: colors.white, fontSize: 10, fontFamily: fonts.bold },
  alertCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F5D08A',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.warning },
  alertChip: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  alertChipText: { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
  hwCard: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderMint,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  hwIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hwTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.emeraldDark },
  hwSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionHead: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  sectionTitle: { fontSize: 16, fontFamily: fonts.extraBold },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  countdownText: { fontSize: 11, fontFamily: fonts.bold, color: colors.danger },
  nextBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  nextName: { fontSize: 16, fontFamily: fonts.extraBold },
  nextMeta: { fontSize: 13, fontFamily: fonts.medium },
  nextActions: { gap: spacing.sm, marginTop: spacing.xs },
  emptyNext: { alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  emptyNextTitle: { fontSize: 14, fontFamily: fonts.bold },
  emptyNextDesc: { fontSize: 12, fontFamily: fonts.regular, textAlign: 'center' },
  timelineRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  timeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.emeraldSoft,
  },
  timeBadgeText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  tlName: { fontSize: 14, fontFamily: fonts.bold },
  tlSub: { fontSize: 11, fontFamily: fonts.medium },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcutCard: {
    width: '23%',
    minWidth: 74,
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { fontSize: 11, fontFamily: fonts.bold, textAlign: 'center' },
});
