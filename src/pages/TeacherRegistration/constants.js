import { User, Mail, Lock, Video, CheckCircle } from 'lucide-react';

export const STEPS = [
  { id: 1, title: 'بياناتك', fullTitle: 'البيانات الشخصية والأكاديمية والقرآنية', icon: User },
  { id: 2, title: 'تحقق', fullTitle: 'تأكيد البريد الإلكتروني', icon: Mail },
  { id: 3, title: 'حسابك', fullTitle: 'إنشاء كلمة المرور', icon: Lock },
  { id: 4, title: 'صورة وفيديو', fullTitle: 'الصورة وفيديو التلاوة', icon: Video },
  { id: 5, title: 'إرسال', fullTitle: 'المراجعة والإرسال', icon: CheckCircle },
];

export const COUNTRIES = [
  'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'الأردن',
  'فلسطين', 'لبنان', 'سوريا', 'العراق', 'اليمن', 'المغرب', 'تونس', 'الجزائر',
  'ليبيا', 'السودان', 'تركيا', 'ماليزيا', 'إندonesia', 'باكستان', 'بريطانيا', 'أمريكا', 'أخرى',
];

export const SPECIALIZATION_OPTIONS = [
  { id: 'tajweed', label: 'أحكام التجويد' },
  { id: 'children', label: 'تحفيظ الأطفال' },
  { id: 'adults', label: 'تحفيظ الكبار' },
  { id: 'women', label: 'تحفيظ السيدات والفتيات' },
  { id: 'ijaza', label: 'الإقراء والإجازات' },
  { id: 'non-arabic', label: 'تأسيس غير الناطقين بالعربية' },
  { id: 'arabic-language', label: 'اللغة العربية والقاعدة النورانية' },
];

export const LANGUAGE_OPTIONS = [
  { id: 'arabic', label: 'العربية' },
  { id: 'english', label: 'الإنجليزية' },
  { id: 'french', label: 'الفرنسية' },
  { id: 'german', label: 'الألمانية' },
  { id: 'turkish', label: 'التركية' },
  { id: 'urdu', label: 'الأردية' },
  { id: 'indonesian', label: 'الإندونيسية' },
  { id: 'malay', label: 'الملايوية' },
];

export const TASK_TYPES = [
  { id: 'memorization', label: 'حفظ جديد' },
  { id: 'review-recent', label: 'مراجعة قريبة' },
  { id: 'review-far', label: 'مراجعة بعيدة' },
  { id: 'audio', label: 'تسجيل صوتي' },
  { id: 'test', label: 'اختبار' },
];

export const INITIAL_FORM = {
  personalInfo: {
    fullName: '', age: '', gender: 'male', country: 'مصر', address: '',
    phone: '', whatsapp: '', telegram: '',
  },
  academicInfo: {
    university: '', graduationYear: '',
  },
  quranInfo: {
    teachingExperience: 0,
    numberOfIjazat: 0,
    memorizedParts: 30,
    specializations: ['tajweed'],
  },
  languages: ['arabic'],
  documentAvailability: {
    graduationCertificate: null,
    tajweedCertificates: null,
    ijazat: null,
  },
};

export const DRAFT_KEY = 'teacher_registration_draft';
export const STATUS_TOKEN_KEY = 'teacher_application_status_token';

export const VIDEO_GUIDE = [
  'مدة كل فيديو من 3 إلى 5 دقائق',
  'يظهر وجهك بوضوح أمام الكاميرا',
  'صوتك واضح بدون ضوضاء',
  'اقرأ من المصحف أو من حفظك — تلاوة قرآنية',
  'صيغة الفيديو: MP4 أو WebM أو MOV',
  'الحد الأقصى لكل فيديو: 100 MB',
  'يمكنك رفع أكثر من فيديو',
];
