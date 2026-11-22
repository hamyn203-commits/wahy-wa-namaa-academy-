import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Award,
  BookMarked,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Flame,
  GraduationCap,
  Headphones,
  MessageCircle,
  Radio,
  Sparkles,
  Star,
  UserCheck,
  Users,
  Video,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { SITE_URL } from '../../src/lib/config';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressRing } from '../../src/components/ProgressRing';
import { SkeletonDashboard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { StatTile } from '../../src/components/StatTile';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';
import {
  GuardianFamilyOverview,
  PublicTeacher,
  SessionItem,
  StudentDashboardStats,
  SubscriptionItem,
} from '../../src/types/academy';

const DAILY_AYAHS = [
  {
    ar: '﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾',
    refAr: 'سورة القمر — آية 17',
    en: '"And We have certainly made the Quran easy for remembrance."',
    refEn: 'Surah Al-Qamar — 54:17',
  },
  {
    ar: '﴿إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ﴾',
    refAr: 'سورة الإسراء — آية 9',
    en: '"Indeed, this Quran guides to that which is most suitable."',
    refEn: 'Surah Al-Isra — 17:9',
  },
  {
    ar: '﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾',
    refAr: 'سورة المزمل — آية 4',
    en: '"And recite the Quran with measured recitation."',
    refEn: 'Surah Al-Muzzammil — 73:4',
  },
  {
    ar: '﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾',
    refAr: 'سورة الرعد — آية 28',
    en: '"Unquestionably, by the remembrance of Allah hearts are assured."',
    refEn: 'Surah Ar-Rad — 13:28',
  },
  {
    ar: '﴿كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ﴾',
    refAr: 'سورة ص — آية 29',
    en: '"A blessed Book We revealed to you that they might reflect upon its verses."',
    refEn: 'Surah Sad — 38:29',
  },
];

const PROGRAMS = [
  {
    key: 'memorization',
    titleAr: 'تحفيظ القرآن الكريم',
    titleEn: 'Quran Memorization',
    subAr: 'خطط منظمة ومراجعة متقنة',
    subEn: 'Structured Hifz & revision',
    img: `${SITE_URL}/images/programs/program-hifz.jpg`,
  },
  {
    key: 'tajweed_ijazah',
    titleAr: 'التجويد وتصحيح التلاوة',
    titleEn: 'Tajweed & Recitation',
    subAr: 'مخارج الحروف والأحكام العملية',
    subEn: 'Practical Tajweed mastery',
    img: `${SITE_URL}/images/programs/program-tajweed.jpg`,
  },
  {
    key: 'ijazah',
    titleAr: 'برامج الإجازة بالسند',
    titleEn: 'Certified Ijazah Track',
    subAr: 'سند متصل مع شيوخ مجازين',
    subEn: 'Connected chain with scholars',
    img: `${SITE_URL}/images/programs/program-ijazah.jpg`,
  },
  {
    key: 'kids_foundation',
    titleAr: 'تأسيس الأطفال والناشئة',
    titleEn: 'Kids Quran Foundation',
    subAr: 'القاعدة النورانية بأسلوب محبّب',
    subEn: 'Noorani Qaida & fun Hifz',
    img: `${SITE_URL}/images/programs/program-kids.jpg`,
  },
];

function formatDateTime(iso: string | undefined, locale: 'ar' | 'en'): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCountdown(targetIso: string | undefined, nowMs: number, locale: 'ar' | 'en'): { live: boolean; text: string } {
  if (!targetIso) return { live: false, text: '' };
  const diff = new Date(targetIso).getTime() - nowMs;
  if (Number.isNaN(diff)) return { live: false, text: '' };
  if (diff <= 5 * 60 * 1000 && diff >= -60 * 60 * 1000) {
    return { live: true, text: locale === 'ar' ? 'متاحة للدخول الآن' : 'Ready to join now' };
  }
  if (diff < 0) return { live: false, text: '' };

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return {
      live: false,
      text: locale === 'ar' ? `${days} يوم و ${hours} س` : `${days}d ${hours}h`,
    };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return { live: false, text: `${pad(hours)}:${pad(mins)}:${pad(secs)}` };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const isGuardian = user?.role === 'guardian';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [stats, setStats] = useState<StudentDashboardStats | null>(null);
  const [nextSession, setNextSession] = useState<SessionItem | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null);
  const [familyOverview, setFamilyOverview] = useState<GuardianFamilyOverview | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [featuredTeachers, setFeaturedTeachers] = useState<PublicTeacher[]>([]);
  const [unreadSupport, setUnreadSupport] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchUnreadSupport = useCallback(async () => {
    if (isGuardian) return;
    try {
      const res = await api.get<{ unread?: number }>('/api/support/me/unread', { auth: true });
      setUnreadSupport(Number(res.unread || 0));
    } catch { /* non-blocking */ }
  }, [isGuardian]);

  useFocusEffect(
    useCallback(() => {
      void fetchUnreadSupport();
    }, [fetchUnreadSupport])
  );

  const loadDashboard = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const teachersPromise = api.get<{ teachers?: PublicTeacher[] }>('/api/teachers?limit=6');

      if (isGuardian) {
        const [familyRes, upcomingRes, teachersRes] = await Promise.allSettled([
          api.get<GuardianFamilyOverview>('/api/guardian/family-overview', { auth: true }),
          api.get<{ sessions?: SessionItem[] }>('/api/guardian/upcoming-sessions', { auth: true }),
          teachersPromise,
        ]);
        if (familyRes.status === 'fulfilled') setFamilyOverview(familyRes.value);
        if (upcomingRes.status === 'fulfilled') {
          const list = upcomingRes.value.sessions ?? [];
          setNextSession(list[0] ?? null);
        }
        if (teachersRes.status === 'fulfilled') setFeaturedTeachers(teachersRes.value.teachers ?? []);
        if (familyRes.status === 'rejected' && upcomingRes.status === 'rejected') {
          throw familyRes.reason;
        }
      } else {
        const [statsRes, sessionsRes, subRes, teachersRes] = await Promise.allSettled([
          api.get<StudentDashboardStats>('/api/students/dashboard/stats', { auth: true }),
          api.get<{ sessions?: SessionItem[] } | SessionItem[]>('/api/sessions/my-sessions', { auth: true }),
          api.get<{ subscription?: SubscriptionItem; subscriptions?: SubscriptionItem[] }>('/api/subscriptions/me', { auth: true }),
          teachersPromise,
        ]);

        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (sessionsRes.status === 'fulfilled') {
          const raw = sessionsRes.value;
          const all = Array.isArray(raw) ? raw : raw.sessions ?? [];
          const upcoming = all
            .filter((s) => ['accepted', 'scheduled', 'pending'].includes(s.status))
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
          setNextSession(upcoming[0] ?? null);
        }
        if (subRes.status === 'fulfilled') {
          const active =
            subRes.value.subscription
            ?? (subRes.value.subscriptions ?? []).find((s) => s.status === 'active')
            ?? (subRes.value.subscriptions ?? [])[0]
            ?? null;
          setSubscription(active);
        }
        if (teachersRes.status === 'fulfilled') setFeaturedTeachers(teachersRes.value.teachers ?? []);
        void fetchUnreadSupport();

        if (statsRes.status === 'rejected' && sessionsRes.status === 'rejected') {
          throw statsRes.reason;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchUnreadSupport, isGuardian, t.home.loadError]);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const openLiveSession = (session: SessionItem) => {
    const room = session.roomId || session._id;
    router.push({ pathname: '/live/[roomId]', params: { roomId: room } });
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const countdown = formatCountdown(nextSession?.scheduledAt, nowMs, locale);
  const memorizedJuz = Math.min(30, Math.max(0, Number(user?.memorizedJuz ?? 0)));
  const juzPercent = Math.round((memorizedJuz / 30) * 100);
  const subTotal = Math.max(1, Number(subscription?.sessionCount || 1));
  const subRemaining = Math.max(0, Number(subscription?.sessionsRemaining || 0));
  const subRatio = Math.min(100, Math.round((subRemaining / subTotal) * 100));

  const dayIdx = Math.floor(Date.now() / 86400000) % DAILY_AYAHS.length;
  const dailyAyah = DAILY_AYAHS[dayIdx];

  const childrenList = familyOverview?.children ?? [];
  const visibleChildren = selectedChildId === 'all'
    ? childrenList
    : childrenList.filter((c) => c.student?._id === selectedChildId);

  const hubItems = [
    {
      key: 'teachers',
      label: t.home.serviceTeachers,
      icon: <Users size={22} color={colors.emerald} />,
      bg: colors.emeraldSoft,
      onPress: () => router.push('/teachers'),
    },
    {
      key: 'mushaf',
      label: t.home.serviceMushaf,
      icon: <BookOpen size={22} color={colors.goldDark} />,
      bg: colors.goldSoft,
      onPress: () => router.push('/mushaf'),
    },
    {
      key: 'progress',
      label: t.home.serviceProgress,
      icon: <Award size={22} color={colors.teal} />,
      bg: colors.tealSoft,
      onPress: () => router.push('/progress'),
    },
    {
      key: 'courses',
      label: t.home.serviceCourses,
      icon: <GraduationCap size={22} color={colors.emeraldDark} />,
      bg: colors.emeraldSoft,
      onPress: () => router.push('/courses'),
    },
    {
      key: 'plans',
      label: t.home.servicePlans,
      icon: <CreditCard size={22} color={colors.goldDark} />,
      bg: colors.goldSoft,
      onPress: () => router.push('/plans'),
    },
    {
      key: 'support',
      label: t.home.serviceSupport,
      icon: <MessageCircle size={22} color={colors.emerald} />,
      bg: colors.mintSoft,
      badgeCount: unreadSupport,
      onPress: () => router.push('/support'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
      >
        <IslamicHero
          isRTL={isRTL}
          badge={isGuardian ? t.home.guardianRoleBadge : t.home.studentRoleBadge}
          rightSlot={
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.push('/support')}
                style={styles.heroIconBtn}
                accessibilityRole="button"
              >
                <Headphones size={18} color={colors.goldBright} />
                {unreadSupport > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadSupport > 9 ? '9+' : unreadSupport}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.heroLogoRing}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.heroLogo}
                  resizeMode="cover"
                />
              </View>
            </View>
          }
        >
          <Text style={[styles.greeting, { textAlign: align }]}>
            {t.home.greeting} {firstName}
          </Text>
          <View style={[styles.heroSubRow, { flexDirection: rowDir }]}>
            <Sparkles size={14} color={colors.goldBright} />
            <Text style={styles.brandLine}>{t.brand}</Text>
            {!isGuardian && (stats?.completedSessions ?? 0) > 0 ? (
              <View style={styles.streakPill}>
                <Flame size={12} color={colors.goldBright} />
                <Text style={styles.streakText}>{stats?.completedSessions} {t.home.statsCompleted}</Text>
              </View>
            ) : null}
          </View>
        </IslamicHero>

        <View style={styles.body}>
          {loading ? (
            <SkeletonDashboard />
          ) : error ? (
            <StateView
              mode="error"
              title={t.home.loadError}
              description={error}
              actionLabel={t.common.retry}
              onAction={() => loadDashboard(false)}
            />
          ) : (
            <>
              {/* Next Session Live Countdown Spotlight */}
              <View style={styles.spotlightCard}>
                <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                  <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                    <View style={styles.spotlightIcon}>
                      <CalendarClock size={18} color={colors.emerald} />
                    </View>
                    <Text style={styles.cardTitle}>{t.home.nextSessionTitle}</Text>
                  </View>
                  {nextSession && countdown.text ? (
                    <View style={[styles.countdownPill, countdown.live && styles.countdownLive]}>
                      {countdown.live ? <Radio size={12} color={colors.white} /> : null}
                      <Text style={[styles.countdownText, countdown.live && styles.countdownTextLive]}>
                        {countdown.text}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {nextSession ? (
                  <>
                    <Text style={[styles.sessionName, { textAlign: align }]}>
                      {nextSession.circle?.name
                        || nextSession.teacher?.personalInfo?.fullName
                        || nextSession.teacher?.user?.name
                        || t.sessions.teacherFallback}
                    </Text>
                    <Text style={[styles.sessionMeta, { textAlign: align }]}>
                      {formatDateTime(nextSession.scheduledAt, locale)}
                      {nextSession.duration ? ` • ${nextSession.duration} ${t.sessions.durationMin}` : ''}
                    </Text>
                    <PrimaryButton
                      label={t.home.joinNow}
                      icon={<Video size={18} color={colors.textInverse} />}
                      onPress={() => openLiveSession(nextSession)}
                      style={styles.cardBtn}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.emptyLine, { textAlign: align }]}>
                      {t.home.noUpcomingSession}
                    </Text>
                    <PrimaryButton
                      label={t.home.bookTrialCta}
                      variant="gold"
                      onPress={() => router.push({ pathname: '/teachers', params: { tab: 'trial' } })}
                      style={styles.cardBtn}
                    />
                  </>
                )}
              </View>

              {/* Daily Quran Verse Spiritual Card */}
              <Pressable
                onPress={() => router.push('/mushaf')}
                style={({ pressed }) => [styles.ayahCard, pressed && styles.tilePressed]}
                accessibilityRole="button"
              >
                <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                  <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                    <BookMarked size={16} color={colors.goldBright} />
                    <Text style={styles.ayahBadge}>
                      {locale === 'ar' ? 'آية اليوم ووردك القرآني' : 'Verse of the Day'}
                    </Text>
                  </View>
                  <Text style={styles.ayahCta}>
                    {locale === 'ar' ? 'افتح المصحف' : 'Open Mushaf'}
                  </Text>
                </View>
                <Text style={styles.ayahText}>
                  {locale === 'ar' ? dailyAyah.ar : dailyAyah.en}
                </Text>
                <Text style={[styles.ayahRef, { textAlign: align }]}>
                  {locale === 'ar' ? dailyAyah.refAr : dailyAyah.refEn}
                </Text>
              </Pressable>

              {/* All Academy Services In-App Hub */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { textAlign: align }]}>{t.home.servicesTitle}</Text>
                <View style={styles.hubGrid}>
                  {hubItems.map((item) => (
                    <Pressable
                      key={item.key}
                      onPress={item.onPress}
                      style={({ pressed }) => [styles.hubTile, pressed && styles.tilePressed]}
                      accessibilityRole="button"
                    >
                      <View style={[styles.hubIconBox, { backgroundColor: item.bg }]}>
                        {item.icon}
                        {item.badgeCount && item.badgeCount > 0 ? (
                          <View style={styles.tileBadge}>
                            <Text style={styles.tileBadgeText}>
                              {item.badgeCount > 9 ? '9+' : item.badgeCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.hubLabel} numberOfLines={2}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Official Academy Programs Visual Carousel */}
              <View style={styles.sectionBlock}>
                <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                  <Text style={styles.sectionHeading}>
                    {locale === 'ar' ? 'برامج ومسارات الأكاديمية' : 'Academy Programs'}
                  </Text>
                  <Pressable onPress={() => router.push('/plans')}>
                    <Text style={styles.moreLink}>{locale === 'ar' ? 'الباقات' : 'Plans'}</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselList}
                >
                  {PROGRAMS.map((prog) => (
                    <Pressable
                      key={prog.key}
                      onPress={() => router.push({ pathname: '/teachers', params: { tab: 'trial' } })}
                      style={({ pressed }) => [styles.programCard, pressed && styles.tilePressed]}
                    >
                      <Image source={{ uri: prog.img }} style={styles.programImg} resizeMode="cover" />
                      <View style={styles.programScrim} />
                      <View style={styles.programCaption}>
                        <Text style={[styles.programTitle, { textAlign: align }]} numberOfLines={1}>
                          {locale === 'ar' ? prog.titleAr : prog.titleEn}
                        </Text>
                        <Text style={[styles.programSub, { textAlign: align }]} numberOfLines={1}>
                          {locale === 'ar' ? prog.subAr : prog.subEn}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Featured Certified Teachers Horizontal Strip */}
              {featuredTeachers.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                    <Text style={styles.sectionHeading}>
                      {locale === 'ar' ? 'نخبة المعلمين المجازين' : 'Featured Teachers'}
                    </Text>
                    <Pressable onPress={() => router.push('/teachers')}>
                      <Text style={styles.moreLink}>{locale === 'ar' ? 'عرض الكل' : 'See All'}</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselList}
                  >
                    {featuredTeachers.map((teacher) => {
                      const tName = teacher.personalInfo?.fullName || teacher.user?.name || t.sessions.teacherFallback;
                      const rating = Number(teacher.rating?.average || 5).toFixed(1);
                      return (
                        <Pressable
                          key={teacher._id}
                          onPress={() => router.push('/teachers')}
                          style={({ pressed }) => [styles.teacherMiniCard, pressed && styles.tilePressed]}
                        >
                          <View style={styles.teacherMiniAvatar}>
                            <Text style={styles.teacherMiniInitial}>{tName.charAt(0)}</Text>
                          </View>
                          <View style={[styles.miniNameRow, { flexDirection: rowDir }]}>
                            <Text style={styles.teacherMiniName} numberOfLines={1}>{tName}</Text>
                            {teacher.isVerified ? <UserCheck size={13} color={colors.emerald} /> : null}
                          </View>
                          <View style={styles.miniRating}>
                            <Star size={11} color={colors.goldDark} fill={colors.gold} />
                            <Text style={styles.miniRatingText}>{rating}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Student Memorization Ring & Stats OR Guardian Children Center */}
              {!isGuardian ? (
                <>
                  <Pressable
                    onPress={() => router.push('/progress')}
                    style={({ pressed }) => [styles.progressCard, pressed && styles.tilePressed]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.progressRow, { flexDirection: rowDir }]}>
                      <ProgressRing
                        percent={juzPercent}
                        size={82}
                        strokeWidth={8}
                        valueText={`${memorizedJuz}/30`}
                        label={t.home.juzUnit}
                        color={colors.emerald}
                      />
                      <View style={styles.progressInfo}>
                        <Text style={[styles.cardTitle, { textAlign: align }]}>
                          {t.home.progressCardTitle}
                        </Text>
                        <Text style={[styles.emptyLine, { textAlign: align }]}>
                          {t.home.progressCardSub}
                        </Text>
                        <View style={[styles.moreRow, { flexDirection: rowDir }]}>
                          <Text style={styles.moreLink}>{t.home.serviceProgress}</Text>
                          <Chevron size={16} color={colors.emerald} />
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.statsGrid}>
                    <StatTile
                      label={t.home.statsUpcoming}
                      value={stats?.upcomingSessions ?? 0}
                      accent="emerald"
                      isRTL={isRTL}
                      icon={<CalendarClock size={19} color={colors.emerald} />}
                      onPress={() => router.push('/(tabs)/sessions')}
                    />
                    <StatTile
                      label={t.home.statsCompleted}
                      value={stats?.completedSessions ?? 0}
                      accent="teal"
                      isRTL={isRTL}
                      icon={<CheckCircle2 size={19} color={colors.teal} />}
                      onPress={() => router.push('/progress')}
                    />
                    <StatTile
                      label={t.home.statsHomework}
                      value={stats?.homeworkPending ?? 0}
                      accent="gold"
                      isRTL={isRTL}
                      icon={<BookOpen size={19} color={colors.goldDark} />}
                      onPress={() => router.push('/(tabs)/homework')}
                    />
                    <StatTile
                      label={t.home.statsRemaining}
                      value={subscription?.sessionsRemaining ?? 0}
                      accent="emerald"
                      isRTL={isRTL}
                      icon={<CreditCard size={19} color={colors.emerald} />}
                      onPress={() => router.push('/plans')}
                    />
                  </View>

                  <View style={styles.sectionCard}>
                    <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                      <Text style={styles.cardTitle}>{t.home.subscriptionCardTitle}</Text>
                      <Pressable onPress={() => router.push('/plans')}>
                        <Text style={styles.moreLink}>{t.home.servicePlans}</Text>
                      </Pressable>
                    </View>
                    {subscription ? (
                      <>
                        <Text style={[styles.sessionName, { textAlign: align }]}>
                          {locale === 'ar'
                            ? subscription.pricingSnapshot?.nameAr || subscription.planKey
                            : subscription.pricingSnapshot?.nameEn || subscription.planKey}
                        </Text>
                        <View style={styles.meterTrack}>
                          <View style={[styles.meterFill, { width: `${subRatio}%` }]} />
                        </View>
                        <Text style={[styles.sessionMeta, { textAlign: align }]}>
                          {subscription.sessionsRemaining} / {subscription.sessionCount} ({subscription.status})
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.emptyLine, { textAlign: align }]}>
                          {t.home.noSubscription}
                        </Text>
                        <PrimaryButton
                          label={t.home.explorePlans}
                          variant="secondary"
                          onPress={() => router.push('/plans')}
                          style={styles.cardBtn}
                        />
                      </>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.sectionCard}>
                  <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                    <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                      <Users size={18} color={colors.emerald} />
                      <Text style={styles.cardTitle}>{t.home.guardianChildrenTitle}</Text>
                    </View>
                    <Pressable onPress={() => router.push('/guardian-child')}>
                      <Text style={styles.moreLink}>{t.home.guardianLinkCta}</Text>
                    </Pressable>
                  </View>

                  {childrenList.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childChips}>
                      <Pressable
                        onPress={() => setSelectedChildId('all')}
                        style={[styles.childChip, selectedChildId === 'all' && styles.childChipActive]}
                      >
                        <Text style={[styles.childChipText, selectedChildId === 'all' && styles.childChipTextActive]}>
                          {t.common.all}
                        </Text>
                      </Pressable>
                      {childrenList.map((c) => {
                        const cid = c.student?._id || '';
                        const active = selectedChildId === cid;
                        return (
                          <Pressable
                            key={cid}
                            onPress={() => setSelectedChildId(cid)}
                            style={[styles.childChip, active && styles.childChipActive]}
                          >
                            <Text style={[styles.childChipText, active && styles.childChipTextActive]}>
                              {c.student?.name || t.common.student}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}

                  {visibleChildren.length === 0 ? (
                    <>
                      <Text style={[styles.emptyLine, { textAlign: align }]}>
                        {t.home.guardianNoChildren}
                      </Text>
                      <PrimaryButton
                        label={t.home.guardianLinkCta}
                        variant="gold"
                        onPress={() => router.push('/guardian-child')}
                        style={styles.cardBtn}
                      />
                    </>
                  ) : (
                    visibleChildren.map((child) => (
                      <Pressable
                        key={child.student?._id || child.student?.email}
                        onPress={() =>
                          router.push({
                            pathname: '/guardian-child',
                            params: { studentId: child.student?._id || '' },
                          })
                        }
                        style={({ pressed }) => [styles.childRow, pressed && styles.tilePressed]}
                      >
                        <View style={[styles.cardHeadBetween, { flexDirection: rowDir }]}>
                          <Text style={[styles.childName, { textAlign: align }]}>
                            {child.student?.name || t.common.student}
                          </Text>
                          <Chevron size={18} color={colors.emerald} />
                        </View>
                        <Text style={[styles.sessionMeta, { textAlign: align }]}>
                          {t.home.statsUpcoming}: {child.stats?.upcomingSessions ?? 0} • {t.home.statsCompleted}: {child.stats?.completedSessions ?? 0} • {t.home.statsHomework}: {child.stats?.pendingHomework ?? 0}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { paddingBottom: spacing.xxl },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroIconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.emeraldDeep,
  },
  unreadBadgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.extraBold },
  heroLogoRing: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  heroLogo: { width: '100%', height: '100%' },
  greeting: {
    color: colors.textInverse,
    fontSize: 23,
    fontFamily: fonts.extraBold,
    marginTop: 4,
  },
  heroSubRow: { alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  brandLine: { color: colors.mint, fontSize: 13, fontFamily: fonts.semiBold },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.2)',
  },
  streakText: { color: colors.goldBright, fontSize: 11, fontFamily: fonts.bold },
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -18 },
  spotlightCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderMint,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  spotlightIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  countdownLive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  countdownText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  countdownTextLive: { color: colors.white },
  ayahCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.45)',
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  ayahBadge: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldBright },
  ayahCta: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.emeraldDeep,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  ayahText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 30,
    marginVertical: 2,
  },
  ayahRef: { fontSize: 11, fontFamily: fonts.medium, color: colors.mint },
  sectionBlock: { gap: spacing.sm },
  sectionHeading: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.emeraldDark,
    paddingHorizontal: 2,
  },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  hubTile: {
    width: '30.5%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  tilePressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  hubIconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileBadgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.extraBold },
  hubLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 17,
  },
  carouselList: { gap: spacing.md, paddingVertical: 2 },
  programCard: {
    width: 210,
    height: 128,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.emeraldDeep,
    justifyContent: 'flex-end',
    ...shadows.card,
  },
  programImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  programScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 39, 29, 0.48)' },
  programCaption: { padding: spacing.md, gap: 2 },
  programTitle: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.textInverse },
  programSub: { fontSize: 11, fontFamily: fonts.medium, color: colors.goldBright },
  teacherMiniCard: {
    width: 132,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    ...shadows.card,
  },
  teacherMiniAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherMiniInitial: { fontSize: 19, fontFamily: fonts.extraBold, color: colors.goldBright },
  miniNameRow: { alignItems: 'center', gap: 4, maxWidth: '100%' },
  teacherMiniName: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary, flexShrink: 1 },
  miniRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  miniRatingText: { fontSize: 11, fontFamily: fonts.bold, color: colors.goldDark },
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadows.card,
  },
  progressRow: { alignItems: 'center', gap: spacing.lg },
  progressInfo: { flex: 1, gap: 4 },
  moreRow: { alignItems: 'center', gap: 4, marginTop: 4 },
  moreLink: { fontSize: 13, fontFamily: fonts.bold, color: colors.emerald },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeadBetween: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardHead: { alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  sessionName: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textPrimary, marginTop: 2 },
  sessionMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  emptyLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  cardBtn: { marginTop: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meterTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    overflow: 'hidden',
    marginVertical: 4,
  },
  meterFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.emerald },
  childChips: { gap: spacing.sm, paddingVertical: 4 },
  childChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  childChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  childChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  childChipTextActive: { color: colors.textInverse },
  childRow: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  childName: { fontSize: 15, fontFamily: fonts.bold, color: colors.emeraldDark },
});
