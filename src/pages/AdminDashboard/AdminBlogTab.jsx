import { useId, useMemo, useRef, useState } from 'react';
import { Edit3, ExternalLink, Loader2, MessageSquare, Search, Star, Trash2, X } from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { localizedValue } from './adminFormat';

export default function AdminBlogTab({
  blogPosts,
  blogForm,
  setBlogForm,
  creatingBlog,
  togglingBlogId,
  onAddBlog,
  onUpdateBlog = null,
  onToggleBlogStatus,
  onDeleteItem,
}) {
  const { locale, isRTL, t } = useI18n();
  const tb = t.adminPortal.tabs.blog;
  const formId = useId();
  const formRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingPostId, setEditingPostId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredPosts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return blogPosts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!term) return true;
      const postTitle = localizedValue(p.title, locale) || '';
      const excerpt = localizedValue(p.excerpt, locale) || '';
      return [postTitle, p.slug, excerpt].some((val) => String(val || '').toLowerCase().includes(term));
    });
  }, [blogPosts, statusFilter, searchQuery, locale]);

  const startEditingPost = (post) => {
    setEditingPostId(post._id);
    setBlogForm({
      slug: post.slug || '',
      titleAr: post.title?.ar || localizedValue(post.title, locale) || '',
      excerptAr: post.excerpt?.ar || localizedValue(post.excerpt, locale) || '',
      contentAr: post.content?.ar || localizedValue(post.content, locale) || '',
      featured: Boolean(post.featured),
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setBlogForm({ slug: '', titleAr: '', excerptAr: '', contentAr: '', featured: false });
  };

  const handleSubmit = async (e) => {
    if (!editingPostId || !onUpdateBlog) {
      await onAddBlog(e);
      return;
    }
    e.preventDefault();
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const ok = await onUpdateBlog(editingPostId, blogForm);
      if (ok !== false) {
        cancelEditingPost();
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const isBusy = creatingBlog || savingEdit;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <form ref={formRef} onSubmit={handleSubmit} className="wn-dashboard-surface space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
              <Edit3 size={18} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>
                {editingPostId
                  ? (isRTL ? 'تعديل المقال المختار' : 'Edit Blog Post')
                  : tb.newTitle}
              </span>
            </h3>
            {editingPostId ? (
              <button
                type="button"
                onClick={cancelEditingPost}
                className="min-h-[34px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-secondary)] inline-flex items-center gap-1"
              >
                <X size={13} aria-hidden="true" />
                <span>{isRTL ? 'إلغاء التعديل' : 'Cancel Edit'}</span>
              </button>
            ) : null}
          </div>
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
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--wn-text-primary)] min-h-[38px] cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(blogForm.featured)}
              onChange={(e) => setBlogForm((p) => ({ ...p, featured: e.target.checked }))}
              className="w-4 h-4 accent-[var(--wn-emerald)]"
            />
            <Star size={14} className="text-[var(--wn-gold)]" aria-hidden="true" />
            <span>{isRTL ? 'تمييز المقال في واجهة المدونة' : 'Mark as featured article'}</span>
          </label>
          <button
            type="submit"
            disabled={isBusy}
            className="w-full min-h-[44px] py-2 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isBusy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            <span>
              {editingPostId
                ? (savingEdit ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ تعديلات المقال' : 'Save Article Changes'))
                : (creatingBlog ? tb.publishingBtn : tb.publishBtn)}
            </span>
          </button>
        </form>

        <div className="wn-dashboard-surface space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-[var(--wn-heading)] flex items-center gap-2">
              <MessageSquare size={18} aria-hidden="true" />
              <span>{tb.listTitle.replace('{count}', String(filteredPosts.length))}</span>
            </h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={isRTL ? 'تصفية حالة المقالات' : 'Filter article status'}
              className="min-h-[38px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-2.5 py-1 text-xs font-semibold"
            >
              <option value="all">{isRTL ? `الكل (${blogPosts.length})` : `All (${blogPosts.length})`}</option>
              <option value="published">{isRTL ? 'منشورة' : 'Published'}</option>
              <option value="draft">{isRTL ? 'مسودات' : 'Drafts'}</option>
            </select>
          </div>

          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--wn-text-tertiary)]" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'بحث في عناوين المقالات والروابط...' : 'Search blog posts...'}
              className="w-full min-h-[40px] ps-9 pe-3 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs text-[var(--wn-text-primary)]"
            />
          </div>

          {filteredPosts.length === 0 ? (
            <EmptyState icon={MessageSquare} title={tb.empty} />
          ) : (
            filteredPosts.map((p) => {
              const postTitle = localizedValue(p.title, locale) || p.slug;
              const isToggling = togglingBlogId === p._id;
              return (
                <div
                  key={p._id}
                  className={`border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 ${
                    editingPostId === p._id
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-surface-mint)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-[var(--wn-heading)] truncate">{postTitle}</p>
                      {p.featured ? (
                        <span className="px-2 py-0.5 rounded-full text-[0.68rem] font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]">
                          {isRTL ? 'مميز' : 'Featured'}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--wn-text-secondary)]">{p.slug} — {p.status}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.slug && p.status === 'published' ? (
                      <a
                        href={localizedPath(`/blog/${encodeURIComponent(p.slug)}`, locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={isRTL ? 'معاينة المقال' : 'Preview article'}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald)]"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                    {onUpdateBlog ? (
                      <button
                        type="button"
                        onClick={() => startEditingPost(p)}
                        aria-label={isRTL ? `تعديل ${postTitle}` : `Edit ${postTitle}`}
                        className="min-h-[40px] text-xs px-2.5 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onToggleBlogStatus(p)}
                      disabled={isToggling}
                      className="min-h-[40px] text-xs px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isToggling && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                      <span>{p.status === 'published' ? tb.unpublish : tb.publish}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem('blog', p._id, postTitle)}
                      aria-label={tb.deleteAria}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)]"
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
    </div>
  );
}
