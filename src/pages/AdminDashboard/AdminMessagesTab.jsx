import { Loader2, Mail, Send, Trash2 } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import AdminSupportInbox from './AdminSupportInbox';

const STATUS_BADGE_STYLE = {
  new: 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border border-[var(--wn-status-info-border)]',
  read: 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]',
  replied: 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border border-[var(--wn-status-success-border)]',
  closed: 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-tertiary)] border border-[var(--wn-border)]',
};

export default function AdminMessagesTab({
  supportStudent,
  onSelectStudent,
  messages,
  replyText,
  onChangeReplyText,
  onSendReply,
  sendingReplyId,
  onDeleteMessage,
}) {
  const { t } = useI18n();
  const tm = t.adminPortal.tabs.messages;

  return (
    <div className="space-y-4">
      <AdminSupportInbox selectedStudent={supportStudent} onSelect={onSelectStudent} />
      <h2 className="text-lg font-bold text-[var(--wn-heading)]">{tm.contactTitle}</h2>

      {messages.length === 0 ? (
        <div className="wn-dashboard-surface">
          <EmptyState icon={Mail} title={tm.empty} />
        </div>
      ) : (
        messages.map((m) => {
          const isSending = sendingReplyId === m._id;
          const replyInputId = `admin-contact-reply-${m._id}`;
          return (
            <div key={m._id} className="wn-dashboard-surface">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Mail size={16} className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
                    <span className="font-bold text-[var(--wn-heading)]">{m.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE_STYLE[m.status] || STATUS_BADGE_STYLE.read}`}>
                      {tm.statuses?.[m.status] || m.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--wn-text-secondary)]">
                    {m.email} {m.phone ? `— ${m.phone}` : ''}
                  </p>
                  <p className="font-semibold text-[var(--wn-text-primary)] mt-2">{m.subject}</p>
                  <p className="text-[var(--wn-text-secondary)] mt-1 whitespace-pre-wrap">{m.message}</p>
                  {m.adminReply && (
                    <div className="mt-3 p-3 rounded-lg text-sm bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] text-[var(--wn-text-primary)]">
                      <strong>{tm.adminReplyPrefix}</strong> {m.adminReply}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMessage(m._id, m.subject || m.name)}
                  aria-label={tm.deleteAria}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] transition"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>

              {m.status !== 'replied' && (
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
    </div>
  );
}
