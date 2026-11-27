import { useMemo, useState } from 'react';
import {
  Archive, CheckCircle2, ExternalLink, Loader2, Mail, MessageCircle, MessageSquare,
  RefreshCw, Search, Send, Trash2,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import AdminSupportInbox from './AdminSupportInbox';

const STATUS_BADGE_STYLE = {
  new: 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border border-[var(--wn-status-info-border)]',
  read: 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]',
  replied: 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border border-[var(--wn-status-success-border)]',
  closed: 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-tertiary)] border border-[var(--wn-border)]',
};

function normalizeWhatsAppDigits(raw = '') {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  return digits;
}

export default function AdminMessagesTab({
  supportStudent,
  onSelectStudent,
  onOpenStudent = null,
  messages = [],
  contactSummary = null,
  replyText,
  onChangeReplyText,
  onSendReply,
  sendingReplyId,
  onUpdateMessageStatus = null,
  updatingMessageStatusId = null,
  onRefreshMessages = null,
  onDeleteMessage,
}) {
  const { locale, isRTL, t } = useI18n();
  const intlLocale = resolveIntlLocale(locale);
  const tm = t.adminPortal.tabs.messages;

  const [viewMode, setViewMode] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    if (contactSummary) {
      return {
        all: Number(contactSummary.totalAll ?? messages.length),
        new: Number(contactSummary.new ?? 0),
        read: Number(contactSummary.read ?? 0),
        replied: Number(contactSummary.replied ?? 0),
        closed: Number(contactSummary.closed ?? 0),
      };
    }
    return {
      all: messages.length,
      new: messages.filter((m) => m.status === 'new').length,
      read: messages.filter((m) => m.status === 'read').length,
      replied: messages.filter((m) => m.status === 'replied').length,
      closed: messages.filter((m) => m.status === 'closed').length,
    };
  }, [contactSummary, messages]);

  const filteredMessages = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (!term) return true;
      return [m.name, m.email, m.phone, m.subject, m.message, m.adminReply]
        .some((val) => String(val || '').toLowerCase().includes(term));
    });
  }, [messages, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Unified Support & Contact Switcher */}
      <div className="wn-dashboard-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={isRTL ? 'أقسام الدعم والرسائل' : 'Support & messages sections'}>
          {[
            { id: 'all', icon: MessageSquare, label: isRTL ? 'العرض الموحد (الدعم + تواصل معنا)' : 'Unified View (Support + Contact)' },
            { id: 'support', icon: MessageCircle, label: isRTL ? 'محادثات دعم الطلاب الحية' : 'Live Student Support' },
            {
              id: 'contact',
              icon: Mail,
              label: isRTL ? `رسائل تواصل معنا (${counts.all})` : `Contact Form (${counts.all})`,
              badge: counts.new > 0 ? counts.new : 0,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = viewMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewMode(item.id)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition ${
                  active
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-border-strong)]'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[0.68rem] bg-[var(--wn-gold)] text-[var(--wn-emerald-deep)]">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {onRefreshMessages ? (
          <button
            type="button"
            onClick={onRefreshMessages}
            className="wn-btn wn-btn--secondary min-h-[42px] inline-flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>{isRTL ? 'تحديث الرسائل' : 'Refresh'}</span>
          </button>
        ) : null}
      </div>

      {/* Live Student Support Inbox (Rendered by default in 'all' and 'support' modes) */}
      {viewMode !== 'contact' ? (
        <AdminSupportInbox
          selectedStudent={supportStudent}
          onSelect={onSelectStudent}
          onOpenStudent={onOpenStudent}
        />
      ) : null}

      {/* Contact Form Messages Center */}
      {viewMode !== 'support' ? (
        <section className="space-y-4">
          <div className="wn-dashboard-surface space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--wn-heading)]">{tm.contactTitle}</h2>
                <p className="text-xs text-[var(--wn-text-secondary)] mt-0.5">
                  {isRTL
                    ? 'استفسارات الزوار وأولياء الأمور الواردة من صفحة تواصل معنا.'
                    : 'Public inquiries submitted via the Contact Us form.'}
                </p>
              </div>
              <div className="relative min-w-[230px]">
                <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRTL ? 'بحث بالاسم أو البريد أو الموضوع...' : 'Search name, email, subject...'}
                  className="w-full min-h-[40px] ps-9 pe-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs text-[var(--wn-text-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: isRTL ? `الكل (${counts.all})` : `All (${counts.all})` },
                { id: 'new', label: isRTL ? `جديدة (${counts.new})` : `New (${counts.new})` },
                { id: 'read', label: isRTL ? `مقروءة (${counts.read})` : `Read (${counts.read})` },
                { id: 'replied', label: isRTL ? `تم الرد (${counts.replied})` : `Replied (${counts.replied})` },
                { id: 'closed', label: isRTL ? `مغلقة (${counts.closed})` : `Closed (${counts.closed})` },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold transition ${
                    statusFilter === st.id
                      ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="wn-dashboard-surface">
              <EmptyState icon={Mail} title={tm.empty} />
            </div>
          ) : (
            filteredMessages.map((m) => {
              const isSending = sendingReplyId === m._id;
              const isUpdatingStatus = updatingMessageStatusId === m._id;
              const replyInputId = `admin-contact-reply-${m._id}`;
              const waDigits = normalizeWhatsAppDigits(m.phone);
              const waHref = waDigits
                ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
                    isRTL
                      ? `السلام عليكم ${m.name || ''}، نتواصل معكم من أكاديمية وَحْيٌ وَنَمَاء بخصوص رسالتكم: "${m.subject || ''}".`
                      : `Hello ${m.name || ''}, reaching out from Wahy Wa Namaa Academy regarding "${m.subject || ''}".`
                  )}`
                : '';

              return (
                <div key={m._id} className="wn-dashboard-surface">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Mail size={16} className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
                        <span className="font-bold text-[var(--wn-heading)]">{m.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE_STYLE[m.status] || STATUS_BADGE_STYLE.read}`}>
                          {tm.statuses?.[m.status] || m.status}
                        </span>
                        {m.createdAt ? (
                          <span className="text-xs text-[var(--wn-text-tertiary)]">
                            {new Date(m.createdAt).toLocaleString(intlLocale, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-[var(--wn-text-secondary)] flex flex-wrap items-center gap-2">
                        {m.email ? (
                          <a href={`mailto:${m.email}?subject=${encodeURIComponent(`رد أكاديمية وحي ونماء: ${m.subject || ''}`)}`} className="hover:underline">
                            {m.email}
                          </a>
                        ) : null}
                        {m.phone ? <span dir="ltr">{m.phone}</span> : null}
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border border-[var(--wn-border-mint)]"
                          >
                            <MessageCircle size={12} aria-hidden="true" />
                            <span>{isRTL ? 'واتساب' : 'WhatsApp'}</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>

                      <p className="font-semibold text-[var(--wn-text-primary)] mt-2">{m.subject}</p>
                      <p className="text-[var(--wn-text-secondary)] mt-1 whitespace-pre-wrap">{m.message}</p>
                      {m.adminReply && (
                        <div className="mt-3 p-3 rounded-lg text-sm bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] text-[var(--wn-text-primary)]">
                          <strong>{tm.adminReplyPrefix}</strong> {m.adminReply}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onUpdateMessageStatus && m.status === 'new' ? (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => onUpdateMessageStatus(m._id, 'read')}
                          className="min-h-[38px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-semibold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} aria-hidden="true" />
                          <span>{isRTL ? 'مقروءة' : 'Mark read'}</span>
                        </button>
                      ) : null}
                      {onUpdateMessageStatus ? (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => onUpdateMessageStatus(m._id, m.status === 'closed' ? 'read' : 'closed')}
                          className="min-h-[38px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Archive size={13} aria-hidden="true" />
                          <span>{m.status === 'closed' ? (isRTL ? 'إعادة فتح' : 'Reopen') : (isRTL ? 'إغلاق' : 'Close')}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(m._id, m.subject || m.name)}
                        aria-label={tm.deleteAria}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] transition"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {m.status !== 'replied' && m.status !== 'closed' && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <label htmlFor={replyInputId} className="sr-only">{tm.replyLabel}</label>
                      <input
                        id={replyInputId}
                        value={replyText[m._id] || ''}
                        onChange={(e) => onChangeReplyText(m._id, e.target.value)}
                        placeholder={tm.replyPlaceholder}
                        aria-label={tm.replyLabel}
                        disabled={isSending}
                        className="flex-1 min-w-[200px] min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => onSendReply(m._id)}
                        disabled={isSending}
                        className="min-h-[44px] px-4 py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {isSending ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Send size={14} aria-hidden="true" />
                        )}
                        <span>{isSending ? tm.sendingBtn : tm.replyBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}
