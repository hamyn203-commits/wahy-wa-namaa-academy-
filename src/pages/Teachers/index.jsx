import { teacherPublicImage, teacherImageFallback } from '../../lib/teacherMedia';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Star,
  MapPin,
  Clock,
  Award,
  BookOpen,
  Users,
  ChevronDown,
  Sparkles,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Globe,
  X,
} from 'lucide-react';
import { v4Markets } from '../../data/v4Data';
import { useMarket } from '../../context/MarketProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import '../../styles/public-experience.css';

function TeacherCardSkeleton() {
  return (
    <div className="wn-teacher-card" aria-hidden="true">
      <div className="wn-teacher-card__media"><Skeleton className="h-full w-full" /></div>
      <div className="wn-teacher-card__body">
        <Skeleton className="mb-3 h-5 w-2/3" />
        <Skeleton className="mb-4 h-3.5 w-1/3" />
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

export default function Teachers() {
  const [searchParams] = useSearchParams();
  const { displayPrice } = useMarket();
  const { locale } = useI18n();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [filters, setFilters] = useState({
    market: searchParams.get('market') || '',
    country: '',
    gender: searchParams.get('gender') || '',
    specialization: searchParams.get('specialization') || '',
    language: '',
    minRating: '',
    minExperience: ''
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadTeachers = async () => {
      try {
        const params = new URLSearchParams({
          page: pagination.page,
          limit: 12,
          sortBy,
          sortOrder: 'desc',
          ...filters
        });

        if (searchQuery) {
          params.append('search', searchQuery);
        }

        const response = await fetch(`/api/teachers?${params}`, { headers: { Accept: 'application/json' } });
        const data = await response.json();

        if (ignore) return;

        if (!response.ok) {
          setTeachers([]);
          return;
        }

        setTeachers(data.teachers || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total ?? 0,
          pages: data.pagination?.pages ?? 0,
        }));
      } catch (error) {
        if (!ignore) {
          console.error('Error fetching teachers:', error);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadTeachers();
    return () => {
      ignore = true;
    };
  }, [filters, pagination.page, sortBy, searchQuery]);

  const handleFilterChange = (key, value) => {
    setLoading(true);
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setLoading(true);
    setFilters({
      market: '',
      country: '',
      gender: '',
      specialization: '',
      language: '',
      minRating: '',
      minExperience: ''
    });
    setSearchQuery('');
    setSortBy('rating');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const labels = {
    id: {
      title: 'Guru Bersertifikat Elite',
      subtitle: 'Pilih guru Anda dari kumpulan instruktur bersertifikat dan terakreditasi kami',
      searchPlaceholder: 'Cari guru berdasarkan nama atau spesialisasi...',
      advancedFilters: 'Filter Lanjutan',
      sortBy: 'Urutkan berdasarkan',
      ratingHigh: 'Penilaian Tertinggi',
      expHigh: 'Paling Berpengalaman',
      studentsHigh: 'Siswa Terbanyak',
      newest: 'Terbaru',
      clearFilters: 'Hapus Filter',
      allMarkets: 'Semua Pasar',
      allCountries: 'Semua Negara',
      gender: 'Jenis Kelamin',
      male: 'Laki-laki',
      female: 'Perempuan',
      specialization: 'Spesialisasi',
      allTracks: 'Semua Spesialisasi',
      allSections: 'Semua Bagian',
      menSection: 'Guru Pria',
      womenSection: 'Guru Wanita (Khusus)',
      children: 'Anak-anak',
      adults: 'Dewasa',
      women: 'Wanita',
      tajweed: 'Tajwid',
      ijaza: 'Ijazah',
      arabicLang: 'B. Arab',
      language: 'Bahasa',
      arabic: 'Arab',
      english: 'Inggris',
      french: 'Prancis',
      turkish: 'Turki',
      experience: 'Pengalaman',
      exp2: '2+ Tahun',
      exp5: '5+ Tahun',
      exp10: '10+ Tahun',
      hourlyRate: 'Tarif Per Jam',
      hour: 'jam',
      featured: '⭐ Guru Unggulan',
      verifiedBadge: 'Terverifikasi',
      ratingCount: 'penilaian',
      yearsExp: 'tahun pengalaman',
      ijazat: 'ijazah',
      memorized: 'Hafal',
      parts: 'juz',
      students: 'siswa',
      viewProfile: 'Lihat Profil & Jadwal',
      loading: 'Memuat data guru...',
      noTutors: 'Belum ada guru terdaftar',
      registerTeacher: 'Gabung Sebagai Guru',
      noTutorsMatched: 'Tidak ada guru yang cocok dengan pencarian Anda',
      tryChanging: 'Coba ubah filter atau gunakan kata kunci lain',
      showing: 'Menampilkan {count} dari {total} guru',
      previous: 'Sebelumnya',
      next: 'Berikutnya'
    },
    ar: {
      title: 'المعلمون المتاحون',
      subtitle: 'استعرض ملفات المعلمين والمعلمات المعتمدين واختر الأنسب لهدفك ومستواك مع إمكانية حجز حصة تجريبية مجانية مباشرة',
      searchPlaceholder: 'ابحث عن معلم بالاسم أو التخصص...',
      advancedFilters: 'الفلاتر المتقدمة',
      sortBy: 'ترتيب حسب',
      ratingHigh: 'الأعلى تقييماً',
      expHigh: 'الأكثر خبرة',
      studentsHigh: 'الأكثر طلاباً',
      newest: 'الأحدث',
      clearFilters: 'مسح الفلاتر',
      allMarkets: 'كل الأسواق',
      allCountries: 'كل الدول',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      specialization: 'التخصص',
      allTracks: 'كل التخصصات',
      allSections: 'الكل',
      menSection: 'معلمون — رجال وأطفال',
      womenSection: 'معلمات — قسم السيدات',
      children: 'تأسيس الأطفال',
      adults: 'تعليم الكبار',
      women: 'قسم النساء',
      tajweed: 'أحكام التجويد',
      ijaza: 'الإجازة بالسند',
      arabicLang: 'اللغة العربية',
      language: 'اللغة',
      arabic: 'العربية',
      english: 'الإنجليزية',
      french: 'الفرنسية',
      turkish: 'التركية',
      experience: 'الخبرة',
      exp2: '2+ سنوات',
      exp5: '5+ سنوات',
      exp10: '10+ سنوات',
      hourlyRate: 'سعر الساعة',
      hour: 'ساعة',
      featured: '⭐ معلم مميز',
      verifiedBadge: 'مجاز ومعتمد',
      ratingCount: 'تقييم',
      yearsExp: 'سنوات خبرة',
      ijazat: 'إجازات',
      memorized: 'حفظ',
      parts: 'جزء',
      students: 'طالب',
      viewProfile: 'عرض الملف وحجز الموعد',
      loading: 'جاري تحميل المعلمين...',
      noTutors: 'لا يوجد معلمون مسجلون بعد',
      registerTeacher: 'انضم كمعلم',
      noTutorsMatched: 'لا يوجد معلمون مطابقون للبحث',
      tryChanging: 'جرب تغيير الفلاتر أو البحث بكلمات أخرى',
      showing: 'عرض {count} من {total} معلم',
      previous: 'السابق',
      next: 'التالي'
    },
    en: {
      title: 'Certified Tutors',
      subtitle: 'Choose the right tutor from our certified instructors and book your free 1-on-1 evaluation session directly',
      searchPlaceholder: 'Search for tutor by name or specialization...',
      advancedFilters: 'Advanced Filters',
      sortBy: 'Sort By',
      ratingHigh: 'Highest Rated',
      expHigh: 'Most Experienced',
      studentsHigh: 'Most Students',
      newest: 'Newest',
      clearFilters: 'Clear Filters',
      allMarkets: 'All Markets',
      allCountries: 'All Countries',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      specialization: 'Specialization',
      allTracks: 'All Tracks',
      allSections: 'All Tutors',
      menSection: 'Male Tutors',
      womenSection: 'Female Tutors (Sisters)',
      children: 'Children',
      adults: 'Adults',
      women: 'Women',
      tajweed: 'Tajweed',
      ijaza: 'Ijaza',
      arabicLang: 'Arabic Language',
      language: 'Language',
      arabic: 'Arabic',
      english: 'English',
      french: 'French',
      turkish: 'Turkish',
      experience: 'Experience',
      exp2: '2+ Years',
      exp5: '5+ Years',
      exp10: '10+ Years',
      hourlyRate: 'Hourly Rate',
      hour: 'hr',
      featured: '⭐ Featured Tutor',
      verifiedBadge: 'Certified',
      ratingCount: 'rating',
      yearsExp: 'years experience',
      ijazat: 'ijazas',
      memorized: 'Memorized',
      parts: 'parts',
      students: 'students',
      viewProfile: 'View Profile & Book',
      loading: 'Loading tutors...',
      noTutors: 'No registered tutors found',
      registerTeacher: 'Join as a Tutor',
      noTutorsMatched: 'No tutors match your search criteria',
      tryChanging: 'Try changing the filters or searching for other keywords',
      showing: 'Showing {count} of {total} tutors',
      previous: 'Previous',
      next: 'Next'
    }
  };

  const active = labels[locale] || labels.en;

  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const lp = (path) => localizedPath(path, locale);

  const specLabel = (spec) => {
    const map = {
      children: active.children,
      adults: active.adults,
      women: active.women,
      tajweed: active.tajweed,
      ijaza: active.ijaza,
      'arabic-language': active.arabicLang,
    };
    return map[spec] || spec;
  };

  const langLabel = (lang) => {
    const map = {
      arabic: active.arabic,
      english: active.english,
      french: active.french,
      turkish: active.turkish,
    };
    return map[String(lang).toLowerCase()] || lang;
  };

  const quickSpecializations = [
    { id: '', label: active.allTracks },
    { id: 'children', label: active.children },
    { id: 'tajweed', label: active.tajweed },
    { id: 'ijaza', label: active.ijaza },
    { id: 'adults', label: active.adults },
    { id: 'arabic-language', label: active.arabicLang },
    { id: 'women', label: active.women },
  ];

  const activeFilterEntries = Object.entries(filters).filter(([, value]) => Boolean(value));
  const activeFilterCount = activeFilterEntries.length + (searchQuery ? 1 : 0);

  const filterChipLabel = (key, value) => {
    if (key === 'gender') return value === 'female' ? active.womenSection : active.menSection;
    if (key === 'specialization') return specLabel(value);
    if (key === 'language') return langLabel(value);
    if (key === 'minRating') return `${value}+ ★`;
    if (key === 'minExperience') return `${value}+ ${active.yearsExp}`;
    return value;
  };

  return (
    <>
      <SEOHead page={{
        title: active.title,
        description: active.subtitle,
        url: '/teachers',
        type: 'website',
      }} />
      <GlobalHeader />

      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} />
                {isAr ? 'اختر معلمك' : locale === 'id' ? 'PILIH GURU ANDA' : 'CHOOSE YOUR TEACHER'}
              </span>
              <h1>{active.title}</h1>
              <p>{active.subtitle}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core"><GraduationCap size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <div className="page-container">
          <section className="wn-public-filter-panel">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
              <div className="wn-public-search">
                <Search size={18} />
                <input
                  type="search"
                  placeholder={active.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="wn-public-filter-actions">
                <button type="button" onClick={() => setShowFilters((open) => !open)} className="wn-public-filter-button">
                  <Filter size={17} />
                  {active.advancedFilters}
                  {activeFilterCount > 0 ? (
                    <span className="wn-filter-badge">{activeFilterCount}</span>
                  ) : null}
                  <ChevronDown size={15} className={showFilters ? 'rotate-180 transition' : 'transition'} />
                </button>

                <select
                  value={sortBy}
                  onChange={(event) => {
                    setLoading(true);
                    setSortBy(event.target.value);
                  }}
                  className="wn-public-select"
                  aria-label={active.sortBy}
                >
                  <option value="rating">{active.ratingHigh}</option>
                  <option value="experience">{active.expHigh}</option>
                  <option value="students">{active.studentsHigh}</option>
                  <option value="newest">{active.newest}</option>
                </select>

                {activeFilterCount > 0 ? (
                  <button type="button" onClick={clearFilters} className="text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald-dark)]">
                    {active.clearFilters}
                  </button>
                ) : null}
              </div>
            </form>

            {/* Quick Section & Specialization Pills */}
            <div className="wn-quick-filter-bar" role="region" aria-label={active.specialization}>
              <div className="wn-quick-gender-switch" role="group" aria-label={active.gender}>
                <button
                  type="button"
                  onClick={() => handleFilterChange('gender', '')}
                  className={filters.gender === '' ? 'wn-quick-pill is-active' : 'wn-quick-pill'}
                >
                  {active.allSections}
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('gender', 'male')}
                  className={filters.gender === 'male' ? 'wn-quick-pill is-active' : 'wn-quick-pill'}
                >
                  {active.menSection}
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('gender', 'female')}
                  className={filters.gender === 'female' ? 'wn-quick-pill is-active' : 'wn-quick-pill'}
                >
                  {active.womenSection}
                </button>
              </div>

              <div className="wn-quick-spec-pills" role="group" aria-label={active.specialization}>
                {quickSpecializations.map((item) => (
                  <button
                    key={item.id || 'all'}
                    type="button"
                    onClick={() => handleFilterChange('specialization', item.id)}
                    className={filters.specialization === item.id ? 'wn-quick-spec-pill is-active' : 'wn-quick-spec-pill'}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterEntries.length > 0 ? (
              <div className="wn-active-filter-chips">
                {activeFilterEntries.map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFilterChange(key, '')}
                    className="wn-active-filter-chip"
                  >
                    <span>{filterChipLabel(key, value)}</span>
                    <X size={13} />
                  </button>
                ))}
              </div>
            ) : null}

            {showFilters && (
              <div className="wn-public-expanded-filters">
                <select value={filters.market} onChange={(event) => handleFilterChange('market', event.target.value)} className="wn-public-select">
                  <option value="">{active.allMarkets}</option>
                  {v4Markets.map((market) => <option key={market.slug} value={market.slug}>{market.region}</option>)}
                </select>

                <select value={filters.country} onChange={(event) => handleFilterChange('country', event.target.value)} className="wn-public-select">
                  <option value="">{active.allCountries}</option>
                  <option value="مصر">{locale === 'id' ? 'Mesir' : isAr ? 'مصر' : 'Egypt'}</option>
                  <option value="السعودية">{locale === 'id' ? 'Arab Saudi' : isAr ? 'السعودية' : 'Saudi Arabia'}</option>
                  <option value="الأردن">{locale === 'id' ? 'Yordania' : isAr ? 'الأردن' : 'Jordan'}</option>
                  <option value="الإمارات">{locale === 'id' ? 'UEA' : isAr ? 'الإمارات' : 'UAE'}</option>
                </select>

                <select value={filters.gender} onChange={(event) => handleFilterChange('gender', event.target.value)} className="wn-public-select">
                  <option value="">{active.gender}</option>
                  <option value="male">{active.male}</option>
                  <option value="female">{active.female}</option>
                </select>

                <select value={filters.specialization} onChange={(event) => handleFilterChange('specialization', event.target.value)} className="wn-public-select">
                  <option value="">{active.specialization}</option>
                  <option value="children">{active.children}</option>
                  <option value="adults">{active.adults}</option>
                  <option value="women">{active.women}</option>
                  <option value="tajweed">{active.tajweed}</option>
                  <option value="ijaza">{active.ijaza}</option>
                  <option value="arabic-language">{active.arabicLang}</option>
                </select>

                <select value={filters.language} onChange={(event) => handleFilterChange('language', event.target.value)} className="wn-public-select">
                  <option value="">{active.language}</option>
                  <option value="arabic">{active.arabic}</option>
                  <option value="english">{active.english}</option>
                  <option value="french">{active.french}</option>
                  <option value="turkish">{active.turkish}</option>
                </select>

                <select value={filters.minRating} onChange={(event) => handleFilterChange('minRating', event.target.value)} className="wn-public-select">
                  <option value="">{isAr ? 'كل التقييمات' : locale === 'id' ? 'Semua Penilaian' : 'All ratings'}</option>
                  <option value="4">4+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>

                <select value={filters.minExperience} onChange={(event) => handleFilterChange('minExperience', event.target.value)} className="wn-public-select">
                  <option value="">{active.experience}</option>
                  <option value="2">{active.exp2}</option>
                  <option value="5">{active.exp5}</option>
                  <option value="10">{active.exp10}</option>
                </select>
              </div>
            )}
          </section>

          <section className="wn-public-section">
            {loading ? (
              <>
                <div className="wn-public-grid">
                  {Array.from({ length: 8 }, (_, index) => <TeacherCardSkeleton key={index} />)}
                </div>
                <p className="sr-only" role="status">{active.loading}</p>
              </>
            ) : teachers.length === 0 ? (
              <div className="wn-public-empty">
                <Users size={48} />
                <h3>{pagination.total === 0 ? active.noTutors : active.noTutorsMatched}</h3>
                <p>{pagination.total === 0 ? (isAr ? 'لا توجد ملفات معلمين منشورة حاليًا. يمكنك بدء التسجيل وسنتابع معك خطوات اختيار المسار.' : 'No tutor profiles are published right now. You can still begin enrollment.') : active.tryChanging}</p>
                {pagination.total === 0 ? (
                  <Link to={lp('/start')} className="wn-btn wn-btn--primary mt-4">
                    {isAr ? 'ابدأ معنا' : 'Get started'}
                  </Link>
                ) : (
                  <button type="button" onClick={clearFilters} className="wn-btn wn-btn--secondary mt-4">
                    {active.clearFilters}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="wn-public-eyebrow">{isAr ? 'المعلمون المتاحون' : locale === 'id' ? 'GURU TERSEDIA' : 'AVAILABLE TEACHERS'}</span>
                  <span className="text-xs text-[var(--wn-text-secondary)]">
                    {active.showing.replace('{count}', teachers.length).replace('{total}', pagination.total)}
                  </span>
                </div>

                <div className="wn-public-grid">
                  {teachers.map((teacher) => {
                    const ratingCount = Number(teacher.rating?.count || 0);
                    const ratingAverage = Number(teacher.rating?.average || 0);
                    const specializations = Array.isArray(teacher.quranInfo?.specializations) ? teacher.quranInfo.specializations.slice(0, 4) : [];
                    const languages = Array.isArray(teacher.languages || teacher.personalInfo?.languages) ? (teacher.languages || teacher.personalInfo?.languages).slice(0, 3) : [];
                    const price = teacher.hourlyRate;
                    const country = teacher.personalInfo?.country;
                    const experience = teacher.quranInfo?.teachingExperience;
                    const ijazat = teacher.quranInfo?.numberOfIjazat;
                    const parts = teacher.quranInfo?.memorizedParts;
                    const totalStudents = teacher.stats?.totalStudents;

                    return (
                      <Link key={teacher._id} to={lp('/teachers/' + teacher._id)} className="wn-teacher-card">
                        <div className="wn-teacher-card__media">
                          <img src={teacherPublicImage(teacher.media?.profilePhoto)} alt={teacher.user?.name || active.title} onError={teacherImageFallback} loading="lazy" decoding="async" />
                          {teacher.isFeatured ? (
                            <span className="wn-teacher-featured">{active.featured}</span>
                          ) : (
                            <span className="wn-teacher-verified">
                              <ShieldCheck size={12} /> {active.verifiedBadge}
                            </span>
                          )}
                          {price != null ? <span className="wn-teacher-price">{displayPrice(price, 'EGP')}/{active.hour}</span> : null}
                        </div>

                        <div className="wn-teacher-card__body">
                          <div className="flex items-start justify-between gap-2">
                            <h3>{teacher.user?.name || (isAr ? 'معلم قرآن' : 'Quran teacher')}</h3>
                            {ratingCount > 0 && ratingAverage > 0 ? (
                              <div className="wn-teacher-rating shrink-0">
                                <Star size={14} fill="currentColor" />
                                <strong>{ratingAverage.toFixed(1)}</strong>
                                <span>({ratingCount})</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="wn-teacher-details">
                            {country ? <span className="wn-teacher-detail"><MapPin size={14} /> {country}</span> : null}
                            {experience ? <span className="wn-teacher-detail"><Clock size={14} /> {experience} {active.yearsExp}</span> : null}
                            {ijazat ? <span className="wn-teacher-detail"><Award size={14} /> {ijazat} {active.ijazat}</span> : null}
                            {parts ? <span className="wn-teacher-detail"><BookOpen size={14} /> {active.memorized} {parts} {active.parts}</span> : null}
                            {totalStudents ? <span className="wn-teacher-detail"><Users size={14} /> {totalStudents} {active.students}</span> : null}
                            {languages.length > 0 ? (
                              <span className="wn-teacher-detail">
                                <Globe size={14} /> {languages.map(langLabel).join(' • ')}
                              </span>
                            ) : null}
                          </div>

                          {specializations.length > 0 ? (
                            <div className="wn-teacher-tags">
                              {specializations.map((spec) => <span key={spec}>{specLabel(spec)}</span>)}
                            </div>
                          ) : null}

                          <span className="wn-teacher-card__cta gap-1.5">
                            {active.viewProfile}
                            <ArrowIcon size={14} />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {pagination.pages > 1 ? (
                  <div className="flex justify-center flex-wrap gap-2 mt-8">
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }));
                      }}
                      disabled={pagination.page === 1}
                      className="wn-btn wn-btn--secondary wn-btn--sm disabled:opacity-40"
                    >
                      {active.previous}
                    </button>

                    {Array.from({ length: Math.min(pagination.pages, 5) }, (_, index) => {
                      const pageNum = index + 1;
                      return (
                        <button
                          type="button"
                          key={pageNum}
                          onClick={() => {
                            setLoading(true);
                            setPagination((current) => ({ ...current, page: pageNum }));
                          }}
                          className={pagination.page === pageNum ? 'wn-btn wn-btn--primary wn-btn--sm' : 'wn-btn wn-btn--secondary wn-btn--sm'}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        setPagination((current) => ({ ...current, page: Math.min(current.pages, current.page + 1) }));
                      }}
                      disabled={pagination.page === pagination.pages}
                      className="wn-btn wn-btn--secondary wn-btn--sm disabled:opacity-40"
                    >
                      {active.next}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
