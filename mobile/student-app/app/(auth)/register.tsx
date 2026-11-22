import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Eye, EyeOff, Lock, Mail, Phone, User, Users } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { IslamicHero } from '../../src/components/IslamicHero';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { isRTL, t } = useI18n();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'student' | 'guardian'>('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError(t.auth.missingFields);
      return;
    }
    if (password.length < 8) {
      setError(t.auth.shortPassword);
      return;
    }
    setSubmitting(true);
    try {
      await register({ name, email, password, phone, role });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <IslamicHero
            title={t.auth.registerTitle}
            subtitle={t.auth.registerDesc}
            isRTL={isRTL}
            onBack={() => router.back()}
          />

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox} accessibilityLiveRegion="assertive">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.roleLabel}</Text>
              <View style={[styles.roleRow, { flexDirection: rowDir }]}>
                <Pressable
                  onPress={() => setRole('student')}
                  style={[styles.roleCard, role === 'student' && styles.roleCardActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: role === 'student' }}
                >
                  <BookOpen size={20} color={role === 'student' ? colors.emerald : colors.textTertiary} />
                  <Text style={[styles.roleCardTitle, role === 'student' && styles.roleCardTitleActive]}>
                    {t.common.student}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setRole('guardian')}
                  style={[styles.roleCard, role === 'guardian' && styles.roleCardActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: role === 'guardian' }}
                >
                  <Users size={20} color={role === 'guardian' ? colors.emerald : colors.textTertiary} />
                  <Text style={[styles.roleCardTitle, role === 'guardian' && styles.roleCardTitleActive]}>
                    {t.common.guardian}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.nameLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: rowDir }]}>
                <User size={18} color={colors.emerald} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t.auth.namePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { textAlign: align }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.emailLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: rowDir }]}>
                <Mail size={18} color={colors.emerald} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.auth.emailPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { textAlign: 'left' }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.phoneLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: rowDir }]}>
                <Phone size={18} color={colors.emerald} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t.auth.phonePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={[styles.input, { textAlign: 'left' }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.passwordLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: rowDir }]}>
                <Lock size={18} color={colors.emerald} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { textAlign: align }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  {showPassword ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
                </Pressable>
              </View>
            </View>

            <PrimaryButton
              label={submitting ? t.auth.registering : t.auth.registerBtn}
              onPress={handleSubmit}
              loading={submitting}
              style={styles.submitBtn}
            />

            <View style={[styles.footerRow, { flexDirection: rowDir }]}>
              <Text style={styles.footerText}>{t.auth.haveAccount}</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.linkTouch} accessibilityRole="link">
                  <Text style={styles.linkText}>{t.auth.signInLink}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: colors.ivory, paddingBottom: spacing.xxl },
  card: {
    marginTop: -20,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.elevated,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F3B8B2',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, fontFamily: fonts.semiBold, textAlign: 'center' },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  roleRow: { gap: spacing.md },
  roleCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  roleCardActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldSoft,
  },
  roleCardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  roleCardTitleActive: { color: colors.emeraldDark },
  inputWrap: {
    minHeight: TOUCH_MIN + 2,
    borderWidth: 1.2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  submitBtn: { marginTop: spacing.sm },
  footerRow: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  linkTouch: { minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.emerald },
});
