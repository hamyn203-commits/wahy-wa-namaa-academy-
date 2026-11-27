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

  if (student && (!studentGender || studentAge === null)) {
    throw safeguardingError(
      'PROFILE_DEMOGRAPHICS_REQUIRED',
      'يرجى استكمال العمر والجنس في الملف الشخصي قبل المتابعة',
      403
    );
  }

  if (normalizedSection === 'men_children') {
    if (student && studentGender === 'female' && (studentAge === null || studentAge >= 18)) {
      throw safeguardingError(
        'SECTION_GENDER_MISMATCH',
        'قسم الرجال والأطفال غير متاح للطالبات البالغات، يرجى اختيار قسم السيدات'
      );
    }
  }

  if (normalizedSection === 'ladies') {
    if (student && studentGender !== 'female') {
      throw safeguardingError(
        'SECTION_GENDER_MISMATCH',
        'قسم السيدات متاح للطالبات فقط'
      );
    }
    if (teacher && teacherGender !== 'female') {
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

  // Fail closed: gender separation cannot be evaluated against a teacher whose
  // gender is unknown, so such a teacher can never be matched to a student.
  if (student && teacher && !['male', 'female'].includes(teacherGender)) {
    throw safeguardingError(
      'TEACHER_GENDER_REQUIRED',
      'لا يمكن إتمام الحجز لأن بيانات المعلم غير مكتملة، يرجى التواصل مع الإدارة',
      409
    );
  }

  if (student && teacherGender) {
    if (teacherGender === 'female') {
      const allowedWithFemaleTeacher =
        studentGender === 'female'
        || (studentGender === 'male' && studentAge !== null && studentAge < 18);
      if (!allowedWithFemaleTeacher) {
        throw safeguardingError(
          'ADULT_MALE_FEMALE_TEACHER_FORBIDDEN',
          'لا يُسمح للطلاب الرجال البالغين بالحجز مع المعلمات'
        );
      }
    }
    if (teacherGender === 'male') {
      if (studentGender === 'female' && (studentAge === null || studentAge >= 18)) {
        throw safeguardingError(
          'ADULT_FEMALE_MALE_TEACHER_FORBIDDEN',
          'لا يُسمح للطالبات البالغات بالحجز مع المعلمين الرجال'
        );
      }
    }
  }

  if (normalizedCircleGender && teacher) {
    if (['girls', 'women', 'female'].includes(normalizedCircleGender) && teacherGender !== 'female') {
      throw safeguardingError(
        'CIRCLE_TEACHER_GENDER_MISMATCH',
        'حلقات الفتيات والسيدات مخصصة للمعلمات فقط'
      );
    }
    if (['boys', 'men', 'male'].includes(normalizedCircleGender) && teacherGender !== 'male') {
      throw safeguardingError(
        'CIRCLE_TEACHER_GENDER_MISMATCH',
        'حلقات البنين والرجال مخصصة للمعلمين الرجال فقط'
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
      if (studentGender !== 'male' || studentAge === null) {
        throw safeguardingError(
          'GENDER_MISMATCH',
          'هذه الحلقة مخصصة للبنين/الرجال فقط، يرجى اختيار حلقة متطابقة'
        );
      }
      if (normalizedCircleGender === 'boys' && studentAge >= 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للفتيان دون 18 عاماً'
        );
      }
      if (normalizedCircleGender === 'men' && studentAge < 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للرجال البالغين (18 عاماً فأكثر)'
        );
      }
    } else if (['girls', 'women'].includes(normalizedCircleGender)) {
      if (studentGender !== 'female' || studentAge === null) {
        throw safeguardingError(
          'GENDER_MISMATCH',
          'هذه الحلقة مخصصة للفتيات/النساء فقط، يرجى اختيار حلقة متطابقة'
        );
      }
      if (normalizedCircleGender === 'girls' && studentAge >= 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للفتيات دون 18 عاماً'
        );
      }
      if (normalizedCircleGender === 'women' && studentAge < 18) {
        throw safeguardingError(
          'AGE_GROUP_MISMATCH',
          'هذه الحلقة مخصصة للسيدات البالغات (18 عاماً فأكثر)'
        );
      }
    }
  }

  return true;
}

function isMinorStudent(student) {
  const rawAge = student?.age !== undefined && student?.age !== null && student?.age !== ''
    ? Number(student.age)
    : null;
  return Number.isFinite(rawAge) && rawAge > 0 && rawAge < 18;
}

/**
 * Minors (< 18) may only enter private 1-on-1 live lessons with an adult
 * teacher once an active guardian account is linked to them, so a guardian
 * can observe the classroom. An unverified guardian phone string is not enough.
 */
async function minorHasActiveGuardian(student) {
  if (!isMinorStudent(student)) return true;
  const studentId = student?._id || student?.id;
  if (!studentId) return false;
  const Guardian = require('../models/Guardian');
  const linked = await Guardian.exists({
    isActive: { $ne: false },
    'children.student': studentId,
  });
  return Boolean(linked);
}

const MINOR_GUARDIAN_REQUIRED_RESPONSE = Object.freeze({
  code: 'MINOR_GUARDIAN_VERIFICATION_REQUIRED',
  error: 'حفاظاً على سلامة الطلاب القُصّر، يجب أن يقبل ولي الأمر دعوة الربط بحسابه قبل حجز الحصص الفردية',
});

module.exports = {
  assertGenderAndAgeCompatibility,
  isMinorStudent,
  minorHasActiveGuardian,
  MINOR_GUARDIAN_REQUIRED_RESPONSE,
};
