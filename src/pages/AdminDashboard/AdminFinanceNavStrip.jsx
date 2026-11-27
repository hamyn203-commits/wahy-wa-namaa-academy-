import { CreditCard, UserRoundCheck, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';

export default function AdminFinanceNavStrip({
  active = 'payments',
  pendingPaymentsCount = null,
  awaitingPlacementsCount = null,
  pendingPayoutsCount = null,
}) {
  const navigate = useNavigate();
  const { locale, isRTL } = useI18n();

  const items = [
    {
      id: 'payments',
      icon: CreditCard,
      label: isRTL ? 'الإيصالات والمدفوعات' : 'Receipts & Payments',
      desc: isRTL ? 'مطابقة التحويلات والاعتماد' : 'Verify & settle transfers',
      badge: pendingPaymentsCount,
      tone: 'danger',
      go: () => {
        if (active !== 'payments') navigate(localizedPath('/admin/payments', locale));
      },
    },
    {
      id: 'subscriptions',
      icon: UserRoundCheck,
      label: isRTL ? 'مركز التسكين والحلقات' : 'Placement & Circles',
      desc: isRTL ? 'تسكين الباقات وإدارة الجروبات' : 'Place learners & manage circles',
      badge: awaitingPlacementsCount,
      tone: 'gold',
      go: () => {
        if (active !== 'subscriptions') navigate(localizedPath('/admin/subscriptions', locale));
      },
    },
    {
      id: 'withdrawals',
      icon: WalletCards,
      label: isRTL ? 'الخزينة ومستحقات المعلمين' : 'Treasury & Teacher Payouts',
      desc: isRTL ? 'صافي الدخل والسحوبات والمكافآت' : 'Net revenue, payouts & ledger',
      badge: pendingPayoutsCount,
      tone: 'emerald',
      go: () => {
        if (active !== 'withdrawals') navigate(`${localizedPath('/admin', locale)}?tab=withdrawals`);
      },
    },
  ];

  return (
    <nav
      aria-label={isRTL ? 'التنقل بين أقسام المالية والاشتراكات' : 'Finance & Subscriptions Navigation'}
      className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isCurrent = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.go}
            aria-current={isCurrent ? 'page' : undefined}
            className={`min-h-[56px] rounded-2xl border p-3.5 text-start flex items-center justify-between gap-3 transition cursor-pointer ${
              isCurrent
                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] shadow-sm'
                : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  isCurrent
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                    : 'bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] border border-[var(--wn-border)]'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-bold text-[var(--wn-heading)] truncate">
                  {item.label}
                </strong>
                <small className="block text-xs text-[var(--wn-text-secondary)] truncate">
                  {item.desc}
                </small>
              </span>
            </span>
            {item.badge != null && Number(item.badge) > 0 ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${
                  item.tone === 'danger'
                    ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)]'
                    : item.tone === 'gold'
                      ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border border-[var(--wn-status-warn-border)]'
                      : 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)]'
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
