import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CheckCircle2, ShieldCheck, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nProvider';
import { api } from '../lib/api';
import { PrimaryButton } from './PrimaryButton';
import { colors, fonts, radius, spacing, TOUCH_MIN } from '../theme/tokens';

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

const TRACKS = [
  { key: 'memorization', ar: 'حفظ ومراجعة القرآن', en: 'Memorization & Revision' },
  { key: 'tajweed_ijazah', ar: 'التجويد والإجازة', en: 'Tajweed & Ijazah' },
  { key: 'kids_foundation', ar: 'تأسيس وقراءة صحيحة', en: 'Foundation & Reading' },
] as const;

const RELATIONSHIPS = [
  { key: 'father', ar: 'الأب', en: 'Father' },
  { key: 'mother', ar: 'الأم', en: 'Mother' },
  { key: 'guardian', ar: 'ولي أمر', en: 'Guardian' },
] as const;

export function OnboardingModal({ visible, onClose, onCompleted }: OnboardingModalProps) {
  const { user, refreshUser } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState<'male' | 'female' | ''>(user?.gender || '');
  const [memorizedJuz, setMemorizedJuz] = useState(String(user?.memorizedJuz ?? 0));
  const [preferredTrack, setPreferredTrack] = useState(user?.preferredTrack || 'memorization');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRel, setGuardianRel] = useState<'father' | 'mother' | 'guardian'>('father');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setMemorizedJuz(String(user?.memorizedJuz ?? 0));
    setPreferredTrack(user?.preferredTrack || 'memorization');
    setError('');
  }, [visible, user]);

  const parsedAge = parseInt(age, 10);
  const isMinor = Number.isFinite(parsedAge) && parsedAge > 0 && parsedAge < 18;
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const handleSubmit = async () => {
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError(locale === 'ar' ? 'يرجى إدخال الاسم الكامل ورقم الهاتف.' : 'Please enter your full name and phone.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 4 || parsedAge > 100) {
      setError(locale === 'ar' ? 'يرجى إدخال العمر بشكل صحيح (بين 4 و 100).' : 'Please enter a valid age (4–100).');
      return;
    }
    if (!gender) {
      setError(locale === 'ar' ? 'يرجى اختيار النوع (ذكر / أنثى).' : 'Please select your gender.');
      return;
    }
    if (isMinor && (!guardianName.trim() || !guardianPhone.trim())) {
      setError(locale === 'ar' ? 'يرجى إدخال اسم ورقم هاتف ولي الأمر للطالب أقل من 18 سنة.' : 'Guardian name and phone are required for students under 18.');
      return;
    }

    const clampedJuz = Math.min(30, Math.max(0, parseInt(memorizedJuz, 10) || 0));

    setSaving(true);
    try {
      const demographicsLocked = user?.onboarding?.completed === true;
      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim(),
        preferredTrack,
        memorizedJuz: clampedJuz,
      };
      if (!demographicsLocked) {
        payload.age = parsedAge;
        payload.gender = gender;
      }
      if (isMinor && !demographicsLocked) {
        payload.guardianContact = {
          name: guardianName.trim(),
          phone: guardianPhone.trim(),
          relationship: guardianRel,
        };
      }

      await api.patch('/api/auth/onboarding', payload, { auth: true });
      await refreshUser();
      Alert.alert(
        t.common.success,
        locale === 'ar' ? 'تم استكمال إعداد حسابك الشخصي بنجاح!' : 'Profile setup completed successfully!'
      );
      onClose();
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={[styles.header, { flexDirection: rowDir }]}>
            <View style={[styles.headLeft, { flexDirection: rowDir }]}>
              <View style={styles.iconBox}>
                <ShieldCheck size={20} color={colors.goldDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { textAlign: align }]}>
                  {locale === 'ar' ? 'استكمال إعداد الحساب الشخصي' : 'Complete Account Setup'}
                </Text>
                <Text style={[styles.subtitle, { textAlign: align }]}>
                  {locale === 'ar'
                    ? 'خطوة سريعة لمرة واحدة لتحديد القسم المناسب لك (رجال / سيدات)'
                    : 'Quick one-time setup to match you with the right section'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.nameLabel}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t.auth.namePlaceholder}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { textAlign: align }]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.phoneLabel}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+2010xxxxxxxx"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                style={[styles.input, { textAlign: 'left' }]}
              />
            </View>

            <View style={[styles.twoCol, { flexDirection: rowDir }]}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { textAlign: align }]}>
                  {locale === 'ar' ? 'العمر (بالسنوات)' : 'Age'}
                </Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="22"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { textAlign: align }]}
                />
              </View>

              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { textAlign: align }]}>
                  {locale === 'ar' ? 'الأجزاء المحفوظة (0-30)' : 'Memorized Juz'}
                </Text>
                <TextInput
                  value={memorizedJuz}
                  onChangeText={setMemorizedJuz}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { textAlign: align }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'النوع (مهم لتحديد قسم الحلقات)' : 'Gender'}
              </Text>
              <View style={[styles.twoCol, { flexDirection: rowDir }]}>
                {(['male', 'female'] as const).map((g) => {
                  const active = gender === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setGender(g)}
                      style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                        {g === 'male' ? (locale === 'ar' ? 'ذكر (رجال / شباب)' : 'Male') : (locale === 'ar' ? 'أنثى (قسم السيدات)' : 'Female')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'المسار المفضل' : 'Preferred Track'}
              </Text>
              <View style={{ gap: 6 }}>
                {TRACKS.map((tr) => {
                  const active = preferredTrack === tr.key;
                  return (
                    <Pressable
                      key={tr.key}
                      onPress={() => setPreferredTrack(tr.key)}
                      style={[styles.trackBtn, { flexDirection: rowDir }, active && styles.trackBtnActive]}
                    >
                      <CheckCircle2 size={17} color={active ? colors.emerald : colors.borderStrong} />
                      <Text style={[styles.trackText, active && styles.trackTextActive]}>
                        {locale === 'ar' ? tr.ar : tr.en}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {isMinor ? (
              <View style={styles.guardianBox}>
                <Text style={[styles.guardianHeading, { textAlign: align }]}>
                  {locale === 'ar' ? 'بيانات ولي الأمر (مطلوبة لمن هم دون 18 عاماً)' : 'Guardian Details (Required Under 18)'}
                </Text>
                <TextInput
                  value={guardianName}
                  onChangeText={setGuardianName}
                  placeholder={locale === 'ar' ? 'اسم ولي الأمر' : 'Guardian name'}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { textAlign: align }]}
                />
                <TextInput
                  value={guardianPhone}
                  onChangeText={setGuardianPhone}
                  placeholder={locale === 'ar' ? 'رقم هاتف ولي الأمر (+201...)' : 'Guardian phone'}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={[styles.input, { textAlign: 'left' }]}
                />
                <View style={[styles.twoCol, { flexDirection: rowDir }]}>
                  {RELATIONSHIPS.map((rel) => {
                    const active = guardianRel === rel.key;
                    return (
                      <Pressable
                        key={rel.key}
                        onPress={() => setGuardianRel(rel.key)}
                        style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                          {locale === 'ar' ? rel.ar : rel.en}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <PrimaryButton
              label={saving ? t.common.saving : (locale === 'ar' ? 'حفظ واستكمال الاشتراك' : 'Save & Continue')}
              variant="gold"
              loading={saving}
              onPress={() => void handleSubmit()}
              style={{ marginTop: spacing.xs }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headLeft: { flex: 1, alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  subtitle: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 16 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  form: { gap: spacing.md, paddingBottom: spacing.lg },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F3B8B2',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { fontSize: 13, fontFamily: fonts.bold, color: colors.danger, textAlign: 'center' },
  field: { gap: 5 },
  twoCol: { gap: spacing.sm },
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
  choiceBtn: {
    flex: 1,
    minHeight: TOUCH_MIN - 4,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  choiceBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  choiceText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, textAlign: 'center' },
  choiceTextActive: { color: colors.white },
  trackBtn: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
  },
  trackBtnActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldSoft },
  trackText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary },
  trackTextActive: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  guardianBox: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guardianHeading: { fontSize: 13, fontFamily: fonts.extraBold, color: colors.emeraldDark },
});
