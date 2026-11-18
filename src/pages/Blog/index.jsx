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

const BLOG_COPY = {
  ar: {
    home: 'الرئيسية',
    pageTitle: 'مكتبة المقالات',
    pageDesc: 'مقالات منشورة من أكاديمية وحي ونماء حول تعلم القرآن واللغة العربية.',
    eyebrow: 'مكتبة وحي ونماء',
    heroTitle: 'اقرأ ما يساعدك على التعلّم بثبات',
    heroSubtitle: 'المقالات المنشورة من فريق الأكاديمية تظهر هنا مباشرة من نظام المحتوى.',
    searchAria: 'ابحث في المقالات',
    searchPlaceholder: 'ابحث في المقالات...',
    catAria: 'تصنيف المقالات',
    catAll: 'كل التصنيفات',
    catQuran: 'القرآن',
    catTajweed: 'التجويد',
    catArabic: 'العربية',
    catIslamic: 'تربية ومعرفة',
    catIjazah: 'الإجازة',
    loading: 'جاري تحميل المقالات...',
    errLoad: 'تعذر تحميل المقالات الآن.',
    errTitle: 'تعذر تحميل المقالات',
    retry: 'إعادة المحاولة',
    emptyTitle: 'لا توجد مقالات منشورة مطابقة الآن',
    emptyDesc: 'ستظهر هنا المقالات فور نشرها من لوحة المحتوى.',
    minUnit: 'دقيقة',
    readArticle: 'قراءة المقال',
  },
  en: {
    home: 'Home',
    pageTitle: 'Articles',
    pageDesc: 'Published articles from Wahy Wa Namaa about Quran and Arabic learning.',
    eyebrow: 'WAHY WA NAMAA LIBRARY',
    heroTitle: 'Read what helps you learn with consistency',
    heroSubtitle: 'Published academy articles appear here directly from the content system.',
    searchAria: 'Search articles',
    searchPlaceholder: 'Search articles...',
    catAria: 'Article category',
    catAll: 'All categories',
    catQuran: 'Quran',
    catTajweed: 'Tajweed',
    catArabic: 'Arabic',
    catIslamic: 'Learning',
    catIjazah: 'Ijazah',
    loading: 'Loading articles...',
    errLoad: 'Could not load articles right now.',
    errTitle: 'Unable to load articles',
    retry: 'Retry',
    emptyTitle: 'No matching published articles yet',
    emptyDesc: 'Articles will appear here when they are published from the content system.',
    minUnit: 'min',
    readArticle: 'Read article',
  },
  fr: {
    home: 'Accueil',
    pageTitle: 'Articles',
    pageDesc: 'Articles publiés par Wahy Wa Namaa sur l’apprentissage du Coran et de l’arabe.',
    eyebrow: 'BIBLIOTHÈQUE WAHY WA NAMAA',
    heroTitle: 'Lisez ce qui vous aide à apprendre avec constance',
    heroSubtitle: 'Les articles publiés par l’académie apparaissent ici directement.',
    searchAria: 'Rechercher des articles',
    searchPlaceholder: 'Rechercher des articles...',
    catAria: 'Catégorie d’articles',
    catAll: 'Toutes les catégories',
    catQuran: 'Coran',
    catTajweed: 'Tajweed',
    catArabic: 'Arabe',
    catIslamic: 'Éducation & savoir',
    catIjazah: 'Ijazah',
    loading: 'Chargement des articles...',
    errLoad: 'Impossible de charger les articles pour le moment.',
    errTitle: 'Impossible de charger les articles',
    retry: 'Réessayer',
    emptyTitle: 'Aucun article publié correspondant pour le moment',
    emptyDesc: 'Les articles apparaîtront ici dès leur publication.',
    minUnit: 'min',
    readArticle: 'Lire l’article',
  },
  de: {
    home: 'Startseite',
    pageTitle: 'Artikel',
    pageDesc: 'Veröffentlichte Beiträge von Wahy Wa Namaa rund um Koran- und Arabischlernen.',
    eyebrow: 'WAHY WA NAMAA BIBLIOTHEK',
    heroTitle: 'Lesen Sie, was Ihnen beständig weiterhilft',
    heroSubtitle: 'Veröffentlichte Akademie-Beiträge erscheinen hier direkt aus dem Redaktionssystem.',
    searchAria: 'Artikel durchsuchen',
    searchPlaceholder: 'Artikel durchsuchen...',
    catAria: 'Artikelkategorie',
    catAll: 'Alle Kategorien',
    catQuran: 'Koran',
    catTajweed: 'Tadschwid',
    catArabic: 'Arabisch',
    catIslamic: 'Wissen & Erziehung',
    catIjazah: 'Idschaza',
    loading: 'Artikel werden geladen...',
    errLoad: 'Artikel konnten derzeit nicht geladen werden.',
    errTitle: 'Artikel konnten nicht geladen werden',
    retry: 'Erneut versuchen',
    emptyTitle: 'Derzeit keine passenden veröffentlichten Artikel',
    emptyDesc: 'Neue Artikel erscheinen hier, sobald sie veröffentlicht werden.',
    minUnit: 'Min.',
    readArticle: 'Artikel lesen',
  },
  tr: {
    home: 'Ana Sayfa',
    pageTitle: 'Makaleler',
    pageDesc: 'Wahy Wa Namaa’dan Kur’an ve Arapça öğrenimine dair yayımlanmış yazılar.',
    eyebrow: 'WAHY WA NAMAA KÜTÜPHANESİ',
    heroTitle: 'İstikrarlı öğrenmenize yardımcı olacak yazılar',
    heroSubtitle: 'Akademi ekibinin yayımladığı makaleler doğrudan burada görünür.',
    searchAria: 'Makalelerde ara',
    searchPlaceholder: 'Makalelerde ara...',
    catAria: 'Makale kategorisi',
    catAll: 'Tüm kategoriler',
    catQuran: 'Kur’an',
    catTajweed: 'Tecvid',
    catArabic: 'Arapça',
    catIslamic: 'Eğitim ve Bilgi',
    catIjazah: 'İcazet',
    loading: 'Makaleler yükleniyor...',
    errLoad: 'Makaleler şu anda yüklenemedi.',
    errTitle: 'Makaleler yüklenemedi',
    retry: 'Tekrar dene',
    emptyTitle: 'Henüz eşleşen yayımlanmış makale yok',
    emptyDesc: 'Makaleler içerik sisteminden yayımlandığında burada yer alacaktır.',
    minUnit: 'dk',
    readArticle: 'Makaleyi oku',
  },
  ur: {
    home: 'ہوم',
    pageTitle: 'مضامین کی لائبریری',
    pageDesc: 'قرآن اور عربی سیکھنے کے بارے میں اکیڈمی وحی و نماء کے شائع شدہ مضامین۔',
    eyebrow: 'وحی و نماء لائبریری',
    heroTitle: 'وہ پڑھیں جو مستقل مزاجی سے سیکھنے میں مدد دے',
    heroSubtitle: 'اکیڈمی کی ٹیم کی جانب سے شائع کردہ مضامین براہِ راست یہاں دستیاب ہیں۔',
    searchAria: 'مضامین تلاش کریں',
    searchPlaceholder: 'مضامین تلاش کریں...',
    catAria: 'مضمون کا زمرہ',
    catAll: 'تمام زمرے',
    catQuran: 'قرآن',
    catTajweed: 'تجوید',
    catArabic: 'عربی',
    catIslamic: 'تربیت و علم',
    catIjazah: 'اجازت و سند',
    loading: 'مضامین لوڈ ہو رہے ہیں...',
    errLoad: 'اس وقت مضامین لوڈ نہیں ہو سکے۔',
    errTitle: 'مضامین لوڈ نہیں ہو سکے',
    retry: 'دوبارہ کوشش کریں',
    emptyTitle: 'ابھی کوئی مماثل شائع شدہ مضمون موجود نہیں',
    emptyDesc: 'مواد کے نظام سے شائع ہوتے ہی مضامین یہاں ظاہر ہوں گے۔',
    minUnit: 'منٹ',
    readArticle: 'مضمون پڑھیں',
  },
  id: {
    home: 'Beranda',
    pageTitle: 'Artikel',
    pageDesc: 'Artikel terbitan Wahy Wa Namaa tentang pembelajaran Al-Quran dan Bahasa Arab.',
    eyebrow: 'PUSTAKA WAHY WA NAMAA',
    heroTitle: 'Baca hal yang membantu Anda belajar secara konsisten',
    heroSubtitle: 'Artikel yang diterbitkan tim akademi tampil langsung di sini dari sistem konten.',
    searchAria: 'Cari artikel',
    searchPlaceholder: 'Cari artikel...',
    catAria: 'Kategori artikel',
    catAll: 'Semua kategori',
    catQuran: 'Al-Quran',
    catTajweed: 'Tajwid',
    catArabic: 'Bahasa Arab',
    catIslamic: 'Pembelajaran',
    catIjazah: 'Ijazah',
    loading: 'Memuat artikel...',
    errLoad: 'Tidak dapat memuat artikel saat ini.',
    errTitle: 'Gagal memuat artikel',
    retry: 'Coba lagi',
    emptyTitle: 'Belum ada artikel terbit yang cocok',
    emptyDesc: 'Artikel akan tampil di sini segera setelah diterbitkan.',
    minUnit: 'mnt',
    readArticle: 'Baca artikel',
  },
  ms: {
    home: 'Laman Utama',
    pageTitle: 'Artikel',
    pageDesc: 'Artikel terbitan Wahy Wa Namaa mengenai pembelajaran Al-Quran dan Bahasa Arab.',
    eyebrow: 'PUSTAKA WAHY WA NAMAA',
    heroTitle: 'Baca panduan yang membantu anda belajar secara konsisten',
    heroSubtitle: 'Artikel terbitan pasukan akademi dipaparkan terus di sini daripada sistem kandungan.',
    searchAria: 'Cari artikel',
    searchPlaceholder: 'Cari artikel...',
    catAria: 'Kategori artikel',
    catAll: 'Semua kategori',
    catQuran: 'Al-Quran',
    catTajweed: 'Tajwid',
    catArabic: 'Bahasa Arab',
    catIslamic: 'Ilmu & Tarbiah',
    catIjazah: 'Ijazah',
    loading: 'Memuatkan artikel...',
    errLoad: 'Tidak dapat memuatkan artikel buat masa ini.',
    errTitle: 'Tidak dapat memuatkan artikel',
    retry: 'Cuba lagi',
    emptyTitle: 'Tiada artikel diterbitkan yang sepadan buat masa ini',
    emptyDesc: 'Artikel akan dipaparkan di sini sebaik sahaja diterbitkan.',
    minUnit: 'min',
    readArticle: 'Baca artikel',
  },
  ku: {
    home: 'سەرەکی',
    pageTitle: 'کتێبخانەی بابەتەکان',
    pageDesc: 'بابەتە بڵاوکراوەکانی ئەکادیمیای وەحی و نەما دەربارەی فێربوونی قورئان و زمانی عەرەبی.',
    eyebrow: 'کتێبخانەی وەحی و نەما',
    heroTitle: 'ئەوە بخوێنەرەوە کە یارمەتیت دەدات بە بەردەوامی فێربیت',
    heroSubtitle: 'بابەتە بڵاوکراوەکانی تیمی ئەکادیمیا ڕاستەوخۆ لێرە دەردەکەون.',
    searchAria: 'گەڕان لە بابەتەکاندا',
    searchPlaceholder: 'لە بابەتەکاندا بگەڕێ...',
    catAria: 'پۆلێنی بابەتەکان',
    catAll: 'هەموو پۆلەکان',
    catQuran: 'قورئان',
    catTajweed: 'تەجوید',
    catArabic: 'عەرەبی',
    catIslamic: 'پەروەردە و زانست',
    catIjazah: 'ئیجازە',
    loading: 'بابەتەکان باردەکرێن...',
    errLoad: 'لە ئێستادا بابەتەکان بارنەکران.',
    errTitle: 'بارکردنی بابەتەکان سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    emptyTitle: 'ئێستا هیچ بابەتێکی گونجاوی بڵاوکراوە نییە',
    emptyDesc: 'بابەتەکان هەر کە بڵاوکرانەوە لێرە دەردەکەون.',
    minUnit: 'خولەک',
    readArticle: 'خوێندنەوەی بابەت',
  },
};

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
  const copy = BLOG_COPY[locale] || BLOG_COPY.en;
  const intlLoc = INTL_LOCALE[locale] || 'en-US';
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
        setFetchError(err?.message || copy.errLoad);
      })
      .finally(() => setLoading(false));
  }, [locale, copy.errLoad]);

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

  const pageTitle = t.common?.blog || copy.pageTitle;
  const pageDescription = copy.pageDesc;

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
            { name: t.common?.home || copy.home, url: '/' },
            { name: pageTitle, url: '/blog' },
          ]),
        ],
      }} />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}</span>
              <h1>{copy.heroTitle}</h1>
              <p>{copy.heroSubtitle}</p>
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
                  aria-label={copy.searchAria}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                />
              </div>
              <select
                aria-label={copy.catAria}
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="wn-public-select md:w-52 min-h-[44px]"
              >
                <option value="all">{copy.catAll}</option>
                <option value="quran">{copy.catQuran}</option>
                <option value="tajweed">{copy.catTajweed}</option>
                <option value="arabic">{copy.catArabic}</option>
                <option value="islamic">{copy.catIslamic}</option>
                <option value="ijazah">{copy.catIjazah}</option>
              </select>
            </div>
          </section>

          <section className="wn-public-section">
            {loading ? (
              <div className="wn-blog-grid" role="status" aria-live="polite">
                <span className="sr-only">{t.common?.loading || copy.loading}</span>
                {Array.from({ length: 6 }, (_, idx) => <BlogCardSkeleton key={idx} />)}
              </div>
            ) : fetchError ? (
              <div className="wn-public-empty" role="alert">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{copy.errTitle}</h3>
                <p>{fetchError}</p>
                <button type="button" onClick={loadPosts} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{copy.retry}</span>
                </button>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="wn-public-empty">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{copy.emptyTitle}</h3>
                <p>{copy.emptyDesc}</p>
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
                        {article.date ? <span><Calendar size={13} aria-hidden="true" /> {new Date(article.date).toLocaleDateString(intlLoc)}</span> : null}
                        {article.readTime ? <span><Clock size={13} aria-hidden="true" /> {article.readTime} {copy.minUnit}</span> : null}
                      </div>
                      <Link
                        to={localizedPath('/blog/' + article.slug, locale)}
                        className="min-h-[44px] inline-flex items-center gap-1 mt-2 text-xs font-bold text-[var(--wn-link)] hover:underline"
                      >
                        {copy.readArticle} <ChevronIcon size={14} aria-hidden="true" />
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
