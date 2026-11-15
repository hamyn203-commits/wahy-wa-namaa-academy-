const crypto = require('crypto');
const Guardian = require('../models/Guardian');
const GuardianInvitation = require('../models/GuardianInvitation');
const User = require('../models/User');
const { normalizePhone, maskPhone } = require('../utils/phone');
const { notifyUser } = require('../utils/notify');

const INVITATION_TTL_DAYS = 180;

async function createUniqueLinkCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `WN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const [inviteExists, userExists] = await Promise.all([
      GuardianInvitation.exists({ linkCode: code }),
      User.exists({ guardianLinkCode: code }),
    ]);
    if (!inviteExists && !userExists) return code;
  }
  throw new Error('Unable to generate a unique guardian invitation code');
}

function invitationExpiresAt() {
  return new Date(Date.now() + (INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000));
}

async function notifyMatchingGuardian({ normalizedPhone, rawPhone, invitation, studentName }) {
  const candidates = await User.find({
    role: 'guardian',
    isActive: { $ne: false },
    $or: [
      { phoneNormalized: normalizedPhone },
      ...(rawPhone ? [{ phone: rawPhone }] : []),
    ],
  }).select('_id');

  const ids = [...new Set(candidates.map((candidate) => String(candidate._id)))];
  if (ids.length !== 1) return;

  await notifyUser(ids[0], {
    type: 'system',
    title: { ar: 'طلب ربط ابن جديد', en: 'New child link request' },
    message: {
      ar: `${studentName || 'طالب'} استخدم رقمك كولي أمر. راجع الطلب من بوابة ولي الأمر.`,
      en: `${studentName || 'A student'} used your phone as a guardian. Review the request in the guardian portal.`,
    },
    data: {
      actionUrl: '/guardian/dashboard',
      metadata: { guardianInvitationId: String(invitation._id) },
    },
    priority: 'high',
  });
}

async function expireStaleInvitations(filter = {}) {
  const now = new Date();
  await GuardianInvitation.updateMany(
    {
      ...filter,
      status: 'pending',
      expiresAt: { $lte: now },
    },
    {
      $set: { status: 'expired' },
      $push: { history: { action: 'expired', at: now } },
    },
  );
}

async function createGuardianInvitation({
  studentId,
  guardianPhone,
  relationship = 'guardian',
  source = 'student-dashboard',
}) {
  const normalized = normalizePhone(guardianPhone);
  if (!normalized) {
    const error = new Error('رقم ولي الأمر غير صالح');
    error.code = 'INVALID_GUARDIAN_PHONE';
    throw error;
  }

  const allowedRelationships = new Set(['father', 'mother', 'guardian', 'other']);
  const safeRelationship = allowedRelationships.has(relationship) ? relationship : 'guardian';

  const student = await User.findOne({ _id: studentId, role: 'student' }).select('_id name phone +phoneNormalized');
  if (!student) {
    const error = new Error('Student not found');
    error.code = 'STUDENT_NOT_FOUND';
    throw error;
  }

  const studentPhone = student.phoneNormalized || normalizePhone(student.phone);
  if (studentPhone && studentPhone === normalized) {
    const error = new Error('رقم ولي الأمر يجب أن يكون مختلفًا عن رقم الطالب');
    error.code = 'GUARDIAN_PHONE_MATCHES_STUDENT';
    throw error;
  }

  await expireStaleInvitations({ student: studentId });

  const existing = await GuardianInvitation.findOne({
    student: studentId,
    guardianPhoneNormalized: normalized,
    relationship: safeRelationship,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('+linkCode +guardianPhone +guardianPhoneNormalized');

  if (existing) {
    existing.guardianPhone = guardianPhone;
    existing.expiresAt = invitationExpiresAt();
    existing.history.push({ action: 'renewed', actor: studentId });
    await existing.save();
    await notifyMatchingGuardian({
      normalizedPhone: normalized,
      rawPhone: guardianPhone,
      invitation: existing,
      studentName: student.name,
    }).catch(() => {});
    return existing;
  }

  const pendingCount = await GuardianInvitation.countDocuments({
    student: studentId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (pendingCount >= 4) {
    const error = new Error('يمكن للطالب الاحتفاظ بأربع دعوات ولي أمر معلقة كحد أقصى');
    error.code = 'TOO_MANY_PENDING_GUARDIANS';
    throw error;
  }

  const invitation = await GuardianInvitation.create({
    student: studentId,
    guardianPhone,
    guardianPhoneNormalized: normalized,
    relationship: safeRelationship,
    status: 'pending',
    linkCode: await createUniqueLinkCode(),
    source,
    expiresAt: invitationExpiresAt(),
    history: [{ action: 'created', actor: studentId }],
  });

  await notifyMatchingGuardian({
    normalizedPhone: normalized,
    rawPhone: guardianPhone,
    invitation,
    studentName: student.name,
  }).catch(() => {});

  return invitation;
}

async function linkGuardianToStudent({ guardianUserId, studentId, relationship = 'guardian' }) {
  const student = await User.findOne({ _id: studentId, role: 'student' }).select('_id name age guardian privacyConsent');
  if (!student) {
    const error = new Error('Student not found');
    error.code = 'STUDENT_NOT_FOUND';
    throw error;
  }

  let guardianProfile = await Guardian.findOne({ user: guardianUserId });
  if (!guardianProfile) {
    guardianProfile = new Guardian({ user: guardianUserId, children: [] });
  }

  const alreadyLinked = guardianProfile.children.some(
    (entry) => entry.student && String(entry.student) === String(student._id),
  );

  if (!alreadyLinked) {
    await guardianProfile.addChild(student._id.toString(), relationship, {
      viewProgress: true,
      viewGrades: true,
      viewAttendance: true,
      receiveNotifications: true,
      approveEnrollments: false,
    });
  }

  let studentModified = false;
  if (!student.guardian) {
    student.guardian = guardianUserId;
    studentModified = true;
  }
  const studentAge = Number(student.age || 0);
  if (studentAge > 0 && studentAge < 18 && student.privacyConsent?.parentalConsentVerified !== true) {
    student.set('privacyConsent.parentalConsentVerified', true);
    student.set('privacyConsent.parentalConsentAt', new Date());
    studentModified = true;
  }
  if (studentModified) {
    await student.save();
  }

  await User.findByIdAndUpdate(guardianUserId, {
    $addToSet: { children: student._id },
  });

  return { student, guardianProfile, alreadyLinked };
}

function presentStudentInvitation(invitation) {
  const raw = invitation?.toObject ? invitation.toObject() : invitation;
  return {
    _id: raw._id,
    relationship: raw.relationship,
    status: raw.status,
    source: raw.source,
    phoneMasked: maskPhone(raw.guardianPhone || raw.guardianPhoneNormalized),
    linkCode: raw.status === 'pending' ? raw.linkCode : undefined,
    expiresAt: raw.expiresAt,
    respondedAt: raw.respondedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

module.exports = {
  INVITATION_TTL_DAYS,
  createUniqueLinkCode,
  createGuardianInvitation,
  expireStaleInvitations,
  linkGuardianToStudent,
  presentStudentInvitation,
};
