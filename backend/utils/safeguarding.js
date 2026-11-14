'use strict';

function safeguardingError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.publicMessage = message;
  return err;
}

/**
 * Enforces gender separation and minor age-group boundaries across
 * subscriptions, manual payments, group circles, and 1-on-1 sessions.
 */
function assertGenderAndAgeCompatibility({
  student = null,
  teacher = null,
  section = null,
  circleGender = null,
} = {}) {
  const studentGender = student?.gender ? String(student.gender).trim().toLowerCase() : '';
  const rawAge = student?.age !== undefined && student?.age !== null && student?.age !== ''
    ? Number(student.age)
    : null;
  const studentAge = Number.isFinite(rawAge) && rawAge > 0 ? rawAge : null;
  const teacherGender = teacher?.personalInfo?.gender
    ? String(teacher.personalInfo.gender).trim().toLowerCase()
    : '';
  const normalizedSection = section ? String(section).trim() : '';
  const normalizedCircleGender = circleGender ? String(circleGender).trim() : '';

  if (normalizedSection === 'ladies') {
    if (studentGender && studentGender !== 'female') {
      throw safeguardingError(
        'SECTION_GENDER_MISMATCH',
        'قسم السيدات متاح للطالبات فقط'
      );
    }
    if (teacherGender && teacherGender !== 'female') {
      throw safeguardingError(
        'LADIES_SECTION_TEACHER_MISMATCH',
        'قسم السيدات متاح مع المعلمات فقط'
      );
    }
    if (normalizedCircleGender && !['girls', 'women'].includes(normalizedCircleGender)) {
      throw safeguardingError(
        'GENDER_MISMATCH',
        'قسم السيدات يقبل حلقات الفتيات والسيدات فقط'
      );
    }
  }

  if (student && teacherGender) {
    if (studentGender === 'male' && studentAge !== null && studentAge >= 18 && teacherGender === 'female') {
      throw safeguardingError(
        'ADULT_MALE_FEMALE_TEACHER_FORBIDDEN',
        'لا يُسمح للطلاب الرجال البالغين بالحجز مع المعلمات'
      );
    }
    if (studentGender === 'female' && studentAge !== null && studentAge >= 18 && teacherGender === 'male') {
      throw safeguardingError(
        'ADULT_FEMALE_MALE_TEACHER_FORBIDDEN',
        'لا يُسمح للطالبات البالغات بالحجز مع المعلمين الرجال'
      );
    }
  }

  if (normalizedCircleGender && teacherGender) {
    if (['girls', 'women'].includes(normalizedCircleGender) && teacherGender !== 'female') {
      throw safeguardingError(
        'CIRCLE_TEACHER_GENDER_MISMATCH',
        'حلقات الفتيات والسيدات مخصصة للمعلمات فقط'
      );
    }
    if (normalizedCircleGender === 'men' && teacherGender === 'female') {
      throw safeguardingError(
        'CIRCLE_TEACHER_GENDER_MISMATCH',
        'حلقات الرجال البالغين مخصصة للمعلمين الرجال فقط'
      );
    }
  }

  if (normalizedCircleGender && student) {
    if (normalizedCircleGender === 'kids_mixed') {
      if (studentAge === null || studentAge > 12) {
        throw safeguardingError(
          'KIDS_CIRCLE_AGE_EXCEEDED',
          'حلقات البراعم المختلطة مخصصة للأطفال حتى سن 12 عاماً فقط'
        );
      }
    } else if (['boys', 'men'].includes(normalizedCircleGender)) {
      if (studentGender !== 'male') {
        throw safeguardingError(
          'GENDER_MISMATCH',
          'هذه الحلقة مخصصة للبنين/الرجال فقط، يرجى اختيار حلقة متطابقة'
        );
      }
      if (normalizedCircleGender === 'boys' && studentAge !== null && studentAge >= 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للفتيان دون 18 عاماً'
        );
      }
    } else if (['girls', 'women'].includes(normalizedCircleGender)) {
      if (studentGender !== 'female') {
        throw safeguardingError(
          'GENDER_MISMATCH',
          'هذه الحلقة مخصصة للفتيات/النساء فقط، يرجى اختيار حلقة متطابقة'
        );
      }
      if (normalizedCircleGender === 'girls' && studentAge !== null && studentAge >= 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للفتيات دون 18 عاماً'
        );
      }
    }
  }

  return true;
}

module.exports = {
  assertGenderAndAgeCompatibility,
};
