import { useMemo, useState } from 'react';
import { Download, History, Loader2, RefreshCw, Search } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';

const ACTION_LABELS_AR = {
  'teacher.approved': 'اعتماد معلم',
  'teacher.rejected': 'رفض طلب معلم',
  'teacher.updated': 'تحديث إعدادات معلم',
  'teacher.admin-profile.updated': 'تحديث شامل لملف معلم',
  'teacher.deleted-by-admin': 'حذف حساب معلم',
  'course.created': 'إنشاء دورة جديدة',
  'course.updated': 'تعديل بيانات دورة',
  'course.deleted': 'حذف دورة',
  'course.archived': 'أرشفة دورة مرتبطة بطلاب',
  'course.official_catalog_seeded': 'نشر الكتالوج الرسمي للدورات',
  'lesson.created': 'إضافة درس لدورة',
  'lesson.updated': 'تعديل درس',
  'lesson.deleted': 'حذف درس',
  'blog.created': 'نشر مقال بالمدونة',
  'blog.updated': 'تعديل مقال بالمدونة',
  'blog.deleted': 'حذف مقال من المدونة',
  'trial.assigned': 'تعيين معلم لحصة تجريبية',
  'trial.rescheduled': 'إعادة جدولة حصة تجريبية',
  'trial.assessed': 'تقييم حصة تجريبية',
  'payment.manual.approved': 'اعتماد إيصال دفع يدوي',
  'payment.manual.rejected': 'رفض إيصال دفع يدوي',
  'contact_message.replied': 'الرد على رسالة تواصل',
  'session-control.viewed': 'استعراض مركز الحصص',
  'session-control.nudge-teacher': 'إرسال تذكير فوري لمعلم',
};

const ENTITY_GROUPS = [
  { id: 'all', ar: 'الكل', en: 'All', match: () => true },
  { id: 'teachers', ar: 'المعلمون', en: 'Teachers', match: (t) => String(t).includes('teacher') },
  { id: 'people', ar: 'الطلاب والأسر', en: 'Students & Families', match: (t) => ['student', 'user', 'guardian'].some((k) => String(t).includes(k)) },
  { id: 'finance', ar: 'المالية والاشتراكات', en: 'Finance & Subscriptions', match: (t) => ['payment', 'payout', 'finance', 'subscription', 'circle'].some((k) => String(t).includes(k)) },
  { id: 'sessions', ar: 'الحصص والتجريبيات', en: 'Sessions & Trials', match: (t) => ['session', 'trial'].some((k) => String(t).includes(k)) },
  { id: 'content', ar: 'الدورات والمدونة', en: 'Courses & Blog', match: (t) => ['course', 'lesson', 'blog', 'video'].some((k) => String(t).includes(k)) },
  { id: 'comms', ar: 'الرسائل والتوظيف', en: 'Messages & Careers', match: (t) => ['contact', 'support', 'job', 'donation'].some((k) => String(t).includes(k)) },
];

export default function AdminAuditTab({ auditEntries, loading, onRefresh }) {
  const { locale, isRTL, t } = useI18n();
  const ta = t.adminPortal.tabs.audit;
  const intlLocale = resolveIntlLocale(locale);

  const [searchQuery, setSearchQuery] = useState('');
  const [entityGroup, setEntityGroup] = useState('all');

  const filteredEntries = useMemo(() => {
    const activeGroup = ENTITY_GROUPS.find((g) => g.id === entityGroup) || ENTITY_GROUPS[0];
    const term = searchQuery.trim().toLowerCase();
    return auditEntries.filter((entry) => {
      if (!activeGroup.match(entry.entityType || entry.action || '')) return false;
      if (!term) return true;
      const arabicLabel = ACTION_LABELS_AR[entry.action] || '';
      return [
        entry.action,
        arabicLabel,
        entry.entityType,
        entry.entityId,
        entry.reason,
        entry.actor?.name,
        entry.actor?.email,
        entry.request?.path,
      ].some((val) => String(val || '').toLowerCase().includes(term));
    });
  }, [auditEntries, entityGroup, searchQuery]);

  const exportAuditCsv = () => {
    if (!filteredEntries.length) return;
    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['Timestamp', 'Actor', 'ActorEmail', 'Action', 'EntityType', 'EntityId', 'Reason', 'RequestPath'];
    const rows = filteredEntries.map((entry) => [
      entry.createdAt ? new Date(entry.createdAt).toISOString() : '',
      entry.actor?.name || '',
      entry.actor?.email || '',
      entry.action || '',
      entry.entityType || '',
      entry.entityId || '',
      entry.reason || '',
      entry.request?.path || '',
    ].map(csvEscape).join(','));
    const csv = `\uFEFF${headers.map(csvEscape).join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="wn-dashboard-surface space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
            <History size={18} aria-hidden="true" />
            <span>{ta.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)]">
              {filteredEntries.length}
            </span>
          </h3>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{ta.desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filteredEntries.length === 0}
            onClick={exportAuditCsv}
            className="wn-btn wn-btn--secondary min-h-[42px] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} aria-hidden="true" />
            <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="wn-btn min-h-[42px] inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={15} aria-hidden="true" />
            )}
            <span>{ta.refresh}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-3 pt-1 border-t border-[var(--wn-border)]">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث بالعملية، اسم المشرف، السبب، المسار، أو المعرّف...' : 'Search action, admin, reason, path, or ID...'}
            aria-label={isRTL ? 'بحث في سجل التدقيق' : 'Search audit log'}
            className="w-full min-h-[42px] ps-9 pe-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs text-[var(--wn-text-primary)]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={isRTL ? 'تصنيف سجل التدقيق' : 'Filter audit category'}>
          {ENTITY_GROUPS.map((grp) => (
            <button
              key={grp.id}
              type="button"
              onClick={() => setEntityGroup(grp.id)}
              className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold transition ${
                entityGroup === grp.id
                  ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                  : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border-[var(--wn-border)] hover:border-[var(--wn-border-strong)]'
              }`}
            >
              {isRTL ? grp.ar : grp.en}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState icon={History} title={ta.empty} />
      ) : (
        <div className="wn-admin-audit-list">
          {filteredEntries.map((entry) => {
            const readableAction = isRTL && ACTION_LABELS_AR[entry.action]
              ? `${ACTION_LABELS_AR[entry.action]} (${entry.action})`
              : entry.action;
            return (
              <div key={entry._id}>
                <span>
                  <strong>{entry.actor?.name || ta.actorFallback}</strong>
                  <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString(intlLocale) : ''}</small>
                </span>
                <span>
                  <strong>{readableAction}</strong>
                  <small>{entry.entityType} · {entry.entityId}</small>
                </span>
                <span>
                  <strong>{entry.reason || ta.noNote}</strong>
                  <small>{entry.request?.path || ''}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
