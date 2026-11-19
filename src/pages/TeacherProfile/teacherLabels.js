const FALLBACK_SPEC_LABELS = {
  ar: {
    children: 'تعليم الأطفال',
    adults: 'تعليم الكبار',
    women: 'قسم النساء',
    'non-arabic': 'غير الناطقين بالعربية',
    tajweed: 'أحكام التجويد',
    ijaza: 'الإجازة بالسند',
    'arabic-language': 'اللغة العربية',
  },
  id: {
    children: 'Anak-anak',
    adults: 'Dewasa',
    women: 'Wanita',
    'non-arabic': 'Non-Arab',
    tajweed: 'Tajwid',
    ijaza: 'Ijazah',
    'arabic-language': 'Bahasa Arab',
  },
  en: {
    children: 'Children',
    adults: 'Adults',
    women: 'Women',
    'non-arabic': 'Non-Arabic speakers',
    tajweed: 'Tajweed',
    ijaza: 'Ijazah',
    'arabic-language': 'Arabic language',
  },
};

const FALLBACK_LANG_LABELS = {
  ar: {
    arabic: 'العربية',
    english: 'الإنجليزية',
    french: 'الفرنسية',
    german: 'الألمانية',
    turkish: 'التركية',
    urdu: 'الأردية',
    indonesian: 'الإندونيسية',
    malay: 'الماليزية',
    kurdish: 'الكردية',
  },
  id: {
    arabic: 'Arab',
    english: 'Inggris',
    french: 'Prancis',
    german: 'Jerman',
    turkish: 'Turki',
    urdu: 'Urdu',
    indonesian: 'Indonesia',
    malay: 'Melayu',
    kurdish: 'Kurdi',
  },
  en: {
    arabic: 'Arabic',
    english: 'English',
    french: 'French',
    german: 'German',
    turkish: 'Turkish',
    urdu: 'Urdu',
    indonesian: 'Indonesian',
    malay: 'Malay',
    kurdish: 'Kurdish',
  },
};

export function specName(spec, locale, t = null) {
  const fromDict = t?.teacherProfile?.specializations?.[spec];
  if (fromDict) return fromDict;
  const bucket = locale === 'ar' ? 'ar' : locale === 'id' ? 'id' : 'en';
  return FALLBACK_SPEC_LABELS[bucket]?.[spec] || spec;
}

export function languageName(lang, locale, t = null) {
  const key = String(lang || '').toLowerCase();
  const fromDict = t?.teacherProfile?.languages?.[key];
  if (fromDict) return fromDict;
  const bucket = locale === 'ar' ? 'ar' : locale === 'id' ? 'id' : 'en';
  return FALLBACK_LANG_LABELS[bucket]?.[key] || lang;
}

export function getProfileCopy(locale, t = null) {
  const isAr = locale === 'ar';
  const tp = t?.teacherProfile || {};
  return {
    isAr,
    loadingProfile: tp.loadingProfile || (isAr ? 'جاري تحميل ملف المعلم…' : 'Loading teacher profile…'),
    profileUnavailable: tp.profileUnavailable || (isAr ? 'ملف المعلم غير متاح' : 'Teacher profile is unavailable'),
    profileUnavailableHint: tp.profileUnavailableHint || (isAr
      ? 'قد يكون الرابط غير صحيح أو الملف قيد التحديث حاليًا.'
      : 'This link may be outdated or the tutor profile is currently being updated.'),
    loadErrorTitle: tp.loadErrorTitle || (isAr ? 'تعذر تحميل ملف المعلم حاليًا' : 'Could not load teacher profile'),
    loadErrorHint: tp.loadErrorHint || (isAr ? 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.' : 'Please check your connection and try again.'),
    retryBtn: tp.retryBtn || (isAr ? 'إعادة المحاولة' : 'Try Again'),
    backToList: tp.backToList || (isAr ? 'العودة إلى قائمة المعلمين' : 'Back to tutors'),
    backToDashboard: tp.backToDashboard || (isAr ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard'),
    verifiedTutor: tp.verifiedTutor || (isAr ? 'معلم قرآن مجاز ومعتمد' : 'Certified Quran Tutor'),
    featuredTutor: tp.featuredTutor || (isAr ? 'ملف مميز' : 'Featured Tutor'),
    reviewsLabel: tp.reviewsLabel || (isAr ? 'تقييم' : 'reviews'),
    yearsExperience: tp.yearsExperience || (isAr ? 'سنوات خبرة' : 'Years exp.'),
    juzMemorized: tp.juzMemorized || (isAr ? 'أجزاء محفوظة' : 'Juz memorized'),
    listedIjazahs: tp.listedIjazahs || (isAr ? 'إجازات مسجلة' : 'Ijazahs'),
    studentsCount: tp.studentsCount || (isAr ? 'طالبًا' : 'Students'),
    watchRecitationJump: tp.watchRecitationJump || (isAr ? 'استمع للتلاوة والتعريف' : 'Hear recitation & intro'),
    tabsAria: tp.tabsAria || (isAr ? 'أقسام ملف المعلم' : 'Teacher profile sections'),
    allSections: tp.allSections || (isAr ? 'الكل' : 'All'),
    aboutSection: tp.aboutSection || (isAr ? 'النبذة والمؤهلات' : 'About & credentials'),
    mediaSection: tp.mediaSection || (isAr ? 'التلاوة والفيديو' : 'Recitation & video'),
    reviewsSection: tp.reviewsSection || (isAr ? 'تقييمات الطلاب' : 'Student reviews'),
    bioTitle: tp.bioTitle || (isAr ? 'نبذة عن المعلم ومنهجه' : 'Biography & teaching approach'),
    noBio: tp.noBio || (isAr ? 'لم تُضف نبذة تفصيلية لهذا الملف بعد.' : 'No detailed biography has been added yet.'),
    academicTitle: tp.academicTitle || (isAr ? 'الخلفية الأكاديمية' : 'Academic background'),
    specializationLabel: tp.specializationLabel || (isAr ? 'التخصص:' : 'Specialization:'),
    graduationLabel: tp.graduationLabel || (isAr ? 'سنة التخرج:' : 'Graduation year:'),
    specializationsTitle: tp.specializationsTitle || (isAr ? 'التخصصات التعليمية' : 'Teaching specializations'),
    languagesTitle: tp.languagesTitle || (isAr ? 'لغات التدريس' : 'Teaching languages'),
    mediaTitle: tp.mediaTitle || (isAr ? 'شاهد وتعرّف على طريقة الشيخ' : 'Preview voice, recitation & method'),
    mediaSubtitle: tp.mediaSubtitle || (isAr
      ? 'اضغط على أي بطاقة لتشغيل الفيديو أو التلاوة دون إبطاء الصفحة.'
      : 'Click any card to load and play the video or audio on demand.'),
    clickToPlay: tp.clickToPlay || (isAr ? 'اضغط للتشغيل' : 'Click to play'),
    noMedia: tp.noMedia || (isAr ? 'لا توجد تسجيلات أو فيديوهات منشورة لهذا المعلم بعد.' : 'No published media recordings yet.'),
    audioTitle: tp.audioTitle || (isAr ? 'تسجيلات صوتية' : 'Audio recitations'),
    audioClipLabel: tp.audioClipLabel || (isAr ? 'تسجيل صوتي {index}' : 'Audio clip {index}'),
    reviewsTitle: tp.reviewsTitle || (isAr ? 'آراء الطلاب وتقييماتهم' : 'Student reviews'),
    noReviews: tp.noReviews || (isAr
      ? 'لا توجد تقييمات منشورة بعد — كن أول من يحجز تجربة ويشارك رأيه.'
      : 'No published reviews yet — be the first to book a trial and share feedback.'),
    studentFallback: tp.studentFallback || (isAr ? 'طالب وحي ونماء' : 'Academy student'),
    tutorFallback: tp.tutorFallback || (isAr ? 'معلم قرآن' : 'Quran teacher'),
    defaultBio: tp.defaultBio || (isAr ? 'ملف معلم في أكاديمية وَحْيٌ وَنَمَاء' : 'Teacher profile at Wahy Wa Namaa Academy'),
    defaultSpecialty: tp.defaultSpecialty || (isAr ? 'معلم قرآن كريم وتجويد' : 'Quran & Tajweed Teacher'),
    introVideoTitle: tp.introVideoTitle || (isAr ? 'فيديو تعريفي' : 'Introduction video'),
    recitationVideoTitle: tp.recitationVideoTitle || (isAr ? 'تلاوة قرآنية' : 'Quran recitation'),
    methodVideoTitle: tp.methodVideoTitle || (isAr ? 'طريقة التدريس' : 'Teaching method'),
    additionalRecitationTitle: tp.additionalRecitationTitle || (isAr ? 'تلاوة إضافية {index}' : 'Additional recitation {index}'),
    freeTrialBadge: tp.freeTrialBadge || (isAr ? 'حصة تجريبية مجانية · 100%' : '100% Free Trial Session'),
    bookingHeading: tp.bookingHeading || (isAr ? 'احجز حصتك التجريبية' : 'Book your free trial'),
    bookingSubheading: tp.bookingSubheading || (isAr
      ? 'لقاء مباشر لتحديد مستواك والتعارف على أسلوب المعلم.'
      : 'Live 1-on-1 level assessment and introduction.'),
    pickDayLabel: tp.pickDayLabel || (isAr ? 'المواعيد المتاحة قريبًا' : 'Upcoming available slots'),
    pickTimeLabel: tp.pickTimeLabel || (isAr ? 'اختر الوقت بتوقيت جهازك' : 'Choose time (your local time)'),
    noSlotsNotice: tp.noSlotsNotice || (isAr
      ? 'المعلم يستقبل طلبات الأوقات المقترحة — اختر وقتك المفضل في الخطوة التالية.'
      : 'Choose your preferred day and time in the next step for confirmation.'),
    bookSelectedSlot: tp.bookSelectedSlot || (isAr ? 'احجز هذا الموعد المجاني' : 'Book this free slot'),
    bookTrialAction: tp.bookTrialAction || (isAr ? 'احجز حصة تجريبية مجانية' : 'Book a free trial'),
    lockedTutorBadge: tp.lockedTutorBadge || (isAr ? 'معلمك المعتمد' : 'Your Confirmed Tutor'),
    lockedTutorTitle: tp.lockedTutorTitle || (isAr ? 'أنت تدرس حاليًا مع هذا المعلم' : 'You are enrolled with this tutor'),
    lockedTutorDesc: tp.lockedTutorDesc || (isAr
      ? 'يمكنك متابعة جدول الحصص والواجبات والتقييمات مباشرة من لوحة الطالب.'
      : 'Follow your upcoming lessons, homework, and reports directly from your dashboard.'),
    goToMySessions: tp.goToMySessions || (isAr ? 'الذهاب إلى حصصي' : 'Go to my sessions'),
    trustPoint1: tp.trustPoint1 || (isAr ? 'تقييم مستوى وتحديد خطة الحفظ' : 'Level check & personalized plan'),
    trustPoint2: tp.trustPoint2 || (isAr ? 'تعديل الموعد متاح مجانًا' : 'Free rescheduling anytime'),
    trustPoint3: tp.trustPoint3 || (isAr ? 'بدون أي بيانات بطاقة بنكية' : 'No payment card required'),
    breadcrumbHome: tp.breadcrumbHome || (isAr ? 'الرئيسية' : 'Home'),
    breadcrumbTeachers: tp.breadcrumbTeachers || (isAr ? 'المعلمون' : 'Teachers'),
  };
}
