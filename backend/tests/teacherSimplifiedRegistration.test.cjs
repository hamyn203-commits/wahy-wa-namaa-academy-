'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTeacherReviewGate,
  coreMediaAreDistinct,
} = require('../services/teacherReview');

test('coreMediaAreDistinct accepts single primary video and rejects duplicates across provided videos', () => {
  assert.equal(coreMediaAreDistinct({}), false);
  assert.equal(
    coreMediaAreDistinct({ recitationVideo: '/uploads/teachers/public/main.mp4' }),
    true
  );
  assert.equal(
    coreMediaAreDistinct({
      recitationVideo: '/uploads/teachers/public/main.mp4',
      introductionVideo: '',
      teachingMethodVideo: '',
    }),
    true
  );
  assert.equal(
    coreMediaAreDistinct({
      recitationVideo: '/uploads/teachers/public/main.mp4',
      introductionVideo: '/uploads/teachers/public/intro.mp4',
    }),
    true
  );
  assert.equal(
    coreMediaAreDistinct({
      recitationVideo: '/uploads/teachers/public/same.mp4',
      teachingMethodVideo: '/uploads/teachers/public/same.mp4',
    }),
    false
  );
});

test('buildTeacherReviewGate allows approval for streamlined 1-video application without optional videos or back ID', () => {
  const teacher = {
    personalInfo: {
      fullName: 'الشيخ عبد الله محمود',
      age: 31,
      gender: 'male',
      country: 'مصر',
      city: 'القاهرة',
      phone: '+201001234567',
    },
    academicInfo: {
      university: 'جامعة الأزهر',
      faculty: 'أصول الدين',
      graduationYear: 2018,
      specialization: 'تحفيظ قرآن',
      qualification: 'خريج',
    },
    quranInfo: {
      memorizedParts: 30,
      teachingExperience: 5,
    },
    documents: {
      idCardFront: 'private/teachers/id-front.jpg',
      idCardBack: 'not-provided',
      graduationCertificateAvailable: false,
      tajweedCertificatesAvailable: false,
      ijazatAvailable: false,
    },
    media: {
      profilePhoto: '/uploads/teachers/public/photo.jpg',
      recitationVideo: '/uploads/teachers/public/main-recitation.mp4',
      introductionVideo: '',
      teachingMethodVideo: '',
    },
    reviewChecklist: [
      { key: 'personal-info', status: 'approved' },
      { key: 'academic-info', status: 'approved' },
      { key: 'quran-profile', status: 'approved' },
      { key: 'profile-photo', status: 'approved' },
      { key: 'recitation-video', status: 'approved' },
      { key: 'id-card-front', status: 'approved' },
    ],
  };

  const gate = buildTeacherReviewGate(teacher);
  assert.equal(gate.requiredCount, 6);
  assert.equal(gate.completedRequired, 6);
  assert.equal(gate.readiness, 100);
  assert.equal(gate.approvalReady, true);
  assert.deepEqual(gate.blockers, []);
});

test('buildTeacherReviewGate still blocks approval if primary recitation video or front ID is missing', () => {
  const teacher = {
    personalInfo: {
      fullName: 'الشيخ عمر خالد',
      age: 28,
      gender: 'male',
      country: 'مصر',
      city: 'الإسكندرية',
      phone: '+201009998877',
    },
    academicInfo: {
      university: 'جامعة الأزهر',
      faculty: 'الشريعة',
      graduationYear: 2020,
      specialization: 'تحفيظ قرآن',
      qualification: 'خريج',
    },
    quranInfo: {
      memorizedParts: 30,
      teachingExperience: 2,
    },
    documents: {
      idCardFront: 'not-provided',
    },
    media: {
      profilePhoto: '/uploads/teachers/public/photo.jpg',
      recitationVideo: '',
    },
    reviewChecklist: [
      { key: 'personal-info', status: 'approved' },
      { key: 'academic-info', status: 'approved' },
      { key: 'quran-profile', status: 'approved' },
      { key: 'profile-photo', status: 'approved' },
      { key: 'recitation-video', status: 'approved' },
      { key: 'id-card-front', status: 'approved' },
    ],
  };

  const gate = buildTeacherReviewGate(teacher);
  assert.equal(gate.approvalReady, false);
  const blockerKeys = gate.blockers.map((b) => b.key);
  assert.ok(blockerKeys.includes('recitation-video'));
  assert.ok(blockerKeys.includes('id-card-front'));
});
