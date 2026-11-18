import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Clock,
  Users,
  Star,
  BookOpen,
  ChevronDown,
  Award,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Route,
  RefreshCw,
} from 'lucide-react';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import Skeleton from '../../components/shared/Skeleton';
import { useMarket } from '../../context/MarketProvider';
import api from '../../lib/api';
import '../../styles/public-experience.css';

function CourseCardSkeleton() {
  return (
    <div className="wn-course-card" aria-hidden="true">
      <div className="wn-course-card__visual">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="wn-course-card__body">
        <Skeleton className="mb-3 h-5 w-3/4" />
        <Skeleton className="mb-2 h-3.5 w-full" />
        <Skeleton className="mb-4 h-3.5 w-2/3" />
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="wn-course-card__footer">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function localizedValue(value, locale, isRTL) {
  if (typeof value === 'string') return value;
  return value?.[locale] || (isRTL ? (value?.ar || value?.en) : (value?.en || value?.ar)) || '';
}

const CourseCard = memo(function CourseCard({ course, locale, isRTL }) {
  const { t } = useI18n();
  const { displayPrice } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const levelLabels = {
    beginner: t.courses.beginner,
    intermediate: t.courses.intermediate,
    advanced: t.courses.advanced,
  };

  const hasRating = Number(course.reviews) > 0 && Number(course.rating) > 0;
  const isFree = Number(course.price) === 0;
  const courseTitle = localizedValue(course.title, locale, isRTL);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="wn-course-card"
    >
      <div className="wn-course-card__visual">
        <BookOpen size={44} strokeWidth={1.35} aria-hidden="true" />
        <span className="wn-course-level">{levelLabels[course.level] || course.level}</span>
      </div>

      <div className="wn-course-card__body">
        <h3>{courseTitle}</h3>
        <p>{localizedValue(course.description, locale, isRTL)}</p>

        <div className="wn-course-meta">
          {course.duration ? <span><Clock size={14} aria-hidden="true" /> {course.duration}</span> : null}
          {Number(course.students) > 0 ? <span><Users size={14} aria-hidden="true" /> {course.students}</span> : null}
          {hasRating ? <span><Star size={14} aria-hidden="true" /> {Number(course.rating).toFixed(1)} ({course.reviews})</span> : null}
        </div>

        <div className="wn-course-card__footer">
          <span className="wn-course-price">
            {isFree ? (t.courses?.free || (isRTL ? 'مجاني' : 'Free')) : displayPrice(course.price, course.currency || 'USD')}
          </span>
          <Link
            to={localizedPath('/courses/' + (course.slug || course.id), locale)}
            className="wn-course-card__link min-h-[44px] min-w-[44px]"
            aria-label={(isRTL ? 'عرض دورة ' : 'View course ') + courseTitle}
          >
            <ArrowIcon size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
});

export default function Courses() {
  const { t, locale, isRTL, dir } = useI18n();
  const { createCollectionSchema, createBreadcrumbSchema } = useSEO();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const requested = searchParams.get('track') || searchParams.get('category') || 'all';
    return ['all', 'quran', 'tajweed', 'arabic', 'ijazah'].includes(requested) ? requested : 'all';
  });
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);

  const quickCategories = useMemo(() => ([
    { id: 'all', label: isRTL ? 'كل البرامج' : 'All programs' },
    { id: 'quran', label: isRTL ? 'القرآن والحفظ' : 'Quran & Hifz' },
    { id: 'tajweed', label: isRTL ? 'التجويد' : 'Tajweed' },
    { id: 'arabic', label: isRTL ? 'اللغة العربية' : 'Arabic' },
    { id: 'ijazah', label: isRTL ? 'الإجازة والسند' : 'Ijazah' },
  ]), [isRTL]);

  const loadCourses = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/courses')
      .then((data) => {
        const source = Array.isArray(data?.courses) ? data.courses : [];
        setCourses(source.map((course) => ({
          id: course._id || course.slug,
          slug: course.slug,
          title: course.title,
          description: course.description,
          level: course.level || 'beginner',
          category: course.category || 'quran',
          price: course.price ?? 0,
          currency: course.currency || 'USD',
          duration: course.duration || (course.durationInHours ? course.durationInHours + 'h' : ''),
          students: course.stats?.enrolled || 0,
          rating: course.stats?.rating?.average || 0,
          reviews: course.stats?.rating?.count || 0,
        })));
      })
      .catch((err) => {
        setCourses([]);
        setFetchError(err?.message || (isRTL ? 'تعذر تحميل الدورات الآن.' : 'Could not load courses right now.'));
      })
      .finally(() => setLoading(false));
  }, [isRTL]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const sortedCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = courses.filter((course) => {
      const title = localizedValue(course.title, locale, isRTL).toLowerCase();
      const description = localizedValue(course.description, locale, isRTL).toLowerCase();
      const matchesSearch = !query || title.includes(query) || description.includes(query);
      const matchesLevel = selectedLevel === 'all' || course.level === selectedLevel;
      const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
      return matchesSearch && matchesLevel && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'popular') return b.students - a.students;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      return 0;
    });
  }, [courses, locale, isRTL, searchQuery, selectedCategory, selectedLevel, sortBy]);

  return (
    <>
      <SEOHead page={{
        title: t.courses.title,
        description: t.courses.subtitle,
        url: '/courses',
        keywords: 'quran courses, arabic courses, tajweed, islamic studies, online learning',
        type: 'website',
        schema: [
          createCollectionSchema({
            name: t.courses.title,
            description: t.courses.subtitle,
            url: '/courses',
            items: sortedCourses.slice(0, 12).map((course) => ({
              name: localizedValue(course.title, locale, isRTL),
              url: '/courses/' + (course.slug || course.id),
            })),
          }),
          createBreadcrumbSchema([
            { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
            { name: t.courses.title, url: '/courses' },
          ]),
        ],
      }} />

      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} aria-hidden="true" />
                {isRTL ? 'برامج ومسارات وحي ونماء' : 'WAHY WA NAMAA PROGRAMS'}
              </span>
              <h1>{isRTL ? 'اختر المسار الذي يخدم هدفك مع القرآن' : 'Choose the path that serves your Quran goal'}</h1>
              <p>
                {isRTL
                  ? 'من التأسيس والحفظ إلى التجويد والإجازة، استكشف البرامج المتاحة واختر ما يناسب مستواك ووقتك.'
                  : 'From foundations and memorization to Tajweed and Ijazah, explore available programs and choose what fits your level and schedule.'}
              </p>
            </div>

            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core"><Route size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <div className="page-container">
          <section className="wn-public-track-banner">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <span className="wn-auth-visual__eyebrow"><Award size={14} aria-hidden="true" /> {isRTL ? 'المسارات المتدرجة' : 'STRUCTURED TRACKS'}</span>
                <h2>{isRTL ? 'تفضّل رحلة طويلة المدى بخطة واضحة؟' : 'Prefer a long-term structured journey?'}</h2>
                <p>
                  {isRTL
                    ? 'استكشف مسارات الحفظ والمراجعة، الإجازة، وتأسيس الأطفال في صفحة واحدة منظمة.'
                    : 'Explore memorization and review, Ijazah, and children’s foundation tracks in one structured view.'}
                </p>
              </div>
              <Link to={localizedPath('/tracks', locale)} className="wn-btn wn-btn--accent min-h-[44px]">
                <span>{isRTL ? 'استكشف المسارات' : 'Explore tracks'}</span>
                <ArrowIcon size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="wn-public-filter-panel">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="wn-public-search">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  aria-label={isRTL ? 'ابحث باسم الدورة أو محتواها' : 'Search by course name or content'}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isRTL ? 'ابحث باسم الدورة أو محتواها...' : 'Search by course name or content...'}
                />
              </div>

              <div className="wn-public-filter-actions">
                <button
                  type="button"
                  aria-expanded={showFilters}
                  aria-controls="courses-expanded-filters"
                  onClick={() => setShowFilters((open) => !open)}
                  className="wn-public-filter-button min-h-[44px]"
                >
                  <Filter size={17} aria-hidden="true" />
                  {isRTL ? 'الفلاتر' : 'Filters'}
                  <ChevronDown size={15} className={showFilters ? 'rotate-180 transition' : 'transition'} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="wn-quick-filter-bar">
              <div className="wn-quick-spec-pills" role="group" aria-label={isRTL ? 'تصنيفات البرامج' : 'Program categories'}>
                {quickCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={selectedCategory === cat.id ? 'wn-quick-spec-pill is-active min-h-[44px]' : 'wn-quick-spec-pill min-h-[44px]'}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {showFilters && (
              <motion.div id="courses-expanded-filters" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="wn-public-expanded-filters">
                <select aria-label={isRTL ? 'المستوى' : 'Level'} value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="all">{isRTL ? 'كل المستويات' : 'All levels'}</option>
                  <option value="beginner">{t.courses.beginner}</option>
                  <option value="intermediate">{t.courses.intermediate}</option>
                  <option value="advanced">{t.courses.advanced}</option>
                </select>

                <select aria-label={isRTL ? 'الفئة' : 'Category'} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="all">{isRTL ? 'كل الفئات' : 'All categories'}</option>
                  <option value="quran">{isRTL ? 'القرآن' : 'Quran'}</option>
                  <option value="tajweed">{isRTL ? 'التجويد' : 'Tajweed'}</option>
                  <option value="arabic">{isRTL ? 'اللغة العربية' : 'Arabic'}</option>
                  <option value="ijazah">{isRTL ? 'الإجازة' : 'Ijazah'}</option>
                </select>

                <select aria-label={isRTL ? 'ترتيب حسب' : 'Sort by'} value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="popular">{isRTL ? 'الأكثر التحاقًا' : 'Most enrolled'}</option>
                  <option value="rating">{isRTL ? 'الأعلى تقييمًا' : 'Highest rated'}</option>
                  <option value="price-low">{isRTL ? 'السعر: الأقل أولًا' : 'Price: low to high'}</option>
                  <option value="price-high">{isRTL ? 'السعر: الأعلى أولًا' : 'Price: high to low'}</option>
                </select>
              </motion.div>
            )}
          </section>

          <section className="wn-public-section">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <span className="wn-public-eyebrow">{isRTL ? 'الدورات المتاحة' : 'AVAILABLE COURSES'}</span>
                <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                  {isRTL ? 'النتائج المتاحة حاليًا: ' : 'Currently available: '}{sortedCourses.length}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="wn-public-grid" role="status" aria-live="polite">
                <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل الدورات...' : 'Loading courses...')}</span>
                {Array.from({ length: 6 }, (_, idx) => <CourseCardSkeleton key={idx} />)}
              </div>
            ) : fetchError ? (
              <div className="wn-public-empty" role="alert">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{isRTL ? 'تعذر تحميل الدورات' : 'Unable to load courses'}</h3>
                <p>{fetchError}</p>
                <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
                </button>
              </div>
            ) : sortedCourses.length === 0 ? (
              <div className="wn-public-empty">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{isRTL ? 'لا توجد دورات مطابقة الآن' : 'No matching courses right now'}</h3>
                <p>{isRTL ? 'غيّر الفلاتر أو ارجع لاحقًا عند نشر برامج جديدة.' : 'Adjust the filters or return when new programs are published.'}</p>
              </div>
            ) : (
              <div className="wn-public-grid">
                {sortedCourses.map((course) => <CourseCard key={course.id} course={course} locale={locale} isRTL={isRTL} />)}
              </div>
            )}
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
