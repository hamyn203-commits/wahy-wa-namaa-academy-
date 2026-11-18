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

const INTL_LOCALE = {
  ar: 'ar-EG',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  tr: 'tr-TR',
  ur: 'ur-PK',
  id: 'id-ID',
  ms: 'ms-MY',
  ku: 'ku',
};

const BLOG_DETAIL_COPY = {
  ar: {
    home: 'الرئيسية',
    articles: 'المقالات',
    loading: 'جاري تحميل المقال...',
    errLoad: 'تعذر تحميل المقال الآن.',
    errTitle: 'تعذر تحميل المقال',
    retry: 'إعادة المحاولة',
    notFound: 'المقال غير موجود',
    backToArticles: 'العودة للمقالات',
    fallbackCategory: 'مقال',
    minUnit: 'دقيقة',
  },
  en: {
    home: 'Home',
    articles: 'Articles',
    loading: 'Loading article...',
    errLoad: 'Could not load article right now.',
    errTitle: 'Unable to load article',
    retry: 'Retry',
    notFound: 'Article not found',
    backToArticles: 'Back to articles',
    fallbackCategory: 'Article',
    minUnit: 'min',
  },
  fr: {
    home: 'Accueil',
    articles: 'Articles',
    loading: 'Chargement de l’article...',
    errLoad: 'Impossible de charger l’article pour le moment.',
    errTitle: 'Impossible de charger l’article',
    retry: 'Réessayer',
    notFound: 'Article introuvable',
    backToArticles: 'Retour aux articles',
    fallbackCategory: 'Article',
    minUnit: 'min',
  },
  de: {
    home: 'Startseite',
    articles: 'Artikel',
    loading: 'Artikel wird geladen...',
    errLoad: 'Artikel konnte derzeit nicht geladen werden.',
    errTitle: 'Artikel konnte nicht geladen werden',
    retry: 'Erneut versuchen',
    notFound: 'Artikel nicht gefunden',
    backToArticles: 'Zurück zu den Artikeln',
    fallbackCategory: 'Artikel',
    minUnit: 'Min.',
  },
  tr: {
    home: 'Ana Sayfa',
    articles: 'Makaleler',
    loading: 'Makale yükleniyor...',
    errLoad: 'Makale şu anda yüklenemedi.',
    errTitle: 'Makale yüklenemedi',
    retry: 'Tekrar dene',
    notFound: 'Makale bulunamadı',
    backToArticles: 'Makalelere dön',
    fallbackCategory: 'Makale',
    minUnit: 'dk',
  },
  ur: {
    home: 'ہوم',
    articles: 'مضامین',
    loading: 'مضمون لوڈ ہو رہا ہے...',
    errLoad: 'اس وقت مضمون لوڈ نہیں ہو سکا۔',
    errTitle: 'مضمون لوڈ نہیں ہو سکا',
    retry: 'دوبارہ کوشش کریں',
    notFound: 'مضمون دستیاب نہیں',
    backToArticles: 'مضامین پر واپس جائیں',
    fallbackCategory: 'مضمون',
    minUnit: 'منٹ',
  },
  id: {
    home: 'Beranda',
    articles: 'Artikel',
    loading: 'Memuat artikel...',
    errLoad: 'Tidak dapat memuat artikel saat ini.',
    errTitle: 'Gagal memuat artikel',
    retry: 'Coba lagi',
    notFound: 'Artikel tidak ditemukan',
    backToArticles: 'Kembali ke artikel',
    fallbackCategory: 'Artikel',
    minUnit: 'mnt',
  },
  ms: {
    home: 'Laman Utama',
    articles: 'Artikel',
    loading: 'Memuatkan artikel...',
    errLoad: 'Tidak dapat memuatkan artikel buat masa ini.',
    errTitle: 'Tidak dapat memuatkan artikel',
    retry: 'Cuba lagi',
    notFound: 'Artikel tidak ditemui',
    backToArticles: 'Kembali ke artikel',
    fallbackCategory: 'Artikel',
    minUnit: 'min',
  },
  ku: {
    home: 'سەرەکی',
    articles: 'بابەتەکان',
    loading: 'بابەت باردەکرێت...',
    errLoad: 'لە ئێستادا بابەتەکە بارنەکرا.',
    errTitle: 'بارکردنی بابەت سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    notFound: 'بابەتەکە نەدۆزرایەوە',
    backToArticles: 'گەڕانەوە بۆ بابەتەکان',
    fallbackCategory: 'بابەت',
    minUnit: 'خولەک',
  },
};

export default function BlogDetail() {
  const { slug } = useParams();
  const { locale, isRTL, dir, t } = useI18n();
  const { createArticleSchema, createBreadcrumbSchema } = useSEO();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const copy = BLOG_DETAIL_COPY[locale] || BLOG_DETAIL_COPY.en;
  const intlLoc = INTL_LOCALE[locale] || 'en-US';
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
          setFetchError(err?.message || copy.errLoad);
        }
      })
      .finally(() => setLoading(false));
  }, [slug, locale, copy.errLoad]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  if (loading) {
    return (
      <div className="wn-public-shell min-h-screen grid place-items-center" dir={dir} role="status" aria-live="polite">
        <span className="w-8 h-8 rounded-full border-2 border-[var(--wn-emerald)]/20 border-t-[var(--wn-emerald)] animate-spin" aria-hidden="true" />
        <span className="sr-only">{t.common?.loading || copy.loading}</span>
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
            <h3>{copy.errTitle}</h3>
            <p>{fetchError}</p>
            <button type="button" onClick={loadPost} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{copy.retry}</span>
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
            <h3>{copy.notFound}</h3>
            <LocalizedLink to="/blog" locale={locale} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              {copy.backToArticles}
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
    { name: t.common?.home || copy.home, url: '/' },
    { name: t.common?.blog || copy.articles, url: '/blog' },
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
            <span className="wn-public-eyebrow"><Tag size={13} aria-hidden="true" /> {post.category || copy.fallbackCategory}</span>
            <h1 className="mt-3">{post.title}</h1>
            <div className="wn-blog-meta mt-4">
              {post.createdAt ? <span><Calendar size={13} aria-hidden="true" /> {new Date(post.createdAt).toLocaleDateString(intlLoc)}</span> : null}
              {post.readTime ? <span><Clock size={13} aria-hidden="true" /> {post.readTime} {copy.minUnit}</span> : null}
            </div>

            {post.coverImage ? <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl mt-6 border border-[var(--wn-border)]" loading="lazy" /> : null}

            <div className="wn-article-body mt-7">{post.content || post.excerpt}</div>

            <LocalizedLink to="/blog" locale={locale} className="min-h-[44px] inline-flex items-center gap-2 mt-8 text-sm font-bold text-[var(--wn-link)] hover:underline">
              <BackArrow size={16} aria-hidden="true" /> {copy.backToArticles}
            </LocalizedLink>
          </motion.div>
        </article>
      </main>
      <GlobalFooter />
    </>
  );
}
