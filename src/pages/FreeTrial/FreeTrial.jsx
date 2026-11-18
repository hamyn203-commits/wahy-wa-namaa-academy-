import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpen,
  Award,
  GraduationCap,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MessageCircle,
  Copy,
  Check,
  Star,
  Users,
  FileCheck,
  Sun,
  Sunset,
  Clock,
  Lock,
  Phone
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import { useI18n } from '../../i18n';
import { localizedPath, DEFAULT_LOCALE } from '../../lib/locale';
import { SOCIAL_LINKS } from '../../config/social';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const COUNTRY_CODES = [
  { code: '+966', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia' },
  { code: '+20', nameAr: 'مصر', nameEn: 'Egypt' },
  { code: '+971', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates' },
  { code: '+965', nameAr: 'الكويت', nameEn: 'Kuwait' },
  { code: '+974', nameAr: 'قطر', nameEn: 'Qatar' },
  { code: '+968', nameAr: 'سلطنة عُمان', nameEn: 'Oman' },
  { code: '+973', nameAr: 'البحرين', nameEn: 'Bahrain' },
  { code: '+962', nameAr: 'الأردن', nameEn: 'Jordan' },
  { code: '+1', nameAr: 'الولايات المتحدة / كندا', nameEn: 'USA / Canada' },
  { code: '+44', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom' },
  { code: '+49', nameAr: 'ألمانيا', nameEn: 'Germany' },
  { code: '+33', nameAr: 'فرنسا', nameEn: 'France' },
  { code: '+90', nameAr: 'تركيا', nameEn: 'Turkey' },
  { code: '+60', nameAr: 'ماليزيا', nameEn: 'Malaysia' },
  { code: '+62', nameAr: 'إندونيسيا', nameEn: 'Indonesia' },
  { code: '+212', nameAr: 'المغرب', nameEn: 'Morocco' },
  { code: '+213', nameAr: 'الجزائر', nameEn: 'Algeria' },
  { code: '+216', nameAr: 'تونس', nameEn: 'Tunisia' },
  { code: '+249', nameAr: 'السودان', nameEn: 'Sudan' },
  { code: '+964', nameAr: 'العراق', nameEn: 'Iraq' },
  { code: '+961', nameAr: 'لبنان', nameEn: 'Lebanon' },
  { code: '+970', nameAr: 'فلسطين', nameEn: 'Palestine' },
  { code: '+967', nameAr: 'اليمن', nameEn: 'Yemen' },
  { code: '+31', nameAr: 'هولندا', nameEn: 'Netherlands' },
  { code: '+46', nameAr: 'السويد', nameEn: 'Sweden' },
  { code: '+61', nameAr: 'أستراليا', nameEn: 'Australia' },
];

const LOCALE_CHROME = {
  ar: {
    home: 'الرئيسية',
    docTitle: 'احجز حصتك التجريبية المجانية 100% | أكاديمية وَحْيٌ وَنَمَاء',
    studentLabel: 'الطالب',
    ageYears: 'سنة',
    maleShort: 'ذكر',
    femaleShort: 'أنثى',
    trackLabel: 'المسار',
    contactLabel: 'المتواصل',
    whatsappSummaryLabel: 'الواتساب',
    trackNames: { memorization: 'التحفيظ والمراجعة', ijaza: 'الإجازة والتجويد', foundation: 'تأسيس الأطفال' },
    contactTeam: 'تواصل مع فريق الأكاديمية',
    trust1Title: 'معلمون ومعلمات متخصصون',
    trust1Desc: 'اختيار المعلم أو المعلمة يتم وفق التخصص والخبرة المتاحة لكل مسار',
    trust2Title: 'معلمات متخصصات للأخوات',
    trust2Desc: 'خصوصية وأمان تام للأخوات والبنات مع معلمات مجازات',
    trust3Title: 'تقرير قياس مستوى فوري',
    trust3Desc: 'تقرير شامل ومخصص بعد الحصة وخطة دراسية مقترحة مجاناً',
    errTrack: 'يرجى اختيار مسار تعليمي',
    errName: 'يرجى إدخال اسم الطالب',
    errAge: 'يرجى إدخال سن صالح (3-99 سنة)',
    errGender: 'يرجى اختيار جنس الطالب',
    errGuardian: 'يرجى إدخال اسم ولي الأمر أو المتواصل',
    errWhatsapp: 'يرجى إدخال رقم واتساب صحيح',
    errCustomDate: 'يرجى تحديد التاريخ المفضل',
    errSubmit: 'تعذر تسجيل الطلب الآن. حاول مرة أخرى أو استخدم نموذج التواصل.',
  },
  en: {
    home: 'Home',
    docTitle: 'Book 100% Free Trial Class | Wahy Wa Namaa Academy',
    studentLabel: 'Student',
    ageYears: 'yrs',
    maleShort: 'Male',
    femaleShort: 'Female',
    trackLabel: 'Track',
    contactLabel: 'Contact',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Memorization & Revision', ijaza: 'Ijaza & Tajweed', foundation: 'Kids Foundation' },
    contactTeam: 'Contact the academy team',
    trust1Title: 'Specialized Quran Teachers',
    trust1Desc: 'Handpicked certified scholars matched to your path and experience level',
    trust2Title: 'Female Tutors for Sisters',
    trust2Desc: 'Full privacy and comfort with dedicated female instructors',
    trust3Title: 'Instant Level Assessment',
    trust3Desc: 'Receive an individualized evaluation report and study roadmap',
    errTrack: 'Please select a track',
    errName: 'Student name is required',
    errAge: 'Please enter a valid age (3-99)',
    errGender: 'Please select gender',
    errGuardian: 'Contact name is required',
    errWhatsapp: 'Valid WhatsApp number is required',
    errCustomDate: 'Please select a date',
    errSubmit: 'We could not save the request. Please try again or use the contact form.',
  },
  fr: {
    home: 'Accueil',
    docTitle: 'Réserver un cours d’essai 100 % gratuit | Académie Wahy Wa Namaa',
    studentLabel: 'Élève',
    ageYears: 'ans',
    maleShort: 'Homme',
    femaleShort: 'Femme',
    trackLabel: 'Parcours',
    contactLabel: 'Contact',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Mémorisation & Révision', ijaza: 'Ijazah & Tajwid', foundation: 'Initiation Enfants' },
    contactTeam: 'Contacter l’équipe de l’académie',
    trust1Title: 'Enseignants spécialisés du Coran',
    trust1Desc: 'Des enseignants certifiés choisis selon le parcours et le niveau',
    trust2Title: 'Enseignantes dédiées aux sœurs',
    trust2Desc: 'Confidentialité totale avec des enseignantes qualifiées',
    trust3Title: 'Évaluation immédiate du niveau',
    trust3Desc: 'Recevez un bilan personnalisé et un plan d’étude après la séance',
    errTrack: 'Veuillez choisir un parcours',
    errName: 'Le nom de l’élève est requis',
    errAge: 'Veuillez saisir un âge valide (3-99)',
    errGender: 'Veuillez sélectionner le genre',
    errGuardian: 'Le nom du responsable est requis',
    errWhatsapp: 'Un numéro WhatsApp valide est requis',
    errCustomDate: 'Veuillez choisir une date',
    errSubmit: 'Impossible d’enregistrer la demande. Veuillez réessayer.',
  },
  de: {
    home: 'Startseite',
    docTitle: '100 % kostenlose Probestunde buchen | Wahy Wa Namaa Akademie',
    studentLabel: 'Schüler',
    ageYears: 'Jahre',
    maleShort: 'Männlich',
    femaleShort: 'Weiblich',
    trackLabel: 'Lernpfad',
    contactLabel: 'Kontakt',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Auswendiglernen & Wiederholung', ijaza: 'Idschaza & Tadschwid', foundation: 'Kinder-Grundlagen' },
    contactTeam: 'Akademieteam kontaktieren',
    trust1Title: 'Qualifizierte Koran-Lehrkräfte',
    trust1Desc: 'Sorgfältig ausgewählte Lehrkräfte passend zum jeweiligen Pfad',
    trust2Title: 'Lehrerinnen für Schwestern',
    trust2Desc: 'Volle Privatsphäre mit zertifizierten weiblichen Lehrkräften',
    trust3Title: 'Sofortige Einstufung',
    trust3Desc: 'Individueller Auswertungsbericht und Lernplan nach der Stunde',
    errTrack: 'Bitte wählen Sie einen Lernpfad',
    errName: 'Name des Schülers erforderlich',
    errAge: 'Bitte gültiges Alter angeben (3-99)',
    errGender: 'Bitte Geschlecht auswählen',
    errGuardian: 'Kontaktname erforderlich',
    errWhatsapp: 'Gültige WhatsApp-Nummer erforderlich',
    errCustomDate: 'Bitte Datum auswählen',
    errSubmit: 'Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen.',
  },
  tr: {
    home: 'Ana Sayfa',
    docTitle: '%100 Ücretsiz Deneme Dersi Ayırt | Wahy Wa Namaa Akademisi',
    studentLabel: 'Öğrenci',
    ageYears: 'yaş',
    maleShort: 'Erkek',
    femaleShort: 'Kadın',
    trackLabel: 'Eğitim Yolu',
    contactLabel: 'İletişim',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Ezber ve Tekrar', ijaza: 'İcazet ve Tecvid', foundation: 'Çocuk Temel Eğitimi' },
    contactTeam: 'Akademi ekibiyle iletişime geçin',
    trust1Title: 'Uzman Kur’an Öğretmenleri',
    trust1Desc: 'Her eğitim yoluna uygun sertifikalı eğitmen eşleştirmesi',
    trust2Title: 'Hanımlara Özel Kadın Hocalar',
    trust2Desc: 'Bayan öğrenciler için tam mahremiyet ve uzman eğitmenler',
    trust3Title: 'Anında Seviye Değerlendirmesi',
    trust3Desc: 'Ders sonrası ücretsiz seviye raporu ve çalışma planı',
    errTrack: 'Lütfen bir eğitim yolu seçin',
    errName: 'Öğrenci adı zorunludur',
    errAge: 'Geçerli bir yaş girin (3-99)',
    errGender: 'Lütfen cinsiyet seçin',
    errGuardian: 'İletişim kişisi adı zorunludur',
    errWhatsapp: 'Geçerli bir WhatsApp numarası girin',
    errCustomDate: 'Lütfen tarih seçin',
    errSubmit: 'Talep kaydedilemedi. Lütfen tekrar deneyin.',
  },
  ur: {
    home: 'صفحہ اول',
    docTitle: '100% مفت آزمائشی کلاس بک کریں | وحی و نما اکیڈمی',
    studentLabel: 'طالب علم',
    ageYears: 'سال',
    maleShort: 'مرد',
    femaleShort: 'خاتون',
    trackLabel: 'راستہ',
    contactLabel: 'رابطہ کنندہ',
    whatsappSummaryLabel: 'واٹس ایپ',
    trackNames: { memorization: 'حفظ و دہرائی', ijaza: 'اجازہ و تجوید', foundation: 'بچوں کی بنیاد' },
    contactTeam: 'اکیڈمی ٹیم سے رابطہ کریں',
    trust1Title: 'ماہر اساتذہ کرام',
    trust1Desc: 'ہر تعلیمی راستے کے لیے تجربہ کار اور مستند معلمین و معلمات',
    trust2Title: 'خواتین کے لیے مخصوص معلمات',
    trust2Desc: 'طالبات اور بچیوں کے لیے مکمل رازداری اور محفوظ ماحول',
    trust3Title: 'فوری تعلیمی جائزہ رپورٹ',
    trust3Desc: 'سبق کے بعد مفت سطح کا جائزہ اور تجویز کردہ تعلیمی منصوبہ',
    errTrack: 'براہ کرم تعلیمی راستہ منتخب کریں',
    errName: 'طالب علم کا نام درکار ہے',
    errAge: 'درست عمر درج کریں (3-99)',
    errGender: 'جنس منتخب کریں',
    errGuardian: 'سرپرست یا رابطہ کنندہ کا نام درکار ہے',
    errWhatsapp: 'درست واٹس ایپ نمبر درج کریں',
    errCustomDate: 'براہ کرم تاریخ منتخب کریں',
    errSubmit: 'درخواست محفوظ نہیں ہو سکی۔ براہ کرم دوبارہ کوشش کریں۔',
  },
  id: {
    home: 'Beranda',
    docTitle: 'Pesan Kelas Percobaan 100% Gratis | Akademi Wahy Wa Namaa',
    studentLabel: 'Siswa',
    ageYears: 'thn',
    maleShort: 'Laki-laki',
    femaleShort: 'Perempuan',
    trackLabel: 'Jalur',
    contactLabel: 'Kontak',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Tahfidz & Murajaah', ijaza: 'Ijazah & Tajwid', foundation: 'Dasar Anak' },
    contactTeam: 'Hubungi tim akademi',
    trust1Title: 'Pengajar Al-Qur’an Spesialis',
    trust1Desc: 'Dipilih sesuai jalur belajar dan tingkat pengalaman siswa',
    trust2Title: 'Pengajar Wanita untuk Muslimah',
    trust2Desc: 'Privasi penuh dan kenyamanan dengan pengajar wanita bersertifikat',
    trust3Title: 'Laporan Evaluasi Level Langsung',
    trust3Desc: 'Dapatkan laporan evaluasi dan rencana belajar pribadi gratis',
    errTrack: 'Silakan pilih jalur belajar',
    errName: 'Nama siswa wajib diisi',
    errAge: 'Masukkan usia yang valid (3-99)',
    errGender: 'Silakan pilih jenis kelamin',
    errGuardian: 'Nama wali/kontak wajib diisi',
    errWhatsapp: 'Nomor WhatsApp yang valid wajib diisi',
    errCustomDate: 'Silakan pilih tanggal',
    errSubmit: 'Permintaan tidak dapat disimpan. Silakan coba lagi.',
  },
  ms: {
    home: 'Utama',
    docTitle: 'Tempah Kelas Percubaan 100% Percuma | Akademi Wahy Wa Namaa',
    studentLabel: 'Pelajar',
    ageYears: 'thn',
    maleShort: 'Lelaki',
    femaleShort: 'Perempuan',
    trackLabel: 'Laluan',
    contactLabel: 'Hubungan',
    whatsappSummaryLabel: 'WhatsApp',
    trackNames: { memorization: 'Hafazan & Ulang Kaji', ijaza: 'Ijazah & Tajwid', foundation: 'Asas Kanak-Kanak' },
    contactTeam: 'Hubungi pasukan akademi',
    trust1Title: 'Guru Al-Quran Bertauliah',
    trust1Desc: 'Dipilih mengikut kesesuaian laluan dan pengalaman pelajar',
    trust2Title: 'Guru Wanita untuk Muslimat',
    trust2Desc: 'Privasi penuh dengan guru wanita bertauliah dan berpengalaman',
    trust3Title: 'Laporan Penilaian Serta-Merta',
    trust3Desc: 'Terima laporan penilaian tahap dan pelan pengajian percuma',
    errTrack: 'Sila pilih laluan pembelajaran',
    errName: 'Nama pelajar diperlukan',
    errAge: 'Sila masukkan umur yang sah (3-99)',
    errGender: 'Sila pilih jantina',
    errGuardian: 'Nama penjaga atau penghubung diperlukan',
    errWhatsapp: 'Nombor WhatsApp yang sah diperlukan',
    errCustomDate: 'Sila pilih tarikh',
    errSubmit: 'Permintaan tidak dapat disimpan. Sila cuba lagi.',
  },
  ku: {
    home: 'سەرەتا',
    docTitle: 'وانەی تاقیکاری 100% خۆڕایی حەجز بکە | ئەکادیمیای وەحی و نەما',
    studentLabel: 'فێرخواز',
    ageYears: 'ساڵ',
    maleShort: 'نێر',
    femaleShort: 'مێ',
    trackLabel: 'ڕێڕەو',
    contactLabel: 'پەیوەندیکار',
    whatsappSummaryLabel: 'واتساپ',
    trackNames: { memorization: 'لەبەرکردن و پێداچوونەوە', ijaza: 'ئیجازە و تەجوید', foundation: 'بنەمای منداڵان' },
    contactTeam: 'پەیوەندی بە تیمی ئەکادیمیاوە بکە',
    trust1Title: 'مامۆستایانی پسپۆڕی قورئان',
    trust1Desc: 'هەڵبژاردنی مامۆستا بەپێی پسپۆڕی و ئەزموون بۆ هەر ڕێڕەوێک',
    trust2Title: 'مامۆستایانی ئافرەت بۆ خوشکان',
    trust2Desc: 'تایبەتمەندی و ئاسایشی تەواو بۆ خوشکان و کچان لەگەڵ مامۆستایانی مۆڵەتپێدراو',
    trust3Title: 'ڕاپۆرتی خێرای هەڵسەنگاندنی ئاست',
    trust3Desc: 'ڕاپۆرتی تەواو و پلانی خوێندنی پێشنیارکراو بە خۆڕایی دوای وانەکە',
    errTrack: 'تکایە ڕێڕەوێکی فێرکاری هەڵبژێرە',
    errName: 'تکایە ناوی فێرخواز بنووسە',
    errAge: 'تکایە تەمەنێکی دروست بنووسە (3-99)',
    errGender: 'تکایە ڕەگەز هەڵبژێرە',
    errGuardian: 'تکایە ناوی بەخێوکار یان پەیوەندیکار بنووسە',
    errWhatsapp: 'تکایە ژمارەیەکی دروستی واتساپ بنووسە',
    errCustomDate: 'تکایە بەروار هەڵبژێرە',
    errSubmit: 'تۆمارکردنی داواکاری سەرکەوتوو نەبوو. تکایە دووبارە هەوڵبدەرەوە.',
  },
};

export default function FreeTrial() {
  const { locale, isRTL, dir } = useI18n();
  const { locale: paramLocale } = useParams();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const activeLocale = paramLocale || locale || DEFAULT_LOCALE;
  const lp = (path) => localizedPath(path, activeLocale);

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    track: 'memorization',
    studentName: '',
    age: '',
    gender: 'male',
    currentLevel: 'beginner',
    guardianName: '',
    countryCode: '+966',
    whatsapp: '',
    email: '',
    preferredPeriod: 'evening',
    preferredDay: 'tomorrow',
    customDate: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);

  const chrome = LOCALE_CHROME[activeLocale] || (isRTL ? LOCALE_CHROME.ar : LOCALE_CHROME.en);

  useEffect(() => {
    document.title = chrome.docTitle;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, chrome.docTitle]);

  const strings = {
    ar: {
      badge: 'هدية الأكاديمية — حصة تجريبية مجانية 100%',
      title: 'احجز حصتك التجريبية المجانية في رحاب القرآن',
      subtitle: 'جلسة تعريفية مباشرة تساعدنا على فهم مستوى الطالب وهدفه واقتراح المسار المناسب — مجانية وبدون التزام.',
      guarantee: 'مجانية 100% • بدون بطاقة دفع • خصوصية تامة للطالبات والأطفال',
      steps: [
        { num: 1, title: 'المسار التعليمي', desc: 'اختر التخصص' },
        { num: 2, title: 'بيانات الطالب', desc: 'السن والمعلم المناسب' },
        { num: 3, title: 'بيانات التواصل', desc: 'الواتساب والتأكيد' },
        { num: 4, title: 'الموعد المفضل', desc: 'تحديد التوقيت' },
      ],
      step1Title: 'اختر المسار التعليمي المناسب للطالب',
      step1Subtitle: 'كل مسار مبني على مستويات متدرجة ويقدمه معلمون ومعلمات متخصصون',
      tracks: [
        {
          id: 'memorization',
          icon: BookOpen,
          title: 'مسار التحفيظ والمراجعة المتقنة',
          subtitle: 'حفظ جديد وتثبيت متين',
          desc: 'خطة حفظ فردية متدرجة مع مراجعة تراكمية يومية لضبط الآيات وتثبيت الحفظ في الصدور تحت إشراف نخبة مجازة.',
          badge: 'الأكثر إقبالاً',
          features: ['حفظ وتسميع فردي مباشر', 'تثبيت بالمتشابهات القرآنية', 'تقرير إنجاز أسبوعي']
        },
        {
          id: 'ijaza',
          icon: Award,
          title: 'مسار الإجازة وأحكام التجويد',
          subtitle: 'مسار متقدم للإقراء والإجازة عند توفر معلم مؤهل',
          desc: 'دراسة عملية ونظرية دقيقة لمخارج وصفات الحروف، وأحكام التجويد، مع تدريب متقدم على الإقراء وأحكام التجويد وفق مستوى الطالب والمعلم المتاح.',
          badge: 'إتقان وإسناد',
          features: ['تصحيح متقدم للتلاوة', 'تصحيح دقيق لمخارج الحروف', 'شرح الجزرية وتحفة الأطفال']
        },
        {
          id: 'foundation',
          icon: GraduationCap,
          title: 'مسار تأسيس الأطفال ونور البيان',
          subtitle: 'من سن 4 إلى 12 سنة',
          desc: 'منهج تفاعلي شيق لتعليم القراءة العربية السليمة، حفظ قصار السور، وغرس القيم الإسلامية والقصص النبوية بأسلوب مرح.',
          badge: 'للأطفال والبراعم',
          features: ['طريقة نور البيان التفاعلية', 'معلمات متخصصات في تربية الأطفال', 'أنشطة وألعاب تحفيزية']
        }
      ],
      step2Title: 'بيانات الطالب والمستوى',
      step2Subtitle: 'هذه البيانات تتيح لنا اختيار المعلم أو المعلمة الأنسب لسن الطالب ومستواه',
      studentNameLabel: 'اسم الطالب كاملاً',
      studentNamePlaceholder: 'مثال: محمد أحمد إبراهيم / فاطمة الزهراء',
      ageLabel: 'سن الطالب (بالسنوات)',
      agePlaceholder: 'مثال: 9',
      genderLabel: 'جنس الطالب (لتعيين المعلم أو المعلمة الأنسب)',
      male: 'ذكر (ولد / رجل)',
      maleSub: 'سيتم تعيين شيخ / معلم مجاز',
      female: 'أنثى (بنت / سيدة)',
      femaleSub: 'سيتم تعيين شيخة / معلمة مجازة',
      genderNotice: 'خصوصية تامة وأمان: نلتزم بتعيين معلمات متخصصات لجميع الطالبات والبنات، ومعلمين متخصصين للطلاب والرجال.',
      levelLabel: 'مستوى الحفظ الحالي للطالب',
      levels: [
        { id: 'beginner', title: 'مبتدئ تماماً', desc: 'من الحروف أو قصار السور فقط' },
        { id: 'some_juz', title: 'يحفظ 1 - 3 أجزاء', desc: 'لديه أساسيات القراءة والحفظ' },
        { id: 'intermediate', title: 'يحفظ 4 - 10 أجزاء', desc: 'مستوى متوسط يحتاج مراجعة وتجويد' },
        { id: 'advanced', title: 'متقدم / أكثر من 10 أجزاء', desc: 'متقن ويرغب في الإتمام أو الإجازة' },
      ],
      step3Title: 'بيانات ولي الأمر ووسيلة التواصل',
      step3Subtitle: 'سنرسل لك عبر الواتساب رابط القاعة الافتراضية وموعد الحصة وتقرير التقييم',
      guardianNameLabel: 'اسم ولي الأمر / المتواصل',
      guardianNamePlaceholder: 'مثال: أبو محمد / أحمد عبد الله',
      countryLabel: 'الدولة ومفتاح الاتصال الدولي',
      whatsappLabel: 'رقم الواتساب الفعّال',
      whatsappPlaceholder: '501234567',
      whatsappHint: 'نرجو كتابة الرقم بدون الصفر الأول وبدون رمز الدولة (تم تحديده تلقائياً). سنرسل رابط القاعة والتأكيد عبر الواتساب.',
      emailLabel: 'البريد الإلكتروني (اختياري)',
      emailPlaceholder: 'example@gmail.com',
      step4Title: 'حدد الموعد الأنسب للحصة التجريبية',
      step4Subtitle: 'اختر الفترة واليوم المفضل، وسنقوم بتنسيق الوقت الدقيق معك عبر الواتساب فوراً',
      periodLabel: 'الفترة المفضلة',
      morningPeriod: 'الفترة الصباحية (08:00 ص - 01:00 م)',
      eveningPeriod: 'الفترة المسائية (04:00 م - 10:00 م)',
      flexiblePeriod: 'أي وقت يناسب الأكاديمية (مرن)',
      dayLabel: 'اليوم المفضل لبدء الحصة',
      days: [
        { id: 'today', title: 'اليوم إن أمكن', desc: 'أقرب موعد متاح' },
        { id: 'tomorrow', title: 'غداً', desc: 'في التوقيت المحدد' },
        { id: 'weekend', title: 'عطلة نهاية الأسبوع', desc: 'الجمعة أو السبت' },
        { id: 'custom', title: 'تاريخ محدد', desc: 'اختر من التقويم' }
      ],
      customDateLabel: 'حدد التاريخ المفضل',
      notesLabel: 'ملاحظات أو أهداف خاصة ترغب بالتركيز عليها (اختياري)',
      notesPlaceholder: 'مثال: نريد التركيز على مخارج الحروف، أو البدء من جزء عم...',
      summaryTitle: 'ملخص بيانات حجز الحصة التجريبية',
      next: 'المتابعة للخطوة التالية',
      prev: 'الرجوع للخلف',
      submitBtn: 'تأكيد حجز الحصة التجريبية مجاناً',
      submittingBtn: 'جاري تسجيل وتأكيد الحصة...',
      successTitle: 'تهانينا! تم تسجيل طلب حصتك التجريبية بنجاح',
      successSubtitle: 'أهلاً بكم في رحاب أكاديمية وَحْيٌ وَنَمَاء. طلبكم قيد المعالجة السريعة الآن من فريق الشؤون التعليمية.',
      refNumber: 'رقم الحجز المرجعي الخاص بك',
      copyRef: 'نسخ الرقم',
      copied: 'تم النسخ!',
      freeNoticeBadge: 'الحصة مجانية 100% بدون أي التزام مالي',
      whatHappensNext: 'ماذا يحدث بعد تأكيد الحجز الآن؟',
      stepsNext: [
        {
          num: '1',
          title: 'تعيين المعلم المناسب',
          desc: 'يقوم منسق التعليم بمطابقة رغباتكم واختيار معلم أو معلمة مناسبين لسن الطالب ومستواه وهدفه.'
        },
        {
          num: '2',
          title: 'التواصل عبر الواتساب',
          desc: 'يتواصل معكم مستشار الأكاديمية لتأكيد الساعة وإرسال رابط القاعة الافتراضية المباشرة.'
        },
        {
          num: '3',
          title: 'حضور الحصة والتقييم',
          desc: 'حضور الجلسة الفردية التفاعلية، والحصول على تقرير قياس مستوى وخطة حفظ مقترحة مجاناً.'
        }
      ],
      whatsappBtn: 'تأكيد موعد الحصة فوراً عبر الواتساب',
      homeBtn: 'العودة للرئيسية',
      exploreBtn: 'استكشاف دورات الأكاديمية'
    },
    en: {
      badge: 'Academy Gift — 100% Free Trial Class',
      title: 'Book Your 100% Free Trial Quran Class',
      subtitle: 'A live introductory session to understand the learner’s level and goals and recommend a suitable learning path — free with no commitment.',
      guarantee: '100% Free • No Credit Card Required • Complete Privacy for Sisters & Children',
      steps: [
        { num: 1, title: 'Learning Track', desc: 'Select track' },
        { num: 2, title: 'Student Info', desc: 'Age & teacher' },
        { num: 3, title: 'Contact Info', desc: 'WhatsApp & details' },
        { num: 4, title: 'Preferred Time', desc: 'Schedule timing' },
      ],
      step1Title: 'Select the Learning Track for the Student',
      step1Subtitle: 'Each track is supervised by specialized certified Quran teachers with systematic curricula',
      tracks: [
        {
          id: 'memorization',
          icon: BookOpen,
          title: 'Memorization & Revision Track',
          subtitle: 'Solid Hifz & Retention',
          desc: 'A structured personalized memorization plan with daily cumulative review to firmly root the Quran in the heart.',
          badge: 'Most Popular',
          features: ['One-on-one live recitation', 'Mutashabihat retention techniques', 'Weekly progress reporting']
        },
        {
          id: 'ijaza',
          icon: Award,
          title: 'Ijaza & Tajweed Rules Track',
          subtitle: 'Continuous Sanad to the Prophet ﷺ',
          desc: 'Deep theoretical and practical study of articulation points, letter characteristics, and recitation for high Sanad certification.',
          badge: 'High Isnad',
          features: ['Sanad-linked recitation', 'Precision phonetics correction', 'Al-Jazariyyah & Tuhfat Al-Atfal']
        },
        {
          id: 'foundation',
          icon: GraduationCap,
          title: 'Kids Foundation & Noor Al-Bayan',
          subtitle: 'For Ages 4 to 12',
          desc: 'Engaging interactive program teaching Arabic reading from scratch, short Surahs, and Islamic manners with fun storytelling.',
          badge: 'For Kids & Youth',
          features: ['Interactive Noor Al-Bayan method', 'Patient teachers skilled with children', 'Educational games & badges']
        }
      ],
      step2Title: 'Student Details & Experience',
      step2Subtitle: 'This info helps us match the student with the most suitable male or female teacher',
      studentNameLabel: 'Student Full Name',
      studentNamePlaceholder: 'e.g. Zaid Mohammed / Maryam Ali',
      ageLabel: 'Student Age (in years)',
      agePlaceholder: 'e.g. 8',
      genderLabel: 'Student Gender (for teacher assignment)',
      male: 'Male (Boy / Man)',
      maleSub: 'Will be assigned a certified male Sheikh',
      female: 'Female (Girl / Woman)',
      femaleSub: 'Will be assigned a certified female Teacher',
      genderNotice: 'Full Privacy: Female students and young girls are exclusively taught by certified female instructors.',
      levelLabel: 'Current Quran Level',
      levels: [
        { id: 'beginner', title: 'Complete Beginner', desc: 'Starting from alphabet or short surahs' },
        { id: 'some_juz', title: 'Memorized 1 - 3 Juz', desc: 'Basic reading and memorization' },
        { id: 'intermediate', title: 'Memorized 4 - 10 Juz', desc: 'Intermediate level needing revision' },
        { id: 'advanced', title: 'Advanced / 10+ Juz', desc: 'Fluent, aiming for completion or Ijaza' },
      ],
      step3Title: 'Guardian & Contact Details',
      step3Subtitle: 'We will send the virtual classroom link, confirmation, and assessment report via WhatsApp',
      guardianNameLabel: 'Guardian / Contact Name',
      guardianNamePlaceholder: 'e.g. Mohammed Ali',
      countryLabel: 'Country & Dialing Code',
      whatsappLabel: 'Active WhatsApp Number',
      whatsappPlaceholder: '501234567',
      whatsappHint: 'Please enter the number without the leading zero and without country code (selected above). We will send the room link via WhatsApp.',
      emailLabel: 'Email Address (Optional)',
      emailPlaceholder: 'example@gmail.com',
      step4Title: 'Choose Your Preferred Timing',
      step4Subtitle: 'Select your preferred time slot and day; we will confirm the exact appointment via WhatsApp',
      periodLabel: 'Preferred Time Period',
      morningPeriod: 'Morning (08:00 AM - 01:00 PM)',
      eveningPeriod: 'Evening (04:00 PM - 10:00 PM)',
      flexiblePeriod: 'Flexible / Any time suitable for Academy',
      dayLabel: 'Preferred Day for Trial',
      days: [
        { id: 'today', title: 'Today if possible', desc: 'Earliest available' },
        { id: 'tomorrow', title: 'Tomorrow', desc: 'At chosen slot' },
        { id: 'weekend', title: 'Weekend', desc: 'Friday or Saturday' },
        { id: 'custom', title: 'Specific Date', desc: 'Choose from calendar' }
      ],
      customDateLabel: 'Select Date',
      notesLabel: 'Special goals or requests (Optional)',
      notesPlaceholder: 'e.g. Focus on Tajweed articulation, or start from Juz Amma...',
      summaryTitle: 'Trial Reservation Summary',
      next: 'Continue to Next Step',
      prev: 'Previous Step',
      submitBtn: 'Confirm 100% Free Trial Now',
      submittingBtn: 'Registering your trial session...',
      successTitle: 'Congratulations! Free Trial Session Reserved',
      successSubtitle: 'Welcome to Wahy Wa Namaa Academy. Your request is now being processed by our academic advisory team.',
      refNumber: 'Your Booking Reference ID',
      copyRef: 'Copy Code',
      copied: 'Copied!',
      freeNoticeBadge: '100% Free Session — No Financial Obligation',
      whatHappensNext: 'What Happens Next?',
      stepsNext: [
        {
          num: '1',
          title: 'Matching the Ideal Teacher',
          desc: 'Our academic advisor pairs the student with the best certified teacher fitting their age and level.'
        },
        {
          num: '2',
          title: 'WhatsApp Confirmation',
          desc: 'We reach out via WhatsApp to confirm the exact hour and send the direct virtual classroom link.'
        },
        {
          num: '3',
          title: 'Attend Class & Get Report',
          desc: 'Attend the 1-on-1 session and receive a complimentary level assessment and personalized study plan.'
        }
      ],
      whatsappBtn: 'Confirm Appointment Now via WhatsApp',
      homeBtn: 'Back to Home',
      exploreBtn: 'Explore Courses'
    }
  };

  const text = strings[activeLocale] || (isRTL ? strings.ar : strings.en);

  const validateStep = (stepNumber) => {
    const errs = {};
    if (stepNumber === 1) {
      if (!formData.track) errs.track = chrome.errTrack;
    } else if (stepNumber === 2) {
      if (!formData.studentName.trim()) errs.studentName = chrome.errName;
      if (!formData.age || isNaN(formData.age) || Number(formData.age) < 3 || Number(formData.age) > 99) {
        errs.age = chrome.errAge;
      }
      if (!formData.gender) errs.gender = chrome.errGender;
    } else if (stepNumber === 3) {
      if (!formData.guardianName.trim()) errs.guardianName = chrome.errGuardian;
      const cleanPhone = formData.whatsapp.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 6) errs.whatsapp = chrome.errWhatsapp;
    } else if (stepNumber === 4) {
      if (formData.preferredDay === 'custom' && !formData.customDate) {
        errs.customDate = chrome.errCustomDate;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const generateReferenceNumber = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `WAHY-TR-${randomNum}`;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    if (!validateStep(4)) return;

    setIsSubmitting(true);

    const ref = generateReferenceNumber();
    setBookingRef(ref);

    const payload = {
      referenceNumber: ref,
      track: formData.track,
      studentName: formData.studentName.trim(),
      age: Number(formData.age),
      gender: formData.gender,
      currentLevel: formData.currentLevel,
      guardianName: formData.guardianName.trim(),
      countryCode: formData.countryCode,
      whatsapp: `${formData.countryCode}${formData.whatsapp.trim().replace(/^0+/, '')}`,
      email: formData.email.trim() || undefined,
      preferredPeriod: formData.preferredPeriod,
      preferredDay: formData.preferredDay,
      customDate: formData.customDate || undefined,
      notes: formData.notes.trim() || undefined,
      locale: activeLocale,
      createdAt: new Date().toISOString()
    };

    try {
      await api.post('/api/trials', payload);
      setErrors((current) => ({ ...current, submit: undefined }));
      setStep('success');
    } catch (err) {
      setErrors((current) => ({
        ...current,
        submit: err?.message || chrome.errSubmit,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWhatsAppConfirmationUrl = () => {
    const rawNumber = SOCIAL_LINKS.whatsapp.replace(/\D/g, '');
    if (!rawNumber) return '';
    const trackNames = chrome.trackNames;
    const periodNames = {
      morning: isRTL ? 'الفترة الصباحية' : 'Morning',
      evening: isRTL ? 'الفترة المسائية' : 'Evening',
      flexible: isRTL ? 'أي وقت مناسب' : 'Flexible'
    };

    const message = isRTL
      ? `السلام عليكم ورحمة الله وبركاته\nأكاديمية وَحْيٌ وَنَمَاء — أود تأكيد موعد الحصة التجريبية المجانية:\n• رقم الحجز: ${bookingRef}\n• اسم الطالب: ${formData.studentName}\n• السن: ${formData.age} ${chrome.ageYears} (${formData.gender === 'male' ? chrome.maleShort : chrome.femaleShort})\n• المسار: ${trackNames[formData.track]}\n• الفترة المفضلة: ${periodNames[formData.preferredPeriod]}\n• رقم التواصل: ${formData.countryCode} ${formData.whatsapp}\n\nأرجو تأكيد الموعد وإرسال رابط القاعة الافتراضية، جزاكم الله خيراً.`
      : `Assalamu Alaikum,\nWahy Wa Namaa Academy — I would like to confirm my Free Trial Class:\n• Booking Ref: ${bookingRef}\n• Student Name: ${formData.studentName}\n• Age: ${formData.age} (${formData.gender})\n• Track: ${trackNames[formData.track]}\n• Preferred Time: ${periodNames[formData.preferredPeriod]}\n\nPlease confirm our slot and send the virtual class link. Jazakum Allah Khair.`;

    return `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleCopyRef = () => {
    if (!bookingRef) return;
    navigator.clipboard?.writeText(bookingRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 3000);
  };

  const fieldCls = (hasError) =>
    `w-full min-h-[44px] rounded-xl border bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
      hasError
        ? 'border-[var(--wn-danger)] focus:ring-[var(--wn-danger)]/20'
        : 'border-[var(--wn-border-strong)] focus:border-[var(--wn-emerald)] focus:ring-[var(--wn-emerald)]/20'
    }`;

  return (
    <div className="wn-trial-surface min-h-screen flex flex-col" dir={dir}>
      <SEOHead page={{
        title: text.title,
        description: text.subtitle,
        url: '/free-trial',
        type: 'website',
        schema: [
          createWebPageSchema({
            name: text.title,
            description: text.subtitle,
            url: '/free-trial',
            type: 'WebPage',
          }),
          createBreadcrumbSchema([
            { name: chrome.home, url: '/' },
            { name: text.title, url: '/free-trial' },
          ]),
        ],
      }} />
      <GlobalHeader />

      <main className="relative overflow-hidden bg-[var(--wn-bg)] pt-8 pb-16 flex-1">
        <div className="absolute inset-0 azhar-star-pattern opacity-40 pointer-events-none" aria-hidden="true" />
        <div className="absolute -top-24 end-1/4 w-96 h-96 rounded-full bg-[var(--wn-gold)]/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-1/3 start-10 w-80 h-80 rounded-full bg-[var(--wn-emerald-soft)]/60 blur-2xl pointer-events-none" aria-hidden="true" />

        <div className="page-container relative z-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] px-4 py-1.5 text-xs md:text-sm font-semibold text-[var(--wn-text-gold)] shadow-sm mb-4">
              <Sparkles size={16} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
              <span>{text.badge}</span>
            </div>

            <h1 className="font-amiri text-3xl md:text-5xl font-bold text-[var(--wn-heading)] leading-tight mb-4">
              {text.title}
            </h1>

            <p className="text-[var(--wn-text-secondary)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              {text.subtitle}
            </p>

            <div className="mt-4 inline-flex items-center justify-center gap-2 text-xs md:text-sm text-[var(--wn-heading)] font-medium bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-full py-1.5 px-4 mx-auto">
              <ShieldCheck size={16} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
              <span>{text.guarantee}</span>
            </div>
          </div>

          {/* Stepper */}
          {step !== 'success' && (
            <div className="max-w-4xl mx-auto mb-8">
              <div className="rounded-2xl bg-[var(--wn-surface)] p-3 md:p-5 border border-[var(--wn-border)] shadow-md">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4 relative">
                  {text.steps.map((s) => {
                    const isCompleted = step > s.num;
                    const isActive = step === s.num;
                    const canJump = s.num < step;
                    return (
                      <button
                        key={s.num}
                        type="button"
                        disabled={!canJump && !isActive}
                        aria-current={isActive ? 'step' : undefined}
                        onClick={() => {
                          if (canJump) setStep(s.num);
                        }}
                        className={`min-h-[44px] flex flex-col items-center text-center p-2.5 rounded-xl transition select-none ${
                          isActive
                            ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] ring-2 ring-[var(--wn-gold)]/70'
                            : isCompleted
                            ? 'text-[var(--wn-link)] hover:bg-[var(--wn-surface-mint)] cursor-pointer'
                            : 'text-[var(--wn-text-tertiary)] opacity-75 cursor-not-allowed'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-bold mb-1.5 transition ${
                            isActive
                              ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-md ring-2 ring-[var(--wn-gold)]'
                              : isCompleted
                              ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                              : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]'
                          }`}
                        >
                          {isCompleted ? <Check size={18} strokeWidth={2.5} aria-hidden="true" /> : s.num}
                        </div>
                        <span className="text-xs md:text-sm font-bold truncate w-full">
                          {s.title}
                        </span>
                        <span className="hidden md:inline text-xs text-[var(--wn-text-secondary)] truncate w-full">
                          {s.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Wizard Form Card */}
          <div className="max-w-3xl mx-auto">
            {step !== 'success' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step < 4) handleNext();
                  else handleSubmit(e);
                }}
                noValidate
                className="rounded-3xl p-6 md:p-10 shadow-xl bg-[var(--wn-surface)] border border-[var(--wn-border)]"
              >
                {/* Step 1: Track */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="border-b border-[var(--wn-border)] pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--wn-heading)]">
                        {text.step1Title}
                      </h2>
                      <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                        {text.step1Subtitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4" role="group" aria-label={text.step1Title}>
                      {text.tracks.map((trackItem) => {
                        const Icon = trackItem.icon;
                        const isSelected = formData.track === trackItem.id;
                        return (
                          <button
                            key={trackItem.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setFormData({ ...formData, track: trackItem.id })}
                            className={`w-full text-start relative rounded-2xl p-5 border-2 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] shadow-md ring-2 ring-[var(--wn-gold)]/50'
                                : 'border-[var(--wn-border)] hover:border-[var(--wn-gold)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)]'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                                  isSelected
                                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-md'
                                    : 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border)]'
                                }`}
                              >
                                <Icon size={24} aria-hidden="true" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-lg text-[var(--wn-heading)]">
                                    {trackItem.title}
                                  </h3>
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border border-[var(--wn-border)]">
                                    <Star size={12} aria-hidden="true" />
                                    {trackItem.badge}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--wn-text-secondary)] leading-relaxed mb-3">
                                  {trackItem.desc}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {trackItem.features.map((feat, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-xs text-[var(--wn-heading)] bg-[var(--wn-surface)] border border-[var(--wn-border-mint)] rounded-md px-2 py-0.5"
                                    >
                                      <CheckCircle2 size={12} className="text-[var(--wn-link)]" aria-hidden="true" />
                                      {feat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Student Info */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="border-b border-[var(--wn-border)] pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--wn-heading)]">
                        {text.step2Title}
                      </h2>
                      <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                        {text.step2Subtitle}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="trial-student-name" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.studentNameLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute start-3 top-3.5 text-[var(--wn-text-tertiary)] pointer-events-none" size={18} aria-hidden="true" />
                        <input
                          id="trial-student-name"
                          type="text"
                          value={formData.studentName}
                          onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                          placeholder={text.studentNamePlaceholder}
                          aria-invalid={Boolean(errors.studentName)}
                          aria-describedby={errors.studentName ? 'err-student-name' : undefined}
                          className={`${fieldCls(errors.studentName)} ps-10`}
                        />
                      </div>
                      {errors.studentName && (
                        <p id="err-student-name" role="alert" className="text-xs text-[var(--wn-text-danger,var(--wn-danger))] mt-1">{errors.studentName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="trial-student-age" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.ageLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </label>
                      <input
                        id="trial-student-age"
                        type="number"
                        min="3"
                        max="99"
                        inputMode="numeric"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        placeholder={text.agePlaceholder}
                        aria-invalid={Boolean(errors.age)}
                        aria-describedby={errors.age ? 'err-student-age' : undefined}
                        className={fieldCls(errors.age)}
                      />
                      {errors.age && (
                        <p id="err-student-age" role="alert" className="text-xs text-[var(--wn-text-danger,var(--wn-danger))] mt-1">{errors.age}</p>
                      )}
                    </div>

                    <fieldset>
                      <legend className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-2">
                        {text.genderLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          aria-pressed={formData.gender === 'male'}
                          onClick={() => setFormData({ ...formData, gender: 'male' })}
                          className={`min-h-[44px] text-start p-4 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                            formData.gender === 'male'
                              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] ring-2 ring-[var(--wn-gold)]/40 shadow-sm'
                              : 'border-[var(--wn-border)] hover:border-[var(--wn-border-strong)] bg-[var(--wn-surface)]'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-[var(--wn-surface-mint)] text-[var(--wn-heading)] flex items-center justify-center shrink-0">
                            <User size={20} aria-hidden="true" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[var(--wn-heading)]">{text.male}</div>
                            <div className="text-xs text-[var(--wn-text-secondary)]">{text.maleSub}</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          aria-pressed={formData.gender === 'female'}
                          onClick={() => setFormData({ ...formData, gender: 'female' })}
                          className={`min-h-[44px] text-start p-4 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                            formData.gender === 'female'
                              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] ring-2 ring-[var(--wn-gold)]/40 shadow-sm'
                              : 'border-[var(--wn-border)] hover:border-[var(--wn-border-strong)] bg-[var(--wn-surface)]'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-[var(--wn-women-soft)] text-[var(--wn-women-accent)] flex items-center justify-center shrink-0">
                            <ShieldCheck size={20} aria-hidden="true" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[var(--wn-heading)]">{text.female}</div>
                            <div className="text-xs text-[var(--wn-text-secondary)]">{text.femaleSub}</div>
                          </div>
                        </button>
                      </div>

                      <div className="mt-3 p-3 rounded-xl bg-[var(--wn-gold-soft)] border border-[var(--wn-border)] text-xs text-[var(--wn-text-primary)] flex items-start gap-2">
                        <Lock size={16} className="text-[var(--wn-text-gold)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{text.genderNotice}</span>
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-2">
                        {text.levelLabel}
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {text.levels.map((lvl) => {
                          const isSelected = formData.currentLevel === lvl.id;
                          return (
                            <button
                              key={lvl.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setFormData({ ...formData, currentLevel: lvl.id })}
                              className={`min-h-[44px] text-start p-3 rounded-xl border cursor-pointer transition ${
                                isSelected
                                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] font-semibold ring-1 ring-[var(--wn-gold)]/40'
                                  : 'border-[var(--wn-border)] hover:border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                              }`}
                            >
                              <div className="text-sm font-bold">{lvl.title}</div>
                              <div className="text-xs text-[var(--wn-text-secondary)] mt-0.5">{lvl.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                )}

                {/* Step 3: Contact Info */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="border-b border-[var(--wn-border)] pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--wn-heading)]">
                        {text.step3Title}
                      </h2>
                      <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                        {text.step3Subtitle}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="trial-guardian-name" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.guardianNameLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </label>
                      <div className="relative">
                        <Users className="absolute start-3 top-3.5 text-[var(--wn-text-tertiary)] pointer-events-none" size={18} aria-hidden="true" />
                        <input
                          id="trial-guardian-name"
                          type="text"
                          value={formData.guardianName}
                          onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                          placeholder={text.guardianNamePlaceholder}
                          aria-invalid={Boolean(errors.guardianName)}
                          aria-describedby={errors.guardianName ? 'err-guardian-name' : undefined}
                          className={`${fieldCls(errors.guardianName)} ps-10`}
                        />
                      </div>
                      {errors.guardianName && (
                        <p id="err-guardian-name" role="alert" className="text-xs text-[var(--wn-text-danger,var(--wn-danger))] mt-1">{errors.guardianName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="trial-country-code" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.countryLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </label>
                      <select
                        id="trial-country-code"
                        value={formData.countryCode}
                        onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                        className={fieldCls(false)}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code + c.nameEn} value={c.code}>
                            {isRTL ? c.nameAr : c.nameEn} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="trial-whatsapp" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.whatsappLabel} <span className="text-[var(--wn-text-danger,var(--wn-danger))]">*</span>
                      </label>
                      <div className="flex gap-2" dir="ltr">
                        <div className="min-h-[44px] rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface-sunken)] px-3 py-2.5 text-sm font-bold text-[var(--wn-text-primary)] flex items-center justify-center min-w-[70px]">
                          {formData.countryCode}
                        </div>
                        <div className="relative flex-1">
                          <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wn-link)] pointer-events-none" size={18} aria-hidden="true" />
                          <input
                            id="trial-whatsapp"
                            type="tel"
                            inputMode="tel"
                            value={formData.whatsapp}
                            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                            placeholder={text.whatsappPlaceholder}
                            aria-invalid={Boolean(errors.whatsapp)}
                            aria-describedby={errors.whatsapp ? 'err-whatsapp trial-whatsapp-hint' : 'trial-whatsapp-hint'}
                            className={`${fieldCls(errors.whatsapp)} pl-10 pr-4 text-left`}
                          />
                        </div>
                      </div>
                      <p id="trial-whatsapp-hint" className="text-xs text-[var(--wn-text-secondary)] mt-1.5 leading-relaxed flex items-start gap-1.5">
                        <Phone size={14} className="shrink-0 mt-0.5 text-[var(--wn-link)]" aria-hidden="true" />
                        <span>{text.whatsappHint}</span>
                      </p>
                      {errors.whatsapp && (
                        <p id="err-whatsapp" role="alert" className="text-xs text-[var(--wn-text-danger,var(--wn-danger))] mt-1">{errors.whatsapp}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="trial-email" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.emailLabel}
                      </label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-3.5 text-[var(--wn-text-tertiary)] pointer-events-none" size={18} aria-hidden="true" />
                        <input
                          id="trial-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder={text.emailPlaceholder}
                          className={`${fieldCls(false)} ps-10`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Preferred Timing */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="border-b border-[var(--wn-border)] pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--wn-heading)]">
                        {text.step4Title}
                      </h2>
                      <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                        {text.step4Subtitle}
                      </p>
                    </div>

                    <fieldset>
                      <legend className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-2">
                        {text.periodLabel}
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: 'morning', label: text.morningPeriod, Icon: Sun },
                          { id: 'evening', label: text.eveningPeriod, Icon: Sunset },
                          { id: 'flexible', label: text.flexiblePeriod, Icon: Clock },
                        ].map(({ id, label, Icon }) => {
                          const active = formData.preferredPeriod === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setFormData({ ...formData, preferredPeriod: id })}
                              className={`min-h-[44px] p-3.5 rounded-xl border-2 cursor-pointer transition text-center flex flex-col items-center justify-center gap-1.5 ${
                                active
                                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] font-bold ring-1 ring-[var(--wn-gold)]/40 shadow-sm'
                                  : 'border-[var(--wn-border)] hover:border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                              }`}
                            >
                              <Icon size={20} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                              <span className="text-sm">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-2">
                        {text.dayLabel}
                      </legend>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {text.days.map((d) => {
                          const active = formData.preferredDay === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setFormData({ ...formData, preferredDay: d.id })}
                              className={`min-h-[44px] p-3 rounded-xl border text-center cursor-pointer transition ${
                                active
                                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] font-bold ring-1 ring-[var(--wn-gold)]/30'
                                  : 'border-[var(--wn-border)] hover:border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                              }`}
                            >
                              <div className="text-sm font-bold">{d.title}</div>
                              <div className="text-xs text-[var(--wn-text-secondary)] mt-0.5">{d.desc}</div>
                            </button>
                          );
                        })}
                      </div>

                      {formData.preferredDay === 'custom' && (
                        <div className="mt-3">
                          <label htmlFor="trial-custom-date" className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                            {text.customDateLabel}
                          </label>
                          <input
                            id="trial-custom-date"
                            type="date"
                            value={formData.customDate}
                            onChange={(e) => setFormData({ ...formData, customDate: e.target.value })}
                            aria-invalid={Boolean(errors.customDate)}
                            aria-describedby={errors.customDate ? 'err-custom-date' : undefined}
                            className={fieldCls(errors.customDate)}
                          />
                          {errors.customDate && (
                            <p id="err-custom-date" role="alert" className="text-xs text-[var(--wn-text-danger,var(--wn-danger))] mt-1">{errors.customDate}</p>
                          )}
                        </div>
                      )}
                    </fieldset>

                    <div>
                      <label htmlFor="trial-notes" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                        {text.notesLabel}
                      </label>
                      <textarea
                        id="trial-notes"
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder={text.notesPlaceholder}
                        className="w-full rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[var(--wn-emerald)] focus:ring-[var(--wn-emerald)]/20"
                      />
                    </div>

                    {/* Localized Summary Box */}
                    <div className="rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-4 space-y-2 text-sm">
                      <div className="font-bold text-[var(--wn-text-gold)] flex items-center gap-1.5 mb-2">
                        <CheckCircle2 size={16} className="text-[var(--wn-link)]" aria-hidden="true" />
                        <span>{text.summaryTitle}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-[var(--wn-text-primary)]">
                        <div>
                          <span className="text-[var(--wn-text-secondary)]">{chrome.studentLabel}:</span>{' '}
                          <span className="font-semibold">{formData.studentName || '—'}</span>{' '}
                          ({formData.age} {chrome.ageYears} / {formData.gender === 'male' ? chrome.maleShort : chrome.femaleShort})
                        </div>
                        <div>
                          <span className="text-[var(--wn-text-secondary)]">{chrome.trackLabel}:</span>{' '}
                          <span className="font-semibold">
                            {chrome.trackNames[formData.track] || formData.track}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--wn-text-secondary)]">{chrome.contactLabel}:</span>{' '}
                          <span className="font-semibold">{formData.guardianName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--wn-text-secondary)]">{chrome.whatsappSummaryLabel}:</span>{' '}
                          <span className="font-semibold" dir="ltr">{formData.countryCode} {formData.whatsapp || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {errors.submit ? (
                  <div role="alert" className="mt-6 rounded-xl border border-[var(--wn-danger)]/40 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-text-danger,var(--wn-danger))]">
                    {errors.submit}
                  </div>
                ) : null}

                <div className="mt-8 pt-6 border-t border-[var(--wn-border)] flex flex-wrap items-center justify-between gap-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="btn-secondary min-h-[44px] !py-2.5 !px-5 text-sm font-semibold flex items-center gap-2"
                    >
                      {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
                      <span>{text.prev}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="submit"
                      className="btn-primary min-h-[44px] !py-2.5 !px-6 text-sm font-semibold flex items-center gap-2"
                    >
                      <span>{text.next}</span>
                      {isRTL ? <ArrowLeft size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="btn-gold min-h-[44px] !py-3 !px-7 text-sm md:text-base font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-5 h-5 border-2 border-[var(--wn-emerald-deep)] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                          <span>{text.submittingBtn}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} aria-hidden="true" />
                          <span>{text.submitBtn}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              /* Success State */
              <div className="rounded-3xl !p-8 md:!p-12 text-center bg-[var(--wn-surface)] border-2 border-[var(--wn-border-strong)] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[var(--wn-emerald-deep)] via-[var(--wn-gold)] to-[var(--wn-emerald-deep)]" />

                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full bg-[var(--wn-emerald-soft)] border-4 border-[var(--wn-border-mint)] flex items-center justify-center text-[var(--wn-heading)] shadow-xl mb-6">
                  <CheckCircle2 size={48} strokeWidth={2.5} aria-hidden="true" />
                </div>

                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] text-xs md:text-sm font-bold mb-3">
                  <Sparkles size={14} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                  <span>{text.freeNoticeBadge}</span>
                </div>

                <h2 className="text-2xl md:text-4xl font-bold font-amiri text-[var(--wn-heading)] mb-3">
                  {text.successTitle}
                </h2>

                <p className="text-[var(--wn-text-secondary)] text-sm md:text-base max-w-xl mx-auto leading-relaxed mb-6">
                  {text.successSubtitle}
                </p>

                <div className="rounded-2xl border-2 border-dashed border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-4 md:p-5 max-w-md mx-auto mb-8 shadow-sm">
                  <div className="text-xs text-[var(--wn-text-secondary)] font-semibold mb-1">
                    {text.refNumber}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="text-xl md:text-2xl font-mono font-extrabold text-[var(--wn-heading)] tracking-wider" dir="ltr">
                      {bookingRef}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      title={text.copyRef}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] hover:bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] transition flex items-center gap-1.5 text-xs font-semibold"
                    >
                      {copiedRef ? (
                        <>
                          <Check size={14} className="text-[var(--wn-link)]" aria-hidden="true" />
                          <span className="text-[var(--wn-heading)]">{text.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} aria-hidden="true" />
                          <span>{text.copyRef}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-start max-w-lg mx-auto mb-8 bg-[var(--wn-surface-soft)] p-5 rounded-2xl border border-[var(--wn-border)]">
                  <h3 className="font-bold text-[var(--wn-heading)] text-sm md:text-base mb-3 flex items-center gap-2">
                    <FileCheck size={18} className="text-[var(--wn-link)]" aria-hidden="true" />
                    <span>{text.whatHappensNext}</span>
                  </h3>
                  <div className="space-y-3">
                    {text.stepsNext.map((st) => (
                      <div key={st.num} className="flex items-start gap-3 text-xs md:text-sm">
                        <div className="w-6 h-6 rounded-full bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] font-bold flex items-center justify-center flex-shrink-0 text-xs">
                          {st.num}
                        </div>
                        <div>
                          <span className="font-bold text-[var(--wn-text-primary)]">{st.title}: </span>
                          <span className="text-[var(--wn-text-secondary)]">{st.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  {SOCIAL_LINKS.whatsapp ? (
                    <a
                      href={getWhatsAppConfirmationUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] w-full inline-flex items-center justify-center gap-3 rounded-xl py-3.5 px-6 font-bold text-white text-base shadow-lg transition hover:brightness-110"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle size={22} aria-hidden="true" />
                      <span>{text.whatsappBtn}</span>
                    </a>
                  ) : (
                    <Link
                      to={lp('/contact')}
                      className="btn-primary min-h-[44px] w-full inline-flex items-center justify-center gap-2 !py-3.5"
                    >
                      <MessageCircle size={20} aria-hidden="true" />
                      <span>{chrome.contactTeam}</span>
                    </Link>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link
                      to={lp('/')}
                      className="btn-secondary min-h-[44px] inline-flex items-center justify-center !py-2.5 !px-5 text-xs md:text-sm font-semibold"
                    >
                      {text.homeBtn}
                    </Link>
                    <Link
                      to={lp('/courses')}
                      className="btn-primary min-h-[44px] inline-flex items-center justify-center !py-2.5 !px-5 text-xs md:text-sm font-semibold"
                    >
                      {text.exploreBtn}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="mt-16 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-5 rounded-2xl bg-[var(--wn-surface)] border border-[var(--wn-border)] shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] flex items-center justify-center mx-auto mb-3">
                <Award size={24} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-[var(--wn-heading)] text-sm mb-1">
                {chrome.trust1Title}
              </h3>
              <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed">
                {chrome.trust1Desc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--wn-surface)] border border-[var(--wn-border)] shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-[var(--wn-heading)] text-sm mb-1">
                {chrome.trust2Title}
              </h3>
              <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed">
                {chrome.trust2Desc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--wn-surface)] border border-[var(--wn-border)] shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[var(--wn-surface-mint)] text-[var(--wn-link)] flex items-center justify-center mx-auto mb-3">
                <Star size={24} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-[var(--wn-heading)] text-sm mb-1">
                {chrome.trust3Title}
              </h3>
              <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed">
                {chrome.trust3Desc}
              </p>
            </div>
          </div>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
