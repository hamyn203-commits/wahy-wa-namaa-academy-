const REVIEW_ITEMS = Object.freeze([
  { key: 'personal-info', label: 'البيانات الشخصية', required: true },
  { key: 'academic-info', label: 'البيانات الأكاديمية', required: true },
  { key: 'quran-profile', label: 'ملف القرآن والخبرة', required: true },
  { key: 'profile-photo', label: 'الصورة الشخصية', required: true },
  { key: 'recitation-video', label: 'فيديو التلاوة', required: true },
  { key: 'id-card-front', label: 'وجه بطاقة الهوية', required: true },
  { key: 'id-card-back', label: 'ظهر بطاقة الهوية (اختياري)', required: false },
  { key: 'introduction-video', label: 'فيديو تعريفي منفصل (اختياري)', required: false },
  { key: 'teaching-method-video', label: 'فيديو طريقة التدريس (اختياري)', required: false },
  { key: 'graduation-certificate', label: 'شهادة التخرج', required: false, conditional: 'graduationCertificateAvailable' },
  { key: 'tajweed-certificates', label: 'شهادات التجويد', required: false, conditional: 'tajweedCertificatesAvailable' },
  { key: 'ijazat', label: 'الإجازات', required: false, conditional: 'ijazatAvailable' },
]);

const VALID_STATUSES = new Set(['pending', 'approved', 'changes-requested', 'not-applicable']);

function provided(value) {
  const normalized = String(value || '').trim();
  return Boolean(
    normalized
    && normalized !== 'not-provided'
    && normalized !== '/default-teacher.png'
    && !normalized.toLowerCase().includes('placeholder')
  );
}

function coreMediaAreDistinct(media = {}) {
  const refs = [
    media.introductionVideo,
    media.recitationVideo,
    media.teachingMethodVideo,
  ].map((value) => String(value || '').trim()).filter(provided);

  return refs.length >= 1 && new Set(refs).size === refs.length;
}

function checklistMap(teacher) {
  return new Map((teacher.reviewChecklist || []).map((item) => [item.key, item]));
}

function itemAvailability(teacher, key) {
  const documents = teacher.documents || {};
  const media = teacher.media || {};
  const personal = teacher.personalInfo || {};
  const academic = teacher.academicInfo || {};
  const quran = teacher.quranInfo || {};

  switch (key) {
    case 'personal-info':
      return Boolean(personal.fullName && personal.age && personal.gender && personal.country && personal.city && personal.phone);
    case 'academic-info':
      return Boolean(academic.university && academic.faculty && academic.graduationYear && academic.specialization && academic.qualification);
    case 'quran-profile':
      return Number.isFinite(Number(quran.memorizedParts)) && Number.isFinite(Number(quran.teachingExperience));
    case 'profile-photo':
      return provided(media.profilePhoto);
    case 'introduction-video':
      return provided(media.introductionVideo);
    case 'recitation-video':
      return provided(media.recitationVideo);
    case 'teaching-method-video':
      return provided(media.teachingMethodVideo);
    case 'id-card-front':
      return provided(documents.idCardFront || documents.idCard);
    case 'id-card-back':
      return provided(documents.idCardBack);
    case 'graduation-certificate':
      return !documents.graduationCertificateAvailable || provided(documents.graduationCertificate);
    case 'tajweed-certificates':
      return !documents.tajweedCertificatesAvailable || (documents.tajweedCertificates || []).some(provided);
    case 'ijazat':
      return !documents.ijazatAvailable || (documents.ijazat || []).some(provided);
    default:
      return false;
  }
}

function itemRequiredForTeacher(teacher, item) {
  if (item.required) return true;
  if (!item.conditional) return false;
  return Boolean(teacher.documents?.[item.conditional]);
}

function buildTeacherReviewGate(teacher) {
  const map = checklistMap(teacher);

  const items = REVIEW_ITEMS.map((item) => {
    const current = map.get(item.key);
    const requiredForTeacher = itemRequiredForTeacher(teacher, item);
    const available = itemAvailability(teacher, item.key);
    const status = VALID_STATUSES.has(current?.status) ? current.status : 'pending';
    const canMarkNotApplicable = !requiredForTeacher;

    const satisfied = requiredForTeacher
      ? available && status === 'approved'
      : (
          status === 'approved'
          || status === 'not-applicable'
          || (!item.conditional && !item.required)
        );

    return {
      ...item,
      requiredForTeacher,
      available,
      status,
      note: current?.note || '',
      reviewedBy: current?.reviewedBy || null,
      reviewedAt: current?.reviewedAt || null,
      canMarkNotApplicable,
      satisfied,
    };
  });

  const requiredItems = items.filter((item) => item.requiredForTeacher);
  const mediaDistinct = coreMediaAreDistinct(teacher.media || {});
  const completedRequired = requiredItems.filter((item) => item.satisfied).length;
  const requiredCount = requiredItems.length;
  const readiness = requiredCount
    ? Math.round((completedRequired / requiredCount) * 100)
    : 100;
  const blockers = requiredItems
    .filter((item) => !item.satisfied)
    .map((item) => ({
      key: item.key,
      label: item.label,
      reason: !item.available ? 'missing-asset-or-data' : 'not-reviewed',
    }));

  if (!mediaDistinct) {
    blockers.push({
      key: 'core-media-distinct',
      label: 'تنوع فيديوهات التعريف والتلاوة وطريقة التدريس',
      reason: 'duplicate-required-media',
    });
  }

  return {
    items,
    readiness,
    approvalReady: requiredItems.every((item) => item.satisfied) && mediaDistinct,
    requiredCount,
    completedRequired,
    blockers,
    qualityChecks: { coreMediaDistinct: mediaDistinct },
  };
}

function sanitizeChecklistStatus(status, requiredForTeacher) {
  if (!VALID_STATUSES.has(status)) return null;
  if (requiredForTeacher && status === 'not-applicable') return null;
  return status;
}

module.exports = {
  REVIEW_ITEMS,
  VALID_STATUSES,
  buildTeacherReviewGate,
  sanitizeChecklistStatus,
  itemRequiredForTeacher,
  coreMediaAreDistinct,
};
