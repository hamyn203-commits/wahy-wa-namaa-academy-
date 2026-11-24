import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Globe, GraduationCap, Lock, Mail } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { SITE_URL } from '../../src/lib/config';
import { IslamicHero } from '../../src/components/IslamicHero';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function TeacherLoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale, isRTL, t, toggleLocale } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Silently wake up the serverless API while the teacher enters credentials.
  useEffect(() => {
    void api.get('/api/health', { timeoutMs: 25000 }).catch(() => {});
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError(t.auth.missingFields);
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <IslamicHero
            badge={t.brand.name}
            title={t.auth.loginTitle}
            subtitle={t.auth.loginSubtitle}
            isRTL={isRTL}
            rightSlot={
              <Pressable onPress={toggleLocale} style={styles.langBtn} accessibilityRole="button">
                <Globe size={15} color={colors.goldBright} />
                <Text style={styles.langText}>{locale === 'ar' ? 'EN' : 'عربي'}</Text>
              </Pressable>
            }
          />

          <View style={styles.body}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <GraduationCap size={28} color={colors.gold} />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.auth.emailLabel}
                </Text>
                <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Mail size={18} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.input, styles.ltrInput]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t.auth.emailPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.auth.passwordLabel}
                </Text>
                <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Lock size={18} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.input, styles.ltrInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t.auth.passwordPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                    onSubmitEditing={() => void handleLogin()}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textTertiary} />
                    ) : (
                      <Eye size={18} color={colors.textTertiary} />
                    )}
                  </Pressable>
                </View>
                {/\s/.test(password) ? (
                  <Text style={[styles.spaceHint, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {t.auth.passwordSpacesHint}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => void Linking.openURL(`${SITE_URL}/${locale}/forgot-password`)}
                style={styles.forgotWrap}
                accessibilityRole="link"
              >
                <Text style={[styles.forgotText, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.auth.forgotPassword}
                </Text>
              </Pressable>

              <PrimaryButton
                label={t.auth.loginBtn}
                onPress={() => void handleLogin()}
                loading={submitting}
              />

              <View style={styles.divider} />

              <Text style={styles.applyPrompt}>{t.auth.applyPrompt}</Text>
              <PrimaryButton
                label={t.auth.applyBtn}
                variant="secondary"
                onPress={() => void Linking.openURL(`${SITE_URL}/${locale}/register/teacher`)}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.35)',
  },
  langText: {
    color: colors.textInverse,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  body: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.elevated,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F3B8B2',
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  inputWrap: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
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
  ltrInput: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  spaceHint: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.warning,
    marginTop: 2,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotWrap: { paddingVertical: 2 },
  forgotText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.emerald,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.xs,
  },
  applyPrompt: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
