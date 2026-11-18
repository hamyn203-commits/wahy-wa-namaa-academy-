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

const COURSES_COPY = {
  ar: {
    home: 'الرئيسية',
    free: 'مجاني',
    viewCoursePrefix: 'عرض دورة ',
    catAll: 'كل البرامج',
    catQuran: 'القرآن والحفظ',
    catTajweed: 'التجويد',
    catArabic: 'اللغة العربية',
    catIjazah: 'الإجازة والسند',
    catAria: 'تصنيفات البرامج',
    errLoad: 'تعذر تحميل الدورات الآن.',
    eyebrow: 'برامج ومسارات وحي ونماء',
    heroTitle: 'اختر المسار الذي يخدم هدفك مع القرآن',
    heroSubtitle: 'من التأسيس والحفظ إلى التجويد والإجازة، استكشف البرامج المتاحة واختر ما يناسب مستواك ووقتك.',
    tracksEyebrow: 'المسارات المتدرجة',
    tracksTitle: 'تفضّل رحلة طويلة المدى بخطة واضحة؟',
    tracksDesc: 'استكشف مسارات الحفظ والمراجعة، الإجازة، وتأسيس الأطفال في صفحة واحدة منظمة.',
    tracksCta: 'استكشف المسارات',
    searchAria: 'ابحث باسم الدورة أو محتواها',
    searchPlaceholder: 'ابحث باسم الدورة أو محتواها...',
    filtersBtn: 'الفلاتر',
    levelAria: 'المستوى',
    allLevels: 'كل المستويات',
    categoryAria: 'الفئة',
    allCategories: 'كل الفئات',
    optQuran: 'القرآن',
    optTajweed: 'التجويد',
    optArabic: 'اللغة العربية',
    optIjazah: 'الإجازة',
    sortAria: 'ترتيب حسب',
    sortPopular: 'الأكثر التحاقًا',
    sortRating: 'الأعلى تقييمًا',
    sortPriceLow: 'السعر: الأقل أولًا',
    sortPriceHigh: 'السعر: الأعلى أولًا',
    availableEyebrow: 'الدورات المتاحة',
    availableCount: 'النتائج المتاحة حاليًا: ',
    loadingCourses: 'جاري تحميل الدورات...',
    errTitle: 'تعذر تحميل الدورات',
    retry: 'إعادة المحاولة',
    emptyTitle: 'لا توجد دورات مطابقة الآن',
    emptyDesc: 'غيّر الفلاتر أو ارجع لاحقًا عند نشر برامج جديدة.',
  },
  en: {
    home: 'Home',
    free: 'Free',
    viewCoursePrefix: 'View course ',
    catAll: 'All programs',
    catQuran: 'Quran & Hifz',
    catTajweed: 'Tajweed',
    catArabic: 'Arabic',
    catIjazah: 'Ijazah',
    catAria: 'Program categories',
    errLoad: 'Could not load courses right now.',
    eyebrow: 'WAHY WA NAMAA PROGRAMS',
    heroTitle: 'Choose the path that serves your Quran goal',
    heroSubtitle: 'From foundations and memorization to Tajweed and Ijazah, explore available programs and choose what fits your level and schedule.',
    tracksEyebrow: 'STRUCTURED TRACKS',
    tracksTitle: 'Prefer a long-term structured journey?',
    tracksDesc: 'Explore memorization and review, Ijazah, and children’s foundation tracks in one structured view.',
    tracksCta: 'Explore tracks',
    searchAria: 'Search by course name or content',
    searchPlaceholder: 'Search by course name or content...',
    filtersBtn: 'Filters',
    levelAria: 'Level',
    allLevels: 'All levels',
    categoryAria: 'Category',
    allCategories: 'All categories',
    optQuran: 'Quran',
    optTajweed: 'Tajweed',
    optArabic: 'Arabic',
    optIjazah: 'Ijazah',
    sortAria: 'Sort by',
    sortPopular: 'Most enrolled',
    sortRating: 'Highest rated',
    sortPriceLow: 'Price: low to high',
    sortPriceHigh: 'Price: high to low',
    availableEyebrow: 'AVAILABLE COURSES',
    availableCount: 'Currently available: ',
    loadingCourses: 'Loading courses...',
    errTitle: 'Unable to load courses',
    retry: 'Retry',
    emptyTitle: 'No matching courses right now',
    emptyDesc: 'Adjust the filters or return when new programs are published.',
  },
  fr: {
    home: 'Accueil',
    free: 'Gratuit',
    viewCoursePrefix: 'Voir le cours ',
    catAll: 'Tous les programmes',
    catQuran: 'Coran & Mémorisation',
    catTajweed: 'Tajweed',
    catArabic: 'Langue arabe',
    catIjazah: 'Ijazah',
    catAria: 'Catégories de programmes',
    errLoad: 'Impossible de charger les cours pour le moment.',
    eyebrow: 'PROGRAMMES WAHY WA NAMAA',
    heroTitle: 'Choisissez le parcours adapté à votre objectif coranique',
    heroSubtitle: 'Des bases et de la mémorisation au Tajweed et à l’Ijazah, explorez nos programmes selon votre niveau et votre emploi du temps.',
    tracksEyebrow: 'PARCOURS STRUCTURÉS',
    tracksTitle: 'Vous préférez un parcours guidé sur le long terme ?',
    tracksDesc: 'Découvrez nos parcours de mémorisation, d’Ijazah et d’initiation pour enfants dans une vue dédiée.',
    tracksCta: 'Explorer les parcours',
    searchAria: 'Rechercher par titre ou contenu du cours',
    searchPlaceholder: 'Rechercher par titre ou contenu...',
    filtersBtn: 'Filtres',
    levelAria: 'Niveau',
    allLevels: 'Tous les niveaux',
    categoryAria: 'Catégorie',
    allCategories: 'Toutes les catégories',
    optQuran: 'Coran',
    optTajweed: 'Tajweed',
    optArabic: 'Arabe',
    optIjazah: 'Ijazah',
    sortAria: 'Trier par',
    sortPopular: 'Les plus suivis',
    sortRating: 'Mieux notés',
    sortPriceLow: 'Prix : croissant',
    sortPriceHigh: 'Prix : décroissant',
    availableEyebrow: 'COURS DISPONIBLES',
    availableCount: 'Résultats disponibles : ',
    loadingCourses: 'Chargement des cours...',
    errTitle: 'Impossible de charger les cours',
    retry: 'Réessayer',
    emptyTitle: 'Aucun cours correspondant pour le moment',
    emptyDesc: 'Modifiez les filtres ou revenez lors de la publication de nouveaux programmes.',
  },
  de: {
    home: 'Startseite',
    free: 'Kostenlos',
    viewCoursePrefix: 'Kurs ansehen: ',
    catAll: 'Alle Programme',
    catQuran: 'Koran & Hifz',
    catTajweed: 'Tadschwid',
    catArabic: 'Arabisch',
    catIjazah: 'Idschaza',
    catAria: 'Programmkategorien',
    errLoad: 'Kurse konnten derzeit nicht geladen werden.',
    eyebrow: 'WAHY WA NAMAA PROGRAMME',
    heroTitle: 'Wählen Sie den Lernpfad für Ihr Koran-Ziel',
    heroSubtitle: 'Von den Grundlagen und dem Auswendiglernen bis zu Tadschwid und Idschaza — finden Sie das passende Programm für Ihr Niveau.',
    tracksEyebrow: 'STRUKTURIERTE PFADE',
    tracksTitle: 'Lieber eine langfristige, klar geplante Lernreise?',
    tracksDesc: 'Entdecken Sie strukturierte Pfade für Hifz, Idschaza und Kindergrundlagen an einem Ort.',
    tracksCta: 'Lernpfade entdecken',
    searchAria: 'Nach Kurstitel oder Inhalt suchen',
    searchPlaceholder: 'Nach Kurstitel oder Inhalt suchen...',
    filtersBtn: 'Filter',
    levelAria: 'Niveau',
    allLevels: 'Alle Niveaus',
    categoryAria: 'Kategorie',
    allCategories: 'Alle Kategorien',
    optQuran: 'Koran',
    optTajweed: 'Tadschwid',
    optArabic: 'Arabisch',
    optIjazah: 'Idschaza',
    sortAria: 'Sortieren nach',
    sortPopular: 'Beliebteste',
    sortRating: 'Beste Bewertung',
    sortPriceLow: 'Preis: aufsteigend',
    sortPriceHigh: 'Preis: absteigend',
    availableEyebrow: 'VERFÜGBARE KURSE',
    availableCount: 'Derzeit verfügbar: ',
    loadingCourses: 'Kurse werden geladen...',
    errTitle: 'Kurse konnten nicht geladen werden',
    retry: 'Erneut versuchen',
    emptyTitle: 'Derzeit keine passenden Kurse',
    emptyDesc: 'Passen Sie die Filter an oder schauen Sie später wieder vorbei.',
  },
  tr: {
    home: 'Ana Sayfa',
    free: 'Ücretsiz',
    viewCoursePrefix: 'Kursu görüntüle: ',
    catAll: 'Tüm programlar',
    catQuran: 'Kur’an ve Hıfz',
    catTajweed: 'Tecvid',
    catArabic: 'Arapça',
    catIjazah: 'İcazet',
    catAria: 'Program kategorileri',
    errLoad: 'Kurslar şu anda yüklenemedi.',
    eyebrow: 'WAHY WA NAMAA PROGRAMLARI',
    heroTitle: 'Kur’an hedefinize en uygun yolu seçin',
    heroSubtitle: 'Temel eğitim ve ezberden tecvid ve icazete kadar mevcut programları inceleyin ve seviyenize uygun olanı seçin.',
    tracksEyebrow: 'AŞAMALI YOLLAR',
    tracksTitle: 'Net bir planla uzun soluklu bir yolculuk mu tercih edersiniz?',
    tracksDesc: 'Ezber ve tekrar, icazet ve çocuk temel eğitim yollarını düzenli tek bir sayfada keşfedin.',
    tracksCta: 'Yolları keşfet',
    searchAria: 'Kurs adı veya içeriğine göre ara',
    searchPlaceholder: 'Kurs adı veya içeriğine göre ara...',
    filtersBtn: 'Filtreler',
    levelAria: 'Seviye',
    allLevels: 'Tüm seviyeler',
    categoryAria: 'Kategori',
    allCategories: 'Tüm kategoriler',
    optQuran: 'Kur’an',
    optTajweed: 'Tecvid',
    optArabic: 'Arapça',
    optIjazah: 'İcazet',
    sortAria: 'Sırala',
    sortPopular: 'En çok tercih edilen',
    sortRating: 'En yüksek puanlı',
    sortPriceLow: 'Fiyat: düşükten yükseğe',
    sortPriceHigh: 'Fiyat: yüksekten düşüğe',
    availableEyebrow: 'MEVCUT KURSLAR',
    availableCount: 'Şu anda mevcut: ',
    loadingCourses: 'Kurslar yükleniyor...',
    errTitle: 'Kurslar yüklenemedi',
    retry: 'Tekrar dene',
    emptyTitle: 'Şu anda eşleşen kurs bulunamadı',
    emptyDesc: 'Filtreleri değiştirin veya yeni programlar yayımlandığında tekrar kontrol edin.',
  },
  ur: {
    home: 'ہوم',
    free: 'مفت',
    viewCoursePrefix: 'کورس دیکھیں: ',
    catAll: 'تمام پروگرامز',
    catQuran: 'قرآن اور حفظ',
    catTajweed: 'تجوید',
    catArabic: 'عربی زبان',
    catIjazah: 'اجازت و سند',
    catAria: 'پروگرام کے زمرے',
    errLoad: 'اس وقت کورسز لوڈ نہیں ہو سکے۔',
    eyebrow: 'وحی و نماء کے پروگرامز',
    heroTitle: 'اپنے قرآنی ہدف کے مطابق بہترین راستہ منتخب کریں',
    heroSubtitle: 'بنیادی تعلیم اور حفظ سے لے کر تجوید اور اجازت تک، دستیاب پروگرامز دیکھیں اور اپنی سطح اور وقت کے مطابق انتخاب کریں۔',
    tracksEyebrow: 'منظم تعلیمی راستے',
    tracksTitle: 'کیا آپ واضح منصوبے کے ساتھ طویل المدتی سفر چاہتے ہیں؟',
    tracksDesc: 'حفظ و دہرائی، اجازت، اور بچوں کی بنیاد کے منظم راستے ایک ہی صفحے پر دیکھیں۔',
    tracksCta: 'تعلیمی راستے دیکھیں',
    searchAria: 'کورس کے نام یا مواد سے تلاش کریں',
    searchPlaceholder: 'کورس کے نام یا مواد سے تلاش کریں...',
    filtersBtn: 'فلٹرز',
    levelAria: 'سطح',
    allLevels: 'تمام سطحیں',
    categoryAria: 'زمرہ',
    allCategories: 'تمام زمرے',
    optQuran: 'قرآن',
    optTajweed: 'تجوید',
    optArabic: 'عربی',
    optIjazah: 'اجازت',
    sortAria: 'ترتیب',
    sortPopular: 'سب سے زیادہ مقبول',
    sortRating: 'بہترین درجہ بندی',
    sortPriceLow: 'فیس: کم سے زیادہ',
    sortPriceHigh: 'فیس: زیادہ سے کم',
    availableEyebrow: 'دستیاب کورسز',
    availableCount: 'اس وقت دستیاب نتائج: ',
    loadingCourses: 'کورسز لوڈ ہو رہے ہیں...',
    errTitle: 'کورسز لوڈ نہیں ہو سکے',
    retry: 'دوبارہ کوشش کریں',
    emptyTitle: 'اس وقت کوئی مماثل کورس دستیاب نہیں',
    emptyDesc: 'فلٹرز تبدیل کریں یا نئے پروگرام شائع ہونے پر دوبارہ تشریف لائیں۔',
  },
  id: {
    home: 'Beranda',
    free: 'Gratis',
    viewCoursePrefix: 'Lihat kursus ',
    catAll: 'Semua program',
    catQuran: 'Al-Quran & Tahfidz',
    catTajweed: 'Tajwid',
    catArabic: 'Bahasa Arab',
    catIjazah: 'Ijazah & Sanad',
    catAria: 'Kategori program',
    errLoad: 'Tidak dapat memuat kursus saat ini.',
    eyebrow: 'PROGRAM WAHY WA NAMAA',
    heroTitle: 'Pilih jalur yang sesuai dengan tujuan Al-Quran Anda',
    heroSubtitle: 'Dari dasar dan hafalan hingga tajwid dan ijazah, jelajahi program yang sesuai dengan level dan jadwal Anda.',
    tracksEyebrow: 'JALUR TERSTRUKTUR',
    tracksTitle: 'Lebih suka perjalanan jangka panjang dengan rencana yang jelas?',
    tracksDesc: 'Jelajahi jalur hafalan dan murojaah, ijazah, serta fondasi anak dalam satu tampilan terstruktur.',
    tracksCta: 'Jelajahi jalur belajar',
    searchAria: 'Cari berdasarkan nama atau isi kursus',
    searchPlaceholder: 'Cari berdasarkan nama atau isi kursus...',
    filtersBtn: 'Filter',
    levelAria: 'Tingkat',
    allLevels: 'Semua tingkat',
    categoryAria: 'Kategori',
    allCategories: 'Semua kategori',
    optQuran: 'Al-Quran',
    optTajweed: 'Tajwid',
    optArabic: 'Bahasa Arab',
    optIjazah: 'Ijazah',
    sortAria: 'Urutkan berdasarkan',
    sortPopular: 'Paling diminati',
    sortRating: 'Penilaian tertinggi',
    sortPriceLow: 'Harga: terendah ke tertinggi',
    sortPriceHigh: 'Harga: tertinggi ke terendah',
    availableEyebrow: 'KURSUS TERSEDIA',
    availableCount: 'Tersedia saat ini: ',
    loadingCourses: 'Memuat kursus...',
    errTitle: 'Gagal memuat kursus',
    retry: 'Coba lagi',
    emptyTitle: 'Belum ada kursus yang cocok saat ini',
    emptyDesc: 'Sesuaikan filter atau kunjungi kembali saat program baru dipublikasikan.',
  },
  ms: {
    home: 'Laman Utama',
    free: 'Percuma',
    viewCoursePrefix: 'Lihat kursus ',
    catAll: 'Semua program',
    catQuran: 'Al-Quran & Hafazan',
    catTajweed: 'Tajwid',
    catArabic: 'Bahasa Arab',
    catIjazah: 'Ijazah & Sanad',
    catAria: 'Kategori program',
    errLoad: 'Tidak dapat memuatkan kursus buat masa ini.',
    eyebrow: 'PROGRAM WAHY WA NAMAA',
    heroTitle: 'Pilih laluan yang menyokong matlamat Al-Quran anda',
    heroSubtitle: 'Daripada asas dan hafazan hingga tajwid dan ijazah, terokai program yang sesuai dengan tahap dan jadual anda.',
    tracksEyebrow: 'LALUAN BERSTRUKTUR',
    tracksTitle: 'Inginkan perjalanan jangka panjang dengan pelan yang jelas?',
    tracksDesc: 'Terokai laluan hafazan dan ulangan, ijazah, serta asas kanak-kanak dalam satu paparan tersusun.',
    tracksCta: 'Terokai laluan',
    searchAria: 'Cari mengikut nama atau kandungan kursus',
    searchPlaceholder: 'Cari mengikut nama atau kandungan kursus...',
    filtersBtn: 'Penapis',
    levelAria: 'Tahap',
    allLevels: 'Semua tahap',
    categoryAria: 'Kategori',
    allCategories: 'Semua kategori',
    optQuran: 'Al-Quran',
    optTajweed: 'Tajwid',
    optArabic: 'Bahasa Arab',
    optIjazah: 'Ijazah',
    sortAria: 'Susun mengikut',
    sortPopular: 'Paling ramai sertai',
    sortRating: 'Penilaian tertinggi',
    sortPriceLow: 'Harga: rendah ke tinggi',
    sortPriceHigh: 'Harga: tinggi ke rendah',
    availableEyebrow: 'KURSUS TERSEDIA',
    availableCount: 'Tersedia buat masa ini: ',
    loadingCourses: 'Memuatkan kursus...',
    errTitle: 'Tidak dapat memuatkan kursus',
    retry: 'Cuba lagi',
    emptyTitle: 'Tiada kursus yang sepadan buat masa ini',
    emptyDesc: 'Laraskan penapis atau kembali semula apabila program baharu diterbitkan.',
  },
  ku: {
    home: 'سەرەکی',
    free: 'بەخۆڕایی',
    viewCoursePrefix: 'بینینی خول ',
    catAll: 'هەموو بەرنامەکان',
    catQuran: 'قورئان و لەبەرکردن',
    catTajweed: 'تەجوید',
    catArabic: 'زمانی عەرەبی',
    catIjazah: 'ئیجازە و سەنەد',
    catAria: 'پۆلێنی بەرنامەکان',
    errLoad: 'لە ئێستادا خولەکان بارنەکران.',
    eyebrow: 'بەرنامە و ڕێڕەوەکانی وەحی و نەما',
    heroTitle: 'ئەو ڕێڕەوەی خزمەتی ئامانجەکەت لەگەڵ قورئاندا دەکات هەڵبژێرە',
    heroSubtitle: 'لە بنەڕەت و لەبەرکردنەوە بۆ تەجوید و ئیجازە، بەرنامە بەردەستەکان ببینە و ئەوەی لەگەڵ ئاست و کاتت دەگونجێت هەڵبژێرە.',
    tracksEyebrow: 'ڕێڕەوە پلەبەندەکان',
    tracksTitle: 'گەشتێکی درێژخایەن بە پلانێکی ڕوونت پێ باشترە؟',
    tracksDesc: 'ڕێڕەوەکانی لەبەرکردن و پێداچوونەوە، ئیجازە و بنەڕەتی منداڵان لە یەک پەڕەی ڕێکخراودا ببینە.',
    tracksCta: 'ڕێڕەوەکان ببینە',
    searchAria: 'گەڕان بە ناوی خول یان ناوەڕۆکەکەی',
    searchPlaceholder: 'گەڕان بە ناوی خول یان ناوەڕۆکەکەی...',
    filtersBtn: 'فلتەرەکان',
    levelAria: 'ئاست',
    allLevels: 'هەموو ئاستەکان',
    categoryAria: 'پۆل',
    allCategories: 'هەموو پۆلەکان',
    optQuran: 'قورئان',
    optTajweed: 'تەجوید',
    optArabic: 'زمانی عەرەبی',
    optIjazah: 'ئیجازە',
    sortAria: 'ڕیزکردن بەپێی',
    sortPopular: 'زۆرترین بەشداربوو',
    sortRating: 'بەرزترین هەڵسەنگاندن',
    sortPriceLow: 'نرخ: لە کەمەوە بۆ زۆر',
    sortPriceHigh: 'نرخ: لە زۆرەوە بۆ کەم',
    availableEyebrow: 'خولە بەردەستەکان',
    availableCount: 'ئەنجامە بەردەستەکان: ',
    loadingCourses: 'خولەکان باردەکرێن...',
    errTitle: 'بارکردنی خولەکان سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    emptyTitle: 'ئێستا هیچ خولێکی گونجاو نییە',
    emptyDesc: 'فلتەرەکان بگۆڕە یان دواتر بگەڕێوە کاتێک بەرنامەی نوێ بڵاودەکرێنەوە.',
  },
};

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

const CourseCard = memo(function CourseCard({ course, locale, isRTL, copy }) {
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
            {isFree ? (t.courses?.free || copy.free) : displayPrice(course.price, course.currency || 'USD')}
          </span>
          <Link
            to={localizedPath('/courses/' + (course.slug || course.id), locale)}
            className="wn-course-card__link min-h-[44px] min-w-[44px]"
            aria-label={copy.viewCoursePrefix + courseTitle}
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
  const copy = COURSES_COPY[locale] || COURSES_COPY.en;
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
    { id: 'all', label: copy.catAll },
    { id: 'quran', label: copy.catQuran },
    { id: 'tajweed', label: copy.catTajweed },
    { id: 'arabic', label: copy.catArabic },
    { id: 'ijazah', label: copy.catIjazah },
  ]), [copy]);

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
        setFetchError(err?.message || copy.errLoad);
      })
      .finally(() => setLoading(false));
  }, [copy.errLoad]);

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
            { name: t.common?.home || copy.home, url: '/' },
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
                {copy.eyebrow}
              </span>
              <h1>{copy.heroTitle}</h1>
              <p>{copy.heroSubtitle}</p>
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
                <span className="wn-auth-visual__eyebrow"><Award size={14} aria-hidden="true" /> {copy.tracksEyebrow}</span>
                <h2>{copy.tracksTitle}</h2>
                <p>{copy.tracksDesc}</p>
              </div>
              <Link to={localizedPath('/tracks', locale)} className="wn-btn wn-btn--accent min-h-[44px]">
                <span>{copy.tracksCta}</span>
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
                  aria-label={copy.searchAria}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
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
                  {copy.filtersBtn}
                  <ChevronDown size={15} className={showFilters ? 'rotate-180 transition' : 'transition'} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="wn-quick-filter-bar">
              <div className="wn-quick-spec-pills" role="group" aria-label={copy.catAria}>
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
                <select aria-label={copy.levelAria} value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="all">{copy.allLevels}</option>
                  <option value="beginner">{t.courses.beginner}</option>
                  <option value="intermediate">{t.courses.intermediate}</option>
                  <option value="advanced">{t.courses.advanced}</option>
                </select>

                <select aria-label={copy.categoryAria} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="all">{copy.allCategories}</option>
                  <option value="quran">{copy.optQuran}</option>
                  <option value="tajweed">{copy.optTajweed}</option>
                  <option value="arabic">{copy.optArabic}</option>
                  <option value="ijazah">{copy.optIjazah}</option>
                </select>

                <select aria-label={copy.sortAria} value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="popular">{copy.sortPopular}</option>
                  <option value="rating">{copy.sortRating}</option>
                  <option value="price-low">{copy.sortPriceLow}</option>
                  <option value="price-high">{copy.sortPriceHigh}</option>
                </select>
              </motion.div>
            )}
          </section>

          <section className="wn-public-section">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <span className="wn-public-eyebrow">{copy.availableEyebrow}</span>
                <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                  {copy.availableCount}{sortedCourses.length}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="wn-public-grid" role="status" aria-live="polite">
                <span className="sr-only">{t.common?.loading || copy.loadingCourses}</span>
                {Array.from({ length: 6 }, (_, idx) => <CourseCardSkeleton key={idx} />)}
              </div>
            ) : fetchError ? (
              <div className="wn-public-empty" role="alert">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{copy.errTitle}</h3>
                <p>{fetchError}</p>
                <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{copy.retry}</span>
                </button>
              </div>
            ) : sortedCourses.length === 0 ? (
              <div className="wn-public-empty">
                <BookOpen size={48} aria-hidden="true" />
                <h3>{copy.emptyTitle}</h3>
                <p>{copy.emptyDesc}</p>
              </div>
            ) : (
              <div className="wn-public-grid">
                {sortedCourses.map((course) => <CourseCard key={course.id} course={course} locale={locale} isRTL={isRTL} copy={copy} />)}
              </div>
            )}
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
