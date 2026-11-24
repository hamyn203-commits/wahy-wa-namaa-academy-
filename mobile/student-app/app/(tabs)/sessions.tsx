import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, Star, Video, X } from 'lucide-react-native';
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
  const [rateTarget, setRateTarget] = useState<SessionItem | null>(null);
  const [rateStars, setRateStars] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [rateContinue, setRateContinue] = useState(true);
  const [submittingRate, setSubmittingRate] = useState(false);
  const [rateErr, setRateErr] = useState('');

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

  const openRateModal = (session: SessionItem) => {
    setRateTarget(session);
    setRateStars(5);
    setRateComment('');
    setRateContinue(true);
    setRateErr('');
  };

  const submitSessionRating = async () => {
    if (!rateTarget || submittingRate) return;
    setSubmittingRate(true);
    setRateErr('');
    try {
      try {
        await api.post(
          '/api/reviews',
          {
            sessionId: rateTarget._id,
            teacherId: rateTarget.teacher?._id,
            rating: rateStars,
            comment: rateComment.trim(),
            wouldContinue: rateContinue,
          },
          { auth: true }
        );
      } catch (revErr) {
        const msg = revErr instanceof Error ? revErr.message : '';
        if (!msg.toLowerCase().includes('already reviewed')) {
          throw revErr;
        }
      }
      await api
        .put(
          `/api/sessions/${encodeURIComponent(rateTarget._id)}/feedback`,
          { rating: rateStars, comment: rateComment.trim(), wouldContinue: rateContinue },
          { auth: true }
        )
        .catch(() => {});
      setRateTarget(null);
      await loadSessions(true);
    } catch (err) {
      setRateErr(
        err instanceof Error
          ? err.message
          : locale === 'ar'
            ? 'تعذر إرسال التقييم حالياً'
            : 'Could not submit rating'
      );
    } finally {
      setSubmittingRate(false);
    }
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

              {!isGuardian && item.status === 'completed' ? (
                (item.myFeedback?.rating || item.studentFeedback?.rating) ? (
                  <View style={[styles.ratedBadge, { flexDirection: rowDir }]}>
                    <Star size={14} color={colors.goldDark} fill={colors.gold} />
                    <Text style={styles.ratedBadgeText}>
                      {locale === 'ar'
                        ? `تم تقييم المعلم (${item.myFeedback?.rating || item.studentFeedback?.rating}/5)`
                        : `Rated (${item.myFeedback?.rating || item.studentFeedback?.rating}/5)`}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => openRateModal(item)}
                    style={({ pressed }) => [styles.rateBtn, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                  >
                    <Star size={16} color={colors.emeraldNight} fill={colors.emeraldNight} />
                    <Text style={styles.rateBtnText}>
                      {locale === 'ar' ? 'تقييم المعلم والحصة' : 'Rate Tutor & Session'}
                    </Text>
                  </Pressable>
                )
              ) : null}
            </View>
          );
        }}
      />

      <Modal
        visible={Boolean(rateTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submittingRate) setRateTarget(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={[styles.modalTitle, { textAlign: align }]} numberOfLines={1}>
                {locale === 'ar' ? 'تقييم المعلم والحصة' : 'Rate Tutor & Session'}
              </Text>
              <Pressable
                disabled={submittingRate}
                onPress={() => setRateTarget(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { textAlign: align }]}>
              {rateTarget?.teacher?.personalInfo?.fullName ||
                rateTarget?.teacher?.user?.name ||
                rateTarget?.circle?.name ||
                t.sessions.teacherFallback}
            </Text>

            <View style={[styles.modalStarsRow, { flexDirection: rowDir }]}>
              {[1, 2, 3, 4, 5].map((st) => {
                const active = st <= rateStars;
                return (
                  <Pressable
                    key={st}
                    disabled={submittingRate}
                    onPress={() => setRateStars(st)}
                    style={[styles.modalStarBtn, active && styles.modalStarBtnActive]}
                  >
                    <Star
                      size={24}
                      color={active ? colors.goldDark : colors.textTertiary}
                      fill={active ? colors.gold : 'transparent'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={rateComment}
              onChangeText={setRateComment}
              editable={!submittingRate}
              multiline
              numberOfLines={3}
              placeholder={
                locale === 'ar'
                  ? 'اكتب تعليقك حول الحصة والمعلم (اختياري)…'
                  : 'Write your feedback (optional)…'
              }
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { textAlign: align }]}
            />

            <View style={[styles.modalContinueRow, { flexDirection: rowDir }]}>
              <Text style={[styles.modalContinueText, { textAlign: align }]}>
                {locale === 'ar'
                  ? 'أرغب في الاستمرار مع هذا المعلم'
                  : 'I would like to continue with this tutor'}
              </Text>
              <Switch
                value={rateContinue}
                onValueChange={setRateContinue}
                disabled={submittingRate}
                trackColor={{ false: colors.borderSoft, true: colors.emerald }}
              />
            </View>

            {rateErr ? <Text style={styles.modalErrText}>{rateErr}</Text> : null}

            <Pressable
              disabled={submittingRate}
              onPress={() => void submitSessionRating()}
              style={({ pressed }) => [
                styles.modalSubmitBtn,
                (pressed || submittingRate) && { opacity: 0.8 },
              ]}
            >
              {submittingRate ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalSubmitText}>
                  {locale === 'ar' ? 'إرسال التقييم' : 'Submit Rating'}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  rateBtn: {
    marginTop: spacing.xs,
    minHeight: TOUCH_MIN - 4,
    borderRadius: radius.lg,
    backgroundColor: colors.goldBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  rateBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.emeraldNight,
  },
  ratedBadge: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
  },
  ratedBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.goldDark,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 31, 24, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.emeraldDark,
  },
  modalStarsRow: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalStarBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStarBtnActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  modalInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  modalContinueRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  modalContinueText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  modalErrText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.danger,
    textAlign: 'center',
  },
  modalSubmitBtn: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.lg,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.white,
  },
});
