import { memo, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
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

function localizedValue(value, locale) {
  if (typeof value === 'string') return value;
  return value?.[locale] || value?.ar || value?.en || '';
}

const CourseCard = memo(function CourseCard({ course, locale }) {
  const { t } = useI18n();
  const { displayPrice } = useMarket();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const levelLabels = {
    beginner: t.courses.beginner,
    intermediate: t.courses.intermediate,
    advanced: t.courses.advanced,
  };

  const hasRating = Number(course.reviews) > 0 && Number(course.rating) > 0;
  const isFree = Number(course.price) === 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="wn-course-card"
    >
      <div className="wn-course-card__visual">
        <BookOpen size={44} strokeWidth={1.35} />
        <span className="wn-course-level">{levelLabels[course.level] || course.level}</span>
      </div>

      <div className="wn-course-card__body">
        <h3>{localizedValue(course.title, locale)}</h3>
        <p>{localizedValue(course.description, locale)}</p>

        <div className="wn-course-meta">
          {course.duration ? <span><Clock size={14} /> {course.duration}</span> : null}
          {Number(course.students) > 0 ? <span><Users size={14} /> {course.students}</span> : null}
          {hasRating ? <span><Star size={14} /> {Number(course.rating).toFixed(1)} ({course.reviews})</span> : null}
        </div>

        <div className="wn-course-card__footer">
          <span className="wn-course-price">
            {isFree ? (isAr ? 'مجاني' : 'Free') : displayPrice(course.price, course.currency || 'USD')}
          </span>
          <Link
            to={localizedPath('/courses/' + (course.slug || course.id), locale)}
            className="wn-course-card__link"
            aria-label={(isAr ? 'عرض دورة ' : 'View course ') + localizedValue(course.title, locale)}
          >
            <ArrowIcon size={15} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
});

export default function Courses() {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);

  const quickCategories = useMemo(() => ([
    { id: 'all', label: isAr ? 'كل البرامج' : 'All programs' },
    { id: 'quran', label: isAr ? 'القرآن والحفظ' : 'Quran & Hifz' },
    { id: 'tajweed', label: isAr ? 'التجويد' : 'Tajweed' },
    { id: 'arabic', label: isAr ? 'اللغة العربية' : 'Arabic' },
    { id: 'ijazah', label: isAr ? 'الإجازة والسند' : 'Ijazah' },
  ]), [isAr]);

  useEffect(() => {
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
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = courses.filter((course) => {
      const title = localizedValue(course.title, locale).toLowerCase();
      const description = localizedValue(course.description, locale).toLowerCase();
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
  }, [courses, locale, searchQuery, selectedCategory, selectedLevel, sortBy]);

  return (
    <>
      <SEOHead page={{
        title: t.courses.title,
        description: t.courses.subtitle,
        url: '/courses',
        keywords: 'quran courses, arabic courses, tajweed, islamic studies, online learning',
        type: 'website',
      }} />

      <GlobalHeader />

      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} />
                {isAr ? 'برامج ومسارات وحي ونماء' : 'WAHY WA NAMAA PROGRAMS'}
              </span>
              <h1>{isAr ? 'اختر المسار الذي يخدم هدفك مع القرآن' : 'Choose the path that serves your Quran goal'}</h1>
              <p>
                {isAr
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
                <span className="wn-auth-visual__eyebrow"><Award size={14} /> {isAr ? 'المسارات المتدرجة' : 'STRUCTURED TRACKS'}</span>
                <h2>{isAr ? 'تفضّل رحلة طويلة المدى بخطة واضحة؟' : 'Prefer a long-term structured journey?'}</h2>
                <p>
                  {isAr
                    ? 'استكشف مسارات الحفظ والمراجعة، الإجازة، وتأسيس الأطفال في صفحة واحدة منظمة.'
                    : 'Explore memorization and review, Ijazah, and children’s foundation tracks in one structured view.'}
                </p>
              </div>
              <Link to={localizedPath('/tracks', locale)} className="wn-btn wn-btn--accent">
                <span>{isAr ? 'استكشف المسارات' : 'Explore tracks'}</span>
                <ArrowIcon size={15} />
              </Link>
            </div>
          </section>

          <section className="wn-public-filter-panel">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="wn-public-search">
                <Search size={18} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isAr ? 'ابحث باسم الدورة أو محتواها...' : 'Search by course name or content...'}
                />
              </div>

              <div className="wn-public-filter-actions">
                <button type="button" onClick={() => setShowFilters((open) => !open)} className="wn-public-filter-button">
                  <Filter size={17} />
                  {isAr ? 'الفلاتر' : 'Filters'}
                  <ChevronDown size={15} className={showFilters ? 'rotate-180 transition' : 'transition'} />
                </button>
              </div>
            </div>

            <div className="wn-quick-filter-bar">
              <div className="wn-quick-spec-pills" role="group" aria-label={isAr ? 'تصنيفات البرامج' : 'Program categories'}>
                {quickCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={selectedCategory === cat.id ? 'wn-quick-spec-pill is-active' : 'wn-quick-spec-pill'}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="wn-public-expanded-filters">
                <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="wn-public-select">
                  <option value="all">{isAr ? 'كل المستويات' : 'All levels'}</option>
                  <option value="beginner">{t.courses.beginner}</option>
                  <option value="intermediate">{t.courses.intermediate}</option>
                  <option value="advanced">{t.courses.advanced}</option>
                </select>

                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="wn-public-select">
                  <option value="all">{isAr ? 'كل الفئات' : 'All categories'}</option>
                  <option value="quran">{isAr ? 'القرآن' : 'Quran'}</option>
                  <option value="tajweed">{isAr ? 'التجويد' : 'Tajweed'}</option>
                  <option value="arabic">{isAr ? 'اللغة العربية' : 'Arabic'}</option>
                  <option value="ijazah">{isAr ? 'الإجازة' : 'Ijazah'}</option>
                </select>

                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="wn-public-select">
                  <option value="popular">{isAr ? 'الأكثر التحاقًا' : 'Most enrolled'}</option>
                  <option value="rating">{isAr ? 'الأعلى تقييمًا' : 'Highest rated'}</option>
                  <option value="price-low">{isAr ? 'السعر: الأقل أولًا' : 'Price: low to high'}</option>
                  <option value="price-high">{isAr ? 'السعر: الأعلى أولًا' : 'Price: high to low'}</option>
                </select>
              </motion.div>
            )}
          </section>

          <section className="wn-public-section">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <span className="wn-public-eyebrow">{isAr ? 'الدورات المتاحة' : 'AVAILABLE COURSES'}</span>
                <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                  {isAr ? 'النتائج المتاحة حاليًا: ' : 'Currently available: '}{sortedCourses.length}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="wn-public-grid" role="status" aria-live="polite">
                <span className="sr-only">{isAr ? 'جاري تحميل الدورات...' : 'Loading courses...'}</span>
                {Array.from({ length: 6 }, (_, idx) => <CourseCardSkeleton key={idx} />)}
              </div>
            ) : sortedCourses.length === 0 ? (
              <div className="wn-public-empty">
                <BookOpen size={48} />
                <h3>{isAr ? 'لا توجد دورات مطابقة الآن' : 'No matching courses right now'}</h3>
                <p>{isAr ? 'غيّر الفلاتر أو ارجع لاحقًا عند نشر برامج جديدة.' : 'Adjust the filters or return when new programs are published.'}</p>
              </div>
            ) : (
              <div className="wn-public-grid">
                {sortedCourses.map((course) => <CourseCard key={course.id} course={course} locale={locale} />)}
              </div>
            )}
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
