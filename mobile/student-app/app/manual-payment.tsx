import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  ShieldCheck,
  Smartphone,
  Star,
  UserCheck,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { api } from '../src/lib/api';
import { uploadPaymentProofDirect } from '../src/lib/directUpload';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { colors, fonts, radius, shadows, spacing, TOUCH_MIN } from '../src/theme/tokens';
import { PublicTeacher } from '../src/types/academy';

interface PaymentMethodConfig {
  id: string;
  label: string;
  destination: string;
}

interface PaymentPublicConfig {
  configured?: boolean;
  recipientName?: string;
  methods?: PaymentMethodConfig[];
}

const FALLBACK_METHODS: PaymentMethodConfig[] = [
  { id: 'instapay', label: 'InstaPay', destination: '01151814312' },
  { id: 'mobile_wallet', label: 'Vodafone Cash', destination: '01557891330' },
];

export default function ManualPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subscriptionId: string;
    planName?: string;
    sessionCount?: string;
    totalAmount?: string;
    currency?: string;
    section?: string;
  }>();
  const { user } = useAuth();
  const { locale, isRTL, t } = useI18n();

  const [methods, setMethods] = useState<PaymentMethodConfig[]>(FALLBACK_METHODS);
  const [recipientName, setRecipientName] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('instapay');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const [transferReference, setTransferReference] = useState('');
  const [pickedImage, setPickedImage] = useState<{
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedDone, setSubmittedDone] = useState(false);

  const isLadiesSection = params.section === 'ladies' || user?.enrollmentSection === 'ladies' || user?.gender === 'female';

  const loadConfigAndTeachers = useCallback(async () => {
    setLoadingInit(true);
    try {
      const genderParam = isLadiesSection ? 'female' : 'male';
      const [payRes, teacherRes] = await Promise.allSettled([
        api.get<PaymentPublicConfig>('/api/payments/config'),
        api.get<{ teachers?: PublicTeacher[] }>(`/api/teachers?gender=${genderParam}&limit=30`),
      ]);

      if (payRes.status === 'fulfilled' && payRes.value.methods?.length) {
        setMethods(payRes.value.methods);
        setSelectedMethodId(payRes.value.methods[0].id);
        setRecipientName(payRes.value.recipientName || '');
      }

      if (teacherRes.status === 'fulfilled') {
        const list = teacherRes.value.teachers ?? [];
        setTeachers(list);
        if (list[0]?._id) setSelectedTeacherId(list[0]._id);
      }
    } finally {
      setLoadingInit(false);
    }
  }, [isLadiesSection]);

  useEffect(() => {
    void loadConfigAndTeachers();
  }, [loadConfigAndTeachers]);

  const handleCopy = async (method: PaymentMethodConfig) => {
    await Clipboard.setStringAsync(method.destination);
    setCopiedId(method.id);
    setTimeout(() => setCopiedId((prev) => (prev === method.id ? null : prev)), 2200);
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t.brandShort,
        locale === 'ar' ? 'يرجى السماح بصلاحية معرض الصور لاختيار إيصال التحويل.' : 'Please allow gallery permission to select your receipt.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPickedImage({
        uri: a.uri,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      });
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t.brandShort,
        locale === 'ar' ? 'يرجى السماح بصلاحية الكاميرا لتصوير الإيصال.' : 'Please allow camera permission to photograph your receipt.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPickedImage({
        uri: a.uri,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      });
    }
  };

  const handleSubmitPayment = async () => {
    const subId = String(params.subscriptionId || '').trim();
    if (!subId) {
      Alert.alert(t.brandShort, locale === 'ar' ? 'معرّف الاشتراك غير موجود.' : 'Missing subscription ID.');
      return;
    }
    if (!selectedTeacherId) {
      Alert.alert(
        t.brandShort,
        locale === 'ar' ? 'يرجى اختيار الشيخ / المعلم المفضل أولاً.' : 'Please choose your preferred teacher first.'
      );
      return;
    }
    const cleanRef = transferReference.trim();
    if (cleanRef.length < 4) {
      Alert.alert(
        t.brandShort,
        locale === 'ar'
          ? 'يرجى إدخال رقم المرجع أو الرقم الذي تم التحويل منه (4 أرقام على الأقل).'
          : 'Please enter the transfer reference or sender phone (min 4 chars).'
      );
      return;
    }
    if (!pickedImage) {
      Alert.alert(
        t.brandShort,
        locale === 'ar' ? 'يرجى إرفاق صورة إيصال التحويل.' : 'Please attach the transfer receipt screenshot.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const ownerId = String(user?._id || user?.id || '');
      const uploaded = await uploadPaymentProofDirect({
        uri: pickedImage.uri,
        ownerId,
        filename: pickedImage.fileName,
        mimeType: pickedImage.mimeType,
        fileSize: pickedImage.fileSize,
      });

      await api.post(
        `/api/payments/subscription/${encodeURIComponent(subId)}/manual`,
        {
          method: selectedMethodId,
          preferredTeacherId: selectedTeacherId,
          transferReference: cleanRef,
          proofReference: uploaded.url,
          proofFilename: uploaded.name,
          proofContentType: uploaded.contentType,
          proofSize: uploaded.size,
        },
        { auth: true }
      );

      setSubmittedDone(true);
    } catch (err) {
      Alert.alert(t.brandShort, err instanceof Error ? err.message : t.home.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const getMethodTitle = (m: PaymentMethodConfig) => {
    if (m.id === 'instapay') return locale === 'ar' ? 'إنستا باي (InstaPay)' : 'InstaPay';
    if (m.id === 'mobile_wallet') return locale === 'ar' ? 'فودافون كاش (محفظة إلكترونية)' : 'Vodafone Cash / Wallet';
    return m.label;
  };

  if (submittedDone) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <IslamicHero
          title={locale === 'ar' ? 'تم استلام إثبات التحويل' : 'Transfer Proof Submitted'}
          subtitle={locale === 'ar' ? 'طلبك الآن لدى الإدارة للمراجعة والتسكين.' : 'Your payment is now under Admin review.'}
          isRTL={isRTL}
          onBack={() => router.replace('/plans')}
          compact
        />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.doneContent}>
          <View style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <CheckCircle2 size={38} color={colors.emerald} />
            </View>
            <Text style={styles.doneTitle}>
              {locale === 'ar' ? 'جزاك الله خيراً — تم إرسال الإيصال للإدارة!' : 'Receipt Sent to Administration!'}
            </Text>
            <Text style={styles.doneDesc}>
              {locale === 'ar'
                ? 'تم رفع صورة إيصال التحويل ورقم العملية واختيار الشيخ بنجاح. ستقوم إدارة الأكاديمية بمراجعة التحويل وتفعيل اشتراكك وتسكينك في الحلقة المختارة وإرسال إشعار فوري لك.'
                : 'Your receipt, reference number, and preferred teacher have been sent. Our administration will verify and activate your subscription shortly.'}
            </Text>

            <View style={styles.timeline}>
              <View style={[styles.stepRow, { flexDirection: rowDir }]}>
                <CheckCircle2 size={18} color={colors.emerald} />
                <Text style={styles.stepDoneText}>{locale === 'ar' ? '١. اختيار الباقة وعدد الحصص' : '1. Plan Selected'}</Text>
              </View>
              <View style={[styles.stepRow, { flexDirection: rowDir }]}>
                <CheckCircle2 size={18} color={colors.emerald} />
                <Text style={styles.stepDoneText}>{locale === 'ar' ? '٢. رفع إيصال التحويل واختيار الشيخ' : '2. Receipt & Teacher Sent'}</Text>
              </View>
              <View style={[styles.stepRow, { flexDirection: rowDir }]}>
                <ShieldCheck size={18} color={colors.goldDark} />
                <Text style={styles.stepPendingText}>{locale === 'ar' ? '٣. مراجعة الإدارة والتسكين (قيد المراجعة الآن)' : '3. Admin Review & Placement (In Progress)'}</Text>
              </View>
            </View>

            <PrimaryButton
              label={locale === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
              onPress={() => router.replace('/(tabs)')}
              style={{ width: '100%' }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={locale === 'ar' ? 'تأكيد التحويل والدفع اليدوي' : 'Manual Transfer Payment'}
        subtitle={locale === 'ar' ? 'حوّل المبلغ ثم ارفع صورة الإيصال ليتم الاعتماد والتسكين من الإدارة.' : 'Transfer the amount and upload your receipt for Admin approval.'}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Order Summary Banner */}
          <View style={styles.orderCard}>
            <Text style={[styles.orderPlan, { textAlign: align }]}>
              {params.planName || (locale === 'ar' ? 'باقة الحلقات' : 'Circle Plan')}
            </Text>
            <View style={[styles.orderRow, { flexDirection: rowDir }]}>
              <Text style={styles.orderMeta}>
                {params.sessionCount ? `${params.sessionCount} ${locale === 'ar' ? 'حصص' : 'sessions'}` : ''}
              </Text>
              <Text style={styles.orderTotal}>
                {params.totalAmount || '—'} {params.currency || 'EGP'}
              </Text>
            </View>
          </View>

          {loadingInit ? (
            <SkeletonCard lines={3} />
          ) : (
            <>
              {/* Step 1: Select Transfer Method & Copy Number */}
              <View style={styles.card}>
                <Text style={[styles.stepHeading, { textAlign: align }]}>
                  {locale === 'ar' ? '١) اختر طريقة التحويل وانسخ الرقم' : '1) Choose Transfer Method & Copy Number'}
                </Text>
                {recipientName ? (
                  <Text style={[styles.helperText, { textAlign: align }]}>
                    {locale === 'ar' ? `اسم المستلم: ${recipientName}` : `Recipient: ${recipientName}`}
                  </Text>
                ) : null}

                {methods.map((m) => {
                  const active = selectedMethodId === m.id;
                  const copied = copiedId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setSelectedMethodId(m.id)}
                      style={[styles.methodCard, active && styles.methodCardActive]}
                    >
                      <View style={[styles.methodTop, { flexDirection: rowDir }]}>
                        <View style={[styles.methodHead, { flexDirection: rowDir }]}>
                          {m.id === 'instapay' ? (
                            <Smartphone size={18} color={active ? colors.emerald : colors.textSecondary} />
                          ) : (
                            <Wallet size={18} color={active ? colors.emerald : colors.textSecondary} />
                          )}
                          <Text style={[styles.methodName, active && styles.methodNameActive]}>
                            {getMethodTitle(m)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => void handleCopy(m)}
                          style={[styles.copyBtn, copied && styles.copyBtnDone]}
                        >
                          {copied ? <Check size={13} color={colors.white} /> : <Copy size={13} color={colors.emeraldDark} />}
                          <Text style={[styles.copyText, copied && styles.copyTextDone]}>
                            {copied ? (locale === 'ar' ? 'تم النسخ' : 'Copied') : (locale === 'ar' ? 'نسخ الرقم' : 'Copy')}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.destNumber} selectable>{m.destination}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Step 2: Choose Preferred Sheikh / Teacher */}
              <View style={styles.card}>
                <Text style={[styles.stepHeading, { textAlign: align }]}>
                  {locale === 'ar'
                    ? (isLadiesSection ? '٢) اختاري المعلمة المفضلة للتسكين' : '٢) اختر الشيخ / المعلم المفضل للتسكين')
                    : '2) Select Your Preferred Teacher'}
                </Text>

                {teachers.length === 0 ? (
                  <Text style={[styles.helperText, { textAlign: align }]}>
                    {locale === 'ar' ? 'لا يوجد معلمون متاحون حالياً لهذا القسم.' : 'No teachers available for this section right now.'}
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teacherStrip}>
                    {teachers.map((item) => {
                      const active = selectedTeacherId === item._id;
                      const name = item.personalInfo?.fullName || item.user?.name || t.sessions.teacherFallback;
                      const rating = Number(item.rating?.average || 5).toFixed(1);
                      return (
                        <Pressable
                          key={item._id}
                          onPress={() => setSelectedTeacherId(item._id)}
                          style={[styles.teacherChip, active && styles.teacherChipActive]}
                        >
                          <View style={[styles.teacherAvatar, active && styles.teacherAvatarActive]}>
                            <Text style={[styles.teacherInitial, active && { color: colors.goldBright }]}>
                              {name.charAt(0)}
                            </Text>
                          </View>
                          <Text style={[styles.teacherName, active && { color: colors.emeraldDark }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <View style={styles.teacherMetaRow}>
                            <Star size={11} color={colors.goldDark} fill={colors.gold} />
                            <Text style={styles.teacherRating}>{rating}</Text>
                            {item.isVerified ? <UserCheck size={12} color={colors.emerald} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* Step 3: Transfer Reference + Receipt Screenshot */}
              <View style={styles.card}>
                <Text style={[styles.stepHeading, { textAlign: align }]}>
                  {locale === 'ar' ? '٣) أدخل بيانات التحويل وصورة الإيصال' : '3) Enter Reference & Upload Receipt'}
                </Text>

                <View style={styles.field}>
                  <Text style={[styles.label, { textAlign: align }]}>
                    {locale === 'ar'
                      ? 'رقم المرجع أو الرقم الذي حوّلت منه'
                      : 'Transfer Reference or Sender Number'}
                  </Text>
                  <TextInput
                    value={transferReference}
                    onChangeText={setTransferReference}
                    placeholder={locale === 'ar' ? 'مثال: 010xxxxxxxx أو رقم العملية المرجعي' : 'e.g. 010xxxxxxxx or reference ID'}
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { textAlign: align }]}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { textAlign: align }]}>
                    {locale === 'ar' ? 'صورة إيصال التحويل (سكرين شوت)' : 'Transfer Receipt Image'}
                  </Text>

                  {pickedImage ? (
                    <View style={styles.previewWrap}>
                      <Image source={{ uri: pickedImage.uri }} style={styles.previewImg} resizeMode="cover" />
                      <Pressable onPress={() => void pickFromGallery()} style={styles.changePhotoBtn}>
                        <Text style={styles.changePhotoText}>
                          {locale === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={[styles.uploadBtnRow, { flexDirection: rowDir }]}>
                    <Pressable onPress={() => void pickFromGallery()} style={styles.uploadPickerBtn}>
                      <ImagePlus size={18} color={colors.emeraldDark} />
                      <Text style={styles.uploadPickerText}>
                        {locale === 'ar' ? 'اختيار من المعرض' : 'From Gallery'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void takePhoto()} style={styles.uploadPickerBtn}>
                      <Camera size={18} color={colors.emeraldDark} />
                      <Text style={styles.uploadPickerText}>
                        {locale === 'ar' ? 'تصوير الإيصال' : 'Take Photo'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <PrimaryButton
                  label={
                    submitting
                      ? (locale === 'ar' ? 'جاري رفع الإيصال وإرساله للإدارة...' : 'Uploading receipt...')
                      : (locale === 'ar' ? 'إرسال إثبات التحويل للإدارة للمراجعة' : 'Submit Payment Proof for Review')
                  }
                  variant="gold"
                  loading={submitting}
                  onPress={() => void handleSubmitPayment()}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  flex: { flex: 1, backgroundColor: colors.ivory },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  orderCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,107,0.45)',
    ...shadows.elevated,
  },
  orderPlan: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.textInverse },
  orderRow: { alignItems: 'center', justifyContent: 'space-between' },
  orderMeta: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.mint },
  orderTotal: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.goldBright },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  stepHeading: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  helperText: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  methodCard: {
    borderRadius: radius.lg,
    borderWidth: 1.4,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    padding: spacing.md,
    gap: spacing.sm,
  },
  methodCardActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldSoft,
  },
  methodTop: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  methodHead: { alignItems: 'center', gap: spacing.sm, flex: 1 },
  methodName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  methodNameActive: { color: colors.emeraldDark },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderMint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  copyBtnDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  copyText: { fontSize: 11, fontFamily: fonts.bold, color: colors.emeraldDark },
  copyTextDone: { color: colors.white },
  destNumber: {
    fontSize: 21,
    fontFamily: fonts.extraBold,
    letterSpacing: 1.6,
    color: colors.emeraldDeep,
    textAlign: 'center',
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  teacherStrip: { gap: spacing.sm, paddingVertical: 2 },
  teacherChip: {
    width: 132,
    borderRadius: radius.lg,
    borderWidth: 1.4,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cream,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  teacherChipActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldSoft,
  },
  teacherAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarActive: {
    backgroundColor: colors.emeraldDeep,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  teacherInitial: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  teacherName: { fontSize: 12, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  teacherMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teacherRating: { fontSize: 11, fontFamily: fonts.bold, color: colors.goldDark },
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
  uploadBtnRow: { gap: spacing.sm },
  uploadPickerBtn: {
    flex: 1,
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1.3,
    borderColor: colors.borderMint,
    backgroundColor: colors.emeraldSoft,
    paddingHorizontal: spacing.sm,
  },
  uploadPickerText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  previewWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderMint,
    backgroundColor: colors.cream,
  },
  previewImg: { width: '100%', height: 190 },
  changePhotoBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.emeraldSoft,
  },
  changePhotoText: { fontSize: 12, fontFamily: fonts.bold, color: colors.emeraldDark },
  doneContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  doneCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderMint,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.elevated,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 19, fontFamily: fonts.extraBold, color: colors.emeraldDark, textAlign: 'center' },
  doneDesc: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  timeline: {
    width: '100%',
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  stepRow: { alignItems: 'center', gap: spacing.sm },
  stepDoneText: { fontSize: 13, fontFamily: fonts.bold, color: colors.emeraldDark },
  stepPendingText: { fontSize: 13, fontFamily: fonts.bold, color: colors.goldDark },
});
