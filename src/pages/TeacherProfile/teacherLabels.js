export function specName(spec, locale) {
  const isAr = locale === 'ar';
  const isId = locale === 'id';
  const map = {
    children: isAr ? 'تعليم الأطفال' : isId ? 'Anak-anak' : 'Children',
    adults: isAr ? 'تعليم الكبار' : isId ? 'Dewasa' : 'Adults',
    women: isAr ? 'قسم النساء' : isId ? 'Wanita' : 'Women',
    'non-arabic': isAr ? 'غير الناطقين بالعربية' : isId ? 'Non-Arab' : 'Non-Arabic speakers',
    tajweed: isAr ? 'أحكام التجويد' : isId ? 'Tajwid' : 'Tajweed',
    ijaza: isAr ? 'الإجازة بالسند' : isId ? 'Ijazah' : 'Ijazah',
    'arabic-language': isAr ? 'اللغة العربية' : isId ? 'Bahasa Arab' : 'Arabic language',
  };
  return map[spec] || spec;
}

export function languageName(lang, locale) {
  const isAr = locale === 'ar';
  const isId = locale === 'id';
  const map = {
    arabic: isAr ? 'العربية' : isId ? 'Arab' : 'Arabic',
    english: isAr ? 'الإنجليزية' : isId ? 'Inggris' : 'English',
    french: isAr ? 'الفرنسية' : isId ? 'Prancis' : 'French',
    german: isAr ? 'الألمانية' : isId ? 'Jerman' : 'German',
    turkish: isAr ? 'التركية' : isId ? 'Turki' : 'Turkish',
    urdu: isAr ? 'الأردية' : isId ? 'Urdu' : 'Urdu',
    indonesian: isAr ? 'الإندونيسية' : isId ? 'Indonesia' : 'Indonesian',
    malay: isAr ? 'الماليزية' : isId ? 'Melayu' : 'Malay',
    kurdish: isAr ? 'الكردية' : isId ? 'Kurdi' : 'Kurdish',
  };
  return map[String(lang || '').toLowerCase()] || lang;
}

export function getProfileCopy(locale) {
  const isAr = locale === 'ar';
  return {
    isAr,
    loadingProfile: isAr ? 'جاري تحميل ملف المعلم...' : 'Loading teacher profile...',
    profileUnavailable: isAr ? 'ملف المعلم غير متاح' : 'Teacher profile is unavailable',
    profileUnavailableHint: isAr
      ? 'قد يكون الرابط غير صحيح أو الملف قيد التحديث حاليًا.'
      : 'This link may be outdated or the tutor profile is currently unavailable.',
    backToList: isAr ? 'العودة إلى قائمة المعلمين' : 'Back to tutors',
    backToDashboard: isAr ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard',
    verifiedTutor: isAr ? 'معلم قرآن مجاز ومعتمد' : 'Certified Quran Tutor',
    featuredTutor: isAr ? 'ملف مميز' : 'Featured Tutor',
    reviewsLabel: isAr ? 'تقييم' : 'reviews',
    yearsExperience: isAr ? 'سنوات خبرة' : 'Years exp.',
    juzMemorized: isAr ? 'أجزاء محفوظة' : 'Juz memorized',
    listedIjazahs: isAr ? 'إجازات مسجلة' : 'Ijazahs',
    studentsCount: isAr ? 'طالبًا' : 'Students',
    watchRecitationJump: isAr ? 'استمع للتلاوة والتعريف' : 'Hear recitation & intro',
    allSections: isAr ? 'الكل' : 'All',
    aboutSection: isAr ? 'النبذة والمؤهلات' : 'About & credentials',
    mediaSection: isAr ? 'التلاوة والفيديو' : 'Recitation & video',
    reviewsSection: isAr ? 'تقييمات الطلاب' : 'Student reviews',
    bioTitle: isAr ? 'نبذة عن المعلم ومنهجه' : 'Biography & teaching approach',
    noBio: isAr ? 'لم تُضف نبذة تفصيلية لهذا الملف بعد.' : 'No detailed biography has been added yet.',
    academicTitle: isAr ? 'الخلفية الأكاديمية' : 'Academic background',
    specializationLabel: isAr ? 'التخصص:' : 'Specialization:',
    graduationLabel: isAr ? 'سنة التخرج:' : 'Graduation year:',
    specializationsTitle: isAr ? 'التخصصات التعليمية' : 'Teaching specializations',
    languagesTitle: isAr ? 'لغات التدريس' : 'Teaching languages',
    mediaTitle: isAr ? 'شاهد وتعرّف على طريقة الشيخ' : 'Preview voice, recitation & method',
    mediaSubtitle: isAr
      ? 'اضغط على أي بطاقة لتشغيل الفيديو أو التلاوة دون إبطاء الصفحة.'
      : 'Click any card to load and play the video or audio on demand.',
    clickToPlay: isAr ? 'اضغط للتشغيل' : 'Click to play',
    noMedia: isAr ? 'لا توجد تسجيلات أو فيديوهات منشورة لهذا المعلم بعد.' : 'No published media recordings yet.',
    audioTitle: isAr ? 'تسجيلات صوتية' : 'Audio recitations',
    reviewsTitle: isAr ? 'آراء الطلاب وتقييماتهم' : 'Student reviews',
    noReviews: isAr ? 'لا توجد تقييمات منشورة بعد — كن أول من يحجز تجربة ويشارك رأيه.' : 'No published reviews yet.',
    studentFallback: isAr ? 'طالب وحي ونماء' : 'Academy student',
    freeTrialBadge: isAr ? 'حصة تجريبية مجانية · 100%' : '100% Free Trial Session',
    bookingHeading: isAr ? 'احجز حصتك التجريبية' : 'Book your free trial',
    bookingSubheading: isAr
      ? 'لقاء مباشر لتحديد مستواك والتعارف على أسلوب المعلم.'
      : 'Live 1-on-1 level assessment and introduction.',
    pickDayLabel: isAr ? 'المواعيد المتاحة قريبًا' : 'Upcoming available slots',
    pickTimeLabel: isAr ? 'اختر الوقت بتوقيت جهازك' : 'Choose time (local)',
    noSlotsNotice: isAr
      ? 'المعلم يستقبل طلبات الأوقات المقترحة — اختر وقتك المفضل في الخطوة التالية.'
      : 'Choose your preferred day and time in the next step for confirmation.',
    bookSelectedSlot: isAr ? 'احجز هذا الموعد المجاني' : 'Book this free slot',
    bookTrialAction: isAr ? 'احجز حصة تجريبية مجانية' : 'Book a free trial',
    lockedTutorBadge: isAr ? 'معلمك المعتمد' : 'Your Confirmed Tutor',
    lockedTutorTitle: isAr ? 'أنت تدرس حاليًا مع هذا المعلم' : 'You are enrolled with this tutor',
    lockedTutorDesc: isAr
      ? 'يمكنك متابعة جدول الحصص والواجبات والتقييمات مباشرة من لوحة الطالب.'
      : 'Follow your upcoming lessons, homework, and reports directly from your dashboard.',
    goToMySessions: isAr ? 'الذهاب إلى حصصي' : 'Go to my sessions',
    trustPoint1: isAr ? 'تقييم مستوى وتحديد خطة الحفظ' : 'Level check & personalized plan',
    trustPoint2: isAr ? 'تعديل الموعد متاح مجانًا' : 'Free rescheduling anytime',
    trustPoint3: isAr ? 'بدون أي بيانات بطاقة بنكية' : 'No payment card required',
  };
}
