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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  Send,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { ActiveStudent, TeacherCircle } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SurahPickerModal } from '../src/components/SurahPickerModal';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

type CopilotTab = 'homework' | 'exam' | 'report' | 'assistant';

function formatAiOutput(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.lessonPlan === 'string') return obj.lessonPlan;
    if (typeof obj.report === 'string') return obj.report;
    if (typeof obj.summary === 'string') return obj.summary;
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.homework)) {
      return obj.homework
        .map((item, idx) => {
          if (typeof item === 'string') return `${idx + 1}. ${item}`;
          if (item && typeof item === 'object') {
            const o = item as Record<string, unknown>;
            return `${idx + 1}. ${o.title || o.question || o.task || ''}${o.description ? ` — ${o.description}` : ''}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }
    if (Array.isArray(obj.questions)) {
      return obj.questions
        .map((q, idx) => {
          if (typeof q === 'string') return `${idx + 1}. ${q}`;
          if (q && typeof q === 'object') {
            const o = q as Record<string, unknown>;
            const opts = Array.isArray(o.options) ? `\n   ${o.options.join(' | ')}` : '';
            return `${idx + 1}. ${o.question || o.prompt || ''}${opts}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }
    if (Array.isArray(obj.suggestions)) {
      return obj.suggestions.map(String).join('\n');
    }
    return JSON.stringify(obj, null, 2);
  }
  return String(raw);
}

const QUICK_PROMPTS_AR = [
  'خطة تحفيظ ممتعة لطفل عمره 7 سنوات في جزء عمّ',
  'كيف أشرح أحكام الإدغام والإخفاء ببساطة لمبتدئ؟',
  'خطة مراجعة مكثفة لطالب ينسى سورة البقرة',
];

export default function TeacherAiCopilotScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [tab, setTab] = useState<CopilotTab>('homework');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [circles, setCircles] = useState<TeacherCircle[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [surahModalOpen, setSurahModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [outputText, setOutputText] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          api.get<{ students?: ActiveStudent[] }>('/api/teachers/dashboard/active-students', { auth: true }),
          api.get<{ circles?: TeacherCircle[] }>('/api/teachers/dashboard/circles', { auth: true }),
        ]);
        const list = sRes.students || [];
        setStudents(list);
        if (list[0]?._id) setSelectedStudentId(list[0]._id);
        setCircles(cRes.circles || []);
      } catch {
        // Non-blocking
      }
    })();
  }, []);

  const handleGenerate = async () => {
    if (loading) return;
    if (tab !== 'report' && !topic.trim()) {
      Alert.alert(t.common.errorTitle, isRTL ? 'اكتب الموضوع أو اختر سورة أولاً.' : 'Enter a topic or pick a Surah first.');
      return;
    }
    if (tab === 'report' && !selectedStudentId) {
      Alert.alert(t.common.errorTitle, isRTL ? 'اختر طالباً أولاً.' : 'Please select a student first.');
      return;
    }

    setLoading(true);
    setOutputText('');
    try {
      let res: unknown;
      if (tab === 'homework') {
        res = await api.post('/api/ai/homework-generate', { topic: topic.trim(), level, count: 4, locale }, { auth: true, timeoutMs: 40000 });
      } else if (tab === 'exam') {
        res = await api.post('/api/ai/exam-generate', { topic: topic.trim(), questionCount: 5, locale }, { auth: true, timeoutMs: 40000 });
      } else if (tab === 'report') {
        res = await api.post('/api/ai/reports-generate', { studentId: selectedStudentId, period, locale }, { auth: true, timeoutMs: 40000 });
      } else {
        res = await api.post('/api/ai/teacher-assistant', { prompt: topic.trim(), locale }, { auth: true, timeoutMs: 40000 });
      }
      const formatted = formatAiOutput(res);
      setOutputText(formatted || (isRTL ? 'تم التوليد بنجاح.' : 'Generated successfully.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGeneratedHomework = async () => {
    if (!outputText.trim() || assigning) return;
    if (!selectedStudentId && !selectedCircleId) {
      Alert.alert(t.common.errorTitle, isRTL ? 'اختر طالباً أو حلقة لإسناد الواجب.' : 'Pick a student or circle first.');
      return;
    }
    setAssigning(true);
    try {
      await api.post(
        '/api/teachers/dashboard/tasks',
        {
          ...(selectedCircleId ? { circleId: selectedCircleId } : { studentId: selectedStudentId }),
          type: tab === 'exam' ? 'test' : 'memorization',
          title: `${tab === 'exam' ? 'اختبار' : 'واجب'}: ${topic.trim().slice(0, 120) || 'قرآن كريم'}`,
          description: outputText.slice(0, 1400),
        },
        { auth: true }
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        isRTL ? 'تم الإسناد بنجاح' : 'Assigned',
        isRTL ? 'تم إرسال الواجب وإشعار الطالب وولي الأمر.' : 'Homework assigned and notifications sent.'
      );
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setAssigning(false);
    }
  };

  const handleShare = async () => {
    if (!outputText.trim()) return;
    await Share.share({
      message: `${outputText}\n\n— أكاديمية وحي ونماء للقرآن الكريم`,
    }).catch(() => {});
  };

  const tabs: Array<{ key: CopilotTab; label: string; icon: typeof Sparkles }> = [
    { key: 'homework', label: isRTL ? 'توليد واجب' : 'Homework', icon: BookOpenCheck },
    { key: 'exam', label: isRTL ? 'توليد اختبار' : 'Exam', icon: GraduationCap },
    { key: 'report', label: isRTL ? 'تقرير ولي أمر' : 'Parent Report', icon: FileText },
    { key: 'assistant', label: isRTL ? 'مساعد تربوي' : 'Assistant', icon: Sparkles },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={isRTL ? 'مساعد المعلم الذكي (AI)' : 'AI Teacher Copilot'}
        subtitle={isRTL ? 'ولّد واجبات واختبارات وتقارير لولي الأمر بضغطة زر' : 'Generate homework, exams & parent reports in one tap'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Mode Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabRow, { flexDirection: rowDir }]}>
          {tabs.map((item) => {
            const active = tab === item.key;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setTab(item.key);
                  setOutputText('');
                }}
                style={[
                  styles.tabPill,
                  { backgroundColor: active ? colors.emerald : palette.surface, borderColor: active ? colors.emerald : palette.border },
                ]}
              >
                <Icon size={15} color={active ? colors.white : palette.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.white : palette.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {tab === 'report' ? (
            <>
              <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                {isRTL ? 'اختر الطالب لتوليد تقرير ولي الأمر' : 'Select Student'}
              </Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {students.map((st) => {
                  const active = selectedStudentId === st._id;
                  return (
                    <Pressable
                      key={st._id}
                      onPress={() => setSelectedStudentId(st._id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                {isRTL ? 'الفترة الزمنية' : 'Period'}
              </Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {(['weekly', 'monthly'] as const).map((p) => (
                  <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.chip, period === p && styles.chipActive]}>
                    <Text style={[styles.chipText, period === p && styles.chipTextActive]}>
                      {p === 'weekly' ? (isRTL ? 'أسبوعي' : 'Weekly') : (isRTL ? 'شهري' : 'Monthly')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.rowBetween, { flexDirection: rowDir }]}>
                <Text style={[styles.label, { color: palette.text }]}>
                  {tab === 'assistant'
                    ? (isRTL ? 'سؤالك للمساعد التربوي' : 'Ask your teaching assistant')
                    : (isRTL ? 'السورة أو موضوع التجويد' : 'Surah or Tajweed Topic')}
                </Text>
                {tab !== 'assistant' ? (
                  <Pressable onPress={() => setSurahModalOpen(true)} style={styles.pickSurahBtn}>
                    <Text style={styles.pickSurahText}>{isRTL ? 'اختر سورة 📖' : 'Pick Surah 📖'}</Text>
                  </Pressable>
                ) : null}
              </View>

              <TextInput
                style={[styles.textArea, { textAlign: align, backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                value={topic}
                onChangeText={setTopic}
                multiline
                placeholder={
                  tab === 'assistant'
                    ? (isRTL ? 'مثال: خطة مراجعة لطفل عمره 8 سنوات...' : 'e.g. Fun revision plan for an 8-year-old...')
                    : (isRTL ? 'مثال: سورة الملك الآيات 1-15 مع أحكام الإدغام' : 'e.g. Surah Al-Mulk 1-15 with Idgham')
                }
                placeholderTextColor={palette.textTertiary}
              />

              {tab === 'assistant' ? (
                <View style={styles.quickPrompts}>
                  {QUICK_PROMPTS_AR.map((q) => (
                    <Pressable key={q} onPress={() => setTopic(q)} style={styles.quickPromptChip}>
                      <Text style={[styles.quickPromptText, { textAlign: align }]}>✨ {q}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {tab === 'homework' ? (
                <>
                  <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                    {isRTL ? 'مستوى الطالب' : 'Student Level'}
                  </Text>
                  <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                    {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                      <Pressable key={lvl} onPress={() => setLevel(lvl)} style={[styles.chip, level === lvl && styles.chipActive]}>
                        <Text style={[styles.chipText, level === lvl && styles.chipTextActive]}>
                          {lvl === 'beginner' ? (isRTL ? 'مبتدئ' : 'Beginner') : lvl === 'intermediate' ? (isRTL ? 'متوسط' : 'Intermediate') : (isRTL ? 'متقدم' : 'Advanced')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}

          <PrimaryButton
            label={isRTL ? 'توليد بالذكاء الاصطناعي' : 'Generate with AI'}
            onPress={() => void handleGenerate()}
            loading={loading}
            icon={<Sparkles size={17} color={colors.textInverse} />}
          />
        </View>

        {outputText ? (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.resultTitle, { textAlign: align, color: palette.emerald }]}>
              {isRTL ? 'النتيجة الجاهزة:' : 'Generated Result:'}
            </Text>
            <Text style={[styles.resultBody, { textAlign: align, color: palette.text }]}>{outputText}</Text>

            {(tab === 'homework' || tab === 'exam') && (students.length > 0 || circles.length > 0) ? (
              <View style={styles.assignBox}>
                <Text style={[styles.label, { textAlign: align, color: palette.text }]}>
                  {isRTL ? 'إسناد فوري لطالب أو حلقة:' : 'Assign immediately:'}
                </Text>
                <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                  {students.slice(0, 6).map((st) => {
                    const active = selectedStudentId === st._id && !selectedCircleId;
                    return (
                      <Pressable
                        key={st._id}
                        onPress={() => {
                          setSelectedStudentId(st._id);
                          setSelectedCircleId('');
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{st.name}</Text>
                      </Pressable>
                    );
                  })}
                  {circles.slice(0, 4).map((c) => {
                    const active = selectedCircleId === c._id;
                    return (
                      <Pressable
                        key={c._id}
                        onPress={() => {
                          setSelectedCircleId(c._id);
                          setSelectedStudentId('');
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>👥 {c.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <PrimaryButton
                  label={isRTL ? 'إسناد الواجب الآن' : 'Assign Now'}
                  variant="gold"
                  loading={assigning}
                  onPress={() => void handleAssignGeneratedHomework()}
                  icon={<Send size={16} color={colors.emeraldDeep} />}
                />
              </View>
            ) : null}

            <PrimaryButton
              label={isRTL ? 'مشاركة لولي الأمر / واتساب' : 'Share to WhatsApp / Parent'}
              variant="secondary"
              onPress={() => void handleShare()}
              icon={<Share2 size={16} color={colors.emeraldDark} />}
            />
          </View>
        ) : null}
      </ScrollView>

      <SurahPickerModal
        visible={surahModalOpen}
        isRTL={isRTL}
        onClose={() => setSurahModalOpen(false)}
        onSelect={(s) => setTopic(`سورة ${s.nameAr} (من آية 1 إلى ${Math.min(10, s.ayahs)})`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  tabRow: { gap: spacing.xs, paddingBottom: 4 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: fonts.bold },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontFamily: fonts.bold },
  pickSurahBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
  },
  pickSurahText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  textArea: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlignVertical: 'top',
  },
  quickPrompts: { gap: spacing.xs },
  quickPromptChip: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.sand,
  },
  quickPromptText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.goldDark },
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
  resultTitle: { fontSize: 15, fontFamily: fonts.extraBold },
  resultBody: { fontSize: 14, fontFamily: fonts.medium, lineHeight: 24 },
  assignBox: { gap: spacing.sm, paddingTop: spacing.xs },
});
