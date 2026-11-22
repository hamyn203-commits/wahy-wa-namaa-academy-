import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { IslamicHero } from '../src/components/IslamicHero';
import { OnboardingModal } from '../src/components/OnboardingModal';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert(t.brandShort, t.auth.missingFields);
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch(
        '/api/auth/me',
        { name: name.trim(), phone: phone.trim() },
        { auth: true }
      );
      await refreshUser();
      Alert.alert(
        t.common.success,
        locale === 'ar' ? 'تم تحديث بيانات حسابك بنجاح.' : 'Profile updated successfully.'
      );
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || newPassword.length < 8) {
      Alert.alert(t.brandShort, t.auth.shortPassword);
      return;
    }
    setSavingPassword(true);
    try {
      await api.post(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        { auth: true }
      );
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert(
        t.common.success,
        locale === 'ar' ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed successfully.'
      );
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSavingPassword(false);
    }
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={t.profile.editProfile}
        subtitle={locale === 'ar' ? 'عدّل بياناتك الشخصية وكلمة المرور من داخل التطبيق.' : 'Update your profile and security settings in-app.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {user?.role === 'student' ? (
            <View style={styles.onboardingCard}>
              <Text style={[styles.cardTitle, { textAlign: align }]}>
                {user.onboarding?.completed
                  ? (locale === 'ar' ? 'البيانات الأكاديمية (الحفظ والمسار)' : 'Academic Profile (Hifz & Track)')
                  : (locale === 'ar' ? 'استكمال إعداد الحساب الشخصي' : 'Complete Account Setup')}
              </Text>
              <Text style={[styles.subText, { textAlign: align }]}>
                {user.onboarding?.completed
                  ? (locale === 'ar'
                    ? `العمر: ${user.age ?? '—'} • الأجزاء المحفوظة: ${user.memorizedJuz ?? 0}/30`
                    : `Age: ${user.age ?? '—'} • Memorized Juz: ${user.memorizedJuz ?? 0}/30`)
                  : (locale === 'ar'
                    ? 'مطلوب تحديد العمر والنوع ورقم الهاتف مرة واحدة لتفعيل اختيار الباقات والاشتراك.'
                    : 'Set your age, gender and phone once to unlock subscriptions.')}
              </Text>
              <PrimaryButton
                label={
                  user.onboarding?.completed
                    ? (locale === 'ar' ? 'تحديث المسار والأجزاء المحفوظة' : 'Update Track & Memorized Juz')
                    : (locale === 'ar' ? 'استكمال بيانات الحساب الآن' : 'Complete Profile Setup Now')
                }
                variant={user.onboarding?.completed ? 'secondary' : 'gold'}
                onPress={() => setOnboardingOpen(true)}
              />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'البيانات الشخصية' : 'Personal Info'}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.nameLabel}</Text>
              <TextInput value={name} onChangeText={setName} style={[styles.input, { textAlign: align }]} />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.phoneLabel}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={[styles.input, { textAlign: 'left' }]}
              />
            </View>

            <PrimaryButton
              label={savingProfile ? t.common.saving : t.common.save}
              loading={savingProfile}
              onPress={() => void handleSaveProfile()}
            />
          </View>

          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: align }]}>
              {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
              </Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={[styles.input, { textAlign: align }]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>
                {locale === 'ar' ? 'كلمة المرور الجديدة (8 أحرف على الأقل)' : 'New Password (min 8 chars)'}
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={[styles.input, { textAlign: align }]}
              />
            </View>

            <PrimaryButton
              label={locale === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}
              variant="secondary"
              loading={savingPassword}
              onPress={() => void handleChangePassword()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OnboardingModal
        visible={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  onboardingCard: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  subText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 20 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  field: { gap: 6 },
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
});
