import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowLeft, ArrowRight, Tag, BookOpen, RefreshCw } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import LocalizedLink from '../../components/LocalizedLink';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function BlogDetail() {
  const { slug } = useParams();
  const { locale, isRTL, dir, t } = useI18n();
  const { createArticleSchema, createBreadcrumbSchema } = useSEO();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadPost = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/blog/' + slug + '?locale=' + locale)
      .then(setPost)
      .catch((err) => {
        setPost(null);
        if (err?.status !== 404) {
          setFetchError(err?.message || (isRTL ? 'تعذر تحميل المقال الآن.' : 'Could not load article right now.'));
        }
      })
      .finally(() => setLoading(false));
  }, [slug, locale, isRTL]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  if (loading) {
    return (
      <div className="wn-public-shell min-h-screen grid place-items-center" dir={dir} role="status" aria-live="polite">
        <span className="w-8 h-8 rounded-full border-2 border-[var(--wn-emerald)]/20 border-t-[var(--wn-emerald)] animate-spin" aria-hidden="true" />
        <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل المقال...' : 'Loading article...')}</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-public-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full" role="alert">
            <BookOpen size={46} aria-hidden="true" />
            <h3>{isRTL ? 'تعذر تحميل المقال' : 'Unable to load article'}</h3>
            <p>{fetchError}</p>
            <button type="button" onClick={loadPost} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-public-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full">
            <BookOpen size={46} aria-hidden="true" />
            <h3>{isRTL ? 'المقال غير موجود' : 'Article not found'}</h3>
            <LocalizedLink to="/blog" locale={locale} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              {isRTL ? 'العودة للمقالات' : 'Back to articles'}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const articleTitle = post.metaTitle || post.title;
  const articleDesc = post.metaDescription || post.excerpt;
  const articleSchema = createArticleSchema({
    title: post.title,
    excerpt: post.excerpt,
    image: post.coverImage,
    url: '/blog/' + slug,
    author: post.authorName,
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
  });
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
    { name: t.common?.blog || (isRTL ? 'المقالات' : 'Articles'), url: '/blog' },
    { name: post.title, url: '/blog/' + slug },
  ]);

  return (
    <>
      <SEOHead page={{
        title: articleTitle,
        description: articleDesc,
        keywords: Array.isArray(post.keywords) && post.keywords.length ? post.keywords.join(', ') : undefined,
        image: post.coverImage,
        url: '/blog/' + slug,
        type: 'article',
        schema: [articleSchema, breadcrumbSchema],
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <article className="wn-editorial-wrap">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="wn-editorial-card">
            <span className="wn-public-eyebrow"><Tag size={13} aria-hidden="true" /> {post.category || (isRTL ? 'مقال' : 'Article')}</span>
            <h1 className="mt-3">{post.title}</h1>
            <div className="wn-blog-meta mt-4">
              {post.createdAt ? <span><Calendar size={13} aria-hidden="true" /> {new Date(post.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : locale)}</span> : null}
              {post.readTime ? <span><Clock size={13} aria-hidden="true" /> {post.readTime} {isRTL ? 'دقيقة' : 'min'}</span> : null}
            </div>

            {post.coverImage ? <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl mt-6 border border-[var(--wn-border)]" loading="lazy" /> : null}

            <div className="wn-article-body mt-7">{post.content || post.excerpt}</div>

            <LocalizedLink to="/blog" locale={locale} className="min-h-[44px] inline-flex items-center gap-2 mt-8 text-sm font-bold text-[var(--wn-link)] hover:underline">
              <BackArrow size={16} aria-hidden="true" /> {isRTL ? 'العودة للمقالات' : 'Back to articles'}
            </LocalizedLink>
          </motion.div>
        </article>
      </main>
      <GlobalFooter />
    </>
  );
}
