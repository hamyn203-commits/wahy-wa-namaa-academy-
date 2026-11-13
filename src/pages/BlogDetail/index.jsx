import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowRight, Tag, BookOpen } from 'lucide-react';
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
  const { locale } = useI18n();
  const { createArticleSchema, createBreadcrumbSchema } = useSEO();
  const isAr = locale === 'ar';
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/blog/' + slug + '?locale=' + locale)
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  if (loading) return <div className="wn-public-shell min-h-screen grid place-items-center"><span className="w-8 h-8 rounded-full border-2 border-[var(--wn-emerald)]/20 border-t-[var(--wn-emerald)] animate-spin" /></div>;

  if (!post) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-public-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-public-empty max-w-xl w-full"><BookOpen size={46} /><h3>{isAr ? 'المقال غير موجود' : 'Article not found'}</h3><LocalizedLink to="/blog" locale={locale} className="wn-btn wn-btn--primary mt-4">{isAr ? 'العودة للمقالات' : 'Back to articles'}</LocalizedLink></div>
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
    { name: isAr ? 'الرئيسية' : 'Home', url: '/' },
    { name: isAr ? 'المقالات' : 'Articles', url: '/blog' },
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
      <main className="wn-public-shell">
        <article className="wn-editorial-wrap">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="wn-editorial-card">
            <span className="wn-public-eyebrow"><Tag size={13} /> {post.category || (isAr ? 'مقال' : 'Article')}</span>
            <h1 className="mt-3">{post.title}</h1>
            <div className="wn-blog-meta mt-4">
              {post.createdAt ? <span><Calendar size={13} /> {new Date(post.createdAt).toLocaleDateString(isAr ? 'ar-EG' : locale)}</span> : null}
              {post.readTime ? <span><Clock size={13} /> {post.readTime} {isAr ? 'دقيقة' : 'min'}</span> : null}
            </div>

            {post.coverImage ? <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl mt-6 border border-[var(--wn-border)]" loading="lazy" /> : null}

            <div className="wn-article-body mt-7">{post.content || post.excerpt}</div>

            <LocalizedLink to="/blog" locale={locale} className="inline-flex items-center gap-2 mt-8 text-sm font-bold text-[var(--wn-emerald-dark)]">
              <ArrowRight size={16} className="rotate-180" /> {isAr ? 'العودة للمقالات' : 'Back to articles'}
            </LocalizedLink>
          </motion.div>
        </article>
      </main>
      <GlobalFooter />
    </>
  );
}
