import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { Audio, ResizeMode, Video } from 'expo-av';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Globe,
  PlayCircle,
  Search,
  Star,
  UserCheck,
  Video as VideoIcon,
  X,
} from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { resolveTeacherPhotoUrl, resolveTeacherVideos } from '../src/lib/teacherMedia';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { TeacherAvatar } from '../src/components/TeacherAvatar';
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
  const params = useLocalSearchParams<{ tab?: string; teacherId?: string }>();
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

  // Teacher Profile & Video Player state
  const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacher | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const videoRef = useRef<Video | null>(null);
  const deepLinkedRef = useRef(false);

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

  const openTeacherProfile = useCallback(async (teacher: PublicTeacher) => {
    setSelectedTeacher(teacher);
    setActiveVideoIndex(0);
    setVideoError(false);
    setVideoBuffering(false);
    setPhotoPreviewOpen(false);
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});

    // Fetch full profile so teachingMethodVideo, additionalVideos, and academicInfo load live
    setLoadingProfile(true);
    try {
      const full = await api.get<PublicTeacher>(`/api/teachers/${encodeURIComponent(teacher._id)}`);
      if (full && full._id) {
        setSelectedTeacher((prev) => (prev?._id === full._id ? { ...prev, ...full } : prev));
      }
    } catch {
      // Keep the list preview payload if detail fetch fails transiently
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const closeTeacherProfile = useCallback(() => {
    void videoRef.current?.stopAsync().catch(() => {});
    setPhotoPreviewOpen(false);
    setSelectedTeacher(null);
  }, []);

  const loadData = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const qs = new URLSearchParams({ limit: '30' });
      if (search.trim()) qs.set('search', search.trim());
      if (genderFilter) qs.set('gender', genderFilter);

      const [teachersRes, trialsRes] = await Promise.allSettled([
        api.get<{ teachers?: PublicTeacher[] }>(`/api/teachers?${qs.toString()}`),
        api.get<{ trials?: TrialRequestItem[] } | TrialRequestItem[]>('/api/trials/my', { auth: true }),
      ]);

      if (teachersRes.status === 'fulfilled') {
        const list = teachersRes.value.teachers ?? [];
        setTeachers(list);
        if (params.teacherId && !deepLinkedRef.current) {
          deepLinkedRef.current = true;
          const found = list.find((item) => item._id === params.teacherId);
          if (found) {
            void openTeacherProfile(found);
          } else {
            // Fetch directly if not in initial page
            void api
              .get<PublicTeacher>(`/api/teachers/${encodeURIComponent(params.teacherId)}`)
              .then((tDoc) => {
                if (tDoc?._id) void openTeacherProfile(tDoc);
              })
              .catch(() => {});
          }
        }
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
  }, [genderFilter, openTeacherProfile, params.teacherId, search, t.home.loadError]);

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
    closeTeacherProfile();
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

  const selectedPhotoUrl = useMemo(() => resolveTeacherPhotoUrl(selectedTeacher), [selectedTeacher]);
  const selectedVideos = useMemo(() => resolveTeacherVideos(selectedTeacher), [selectedTeacher]);
  const activeVideo = selectedVideos[activeVideoIndex] || selectedVideos[0] || null;

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'نخبة المعلمين والحجز' : 'Teachers & Free Trial'}
        subtitle={
          locale === 'ar'
            ? 'شاهد تلاوة وفيديوهات معلمي الأكاديمية المجازين واحجز حصتك التجريبية.'
            : 'Watch teacher recitation videos and book your free trial directly in-app.'
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
              const photoUrl = resolveTeacherPhotoUrl(item);
              const videos = resolveTeacherVideos(item);

              return (
                <Pressable
                  onPress={() => void openTeacherProfile(item)}
                  style={({ pressed }) => [styles.teacherCard, pressed && styles.pressed]}
                >
                  <View style={[styles.teacherHead, { flexDirection: rowDir }]}>
                    <TeacherAvatar uri={photoUrl} name={name} size={62} />
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
                        {videos.length > 0 ? (
                          <View style={styles.videoPill}>
                            <PlayCircle size={12} color={colors.white} />
                            <Text style={styles.videoPillText}>
                              {locale === 'ar' ? 'تلاوة وفيديو' : 'Video'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={[styles.cardBtnRow, { flexDirection: rowDir }]}>
                    <Pressable
                      onPress={() => void openTeacherProfile(item)}
                      style={styles.watchBtn}
                    >
                      <VideoIcon size={15} color={colors.emeraldDark} />
                      <Text style={styles.watchBtnText}>
                        {locale === 'ar' ? 'عرض الملف والفيديو' : 'Profile & Videos'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleBookWithTeacher(item)}
                      style={styles.bookBtn}
                    >
                      <Text style={styles.bookBtnText}>
                        {locale === 'ar' ? 'حجز تجريبية' : 'Book Trial'}
                      </Text>
                    </Pressable>
                  </View>
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

      {/* Rich Teacher Profile + Native Video Player Modal */}
      <Modal
        visible={Boolean(selectedTeacher)}
        animationType="slide"
        transparent
        onRequestClose={closeTeacherProfile}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <View style={[styles.modalProfileHead, { flexDirection: rowDir }]}>
                <Pressable
                  onPress={() => {
                    if (selectedPhotoUrl) setPhotoPreviewOpen(true);
                  }}
                >
                  <TeacherAvatar
                    uri={selectedPhotoUrl}
                    name={selectedTeacher?.personalInfo?.fullName || selectedTeacher?.user?.name || ''}
                    size={64}
                  />
                </Pressable>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={[styles.nameRow, { flexDirection: rowDir }]}>
                    <Text style={[styles.modalTitle, { textAlign: align }]} numberOfLines={2}>
                      {selectedTeacher?.personalInfo?.fullName || selectedTeacher?.user?.name || ''}
                    </Text>
                    {selectedTeacher?.isVerified ? <UserCheck size={16} color={colors.emerald} /> : null}
                  </View>
                  <Text style={[styles.teacherSpec, { textAlign: align }]} numberOfLines={1}>
                    {selectedTeacher?.academicInfo?.specialization
                      || selectedTeacher?.academicInfo?.qualification
                      || (locale === 'ar' ? 'معلم قرآن كريم وتجويد' : 'Quran & Tajweed Teacher')}
                  </Text>
                  {selectedPhotoUrl ? (
                    <Text style={[styles.tapHint, { textAlign: align }]}>
                      {locale === 'ar' ? 'اضغط على الصورة لتكبيرها' : 'Tap photo to zoom'}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={closeTeacherProfile} style={styles.modalCloseBtn} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
            >
              {/* Meta Badges Row */}
              <View style={[styles.badgesRow, { flexDirection: rowDir }]}>
                <View style={styles.ratingPill}>
                  <Star size={13} color={colors.goldDark} fill={colors.gold} />
                  <Text style={styles.ratingText}>
                    {Number(selectedTeacher?.rating?.average || 5).toFixed(1)}
                  </Text>
                </View>
                {selectedTeacher?.personalInfo?.country ? (
                  <View style={styles.metaPill}>
                    <Globe size={12} color={colors.emerald} />
                    <Text style={styles.metaPillText}>{selectedTeacher.personalInfo.country}</Text>
                  </View>
                ) : null}
                {selectedTeacher?.quranInfo?.teachingExperience ? (
                  <View style={styles.metaPill}>
                    <Clock size={12} color={colors.emerald} />
                    <Text style={styles.metaPillText}>
                      {selectedTeacher.quranInfo.teachingExperience} {locale === 'ar' ? 'سنوات خبرة' : 'yrs exp'}
                    </Text>
                  </View>
                ) : null}
                {selectedTeacher?.quranInfo?.ijazah ? (
                  <View style={styles.metaPill}>
                    <Award size={12} color={colors.emerald} />
                    <Text style={styles.metaPillText}>
                      {locale === 'ar' ? 'مجاز بالسند' : 'Certified Ijazah'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Videos Showcase Section */}
              <View style={styles.videoSection}>
                <View style={[styles.videoSectionHeader, { flexDirection: rowDir }]}>
                  <PlayCircle size={17} color={colors.emerald} />
                  <Text style={styles.videoSectionTitle}>
                    {locale === 'ar' ? 'فيديوهات المعلم والتلاوة' : 'Teacher Videos & Recitation'}
                  </Text>
                  {loadingProfile ? <ActivityIndicator size="small" color={colors.emerald} /> : null}
                </View>

                {selectedVideos.length > 0 && activeVideo ? (
                  <>
                    {selectedVideos.length > 1 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.videoTabsRow}
                      >
                        {selectedVideos.map((vid, idx) => {
                          const isSelected = idx === activeVideoIndex;
                          return (
                            <Pressable
                              key={vid.id}
                              onPress={() => {
                                setActiveVideoIndex(idx);
                                setVideoError(false);
                                setVideoBuffering(true);
                              }}
                              style={[styles.videoTab, isSelected && styles.videoTabActive]}
                            >
                              <PlayCircle
                                size={13}
                                color={isSelected ? colors.white : colors.emeraldDark}
                              />
                              <Text style={[styles.videoTabText, isSelected && styles.videoTabTextActive]}>
                                {locale === 'ar' ? vid.labelAr : vid.labelEn}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}

                    <View style={styles.videoFrame}>
                      {videoError ? (
                        <View style={styles.videoErrorBox}>
                          <Text style={styles.videoErrorText}>
                            {locale === 'ar' ? 'تعذر تشغيل هذا الفيديو حالياً.' : 'Unable to play this video right now.'}
                          </Text>
                          <Pressable
                            onPress={() => {
                              setVideoError(false);
                              setVideoBuffering(true);
                            }}
                            style={styles.videoRetryBtn}
                          >
                            <Text style={styles.videoRetryText}>
                              {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Video
                            key={activeVideo.url}
                            ref={videoRef}
                            source={{ uri: activeVideo.url }}
                            style={styles.videoPlayer}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={false}
                            onLoadStart={() => {
                              setVideoBuffering(true);
                              setVideoError(false);
                            }}
                            onReadyForDisplay={() => setVideoBuffering(false)}
                            onLoad={() => setVideoBuffering(false)}
                            onError={() => {
                              setVideoBuffering(false);
                              setVideoError(true);
                            }}
                          />
                          {videoBuffering ? (
                            <View style={styles.videoLoadingOverlay} pointerEvents="none">
                              <ActivityIndicator size="large" color={colors.goldBright} />
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.noVideoBox}>
                    <Text style={[styles.noVideoText, { textAlign: align }]}>
                      {loadingProfile
                        ? (locale === 'ar' ? 'جارٍ تحميل فيديوهات المعلم...' : 'Loading teacher videos...')
                        : (locale === 'ar' ? 'لم يضف هذا المعلم فيديوهات عامة بعد.' : 'No public videos uploaded yet.')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Academic / Languages / Bio */}
              {selectedTeacher?.academicInfo?.university || selectedTeacher?.academicInfo?.degree ? (
                <View style={styles.infoBox}>
                  <View style={[styles.nameRow, { flexDirection: rowDir }]}>
                    <BookOpen size={15} color={colors.goldDark} />
                    <Text style={styles.infoBoxTitle}>
                      {locale === 'ar' ? 'المؤهل العلمي' : 'Academic Background'}
                    </Text>
                  </View>
                  <Text style={[styles.bioText, { textAlign: align }]}>
                    {[selectedTeacher.academicInfo?.degree, selectedTeacher.academicInfo?.university]
                      .filter(Boolean)
                      .join(' — ')}
                  </Text>
                </View>
              ) : null}

              {selectedTeacher?.languages?.length ? (
                <View style={[styles.badgesRow, { flexDirection: rowDir }]}>
                  {selectedTeacher.languages.map((lang) => (
                    <View key={lang} style={styles.langPill}>
                      <Text style={styles.langPillText}>{lang}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.bioText, { textAlign: align }]}>
                {selectedTeacher?.quranInfo?.bio
                  || selectedTeacher?.user?.bio
                  || (locale === 'ar'
                    ? 'معلم معتمد في أكاديمية وحي ونماء لتحفيظ القرآن الكريم وتصحيح التلاوة.'
                    : 'Verified teacher at Wahy Wa Namaa Academy for Quran memorization and Tajweed.')}
              </Text>
            </ScrollView>

            {selectedTeacher ? (
              <PrimaryButton
                label={locale === 'ar' ? 'احجز حصة تجريبية مع هذا المعلم' : 'Book Free Trial with Teacher'}
                variant="gold"
                onPress={() => handleBookWithTeacher(selectedTeacher)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Full-size Photo Lightbox */}
      <Modal
        visible={photoPreviewOpen && Boolean(selectedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewOpen(false)}
      >
        <Pressable style={styles.lightboxBackdrop} onPress={() => setPhotoPreviewOpen(false)}>
          <Pressable style={styles.lightboxClose} onPress={() => setPhotoPreviewOpen(false)}>
            <X size={24} color={colors.white} />
          </Pressable>
          {selectedPhotoUrl ? (
            <Image source={{ uri: selectedPhotoUrl }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
        </Pressable>
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
  pressed: { opacity: 0.92 },
  teacherHead: { gap: spacing.md, alignItems: 'center' },
  teacherInfo: { flex: 1, gap: 4 },
  nameRow: { alignItems: 'center', gap: 6 },
  teacherName: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary },
  teacherSpec: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  tapHint: { fontSize: 11, fontFamily: fonts.medium, color: colors.emerald },
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
  videoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emerald,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  videoPillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.white },
  cardBtnRow: { gap: spacing.sm },
  watchBtn: {
    flex: 1.25,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.emerald,
    paddingHorizontal: spacing.sm,
  },
  watchBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  bookBtn: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.emerald,
    paddingHorizontal: spacing.sm,
  },
  bookBtnText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.white },
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
    backgroundColor: 'rgba(5, 39, 29, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalProfileHead: { flex: 1, alignItems: 'center', gap: spacing.md },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  modalScrollBody: { gap: spacing.md, paddingBottom: spacing.sm },
  videoSection: { gap: spacing.sm },
  videoSectionHeader: { alignItems: 'center', gap: spacing.xs },
  videoSectionTitle: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  videoTabsRow: { gap: spacing.xs, paddingVertical: 2 },
  videoTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  videoTabActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emeraldDeep,
  },
  videoTabText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  videoTabTextActive: { color: colors.white },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#051E17',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 30, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoErrorBox: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  videoErrorText: { fontSize: 13, fontFamily: fonts.medium, color: colors.mint, textAlign: 'center' },
  videoRetryBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  videoRetryText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  noVideoBox: {
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  noVideoText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  infoBox: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: 4,
  },
  infoBoxTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  langPill: {
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  langPillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  bioText: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 22 },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lightboxClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lightboxImage: { width: '100%', height: '75%' },
});
