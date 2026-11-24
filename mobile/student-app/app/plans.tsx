import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, CreditCard, ShieldAlert, Sparkles, Users, X } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api, ApiError } from '../src/lib/api';
import { SITE_URL } from '../src/lib/config';
import { IslamicHero } from '../src/components/IslamicHero';
import { OnboardingModal } from '../src/components/OnboardingModal';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';
import { PlanCatalogItem, PlanCatalogResponse, SubscriptionItem } from '../src/types/academy';

const DEFAULT_PACKS = [4, 8, 12, 24];

const PLAN_HIGHLIGHTS: Record<string, { ar: string[]; en: string[]; popular?: boolean }> = {
  focused: {
    ar: [
      'مجموعة صغيرة مركّزة من 3 إلى 5 طلاب فقط',
      'مدة حصة ثابتة 45 دقيقة وتصحيح دقيق للتلاوة',
      'خصم باقات يصل إلى 24% لباقتَي 12 و24 حصة',
    ],
    en: [
      'Small focused circle of only 3 to 5 learners',
      'Fixed 45-minute live session with generous recitation time',
      'Progressive pack savings on 12 & 24 sessions',
    ],
  },
  mini: {
    ar: [
      'مثالية لأخوين أو 3 إخوة في حلقة عائلية واحدة',
      'تبدأ فوراً للإخوة بدون انتظار اكتمال مجموعة',
      'اهتمام شبه فردي (45 دقيقة) وتوفير حتى 22%',
    ],
    en: [
      'Ideal for 2 or 3 siblings sharing one dedicated tutor',
      'Starts immediately for siblings with zero waiting',
      'Near-individual 45-minute live coaching',
    ],
  },
  private: {
    popular: true,
    ar: [
      'حصة فردية خاصة (1-on-1) مع معلم أو معلمة مخصصة',
      '30 دقيقة مركّزة مثالية للأطفال والحفظ المنتظم',
      'مرونة كاملة بالمواعيد وتوفير يصل إلى 29%',
    ],
    en: [
      'Dedicated 1-on-1 private tutor with undivided attention',
      'Focused 30-minute session ideal for kids & steady Hifz',
      'Immediate start & up to 38% pack savings',
    ],
  },
  private_intensive: {
    ar: [
      'ساعة كاملة فردية خالصة (60 دقيقة 1-on-1)',
      'مخصصة للختم والمراجعة الكبيرة والإجازة بالسند',
      'متابعة فردية مع كبار المعلمين المجازين',
    ],
    en: [
      'Full 60-minute 1-on-1 private session',
      'Designed for intensive revision, Khatmah & Sanad Ijazah',
      'Personalized curriculum with certified scholars',
    ],
  },
  // Legacy fallbacks
  community: {
    ar: ['حلقة جماعية قائمة', 'إشراف معلم مجاز'],
    en: ['Existing community circle', 'Certified teacher supervision'],
  },
  group: {
    ar: ['حلقة جماعية قائمة', 'متابعة أسبوعية للحفظ والمراجعة'],
    en: ['Existing group circle', 'Weekly memorization tracking'],
  },
};

function getPlanImageUri(planKey: string, isFemale: boolean): string {
  if (planKey === 'private_intensive') {
    return isFemale
      ? `${SITE_URL}/images/plans/women-private.jpg`
      : `${SITE_URL}/images/programs/program-ijazah.jpg`;
  }
  const validKeys = new Set(['community', 'group', 'focused', 'mini', 'private']);
  const safeKey = validKeys.has(planKey) ? planKey : 'focused';
  const prefix = isFemale ? 'women' : 'men';
  return `${SITE_URL}/images/plans/${prefix}-${safeKey}.jpg`;
}

function formatMinorNumber(minorUnits: number): string {
  const major = Number(minorUnits || 0) / 100;
  if (!Number.isFinite(major)) return '0';
  if (Number.isInteger(major)) return String(major);
  return major.toFixed(2).replace(/0$/, '');
}

function formatMoneyLabel(minorUnits: number, currency = 'EGP', locale: 'ar' | 'en' = 'ar'): string {
  const num = formatMinorNumber(minorUnits);
  if (currency === 'USD') return `$${num}`;
  return locale === 'ar' ? `${num} ج.م` : `${num} EGP`;
}

function getAllowedPacksForPlan(plan: PlanCatalogItem | null, catalog: PlanCatalogResponse | null): number[] {
  if (plan?.allowedSessionPacks?.length) return plan.allowedSessionPacks;
  if (plan && (plan.key === 'focused' || plan.key === 'mini')) return [8, 12, 24];
  if (catalog?.sessionPacks?.length) return catalog.sessionPacks;
  if (catalog?.allowedSessionCounts?.length) return catalog.allowedSessionCounts;
  return DEFAULT_PACKS;
}

function getPlanMinorForPack(plan: PlanCatalogItem, count: number): number {
  const packOverride = plan.packPricesMinor?.[String(count)];
  if (packOverride != null && Number.isFinite(Number(packOverride)) && Number(packOverride) > 0) {
    return Number(packOverride);
  }
  if (plan.pricePerSessionMinor != null && Number(plan.pricePerSessionMinor) > 0) {
    return Number(plan.pricePerSessionMinor);
  }
  return Math.round(Number(plan.pricePerSession || 0) * 100);
}

function getPlanAnchorMinor(plan: PlanCatalogItem): number {
  if (plan.basePricePerSessionMinor != null && Number(plan.basePricePerSessionMinor) > 0) {
    return Number(plan.basePricePerSessionMinor);
  }
  if (plan.packPricesMinor && typeof plan.packPricesMinor === 'object') {
    const vals = Object.values(plan.packPricesMinor).map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length > 0) return Math.max(...vals);
  }
  return getPlanMinorForPack(plan, 8);
}

export default function PlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [catalog, setCatalog] = useState<PlanCatalogResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected plan checkout sheet state
  const [checkoutPlan, setCheckoutPlan] = useState<PlanCatalogItem | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(12);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding modal state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [pendingAfterOnboarding, setPendingAfterOnboarding] = useState<{ plan: PlanCatalogItem; count: number } | null>(null);

  const isFemale = user?.gender === 'female';
  const needsOnboarding = user?.role === 'student' && user?.onboarding?.required === true && user?.onboarding?.completed !== true;

  const loadPlans = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.allSettled([
        api.get<PlanCatalogResponse>('/api/subscriptions/plans'),
        user?.role === 'student'
          ? api.get<{ subscriptions?: SubscriptionItem[] }>('/api/subscriptions/me', { auth: true })
          : Promise.resolve({ subscriptions: [] }),
      ]);
      if (plansRes.status === 'fulfilled') {
        setCatalog(plansRes.value);
      }
      if (subRes.status === 'fulfilled') {
        setSubscriptions(subRes.value.subscriptions ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useFocusEffect(
    useCallback(() => {
      void loadPlans(false);
    }, [loadPlans])
  );

  const openPlanCheckout = (plan: PlanCatalogItem) => {
    if (user?.role === 'guardian') {
      Alert.alert(
        t.brandShort,
        locale === 'ar'
          ? 'يمكنك اختيار الباقة لابنك من صفحة إدارة الأبناء أو مراسلة الدعم المباشر.'
          : 'You can select a plan for your child from Manage Children or Live Support.'
      );
      return;
    }
    const planPacks = getAllowedPacksForPlan(plan, catalog);
    setSessionCount(planPacks.includes(12) ? 12 : planPacks[0]);
    setCheckoutPlan(plan);
  };

  const currency = catalog?.currency || 'EGP';

  const confirmPlanSubscription = async (plan: PlanCatalogItem, count: number, skipOnboardingCheck = false) => {
    if (needsOnboarding && !skipOnboardingCheck) {
      setCheckoutPlan(null);
      setPendingAfterOnboarding({ plan, count });
      setOnboardingOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const section = user?.enrollmentSection === 'ladies' || user?.gender === 'female' ? 'ladies' : 'men_children';
      const res = await api.post<{ subscription?: SubscriptionItem }>(
        '/api/subscriptions/select',
        { planKey: plan.key, section, sessionCount: count },
        { auth: true }
      );
      setCheckoutPlan(null);
      const createdSub = res.subscription;
      const fallbackMinor = getPlanMinorForPack(plan, count) * count;
      const totalMajor = formatMinorNumber(createdSub?.totalAmountMinor ?? fallbackMinor);
      const planTitle = locale === 'ar' ? plan.name?.ar || plan.key : plan.name?.en || plan.key;

      if (createdSub?._id) {
        router.push({
          pathname: '/manual-payment',
          params: {
            subscriptionId: createdSub._id,
            planName: planTitle,
            sessionCount: String(count),
            totalAmount: totalMajor,
            currency: createdSub.currency || plan.currency || currency,
            section,
          },
        });
      } else {
        void loadPlans(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ONBOARDING_REQUIRED') {
        setCheckoutPlan(null);
        setPendingAfterOnboarding({ plan, count });
        setOnboardingOpen(true);
        return;
      }
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  const activeSub = subscriptions.find((s) => s.status === 'active') || subscriptions[0] || null;
  const plans = catalog?.plans ?? [];
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const checkoutPacks = getAllowedPacksForPlan(checkoutPlan, catalog);
  const effectiveCheckoutCount = checkoutPacks.includes(sessionCount) ? sessionCount : (checkoutPacks[0] || 12);
  const checkoutMinor = checkoutPlan ? getPlanMinorForPack(checkoutPlan, effectiveCheckoutCount) : 0;
  const checkoutAnchorMinor = checkoutPlan ? Math.max(checkoutMinor, getPlanAnchorMinor(checkoutPlan)) : 0;
  const checkoutTotalMinor = checkoutMinor * effectiveCheckoutCount;
  const checkoutSavedMinor = Math.max(0, (checkoutAnchorMinor - checkoutMinor) * effectiveCheckoutCount);
  const checkoutSavePct = checkoutAnchorMinor > checkoutMinor
    ? Math.round(((checkoutAnchorMinor - checkoutMinor) / checkoutAnchorMinor) * 100)
    : 0;
  const checkoutCurrency = checkoutPlan?.currency || currency;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'الباقات والحلقات' : 'Plans & Circles'}
        subtitle={
          locale === 'ar'
            ? 'حلقات مركّزة وحصص فردية بخصومات تصل إلى 29% على الباقات الشهرية.'
            : 'Focused circles & 1-on-1 private plans with progressive pack discounts.'
        }
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPlans(true)} tintColor={colors.emerald} />}
      >
        {needsOnboarding ? (
          <View style={styles.onboardingCard}>
            <View style={[styles.headRow, { flexDirection: rowDir }]}>
              <ShieldAlert size={19} color={colors.goldDark} />
              <Text style={styles.onboardingTitle}>
                {locale === 'ar' ? 'استكمل بيانات حسابك أولاً' : 'Complete Your Account First'}
              </Text>
            </View>
            <Text style={[styles.onboardingSub, { textAlign: align }]}>
              {locale === 'ar'
                ? 'أدخل العمر والنوع ورقم الهاتف مرة واحدة فقط لفتح الاشتراك الفوري.'
                : 'Add your age, gender and phone once to unlock subscriptions.'}
            </Text>
            <PrimaryButton
              label={locale === 'ar' ? 'استكمال البيانات الآن (30 ثانية)' : 'Complete Setup Now'}
              variant="gold"
              onPress={() => setOnboardingOpen(true)}
            />
          </View>
        ) : null}

        {activeSub ? (
          <View style={styles.activeCard}>
            <View style={[styles.headRow, { flexDirection: rowDir }]}>
              <CreditCard size={18} color={colors.goldBright} />
              <Text style={styles.activeTitle}>{t.home.subscriptionCardTitle}</Text>
            </View>
            <Text style={[styles.activeName, { textAlign: align }]}>
              {locale === 'ar'
                ? activeSub.pricingSnapshot?.nameAr || activeSub.planKey
                : activeSub.pricingSnapshot?.nameEn || activeSub.planKey}
            </Text>
            <Text style={[styles.activeMeta, { textAlign: align }]}>
              {activeSub.status === 'pending_payment'
                ? (locale === 'ar'
                  ? `بانتظار التحويل ورفع الإيصال • ${activeSub.sessionCount} حصص`
                  : `Awaiting transfer proof • ${activeSub.sessionCount} sessions`)
                : activeSub.status === 'payment_review'
                  ? (locale === 'ar'
                    ? 'تم رفع الإيصال — قيد مراجعة الإدارة والتسكين ⏳'
                    : 'Receipt uploaded — Under Admin Review ⏳')
                  : (locale === 'ar'
                    ? `المتبقي ${activeSub.sessionsRemaining} من ${activeSub.sessionCount} حصة • الحالة: ${activeSub.status}`
                    : `${activeSub.sessionsRemaining} of ${activeSub.sessionCount} sessions left • ${activeSub.status}`)}
            </Text>
            {activeSub.status === 'pending_payment' ? (
              <PrimaryButton
                label={locale === 'ar' ? 'إتمام التحويل ورفع الإيصال الآن' : 'Complete Transfer & Upload Receipt'}
                variant="gold"
                onPress={() =>
                  router.push({
                    pathname: '/manual-payment',
                    params: {
                      subscriptionId: activeSub._id,
                      planName:
                        locale === 'ar'
                          ? activeSub.pricingSnapshot?.nameAr || activeSub.planKey
                          : activeSub.pricingSnapshot?.nameEn || activeSub.planKey,
                      sessionCount: String(activeSub.sessionCount),
                      totalAmount: formatMinorNumber(activeSub.totalAmountMinor || 0),
                      currency: activeSub.currency || currency,
                      section: activeSub.section || (isFemale ? 'ladies' : 'men_children'),
                    },
                  })
                }
                style={{ marginTop: spacing.xs }}
              />
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </View>
        ) : plans.length === 0 ? (
          <StateView
            mode="empty"
            title={locale === 'ar' ? 'تعذر تحميل الباقات حالياً' : 'Plans unavailable right now'}
            actionLabel={t.common.retry}
            onAction={() => void loadPlans(false)}
          />
        ) : (
          plans.map((plan) => {
            const planCurrency = plan.currency || currency;
            const minMinor = Number(plan.pricePerSessionMinor || 0);
            const anchorMinor = getPlanAnchorMinor(plan);
            const maxSave = plan.maxSavingsPercent ?? (
              anchorMinor > minMinor && minMinor > 0
                ? Math.round(((anchorMinor - minMinor) / anchorMinor) * 100)
                : 0
            );
            const fallback = PLAN_HIGHLIGHTS[plan.key];
            const isPopular = Boolean(plan.popular || fallback?.popular);
            const apiFeatures = Array.isArray(plan.features)
              ? plan.features
              : (locale === 'ar' ? plan.features?.ar : plan.features?.en) ?? [];
            const featureList = apiFeatures.length
              ? apiFeatures
              : (locale === 'ar' ? fallback?.ar : fallback?.en) ?? [];

            const capacityLabel =
              plan.maxStudents === 1
                ? (locale === 'ar' ? 'فردية (طالب واحد 1-on-1)' : '1-on-1 Private')
                : plan.minStudents && plan.maxStudents
                  ? (locale === 'ar'
                    ? `${plan.minStudents}–${plan.maxStudents} طلاب`
                    : `${plan.minStudents}–${plan.maxStudents} students`)
                  : '';

            const durationLabel =
              locale === 'ar'
                ? plan.durationLabel?.ar || ''
                : plan.durationLabel?.en || '';

            return (
              <View key={plan.key} style={[styles.planCard, isPopular && styles.planCardPopular]}>
                <View style={styles.imageBanner}>
                  <Image
                    source={{ uri: getPlanImageUri(plan.key, isFemale) }}
                    style={styles.planImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageScrim} />
                  {isPopular ? (
                    <View style={[styles.popularPill, isRTL ? { right: 12 } : { left: 12 }]}>
                      <Sparkles size={12} color={colors.emeraldDeep} />
                      <Text style={styles.popularText}>
                        {locale === 'ar' ? 'الأكثر طلباً • يبدأ فوراً' : 'Most Popular • Instant Start'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.imageMetaRow, { flexDirection: rowDir }]}>
                    {capacityLabel ? (
                      <View style={styles.imgChip}>
                        <Users size={12} color={colors.goldBright} />
                        <Text style={styles.imgChipText}>{capacityLabel}</Text>
                      </View>
                    ) : null}
                    {durationLabel ? (
                      <View style={styles.imgChip}>
                        <Clock size={12} color={colors.goldBright} />
                        <Text style={styles.imgChipText}>{durationLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.planBody}>
                  <Text style={[styles.planName, { textAlign: align }]}>
                    {locale === 'ar' ? plan.name?.ar || plan.key : plan.name?.en || plan.key}
                  </Text>

                  {maxSave > 0 ? (
                    <View style={[styles.savingsRow, { flexDirection: rowDir }]}>
                      <Text style={styles.anchorText}>
                        {formatMoneyLabel(anchorMinor, planCurrency, locale)}
                      </Text>
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>
                          {locale === 'ar' ? `وفّر حتى ${maxSave}%` : `Save up to ${maxSave}%`}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.priceRow, { flexDirection: rowDir }]}>
                    <Text style={styles.priceText}>
                      {locale === 'ar' ? 'تبدأ من ' : 'From '}
                      {minMinor > 0 ? formatMoneyLabel(minMinor, planCurrency, locale) : '—'}
                    </Text>
                    <View style={styles.perSessionBadge}>
                      <Text style={styles.perSessionText}>
                        {locale === 'ar' ? 'للحصة الواحدة' : 'per session'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featuresWrap}>
                    {featureList.slice(0, 3).map((feat, i) => (
                      <View key={i} style={[styles.featRow, { flexDirection: rowDir }]}>
                        <CheckCircle2 size={15} color={colors.emerald} />
                        <Text style={[styles.featText, { textAlign: align }]}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  <PrimaryButton
                    label={locale === 'ar' ? 'اختيار عدد الحصص والاشتراك' : 'Choose Sessions & Subscribe'}
                    variant={isPopular ? 'gold' : 'primary'}
                    onPress={() => openPlanCheckout(plan)}
                    style={{ marginTop: spacing.xs }}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Step 2: Choose Session Count & Live Volume-Discount Checkout Sheet */}
      <Modal
        visible={Boolean(checkoutPlan)}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutPlan(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { textAlign: align }]}>
                  {checkoutPlan
                    ? (locale === 'ar' ? checkoutPlan.name?.ar || checkoutPlan.key : checkoutPlan.name?.en || checkoutPlan.key)
                    : ''}
                </Text>
                <Text style={[styles.modalSub, { textAlign: align }]}>
                  {locale === 'ar'
                    ? `سعر الحصة المختارة: ${formatMoneyLabel(checkoutMinor, checkoutCurrency, locale)}`
                    : `Selected rate: ${formatMoneyLabel(checkoutMinor, checkoutCurrency, locale)} / session`}
                </Text>
              </View>
              <Pressable onPress={() => setCheckoutPlan(null)} style={styles.modalCloseBtn} accessibilityRole="button">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.packHeading, { textAlign: align }]}>
              {locale === 'ar' ? 'اختر الباقة الشهرية (كلما زاد العدد زاد التوفير):' : 'Select your monthly pack:'}
            </Text>

            <View style={styles.packGrid}>
              {checkoutPacks.map((cnt) => {
                const active = effectiveCheckoutCount === cnt;
                const packMinor = checkoutPlan ? getPlanMinorForPack(checkoutPlan, cnt) : 0;
                const packTotalMinor = packMinor * cnt;
                const packSavePct = checkoutAnchorMinor > packMinor && packMinor > 0
                  ? Math.round(((checkoutAnchorMinor - packMinor) / checkoutAnchorMinor) * 100)
                  : 0;
                const recommended = cnt === 12;
                return (
                  <Pressable
                    key={cnt}
                    onPress={() => setSessionCount(cnt)}
                    style={[styles.packOption, active && styles.packOptionActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    {recommended ? (
                      <View style={styles.recPill}>
                        <Text style={styles.recPillText}>
                          {locale === 'ar' ? 'الأكثر توفيراً ⭐' : 'Best Value ⭐'}
                        </Text>
                      </View>
                    ) : packSavePct > 0 ? (
                      <View style={styles.recPill}>
                        <Text style={styles.recPillText}>
                          {locale === 'ar' ? `وفّر ${packSavePct}%` : `Save ${packSavePct}%`}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.packCount, active && styles.packCountActive]}>
                      {cnt} {locale === 'ar' ? (cnt === 12 ? 'حصة' : 'حصص') : 'sessions'}
                    </Text>
                    <Text style={[styles.packPrice, active && styles.packPriceActive]}>
                      {formatMoneyLabel(packTotalMinor, checkoutCurrency, locale)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryBox}>
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.summaryLabel}>{locale === 'ar' ? 'سعر الحصة' : 'Per Session'}</Text>
                <Text style={styles.summaryVal}>
                  {formatMoneyLabel(checkoutMinor, checkoutCurrency, locale)}
                </Text>
              </View>
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.summaryLabel}>{locale === 'ar' ? 'عدد الحصص المختار' : 'Selected Sessions'}</Text>
                <Text style={styles.summaryVal}>
                  {effectiveCheckoutCount} {locale === 'ar' ? (effectiveCheckoutCount === 12 ? 'حصة' : 'حصص') : 'sessions'}
                </Text>
              </View>
              {checkoutSavedMinor > 0 ? (
                <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                  <Text style={styles.savedLabel}>
                    {locale === 'ar' ? `قيمة التوفير (${checkoutSavePct}%)` : `Your Savings (${checkoutSavePct}%)`}
                  </Text>
                  <Text style={styles.savedVal}>
                    -{formatMoneyLabel(checkoutSavedMinor, checkoutCurrency, locale)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.summaryDivider} />
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.totalLabel}>{locale === 'ar' ? 'الإجمالي المطلوب' : 'Total Amount'}</Text>
                <Text style={styles.totalVal}>
                  {formatMoneyLabel(checkoutTotalMinor, checkoutCurrency, locale)}
                </Text>
              </View>
            </View>

            {checkoutPlan ? (
              <PrimaryButton
                label={
                  locale === 'ar'
                    ? `تأكيد الاشتراك — ${formatMoneyLabel(checkoutTotalMinor, checkoutCurrency, locale)}`
                    : `Confirm Subscription — ${formatMoneyLabel(checkoutTotalMinor, checkoutCurrency, locale)}`
                }
                variant="gold"
                loading={submitting}
                onPress={() => void confirmPlanSubscription(checkoutPlan, effectiveCheckoutCount)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <OnboardingModal
        visible={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onCompleted={() => {
          if (pendingAfterOnboarding) {
            const { plan, count } = pendingAfterOnboarding;
            setPendingAfterOnboarding(null);
            setTimeout(() => {
              void confirmPlanSubscription(plan, count, true);
            }, 350);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  onboardingCard: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  onboardingTitle: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  onboardingSub: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 20 },
  activeCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 6,
    ...shadows.elevated,
  },
  activeTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.goldBright },
  activeName: { fontSize: 19, fontFamily: fonts.extraBold, color: colors.textInverse },
  activeMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.mint },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadows.card,
  },
  planCardPopular: { borderWidth: 2, borderColor: colors.gold, ...shadows.elevated },
  imageBanner: {
    height: 158,
    width: '100%',
    backgroundColor: colors.emeraldDeep,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  planImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  imageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 53, 40, 0.34)' },
  popularPill: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  popularText: { fontSize: 11, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  imageMetaRow: { padding: spacing.md, gap: spacing.xs, flexWrap: 'wrap' },
  imgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5, 39, 29, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  imgChipText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textInverse },
  planBody: { padding: spacing.lg, gap: spacing.sm },
  headRow: { alignItems: 'center', gap: spacing.sm },
  planName: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  savingsRow: { alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  anchorText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  saveBadgeText: { fontSize: 11, fontFamily: fonts.extraBold, color: colors.goldDark },
  priceRow: { alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priceText: { fontSize: 24, fontFamily: fonts.extraBold, color: colors.emerald },
  perSessionBadge: {
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  perSessionText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  featuresWrap: { gap: 6, marginTop: 2 },
  featRow: { alignItems: 'center', gap: spacing.sm },
  featText: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 39, 29, 0.62)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalTitle: { fontSize: 19, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  modalSub: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.emerald },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packHeading: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  packOption: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 1.4,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  packOptionActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emeraldDeep,
    ...shadows.card,
  },
  recPill: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 2,
  },
  recPillText: { fontSize: 10, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  packCount: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  packCountActive: { color: colors.white },
  packPrice: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  packPriceActive: { color: colors.goldBright },
  summaryBox: {
    backgroundColor: colors.ivory,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: 8,
  },
  summaryRow: { alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  summaryVal: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  savedLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.emerald },
  savedVal: { fontSize: 13, fontFamily: fonts.extraBold, color: colors.emerald },
  summaryDivider: { height: 1, backgroundColor: colors.border },
  totalLabel: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  totalVal: { fontSize: 20, fontFamily: fonts.extraBold, color: colors.emerald },
});
