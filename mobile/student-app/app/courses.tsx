import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { CourseEnrollment, CourseItem, CourseLesson, LocalizedText } from '../src/types/academy';

type TabMode = 'mine' | 'explore';

function pickText(v: string | LocalizedText | undefined, locale: 'ar' | 'en'): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[locale] || v.ar || v.en || '';
}

export default function CoursesScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();

  const [tab, setTab] = useState<TabMode>('mine');
  const [myCourses, setMyCourses] = useState<CourseEnrollment[]>([]);
  const [catalog, setCatalog] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Course lessons drill-down state
  const [activeCourse, setActiveCourse] = useState<CourseItem | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);

  const loadCourses = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const [mineRes, allRes] = await Promise.allSettled([
        api.get<CourseEnrollment[]>('/api/courses/my-courses', { auth: true }),
        api.get<{ courses?: CourseItem[] }>('/api/courses?limit=24'),
      ]);
      if (mineRes.status === 'fulfilled') {
        setMyCourses(Array.isArray(mineRes.value) ? mineRes.value : []);
      }
      if (allRes.status === 'fulfilled') {
        setCatalog(allRes.value.courses ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses(false);
  }, [loadCourses]);

  const openCourseLessons = async (course: CourseItem) => {
    setActiveCourse(course);
    setLessons([]);
    setLoadingLessons(true);
    try {
      const res = await api.get<{ lessons?: CourseLesson[] } | CourseLesson[]>(
        `/api/courses/${encodeURIComponent(course._id)}/lessons`,
        { auth: true }
      );
      setLessons(Array.isArray(res) ? res : res.lessons ?? []);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setLoadingLessons(false);
    }
  };

  const enrollInCourse = async (courseId: string) => {
    setEnrollingId(courseId);
    try {
      await api.post(`/api/courses/${encodeURIComponent(courseId)}/enroll`, {}, { auth: true });
      Alert.alert(
        t.common.success,
        locale === 'ar' ? 'تم تسجيلك في الدورة بنجاح!' : 'Enrolled in course successfully!'
      );
      setTab('mine');
      void loadCourses(true);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setEnrollingId(null);
    }
  };

  const completeLesson = async (lessonId: string) => {
    if (!activeCourse) return;
    setCompletingLessonId(lessonId);
    try {
      await api.post(
        `/api/courses/${encodeURIComponent(activeCourse._id)}/lessons/${encodeURIComponent(lessonId)}/complete`,
        {},
        { auth: true }
      );
      setLessons((prev) => prev.map((l) => (l._id === lessonId ? { ...l, completed: true } : l)));
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setCompletingLessonId(null);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  if (activeCourse) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <IslamicHero
          title={pickText(activeCourse.title, locale)}
          subtitle={locale === 'ar' ? 'دروس ومحتوى الدورة' : 'Course Lessons'}
          isRTL={isRTL}
          onBack={() => setActiveCourse(null)}
          compact
        />
        <ScrollView style={styles.flex} contentContainerStyle={styles.listContent}>
          {loadingLessons ? (
            <SkeletonCard lines={3} />
          ) : lessons.length === 0 ? (
            <StateView
              mode="empty"
              title={locale === 'ar' ? 'لا توجد دروس منشورة بعد' : 'No published lessons yet'}
            />
          ) : (
            lessons.map((lesson, index) => (
              <View key={lesson._id} style={styles.card}>
                <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                  <View style={styles.lessonNum}>
                    <Text style={styles.lessonNumText}>{lesson.order || index + 1}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { textAlign: align, flex: 1 }]}>
                    {pickText(lesson.title, locale)}
                  </Text>
                  {lesson.completed ? <CheckCircle2 size={20} color={colors.emerald} /> : null}
                </View>
                {pickText(lesson.description, locale) ? (
                  <Text style={[styles.desc, { textAlign: align }]}>{pickText(lesson.description, locale)}</Text>
                ) : null}
                {lesson.content?.text || lesson.content?.summary ? (
                  <Text style={[styles.lessonBody, { textAlign: align }]}>
                    {lesson.content.text || lesson.content.summary}
                  </Text>
                ) : null}
                {!lesson.completed ? (
                  <PrimaryButton
                    label={locale === 'ar' ? 'تحديد الدرس كمكتمل' : 'Mark Lesson Complete'}
                    variant="secondary"
                    loading={completingLessonId === lesson._id}
                    onPress={() => void completeLesson(lesson._id)}
                  />
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const enrolledIds = new Set(myCourses.map((e) => e.course?._id).filter(Boolean));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'الدورات والمحتوى التعليمي' : 'Courses & Lessons'}
        subtitle={locale === 'ar' ? 'تعلّم التجويد والعلوم الشرعية من داخل التطبيق.' : 'Study Tajweed and Islamic courses directly in-app.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <View style={styles.switchWrap}>
        <View style={[styles.switchBar, { flexDirection: rowDir }]}>
          <Pressable
            onPress={() => setTab('mine')}
            style={[styles.switchBtn, tab === 'mine' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, tab === 'mine' && styles.switchTextActive]}>
              {locale === 'ar' ? 'دوراتي' : 'My Courses'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('explore')}
            style={[styles.switchBtn, tab === 'explore' && styles.switchBtnActive]}
          >
            <Text style={[styles.switchText, tab === 'explore' && styles.switchTextActive]}>
              {locale === 'ar' ? 'استكشف الدورات' : 'Explore'}
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === 'mine' ? (
        <FlatList
          data={loading ? [] : myCourses}
          keyExtractor={(item) => item._id}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCourses(true)} tintColor={colors.emerald} />}
          ListEmptyComponent={
            loading ? (
              <SkeletonCard lines={3} />
            ) : (
              <StateView
                mode="empty"
                title={locale === 'ar' ? 'لم تسجل في أي دورة بعد' : 'No enrolled courses yet'}
                description={locale === 'ar' ? 'استكشف دورات الأكاديمية وسجّل فيها مجاناً أو ضمن باقتك.' : 'Explore academy courses and enroll right away.'}
                actionLabel={locale === 'ar' ? 'استكشف الدورات' : 'Explore Courses'}
                onAction={() => setTab('explore')}
              />
            )
          }
          renderItem={({ item }) => {
            const c = item.course;
            if (!c) return null;
            return (
              <View style={styles.card}>
                <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                  <GraduationCap size={20} color={colors.emerald} />
                  <Text style={[styles.cardTitle, { textAlign: align, flex: 1 }]}>{pickText(c.title, locale)}</Text>
                </View>
                <PrimaryButton
                  label={locale === 'ar' ? 'فتح الدروس' : 'Open Lessons'}
                  icon={<PlayCircle size={17} color={colors.textInverse} />}
                  onPress={() => void openCourseLessons(c)}
                />
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={loading ? [] : catalog}
          keyExtractor={(item) => item._id}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCourses(true)} tintColor={colors.emerald} />}
          ListEmptyComponent={
            loading ? (
              <SkeletonCard lines={3} />
            ) : (
              <StateView
                mode="empty"
                title={locale === 'ar' ? 'لا توجد دورات متاحة حالياً' : 'No courses available right now'}
              />
            )
          }
          renderItem={({ item }) => {
            const isEnrolled = enrolledIds.has(item._id);
            return (
              <View style={styles.card}>
                <View style={[styles.cardHead, { flexDirection: rowDir }]}>
                  <BookOpen size={19} color={colors.goldDark} />
                  <Text style={[styles.cardTitle, { textAlign: align, flex: 1 }]}>
                    {pickText(item.title, locale)}
                  </Text>
                </View>
                {pickText(item.description, locale) ? (
                  <Text style={[styles.desc, { textAlign: align }]} numberOfLines={3}>
                    {pickText(item.description, locale)}
                  </Text>
                ) : null}
                <PrimaryButton
                  label={
                    isEnrolled
                      ? locale === 'ar' ? 'فتح الدروس' : 'Open Lessons'
                      : locale === 'ar' ? 'التسجيل في الدورة' : 'Enroll Now'
                  }
                  variant={isEnrolled ? 'primary' : 'secondary'}
                  loading={enrollingId === item._id}
                  onPress={() => (isEnrolled ? void openCourseLessons(item) : void enrollInCourse(item._id))}
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1, backgroundColor: colors.ivory },
  switchWrap: { backgroundColor: colors.ivory, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHead: { alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  desc: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  lessonNum: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumText: { fontSize: 13, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  lessonBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.cream,
    padding: spacing.md,
    borderRadius: radius.md,
    lineHeight: 22,
  },
});
