import React, { useState } from 'react';
import {
  Image,
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
import { Eye, EyeOff, Globe, Lock, Mail, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { IslamicHero } from '../../src/components/IslamicHero';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../../src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale, isRTL, t, setLocale } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError(t.auth.missingFields);
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <IslamicHero
            isRTL={isRTL}
            rightSlot={
              <Pressable
                onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                style={styles.langPill}
                accessibilityRole="button"
                accessibilityLabel={t.profile.languageLabel}
              >
                <Globe size={15} color={colors.goldBright} />
                <Text style={styles.langText}>{locale === 'ar' ? 'EN' : 'عربي'}</Text>
              </Pressable>
            }
          >
            <View style={styles.brandCenter}>
              <View style={styles.logoFrame}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="cover"
                  accessibilityLabel={t.brand}
                />
              </View>
              <Text style={styles.brandTitle}>{t.brand}</Text>
              <View style={styles.subtitlePill}>
                <Sparkles size={13} color={colors.goldBright} />
                <Text style={styles.brandSubtitle}>{t.appSubtitle}</Text>
              </View>
            </View>
          </IslamicHero>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.heading, { textAlign: align }]}>{t.auth.welcomeTitle}</Text>
              <Text style={[styles.desc, { textAlign: align }]}>{t.auth.welcomeDesc}</Text>
            </View>

            {error ? (
              <View style={styles.errorBox} accessibilityLiveRegion="assertive">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.emailLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Mail size={18} color={colors.emerald} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.auth.emailPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  style={[styles.input, { textAlign: 'left' }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { textAlign: align }]}>{t.auth.passwordLabel}</Text>
              <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Lock size={18} color={colors.emerald} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  style={[styles.input, { textAlign: align }]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textTertiary} />
                  ) : (
                    <Eye size={18} color={colors.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            <PrimaryButton
              label={submitting ? t.auth.loggingIn : t.auth.loginBtn}
              onPress={handleSubmit}
              loading={submitting}
              style={styles.submitBtn}
            />

            <View style={[styles.footerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.footerText}>{t.auth.noAccount}</Text>
              <Link href="/(auth)/register" asChild>
                <Pressable style={styles.linkTouch} accessibilityRole="link">
                  <Text style={styles.linkText}>{t.auth.createAccountLink}</Text>
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
  langPill: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langText: { color: colors.goldBright, fontSize: 13, fontFamily: fonts.bold },
  brandCenter: { alignItems: 'center', gap: 8, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  logoFrame: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: colors.gold,
    overflow: 'hidden',
    backgroundColor: colors.emeraldDeep,
    ...shadows.gold,
  },
  logo: { width: '100%', height: '100%' },
  brandTitle: { color: colors.textInverse, fontSize: 23, fontFamily: fonts.extraBold },
  subtitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.16)',
  },
  brandSubtitle: { color: colors.goldBright, fontSize: 12, fontFamily: fonts.bold },
  card: {
    marginTop: -22,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.elevated,
  },
  cardHeader: { gap: 4 },
  heading: { fontSize: 20, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  desc: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },
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
  submitBtn: { marginTop: spacing.xs },
  footerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  linkTouch: { minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.emerald },
});
