import { Loader2, Wallet } from 'lucide-react';
import { resolveIntlLocale } from '../../lib/locale';
import EmptyState from '../../components/shared/EmptyState';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherWalletPanel({
  egpBalance,
  usdBalance,
  finance,
  withdrawForm,
  setWithdrawForm,
  withdrawError,
  setWithdrawError,
  requestWithdraw,
  withdrawing,
  transactions,
  financeStatusLabel,
  locale,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const w = tp.wallet || {};
  const intlLocale = resolveIntlLocale(locale);
  const minPlaceholderVal = withdrawForm.currency === 'USD'
    ? `${finance?.limits?.minPayoutUSD || 10} $`
    : `${finance?.limits?.minPayoutEGP || 100} ${tp.overview?.currencyEgp || 'ج.م'}`;
  const currencyEgp = tp.overview?.currencyEgp || 'ج.م';

  return (
    <div className="wn-teacher-wallet">
      <div className="wn-teacher-wallet__hero">
        <div>
          <span>{w.availableLabel || 'الرصيد المتاح للسحب'}</span>
          <div className="flex flex-wrap items-baseline gap-3 mt-1">
            <h3>{egpBalance.available || 0} <small>{currencyEgp}</small></h3>
            <div className="text-2xl font-bold text-[var(--wn-white)]/90 flex items-baseline gap-1">
              <span>/</span>
              <span>{usdBalance.available || 0}</span>
              <small className="text-sm font-normal text-[var(--wn-white)]/75">USD</small>
            </div>
          </div>
          <p>{w.ledgerNote || 'النظام المالي الموحد يعتمد سجل معاملات واحد لكل استحقاق وسحب.'}</p>
        </div>
        <Wallet size={34} aria-hidden="true" />
      </div>

      <div className="wn-teacher-wallet__stats">
        <div>
          <span>{w.totalEarned || 'إجمالي المستحقات'}</span>
          <strong>
            {egpBalance.totalEarned || 0} {currencyEgp}{' '}
            <span className="text-xs text-[var(--wn-text-secondary)] font-normal">
              ({usdBalance.totalEarned || 0} USD)
            </span>
          </strong>
        </div>
        <div>
          <span>{w.pendingWithdrawals || 'طلبات سحب معلقة'}</span>
          <strong>
            {egpBalance.pending || 0} {currencyEgp}{' '}
            <span className="text-xs text-[var(--wn-text-secondary)] font-normal">
              ({usdBalance.pending || 0} USD)
            </span>
          </strong>
        </div>
        <div>
          <span>{w.withdrawn || 'تم سحبه'}</span>
          <strong>
            {egpBalance.withdrawn || 0} {currencyEgp}{' '}
            <span className="text-xs text-[var(--wn-text-secondary)] font-normal">
              ({usdBalance.withdrawn || 0} USD)
            </span>
          </strong>
        </div>
      </div>

      <div className="wn-teacher-wallet__grid">
        <form onSubmit={requestWithdraw} className="wn-teacher-wallet__payout">
          <div className="wn-teacher-section-heading">
            <div>
              <span>{w.newRequestEyebrow || 'طلب جديد'}</span>
              <h3>{w.withdrawTitle || 'سحب الأرباح'}</h3>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="wallet-currency">{w.currencyLabel || 'العملة'}</label>
              <select
                id="wallet-currency"
                value={withdrawForm.currency}
                onChange={(event) => setWithdrawForm((current) => ({ ...current, currency: event.target.value }))}
                className="input-field w-full min-h-[44px]"
              >
                <option value="EGP">{w.egpOption || 'جنيه مصري (EGP)'}</option>
                <option value="USD">{w.usdOption || 'دولار أمريكي (USD)'}</option>
              </select>
            </div>
            <div>
              <label htmlFor="wallet-amount">{w.amountLabel || 'المبلغ'}</label>
              <input
                id="wallet-amount"
                type="number"
                required
                min={withdrawForm.currency === 'USD' ? (finance?.limits?.minPayoutUSD || 10) : (finance?.limits?.minPayoutEGP || 100)}
                value={withdrawForm.amount}
                onChange={(event) => setWithdrawForm((current) => ({ ...current, amount: event.target.value }))}
                className="input-field w-full"
                placeholder={formatMsg(w.minPlaceholder || 'الحد الأدنى {min}', { min: minPlaceholderVal })}
              />
            </div>
            <div>
              <label htmlFor="wallet-method">{w.methodLabel || 'وسيلة السحب'}</label>
              <select
                id="wallet-method"
                value={withdrawForm.payoutMethod}
                onChange={(event) => {
                  setWithdrawError?.('');
                  setWithdrawForm((current) => ({ ...current, payoutMethod: event.target.value }));
                }}
                className="input-field w-full min-h-[44px]"
              >
                <option value="vodafone_cash">{w.methodVodafone || 'محفظة إلكترونية'}</option>
                <option value="instapay">{w.methodInstapay || 'InstaPay'}</option>
                <option value="bank_transfer">{w.methodBank || 'تحويل بنكي'}</option>
                <option value="paypal">{w.methodPayPal || 'PayPal'}</option>
              </select>
            </div>
          </div>

          {withdrawForm.payoutMethod === 'vodafone_cash' && (
            <div>
              <label htmlFor="wallet-vodafone-phone" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                {w.walletPhoneLabel || 'رقم المحفظة الإلكترونية'}
              </label>
              <input
                id="wallet-vodafone-phone"
                required
                dir="ltr"
                className="input-field w-full"
                placeholder={w.walletPhonePlaceholder || 'رقم المحفظة — 01xxxxxxxxx'}
                value={withdrawForm.phone}
                onChange={(event) => setWithdrawForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
          )}

          {withdrawForm.payoutMethod === 'instapay' && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wallet-instapay-ipa" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                    {w.instapayIpaLabel || 'عنوان InstaPay IPA'}
                  </label>
                  <input
                    id="wallet-instapay-ipa"
                    dir="ltr"
                    aria-invalid={Boolean(withdrawError)}
                    aria-describedby={withdrawError ? 'wallet-instapay-error' : undefined}
                    className="input-field w-full"
                    placeholder={w.instapayIpaPlaceholder || 'InstaPay IPA'}
                    value={withdrawForm.ipaAddress}
                    onChange={(event) => {
                      setWithdrawError?.('');
                      setWithdrawForm((current) => ({ ...current, ipaAddress: event.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="wallet-instapay-phone" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                    {w.instapayPhoneLabel || 'أو رقم الهاتف المرتبط'}
                  </label>
                  <input
                    id="wallet-instapay-phone"
                    dir="ltr"
                    aria-invalid={Boolean(withdrawError)}
                    aria-describedby={withdrawError ? 'wallet-instapay-error' : undefined}
                    className="input-field w-full"
                    placeholder={w.instapayPhonePlaceholder || 'أو رقم الهاتف'}
                    value={withdrawForm.phone}
                    onChange={(event) => {
                      setWithdrawError?.('');
                      setWithdrawForm((current) => ({ ...current, phone: event.target.value }));
                    }}
                  />
                </div>
              </div>
              {withdrawError && (
                <p id="wallet-instapay-error" role="alert" className="text-xs font-semibold text-[var(--wn-text-danger)]">
                  {withdrawError}
                </p>
              )}
            </div>
          )}

          {withdrawForm.payoutMethod === 'bank_transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="wallet-bank-name" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                  {w.bankNameLabel || 'اسم البنك'}
                </label>
                <input
                  id="wallet-bank-name"
                  required
                  className="input-field w-full"
                  placeholder={w.bankNamePlaceholder || 'اسم البنك'}
                  value={withdrawForm.bankName}
                  onChange={(event) => setWithdrawForm((current) => ({ ...current, bankName: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="wallet-bank-account" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                  {w.bankAccountLabel || 'رقم الحساب / IBAN'}
                </label>
                <input
                  id="wallet-bank-account"
                  required
                  dir="ltr"
                  className="input-field w-full"
                  placeholder={w.bankAccountPlaceholder || 'رقم الحساب / IBAN'}
                  value={withdrawForm.bankAccountNumber}
                  onChange={(event) => setWithdrawForm((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                />
              </div>
            </div>
          )}

          {withdrawForm.payoutMethod === 'paypal' && (
            <div>
              <label htmlFor="wallet-paypal-email" className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1">
                {w.paypalEmailLabel || 'بريد PayPal'}
              </label>
              <input
                id="wallet-paypal-email"
                required
                dir="ltr"
                type="email"
                className="input-field w-full"
                placeholder={w.paypalEmailPlaceholder || 'بريد PayPal'}
                value={withdrawForm.paypalEmail}
                onChange={(event) => setWithdrawForm((current) => ({ ...current, paypalEmail: event.target.value }))}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={withdrawing}
            className="wn-teacher-primary-action min-h-[44px] inline-flex items-center justify-center gap-2"
          >
            {withdrawing && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{withdrawing ? (w.submittingBtn || 'جاري الإرسال…') : (w.submitBtn || 'إرسال طلب السحب')}</span>
          </button>
        </form>

        <section className="wn-teacher-wallet__transactions">
          <div className="wn-teacher-section-heading">
            <div>
              <span>{w.historyEyebrow || 'السجل المالي'}</span>
              <h3>{w.historyTitle || 'آخر المعاملات'}</h3>
            </div>
          </div>
          {transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={w.emptyTitle || 'لا معاملات بعد'}
              description={w.emptyDesc || 'ستظهر استحقاقات الحصص وطلبات السحب هنا.'}
            />
          ) : (
            <div className="wn-teacher-transaction-list">
              {transactions.slice(0, 12).map((transaction) => (
                <div key={transaction._id}>
                  <span className={'wn-teacher-transaction-icon ' + (transaction.type === 'payout' ? 'is-out' : 'is-in')}>
                    {transaction.type === 'payout' ? '−' : '+'}
                  </span>
                  <span>
                    <strong>
                      {transaction.type === 'session_earning'
                        ? (w.txSessionEarning || 'مستحق حصة')
                        : transaction.type === 'payout'
                          ? (w.txPayout || 'طلب سحب')
                          : transaction.type === 'adjustment'
                            ? (w.txAdjustment || 'رصيد مرحّل')
                            : (w.txGeneric || 'معاملة')}
                    </strong>
                    <small>{new Date(transaction.createdAt).toLocaleString(intlLocale)}</small>
                  </span>
                  <span className="wn-teacher-transaction-amount">
                    <strong>{transaction.type === 'payout' ? '−' : '+'}{transaction.amount} {transaction.currency}</strong>
                    <small>{financeStatusLabel(transaction.status)}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
