import { useId } from 'react';
import { Edit3, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { localizedValue } from './adminFormat';

export default function AdminBlogTab({
  blogPosts,
  blogForm,
  setBlogForm,
  creatingBlog,
  togglingBlogId,
  onAddBlog,
  onToggleBlogStatus,
  onDeleteItem,
}) {
  const { locale, t } = useI18n();
  const tb = t.adminPortal.tabs.blog;
  const formId = useId();

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={onAddBlog} className="wn-dashboard-surface space-y-3">
        <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
          <Edit3 size={18} aria-hidden="true" />
          <span>{tb.newTitle}</span>
        </h3>
        <div>
          <label htmlFor={`${formId}-slug`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tb.fields.slug}
          </label>
          <input
            id={`${formId}-slug`}
            required
            placeholder={tb.fields.slug}
            value={blogForm.slug}
            onChange={(e) => setBlogForm((p) => ({ ...p, slug: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-title`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tb.fields.titleAr}
          </label>
          <input
            id={`${formId}-title`}
            required
            placeholder={tb.fields.titleAr}
            value={blogForm.titleAr}
            onChange={(e) => setBlogForm((p) => ({ ...p, titleAr: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-excerpt`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tb.fields.excerptAr}
          </label>
          <input
            id={`${formId}-excerpt`}
            placeholder={tb.fields.excerptAr}
            value={blogForm.excerptAr}
            onChange={(e) => setBlogForm((p) => ({ ...p, excerptAr: e.target.value }))}
            className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-content`} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
            {tb.fields.contentAr}
          </label>
          <textarea
            id={`${formId}-content`}
            required
            placeholder={tb.fields.contentAr}
            rows={6}
            value={blogForm.contentAr}
            onChange={(e) => setBlogForm((p) => ({ ...p, contentAr: e.target.value }))}
            className="w-full border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creatingBlog}
          className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {creatingBlog && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          <span>{creatingBlog ? tb.publishingBtn : tb.publishBtn}</span>
        </button>
      </form>

      <div className="wn-dashboard-surface">
        <h3 className="font-bold text-[var(--wn-heading)] mb-4 flex items-center gap-2">
          <MessageSquare size={18} aria-hidden="true" />
          <span>{tb.listTitle.replace('{count}', String(blogPosts.length))}</span>
        </h3>
        {blogPosts.length === 0 ? (
          <EmptyState icon={MessageSquare} title={tb.empty} />
        ) : (
          blogPosts.map((p) => {
            const postTitle = localizedValue(p.title, locale) || p.slug;
            const isToggling = togglingBlogId === p._id;
            return (
              <div
                key={p._id}
                className="border border-[var(--wn-border)] rounded-lg p-3 mb-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--wn-heading)]">{postTitle}</p>
                  <p className="text-xs text-[var(--wn-text-secondary)]">{p.slug} — {p.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleBlogStatus(p)}
                    disabled={isToggling}
                    className="min-h-[44px] text-xs px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isToggling && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    <span>{p.status === 'published' ? tb.unpublish : tb.publish}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem('blog', p._id, postTitle)}
                    aria-label={tb.deleteAria}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
