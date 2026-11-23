import { useCallback, useEffect, useId, useState } from 'react';
import {
  Ban, Check, Clock, Copy, ExternalLink, Eye, EyeOff, KeyRound, Link2, Lock, Unlock,
  Loader2, MessageCircle, Plus, RefreshCw, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { resolveIntlLocale } from '../../lib/locale';

const DURATION_OPTIONS = [
  { hours: 1, ar: 'ساعة واحدة', en: '1 hour' },
  { hours: 6, ar: '6 ساعات', en: '6 hours' },
  { hours: 24, ar: '24 ساعة (يوم)', en: '24 hours (1 day)' },
  { hours: 48, ar: '48 ساعة (يومان)', en: '48 hours (2 days)' },
  { hours: 72, ar: '72 ساعة (3 أيام)', en: '72 hours (3 days)' },
  { hours: 168, ar: '7 أيام (أسبوع)', en: '7 days (1 week)' },
];

const MAX_USES_OPTIONS = [
  { value: 1, ar: 'استخدام واحد (دعوة شخصية)', en: '1 use (personal invite)' },
  { value: 3, ar: '3 استخدامات', en: '3 uses' },
  { value: 5, ar: '5 استخدامات', en: '5 uses' },
  { value: 10, ar: '10 استخدامات', en: '10 uses' },
  { value: 25, ar: '25 استخداماً', en: '25 uses' },
  { value: 50, ar: '50 استخداماً (حملة)', en: '50 uses (campaign)' },
];

function statusMeta(status, isRTL) {
  switch (status) {
    case 'active':
      return {
        label: isRTL ? 'نشط' : 'Active',
        cls: 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)]',
      };
    case 'exhausted':
      return {
        label: isRTL ? 'مكتمل الاستخدام' : 'Used up',
        cls: 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-border-strong)]',
      };
    case 'revoked':
      return {
        label: isRTL ? 'ملغي من الإدارة' : 'Revoked',
        cls: 'bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border border-[var(--wn-status-danger-border)]',
      };
    default:
      return {
        label: isRTL ? 'منتهي الصلاحية' : 'Expired',
        cls: 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]',
      };
  }
}

export default function TeacherInviteLinksPanel({ onOpenDossier }) {
  const { locale, isRTL } = useI18n();
  const toast = useToast();
  const formId = useId();
  const intlLocale = resolveIntlLocale(locale);

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [copiedFresh, setCopiedFresh] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [loadingLinkId, setLoadingLinkId] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [revealedLinks, setRevealedLinks] = useState({});

  const [label, setLabel] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxUses, setMaxUses] = useState(1);
  const [lockToFirstIp, setLockToFirstIp] = useState(true);
  const [inviteLocale, setInviteLocale] = useState('ar');
  const [freshInvite, setFreshInvite] = useState(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/teachers/admin/invites', { auth: true });
      setInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch {
      toast.error(isRTL ? 'تعذّر تحميل روابط دعوة المعلمين' : 'Failed to load teacher invite links');
    } finally {
      setLoading(false);
    }
  }, [isRTL, toast]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCopiedFresh(false);
    try {
      const data = await api.post('/api/teachers/admin/invites', {
        label: label.trim(),
        expiresInHours: Number(expiresInHours),
        maxUses: Number(maxUses),
        lockToFirstIp: Boolean(lockToFirstIp),
        locale: inviteLocale,
      }, { auth: true });
      const builtUrl = data?.invitePath && typeof window !== 'undefined'
        ? `${window.location.origin}${data.invitePath}`
        : (data?.inviteUrl || '');
      const createdId = data?.invite?.id || '';
      setFreshInvite({
        url: builtUrl,
        invite: data?.invite || null,
      });
      if (createdId && builtUrl) {
        setRevealedLinks((prev) => ({
          ...prev,
          [createdId]: { url: builtUrl, error: '' },
        }));
      }
      setLabel('');
      toast.success(isRTL ? 'تم إنشاء رابط التسجيل المؤقت بنجاح' : 'Temporary registration link created');
      await loadInvites();
    } catch (err) {
      toast.error(err?.message || (isRTL ? 'تعذّر إنشاء الرابط المؤقت' : 'Could not create invite link'));
    } finally {
      setCreating(false);
    }
  };

  const buildWhatsAppShareUrl = (url) => {
    if (!url) return '';
    return `https://wa.me/?text=${encodeURIComponent(
      isRTL
        ? `السلام عليكم ورحمة الله وبركاته 🌿\nإليك رابط التسجيل المؤقت للانضمام لهيئة التدريس في أكاديمية وَحْيٌ وَنَمَاء:\n${url}`
        : `Assalamu Alaikum! Here is your temporary teacher registration link for Wahy Wa Namaa Academy:\n${url}`
    )}`;
  };

  const handleCopyText = async (url, targetId = '') => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (targetId) {
        setCopiedId(targetId);
        setTimeout(() => setCopiedId((curr) => (curr === targetId ? '' : curr)), 2500);
      } else {
        setCopiedFresh(true);
        setTimeout(() => setCopiedFresh(false), 2500);
      }
      toast.success(isRTL ? 'تم نسخ رابط الدعوة المؤقت' : 'Temporary invite link copied');
    } catch {
      toast.error(isRTL ? 'تعذّر النسخ، انسخ الرابط يدوياً' : 'Copy failed — please copy manually');
    }
  };

  const handleCopyFresh = () => handleCopyText(freshInvite?.url, '');

  const handleToggleReveal = async (invite) => {
    const inviteId = invite?.id;
    if (!inviteId) return;
    if (expandedId === inviteId) {
      setExpandedId('');
      return;
    }
    setExpandedId(inviteId);
    if (revealedLinks[inviteId]?.url) return;
    setLoadingLinkId(inviteId);
    try {
      const data = await api.get(`/api/teachers/admin/invites/${encodeURIComponent(inviteId)}/link`, { auth: true });
      const builtUrl = data?.invitePath && typeof window !== 'undefined'
        ? `${window.location.origin}${data.invitePath}`
        : (data?.inviteUrl || '');
      setRevealedLinks((prev) => ({
        ...prev,
        [inviteId]: { url: builtUrl, error: '' },
      }));
    } catch (err) {
      const fallbackMsg = isRTL
        ? 'هذا الرابط أُنشئ قبل تفعيل عرض الروابط المحفوظة — أنشئ رابطاً مؤقتاً جديداً ليظهر عند الضغط عليه.'
        : 'This link was created before saved link reveal was enabled — please create a new temporary link.';
      setRevealedLinks((prev) => ({
        ...prev,
        [inviteId]: { url: '', error: err?.message || fallbackMsg },
      }));
    } finally {
      setLoadingLinkId((curr) => (curr === inviteId ? '' : curr));
    }
  };

  const handleResetIp = async (inviteId) => {
    if (busyId) return;
    setBusyId(inviteId);
    try {
      await api.post(`/api/teachers/admin/invites/${encodeURIComponent(inviteId)}/reset-ip`, {}, { auth: true });
      toast.success(isRTL ? 'تم فك قفل الـ IP — سيُربط الرابط بأول جهاز يفتحه الآن' : 'IP lock cleared — next opener will bind it');
      await loadInvites();
    } catch (err) {
      toast.error(err?.message || (isRTL ? 'تعذّر فك قفل الـ IP' : 'Failed to reset IP lock'));
    } finally {
      setBusyId('');
    }
  };

  const handleRevoke = async (inviteId) => {
    if (busyId) return;
    setBusyId(inviteId);
    try {
      await api.post(`/api/teachers/admin/invites/${encodeURIComponent(inviteId)}/revoke`, {}, { auth: true });
      toast.success(isRTL ? 'تم إلغاء الرابط فوراً ولن يعمل بعد الآن' : 'Invite link revoked immediately');
      if (freshInvite?.invite?.id === inviteId) {
        setFreshInvite(null);
      }
      if (expandedId === inviteId) {
        setExpandedId('');
      }
      await loadInvites();
    } catch (err) {
      toast.error(err?.message || (isRTL ? 'تعذّر إلغاء الرابط' : 'Failed to revoke link'));
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (inviteId) => {
    if (busyId) return;
    setBusyId(inviteId);
    try {
      await api.delete(`/api/teachers/admin/invites/${encodeURIComponent(inviteId)}`, { auth: true });
      toast.success(isRTL ? 'تم حذف سجل الرابط' : 'Invite record deleted');
      if (freshInvite?.invite?.id === inviteId) {
        setFreshInvite(null);
      }
      if (expandedId === inviteId) {
        setExpandedId('');
      }
      setRevealedLinks((prev) => {
        const next = { ...prev };
        delete next[inviteId];
        return next;
      });
      await loadInvites();
    } catch (err) {
      toast.error(err?.message || (isRTL ? 'تعذّر حذف الرابط' : 'Failed to delete link'));
    } finally {
      setBusyId('');
    }
  };

  const activeCount = invites.filter((item) => item.status === 'active').length;
  const whatsappShareUrl = buildWhatsAppShareUrl(freshInvite?.url);

  return (
    <section className="wn-dashboard-surface space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2 text-base">
            <KeyRound size={18} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            <span>{isRTL ? 'روابط تسجيل المعلمين المؤقتة (بدلاً من الرابط الدائم)' : 'Temporary Teacher Registration Links'}</span>
          </h3>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
            {isRTL
              ? 'التسجيل المفتوح مغلق تماماً. لا يمكن لأي معلم أو معلمة جديدة التسجيل إلا عبر رابط مؤقت تنشئه الإدارة هنا بصلاحية وعدد استخدامات محدّد.'
              : 'Public permanent registration is disabled. New teachers can only apply using a time-limited invite link generated here.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)] px-3 py-1 text-xs font-bold">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{isRTL ? `${activeCount} رابط نشط` : `${activeCount} active`}</span>
          </span>
          <button
            type="button"
            onClick={loadInvites}
            disabled={loading}
            className="inline-flex items-center gap-1.5 min-h-[40px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-surface-soft)] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Create Temporary Invite Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end"
      >
        <div className="lg:col-span-4">
          <label htmlFor={`${formId}-label`} className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
            {isRTL ? 'وصف / اسم الدعوة (اختياري)' : 'Invite label (optional)'}
          </label>
          <input
            id={`${formId}-label`}
            type="text"
            maxLength={120}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isRTL ? 'مثال: دعوة الشيخ أحمد أو حملة معلمات' : 'e.g. Sheikh Ahmad or Women Campaign'}
            className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor={`${formId}-hours`} className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
            {isRTL ? 'مدة الصلاحية' : 'Expires in'}
          </label>
          <select
            id={`${formId}-hours`}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value))}
            className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.hours} value={opt.hours}>
                {isRTL ? opt.ar : opt.en}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor={`${formId}-uses`} className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
            {isRTL ? 'عدد الاستخدامات' : 'Max uses'}
          </label>
          <select
            id={`${formId}-uses`}
            value={maxUses}
            onChange={(e) => {
              const nextUses = Number(e.target.value);
              setMaxUses(nextUses);
              setLockToFirstIp(nextUses === 1);
            }}
            className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-sm text-[var(--wn-text-primary)]"
          >
            {MAX_USES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isRTL ? opt.ar : opt.en}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label htmlFor={`${formId}-locale`} className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
            {isRTL ? 'اللغة' : 'Locale'}
          </label>
          <select
            id={`${formId}-locale`}
            value={inviteLocale}
            onChange={(e) => setInviteLocale(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2 py-2 text-sm text-[var(--wn-text-primary)]"
          >
            <option value="ar">العربية</option>
            <option value="en">EN</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="w-full min-h-[44px] rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {creating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            <span>{isRTL ? 'إنشاء رابط مؤقت' : 'Create link'}</span>
          </button>
        </div>

        <div className="sm:col-span-2 lg:col-span-12 pt-1 border-t border-[var(--wn-border)]">
          <label htmlFor={`${formId}-iplock`} className="inline-flex items-center gap-2.5 text-xs font-semibold text-[var(--wn-heading)] cursor-pointer select-none">
            <input
              id={`${formId}-iplock`}
              type="checkbox"
              checked={lockToFirstIp}
              onChange={(e) => setLockToFirstIp(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--wn-emerald)]"
            />
            <Lock size={14} className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
            <span>
              {isRTL
                ? 'قفل الرابط على IP واحد فقط (يسمح لنفس الشخص بالخروج والعودة لإكمال التسجيل خلال المدة، ويمنع عمله إذا شاركه مع شخص آخر)'
                : 'Lock link to a single IP address (same applicant can leave and return within expiry; blocks sharing with other IPs)'}
            </span>
          </label>
        </div>
      </form>

      {/* Newly Created Secret Link Banner (shown once) */}
      {freshInvite?.url ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--wn-emerald-dark)]">
              <Link2 size={16} aria-hidden="true" />
              <span>{isRTL ? 'تم توليد الرابط المؤقت — انسخه الآن أو اضغط على أي رابط في القائمة لعرضه لاحقاً' : 'Temporary link generated — copy it now or click any invite below to reveal it later'}</span>
            </div>
            {freshInvite.invite?.expiresAt ? (
              <span className="text-xs font-semibold text-[var(--wn-emerald-dark)]">
                {isRTL ? 'ينتهي في: ' : 'Expires: '}
                {new Date(freshInvite.invite.expiresAt).toLocaleString(intlLocale)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              dir="ltr"
              value={freshInvite.url}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-[240px] min-h-[44px] rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-mono text-[var(--wn-text-primary)]"
            />
            <button
              type="button"
              onClick={handleCopyFresh}
              className="min-h-[44px] rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
            >
              {copiedFresh ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              <span>{copiedFresh ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الرابط' : 'Copy link')}</span>
            </button>
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] rounded-lg border border-[var(--wn-emerald)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-surface-soft)] px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <MessageCircle size={15} aria-hidden="true" />
              <span>{isRTL ? 'إرسال عبر واتساب' : 'Share via WhatsApp'}</span>
            </a>
          </div>
        </div>
      ) : null}

      {/* Invites History List */}
      {loading && invites.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--wn-text-secondary)]">
          {isRTL ? 'جارٍ تحميل الروابط المؤقتة...' : 'Loading temporary links...'}
        </div>
      ) : invites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] p-6 text-center text-sm text-[var(--wn-text-secondary)]">
          {isRTL
            ? 'لا توجد روابط مؤقتة بعد. أنشئ أول رابط مؤقت من النموذج بالأعلى لمشاركته مع المعلم أو المعلمة.'
            : 'No temporary invite links yet. Create one above to invite a teacher.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {invites.map((item) => {
            const meta = statusMeta(item.status, isRTL);
            const isBusy = busyId === item.id;
            const isExpanded = expandedId === item.id;
            const isLoadingLink = loadingLinkId === item.id;
            const revealed = revealedLinks[item.id];
            const isCopied = copiedId === item.id;
            const itemWhatsappUrl = buildWhatsAppShareUrl(revealed?.url);

            return (
              <article
                key={item.id}
                className={`rounded-xl border bg-[var(--wn-surface-soft)] p-3.5 space-y-3 transition-colors ${
                  isExpanded
                    ? 'border-[var(--wn-emerald)]'
                    : 'border-[var(--wn-border)] hover:border-[var(--wn-border-mint)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleReveal(item)}
                      aria-expanded={isExpanded}
                      className="w-full text-start space-y-1 rounded-lg p-1 -m-1 hover:bg-[var(--wn-surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-emerald)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <strong className="text-sm text-[var(--wn-heading)] truncate">
                          {item.label || (isRTL ? 'دعوة تسجيل معلم' : 'Teacher registration invite')}
                        </strong>
                        <span dir="ltr" className="text-xs font-mono text-[var(--wn-text-tertiary)]">
                          ({item.tokenPreview})
                        </span>
                        <span className="text-xs font-semibold text-[var(--wn-emerald-dark)] inline-flex items-center gap-1">
                          {isExpanded ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
                          <span>{isExpanded ? (isRTL ? 'إخفاء الرابط' : 'Hide link') : (isRTL ? 'اضغط لعرض الرابط' : 'Click to show link')}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--wn-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} aria-hidden="true" />
                          <span>
                            {isRTL
                              ? `الاستخدام: ${item.usedCount} / ${item.maxUses}`
                              : `Used: ${item.usedCount} / ${item.maxUses}`}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} aria-hidden="true" />
                          <span>
                            {isRTL ? 'ينتهي: ' : 'Expires: '}
                            {item.expiresAt ? new Date(item.expiresAt).toLocaleString(intlLocale) : '—'}
                          </span>
                        </span>
                        {item.lockToFirstIp ? (
                          <span className="inline-flex items-center gap-1 text-[var(--wn-emerald-dark)] font-semibold">
                            <Lock size={12} aria-hidden="true" />
                            <span>
                              {item.ipBound
                                ? (isRTL ? `مربوط بـ IP (${item.boundIpMasked})` : `Locked to IP (${item.boundIpMasked})`)
                                : (isRTL ? 'مقفول على أول IP يفتحه' : 'Locks to first IP')}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {Array.isArray(item.usedBy) && item.usedBy.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.usedBy.map((u, idx) => (
                          <span
                            key={`${item.id}-u-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] px-2.5 py-1 text-xs text-[var(--wn-text-primary)]"
                          >
                            <span>{u.name || u.email || (isRTL ? 'معلم مسجّل' : 'Registered teacher')}</span>
                            {u.teacherId && typeof onOpenDossier === 'function' ? (
                              <button
                                type="button"
                                onClick={() => onOpenDossier(u.teacherId)}
                                className="text-[var(--wn-emerald)] hover:underline inline-flex items-center gap-0.5 font-bold"
                              >
                                <ExternalLink size={12} aria-hidden="true" />
                                <span>{isRTL ? 'الملف' : 'Dossier'}</span>
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleReveal(item)}
                      disabled={isLoadingLink}
                      className="min-h-10 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isLoadingLink ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : isExpanded ? (
                        <EyeOff size={14} aria-hidden="true" />
                      ) : (
                        <Link2 size={14} aria-hidden="true" />
                      )}
                      <span>{isExpanded ? (isRTL ? 'إخفاء الرابط' : 'Hide link') : (isRTL ? 'عرض الرابط' : 'Show link')}</span>
                    </button>
                    {item.status === 'active' && item.lockToFirstIp && item.ipBound ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleResetIp(item.id)}
                        className="min-h-[40px] rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                      >
                        <Unlock size={14} aria-hidden="true" />
                        <span>{isRTL ? 'فك قفل IP' : 'Reset IP'}</span>
                      </button>
                    ) : null}
                    {item.status === 'active' ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRevoke(item.id)}
                        className="min-h-[40px] rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />}
                        <span>{isRTL ? 'إلغاء الرابط' : 'Revoke'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(item.id)}
                        className="min-h-[40px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-danger)] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                        <span>{isRTL ? 'حذف' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="pt-3 border-t border-[var(--wn-border)]">
                    {isLoadingLink ? (
                      <div className="flex items-center gap-2 text-xs text-[var(--wn-text-secondary)] py-1">
                        <Loader2 size={14} className="animate-spin text-[var(--wn-emerald)]" aria-hidden="true" />
                        <span>{isRTL ? 'جارٍ إحضار الرابط...' : 'Loading invite link...'}</span>
                      </div>
                    ) : revealed?.url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          dir="ltr"
                          value={revealed.url}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-60 min-h-11 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-mono text-[var(--wn-text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyText(revealed.url, item.id)}
                          className="min-h-11 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          {isCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                          <span>{isCopied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الرابط' : 'Copy link')}</span>
                        </button>
                        <a
                          href={itemWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-11 rounded-lg border border-[var(--wn-emerald)] bg-[var(--wn-surface)] text-[var(--wn-emerald-dark)] hover:bg-[var(--wn-emerald-soft)] px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <MessageCircle size={15} aria-hidden="true" />
                          <span>{isRTL ? 'إرسال عبر واتساب' : 'Share via WhatsApp'}</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] px-3 py-2 text-xs font-semibold">
                        {revealed?.error || (isRTL
                          ? 'هذا الرابط أُنشئ قبل تفعيل عرض الروابط المحفوظة — أنشئ رابطاً مؤقتاً جديداً ليظهر لك عند الضغط عليه.'
                          : 'This link was created before saved link reveal was enabled — create a new temporary link.')}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
