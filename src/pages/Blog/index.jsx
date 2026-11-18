import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, Clock, ChevronLeft, ChevronRight, BookOpen, Sparkles, RefreshCw } from 'lucide-react';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useSEO } from '../../hooks/useSEO';
import api from '../../lib/api';
import '../../styles/public-experience.css';

function BlogCardSkeleton() {
  return (
    <div className="wn-blog-card" aria-hidden="true">
      <div className="wn-blog-card__visual">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="wn-blog-card__body">
        <Skeleton className="mb-3 h-5 w-4/5" />
        <Skeleton className="mb-2 h-3.5 w-full" />
        <Skeleton className="mb-4 h-3.5 w-2/3" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="mt-4 h-4 w-24" />
      </div>
    </div>
  );
}

export default function Blog() {
  const { locale, isRTL, dir, t } = useI18n();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;
  const { createCollectionSchema, createBreadcrumbSchema } = useSEO();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadPosts = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/blog?locale=' + locale)
      .then((data) => {
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        setArticles(posts.map((post) => ({
          id: post._id || post.slug,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          category: post.category || 'quran',
          date: post.createdAt,
          readTime: post.readTime,
        })));
      })
      .catch((err) => {
        setArticles([]);
        setFetchError(err?.message || (isRTL ? 'تعذر تحميل المقالات الآن.' : 'Could not load articles right now.'));
      })
      .finally(() => setLoading(false));
  }, [locale, isRTL]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return articles.filter((article) => {
      const title = String(article.title || '').toLowerCase();
      const excerpt = String(article.excerpt || '').toLowerCase();
      const matchesSearch = !query || title.includes(query) || excerpt.includes(query);
      const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchQuery, selectedCategory]);

  const pageTitle = t.common?.blog || (isRTL ? 'مكتبة المقالات' : 'Articles');
  const pageDescription = isRTL
    ? 'مقالات منشورة من أكاديمية وحي ونماء حول تعلم القرآن واللغة العربية.'
    : 'Published articles from Wahy Wa Namaa about Quran and Arabic learning.';

  return (
    <>
      <SEOHead page={{
        title: pageTitle,
        description: pageDescription,
        url: '/blog',
        type: 'website',
        schema: [
          createCollectionSchema({
            name: pageTitle,
            description: pageDescription,
            url: '/blog',
            items: articles
              .filter((article) => article?.title && article?.slug)
              .map((article) => ({
                name: article.title,
                url: `/blog/${article.slug}`,
              })),
          }),
          createBreadcrumbSchema([
            { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
            { name: pageTitle, url: '/blog' },
          ]),
        ],
      }} />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {isRTL ? 'مكتبة وحي ونماء' : 'WAHY WA NAMAA LIBRARY'}</span>
              <h1>{isRTL ? 'اقرأ ما يساعدك على التعلّم بثبات' : 'Read what helps you learn with consistency'}</h1>
              <p>{isRTL ? 'المقالات المنشورة من فريق الأكاديمية تظهر هنا مباشرة من نظام المحتوى.' : 'Published academy articles appear here directly from the content system.'}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><BookOpen size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <div className="page-container">
          <section className="wn-public-filter-panel">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="wn-public-search">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  aria-label={isRTL ? 'ابحث في المقالات' : 'Search articles'}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isRTL ? 'ابحث في المقالات...' : 'Search articles...'}
                />
              </div>
              <select
                aria-label={isRTL ? 'تصنيف المقالات' : 'Article category'}
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="wn-public-select md:w-52 min-h-[44px]"
              >
                <option value="all">{isRTL ? 'كل التصنيفات' : 'All categories'}</option>
                <option value="quran">{isRTL ? 'القرآن' : 'Quran'}</option>
                <option value="tajweed">{isRTL ? 'التجويد' : 'Tajweed'}</option>
                <option value="arabic">{isRTL ? 'العربية' : 'Arabic'}</option>
                <option value="islamic">{isRTL ? 'تربية ومعرفة' : 'Learning'}</option>
                <option value="ijazah">{isRTL ? 'الإجازة' : 'Ijazah'}</option>
              </select>
            </div>
          </section>

          <section className="wn-public-section">
            {loading ? (
              <div className="wn-blog-grid" role="status" aria-live="polite">
                <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل المقالات...' : 'Loading articles...')}</span>
                {Array.from({ length: 6 }, (_, idx) => <BlogCardSkeleton key={idx} />)}
              </div>
            ) : fetchError ? (
              <div className="wn-public-empty" role="alert">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{isRTL ? 'تعذر تحميل المقالات' : 'Unable to load articles'}</h3>
                <p>{fetchError}</p>
                <button type="button" onClick={loadPosts} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
                </button>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="wn-public-empty">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{isRTL ? 'لا توجد مقالات منشورة مطابقة الآن' : 'No matching published articles yet'}</h3>
                <p>{isRTL ? 'ستظهر هنا المقالات فور نشرها من لوحة المحتوى.' : 'Articles will appear here when they are published from the content system.'}</p>
              </div>
            ) : (
              <div className="wn-blog-grid">
                {filteredArticles.map((article) => (
                  <motion.article key={article.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="wn-blog-card">
                    <div className="wn-blog-card__visual">
                      <BookOpen size={42} strokeWidth={1.3} aria-hidden="true" />
                    </div>
                    <div className="wn-blog-card__body">
                      <h3>{article.title}</h3>
                      {article.excerpt ? <p className="line-clamp-3">{article.excerpt}</p> : null}
                      <div className="wn-blog-meta">
                        {article.date ? <span><Calendar size={13} aria-hidden="true" /> {new Date(article.date).toLocaleDateString(isRTL ? 'ar-EG' : locale)}</span> : null}
                        {article.readTime ? <span><Clock size={13} aria-hidden="true" /> {article.readTime} {isRTL ? 'دقيقة' : 'min'}</span> : null}
                      </div>
                      <Link
                        to={localizedPath('/blog/' + article.slug, locale)}
                        className="min-h-[44px] inline-flex items-center gap-1 mt-2 text-xs font-bold text-[var(--wn-link)] hover:underline"
                      >
                        {isRTL ? 'قراءة المقال' : 'Read article'} <ChevronIcon size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
