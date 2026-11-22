import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
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
  community: {
    ar: ['بيئة تنافسية مشجعة للحفظ الجماعي', 'إشراف معلم مجاز وتصحيح تلاوة', 'أقل تكلفة شهرية في الأكاديمية'],
    en: ['Motivating community circle', 'Certified teacher supervision', 'Most affordable monthly option'],
  },
  group: {
    ar: ['توازن مثالي بين التفاعل والتركيز', 'متابعة أسبوعية للحفظ والمراجعة', 'تقارير حضور وتقييم مستمرة'],
    en: ['Balanced group interaction', 'Weekly memorization tracking', 'Regular attendance & progress reports'],
  },
  focused: {
    popular: true,
    ar: ['وقت أطول لكل طالب (90 دقيقة)', 'تصحيح دقيق لأحكام التجويد', 'متابعة يومية للواجبات الصوتية'],
    en: ['Dedicated 90-minute sessions', 'Detailed Tajweed correction', 'Daily voice homework follow-up'],
  },
  mini: {
    ar: ['مجموعة صغيرة (2 إلى 3 طلاب فقط)', 'تقدّم أسرع في الحفظ والمراجعة', 'مرونة عالية في التنسيق مع المعلم'],
    en: ['Tiny circle (2–3 students only)', 'Faster memorization progress', 'High scheduling flexibility'],
  },
  private: {
    ar: ['حصة فردية كاملة 1-على-1 مع معلمك', 'خطة حفظ ومراجعة مخصصة لك وحدك', 'مناسبة جداً للإجازة بالسند والأطفال'],
    en: ['Full 1-on-1 private attention', 'Personalized Hifz & Tajweed plan', 'Ideal for Ijazah & young learners'],
  },
};

function getPlanImageUri(planKey: string, isFemale: boolean): string {
  const validKeys = new Set(['community', 'group', 'focused', 'mini', 'private']);
  const safeKey = validKeys.has(planKey) ? planKey : 'group';
  const prefix = isFemale ? 'women' : 'men';
  return `${SITE_URL}/images/plans/${prefix}-${safeKey}.jpg`;
}

function getPerSessionPrice(plan: PlanCatalogItem): number {
  return Number(
    plan.pricePerSession ?? (plan.pricePerSessionMinor ? plan.pricePerSessionMinor / 100 : 0)
  );
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
  const [sessionCount, setSessionCount] = useState<number>(8);
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

  useEffect(() => {
    void loadPlans(false);
  }, [loadPlans]);

  const packs = catalog?.allowedSessionCounts?.length ? catalog.allowedSessionCounts : DEFAULT_PACKS;

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
    setSessionCount(packs.includes(8) ? 8 : packs[0]);
    setCheckoutPlan(plan);
  };

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
      const perSession = getPerSessionPrice(plan);
      const total = createdSub?.totalAmountMinor
        ? Math.round(createdSub.totalAmountMinor / 100)
        : Math.round(perSession * count);
      const planTitle = locale === 'ar' ? plan.name?.ar || plan.key : plan.name?.en || plan.key;

      if (createdSub?._id) {
        router.push({
          pathname: '/manual-payment',
          params: {
            subscriptionId: createdSub._id,
            planName: planTitle,
            sessionCount: String(count),
            totalAmount: String(total),
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
  const currency = catalog?.currency || 'EGP';
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const checkoutPerSession = checkoutPlan ? getPerSessionPrice(checkoutPlan) : 0;
  const checkoutTotal = Math.round(checkoutPerSession * sessionCount);
  const checkoutCurrency = checkoutPlan?.currency || currency;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'الباقات والحلقات' : 'Plans & Circles'}
        subtitle={locale === 'ar' ? 'تعرّف على سعر الحصة لكل نظام حلقة، ثم اختر عدد الحصص المناسب لك.' : 'Compare per-session rates, then pick your session count.'}
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
                    ? `تم رفع الإيصال — قيد مراجعة الإدارة والتسكين ⏳`
                    : `Receipt uploaded — Under Admin Review ⏳`)
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
                      totalAmount: String(Math.round((activeSub.totalAmountMinor || 0) / 100)),
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
            const perSession = getPerSessionPrice(plan);
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
                ? (locale === 'ar' ? 'فردية (طالب واحد)' : '1-on-1 Private')
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
                {/* Official Circle Photo Banner */}
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
                        {locale === 'ar' ? 'الأكثر اختياراً' : 'Most Popular'}
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

                  {/* Clean Per-Session Price Display Only */}
                  <View style={[styles.priceRow, { flexDirection: rowDir }]}>
                    <Text style={styles.priceText}>
                      {plan.fromPrice ? (locale === 'ar' ? 'تبدأ من ' : 'From ') : ''}
                      {perSession > 0 ? `${perSession} ${plan.currency || currency}` : '—'}
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

      {/* Step 2: Choose Session Count & Live Total Checkout Sheet */}
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
                    ? `سعر الحصة الواحدة: ${checkoutPerSession} ${checkoutCurrency}`
                    : `Per session rate: ${checkoutPerSession} ${checkoutCurrency}`}
                </Text>
              </View>
              <Pressable onPress={() => setCheckoutPlan(null)} style={styles.modalCloseBtn} accessibilityRole="button">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.packHeading, { textAlign: align }]}>
              {locale === 'ar' ? 'اختر عدد الحصص المناسب لك:' : 'Select number of sessions:'}
            </Text>

            <View style={styles.packGrid}>
              {packs.map((cnt) => {
                const active = sessionCount === cnt;
                const packTotal = Math.round(checkoutPerSession * cnt);
                const recommended = cnt === 8;
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
                          {locale === 'ar' ? 'الأكثر اختياراً' : 'Popular'}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.packCount, active && styles.packCountActive]}>
                      {cnt} {locale === 'ar' ? 'حصص' : 'sessions'}
                    </Text>
                    <Text style={[styles.packPrice, active && styles.packPriceActive]}>
                      {packTotal} {checkoutCurrency}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Instant Total Summary Box */}
            <View style={styles.summaryBox}>
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.summaryLabel}>{locale === 'ar' ? 'سعر الحصة' : 'Per Session'}</Text>
                <Text style={styles.summaryVal}>{checkoutPerSession} {checkoutCurrency}</Text>
              </View>
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.summaryLabel}>{locale === 'ar' ? 'عدد الحصص المختار' : 'Selected Sessions'}</Text>
                <Text style={styles.summaryVal}>{sessionCount} {locale === 'ar' ? 'حصص' : 'sessions'}</Text>
              </View>
              <View style={[styles.summaryDivider]} />
              <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
                <Text style={styles.totalLabel}>{locale === 'ar' ? 'الإجمالي المطلوب' : 'Total Amount'}</Text>
                <Text style={styles.totalVal}>{checkoutTotal} {checkoutCurrency}</Text>
              </View>
            </View>

            {checkoutPlan ? (
              <PrimaryButton
                label={
                  locale === 'ar'
                    ? `تأكيد الاشتراك — ${checkoutTotal} ${checkoutCurrency}`
                    : `Confirm Subscription — ${checkoutTotal} ${checkoutCurrency}`
                }
                variant="gold"
                loading={submitting}
                onPress={() => void confirmPlanSubscription(checkoutPlan, sessionCount)}
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
  priceRow: { alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priceText: { fontSize: 25, fontFamily: fonts.extraBold, color: colors.emerald },
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
  summaryDivider: { height: 1, backgroundColor: colors.border },
  totalLabel: { fontSize: 15, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  totalVal: { fontSize: 20, fontFamily: fonts.extraBold, color: colors.emerald },
});
