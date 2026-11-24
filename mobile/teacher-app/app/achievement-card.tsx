import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Award, Send, Share2, Sparkles } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { ActiveStudent } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SurahPickerModal } from '../src/components/SurahPickerModal';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

const AWARD_BADGES = [
  { id: 'hifz-star', ar: 'نجم الحفظ المتقن ⭐', en: 'Hifz Star ⭐' },
  { id: 'tajweed-master', ar: 'متميز في التجويد 🎙️', en: 'Tajweed Excellence 🎙️' },
  { id: 'surah-complete', ar: 'إتمام سورة كاملة 📖', en: 'Surah Completed 📖' },
  { id: 'juz-complete', ar: 'إنجاز جزء من القرآن 🏆', en: 'Juz Completed 🏆' },
  { id: 'commitment', ar: 'بطل الالتزام والهمة 🔥', en: 'Consistency Champion 🔥' },
] as const;

export default function AchievementCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string; surah?: string }>();
  const { user } = useAuth();
  const { isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(String(params.studentId || ''));
  const [studentName, setStudentName] = useState(String(params.studentName || ''));
  const [surah, setSurah] = useState(String(params.surah || 'سورة الملك'));
  const [badgeId, setBadgeId] = useState<(typeof AWARD_BADGES)[number]['id']>('hifz-star');
  const [note, setNote] = useState('ما شاء الله أداء رائع وحفظ متقن، نفع الله بك وجعلك من أهل القرآن.');
  const [surahModalOpen, setSurahModalOpen] = useState(false);
  const [sendingToApp, setSendingToApp] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true });
        const list = res.students || [];
        setStudents(list);
        if (!studentName && list[0]) {
          setSelectedStudentId(list[0]._id);
          setStudentName(list[0].name);
        }
      } catch {
        // Optional preload
      }
    })();
  }, [studentName]);

  const activeBadge = AWARD_BADGES.find((b) => b.id === badgeId) || AWARD_BADGES[0];

  const buildShareText = () => {
    const teacherName = user?.name || 'معلم الأكاديمية';
    return [
      '✨ بطاقة إنجاز وتكريم — أكاديمية وحي ونماء للقرآن الكريم ✨',
      '',
      `🏅 الوسام: ${isRTL ? activeBadge.ar : activeBadge.en}`,
      `🌟 الطالب/ة: ${studentName || 'طالب وحي ونماء'}`,
      `📖 الإنجاز: ${surah}`,
      `💬 شهادة المعلم (${teacherName}):`,
      `"${note.trim()}"`,
      '',
      '🌿 وحي ونماء — تعلّم • احفظ • انمُ',
      'https://wahywanamaa.com',
    ].join('\n');
  };

  const handleShareWhatsApp = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await Share.share({ message: buildShareText() }).catch(() => {});
  };

  const handleSendToStudentPortal = async () => {
    if (!selectedStudentId || sendingToApp) {
      Alert.alert(t.common.errorTitle, isRTL ? 'اختر طالباً من القائمة أولاً.' : 'Select a student first.');
      return;
    }
    setSendingToApp(true);
    try {
      await api.post(
        '/api/teacher-updates/teacher',
        {
          title: `🏅 ${isRTL ? activeBadge.ar : activeBadge.en} — ${surah}`,
          message: buildShareText(),
          audienceMode: 'selected',
          studentIds: [selectedStudentId],
        },
        { auth: true }
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        isRTL ? 'تم الإرسال!' : 'Sent!',
        isRTL ? 'وصلت بطاقة التكريم مباشرة إلى لوحة الطالب وإشعاراته.' : 'Achievement card delivered to student dashboard.'
      );
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSendingToApp(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={isRTL ? 'بطاقة إنجاز الطالب للواتساب' : 'Student Achievement Card'}
        subtitle={isRTL ? 'كرّم طلابك وشارك إنجازهم مع ولي الأمر في ثانية' : 'Celebrate students and delight parents in one tap'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Live Luxury Certificate Card Preview */}
        <View style={styles.certCard}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 250">
              <Defs>
                <LinearGradient id="certGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#05271D" />
                  <Stop offset="55%" stopColor="#0A4A37" />
                  <Stop offset="100%" stopColor="#0F6B4F" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="360" height="250" fill="url(#certGrad)" />
              <Rect x="10" y="10" width="340" height="230" rx="16" stroke={colors.gold} strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
              <Circle cx="320" cy="40" r="50" stroke={colors.gold} strokeOpacity="0.16" strokeWidth="1" fill="none" />
              <Path d="M40 190 L48 210 L68 218 L48 226 L40 246 L32 226 L12 218 L32 210 Z" stroke={colors.gold} strokeOpacity="0.22" fill="none" />
            </Svg>
          </View>

          <View style={styles.certBadge}>
            <Award size={15} color={colors.emeraldDeep} />
            <Text style={styles.certBadgeText}>{isRTL ? activeBadge.ar : activeBadge.en}</Text>
          </View>

          <Text style={styles.certAcademy}>أكاديمية وحي ونماء للقرآن الكريم</Text>
          <Text style={styles.certStudent}>{studentName || (isRTL ? 'اسم الطالب' : 'Student Name')}</Text>
          <Text style={styles.certSurah}>📖 {surah}</Text>
          <Text style={styles.certNote} numberOfLines={3}>{note}</Text>
          <Text style={styles.certFooter}>الشيخ / المعلمة: {user?.name || ''}</Text>
        </View>

        {/* Controls */}
        <View style={[styles.formCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {students.length > 0 ? (
            <>
              <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                {isRTL ? 'اختر الطالب' : 'Select Student'}
              </Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {students.map((st) => {
                  const active = selectedStudentId === st._id;
                  return (
                    <Pressable
                      key={st._id}
                      onPress={() => {
                        setSelectedStudentId(st._id);
                        setStudentName(st.name);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
            {isRTL ? 'وسام التكريم' : 'Award Badge'}
          </Text>
          <View style={[styles.chipRow, { flexDirection: rowDir }]}>
            {AWARD_BADGES.map((b) => {
              const active = badgeId === b.id;
              return (
                <Pressable key={b.id} onPress={() => setBadgeId(b.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{isRTL ? b.ar : b.en}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
            <Text style={[styles.label, { color: palette.text }]}>{isRTL ? 'السورة / الإنجاز' : 'Surah / Milestone'}</Text>
            <Pressable onPress={() => setSurahModalOpen(true)} style={styles.pickBtn}>
              <Text style={styles.pickBtnText}>{isRTL ? 'اختر سورة 📖' : 'Pick Surah 📖'}</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
            value={surah}
            onChangeText={setSurah}
          />

          <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
            {isRTL ? 'كلمة تشجيعية منك' : 'Encouraging Note'}
          </Text>
          <TextInput
            style={[styles.textArea, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
            value={note}
            onChangeText={setNote}
            multiline
          />

          <PrimaryButton
            label={isRTL ? 'مشاركة فورية على واتساب لولي الأمر' : 'Share to WhatsApp / Parent'}
            variant="gold"
            onPress={() => void handleShareWhatsApp()}
            icon={<Share2 size={17} color={colors.emeraldDeep} />}
          />

          <PrimaryButton
            label={isRTL ? 'إرسال التكريم داخل تطبيق الطالب' : 'Deliver Inside Student App'}
            loading={sendingToApp}
            onPress={() => void handleSendToStudentPortal()}
            icon={<Send size={16} color={colors.textInverse} />}
          />

          <View style={[styles.tipBox, { flexDirection: rowDir }]}>
            <Sparkles size={16} color={colors.goldDark} />
            <Text style={[styles.tipText, { textAlign: align }]}>
              {isRTL
                ? 'مشاركة بطاقة الإنجاز مع ولي الأمر أسبوعياً ترفع التزام الطالب وحماس العائلة بشكل مذهل.'
                : 'Sharing weekly achievement cards delights parents and boosts student consistency.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <SurahPickerModal
        visible={surahModalOpen}
        isRTL={isRTL}
        onClose={() => setSurahModalOpen(false)}
        onSelect={(s) => setSurah(`إتمام سورة ${s.nameAr}`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  certCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.elevated,
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.goldBright,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  certBadgeText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  certAcademy: { fontSize: 12, fontFamily: fonts.bold, color: colors.mint, marginTop: 4 },
  certStudent: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.white, textAlign: 'center' },
  certSurah: { fontSize: 15, fontFamily: fonts.bold, color: colors.goldBright, textAlign: 'center' },
  certNote: { fontSize: 13, fontFamily: fonts.medium, color: colors.textInverse, textAlign: 'center', lineHeight: 22 },
  certFooter: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.mint, marginTop: 4 },
  formCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  label: { fontSize: 13, fontFamily: fonts.bold, marginTop: 4 },
  pickBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.emeraldSoft },
  pickBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
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
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  textArea: {
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 13,
    fontFamily: fonts.medium,
    textAlignVertical: 'top',
  },
  tipBox: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: fonts.semiBold, color: colors.goldDark, lineHeight: 19 },
});
