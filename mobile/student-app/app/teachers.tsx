import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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
import {
  Award,
  CheckCircle2,
  Clock,
  Globe,
  Search,
  Star,
  UserCheck,
  X,
} from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { PublicTeacher, TrialRequestItem } from '../src/types/academy';

type ActiveTab = 'directory' | 'trial';

const TRACKS = [
  { key: 'memorization', ar: 'حفظ ومراجعة القرآن', en: 'Memorization & Revision' },
  { key: 'tajweed_ijazah', ar: 'التجويد والإجازة', en: 'Tajweed & Ijazah' },
  { key: 'kids_foundation', ar: 'تأسيس الأطفال والقراءة', en: 'Kids Foundation' },
] as const;

export default function TeachersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [tab, setTab] = useState<ActiveTab>(params.tab === 'trial' ? 'trial' : 'directory');
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'' | 'male' | 'female'>('');
  const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
  const [myTrials, setMyTrials] = useState<TrialRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacher | null>(null);

  // Trial form state
  const [studentName, setStudentName] = useState(user?.name || '');
  const [guardianName, setGuardianName] = useState(user?.role === 'guardian' ? user?.name || '' : '');
  const [whatsappPhone, setWhatsappPhone] = useState(user?.phone || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '18');
  const [gender, setGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [preferredTrack, setPreferredTrack] = useState<string>('memorization');
  const [preferredTeacherGender, setPreferredTeacherGender] = useState<'male' | 'female' | 'any'>('any');
  const [notes, setNotes] = useState('');
  const [submittingTrial, setSubmittingTrial] = useState(false);

  const loadData = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const qs = new URLSearchParams({ limit: '24' });
      if (search.trim()) qs.set('search', search.trim());
      if (genderFilter) qs.set('gender', genderFilter);

      const [teachersRes, trialsRes] = await Promise.allSettled([
        api.get<{ teachers?: PublicTeacher[] }>(`/api/teachers?${qs.toString()}`),
        api.get<{ trials?: TrialRequestItem[] } | TrialRequestItem[]>('/api/trials/my', { auth: true }),
      ]);

      if (teachersRes.status === 'fulfilled') {
        setTeachers(teachersRes.value.teachers ?? []);
      } else {
        throw teachersRes.reason;
      }

      if (trialsRes.status === 'fulfilled') {
        const raw = trialsRes.value;
        setMyTrials(Array.isArray(raw) ? raw : raw.trials ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [genderFilter, search, t.home.loadError]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const handleBookWithTeacher = (teacher: PublicTeacher) => {
    const teacherName = teacher.personalInfo?.fullName || teacher.user?.name || '';
    if (teacher.personalInfo?.gender) {
      setPreferredTeacherGender(teacher.personalInfo.gender);
    }
    setNotes(
      locale === 'ar'
        ? `أرغب في حجز الحصة التجريبية مع المعلم/ة: ${teacherName}`
        : `Requesting trial with teacher: ${teacherName}`
    );
    setSelectedTeacher(null);
    setTab('trial');
  };

  const handleSubmitTrial = async () => {
    const parsedAge = parseInt(age, 10);
    if (!studentName.trim() || !whatsappPhone.trim() || !Number.isFinite(parsedAge)) {
      Alert.alert(t.brandShort, t.auth.missingFields);
      return;
    }
    if (parsedAge < 18 && guardianName.trim().length < 2) {
      Alert.alert(
        t.brandShort,
        locale === 'ar' ? 'اسم ولي الأمر مطلوب للطلاب أقل من 18 سنة.' : 'Guardian name is required for students under 18.'
      );
      return;
    }

    setSubmittingTrial(true);
    try {
      const res = await api.post<{ message?: string }>(
        '/api/trials',
        {
          studentName: studentName.trim(),
          guardianName: guardianName.trim(),
          whatsappPhone: whatsappPhone.trim(),
          email: user?.email || '',
          age: parsedAge,
          gender,
          preferredTrack,
          preferredTeacherGender,
          notes: notes.trim(),
        },
        { auth: true }
      );
      Alert.alert(
        t.common.success,
        res.message
          || (locale === 'ar'
            ? 'تم تسجيل طلب الحصة التجريبية المجانية بنجاح!'
            : 'Free trial request submitted successfully!')
      );
      setNotes('');
      void loadData(true);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSubmittingTrial(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'نخبة المعلمين والحجز' : 'Teachers & Free Trial'}
        subtitle={
          locale === 'ar'
            ? 'تصفح معلمي الأكاديمية المجازين واحجز حصتك التجريبية مباشرة.'
            : 'Explore certified Quran teachers and book your free trial in-app.'
        }
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <View style={styles.topSwitchWrap}>
        <View style={[styles.switchBar, { flexDirection: rowDir }]}>
          <Pressable
            onPress={() => setTab('directory')}
            style={[styles.switchBtn, tab === 'directory' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, tab === 'directory' && styles.switchTextActive]}>
              {locale === 'ar' ? 'دليل المعلمين' : 'Teachers'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('trial')}
            style={[styles.switchBtn, tab === 'trial' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, tab === 'trial' && styles.switchTextActive]}>
              {locale === 'ar' ? 'حجز حصة تجريبية' : 'Book Free Trial'}
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === 'directory' ? (
        <View style={styles.flex}>
          <View style={styles.searchSection}>
            <View style={[styles.searchBox, { flexDirection: rowDir }]}>
              <Search size={18} color={colors.emerald} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={locale === 'ar' ? 'ابحث باسم المعلم أو التخصص...' : 'Search by name or specialty...'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { textAlign: align }]}
                returnKeyType="search"
              />
            </View>
            <View style={[styles.chipRow, { flexDirection: rowDir }]}>
              {([
                { key: '', ar: 'الكل', en: 'All' },
                { key: 'male', ar: 'معلمون', en: 'Male' },
                { key: 'female', ar: 'معلمات', en: 'Female' },
              ] as const).map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGenderFilter(g.key)}
                  style={[styles.chip, genderFilter === g.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, genderFilter === g.key && styles.chipTextActive]}>
                    {locale === 'ar' ? g.ar : g.en}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <FlatList
            data={loading || error ? [] : teachers}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
                tintColor={colors.emerald}
                colors={[colors.emerald]}
              />
            }
            ListEmptyComponent={
              loading ? (
                <View style={{ gap: spacing.md }}>
                  <SkeletonCard lines={3} />
                  <SkeletonCard lines={3} />
                </View>
              ) : error ? (
                <StateView
                  mode="error"
                  title={t.home.loadError}
                  description={error}
                  actionLabel={t.common.retry}
                  onAction={() => loadData(false)}
                />
              ) : (
                <StateView
                  mode="empty"
                  title={locale === 'ar' ? 'لا يوجد معلمون مطابقون حالياً' : 'No matching teachers'}
                  description={locale === 'ar' ? 'جرّب تعديل البحث أو احجز حصة تجريبية وسنرشح لك الأنسب.' : 'Try adjusting filters or book a free trial directly.'}
                  actionLabel={locale === 'ar' ? 'حجز حصة تجريبية' : 'Book Free Trial'}
                  onAction={() => setTab('trial')}
                />
              )
            }
            renderItem={({ item }) => {
              const name = item.personalInfo?.fullName || item.user?.name || t.sessions.teacherFallback;
              const rating = Number(item.rating?.average || 5).toFixed(1);
              const exp = item.quranInfo?.teachingExperience || 0;
              const initial = name.trim().charAt(0) || 'م';

              return (
                <Pressable
                  onPress={() => setSelectedTeacher(item)}
                  style={({ pressed }) => [styles.teacherCard, pressed && styles.pressed]}
                >
                  <View style={[styles.teacherHead, { flexDirection: rowDir }]}>
                    <View style={styles.teacherAvatar}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                    <View style={styles.teacherInfo}>
                      <View style={[styles.nameRow, { flexDirection: rowDir }]}>
                        <Text style={[styles.teacherName, { textAlign: align }]} numberOfLines={1}>
                          {name}
                        </Text>
                        {item.isVerified ? <UserCheck size={16} color={colors.emerald} /> : null}
                      </View>
                      <Text style={[styles.teacherSpec, { textAlign: align }]} numberOfLines={1}>
                        {item.academicInfo?.specialization
                          || (item.quranInfo?.ijazah
                            ? locale === 'ar' ? 'معلم قرآن مجاز بالسند' : 'Certified Ijazah Teacher'
                            : locale === 'ar' ? 'معلم قرآن وتجويد' : 'Quran & Tajweed Teacher')}
                      </Text>
                      <View style={[styles.badgesRow, { flexDirection: rowDir }]}>
                        <View style={styles.ratingPill}>
                          <Star size={12} color={colors.goldDark} fill={colors.gold} />
                          <Text style={styles.ratingText}>{rating}</Text>
                        </View>
                        {exp > 0 ? (
                          <View style={styles.metaPill}>
                            <Clock size={12} color={colors.emerald} />
                            <Text style={styles.metaPillText}>
                              {exp} {locale === 'ar' ? 'سنوات خبرة' : 'yrs'}
                            </Text>
                          </View>
                        ) : null}
                        {item.quranInfo?.ijazah ? (
                          <View style={styles.metaPill}>
                            <Award size={12} color={colors.emerald} />
                            <Text style={styles.metaPillText}>{locale === 'ar' ? 'إجازة' : 'Ijazah'}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <PrimaryButton
                    label={locale === 'ar' ? 'احجز حصة تجريبية مع هذا المعلم' : 'Book Free Trial'}
                    variant="secondary"
                    onPress={() => handleBookWithTeacher(item)}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={[styles.formTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'احجز حصتك التجريبية المجانية' : 'Book Your Free Trial Class'}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'اسم الطالب' : 'Student Name'}
              </Text>
              <TextInput
                value={studentName}
                onChangeText={setStudentName}
                placeholder={t.auth.namePlaceholder}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { textAlign: align }]}
              />
            </View>

            <View style={[styles.twoCol, { flexDirection: rowDir }]}>
              <View style={[styles.field, styles.flex]}>
                <Text style={[styles.label, { textAlign: align }]}>
                  {locale === 'ar' ? 'العمر' : 'Age'}
                </Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  style={[styles.input, { textAlign: align }]}
                />
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={[styles.label, { textAlign: align }]}>
                  {locale === 'ar' ? 'النوع' : 'Gender'}
                </Text>
                <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                  {(['male', 'female'] as const).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setGender(g)}
                      style={[styles.chip, styles.flex, gender === g && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                        {g === 'male' ? (locale === 'ar' ? 'ذكر' : 'Male') : (locale === 'ar' ? 'أنثى' : 'Female')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {parseInt(age, 10) < 18 ? (
              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: align }]}>
                  {locale === 'ar' ? 'اسم ولي الأمر (مطلوب لمن هم دون 18 عاماً)' : 'Guardian Name (required under 18)'}
                </Text>
                <TextInput
                  value={guardianName}
                  onChangeText={setGuardianName}
                  placeholder={locale === 'ar' ? 'اكتب اسم ولي الأمر' : 'Guardian full name'}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { textAlign: align }]}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'رقم الواتساب (بكود الدولة)' : 'WhatsApp Number (with country code)'}
              </Text>
              <TextInput
                value={whatsappPhone}
                onChangeText={setWhatsappPhone}
                placeholder="+2010xxxxxxxx"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                style={[styles.input, { textAlign: 'left' }]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'المسار المفضل' : 'Learning Track'}
              </Text>
              <View style={styles.trackStack}>
                {TRACKS.map((tr) => {
                  const active = preferredTrack === tr.key;
                  return (
                    <Pressable
                      key={tr.key}
                      onPress={() => setPreferredTrack(tr.key)}
                      style={[styles.trackOption, { flexDirection: rowDir }, active && styles.trackOptionActive]}
                    >
                      <CheckCircle2 size={18} color={active ? colors.emerald : colors.borderStrong} />
                      <Text style={[styles.trackText, active && styles.trackTextActive]}>
                        {locale === 'ar' ? tr.ar : tr.en}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'ملاحظات أو أوقات مفضلة' : 'Notes / Preferred Times'}
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder={locale === 'ar' ? 'مثال: متاح مساءً بعد الساعة 7...' : 'e.g. Available evenings after 7 PM...'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, styles.textArea, { textAlign: align }]}
              />
            </View>

            <PrimaryButton
              label={locale === 'ar' ? 'تأكيد طلب الحصة التجريبية' : 'Submit Free Trial Request'}
              variant="gold"
              loading={submittingTrial}
              onPress={() => void handleSubmitTrial()}
            />
          </View>

          {myTrials.length > 0 ? (
            <View style={styles.formCard}>
              <Text style={[styles.formTitle, { textAlign: align }]}>
                {locale === 'ar' ? 'طلبات الحصص التجريبية السابقة' : 'My Trial Requests'}
              </Text>
              {myTrials.map((tr) => (
                <View key={tr._id} style={styles.trialRow}>
                  <Text style={[styles.trialTitle, { textAlign: align }]}>{tr.studentName}</Text>
                  <Text style={[styles.trialMeta, { textAlign: align }]}>
                    {tr.status} {tr.createdAt ? `• ${new Date(tr.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Teacher Profile Modal */}
      <Modal
        visible={Boolean(selectedTeacher)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTeacher(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>
                {selectedTeacher?.personalInfo?.fullName || selectedTeacher?.user?.name || ''}
              </Text>
              <Pressable onPress={() => setSelectedTeacher(null)} hitSlop={10}>
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {selectedTeacher?.personalInfo?.country ? (
              <View style={[styles.metaPill, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Globe size={13} color={colors.emerald} />
                <Text style={styles.metaPillText}>{selectedTeacher.personalInfo.country}</Text>
              </View>
            ) : null}

            <Text style={[styles.bioText, { textAlign: align }]}>
              {selectedTeacher?.quranInfo?.bio
                || selectedTeacher?.user?.bio
                || (locale === 'ar'
                  ? 'معلم معتمد في أكاديمية وحي ونماء لتحفيظ القرآن الكريم وتصحيح التلاوة.'
                  : 'Verified teacher at Wahy Wa Namaa Academy for Quran memorization and Tajweed.')}
            </Text>

            {selectedTeacher ? (
              <PrimaryButton
                label={locale === 'ar' ? 'احجز حصة تجريبية مع هذا المعلم' : 'Book Free Trial with Teacher'}
                onPress={() => handleBookWithTeacher(selectedTeacher)}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1, backgroundColor: colors.ivory },
  topSwitchWrap: {
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  switchBar: {
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
    ...shadows.card,
  },
  switchBtn: {
    flex: 1,
    minHeight: TOUCH_MIN - 6,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnActive: { backgroundColor: colors.emerald },
  switchText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  switchTextActive: { color: colors.textInverse },
  searchSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  searchBox: {
    minHeight: TOUCH_MIN,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary },
  chipRow: { gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  teacherCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.9 },
  teacherHead: { gap: spacing.md, alignItems: 'center' },
  teacherAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.goldBright, fontSize: 22, fontFamily: fonts.extraBold },
  teacherInfo: { flex: 1, gap: 4 },
  nameRow: { alignItems: 'center', gap: 6 },
  teacherName: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  teacherSpec: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  badgesRow: { gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  ratingText: { fontSize: 12, fontFamily: fonts.bold, color: colors.goldDark },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  metaPillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.emeraldDark },
  formScroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  formTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  field: { gap: 6 },
  twoCol: { gap: spacing.md },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 84, textAlignVertical: 'top', paddingTop: spacing.md },
  trackStack: { gap: spacing.sm },
  trackOption: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
  },
  trackOptionActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldSoft },
  trackText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },
  trackTextActive: { color: colors.emeraldDark, fontFamily: fonts.bold },
  trialRow: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 2,
  },
  trialTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  trialMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  bioText: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 22 },
});
