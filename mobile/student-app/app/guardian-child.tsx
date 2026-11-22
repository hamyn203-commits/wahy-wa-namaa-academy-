import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Link2, Users, X } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { GuardianChildSummary, GuardianFamilyOverview, GuardianInvitation } from '../src/types/academy';

interface ChildReportPayload {
  summary?: {
    totalSessions?: number;
    completedSessions?: number;
    attendanceRate?: number;
    pendingHomework?: number;
    averageRating?: number;
  };
  recentEvaluations?: Array<{ _id?: string; notes?: string; overallRating?: number; date?: string }>;
}

export default function GuardianChildScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const { locale, isRTL, t } = useI18n();

  const [children, setChildren] = useState<GuardianChildSummary[]>([]);
  const [invitations, setInvitations] = useState<GuardianInvitation[]>([]);
  const [selectedId, setSelectedId] = useState<string>(params.studentId || '');
  const [report, setReport] = useState<ChildReportPayload | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadGuardianData = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const [famRes, invRes] = await Promise.allSettled([
        api.get<GuardianFamilyOverview>('/api/guardian/family-overview', { auth: true }),
        api.get<{ invitations?: GuardianInvitation[] }>('/api/guardian/invitations', { auth: true }),
      ]);
      if (famRes.status === 'fulfilled') {
        const list = famRes.value.children ?? [];
        setChildren(list);
        if (!selectedId && list[0]?.student?._id) {
          setSelectedId(list[0].student._id);
        }
      }
      if (invRes.status === 'fulfilled') {
        setInvitations(invRes.value.invitations ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadGuardianData(false);
  }, [loadGuardianData]);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    let active = true;
    void api
      .get<ChildReportPayload>(`/api/guardian/reports/${encodeURIComponent(selectedId)}`, { auth: true })
      .then((res) => {
        if (active) setReport(res);
      })
      .catch(() => {
        if (active) setReport(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleLinkChild = async () => {
    const clean = studentCode.trim().toUpperCase();
    if (!clean) {
      Alert.alert(t.brandShort, t.auth.missingFields);
      return;
    }
    setLinking(true);
    try {
      const res = await api.post<{ message?: string }>(
        '/api/guardian/link-child',
        { studentCode: clean },
        { auth: true }
      );
      setStudentCode('');
      Alert.alert(t.common.success, res.message || (locale === 'ar' ? 'تم ربط الطالب بنجاح!' : 'Child linked successfully!'));
      void loadGuardianData(true);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setLinking(false);
    }
  };

  const respondInvitation = async (id: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/api/guardian/invitations/${encodeURIComponent(id)}/respond`, { action }, { auth: true });
      void loadGuardianData(true);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'بوابة الأبناء والتقارير' : 'Children & Reports'}
        subtitle={locale === 'ar' ? 'اربط حسابات أبنائك وتابع تقاريرهم وحضورهم من التطبيق.' : 'Link your children and monitor their reports in-app.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadGuardianData(true)} tintColor={colors.emerald} />}
      >
        {/* Link Child Card */}
        <View style={styles.card}>
          <View style={[styles.headRow, { flexDirection: rowDir }]}>
            <Link2 size={18} color={colors.emerald} />
            <Text style={styles.cardTitle}>
              {locale === 'ar' ? 'ربط حساب طالب بكود الربط' : 'Link Student via Code'}
            </Text>
          </View>
          <TextInput
            value={studentCode}
            onChangeText={setStudentCode}
            placeholder="WN-XXXXXXXX"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            style={styles.codeInput}
          />
          <PrimaryButton
            label={locale === 'ar' ? 'ربط الطالب الآن' : 'Link Child Now'}
            loading={linking}
            onPress={() => void handleLinkChild()}
          />
        </View>

        {/* Pending Invitations */}
        {invitations.length > 0 ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'دعوات الربط المعلقة' : 'Pending Invitations'}
            </Text>
            {invitations.map((inv) => (
              <View key={inv._id} style={styles.invRow}>
                <Text style={[styles.invName, { textAlign: align }]}>
                  {inv.student?.name || inv.student?.email || t.common.student}
                </Text>
                <View style={[styles.invActions, { flexDirection: rowDir }]}>
                  <Pressable onPress={() => void respondInvitation(inv._id, 'accept')} style={styles.acceptBtn}>
                    <Check size={15} color={colors.white} />
                    <Text style={styles.acceptText}>{locale === 'ar' ? 'قبول' : 'Accept'}</Text>
                  </Pressable>
                  <Pressable onPress={() => void respondInvitation(inv._id, 'reject')} style={styles.rejectBtn}>
                    <X size={15} color={colors.danger} />
                    <Text style={styles.rejectText}>{locale === 'ar' ? 'رفض' : 'Decline'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Linked Children Selector & Report */}
        {loading ? (
          <SkeletonCard lines={3} />
        ) : children.length > 0 ? (
          <View style={styles.card}>
            <View style={[styles.headRow, { flexDirection: rowDir }]}>
              <Users size={18} color={colors.emerald} />
              <Text style={styles.cardTitle}>{locale === 'ar' ? 'تقرير الابن' : 'Child Report'}</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {children.map((c) => {
                const cid = c.student?._id || '';
                const active = selectedId === cid;
                return (
                  <Pressable
                    key={cid}
                    onPress={() => setSelectedId(cid)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c.student?.name || t.common.student}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {report?.summary ? (
              <View style={styles.reportBox}>
                <Text style={[styles.reportLine, { textAlign: align }]}>
                  {locale === 'ar'
                    ? `الحصص المكتملة: ${report.summary.completedSessions ?? 0} من ${report.summary.totalSessions ?? 0}`
                    : `Completed Sessions: ${report.summary.completedSessions ?? 0} / ${report.summary.totalSessions ?? 0}`}
                </Text>
                <Text style={[styles.reportLine, { textAlign: align }]}>
                  {locale === 'ar'
                    ? `نسبة الحضور: ${Math.round(report.summary.attendanceRate ?? 0)}% • واجبات معلقة: ${report.summary.pendingHomework ?? 0}`
                    : `Attendance: ${Math.round(report.summary.attendanceRate ?? 0)}% • Pending HW: ${report.summary.pendingHomework ?? 0}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  headRow: { alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  codeInput: {
    minHeight: TOUCH_MIN + 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontFamily: fonts.extraBold,
    letterSpacing: 2,
    color: colors.emeraldDark,
    textAlign: 'center',
  },
  invRow: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    gap: spacing.sm,
  },
  invName: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  invActions: { gap: spacing.sm },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.emerald,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  acceptText: { color: colors.white, fontSize: 13, fontFamily: fonts.bold },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  rejectText: { color: colors.danger, fontSize: 13, fontFamily: fonts.bold },
  chips: { gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  chipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse },
  reportBox: {
    backgroundColor: colors.emeraldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  reportLine: { fontSize: 14, fontFamily: fonts.bold, color: colors.emeraldDark },
});
