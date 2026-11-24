import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Target, Wallet, X } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { swrCache } from '../src/lib/cache';
import { formatCurrency, formatDateTime } from '../src/lib/formatters';
import { FinanceTransaction, TeacherFinanceState } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

const PAYOUT_METHODS = ['vodafone_cash', 'instapay', 'bank_transfer', 'paypal'] as const;

export default function TeacherWalletScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [currencyTab, setCurrencyTab] = useState<'EGP' | 'USD'>('EGP');
  const [monthlyGoalEgp, setMonthlyGoalEgp] = useState(5000);
  const [goalInput, setGoalInput] = useState('5000');
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    void swrCache.get<number>('teacher_monthly_goal_egp', 365 * 24 * 3600 * 1000).then((saved) => {
      if (saved && saved > 0) {
        setMonthlyGoalEgp(saved);
        setGoalInput(String(saved));
      }
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [finance, setFinance] = useState<TeacherFinanceState>({
    balances: {
      EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
      USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
    },
    limits: { minPayoutEGP: 100, minPayoutUSD: 10 },
  });
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  // Payout modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<(typeof PAYOUT_METHODS)[number]>('vodafone_cash');
  const [phone, setPhone] = useState('');
  const [ipaAddress, setIpaAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWallet = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [balRes, txRes] = await Promise.all([
        api.get<TeacherFinanceState>('/api/finance/teacher/balance', { auth: true }),
        api.get<{ transactions?: FinanceTransaction[] }>('/api/finance/teacher/transactions?limit=40', { auth: true }),
      ]);
      if (balRes?.balances) setFinance(balRes);
      setTransactions(txRes.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadWallet(false);
  }, [loadWallet]);

  const activeBalance = finance.balances[currencyTab];
  const minPayout = currencyTab === 'USD' ? finance.limits.minPayoutUSD : finance.limits.minPayoutEGP;

  const submitPayout = async () => {
    if (submitting) return;
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < minPayout) {
      Alert.alert(t.common.errorTitle, t.wallet.minPayoutNote.replace('{min}', formatCurrency(minPayout, currencyTab, locale)));
      return;
    }

    const payoutDetails: Record<string, string> = {};
    if (payoutMethod === 'vodafone_cash') payoutDetails.phone = phone.trim();
    if (payoutMethod === 'instapay') {
      payoutDetails.ipaAddress = ipaAddress.trim();
      payoutDetails.phone = phone.trim();
    }
    if (payoutMethod === 'bank_transfer') {
      payoutDetails.bankName = bankName.trim();
      payoutDetails.bankAccountNumber = bankAccountNumber.trim();
    }
    if (payoutMethod === 'paypal') payoutDetails.paypalEmail = paypalEmail.trim();

    setSubmitting(true);
    try {
      await api.post(
        '/api/finance/teacher/request-payout',
        {
          amount: numAmount,
          currency: currencyTab,
          payoutMethod,
          payoutDetails,
        },
        { auth: true }
      );
      setModalOpen(false);
      setAmount('');
      await loadWallet(true);
      Alert.alert('تم الإرسال', 'تم تقديم طلب سحب الأرباح بنجاح وجارٍ مراجعته من الإدارة.');
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const methodLabel = (m: (typeof PAYOUT_METHODS)[number]) => {
    if (m === 'vodafone_cash') return t.wallet.methodVodafone;
    if (m === 'instapay') return t.wallet.methodInstapay;
    if (m === 'bank_transfer') return t.wallet.methodBank;
    return t.wallet.methodPaypal;
  };

  const renderTx = useCallback(
    ({ item }: { item: FinanceTransaction }) => {
      const isOut = item.type === 'payout' || item.type === 'deduction';
      return (
        <View style={[styles.txCard, { flexDirection: rowDir }]}>
          <View style={[styles.txIcon, isOut ? styles.txOut : styles.txIn]}>
            {isOut ? (
              <ArrowUpRight size={18} color={colors.warning} />
            ) : (
              <ArrowDownLeft size={18} color={colors.emerald} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.txDesc, { textAlign: align }]} numberOfLines={2}>
              {item.description || item.type}
            </Text>
            <Text style={[styles.txMeta, { textAlign: align }]}>
              {formatDateTime(item.createdAt, locale)} • {item.status}
            </Text>
          </View>
          <Text style={[styles.txAmount, isOut ? styles.txAmountOut : styles.txAmountIn]}>
            {isOut ? '-' : '+'}{formatCurrency(Math.abs(item.amount), item.currency, locale)}
          </Text>
        </View>
      );
    },
    [align, locale, rowDir]
  );

  const saveGoal = () => {
    const num = Math.max(500, Number(goalInput) || 5000);
    setMonthlyGoalEgp(num);
    setGoalInput(String(num));
    setEditingGoal(false);
    void swrCache.set('teacher_monthly_goal_egp', num);
  };

  const goalPct = Math.min(100, Math.round((finance.balances.EGP.totalEarned / Math.max(1, monthlyGoalEgp)) * 100));
  const remainingEgp = Math.max(0, monthlyGoalEgp - finance.balances.EGP.totalEarned);
  const estSessionsLeft = Math.ceil(remainingEgp / 50);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.wallet.title}
        subtitle={t.wallet.subtitle}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadWallet(false)}
          />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          renderItem={renderTx}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadWallet(true)} tintColor={colors.emerald} />
          }
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <View style={[styles.currBar, { flexDirection: rowDir }]}>
                {(['EGP', 'USD'] as const).map((curr) => (
                  <Pressable
                    key={curr}
                    onPress={() => setCurrencyTab(curr)}
                    style={[styles.currBtn, currencyTab === curr && styles.currBtnActive]}
                  >
                    <Text style={[styles.currText, currencyTab === curr && styles.currTextActive]}>
                      {curr}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.balanceCard}>
                <Text style={styles.balLabel}>{t.wallet.available}</Text>
                <Text style={styles.balValue}>
                  {formatCurrency(activeBalance.available, currencyTab, locale)}
                </Text>

                <View style={[styles.subRow, { flexDirection: rowDir }]}>
                  <View style={styles.subCol}>
                    <Text style={styles.subLabel}>{t.wallet.pending}</Text>
                    <Text style={styles.subVal}>{formatCurrency(activeBalance.pending, currencyTab, locale)}</Text>
                  </View>
                  <View style={styles.subCol}>
                    <Text style={styles.subLabel}>{t.wallet.withdrawn}</Text>
                    <Text style={styles.subVal}>{formatCurrency(activeBalance.withdrawn, currencyTab, locale)}</Text>
                  </View>
                  <View style={styles.subCol}>
                    <Text style={styles.subLabel}>{t.wallet.totalEarned}</Text>
                    <Text style={styles.subVal}>{formatCurrency(activeBalance.totalEarned, currencyTab, locale)}</Text>
                  </View>
                </View>

                <PrimaryButton
                  label={t.wallet.requestPayoutBtn}
                  variant="gold"
                  onPress={() => setModalOpen(true)}
                  icon={<Wallet size={17} color={colors.emeraldDeep} />}
                />
              </View>

              {/* Monthly Income Goal Tracker */}
              <View style={[styles.goalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.modalHead, { flexDirection: rowDir }]}>
                  <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
                    <Target size={17} color={colors.goldDark} />
                    <Text style={[styles.sectionTitle, { marginTop: 0, color: palette.text }]}>
                      {isRTL ? 'مخطّط هدف الدخل الشهري' : 'Monthly Income Goal'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setEditingGoal((v) => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.emerald }}>
                      {editingGoal ? t.common.cancel : (isRTL ? 'تعديل الهدف' : 'Edit Goal')}
                    </Text>
                  </Pressable>
                </View>

                {editingGoal ? (
                  <View style={{ flexDirection: rowDir, gap: spacing.sm, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, styles.flex]}
                      value={goalInput}
                      onChangeText={setGoalInput}
                      keyboardType="number-pad"
                      placeholder="5000"
                    />
                    <PrimaryButton label={t.common.save} onPress={saveGoal} />
                  </View>
                ) : (
                  <>
                    <View style={[styles.modalHead, { flexDirection: rowDir }]}>
                      <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: palette.textSecondary }}>
                        {formatCurrency(finance.balances.EGP.totalEarned, 'EGP', locale)} / {formatCurrency(monthlyGoalEgp, 'EGP', locale)}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: fonts.extraBold, color: colors.goldDark }}>
                        {goalPct}%
                      </Text>
                    </View>
                    <View style={styles.goalTrack}>
                      <View style={[styles.goalFill, { width: `${Math.max(5, goalPct)}%` }]} />
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: palette.textSecondary, textAlign: align }}>
                      {remainingEgp === 0
                        ? (isRTL ? '🎉 مبارك! تجاوزت هدفك الشهري بنجاح.' : '🎉 Congratulations! Monthly goal reached.')
                        : (isRTL
                            ? `متبقي تقريباً ${estSessionsLeft} حصة لتحقيق هدفك الشهري — واصل تألقك!`
                            : `Approx. ${estSessionsLeft} sessions left to hit your monthly goal!`)}
                    </Text>
                  </>
                )}
              </View>

              <Text style={[styles.sectionTitle, { textAlign: align, color: palette.text }]}>{t.wallet.transactionsTitle}</Text>
            </View>
          }
          ListEmptyComponent={<StateView mode="empty" title={t.wallet.emptyTx} />}
        />
      )}

      {/* Request Payout Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHead, { flexDirection: rowDir }]}>
              <Text style={styles.modalTitle}>{t.wallet.payoutModalTitle} ({currencyTab})</Text>
              <Pressable onPress={() => setModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.hintText, { textAlign: align }]}>
                {t.wallet.minPayoutNote.replace('{min}', formatCurrency(minPayout, currencyTab, locale))}
              </Text>

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.amountLabel}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={String(minPayout)}
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.methodLabel}</Text>
              <View style={[styles.chipRow, { flexDirection: rowDir }]}>
                {PAYOUT_METHODS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setPayoutMethod(m)}
                    style={[styles.chip, payoutMethod === m && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, payoutMethod === m && styles.chipTextActive]}>
                      {methodLabel(m)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {payoutMethod === 'vodafone_cash' || payoutMethod === 'instapay' ? (
                <>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.phoneLabel}</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="010..."
                    placeholderTextColor={colors.textTertiary}
                  />
                </>
              ) : null}

              {payoutMethod === 'instapay' ? (
                <>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.ipaLabel}</Text>
                  <TextInput
                    style={styles.input}
                    value={ipaAddress}
                    onChangeText={setIpaAddress}
                    placeholder="username@instapay"
                    placeholderTextColor={colors.textTertiary}
                  />
                </>
              ) : null}

              {payoutMethod === 'bank_transfer' ? (
                <>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.bankNameLabel}</Text>
                  <TextInput style={[styles.input, { textAlign: align }]} value={bankName} onChangeText={setBankName} />
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.bankAccountLabel}</Text>
                  <TextInput style={styles.input} value={bankAccountNumber} onChangeText={setBankAccountNumber} />
                </>
              ) : null}

              {payoutMethod === 'paypal' ? (
                <>
                  <Text style={[styles.fieldLabel, { textAlign: align }]}>{t.wallet.paypalLabel}</Text>
                  <TextInput
                    style={styles.input}
                    value={paypalEmail}
                    onChangeText={setPaypalEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              ) : null}

              <PrimaryButton
                label={t.wallet.requestPayoutBtn}
                onPress={() => void submitPayout()}
                loading={submitting}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  headerStack: { gap: spacing.md, marginBottom: spacing.xs },
  currBar: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 4,
    gap: 4,
  },
  currBtn: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  currBtnActive: { backgroundColor: colors.emerald },
  currText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  currTextActive: { color: colors.white },
  balanceCard: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.elevated,
  },
  balLabel: { color: colors.mint, fontSize: 13, fontFamily: fonts.semiBold, textAlign: 'center' },
  balValue: { color: colors.goldBright, fontSize: 30, fontFamily: fonts.extraBold, textAlign: 'center' },
  subRow: { justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs },
  subCol: { flex: 1, alignItems: 'center', gap: 2 },
  subLabel: { color: colors.mint, fontSize: 11, fontFamily: fonts.medium },
  subVal: { color: colors.white, fontSize: 13, fontFamily: fonts.bold },
  sectionTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.textPrimary, marginTop: spacing.xs },
  txCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  txIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  txIn: { backgroundColor: colors.emeraldSoft },
  txOut: { backgroundColor: colors.warningSoft },
  txDesc: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  txMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
  txAmount: { fontSize: 14, fontFamily: fonts.extraBold },
  txAmountIn: { color: colors.emerald },
  txAmountOut: { color: colors.warning },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 39, 29, 0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
    gap: spacing.md,
  },
  modalHead: { alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { gap: spacing.sm, paddingBottom: spacing.xl },
  hintText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.goldDark },
  fieldLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  chipRow: { flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
  },
  chipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  goalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  goalTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ivoryDeep,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
});
