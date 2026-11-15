function cleanText(value, maxLength) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().slice(0, maxLength);
  return text || undefined;
}

function cleanNumber(value, min, max) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return undefined;
  return number;
}

function sanitizeTeacherProfileChange(input = {}) {
  const personalInfo = {};
  const academicInfo = {};
  const quranInfo = {};
  const user = {};

  const fullName = cleanText(input.personalInfo?.fullName, 120);
  const city = cleanText(input.personalInfo?.city, 100);
  const university = cleanText(input.academicInfo?.university, 160);
  const faculty = cleanText(input.academicInfo?.faculty, 160);
  const qualification = cleanText(input.academicInfo?.qualification, 160);
  const teachingExperience = cleanNumber(input.quranInfo?.teachingExperience, 0, 80);
  const numberOfIjazat = cleanNumber(input.quranInfo?.numberOfIjazat, 0, 100);
  const bio = cleanText(input.user?.bio, 500);

  if (fullName !== undefined) personalInfo.fullName = fullName;
  if (city !== undefined) personalInfo.city = city;
  if (university !== undefined) academicInfo.university = university;
  if (faculty !== undefined) academicInfo.faculty = faculty;
  if (qualification !== undefined) academicInfo.qualification = qualification;
  if (teachingExperience !== undefined) quranInfo.teachingExperience = teachingExperience;
  if (numberOfIjazat !== undefined) quranInfo.numberOfIjazat = numberOfIjazat;
  if (bio !== undefined) user.bio = bio;

  return { personalInfo, academicInfo, quranInfo, user, media: {} };
}

function listChangedFields(proposed = {}) {
  const fields = [];
  for (const group of ['personalInfo', 'academicInfo', 'quranInfo', 'user', 'media']) {
    for (const key of Object.keys(proposed[group] || {})) {
      if (proposed[group][key] !== undefined && proposed[group][key] !== null && proposed[group][key] !== '') {
        fields.push(`${group}.${key}`);
      }
    }
  }
  return fields;
}

function mergeTeacherMedia(current = {}, proposed = {}) {
  return {
    ...current,
    ...Object.fromEntries(Object.entries(proposed || {}).filter(([, value]) => Boolean(value))),
  };
}

function applyTeacherProfileChange(teacher, userDoc, proposed = {}) {
  for (const [key, value] of Object.entries(proposed.personalInfo || {})) {
    teacher.set(`personalInfo.${key}`, value);
  }
  for (const [key, value] of Object.entries(proposed.academicInfo || {})) {
    teacher.set(`academicInfo.${key}`, value);
  }
  for (const [key, value] of Object.entries(proposed.quranInfo || {})) {
    teacher.set(`quranInfo.${key}`, value);
  }
  for (const [key, value] of Object.entries(proposed.media || {})) {
    if (value) teacher.set(`media.${key}`, value);
  }

  if (userDoc) {
    if (proposed.personalInfo?.fullName) userDoc.name = proposed.personalInfo.fullName;
    if (proposed.user?.bio !== undefined) userDoc.bio = proposed.user.bio;
  }

  return { teacher, userDoc };
}

module.exports = {
  sanitizeTeacherProfileChange,
  listChangedFields,
  mergeTeacherMedia,
  applyTeacherProfileChange,
};
