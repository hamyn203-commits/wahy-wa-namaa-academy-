import {
  Award,
  BadgeCheck,
  Banknote,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Gamepad2,
  Gift,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Languages,
  LibraryBig,
  MapPinned,
  Medal,
  MessageCircleQuestion,
  MonitorPlay,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

export const v4Markets = [
  {
    slug: 'arab-world',
    region: 'العالم العربي',
    regionEn: 'Arab World',
    countries: ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن', 'العراق', 'المغرب', 'الجزائر', 'تونس'],
    countriesEn: ['Egypt', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Iraq', 'Morocco', 'Algeria', 'Tunisia'],
    services: ['تحفيظ القرآن', 'التجويد', 'الإجازات', 'اللغة العربية', 'الدراسات الإسلامية'],
    servicesEn: ['Quran Memorization', 'Tajweed', 'Ijazah', 'Arabic Language', 'Islamic Studies'],
    currency: 'SAR',
    language: 'ar',
    timezone: 'Asia/Riyadh',
  },
  {
    slug: 'americas',
    region: 'السوق الأمريكي',
    regionEn: 'Americas',
    countries: ['الولايات المتحدة', 'كندا'],
    countriesEn: ['United States', 'Canada'],
    services: ['تحفيظ القرآن', 'اللغة العربية', 'الدراسات الإسلامية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
    servicesEn: ['Quran Memorization', 'Arabic Language', 'Islamic Studies', 'Kids Programs', 'Reverts Programs'],
    currency: 'USD',
    language: 'en',
    timezone: 'America/New_York',
  },
  {
    slug: 'europe',
    region: 'السوق الأوروبي',
    regionEn: 'Europe',
    countries: ['بريطانيا', 'فرنسا', 'ألمانيا', 'هولندا', 'بلجيكا', 'السويد'],
    countriesEn: ['United Kingdom', 'France', 'Germany', 'Netherlands', 'Belgium', 'Sweden'],
    services: ['تعليم القرآن', 'تعليم العربية', 'برامج الأطفال', 'برامج المسلمين الجدد'],
    servicesEn: ['Quran Learning', 'Arabic Learning', 'Kids Programs', 'New Muslims Programs'],
    currency: 'EUR',
    language: 'fr',
    timezone: 'Europe/London',
  },
  {
    slug: 'turkey',
    region: 'السوق التركي',
    regionEn: 'Turkey',
    countries: ['تركيا'],
    countriesEn: ['Turkey'],
    services: ['القرآن الكريم', 'اللغة العربية', 'التجويد'],
    servicesEn: ['Holy Quran', 'Arabic Language', 'Tajweed'],
    currency: 'TRY',
    language: 'tr',
    timezone: 'Europe/Istanbul',
  },
  {
    slug: 'indonesia-malaysia',
    region: 'السوق الإندونيسي والماليزي',
    regionEn: 'Indonesia & Malaysia',
    countries: ['إندونيسيا', 'ماليزيا'],
    countriesEn: ['Indonesia', 'Malaysia'],
    services: ['حفظ القرآن', 'تعليم العربية', 'برامج الأطفال'],
    servicesEn: ['Quran Memorization', 'Arabic Learning', 'Kids Programs'],
    currency: 'IDR',
    language: 'id',
    timezone: 'Asia/Jakarta',
  },
  {
    slug: 'south-asia',
    region: 'السوق الباكستاني والهندي',
    regionEn: 'South Asia',
    countries: ['باكستان', 'الهند'],
    countriesEn: ['Pakistan', 'India'],
    services: ['تحفيظ القرآن', 'التجويد', 'الإجازات'],
    servicesEn: ['Quran Memorization', 'Tajweed', 'Ijazah'],
    currency: 'PKR',
    language: 'ur',
    timezone: 'Asia/Karachi',
  },
];

export const v4Languages = [
  { code: 'ar', name: 'العربية', dir: 'RTL', seo: 'ar/wahy-namaa-quran-academy' },
  { code: 'en', name: 'English', dir: 'LTR', seo: 'en/quran-memorization-online' },
  { code: 'fr', name: 'Français', dir: 'LTR', seo: 'fr/apprendre-le-coran' },
  { code: 'tr', name: 'Türkçe', dir: 'LTR', seo: 'tr/online-kuran-egitimi' },
  { code: 'de', name: 'Deutsch', dir: 'LTR', seo: 'de/koran-online-lernen' },
  { code: 'ur', name: 'الأردية', dir: 'RTL', seo: 'ur/quran-academy' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'LTR', seo: 'id/akademi-alquran-online' },
  { code: 'ms', name: 'Malay', dir: 'LTR', seo: 'ms/akademi-al-quran' },
  { code: 'ku', name: 'کوردی', dir: 'RTL', seo: 'ku/quran-academy' },
];

export const v4Currencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'PKR', 'IDR'];

export const v4TimeZones = [
  { city: 'نيويورك', zone: 'America/New_York' },
  { city: 'لندن', zone: 'Europe/London' },
  { city: 'الرياض', zone: 'Asia/Riyadh' },
  { city: 'إسطنبول', zone: 'Europe/Istanbul' },
  { city: 'القاهرة', zone: 'Africa/Cairo' },
  { city: 'جاكرتا', zone: 'Asia/Jakarta' },
];

export const v4TeacherPipeline = [
  'البيانات الشخصية',
  'المؤهلات والشهادات',
  'الإجازات والسند',
  'فيديوهات التلاوة',
  'تسجيلات صوتية',
  'مقابلة شخصية',
  'OTP وTelegram وWhatsApp وEmail Verification',
  'تقييم التجويد والصوت والخبرة والالتزام وتقييم الطلاب',
];

export const v4PortalSections = [
  {
    title: 'لوحة المعلم V4',
    icon: PanelsTopLeft,
    items: ['الأرباح اليومية والأسبوعية والشهرية', 'إدارة الطلاب والملاحظات والتقارير', 'الواجبات والاختبارات والتسجيلات الصوتية', 'المواعيد والإجازات والحصص المتاحة'],
  },
  {
    title: 'لوحة الطالب العالمية',
    icon: GraduationCap,
    items: ['الملف الأكاديمي والمستوى والإنجازات والشهادات', 'الحصص القادمة والسابقة والتسجيلات', 'رفع الواجبات والتسجيلات', 'تحميل جميع الشهادات'],
  },
  {
    title: 'لوحة ولي الأمر',
    icon: Users,
    items: ['الحضور والغياب', 'الواجبات والتقييمات', 'متابعة الحفظ والتقدم', 'ملخص أسبوعي للأسرة'],
  },
];

export const v4AiSystems = [
  {
    title: 'تقييم التلاوة بالذكاء الاصطناعي',
    icon: Bot,
    items: ['تحليل المدود', 'الغنة', 'أحكام النون الساكنة', 'الوقف والابتداء', 'مخارج الحروف', 'تقرير فوري قابل للمراجعة'],
  },
  {
    title: 'مساعد قرآني ذكي',
    icon: MessageCircleQuestion,
    items: ['خطة حفظ يومية', 'مراجعة ذكية', 'شرح التجويد', 'تدريب اللغة العربية'],
  },
  {
    title: 'مساعد للمعلمين',
    icon: Sparkles,
    items: ['إعداد الواجبات', 'إعداد الاختبارات', 'كتابة التقارير', 'اقتراح تدخلات تعليمية'],
  },
];

export const v4LearningSystems = [
  { title: 'LMS عالمي', icon: LibraryBig, items: ['دورات', 'مستويات', 'اختبارات', 'شهادات', 'تقييمات', 'واجبات'] },
  { title: 'نظام الاختبارات', icon: ClipboardCheck, items: ['اختيار من متعدد', 'صح وخطأ', 'صوتي', 'شفوي', 'عملي'] },
  { title: 'الشهادات الذكية', icon: FileCheck2, items: ['PDF تلقائي', 'QR Code', 'رقم تحقق', 'رابط تحقق إلكتروني'] },
  { title: 'نظام الاجتماعات', icon: Video, items: ['Zoom', 'Google Meet', 'مشاركة الشاشة', 'سبورة تفاعلية', 'تسجيل'] },
  { title: 'مكتبة الفيديو العالمية', icon: MonitorPlay, items: ['القرآن', 'التجويد', 'العربية', 'العقيدة', 'الفقه', 'السيرة'] },
];

export const v4GrowthSystems = [
  { title: 'المسلمون الجدد', icon: HeartHandshake, items: ['برامج تعريفية', 'إنجليزية وفرنسية وإسبانية', 'مسارات دعم فردية'] },
  { title: 'قسم الأطفال', icon: Gamepad2, items: ['ألعاب تعليمية', 'مكافآت', 'مسابقات', 'بيئة آمنة'] },
  { title: 'Gamification', icon: Medal, items: ['نقاط', 'أوسمة', 'مستويات', 'بطولات شهرية'] },
  { title: 'نظام السفراء', icon: Gift, items: ['دعوات الطلاب', 'خصومات', 'نقاط', 'حصص مجانية'] },
  { title: 'تطبيق الهاتف', icon: Smartphone, items: ['Android', 'iOS', 'إشعارات', 'حصص', 'تسجيلات', 'شهادات'] },
  { title: 'أكاديمية النساء', icon: ShieldCheck, items: ['قسم مستقل بالكامل', 'معلمات فقط', 'طالبات فقط'] },
  { title: 'نظام التبرعات', icon: CircleDollarSign, items: ['كفالة طالب', 'كفالة معلم', 'كفالة حلقة قرآن'] },
  { title: 'مركز التوظيف', icon: BriefcaseBusiness, items: ['معلمين', 'مترجمين', 'مشرفين'] },
];

export const v4Kpis = [
  { label: 'دولة مستهدفة', value: '100+', icon: Globe2 },
  { label: 'لغة مدعومة', value: '9', icon: Languages },
  { label: 'عملة عالمية', value: '9', icon: Banknote },
  { label: 'لوحة تشغيل', value: '3', icon: ChartNoAxesCombined },
  { label: 'مسارات AI', value: '3', icon: Bot },
  { label: 'نظام تعليمي', value: '5+', icon: BookOpen },
];

export const v4Roadmap = [
  { phase: 'المرحلة 1', title: 'التوسع العالمي', status: 'جاهز بالواجهة', icon: MapPinned },
  { phase: 'المرحلة 2', title: 'لوحات التشغيل العالمية', status: 'جاهز كنموذج تشغيلي', icon: PanelsTopLeft },
  { phase: 'المرحلة 3', title: 'AI وLMS والشهادات', status: 'جاهز للتوصيل بالـ API', icon: BadgeCheck },
  { phase: 'المرحلة 4', title: 'النمو والموبايل والتوظيف', status: 'منشور v4.2', icon: Award },
  { phase: 'المرحلة 5', title: 'PWA + إدارة النمو + Bedrock', status: 'منشور v4.3', icon: CalendarClock },
  { phase: 'V5', title: 'منصة تخدم مليون طالب', status: 'منشور v6.1', icon: Smartphone },
  { phase: 'V6', title: 'تجربة مستخدم + AI + PWA', status: 'منشور v6.1', icon: CalendarClock },
];

export function formatCurrencyPreview(currency, locale = 'ar-EG') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(45);
}

export function formatZoneTime(zone, locale = 'ar-EG') {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  }).format(new Date());
}

export const v4QuickActions = [
  { label: 'اختيار المسار', icon: BookOpen, path: '/courses' },
  { label: 'حجز حصة تجريبية', icon: Clock3, path: '/teachers' },
  { label: 'رفع تلاوة', icon: Bot, path: '/ai' },
  { label: 'إصدار شهادة', icon: FileCheck2, path: '/student/dashboard' },
];
