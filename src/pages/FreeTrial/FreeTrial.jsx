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
  FileCheck
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

// قائمة الدول ومفاتيح الاتصال العالمية
const COUNTRY_CODES = [
  { code: '+966', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+20', nameAr: 'مصر', nameEn: 'Egypt', flag: '🇪🇬' },
  { code: '+971', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+965', nameAr: 'الكويت', nameEn: 'Kuwait', flag: '🇰🇼' },
  { code: '+974', nameAr: 'قطر', nameEn: 'Qatar', flag: '🇶🇦' },
  { code: '+968', nameAr: 'سلطنة عُمان', nameEn: 'Oman', flag: '🇴🇲' },
  { code: '+973', nameAr: 'البحرين', nameEn: 'Bahrain', flag: '🇧🇭' },
  { code: '+962', nameAr: 'الأردن', nameEn: 'Jordan', flag: '🇯🇴' },
  { code: '+1', nameAr: 'الولايات المتحدة / كندا', nameEn: 'USA / Canada', flag: '🇺🇸' },
  { code: '+44', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', flag: '🇬🇧' },
  { code: '+49', nameAr: 'ألمانيا', nameEn: 'Germany', flag: '🇩🇪' },
  { code: '+33', nameAr: 'فرنسا', nameEn: 'France', flag: '🇫🇷' },
  { code: '+90', nameAr: 'تركيا', nameEn: 'Turkey', flag: '🇹🇷' },
  { code: '+60', nameAr: 'ماليزيا', nameEn: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', nameAr: 'إندونيسيا', nameEn: 'Indonesia', flag: '🇮🇩' },
  { code: '+212', nameAr: 'المغرب', nameEn: 'Morocco', flag: '🇲🇦' },
  { code: '+213', nameAr: 'الجزائر', nameEn: 'Algeria', flag: '🇩🇿' },
  { code: '+216', nameAr: 'تونس', nameEn: 'Tunisia', flag: '🇹🇳' },
  { code: '+249', nameAr: 'السودان', nameEn: 'Sudan', flag: '🇸🇩' },
  { code: '+964', nameAr: 'العراق', nameEn: 'Iraq', flag: '🇮🇶' },
  { code: '+961', nameAr: 'لبنان', nameEn: 'Lebanon', flag: '🇱🇧' },
  { code: '+970', nameAr: 'فلسطين', nameEn: 'Palestine', flag: '🇵🇸' },
  { code: '+967', nameAr: 'اليمن', nameEn: 'Yemen', flag: '🇾🇪' },
  { code: '+31', nameAr: 'هولندا', nameEn: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', nameAr: 'السويد', nameEn: 'Sweden', flag: '🇸🇪' },
  { code: '+61', nameAr: 'أستراليا', nameEn: 'Australia', flag: '🇦🇺' },
];

export default function FreeTrial() {
  const { locale, isRTL } = useI18n();
  const { locale: paramLocale } = useParams();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const activeLocale = paramLocale || locale || DEFAULT_LOCALE;
  const lp = (path) => localizedPath(path, activeLocale);

  // حالة الخطوة الحالية: 1, 2, 3, 4 أو 'success'
  const [step, setStep] = useState(1);

  // نموذج البيانات
  const [formData, setFormData] = useState({
    track: 'memorization', // memorization | ijaza | foundation
    studentName: '',
    age: '',
    gender: 'male', // male | female
    currentLevel: 'beginner', // beginner | some_juz | intermediate | advanced
    guardianName: '',
    countryCode: '+966',
    whatsapp: '',
    email: '',
    preferredPeriod: 'evening', // morning | evening | flexible
    preferredDay: 'tomorrow', // today | tomorrow | weekend | custom
    customDate: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    document.title = activeLocale === 'ar'
      ? 'احجز حصتك التجريبية المجانية 100% | أكاديمية وَحْيٌ وَنَمَاء'
      : 'Book 100% Free Trial Class | Wahy Wa Namaa Academy';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, activeLocale]);

  // نصوص واجهة متعددة اللغات
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
      // Step 1
      step1Title: 'اختر المسار التعليمي المناسب للطالب',
      step1Subtitle: 'كل مسار مبني على مستويات متدرجة ويقدمه معلمون ومعلمات متخصصون',
      tracks: [
        {
          id: 'memorization',
          icon: BookOpen,
          title: 'مسار التحفيظ والمراجعة المتقنة',
          subtitle: 'حفظ جديد وتثبيت متين',
          desc: 'خطة حفظ فردية متدرجة مع مراجعة تراكمية يومية لضبط الآيات وتثبيت الحفظ في الصدور تحت إشراف نخبة مجازة.',
          badge: 'الأكثر إقبالاً ⭐',
          features: ['حفظ وتسميع فردي مباشر', 'تثبيت بالمتشابهات القرآنية', 'تقرير إنجاز أسبوعي']
        },
        {
          id: 'ijaza',
          icon: Award,
          title: 'مسار الإجازة وأحكام التجويد',
          subtitle: 'مسار متقدم للإقراء والإجازة عند توفر معلم مؤهل',
          desc: 'دراسة عملية ونظرية دقيقة لمخارج وصفات الحروف، وأحكام التجويد، مع تدريب متقدم على الإقراء وأحكام التجويد وفق مستوى الطالب والمعلم المتاح.',
          badge: 'إتقان وإسناد 📜',
          features: ['تصحيح متقدم للتلاوة', 'تصحيح دقيق لمخارج الحروف', 'شرح الجزرية وتحفة الأطفال']
        },
        {
          id: 'foundation',
          icon: GraduationCap,
          title: 'مسار تأسيس الأطفال ونور البيان',
          subtitle: 'من سن 4 إلى 12 سنة',
          desc: 'منهج تفاعلي شيق لتعليم القراءة العربية السليمة، حفظ قصار السور، وغرس القيم الإسلامية والقصص النبوية بأسلوب مرح.',
          badge: 'للأطفال والبراعم 👶',
          features: ['طريقة نور البيان التفاعلية', 'معلمات متخصصات في تربية الأطفال', 'أنشطة وألعاب تحفيزية']
        }
      ],
      // Step 2
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
      genderNotice: '🔒 خصوصية تامة وأمان: نلتزم بتعيين معلمات متخصصات لجميع الطالبات والبنات، ومعلمين متخصصين للطلاب والرجال.',
      levelLabel: 'مستوى الحفظ الحالي للطالب',
      levels: [
        { id: 'beginner', title: 'مبتدئ تماماً', desc: 'من الحروف أو قصار السور فقط' },
        { id: 'some_juz', title: 'يحفظ 1 - 3 أجزاء', desc: 'لديه أساسيات القراءة والحفظ' },
        { id: 'intermediate', title: 'يحفظ 4 - 10 أجزاء', desc: 'مستوى متوسط يحتاج مراجعة وتجويد' },
        { id: 'advanced', title: 'متقدم / أكثر من 10 أجزاء', desc: 'متقن ويرغب في الإتمام أو الإجازة' },
      ],
      // Step 3
      step3Title: 'بيانات ولي الأمر ووسيلة التواصل',
      step3Subtitle: 'سنرسل لك عبر الواتساب رابط القاعة الافتراضية وموعد الحصة وتقرير التقييم',
      guardianNameLabel: 'اسم ولي الأمر / المتواصل',
      guardianNamePlaceholder: 'مثال: أبو محمد / أحمد عبد الله',
      countryLabel: 'الدولة ومفتاح الاتصال الدولي',
      whatsappLabel: 'رقم الواتساب الفعّال',
      whatsappPlaceholder: '501234567',
      whatsappHint: '📱 نرجو كتابة الرقم بدون الصفر الأول وبدون رمز الدولة (تم تحديده تلقائياً). سنرسل رابط القاعة والتأكيد عبر الواتساب.',
      emailLabel: 'البريد الإلكتروني (اختياري)',
      emailPlaceholder: 'example@gmail.com',
      // Step 4
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
      submitBtn: 'تأكيد حجز الحصة التجريبية مجاناً 🚀',
      submittingBtn: 'جاري تسجيل وتأكيد الحصة...',
      // Success State
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
      whatsappBtn: 'تأكيد موعد الحصة فوراً عبر الواتساب 💬',
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
          badge: 'Most Popular ⭐',
          features: ['One-on-one live recitation', 'Mutashabihat retention techniques', 'Weekly progress reporting']
        },
        {
          id: 'ijaza',
          icon: Award,
          title: 'Ijaza & Tajweed Rules Track',
          subtitle: 'Continuous Sanad to the Prophet ﷺ',
          desc: 'Deep theoretical and practical study of articulation points, letter characteristics, and recitation for high Sanad certification.',
          badge: 'High Isnad 📜',
          features: ['Sanad-linked recitation', 'Precision phonetics correction', 'Al-Jazariyyah & Tuhfat Al-Atfal']
        },
        {
          id: 'foundation',
          icon: GraduationCap,
          title: 'Kids Foundation & Noor Al-Bayan',
          subtitle: 'For Ages 4 to 12',
          desc: 'Engaging interactive program teaching Arabic reading from scratch, short Surahs, and Islamic manners with fun storytelling.',
          badge: 'For Kids & Youth 👶',
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
      genderNotice: '🔒 Full Privacy: Female students and young girls are exclusively taught by certified female instructors.',
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
      whatsappHint: '📱 Please enter the number without the leading zero and without country code (selected above). We will send the room link via WhatsApp.',
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
      submitBtn: 'Confirm 100% Free Trial Now 🚀',
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
      whatsappBtn: 'Confirm Appointment Now via WhatsApp 💬',
      homeBtn: 'Back to Home',
      exploreBtn: 'Explore Courses'
    }
  };

  const text = strings[activeLocale] || strings.ar;

  // التحقق من صحة كل خطوة
  const validateStep = (stepNumber) => {
    const errs = {};
    if (stepNumber === 1) {
      if (!formData.track) errs.track = activeLocale === 'ar' ? 'يرجى اختيار مسار تعليمي' : 'Please select a track';
    } else if (stepNumber === 2) {
      if (!formData.studentName.trim()) {
        errs.studentName = activeLocale === 'ar' ? 'يرجى إدخال اسم الطالب' : 'Student name is required';
      }
      if (!formData.age || isNaN(formData.age) || Number(formData.age) < 3 || Number(formData.age) > 99) {
        errs.age = activeLocale === 'ar' ? 'يرجى إدخال سن صالح (3-99 سنة)' : 'Please enter a valid age (3-99)';
      }
      if (!formData.gender) {
        errs.gender = activeLocale === 'ar' ? 'يرجى اختيار جنس الطالب' : 'Please select gender';
      }
    } else if (stepNumber === 3) {
      if (!formData.guardianName.trim()) {
        errs.guardianName = activeLocale === 'ar' ? 'يرجى إدخال اسم ولي الأمر أو المتواصل' : 'Contact name is required';
      }
      const cleanPhone = formData.whatsapp.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 6) {
        errs.whatsapp = activeLocale === 'ar' ? 'يرجى إدخال رقم واتساب صحيح' : 'Valid WhatsApp number is required';
      }
    } else if (stepNumber === 4) {
      if (formData.preferredDay === 'custom' && !formData.customDate) {
        errs.customDate = activeLocale === 'ar' ? 'يرجى تحديد التاريخ المفضل' : 'Please select a date';
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

  // توليد كود مرجعي عشوائي راقٍ
  const generateReferenceNumber = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `WAHY-TR-${randomNum}`;
  };

  // إرسال الحجز
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
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
        submit: err?.message || (
          activeLocale === 'ar'
            ? 'تعذر تسجيل الطلب الآن. حاول مرة أخرى أو استخدم نموذج التواصل.'
            : 'We could not save the request. Please try again or use the contact form.'
        ),
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // رابط واتساب الأكاديمية المباشر مع رسالة معدّة مسبقاً
  const getWhatsAppConfirmationUrl = () => {
    const rawNumber = SOCIAL_LINKS.whatsapp.replace(/\D/g, '');
    if (!rawNumber) return '';
    const trackNames = {
      memorization: activeLocale === 'ar' ? 'مسار التحفيظ والمراجعة' : 'Memorization Track',
      ijaza: activeLocale === 'ar' ? 'مسار الإجازة وأحكام التجويد' : 'Ijaza & Tajweed Track',
      foundation: activeLocale === 'ar' ? 'مسار تأسيس الأطفال' : 'Kids Foundation Track'
    };
    const periodNames = {
      morning: activeLocale === 'ar' ? 'الفترة الصباحية' : 'Morning',
      evening: activeLocale === 'ar' ? 'الفترة المسائية' : 'Evening',
      flexible: activeLocale === 'ar' ? 'أي وقت مناسب' : 'Flexible'
    };

    const message = activeLocale === 'ar'
      ? `السلام عليكم ورحمة الله وبركاته 🌿\nأكاديمية وَحْيٌ وَنَمَاء — أود تأكيد موعد الحصة التجريبية المجانية:\n• رقم الحجز: ${bookingRef}\n• اسم الطالب: ${formData.studentName}\n• السن: ${formData.age} سنة (${formData.gender === 'male' ? 'ذكر' : 'أنثى'})\n• المسار: ${trackNames[formData.track]}\n• الفترة المفضلة: ${periodNames[formData.preferredPeriod]}\n• رقم التواصل: ${formData.countryCode} ${formData.whatsapp}\n\nأرجو تأكيد الموعد وإرسال رابط القاعة الافتراضية، جزاكم الله خيراً.`
      : `Assalamu Alaikum,\nWahy Wa Namaa Academy — I would like to confirm my Free Trial Class:\n• Booking Ref: ${bookingRef}\n• Student Name: ${formData.studentName}\n• Age: ${formData.age} (${formData.gender})\n• Track: ${trackNames[formData.track]}\n• Preferred Time: ${periodNames[formData.preferredPeriod]}\n\nPlease confirm our slot and send the virtual class link. Jazakum Allah Khair.`;

    return `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleCopyRef = () => {
    if (!bookingRef) return;
    navigator.clipboard?.writeText(bookingRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 3000);
  };

  return (
    <div className="wn-trial-surface min-h-screen flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
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
            { name: locale === 'ar' ? 'الرئيسية' : 'Home', url: '/' },
            { name: text.title, url: '/free-trial' },
          ]),
        ],
      }} />
      <GlobalHeader />

      {/* ═══ الخلفية الأزهرية الفاخرة مع النمط الإسلامي ═══ */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[var(--athar-cream)]/70 via-white to-[var(--athar-warm-white)] pt-8 pb-16 flex-1">
        <div className="absolute inset-0 azhar-star-pattern opacity-40 pointer-events-none" aria-hidden="true" />

        {/* دوائر ضوئية خافتة في الخلفية */}
        <div className="absolute -top-24 end-1/4 w-96 h-96 rounded-full bg-[var(--azhar-gold-leaf)]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 start-10 w-80 h-80 rounded-full bg-[var(--azhar-green-50)] blur-2xl pointer-events-none" />

        <div className="page-container relative z-10">

          {/* ═══ الهيدر التعريفي الفاخر للصفحة ═══ */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--azhar-gold-leaf)]/40 bg-[var(--azhar-gold-50)] px-4 py-1.5 text-xs md:text-sm font-semibold text-[var(--azhar-gold-dark)] shadow-sm mb-4">
              <Sparkles size={16} className="text-[var(--azhar-gold-leaf)] animate-pulse" />
              <span>{text.badge}</span>
            </div>

            <h1 className="font-amiri text-3xl md:text-5xl font-bold text-[var(--azhar-green-deep)] leading-tight mb-4">
              {text.title}
            </h1>

            <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              {text.subtitle}
            </p>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs md:text-sm text-emerald-800 font-medium bg-emerald-50/80 border border-emerald-200/70 rounded-full py-1.5 px-4 w-fit mx-auto">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>{text.guarantee}</span>
            </div>
          </div>

          {/* ═══ شريط الخطوات (Multi-step Stepper) ═══ */}
          {step !== 'success' && (
            <div className="max-w-4xl mx-auto mb-8">
              <div className="glass-card !bg-white/85 p-3 md:p-5 border-[var(--azhar-gold-leaf)]/30 shadow-md">
                <div className="grid grid-cols-4 gap-2 md:gap-4 relative">
                  {text.steps.map((s) => {
                    const isCompleted = step > s.num;
                    const isActive = step === s.num;
                    return (
                      <div
                        key={s.num}
                        onClick={() => {
                          // السماح بالرجوع لخطوات سابقة تم إكمالها
                          if (s.num < step) setStep(s.num);
                        }}
                        className={`flex flex-col items-center text-center p-2 rounded-xl transition cursor-pointer select-none ${
                          isActive
                            ? 'bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] ring-2 ring-[var(--azhar-gold-leaf)]/60'
                            : isCompleted
                            ? 'text-emerald-700 hover:bg-emerald-50/50'
                            : 'text-slate-400 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-bold mb-1.5 transition ${
                            isActive
                              ? 'bg-[var(--azhar-green-deep)] text-white shadow-md shadow-emerald-900/20 ring-2 ring-[var(--azhar-gold-leaf)]'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isCompleted ? <Check size={18} strokeWidth={2.5} /> : s.num}
                        </div>
                        <span className="text-xs md:text-sm font-bold truncate w-full">
                          {s.title}
                        </span>
                        <span className="hidden md:inline text-[11px] text-slate-500 truncate w-full">
                          {s.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ محتوى الخطوات (Wizard Form Cards) ═══ */}
          <div className="max-w-3xl mx-auto">
            {step !== 'success' ? (
              <div className="card-premium !p-6 md:!p-10 shadow-xl bg-white border border-[var(--athar-cream-dark)]">

                {/* ── الخطوة 1: المسار التعليمي ── */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--azhar-green-deep)]">
                        {text.step1Title}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {text.step1Subtitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {text.tracks.map((t) => {
                        const Icon = t.icon;
                        const isSelected = formData.track === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => setFormData({ ...formData, track: t.id })}
                            className={`relative rounded-2xl p-5 border-2 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)]/70 shadow-md ring-2 ring-[var(--azhar-gold-leaf)]/50'
                                : 'border-slate-200 hover:border-[var(--azhar-gold-leaf)]/60 bg-white hover:bg-[var(--athar-cream)]/30'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                                  isSelected
                                    ? 'bg-[var(--azhar-green-deep)] text-white shadow-md'
                                    : 'bg-[var(--azhar-gold-50)] text-[var(--azhar-gold-dark)] border border-[var(--azhar-gold-leaf)]/30'
                                }`}
                              >
                                <Icon size={24} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-lg text-slate-800">
                                    {t.title}
                                  </h3>
                                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--azhar-gold-leaf)]/15 text-[var(--azhar-gold-dark)] border border-[var(--azhar-gold-leaf)]/30">
                                    {t.badge}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                  {t.desc}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {t.features.map((feat, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-white/80 border border-emerald-200/60 rounded-md px-2 py-0.5"
                                    >
                                      <CheckCircle2 size={12} className="text-emerald-600" />
                                      {feat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── الخطوة 2: بيانات الطالب ── */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--azhar-green-deep)]">
                        {text.step2Title}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {text.step2Subtitle}
                      </p>
                    </div>

                    {/* اسم الطالب */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.studentNameLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute start-3 top-3 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={formData.studentName}
                          onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                          placeholder={text.studentNamePlaceholder}
                          className={`w-full rounded-xl border px-4 py-2.5 ps-10 text-sm focus:outline-none focus:ring-2 transition ${
                            errors.studentName
                              ? 'border-red-400 focus:ring-red-200'
                              : 'border-slate-300 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100'
                          }`}
                        />
                      </div>
                      {errors.studentName && (
                        <p className="text-xs text-red-500 mt-1">{errors.studentName}</p>
                      )}
                    </div>

                    {/* سن الطالب */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.ageLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="99"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        placeholder={text.agePlaceholder}
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                          errors.age
                            ? 'border-red-400 focus:ring-red-200'
                            : 'border-slate-300 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100'
                        }`}
                      />
                      {errors.age && (
                        <p className="text-xs text-red-500 mt-1">{errors.age}</p>
                      )}
                    </div>

                    {/* جنس الطالب لاختيار المعلم أو المعلمة */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {text.genderLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          onClick={() => setFormData({ ...formData, gender: 'male' })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                            formData.gender === 'male'
                              ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] ring-2 ring-[var(--azhar-gold-leaf)]/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span className="text-2xl">👨</span>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{text.male}</div>
                            <div className="text-xs text-slate-500">{text.maleSub}</div>
                          </div>
                        </div>

                        <div
                          onClick={() => setFormData({ ...formData, gender: 'female' })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                            formData.gender === 'female'
                              ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] ring-2 ring-[var(--azhar-gold-leaf)]/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span className="text-2xl">🧕</span>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{text.female}</div>
                            <div className="text-xs text-slate-500">{text.femaleSub}</div>
                          </div>
                        </div>
                      </div>

                      {/* رسالة الطمأنة والخصوصية */}
                      <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                        <ShieldCheck size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                        <span>{text.genderNotice}</span>
                      </div>
                    </div>

                    {/* المستوى الحالي */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {text.levelLabel}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {text.levels.map((lvl) => (
                          <div
                            key={lvl.id}
                            onClick={() => setFormData({ ...formData, currentLevel: lvl.id })}
                            className={`p-3 rounded-xl border cursor-pointer transition ${
                              formData.currentLevel === lvl.id
                                ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] font-semibold ring-1 ring-[var(--azhar-gold-leaf)]/30'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="text-sm font-bold">{lvl.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{lvl.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── الخطوة 3: بيانات ولي الأمر والتواصل ── */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--azhar-green-deep)]">
                        {text.step3Title}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {text.step3Subtitle}
                      </p>
                    </div>

                    {/* اسم ولي الأمر */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.guardianNameLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Users className="absolute start-3 top-3 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={formData.guardianName}
                          onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                          placeholder={text.guardianNamePlaceholder}
                          className={`w-full rounded-xl border px-4 py-2.5 ps-10 text-sm focus:outline-none focus:ring-2 transition ${
                            errors.guardianName
                              ? 'border-red-400 focus:ring-red-200'
                              : 'border-slate-300 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100'
                          }`}
                        />
                      </div>
                      {errors.guardianName && (
                        <p className="text-xs text-red-500 mt-1">{errors.guardianName}</p>
                      )}
                    </div>

                    {/* الدولة ومفتاح الاتصال */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.countryLabel} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code + c.nameEn} value={c.code}>
                            {c.flag} {activeLocale === 'ar' ? c.nameAr : c.nameEn} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* رقم الواتساب */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.whatsappLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 flex items-center justify-center min-w-[70px]" dir="ltr">
                          {formData.countryCode}
                        </div>
                        <div className="relative flex-1">
                          <MessageCircle className="absolute start-3 top-3 text-emerald-600" size={18} />
                          <input
                            type="tel"
                            value={formData.whatsapp}
                            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                            placeholder={text.whatsappPlaceholder}
                            dir="ltr"
                            className={`w-full rounded-xl border px-4 py-2.5 ps-10 text-sm focus:outline-none focus:ring-2 transition text-left ${
                              errors.whatsapp
                                ? 'border-red-400 focus:ring-red-200'
                                : 'border-slate-300 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100'
                            }`}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {text.whatsappHint}
                      </p>
                      {errors.whatsapp && (
                        <p className="text-xs text-red-500 mt-1">{errors.whatsapp}</p>
                      )}
                    </div>

                    {/* البريد الإلكتروني (اختياري) */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.emailLabel}
                      </label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-3 text-slate-400" size={18} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder={text.emailPlaceholder}
                          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 ps-10 text-sm focus:outline-none focus:ring-2 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── الخطوة 4: الموعد المفضل والتأكيد ── */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                      <h2 className="text-xl md:text-2xl font-bold font-amiri text-[var(--azhar-green-deep)]">
                        {text.step4Title}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {text.step4Subtitle}
                      </p>
                    </div>

                    {/* الفترة المفضلة */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {text.periodLabel}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div
                          onClick={() => setFormData({ ...formData, preferredPeriod: 'morning' })}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition text-center ${
                            formData.preferredPeriod === 'morning'
                              ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] font-bold ring-1 ring-[var(--azhar-gold-leaf)]/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xl mb-1">🌅</div>
                          <div className="text-sm">{text.morningPeriod}</div>
                        </div>

                        <div
                          onClick={() => setFormData({ ...formData, preferredPeriod: 'evening' })}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition text-center ${
                            formData.preferredPeriod === 'evening'
                              ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] font-bold ring-1 ring-[var(--azhar-gold-leaf)]/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xl mb-1">🌇</div>
                          <div className="text-sm">{text.eveningPeriod}</div>
                        </div>

                        <div
                          onClick={() => setFormData({ ...formData, preferredPeriod: 'flexible' })}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition text-center ${
                            formData.preferredPeriod === 'flexible'
                              ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] font-bold ring-1 ring-[var(--azhar-gold-leaf)]/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xl mb-1">⏰</div>
                          <div className="text-sm">{text.flexiblePeriod}</div>
                        </div>
                      </div>
                    </div>

                    {/* اليوم المفضل */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {text.dayLabel}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {text.days.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => setFormData({ ...formData, preferredDay: d.id })}
                            className={`p-3 rounded-xl border text-center cursor-pointer transition ${
                              formData.preferredDay === d.id
                                ? 'border-[var(--azhar-green-deep)] bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] font-bold ring-1 ring-[var(--azhar-gold-leaf)]/30'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="text-sm font-bold">{d.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{d.desc}</div>
                          </div>
                        ))}
                      </div>

                      {formData.preferredDay === 'custom' && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            {text.customDateLabel}
                          </label>
                          <input
                            type="date"
                            value={formData.customDate}
                            onChange={(e) => setFormData({ ...formData, customDate: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:border-[var(--azhar-green-deep)]"
                          />
                          {errors.customDate && (
                            <p className="text-xs text-red-500 mt-1">{errors.customDate}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ملاحظات إضافية */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {text.notesLabel}
                      </label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder={text.notesPlaceholder}
                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[var(--azhar-green-deep)] focus:ring-emerald-100"
                      />
                    </div>

                    {/* صندوق الملخص التأكيدي */}
                    <div className="rounded-2xl border border-[var(--azhar-gold-leaf)]/40 bg-[var(--azhar-gold-50)]/60 p-4 space-y-2 text-sm">
                      <div className="font-bold text-[var(--azhar-gold-dark)] flex items-center gap-1.5 mb-2">
                        <CheckCircle2 size={16} className="text-emerald-700" />
                        <span>{text.summaryTitle}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs md:text-sm text-slate-700">
                        <div>
                          <span className="text-slate-500">الطالب:</span>{' '}
                          <span className="font-semibold">{formData.studentName || '—'}</span> ({formData.age} سنة / {formData.gender === 'male' ? 'ذكر' : 'أنثى'})
                        </div>
                        <div>
                          <span className="text-slate-500">المسار:</span>{' '}
                          <span className="font-semibold">
                            {formData.track === 'memorization' ? 'التحفيظ والمراجعة' : formData.track === 'ijaza' ? 'الإجازة والتجويد' : 'تأسيس الأطفال'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">المتواصل:</span>{' '}
                          <span className="font-semibold">{formData.guardianName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">الواتساب:</span>{' '}
                          <span className="font-semibold" dir="ltr">{formData.countryCode} {formData.whatsapp || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── أزرار التنقل بين الخطوات ── */}
                {errors.submit ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errors.submit}
                  </div>
                ) : null}

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="btn-secondary !py-2.5 !px-5 text-sm font-semibold flex items-center gap-2"
                    >
                      {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                      <span>{text.prev}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn-primary !py-2.5 !px-6 text-sm font-semibold flex items-center gap-2"
                    >
                      <span>{text.next}</span>
                      {isRTL ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="btn-gold !py-3 !px-7 text-sm md:text-base font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                          <span>{text.submittingBtn}</span>
                        </>
                      ) : (
                        <span>{text.submitBtn}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (

              /* ═══ شاشة النجاح الفائقة التميز (Success State) ═══ */
              <div className="card-premium !p-8 md:!p-12 text-center bg-white border-2 border-[var(--azhar-gold-leaf)]/50 shadow-2xl relative overflow-hidden">
                {/* شريط زينة علوي */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[var(--azhar-green-deep)] via-[var(--azhar-gold-leaf)] to-[var(--azhar-green-deep)]" />

                {/* أيقونة الاحتفال */}
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-300/60 flex items-center justify-center text-emerald-700 shadow-xl mb-6">
                  <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>

                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs md:text-sm font-bold mb-3">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>{text.freeNoticeBadge}</span>
                </div>

                <h2 className="text-2xl md:text-4xl font-bold font-amiri text-[var(--azhar-green-deep)] mb-3">
                  {text.successTitle}
                </h2>

                <p className="text-slate-600 text-sm md:text-base max-w-xl mx-auto leading-relaxed mb-6">
                  {text.successSubtitle}
                </p>

                {/* بطاقة رقم الطلب المرجعي */}
                <div className="rounded-2xl border-2 border-dashed border-[var(--azhar-gold-leaf)]/60 bg-[var(--azhar-gold-50)]/80 p-4 md:p-5 max-w-md mx-auto mb-8 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold mb-1">
                    {text.refNumber}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl md:text-2xl font-mono font-extrabold text-[var(--azhar-green-deep)] tracking-wider">
                      {bookingRef}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      title={text.copyRef}
                      className="p-2 rounded-lg bg-white border border-[var(--azhar-gold-leaf)]/40 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1 text-xs font-semibold"
                    >
                      {copiedRef ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-700">{text.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>{text.copyRef}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* خطوات ما بعد الحجز */}
                <div className="text-start max-w-lg mx-auto mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
                  <h3 className="font-bold text-slate-800 text-sm md:text-base mb-3 flex items-center gap-2">
                    <FileCheck size={18} className="text-[var(--azhar-green-deep)]" />
                    <span>{text.whatHappensNext}</span>
                  </h3>
                  <div className="space-y-3">
                    {text.stepsNext.map((st) => (
                      <div key={st.num} className="flex items-start gap-3 text-xs md:text-sm">
                        <div className="w-6 h-6 rounded-full bg-[var(--azhar-green-deep)] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
                          {st.num}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">{st.title}: </span>
                          <span className="text-slate-600">{st.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* زر واتساب المباشر الأساسي البارز */}
                <div className="space-y-3 max-w-md mx-auto">
                  {SOCIAL_LINKS.whatsapp ? (
                    <a
                      href={getWhatsAppConfirmationUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-3 rounded-xl py-3.5 px-6 font-bold text-white text-base shadow-lg shadow-emerald-700/25 transition hover:brightness-110"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle size={22} />
                      <span>{text.whatsappBtn}</span>
                    </a>
                  ) : (
                    <Link
                      to={lp('/contact')}
                      className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-3.5"
                    >
                      <MessageCircle size={20} />
                      <span>{activeLocale === 'ar' ? 'تواصل مع فريق الأكاديمية' : 'Contact the academy team'}</span>
                    </Link>
                  )}

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Link
                      to={lp('/')}
                      className="btn-secondary !py-2.5 !px-5 text-xs md:text-sm font-semibold"
                    >
                      {text.homeBtn}
                    </Link>
                    <Link
                      to={lp('/courses')}
                      className="btn-primary !py-2.5 !px-5 text-xs md:text-sm font-semibold"
                    >
                      {text.exploreBtn}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ بطاقات الثقة والمزايا السفلية (Trust Badges) ═══ */}
          <div className="mt-16 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-5 rounded-2xl bg-white/70 border border-[var(--azhar-gold-leaf)]/20 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[var(--azhar-green-50)] text-[var(--azhar-green-deep)] flex items-center justify-center mx-auto mb-3">
                <Award size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                {activeLocale === 'ar' ? 'معلمون ومعلمات متخصصون' : 'Specialized Quran Teachers'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeLocale === 'ar'
                  ? 'اختيار المعلم أو المعلمة يتم وفق التخصص والخبرة المتاحة لكل مسار'
                  : 'Handpicked certified scholars with connected Sanad'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 border border-[var(--azhar-gold-leaf)]/20 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-[var(--azhar-gold-dark)] flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                {activeLocale === 'ar' ? 'معلمات متخصصات للأخوات' : 'Female Tutors for Sisters'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeLocale === 'ar'
                  ? 'خصوصية وأمان تام للأخوات والبنات مع معلمات مجازات'
                  : 'Full privacy and comfort with dedicated female instructors'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 border border-[var(--azhar-gold-leaf)]/20 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <Star size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                {activeLocale === 'ar' ? 'تقرير قياس مستوى فوري' : 'Instant Level Assessment'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeLocale === 'ar'
                  ? 'تقرير شامل ومخصص بعد الحصة وخطة دراسية مقترحة مجاناً'
                  : 'Receive an individualized evaluation report and study roadmap'}
              </p>
            </div>
          </div>

        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
