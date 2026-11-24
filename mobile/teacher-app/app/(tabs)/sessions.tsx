import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Award,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  MessageSquare,
  Video,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/lib/api';
import { formatDateTime, getSessionTitle, toLocalDateTimeInput } from '../../src/lib/formatters';
import { TeacherSession } from '../../src/types/teacher';
import { DateTimePickerModal } from '../../src/components/DateTimePickerModal';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScoreStepper } from '../../src/components/ScoreStepper';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { SurahPickerModal } from '../../src/components/SurahPickerModal';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';

type Segment = 'pending' | 'upcoming' | 'completed';

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const TRACKS = ['memorization', 'tajweed', 'ijazah', 'arabic', 'kids'] as const;

export default function TeacherSessionsScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [segment, setSegment] = useState<Segment>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [pendingList, setPendingList] = useState<TeacherSession[]>([]);
  const [upcomingList, setUpcomingList] = useState<TeacherSession[]>([]);
  const [completedList, setCompletedList] = useState<TeacherSession[]>([]);
  const [busyId, setBusyId] = useState('');

  // Reject Modal
  const [rejectSession, setRejectSession] = useState<TeacherSession | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Reschedule Modal
  const [rescheduleSession, setRescheduleSession] = useState<TeacherSession | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [selectedSurahMaxAyahs, setSelectedSurahMaxAyahs] = useState<number | null>(null);

  // Complete & Evaluate Modal (works for both 1-on-1 & Group Circle)
  const [evalSession, setEvalSession] = useState<TeacherSession | null>(null);
  const [attendanceScore, setAttendanceScore] = useState(5);
  const [memScore, setMemScore] = useState(5);
  const [tajweedScore, setTajweedScore] = useState(5);
  const [behaviorScore, setBehaviorScore] = useState(5);
  const [commitScore, setCommitScore] = useState(5);
  const [surahRecited, setSurahRecited] = useState('');
  const [fromAyah, setFromAyah] = useState('');
  const [toAyah, setToAyah] = useState('');
  const [nextHomework, setNextHomework] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [recommendedLevel, setRecommendedLevel] = useState<string>('beginner');
  const [recommendedTrack, setRecommendedTrack] = useState<string>('memorization');
  const [assignToCircle, setAssignToCircle] = useState(true);
  const [trialRequestId, setTrialRequestId] = useState('');
  const [submittingEval, setSubmittingEval] = useState(false);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);

    try {
      const [trials, pendReg, accepted, completed] = await Promise.all([
        api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?type=trial&status=pending', { auth: true }),
        api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?type=regular&status=pending', { auth: true }),
        api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?status=accepted&limit=100', { auth: true }),
        api.get<{ sessions?: TeacherSession[] }>('/api/sessions/my-sessions?status=completed&limit=60', { auth: true }),
      ]);

      const mergedPending = [...(trials.sessions || []), ...(pendReg.sessions || [])].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      const sortedUpcoming = [...(accepted.sessions || [])].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      const sortedCompleted = [...(completed.sessions || [])].sort(
        (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );

      setPendingList(mergedPending);
      setUpcomingList(sortedUpcoming);
      setCompletedList(sortedCompleted);
      if (mergedPending.length === 0 && sortedUpcoming.length > 0 && !isRefresh) {
        setSegment('upcoming');
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions(false);
  }, [loadSessions]);

  const activeData = useMemo(() => {
    if (segment === 'pending') return pendingList;
    if (segment === 'upcoming') return upcomingList;
    return completedList;
  }, [segment, pendingList, upcomingList, completedList]);

  const respondSession = async (
    session: TeacherSession,
    action: 'accept' | 'reject' | 'reschedule',
    extra: { reason?: string; rescheduledDate?: string } = {}
  ) => {
    if (busyId) return;
    setBusyId(session._id);
    try {
      await api.put(
        `/api/sessions/${session._id}/respond`,
        {
          action,
          provider: action === 'accept' ? 'livekit' : undefined,
          reason: extra.reason,
          rescheduledDate: extra.rescheduledDate,
          rescheduleTimezone: session.timezone || 'Africa/Cairo',
        },
        { auth: true }
      );
      setRejectSession(null);
      setRejectReason('');
      setRescheduleSession(null);
      setRescheduleDate('');
      await loadSessions(true);
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setBusyId('');
    }
  };

  const handleEnterRoom = async (session: TeacherSession) => {
    if (busyId) return;
    setBusyId(session._id);
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
      setBusyId('');
    }
  };

  const markAttendance = async (
    session: TeacherSession,
    studentId: string,
    status: 'attended' | 'absent' | 'excused'
  ) => {
    try {
      const result = await api.patch<{ attendance?: TeacherSession['attendance'] }>(
        `/api/sessions/${session._id}/attendance`,
        { records: [{ studentId, status }] },
        { auth: true }
      );
      setUpcomingList((prev) =>
        prev.map((item) =>
          item._id === session._id
            ? { ...item, attendance: result.attendance || item.attendance }
            : item
        )
      );
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    }
  };

  const openEvalModal = async (session: TeacherSession) => {
    setEvalSession(session);
    setAttendanceScore(5);
    setMemScore(5);
    setTajweedScore(5);
    setBehaviorScore(5);
    setCommitScore(5);
    setSurahRecited('');
    setFromAyah('');
    setToAyah('');
    setNextHomework('');
    setOverallNotes('');
    setRecommendedLevel('beginner');
    setRecommendedTrack('memorization');
    setAssignToCircle(true);
    setTrialRequestId('');

    if (session.type === 'trial') {
      try {
        const res = await api.get<{ trial?: { _id?: string }; trialRequest?: { _id?: string } }>(
          `/api/trials/by-session/${session._id}`,
          { auth: true }
        );
        const linkedId = res.trial?._id || res.trialRequest?._id;
        if (linkedId) setTrialRequestId(linkedId);
      } catch {
        // Optional trial assessment lookup.
      }
    }
  };

  const submitCompleteSession = async () => {
    if (!evalSession || submittingEval) return;
    const fromNum = fromAyah.trim() ? Number(fromAyah.trim()) : undefined;
    const toNum = toAyah.trim() ? Number(toAyah.trim()) : undefined;
    if (fromNum !== undefined && toNum !== undefined && toNum < fromNum) {
      Alert.alert(t.common.errorTitle, 'يجب أن تكون آية النهاية أكبر من أو تساوي آية البداية.');
      return;
    }

    setSubmittingEval(true);
    try {
      const isGroup = evalSession.type === 'group_circle';
      await api.put(
        `/api/sessions/${evalSession._id}/complete`,
        {
          evaluation: {
            attendance: attendanceScore,
            memorization: memScore,
            tajweed: tajweedScore,
            behavior: behaviorScore,
            commitment: commitScore,
            surahRecited: surahRecited.trim(),
            fromAyah: fromNum,
            toAyah: toNum,
            nextHomework: nextHomework.trim(),
            overallNotes: overallNotes.trim() || (isGroup ? 'تم إغلاق الحصة الجماعية من تطبيق المعلم' : ''),
            ...(evalSession.type === 'trial'
              ? { recommendedLevel, recommendedTrack }
              : {}),
          },
        },
        { auth: true }
      );

      if (isGroup) {
        const attended = (evalSession.attendance || []).filter((e) => e.status === 'attended');
        if (attended.length > 0) {
          await api
            .post(
              `/api/sessions/${evalSession._id}/report`,
              {
                studentReports: attended.map((entry) => ({
                  student: typeof entry.student === 'string' ? entry.student : entry.student?._id,
                  memorizationScore: Math.min(10, memScore * 2),
                  tajweedScore: Math.min(10, tajweedScore * 2),
                  surahRecited: surahRecited.trim(),
                  fromAyah: fromNum,
                  toAyah: toNum,
                  nextHomework: nextHomework.trim(),
                  notes: overallNotes.trim(),
                })),
              },
              { auth: true }
            )
            .catch(() => {});
        }
        if (assignToCircle && nextHomework.trim() && evalSession.circle?._id) {
          await api
            .post(
              '/api/teachers/dashboard/tasks',
              {
                circleId: evalSession.circle._id,
                sessionId: evalSession._id,
                type: 'memorization',
                title: `واجب ${surahRecited.trim() || evalSession.circle.name}`,
                description: nextHomework.trim(),
              },
              { auth: true }
            )
            .catch(() => {});
        }
      } else {
        await api
          .post(
            `/api/sessions/${evalSession._id}/report`,
            {
              studentId: evalSession.student?._id,
              memorizationScore: Math.min(10, memScore * 2),
              tajweedScore: Math.min(10, tajweedScore * 2),
              surahRecited: surahRecited.trim(),
              fromAyah: fromNum,
              toAyah: toNum,
              nextHomework: nextHomework.trim(),
              notes: overallNotes.trim(),
            },
            { auth: true }
          )
          .catch(() => {});

        if (evalSession.type === 'trial' && trialRequestId) {
          await api
            .put(
              `/api/trials/${trialRequestId}/assess`,
              {
                level: recommendedLevel,
                recommendedTrack,
                notes: overallNotes.trim(),
              },
              { auth: true }
            )
            .catch(() => {});
        }
      }

      setEvalSession(null);
      await loadSessions(true);
      Alert.alert('تم بنجاح', 'تم إنهاء الحصة وحفظ التقييم بنجاح.');
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSubmittingEval(false);
    }
  };

  const sessionTypeBadge = (type: TeacherSession['type']) => {
    if (type === 'trial') return { label: t.sessions.typeTrial, bg: colors.goldSoft, color: colors.goldDark };
    if (type === 'group_circle') return { label: t.sessions.typeGroup, bg: colors.infoSoft, color: colors.info };
    return { label: t.sessions.typeRegular, bg: colors.emeraldSoft, color: colors.emeraldDark };
  };

  const renderSessionCard = useCallback(
    ({ item }: { item: TeacherSession }) => {
      const badge = sessionTypeBadge(item.type);
      const isBusy = busyId === item._id;

      return (
        <View style={styles.card}>
          <View style={[styles.cardHead, { flexDirection: rowDir }]}>
            <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatDateTime(item.scheduledAt, locale)}</Text>
          </View>

          <Text style={[styles.studentName, { textAlign: align }]}>
            {getSessionTitle(item, locale)}
          </Text>

          <Text style={[styles.metaLine, { textAlign: align }]}>
            {item.duration || 60} {t.common.minutes}
            {item.notes ? ` • ${item.notes}` : ''}
          </Text>

          {segment === 'pending' ? (
            <View style={[styles.actionRow, { flexDirection: rowDir }]}>
              <PrimaryButton
                label={t.sessions.accept}
                onPress={() => void respondSession(item, 'accept')}
                loading={isBusy}
                icon={<Check size={15} color={colors.textInverse} />}
                style={styles.flex}
              />
              <PrimaryButton
                label={t.sessions.reschedule}
                variant="secondary"
                onPress={() => {
                  setRescheduleSession(item);
                  setRescheduleDate(toLocalDateTimeInput());
                }}
              />
              <PrimaryButton
                label={t.sessions.reject}
                variant="danger"
                onPress={() => {
                  setRejectSession(item);
                  setRejectReason('');
                }}
              />
            </View>
          ) : null}

          {segment === 'upcoming' ? (
            <>
              {item.type === 'group_circle' && Array.isArray(item.attendance) && item.attendance.length > 0 ? (
                <View style={styles.attendanceBox}>
                  <Text style={[styles.attendanceTitle, { textAlign: align }]}>
                    {t.sessions.attendance}
                  </Text>
                  {item.attendance.map((entry, idx) => {
                    const sid = typeof entry.student === 'string' ? entry.student : entry.student?._id || String(idx);
                    const sname = typeof entry.student === 'object' ? entry.student?.name : t.common.studentFallback;
                    return (
                      <View key={sid} style={[styles.attRow, { flexDirection: rowDir }]}>
                        <Text style={styles.attName} numberOfLines={1}>{sname}</Text>
                        <View style={styles.attPills}>
                          {(['attended', 'absent', 'excused'] as const).map((st) => {
                            const active = entry.status === st;
                            return (
                              <Pressable
                                key={st}
                                onPress={() => void markAttendance(item, sid, st)}
                                style={[styles.attPill, active && styles.attPillActive]}
                              >
                                <Text style={[styles.attPillText, active && styles.attPillTextActive]}>
                                  {st === 'attended' ? t.sessions.attended : st === 'absent' ? t.sessions.absent : t.sessions.excused}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={[styles.actionRow, { flexDirection: rowDir }]}>
                <PrimaryButton
                  label={t.sessions.enterRoom}
                  onPress={() => void handleEnterRoom(item)}
                  loading={isBusy}
                  icon={<Video size={15} color={colors.textInverse} />}
                  style={styles.flex}
                />
                <PrimaryButton
                  label={t.sessions.chat}
                  variant="secondary"
                  onPress={() => router.push(`/session-chat/${encodeURIComponent(item._id)}`)}
                  icon={<MessageSquare size={15} color={colors.emeraldDark} />}
                />
              </View>
              <PrimaryButton
                label={t.sessions.completeEval}
                variant="gold"
                onPress={() => void openEvalModal(item)}
                icon={<CheckCircle2 size={16} color={colors.emeraldDeep} />}
              />
            </>
          ) : null}

          {segment === 'completed' && item.evaluation ? (
            <View style={styles.evalSummary}>
              {item.evaluation.surahRecited ? (
                <Text style={[styles.evalSummaryLine, { textAlign: align }]}>
                  📖 {item.evaluation.surahRecited}
                  {item.evaluation.fromAyah ? ` (${item.evaluation.fromAyah} - ${item.evaluation.toAyah || ''})` : ''}
                </Text>
              ) : null}
              <Text style={[styles.evalSummaryMeta, { textAlign: align }]}>
                {t.sessions.scoreMemorization}: {item.evaluation.memorization ?? '-'}/5 • {t.sessions.scoreTajweed}: {item.evaluation.tajweed ?? '-'}/5
              </Text>
              {item.evaluation.overallNotes ? (
                <Text style={[styles.evalSummaryMeta, { textAlign: align }]}>
                  {item.evaluation.overallNotes}
                </Text>
              ) : null}
              {item.student?._id ? (
                <PrimaryButton
                  label={locale === 'ar' ? 'إرسال بطاقة إنجاز لولي الأمر' : 'Send Award Card'}
                  variant="gold"
                  onPress={() =>
                    router.push({
                      pathname: '/achievement-card',
                      params: {
                        studentId: item.student?._id || '',
                        studentName: item.student?.name || '',
                        surah: item.evaluation?.surahRecited || 'القرآن الكريم',
                      },
                    })
                  }
                  icon={<Award size={15} color={colors.emeraldDeep} />}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId, locale, rowDir, align, segment, t]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.sessions.title}
        subtitle={t.sessions.subtitle}
        isRTL={isRTL}
        compact
      />

      {/* Segmented Control */}
      <View style={[styles.segmentBar, { flexDirection: rowDir }]}>
        {(
          [
            { key: 'pending', label: t.sessions.tabPending.replace('{count}', String(pendingList.length)) },
            { key: 'upcoming', label: t.sessions.tabUpcoming.replace('{count}', String(upcomingList.length)) },
            { key: 'completed', label: t.sessions.tabCompleted.replace('{count}', String(completedList.length)) },
          ] as const
        ).map((tabItem) => {
          const active = segment === tabItem.key;
          return (
            <Pressable
              key={tabItem.key}
              onPress={() => setSegment(tabItem.key)}
              style={[styles.segBtn, active && styles.segBtnActive]}
              accessibilityRole="tab"
            >
              <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                {tabItem.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </View>
      ) : loadError ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={t.common.errorGeneric}
            actionLabel={t.common.retry}
            onAction={() => void loadSessions(false)}
          />
        </View>
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item._id}
          renderItem={renderSessionCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadSessions(true)}
              tintColor={colors.emerald}
            />
          }
          ListEmptyComponent={
            <StateView
              mode="empty"
              title={
                segment === 'pending'
                  ? t.sessions.emptyPending
                  : segment === 'upcoming'
                    ? t.sessions.emptyUpcoming
                    : t.sessions.emptyCompleted
              }
            />
          }
        />
      )}

      {/* Reject Modal */}
      <Modal visible={Boolean(rejectSession)} transparent animationType="slide" onRequestClose={() => setRejectSession(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.sessions.rejectTitle}</Text>
              <Pressable onPress={() => setRejectSession(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.rejectReasonLabel}</Text>
            <TextInput
              style={[styles.textArea, { textAlign: align }]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t.sessions.rejectReasonPlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={[styles.actionRow, { flexDirection: rowDir }]}>
              <PrimaryButton
                label={t.common.confirm}
                variant="danger"
                loading={Boolean(busyId)}
                onPress={() => {
                  if (rejectSession) void respondSession(rejectSession, 'reject', { reason: rejectReason.trim() });
                }}
                style={styles.flex}
              />
              <PrimaryButton label={t.common.cancel} variant="ghost" onPress={() => setRejectSession(null)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={Boolean(rescheduleSession)} transparent animationType="slide" onRequestClose={() => setRescheduleSession(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.sessions.rescheduleTitle}</Text>
              <Pressable onPress={() => setRescheduleSession(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.hintText, { textAlign: align }]}>{t.sessions.rescheduleHint}</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[styles.input, { justifyContent: 'center' }]}
            >
              <Text style={{ fontFamily: fonts.bold, color: colors.emeraldDark, textAlign: 'center' }}>
                📅 {rescheduleDate ? rescheduleDate.replace('T', '  •  ') : (locale === 'ar' ? 'اضغط لاختيار اليوم والوقت' : 'Tap to pick date & time')}
              </Text>
            </Pressable>
            <View style={[styles.actionRow, { flexDirection: rowDir }]}>
              <PrimaryButton
                label={t.common.submit}
                loading={Boolean(busyId)}
                onPress={() => {
                  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rescheduleDate.trim())) {
                    Alert.alert(t.common.errorTitle, t.sessions.rescheduleHint);
                    return;
                  }
                  if (rescheduleSession) {
                    void respondSession(rescheduleSession, 'reschedule', { rescheduledDate: rescheduleDate.trim() });
                  }
                }}
                icon={<CalendarClock size={16} color={colors.textInverse} />}
                style={styles.flex}
              />
              <PrimaryButton label={t.common.cancel} variant="ghost" onPress={() => setRescheduleSession(null)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete & Evaluate Modal */}
      <Modal visible={Boolean(evalSession)} transparent animationType="slide" onRequestClose={() => setEvalSession(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.evalModalCard]}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>
                {evalSession?.type === 'group_circle' ? t.sessions.evalGroupTitle : t.sessions.evalTitle}
              </Text>
              <Pressable onPress={() => setEvalSession(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.evalScroll} showsVerticalScrollIndicator={false}>
              <ScoreStepper label={t.sessions.scoreMemorization} value={memScore} onChange={setMemScore} isRTL={isRTL} />
              <ScoreStepper label={t.sessions.scoreTajweed} value={tajweedScore} onChange={setTajweedScore} isRTL={isRTL} />
              {evalSession?.type !== 'group_circle' ? (
                <>
                  <ScoreStepper label={t.sessions.scoreAttendance} value={attendanceScore} onChange={setAttendanceScore} isRTL={isRTL} />
                  <ScoreStepper label={t.sessions.scoreBehavior} value={behaviorScore} onChange={setBehaviorScore} isRTL={isRTL} />
                  <ScoreStepper label={t.sessions.scoreCommitment} value={commitScore} onChange={setCommitScore} isRTL={isRTL} />
                </>
              ) : null}

              <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
                <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.surahLabel}</Text>
                <Pressable
                  onPress={() => setSurahPickerOpen(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }}
                >
                  <BookOpen size={13} color={colors.emeraldDark} />
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.emeraldDark }}>
                    {locale === 'ar' ? 'قائمة السور (114)' : 'Pick Surah'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { textAlign: align }]}
                value={surahRecited}
                onChangeText={setSurahRecited}
                placeholder={t.sessions.surahPlaceholder}
                placeholderTextColor={colors.textTertiary}
              />
              {selectedSurahMaxAyahs ? (
                <Text style={[styles.hintText, { textAlign: align }]}>
                  {locale === 'ar' ? `عدد آيات السورة المختارة: ${selectedSurahMaxAyahs} آية` : `Surah max ayahs: ${selectedSurahMaxAyahs}`}
                </Text>
              ) : null}

              <View style={[styles.actionRow, { flexDirection: rowDir }]}>
                <View style={styles.flex}>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.fromAyah}</Text>
                  <TextInput
                    style={styles.input}
                    value={fromAyah}
                    onChangeText={setFromAyah}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.toAyah}</Text>
                  <TextInput
                    style={styles.input}
                    value={toAyah}
                    onChangeText={setToAyah}
                    keyboardType="number-pad"
                    placeholder="15"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.nextHomeworkLabel}</Text>
              <TextInput
                style={[styles.input, { textAlign: align }]}
                value={nextHomework}
                onChangeText={setNextHomework}
                placeholder={t.sessions.nextHomeworkPlaceholder}
                placeholderTextColor={colors.textTertiary}
              />

              {evalSession?.type === 'group_circle' ? (
                <View style={[styles.switchRow, { flexDirection: rowDir }]}>
                  <Text style={[styles.switchText, { textAlign: align }]}>{t.sessions.assignToCircle}</Text>
                  <Switch
                    value={assignToCircle}
                    onValueChange={setAssignToCircle}
                    trackColor={{ true: colors.emerald, false: colors.borderStrong }}
                  />
                </View>
              ) : null}

              {evalSession?.type === 'trial' ? (
                <>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.recommendedLevel}</Text>
                  <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                    {LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl}
                        onPress={() => setRecommendedLevel(lvl)}
                        style={[styles.chip, recommendedLevel === lvl && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, recommendedLevel === lvl && styles.chipTextActive]}>
                          {lvl}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.recommendedTrack}</Text>
                  <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                    {TRACKS.map((trk) => (
                      <Pressable
                        key={trk}
                        onPress={() => setRecommendedTrack(trk)}
                        style={[styles.chip, recommendedTrack === trk && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, recommendedTrack === trk && styles.chipTextActive]}>
                          {trk}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.sessions.notesLabel}</Text>
              <TextInput
                style={[styles.textArea, { textAlign: align }]}
                value={overallNotes}
                onChangeText={setOverallNotes}
                placeholder={t.sessions.notesPlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
              />

              <PrimaryButton
                label={t.sessions.completeEval}
                onPress={() => void submitCompleteSession()}
                loading={submittingEval}
                icon={<CheckCircle2 size={17} color={colors.textInverse} />}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <DateTimePickerModal
        visible={datePickerOpen}
        initialValue={rescheduleDate}
        title={t.sessions.rescheduleTitle}
        isRTL={isRTL}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(val) => setRescheduleDate(val)}
      />

      <SurahPickerModal
        visible={surahPickerOpen}
        isRTL={isRTL}
        onClose={() => setSurahPickerOpen(false)}
        onSelect={(s) => {
          void Haptics.selectionAsync().catch(() => {});
          setSurahRecited(`سورة ${s.nameAr}`);
          setSelectedSurahMaxAyahs(s.ayahs);
          if (!fromAyah) setFromAyah('1');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  segmentBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segBtnActive: { backgroundColor: colors.emerald },
  segText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  segTextActive: { color: colors.white },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHead: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  typeBadgeText: { fontSize: 11, fontFamily: fonts.bold },
  dateText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  studentName: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.textPrimary },
  metaLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  actionRow: { gap: spacing.sm, marginTop: spacing.xs },
  attendanceBox: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  attendanceTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  attRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  attName: { flex: 1, fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary },
  attPills: { flexDirection: 'row', gap: 4 },
  attPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attPillActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  attPillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  attPillTextActive: { color: colors.white },
  evalSummary: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  evalSummaryLine: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  evalSummaryMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxHeight: '88%',
  },
  evalModalCard: { maxHeight: '92%' },
  evalScroll: { gap: spacing.md, paddingBottom: spacing.xl },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  hintText: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  switchRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  switchText: { flex: 1, fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary },
  chipRow: { flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
  },
  chipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
});
