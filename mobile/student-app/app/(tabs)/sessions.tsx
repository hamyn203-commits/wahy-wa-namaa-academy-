import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, Video } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';
import { SessionItem } from '../../src/types/academy';

type FilterTab = 'upcoming' | 'completed' | 'all';

function formatDate(iso: string, locale: 'ar' | 'en'): string {
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

export default function SessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const isGuardian = user?.role === 'guardian';

  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const endpoint = isGuardian ? '/api/guardian/upcoming-sessions' : '/api/sessions/my-sessions';
      const data = await api.get<{ sessions?: SessionItem[] } | SessionItem[]>(endpoint, { auth: true });
      const list = Array.isArray(data) ? data : data.sessions ?? [];
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sessions.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isGuardian, t.sessions.loadError]);

  useEffect(() => {
    void loadSessions(false);
  }, [loadSessions]);

  const filtered = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
    if (filter === 'upcoming') {
      return sorted
        .filter((s) => ['pending', 'accepted', 'scheduled'].includes(s.status))
        .reverse();
    }
    if (filter === 'completed') {
      return sorted.filter((s) => s.status === 'completed');
    }
    return sorted;
  }, [filter, sessions]);

  const joinLive = (session: SessionItem) => {
    const room = session.roomId || session._id;
    router.push({ pathname: '/live/[roomId]', params: { roomId: room } });
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={t.sessions.title}
        subtitle={t.sessions.subtitle}
        isRTL={isRTL}
        compact
      />

      <View style={styles.filterWrap}>
        <View style={[styles.filterBar, { flexDirection: rowDir }]}>
          {(['upcoming', 'completed', 'all'] as FilterTab[]).map((tab) => {
            const active = filter === tab;
            const label =
              tab === 'upcoming'
                ? t.sessions.filterUpcoming
                : tab === 'completed'
                  ? t.sessions.filterCompleted
                  : t.sessions.filterAll;
            return (
              <Pressable
                key={tab}
                onPress={() => setFilter(tab)}
                style={[styles.filterTab, active && styles.filterTabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={loading || error ? [] : filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSessions(true)}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : error ? (
            <StateView
              mode="error"
              title={t.sessions.loadError}
              description={error}
              actionLabel={t.common.retry}
              onAction={() => loadSessions(false)}
            />
          ) : (
            <StateView
              mode="empty"
              title={t.sessions.emptyTitle}
              description={t.sessions.emptyDesc}
              actionLabel={t.sessions.bookNow}
              onAction={() => router.push({ pathname: '/teachers', params: { tab: 'trial' } })}
            />
          )
        }
        renderItem={({ item }) => {
          const canJoin = ['accepted', 'scheduled'].includes(item.status);
          const teacherName =
            item.circle?.name
            || item.teacher?.personalInfo?.fullName
            || item.teacher?.user?.name
            || t.sessions.teacherFallback;
          const statusLabel = t.sessions.status[item.status] || item.status;
          const typeLabel = t.sessions.type[item.type] || item.type;

          return (
            <View style={styles.card}>
              <View style={[styles.cardTop, { flexDirection: rowDir }]}>
                <View style={styles.typePill}>
                  <Text style={styles.typeText}>{typeLabel}</Text>
                </View>
                <View style={[styles.statusPill, canJoin && styles.statusPillActive]}>
                  <Text style={[styles.statusText, canJoin && styles.statusTextActive]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <Text style={[styles.teacherName, { textAlign: align }]}>{teacherName}</Text>

              <View style={[styles.metaRow, { flexDirection: rowDir }]}>
                <Calendar size={14} color={colors.emerald} />
                <Text style={styles.metaText}>{formatDate(item.scheduledAt, locale)}</Text>
                {item.duration ? (
                  <>
                    <Clock size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{item.duration} {t.sessions.durationMin}</Text>
                  </>
                ) : null}
              </View>

              {item.notes ? (
                <Text style={[styles.notes, { textAlign: align }]}>{item.notes}</Text>
              ) : null}

              {canJoin ? (
                <PrimaryButton
                  label={t.sessions.joinClassroom}
                  icon={<Video size={17} color={colors.textInverse} />}
                  onPress={() => joinLive(item)}
                  style={styles.joinBtn}
                />
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  filterWrap: {
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterBar: {
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
    ...shadows.card,
  },
  filterTab: {
    flex: 1,
    minHeight: TOUCH_MIN - 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: colors.emerald },
  filterText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  filterTextActive: { color: colors.textInverse },
  listContent: {
    flexGrow: 1,
    backgroundColor: colors.ivory,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardTop: { justifyContent: 'space-between', alignItems: 'center' },
  typePill: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  typeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  statusPill: {
    backgroundColor: colors.ivoryDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPillActive: { backgroundColor: colors.emeraldSoft },
  statusText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  statusTextActive: { color: colors.emeraldDark },
  teacherName: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textPrimary, marginTop: 2 },
  metaRow: { alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  notes: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  joinBtn: { marginTop: spacing.xs },
});
