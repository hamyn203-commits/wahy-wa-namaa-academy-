import { teacherPublicImage } from '../../lib/teacherMedia';
import { prefetchTeacherBundle } from '../../lib/teacherProfileCache';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
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
  RefreshCw,
} from 'lucide-react';
import { v4Markets, getMarketRegion } from '../../data/v4Data';
import { useMarket } from '../../context/MarketProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import Skeleton from '../../components/shared/Skeleton';
import '../../styles/public-experience.css';

const TEACHERS_LABELS = {
  ar: {
    home: 'الرئيسية',
    eyebrow: 'اختر معلمك',
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
    countryEgypt: 'مصر',
    countrySaudi: 'السعودية',
    countryJordan: 'الأردن',
    countryUAE: 'الإمارات',
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
    minRatingAria: 'الحد الأدنى للتقييم',
    allRatings: 'كل التقييمات',
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
    errLoad: 'تعذر تحميل قائمة المعلمين.',
    errConn: 'تعذر الاتصال بالخادم.',
    errTitle: 'تعذر تحميل المعلمين',
    retry: 'إعادة المحاولة',
    noTutors: 'لا يوجد معلمون مسجلون بعد',
    noTutorsDesc: 'لا توجد ملفات معلمين منشورة حاليًا. يمكنك بدء التسجيل وسنتابع معك خطوات اختيار المسار.',
    getStarted: 'ابدأ معنا',
    availableHeading: 'المعلمون المتاحون',
    fallbackTeacherName: 'معلم قرآن',
    paginationAria: 'ترقيم الصفحات',
    registerTeacher: 'انضم كمعلم',
    noTutorsMatched: 'لا يوجد معلمون مطابقون للبحث',
    tryChanging: 'جرب تغيير الفلاتر أو البحث بكلمات أخرى',
    showing: 'عرض {count} من {total} معلم',
    previous: 'السابق',
    next: 'التالي',
  },
  en: {
    home: 'Home',
    eyebrow: 'CHOOSE YOUR TEACHER',
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
    countryEgypt: 'Egypt',
    countrySaudi: 'Saudi Arabia',
    countryJordan: 'Jordan',
    countryUAE: 'UAE',
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
    minRatingAria: 'Minimum rating',
    allRatings: 'All ratings',
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
    errLoad: 'Could not load tutors.',
    errConn: 'Could not reach the server.',
    errTitle: 'Unable to load tutors',
    retry: 'Retry',
    noTutors: 'No registered tutors found',
    noTutorsDesc: 'No tutor profiles are published right now. You can still begin enrollment.',
    getStarted: 'Get started',
    availableHeading: 'AVAILABLE TEACHERS',
    fallbackTeacherName: 'Quran teacher',
    paginationAria: 'Pagination',
    registerTeacher: 'Join as a Tutor',
    noTutorsMatched: 'No tutors match your search criteria',
    tryChanging: 'Try changing the filters or searching for other keywords',
    showing: 'Showing {count} of {total} tutors',
    previous: 'Previous',
    next: 'Next',
  },
  fr: {
    home: 'Accueil',
    eyebrow: 'CHOISISSEZ VOTRE ENSEIGNANT',
    title: 'Enseignants certifiés',
    subtitle: 'Parcourez les profils de nos enseignants et enseignantes certifiés et réservez directement votre séance d’évaluation gratuite',
    searchPlaceholder: 'Rechercher un enseignant par nom ou spécialité...',
    advancedFilters: 'Filtres avancés',
    sortBy: 'Trier par',
    ratingHigh: 'Mieux notés',
    expHigh: 'Plus expérimentés',
    studentsHigh: 'Plus d’élèves',
    newest: 'Plus récents',
    clearFilters: 'Réinitialiser',
    allMarkets: 'Tous les marchés',
    allCountries: 'Tous les pays',
    countryEgypt: 'Égypte',
    countrySaudi: 'Arabie saoudite',
    countryJordan: 'Jordanie',
    countryUAE: 'Émirats arabes unis',
    gender: 'Genre',
    male: 'Homme',
    female: 'Femme',
    specialization: 'Spécialité',
    allTracks: 'Toutes les spécialités',
    allSections: 'Tous',
    menSection: 'Enseignants — Hommes & enfants',
    womenSection: 'Enseignantes — Section femmes',
    children: 'Enfants',
    adults: 'Adultes',
    women: 'Femmes',
    tajweed: 'Tajweed',
    ijaza: 'Ijazah',
    arabicLang: 'Langue arabe',
    language: 'Langue',
    arabic: 'Arabe',
    english: 'Anglais',
    french: 'Français',
    turkish: 'Turc',
    minRatingAria: 'Note minimale',
    allRatings: 'Toutes les notes',
    experience: 'Expérience',
    exp2: '2+ ans',
    exp5: '5+ ans',
    exp10: '10+ ans',
    hourlyRate: 'Tarif horaire',
    hour: 'h',
    featured: '⭐ Enseignant vedette',
    verifiedBadge: 'Certifié',
    ratingCount: 'avis',
    yearsExp: 'ans d’expérience',
    ijazat: 'ijazas',
    memorized: 'Mémorisé',
    parts: 'juz',
    students: 'élèves',
    viewProfile: 'Voir le profil et réserver',
    loading: 'Chargement des enseignants...',
    errLoad: 'Impossible de charger la liste des enseignants.',
    errConn: 'Impossible de joindre le serveur.',
    errTitle: 'Impossible de charger les enseignants',
    retry: 'Réessayer',
    noTutors: 'Aucun enseignant inscrit pour le moment',
    noTutorsDesc: 'Aucun profil n’est publié pour l’instant. Vous pouvez tout de même démarrer votre inscription.',
    getStarted: 'Commencer',
    availableHeading: 'ENSEIGNANTS DISPONIBLES',
    fallbackTeacherName: 'Enseignant de Coran',
    paginationAria: 'Pagination',
    registerTeacher: 'Rejoindre comme enseignant',
    noTutorsMatched: 'Aucun enseignant ne correspond à votre recherche',
    tryChanging: 'Essayez de modifier les filtres ou vos mots-clés',
    showing: 'Affichage de {count} sur {total} enseignants',
    previous: 'Précédent',
    next: 'Suivant',
  },
  de: {
    home: 'Startseite',
    eyebrow: 'LEHRKRAFT WÄHLEN',
    title: 'Zertifizierte Lehrkräfte',
    subtitle: 'Entdecken Sie unsere zertifizierten Lehrerinnen und Lehrer und buchen Sie direkt Ihre kostenlose Probestunde',
    searchPlaceholder: 'Nach Name oder Fachgebiet suchen...',
    advancedFilters: 'Erweiterte Filter',
    sortBy: 'Sortieren nach',
    ratingHigh: 'Beste Bewertung',
    expHigh: 'Meiste Erfahrung',
    studentsHigh: 'Meiste Schüler',
    newest: 'Neueste',
    clearFilters: 'Filter zurücksetzen',
    allMarkets: 'Alle Märkte',
    allCountries: 'Alle Länder',
    countryEgypt: 'Ägypten',
    countrySaudi: 'Saudi-Arabien',
    countryJordan: 'Jordanien',
    countryUAE: 'VAE',
    gender: 'Geschlecht',
    male: 'Männlich',
    female: 'Weiblich',
    specialization: 'Fachgebiet',
    allTracks: 'Alle Fachgebiete',
    allSections: 'Alle',
    menSection: 'Lehrer — Männer & Kinder',
    womenSection: 'Lehrerinnen — Frauenbereich',
    children: 'Kinder',
    adults: 'Erwachsene',
    women: 'Frauen',
    tajweed: 'Tadschwid',
    ijaza: 'Idschaza',
    arabicLang: 'Arabische Sprache',
    language: 'Sprache',
    arabic: 'Arabisch',
    english: 'Englisch',
    french: 'Französisch',
    turkish: 'Türkisch',
    minRatingAria: 'Mindestbewertung',
    allRatings: 'Alle Bewertungen',
    experience: 'Erfahrung',
    exp2: '2+ Jahre',
    exp5: '5+ Jahre',
    exp10: '10+ Jahre',
    hourlyRate: 'Stundensatz',
    hour: 'Std.',
    featured: '⭐ Empfohlene Lehrkraft',
    verifiedBadge: 'Zertifiziert',
    ratingCount: 'Bewertung',
    yearsExp: 'Jahre Erfahrung',
    ijazat: 'Idschazas',
    memorized: 'Auswendig',
    parts: 'Dschuz',
    students: 'Schüler',
    viewProfile: 'Profil ansehen & buchen',
    loading: 'Lehrkräfte werden geladen...',
    errLoad: 'Lehrkräfte konnten nicht geladen werden.',
    errConn: 'Server konnte nicht erreicht werden.',
    errTitle: 'Lehrkräfte konnten nicht geladen werden',
    retry: 'Erneut versuchen',
    noTutors: 'Noch keine Lehrkräfte registriert',
    noTutorsDesc: 'Derzeit sind keine Profile veröffentlicht. Sie können dennoch mit Ihrer Anmeldung beginnen.',
    getStarted: 'Jetzt starten',
    availableHeading: 'VERFÜGBARE LEHRKRÄFTE',
    fallbackTeacherName: 'Koranlehrer',
    paginationAria: 'Seitennavigation',
    registerTeacher: 'Als Lehrkraft beitreten',
    noTutorsMatched: 'Keine passenden Lehrkräfte gefunden',
    tryChanging: 'Ändern Sie die Filter oder verwenden Sie andere Suchbegriffe',
    showing: '{count} von {total} Lehrkräften angezeigt',
    previous: 'Zurück',
    next: 'Weiter',
  },
  tr: {
    home: 'Ana Sayfa',
    eyebrow: 'ÖĞRETMENİNİZİ SEÇİN',
    title: 'Onaylı Öğretmenler',
    subtitle: 'Sertifikalı kadın ve erkek hocalarımızın profillerini inceleyin ve doğrudan ücretsiz deneme dersi planlayın',
    searchPlaceholder: 'İsim veya uzmanlık alanına göre ara...',
    advancedFilters: 'Gelişmiş Filtreler',
    sortBy: 'Sırala',
    ratingHigh: 'En Yüksek Puanlı',
    expHigh: 'En Deneyimli',
    studentsHigh: 'En Çok Öğrenci',
    newest: 'En Yeni',
    clearFilters: 'Filtreleri Temizle',
    allMarkets: 'Tüm Pazarlar',
    allCountries: 'Tüm Ülkeler',
    countryEgypt: 'Mısır',
    countrySaudi: 'Suudi Arabistan',
    countryJordan: 'Ürdün',
    countryUAE: 'BAE',
    gender: 'Cinsiyet',
    male: 'Erkek',
    female: 'Kadın',
    specialization: 'Uzmanlık',
    allTracks: 'Tüm Uzmanlıklar',
    allSections: 'Tümü',
    menSection: 'Erkek Öğretmenler',
    womenSection: 'Kadın Öğretmenler (Hanımlar)',
    children: 'Çocuklar',
    adults: 'Yetişkinler',
    women: 'Hanımlar',
    tajweed: 'Tecvid',
    ijaza: 'İcazet',
    arabicLang: 'Arapça',
    language: 'Dil',
    arabic: 'Arapça',
    english: 'İngilizce',
    french: 'Fransızca',
    turkish: 'Türkçe',
    minRatingAria: 'Minimum puan',
    allRatings: 'Tüm puanlar',
    experience: 'Deneyim',
    exp2: '2+ Yıl',
    exp5: '5+ Yıl',
    exp10: '10+ Yıl',
    hourlyRate: 'Saatlik Ücret',
    hour: 'sa',
    featured: '⭐ Öne Çıkan Öğretmen',
    verifiedBadge: 'Sertifikalı',
    ratingCount: 'değerlendirme',
    yearsExp: 'yıl deneyim',
    ijazat: 'icazet',
    memorized: 'Ezber',
    parts: 'cüz',
    students: 'öğrenci',
    viewProfile: 'Profili Gör ve Randevu Al',
    loading: 'Öğretmenler yükleniyor...',
    errLoad: 'Öğretmen listesi yüklenemedi.',
    errConn: 'Sunucuya ulaşılamadı.',
    errTitle: 'Öğretmenler yüklenemedi',
    retry: 'Tekrar dene',
    noTutors: 'Henüz kayıtlı öğretmen bulunmuyor',
    noTutorsDesc: 'Şu anda yayımlanmış öğretmen profili yok. Yine de kaydınızı başlatabilirsiniz.',
    getStarted: 'Hemen başla',
    availableHeading: 'MÜSAİT ÖĞRETMENLER',
    fallbackTeacherName: 'Kur’an öğretmeni',
    paginationAria: 'Sayfalama',
    registerTeacher: 'Öğretmen Olarak Katıl',
    noTutorsMatched: 'Aramanızla eşleşen öğretmen bulunamadı',
    tryChanging: 'Filtreleri değiştirmeyi veya başka anahtar kelimeler denemeyi deneyin',
    showing: '{total} öğretmenden {count} tanesi gösteriliyor',
    previous: 'Önceki',
    next: 'Sonraki',
  },
  ur: {
    home: 'ہوم',
    eyebrow: 'اپنے استاد کا انتخاب کریں',
    title: 'دستیاب اساتذہ',
    subtitle: 'مستند اساتذہ اور معلمات کے پروفائلز دیکھیں، اپنے ہدف کے مطابق انتخاب کریں اور براہِ راست مفت تجرباتی کلاس بک کریں',
    searchPlaceholder: 'نام یا مہارت کے ذریعے استاد تلاش کریں...',
    advancedFilters: 'مزید فلٹرز',
    sortBy: 'ترتیب',
    ratingHigh: 'سب سے زیادہ ریٹنگ',
    expHigh: 'سب سے زیادہ تجربہ',
    studentsHigh: 'سب سے زیادہ طلباء',
    newest: 'تازہ ترین',
    clearFilters: 'فلٹرز صاف کریں',
    allMarkets: 'تمام مارکیٹس',
    allCountries: 'تمام ممالک',
    countryEgypt: 'مصر',
    countrySaudi: 'سعودی عرب',
    countryJordan: 'اردن',
    countryUAE: 'متحدہ عرب امارات',
    gender: 'صنف',
    male: 'مرد',
    female: 'خاتون',
    specialization: 'مہارت',
    allTracks: 'تمام شعبے',
    allSections: 'سب',
    menSection: 'اساتذہ — مرد اور بچے',
    womenSection: 'معلمات — خواتین سیکشن',
    children: 'بچوں کی بنیاد',
    adults: 'بالغ افراد',
    women: 'خواتین سیکشن',
    tajweed: 'تجوید',
    ijaza: 'اجازت و سند',
    arabicLang: 'عربی زبان',
    language: 'زبان',
    arabic: 'عربی',
    english: 'انگریزی',
    french: 'فرانسیسی',
    turkish: 'ترکی',
    minRatingAria: 'کم از کم ریٹنگ',
    allRatings: 'تمام ریٹنگز',
    experience: 'تجربہ',
    exp2: '2+ سال',
    exp5: '5+ سال',
    exp10: '10+ سال',
    hourlyRate: 'فی گھنٹہ فیس',
    hour: 'گھنٹہ',
    featured: '⭐ نمایاں استاد',
    verifiedBadge: 'تصدیق شدہ',
    ratingCount: 'ریٹنگ',
    yearsExp: 'سال کا تجربہ',
    ijazat: 'اجازات',
    memorized: 'حفظ',
    parts: 'پارے',
    students: 'طلباء',
    viewProfile: 'پروفائل دیکھیں اور بک کریں',
    loading: 'اساتذہ لوڈ ہو رہے ہیں...',
    errLoad: 'اساتذہ کی فہرست لوڈ نہیں ہو سکی۔',
    errConn: 'سرور سے رابطہ نہیں ہو سکا۔',
    errTitle: 'اساتذہ لوڈ نہیں ہو سکے',
    retry: 'دوبارہ کوشش کریں',
    noTutors: 'ابھی کوئی رجسٹرڈ استاد موجود نہیں',
    noTutorsDesc: 'فی الحال کوئی استاد پروفائل شائع نہیں ہے۔ آپ اب بھی رجسٹریشن شروع کر سکتے ہیں۔',
    getStarted: 'ابھی شروع کریں',
    availableHeading: 'دستیاب اساتذہ',
    fallbackTeacherName: 'قرآن کے استاد',
    paginationAria: 'صفحہ بندی',
    registerTeacher: 'بطور استاد شامل ہوں',
    noTutorsMatched: 'آپ کی تلاش سے کوئی استاد نہیں ملا',
    tryChanging: 'فلٹرز تبدیل کریں یا دوسرے الفاظ سے تلاش کریں',
    showing: 'کل {total} میں سے {count} اساتذہ دکھائے جا رہے ہیں',
    previous: 'پچھلا',
    next: 'اگلا',
  },
  id: {
    home: 'Beranda',
    eyebrow: 'PILIH GURU ANDA',
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
    countryEgypt: 'Mesir',
    countrySaudi: 'Arab Saudi',
    countryJordan: 'Yordania',
    countryUAE: 'UEA',
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
    minRatingAria: 'Penilaian minimum',
    allRatings: 'Semua Penilaian',
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
    errLoad: 'Tidak dapat memuat daftar guru.',
    errConn: 'Tidak dapat terhubung ke server.',
    errTitle: 'Gagal memuat guru',
    retry: 'Coba lagi',
    noTutors: 'Belum ada guru terdaftar',
    noTutorsDesc: 'Belum ada profil guru yang dipublikasikan saat ini. Anda tetap dapat memulai pendaftaran.',
    getStarted: 'Mulai bersama kami',
    availableHeading: 'GURU TERSEDIA',
    fallbackTeacherName: 'Guru Al-Quran',
    paginationAria: 'Navigasi halaman',
    registerTeacher: 'Gabung Sebagai Guru',
    noTutorsMatched: 'Tidak ada guru yang cocok dengan pencarian Anda',
    tryChanging: 'Coba ubah filter atau gunakan kata kunci lain',
    showing: 'Menampilkan {count} dari {total} guru',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
  },
  ms: {
    home: 'Laman Utama',
    eyebrow: 'PILIH GURU ANDA',
    title: 'Guru Bertauliah Pilihan',
    subtitle: 'Pilih guru yang sesuai daripada barisan pengajar bertauliah kami dan tempah sesi penilaian percuma secara terus',
    searchPlaceholder: 'Cari guru mengikut nama atau pengkhususan...',
    advancedFilters: 'Penapis Lanjutan',
    sortBy: 'Susun mengikut',
    ratingHigh: 'Penilaian Tertinggi',
    expHigh: 'Paling Berpengalaman',
    studentsHigh: 'Pelajar Terbanyak',
    newest: 'Terkini',
    clearFilters: 'Kosongkan Penapis',
    allMarkets: 'Semua Pasaran',
    allCountries: 'Semua Negara',
    countryEgypt: 'Mesir',
    countrySaudi: 'Arab Saudi',
    countryJordan: 'Jordan',
    countryUAE: 'UAE',
    gender: 'Jantina',
    male: 'Lelaki',
    female: 'Wanita',
    specialization: 'Pengkhususan',
    allTracks: 'Semua Pengkhususan',
    allSections: 'Semua Guru',
    menSection: 'Guru Lelaki',
    womenSection: 'Guru Wanita (Khas)',
    children: 'Kanak-kanak',
    adults: 'Dewasa',
    women: 'Wanita',
    tajweed: 'Tajwid',
    ijaza: 'Ijazah',
    arabicLang: 'Bahasa Arab',
    language: 'Bahasa',
    arabic: 'Arab',
    english: 'Inggeris',
    french: 'Perancis',
    turkish: 'Turki',
    minRatingAria: 'Penilaian minimum',
    allRatings: 'Semua Penilaian',
    experience: 'Pengalaman',
    exp2: '2+ Tahun',
    exp5: '5+ Tahun',
    exp10: '10+ Tahun',
    hourlyRate: 'Kadar Sejam',
    hour: 'jam',
    featured: '⭐ Guru Pilihan',
    verifiedBadge: 'Bertauliah',
    ratingCount: 'penilaian',
    yearsExp: 'tahun pengalaman',
    ijazat: 'ijazah',
    memorized: 'Hafaz',
    parts: 'juzuk',
    students: 'pelajar',
    viewProfile: 'Lihat Profil & Tempah',
    loading: 'Memuatkan senarai guru...',
    errLoad: 'Tidak dapat memuatkan senarai guru.',
    errConn: 'Tidak dapat menghubungi pelayan.',
    errTitle: 'Tidak dapat memuatkan guru',
    retry: 'Cuba lagi',
    noTutors: 'Belum ada guru berdaftar',
    noTutorsDesc: 'Tiada profil guru diterbitkan buat masa ini. Anda masih boleh memulakan pendaftaran.',
    getStarted: 'Mulakan sekarang',
    availableHeading: 'GURU TERSEDIA',
    fallbackTeacherName: 'Guru Al-Quran',
    paginationAria: 'Penomboran halaman',
    registerTeacher: 'Sertai Sebagai Guru',
    noTutorsMatched: 'Tiada guru yang sepadan dengan carian anda',
    tryChanging: 'Cuba ubah penapis atau gunakan kata kunci lain',
    showing: 'Memaparkan {count} daripada {total} guru',
    previous: 'Sebelumnya',
    next: 'Seterusnya',
  },
  ku: {
    home: 'سەرەکی',
    eyebrow: 'مامۆستاکەت هەڵبژێرە',
    title: 'مامۆستا بەردەستەکان',
    subtitle: 'پرۆفایلی مامۆستا بڕوانامەدارەکان ببینە و گونجاوترین بۆ ئامانج و ئاستت هەڵبژێرە لەگەڵ وانەی تاقیکاری بەخۆڕایی',
    searchPlaceholder: 'بە ناو یان پسپۆڕی بەدوای مامۆستادا بگەڕێ...',
    advancedFilters: 'فلتەرە وردەکان',
    sortBy: 'ڕیزکردن بەپێی',
    ratingHigh: 'بەرزترین هەڵسەنگاندن',
    expHigh: 'زۆرترین ئەزموون',
    studentsHigh: 'زۆرترین قوتابی',
    newest: 'نوێترین',
    clearFilters: 'سڕینەوەی فلتەرەکان',
    allMarkets: 'هەموو بازاڕەکان',
    allCountries: 'هەموو وڵاتەکان',
    countryEgypt: 'میسر',
    countrySaudi: 'سعوودیە',
    countryJordan: 'ئوردن',
    countryUAE: 'ئیمارات',
    gender: 'ڕەگەز',
    male: 'نێر',
    female: 'مێ',
    specialization: 'پسپۆڕی',
    allTracks: 'هەموو پسپۆڕییەکان',
    allSections: 'هەمووان',
    menSection: 'مامۆستایان — پیاوان و منداڵان',
    womenSection: 'مامۆستایانی ژن — بەشی خانمان',
    children: 'منداڵان',
    adults: 'گەوران',
    women: 'بەشی خانمان',
    tajweed: 'تەجوید',
    ijaza: 'ئیجازە',
    arabicLang: 'زمانی عەرەبی',
    language: 'زمان',
    arabic: 'عەرەبی',
    english: 'ئینگلیزی',
    french: 'فەڕەنسی',
    turkish: 'تورکی',
    minRatingAria: 'کەمترین هەڵسەنگاندن',
    allRatings: 'هەموو هەڵسەنگاندنەکان',
    experience: 'ئەزموون',
    exp2: '2+ ساڵ',
    exp5: '5+ ساڵ',
    exp10: '10+ ساڵ',
    hourlyRate: 'نرخی کاتژمێر',
    hour: 'کاتژمێر',
    featured: '⭐ مامۆستای تایبەت',
    verifiedBadge: 'بڕوانامەدار',
    ratingCount: 'هەڵسەنگاندن',
    yearsExp: 'ساڵ ئەزموون',
    ijazat: 'ئیجازە',
    memorized: 'لەبەرکردن',
    parts: 'جوزئ',
    students: 'قوتابی',
    viewProfile: 'بینینی پرۆفایل و دیاریکردنی کات',
    loading: 'مامۆستایان باردەکرێن...',
    errLoad: 'بارکردنی لیستی مامۆستایان سەرکەوتوو نەبوو.',
    errConn: 'پەیوەندی بە ڕاژەکارەوە نەکرا.',
    errTitle: 'بارکردنی مامۆستایان سەرکەوتوو نەبوو',
    retry: 'دووبارە هەوڵبدەرەوە',
    noTutors: 'هێشتا هیچ مامۆستایەکی تۆمارکراو نییە',
    noTutorsDesc: 'لە ئێستادا هیچ پرۆفایلێکی مامۆستا بڵاونەکراوەتەوە. دەتوانیت هەر ئێستا ناونووسین دەست پێ بکەیت.',
    getStarted: 'لەگەڵمان دەست پێ بکە',
    availableHeading: 'مامۆستا بەردەستەکان',
    fallbackTeacherName: 'مامۆستای قورئان',
    paginationAria: 'ژمارەدانی پەڕەکان',
    registerTeacher: 'وەک مامۆستا بەشداربە',
    noTutorsMatched: 'هیچ مامۆستایەک لەگەڵ گەڕانەکەت نەگونجا',
    tryChanging: 'هەوڵبدە فلتەرەکان بگۆڕیت یان وشەی تر بەکاربهێنیت',
    showing: 'پیشاندانی {count} لە {total} مامۆستا',
    previous: 'پێشوو',
    next: 'دواتر',
  },
};

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
  const { locale, isRTL, dir } = useI18n();
  const { createCollectionSchema, createBreadcrumbSchema } = useSEO();
  const active = TEACHERS_LABELS[locale] || TEACHERS_LABELS.en;
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || searchParams.get('search') || '');
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
      setFetchError('');
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
          setFetchError(data?.error || active.errLoad);
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
          setTeachers([]);
          setFetchError(error?.message || active.errConn);
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
  }, [filters, pagination.page, sortBy, searchQuery, retryTick, active.errLoad, active.errConn]);

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

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
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
        schema: [
          createCollectionSchema({
            name: active.title,
            description: active.subtitle,
            url: '/teachers',
            items: teachers.slice(0, 12).map((teacher) => ({
              name: teacher.user?.name || active.title,
              url: '/teachers/' + teacher._id,
            })),
          }),
          createBreadcrumbSchema([
            { name: active.home, url: '/' },
            { name: active.title, url: '/teachers' },
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
                {active.eyebrow}
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
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  aria-label={active.searchPlaceholder}
                  placeholder={active.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="wn-public-filter-actions">
                <button
                  type="button"
                  aria-expanded={showFilters}
                  aria-controls="teachers-expanded-filters"
                  onClick={() => setShowFilters((open) => !open)}
                  className="wn-public-filter-button min-h-[44px]"
                >
                  <Filter size={17} aria-hidden="true" />
                  {active.advancedFilters}
                  {activeFilterCount > 0 ? (
                    <span className="wn-filter-badge">{activeFilterCount}</span>
                  ) : null}
                  <ChevronDown size={15} className={showFilters ? 'rotate-180 transition' : 'transition'} aria-hidden="true" />
                </button>

                <select
                  value={sortBy}
                  onChange={(event) => {
                    setLoading(true);
                    setSortBy(event.target.value);
                  }}
                  className="wn-public-select min-h-[44px]"
                  aria-label={active.sortBy}
                >
                  <option value="rating">{active.ratingHigh}</option>
                  <option value="experience">{active.expHigh}</option>
                  <option value="students">{active.studentsHigh}</option>
                  <option value="newest">{active.newest}</option>
                </select>

                {activeFilterCount > 0 ? (
                  <button type="button" onClick={clearFilters} className="min-h-[44px] px-2 text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)]">
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
                  aria-pressed={filters.gender === ''}
                  onClick={() => handleFilterChange('gender', '')}
                  className={filters.gender === '' ? 'wn-quick-pill is-active min-h-[44px]' : 'wn-quick-pill min-h-[44px]'}
                >
                  {active.allSections}
                </button>
                <button
                  type="button"
                  aria-pressed={filters.gender === 'male'}
                  onClick={() => handleFilterChange('gender', 'male')}
                  className={filters.gender === 'male' ? 'wn-quick-pill is-active min-h-[44px]' : 'wn-quick-pill min-h-[44px]'}
                >
                  {active.menSection}
                </button>
                <button
                  type="button"
                  aria-pressed={filters.gender === 'female'}
                  onClick={() => handleFilterChange('gender', 'female')}
                  className={filters.gender === 'female' ? 'wn-quick-pill is-active min-h-[44px]' : 'wn-quick-pill min-h-[44px]'}
                >
                  {active.womenSection}
                </button>
              </div>

              <div className="wn-quick-spec-pills" role="group" aria-label={active.specialization}>
                {quickSpecializations.map((item) => (
                  <button
                    key={item.id || 'all'}
                    type="button"
                    aria-pressed={filters.specialization === item.id}
                    onClick={() => handleFilterChange('specialization', item.id)}
                    className={filters.specialization === item.id ? 'wn-quick-spec-pill is-active min-h-[44px]' : 'wn-quick-spec-pill min-h-[44px]'}
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
                    className="wn-active-filter-chip min-h-[44px]"
                  >
                    <span>{filterChipLabel(key, value)}</span>
                    <X size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}

            {showFilters && (
              <div id="teachers-expanded-filters" className="wn-public-expanded-filters">
                <select aria-label={active.allMarkets} value={filters.market} onChange={(event) => handleFilterChange('market', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.allMarkets}</option>
                  {v4Markets.map((market) => <option key={market.slug} value={market.slug}>{getMarketRegion(market, locale)}</option>)}
                </select>

                <select aria-label={active.allCountries} value={filters.country} onChange={(event) => handleFilterChange('country', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.allCountries}</option>
                  <option value="مصر">{active.countryEgypt}</option>
                  <option value="السعودية">{active.countrySaudi}</option>
                  <option value="الأردن">{active.countryJordan}</option>
                  <option value="الإمارات">{active.countryUAE}</option>
                </select>

                <select aria-label={active.gender} value={filters.gender} onChange={(event) => handleFilterChange('gender', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.gender}</option>
                  <option value="male">{active.male}</option>
                  <option value="female">{active.female}</option>
                </select>

                <select aria-label={active.specialization} value={filters.specialization} onChange={(event) => handleFilterChange('specialization', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.specialization}</option>
                  <option value="children">{active.children}</option>
                  <option value="adults">{active.adults}</option>
                  <option value="women">{active.women}</option>
                  <option value="tajweed">{active.tajweed}</option>
                  <option value="ijaza">{active.ijaza}</option>
                  <option value="arabic-language">{active.arabicLang}</option>
                </select>

                <select aria-label={active.language} value={filters.language} onChange={(event) => handleFilterChange('language', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.language}</option>
                  <option value="arabic">{active.arabic}</option>
                  <option value="english">{active.english}</option>
                  <option value="french">{active.french}</option>
                  <option value="turkish">{active.turkish}</option>
                </select>

                <select aria-label={active.minRatingAria} value={filters.minRating} onChange={(event) => handleFilterChange('minRating', event.target.value)} className="wn-public-select min-h-[44px]">
                  <option value="">{active.allRatings}</option>
                  <option value="4">4+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>

                <select aria-label={active.experience} value={filters.minExperience} onChange={(event) => handleFilterChange('minExperience', event.target.value)} className="wn-public-select min-h-[44px]">
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
            ) : fetchError ? (
              <div className="wn-public-empty" role="alert">
                <Users size={48} aria-hidden="true" />
                <h3>{active.errTitle}</h3>
                <p>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setRetryTick((n) => n + 1);
                  }}
                  className="wn-btn wn-btn--primary mt-4 min-h-[44px]"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{active.retry}</span>
                </button>
              </div>
            ) : teachers.length === 0 ? (
              <div className="wn-public-empty">
                <Users size={48} aria-hidden="true" />
                <h3>{pagination.total === 0 ? active.noTutors : active.noTutorsMatched}</h3>
                <p>{pagination.total === 0 ? active.noTutorsDesc : active.tryChanging}</p>
                {pagination.total === 0 ? (
                  <Link to={lp('/start')} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                    {active.getStarted}
                  </Link>
                ) : (
                  <button type="button" onClick={clearFilters} className="wn-btn wn-btn--secondary mt-4 min-h-[44px]">
                    {active.clearFilters}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="wn-public-eyebrow">{active.availableHeading}</span>
                  <span className="text-xs text-[var(--wn-text-secondary)]">
                    {active.showing.replace('{count}', teachers.length).replace('{total}', pagination.total)}
                  </span>
                </div>

                <div className="wn-public-grid">
                  {teachers.map((teacher) => {
                    const ratingCount = Number(teacher.rating?.count || 0);
                    const ratingAverage = Number(teacher.rating?.average || 0);
                    const specializations = Array.isArray(teacher.quranInfo?.specializations) ? teacher.quranInfo.specializations.slice(0, 4) : [];
                    const languages = ((teacher.languages || teacher.personalInfo?.languages) || []).slice(0, 3);
                    const price = teacher.hourlyRate;
                    const country = teacher.personalInfo?.country;
                    const experience = teacher.quranInfo?.teachingExperience;
                    const ijazat = teacher.quranInfo?.numberOfIjazat;
                    const parts = teacher.quranInfo?.memorizedParts;
                    const totalStudents = teacher.stats?.totalStudents;

                    return (
                      <Link
                        key={teacher._id}
                        to={lp('/teachers/' + teacher._id)}
                        state={{ prefetchedTeacher: teacher }}
                        onMouseEnter={() => prefetchTeacherBundle(teacher._id)}
                        onFocus={() => prefetchTeacherBundle(teacher._id)}
                        className="wn-teacher-card"
                      >
                        <div className="wn-teacher-card__media">
                          <TeacherAvatar
                            src={teacherPublicImage(teacher.media?.profilePhoto)}
                            name={teacher.user?.name || active.title}
                            alt={teacher.user?.name || active.title}
                            loading="lazy"
                            size="lg"
                            className="h-full w-full"
                          />
                          {teacher.isFeatured ? (
                            <span className="wn-teacher-featured">{active.featured}</span>
                          ) : (
                            <span className="wn-teacher-verified">
                              <ShieldCheck size={12} aria-hidden="true" /> {active.verifiedBadge}
                            </span>
                          )}
                          {price != null ? <span className="wn-teacher-price">{displayPrice(price, 'EGP')}/{active.hour}</span> : null}
                        </div>

                        <div className="wn-teacher-card__body">
                          <div className="flex items-start justify-between gap-2">
                            <h3>{teacher.user?.name || active.fallbackTeacherName}</h3>
                            {ratingCount > 0 && ratingAverage > 0 ? (
                              <div className="wn-teacher-rating shrink-0">
                                <Star size={14} fill="currentColor" aria-hidden="true" />
                                <strong>{ratingAverage.toFixed(1)}</strong>
                                <span>({ratingCount})</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="wn-teacher-details">
                            {country ? <span className="wn-teacher-detail"><MapPin size={14} aria-hidden="true" /> {country}</span> : null}
                            {experience ? <span className="wn-teacher-detail"><Clock size={14} aria-hidden="true" /> {experience} {active.yearsExp}</span> : null}
                            {ijazat ? <span className="wn-teacher-detail"><Award size={14} aria-hidden="true" /> {ijazat} {active.ijazat}</span> : null}
                            {parts ? <span className="wn-teacher-detail"><BookOpen size={14} aria-hidden="true" /> {active.memorized} {parts} {active.parts}</span> : null}
                            {totalStudents ? <span className="wn-teacher-detail"><Users size={14} aria-hidden="true" /> {totalStudents} {active.students}</span> : null}
                            {languages.length > 0 ? (
                              <span className="wn-teacher-detail">
                                <Globe size={14} aria-hidden="true" /> {languages.map(langLabel).join(' • ')}
                              </span>
                            ) : null}
                          </div>

                          {specializations.length > 0 ? (
                            <div className="wn-teacher-tags">
                              {specializations.map((spec) => <span key={spec}>{specLabel(spec)}</span>)}
                            </div>
                          ) : null}

                          <span className="wn-teacher-card__cta gap-1.5 min-h-[44px]">
                            {active.viewProfile}
                            <ArrowIcon size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {pagination.pages > 1 ? (
                  <nav aria-label={active.paginationAria} className="flex justify-center flex-wrap gap-2 mt-8">
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }));
                      }}
                      disabled={pagination.page === 1}
                      className="wn-btn wn-btn--secondary min-h-[44px] disabled:opacity-40"
                    >
                      {active.previous}
                    </button>

                    {Array.from({ length: Math.min(pagination.pages, 5) }, (_, index) => {
                      const pageNum = index + 1;
                      const isCurrent = pagination.page === pageNum;
                      return (
                        <button
                          type="button"
                          key={pageNum}
                          aria-current={isCurrent ? 'page' : undefined}
                          onClick={() => {
                            setLoading(true);
                            setPagination((current) => ({ ...current, page: pageNum }));
                          }}
                          className={isCurrent ? 'wn-btn wn-btn--primary min-h-[44px] min-w-[44px]' : 'wn-btn wn-btn--secondary min-h-[44px] min-w-[44px]'}
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
                      className="wn-btn wn-btn--secondary min-h-[44px] disabled:opacity-40"
                    >
                      {active.next}
                    </button>
                  </nav>
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
