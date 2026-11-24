const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const TeacherProfileChangeRequest = require('../models/TeacherProfileChangeRequest');
const User = require('../models/User');
const Session = require('../models/Session');
const { protect, authorize, getAccessSecret, verifyAccessTokenString, verifyLiveSessionPrincipal } = require('../middleware/auth');
const objectStorage = require('../services/objectStorage');
const crypto = require('crypto');
const { boundedMediaRange } = require('../utils/mediaByteRange');
const { resolveOwnedTeacherAssets } = require('../utils/teacherAssetLifecycle');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const { consumeVerificationTokenJti } = require('./verification');
const { sendEmail } = require('../services/notificationDispatcher');
const { notifyAdmins, notifyUser } = require('../utils/notify');
const AdminAuditLog = require('../models/AdminAuditLog');
const { logAdminAction } = require('../services/adminAudit');
const { extractReviewFeedback } = require('../utils/teacherAccess');
const {
  REVIEW_ITEMS,
  buildTeacherReviewGate,
  sanitizeChecklistStatus,
  itemRequiredForTeacher,
  coreMediaAreDistinct,
} = require('../services/teacherReview');
const { mergeTeacherMedia, applyTeacherProfileChange } = require('../services/teacherProfileChange');
const {
  extractClientIp,
  createTeacherInvite,
  listTeacherInvites,
  validateTeacherInvite,
  consumeTeacherInviteAtomic,
  finalizeTeacherInviteUsage,
  rollbackTeacherInviteReservation,
  revealTeacherInviteLink,
  resetTeacherInviteIpLock,
  revokeTeacherInvite,
  deleteTeacherInvite,
} = require('../services/teacherInvite');
const { validateMagicBytes } = require('../utils/magicBytes');
const { normalizePhone, syntheticPhoneEmail } = require('../utils/phone');

const inviteStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many invitation checks, please try again later.', code: 'INVITE_RATE_LIMITED' },
});
const multer = require('multer');
const {
  addMockUser,
  findMockUserByEmail,
  findMockUserByPhone,
  findMockUserById,
  addMockTeacher,
  findMockTeacherByUserId,
  findMockTeacherById,
  updateMockTeacher,
  getMockTeachers,
  tasks: mockTasks,
  withdrawals: mockWithdrawals,
} = require('../mockStore');


const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

function createTeacherApplicationStatusToken({ userId, teacherId, email }) {
  return jwt.sign(
    {
      purpose: 'teacher-application-status',
      userId: String(userId),
      teacherId: String(teacherId),
      email: String(email || '').trim().toLowerCase(),
    },
    getAccessSecret(),
    { expiresIn: '7d' }
  );
}

const publicUploadDir = path.join(__dirname, '..', 'uploads', 'teachers', 'public');
const privateUploadDir = path.join(__dirname, '..', 'uploads', 'private', 'teachers');
const privateFields = new Set(['idCard', 'idCardFront', 'idCardBack', 'graduationCertificate', 'tajweedCertificates', 'ijazat']);

if (process.env.FILE_STORAGE_DRIVER !== 'external') {
  for (const dir of [publicUploadDir, privateUploadDir]) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.warn('Uploads dir warning:', e.message);
    }
  }
}

const externalStorage =
  process.env.FILE_STORAGE_DRIVER === 'external' ||
  ['vercel-blob', 's3'].includes(objectStorage.getDriver());

const SAFE_ADMIN_ASSET_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);

function clampSafeAdminMime(rawMime, fallback = 'application/octet-stream') {
  const clean = String(rawMime || '').split(';')[0].trim().toLowerCase();
  return SAFE_ADMIN_ASSET_MIMES.has(clean) ? clean : fallback;
}

async function streamAdminTeacherAsset(reference, res, { fallbackContentType = 'application/octet-stream' } = {}) {
  reference = objectStorage.unwrapPublicProxyReference(reference);
  if (!reference || reference === 'not-provided' || reference === '/default-teacher.png') {
    return res.status(404).json({ error: 'Asset not found' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', 'attachment');

  if (/^https?:\/\//i.test(reference)) {
    // External object-storage references stay private and are streamed through
    // this authenticated admin endpoint.
    const result = await objectStorage.getPrivateObject(reference, {
      ifNoneMatch: res.req?.headers?.['if-none-match'],
    }).catch(() => null);

    if (result) {
      if (result.statusCode === 304) return res.status(304).end();
      res.setHeader('Content-Type', clampSafeAdminMime(result.blob?.contentType, fallbackContentType));
      if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

      if (result.stream?.pipe) return result.stream.pipe(res);
      const reader = result.stream?.getReader?.();
      if (!reader) return res.status(404).json({ error: 'Asset not found' });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      return res.end();
    }

    try {
      const parsed = new URL(reference);
      reference = parsed.pathname;
    } catch {
      return res.status(404).json({ error: 'Asset not found' });
    }
  }

  const normalized = String(reference).replace(/^\/+/, '');
  let absolutePath = null;

  if (normalized.startsWith('uploads/teachers/public/')) {
    absolutePath = path.join(publicUploadDir, path.basename(normalized));
  } else if (normalized.startsWith('private/teachers/')) {
    absolutePath = path.join(privateUploadDir, path.basename(normalized));
  }

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  return res.sendFile(absolutePath);
}

function teacherDossierPayload(teacher, gate, auditEntries = [], activity = {}, profileChange = null) {
  const raw = teacher.toObject ? teacher.toObject() : teacher;
  const documents = raw.documents || {};
  const media = raw.media || {};

  return {
    teacher: {
      _id: raw._id,
      user: raw.user,
      personalInfo: raw.personalInfo,
      academicInfo: raw.academicInfo,
      quranInfo: raw.quranInfo,
      languages: raw.languages || [],
      hourlyRate: raw.hourlyRate,
      isFeatured: Boolean(raw.isFeatured),
      isPublic: raw.isPublic !== false,
      availabilityTimezone: raw.availabilityTimezone,
      availability: raw.availability || [],
      status: raw.status,
      isVerified: raw.isVerified,
      reviewNotes: raw.reviewNotes || [],
      reviewChecklist: raw.reviewChecklist || [],
      reviewStartedAt: raw.reviewStartedAt,
      reviewCompletedAt: raw.reviewCompletedAt,
      rating: raw.rating,
      stats: raw.stats,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      documents: {
        idCard: Boolean(documents.idCard && documents.idCard !== 'not-provided'),
        idCardFront: Boolean(
          (documents.idCardFront && documents.idCardFront !== 'not-provided')
          || (documents.idCard && documents.idCard !== 'not-provided')
        ),
        idCardBack: Boolean(documents.idCardBack && documents.idCardBack !== 'not-provided'),
        graduationCertificateAvailable: Boolean(documents.graduationCertificateAvailable),
        graduationCertificate: Boolean(documents.graduationCertificate && documents.graduationCertificate !== 'not-provided'),
        tajweedCertificatesAvailable: Boolean(documents.tajweedCertificatesAvailable),
        tajweedCertificatesCount: (documents.tajweedCertificates || []).filter(Boolean).length,
        ijazatAvailable: Boolean(documents.ijazatAvailable),
        ijazatCount: (documents.ijazat || []).filter(Boolean).length,
      },
      media: {
        profilePhoto: Boolean(media.profilePhoto && media.profilePhoto !== '/default-teacher.png'),
        introductionVideo: Boolean(media.introductionVideo && media.introductionVideo !== '/default-teacher.png'),
        recitationVideo: Boolean(media.recitationVideo && media.recitationVideo !== '/default-teacher.png'),
        teachingMethodVideo: Boolean(media.teachingMethodVideo && media.teachingMethodVideo !== '/default-teacher.png'),
        additionalVideosCount: (media.additionalVideos || []).filter(Boolean).length,
        audioRecordingsCount: (media.audioRecordings || []).filter(Boolean).length,
      },
    },
    gate,
    activity,
    audit: auditEntries.map((entry) => ({
      _id: entry._id,
      action: entry.action,
      reason: entry.reason,
      metadata: entry.metadata,
      actor: entry.actor,
      createdAt: entry.createdAt,
    })),
    profileChange: profileChange ? {
      _id: profileChange._id,
      status: profileChange.status,
      changedFields: profileChange.changedFields || [],
      proposed: {
        personalInfo: profileChange.proposed?.personalInfo || {},
        academicInfo: profileChange.proposed?.academicInfo || {},
        quranInfo: profileChange.proposed?.quranInfo || {},
        user: profileChange.proposed?.user || {},
        media: {
          profilePhoto: Boolean(profileChange.proposed?.media?.profilePhoto),
          introductionVideo: Boolean(profileChange.proposed?.media?.introductionVideo),
          recitationVideo: Boolean(profileChange.proposed?.media?.recitationVideo),
          teachingMethodVideo: Boolean(profileChange.proposed?.media?.teachingMethodVideo),
        },
      },
      adminNote: profileChange.adminNote || '',
      reviewedBy: profileChange.reviewedBy || null,
      reviewedAt: profileChange.reviewedAt || null,
      createdAt: profileChange.createdAt,
      updatedAt: profileChange.updatedAt,
    } : null,
  };
}

const diskStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, privateFields.has(file.fieldname) ? privateUploadDir : publicUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const publicMediaPath = (file) => file ? `/uploads/teachers/public/${path.basename(file.path)}` : null;
const privateDocumentPath = (file) => file ? `private/teachers/${path.basename(file.path)}` : null;

function directReference(value) {
  return value?.url || value?.pathname || null;
}

function validateDirectUpload(value, purpose, owner) {
  if (!value) return true;
  const ref = directReference(value);
  if (!ref || !owner) return false;

  return objectStorage.isOwnedObjectReference(ref, purpose, owner);
}

function validateDirectUploadList(values, purpose, owner) {
  return (values || []).every((value) => validateDirectUpload(value, purpose, owner));
}

const PUBLIC_TEACHER_SELECT =
  'user personalInfo.fullName personalInfo.gender personalInfo.country personalInfo.city academicInfo quranInfo languages rating stats hourlyRate isVerified isFeatured media availabilityTimezone createdAt';

const PUBLIC_TEACHER_LIST_SELECT =
  'user personalInfo.fullName personalInfo.gender personalInfo.country personalInfo.city academicInfo.specialization academicInfo.qualification quranInfo languages rating stats hourlyRate isVerified isFeatured media.profilePhoto media.introductionVideo media.recitationVideo availabilityTimezone createdAt';

function normalizePublicMediaField(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'not-provided') return '';
  if (raw.includes('/api/uploads/public?ref=')) return raw;
  if (/^https:\/\/[a-z0-9]+\.private\.blob\.vercel-storage\.com\/uploads\/(?:teacher-public|student-avatar)\//i.test(raw)) {
    return objectStorage.publicProxyUrl(raw) || raw;
  }
  return raw;
}

function sanitizePublicTeacher(doc) {
  const teacher = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };

  delete teacher.documents;
  delete teacher.reviewNotes;
  delete teacher.reviewChecklist;
  delete teacher.reviewStartedAt;
  delete teacher.reviewCompletedAt;
  delete teacher.earnings;
  delete teacher.assetsPurgedAt;
  delete teacher.storageOwner;
  delete teacher.ledgerLockVersion;

  if (teacher.personalInfo) {
    teacher.personalInfo = {
      fullName: teacher.personalInfo.fullName,
      gender: teacher.personalInfo.gender,
      country: teacher.personalInfo.country,
      city: teacher.personalInfo.city,
    };
  }

  if (teacher.media && typeof teacher.media === 'object') {
    const nextMedia = { ...teacher.media };
    for (const key of ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo']) {
      if (nextMedia[key] !== undefined) {
        nextMedia[key] = normalizePublicMediaField(nextMedia[key]);
      }
    }
    if (Array.isArray(nextMedia.additionalVideos)) {
      nextMedia.additionalVideos = nextMedia.additionalVideos.map(normalizePublicMediaField).filter(Boolean);
    }
    if (Array.isArray(nextMedia.audioRecordings)) {
      nextMedia.audioRecordings = nextMedia.audioRecordings.map(normalizePublicMediaField).filter(Boolean);
    }
    teacher.media = nextMedia;
  }

  if (teacher.user && typeof teacher.user === 'object') {
    teacher.user = {
      _id: teacher.user._id,
      name: teacher.user.name,
      avatar: normalizePublicMediaField(teacher.user.avatar),
      bio: teacher.user.bio,
    };
  }

  return teacher;
}

const upload = multer({
  storage: externalStorage ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 4 * 1024 * 1024, files: 16 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|jfif|png|pdf|mp4|webm|mov|quicktime|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, videos, and audio files are allowed'));
    }
  },
});

async function optionalTeacherRegistrationAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return next();
  try {
    const { decoded: identity } = await verifyAccessTokenString(header.slice(7));
    if (identity.role !== 'teacher') return res.status(403).json({ error: 'Only teacher accounts can submit a teacher application' });
    if (isDBConnected()) {
      const account = await User.findById(identity.id).select('role isActive');
      if (!account || account.role !== 'teacher' || account.isActive !== true) return res.status(403).json({ error: 'Teacher account not active' });
    }
    req.user = identity;
    return next();
  } catch (err) {
    return res.status(err?.status || 401).json({ error: 'Invalid session. Please sign in again.' });
  }
}

function guardExternalMultipartBeforeMulter(req, res, next) {
  const isExternalActive =
    process.env.FILE_STORAGE_DRIVER === 'external' ||
    ['vercel-blob', 's3'].includes(objectStorage.getDriver());
  if (isExternalActive && req.is('multipart/form-data')) {
    return res.status(503).json({
      error: 'External file storage is not configured yet',
      code: 'FILE_STORAGE_NOT_READY',
    });
  }
  return next();
}

function sanitizeParsedMultipartValue(value, depth = 0) {
  if (depth > 12) return undefined;
  if (typeof value === 'string') {
    return value
      .replace(/<\s*\/?\s*script\b[^>]*>/gi, '')
      .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
      .replace(/\bon[a-z]{2,20}\s*=/gi, '');
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeParsedMultipartValue(entry, depth + 1));
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') {
        continue;
      }
      clean[k] = sanitizeParsedMultipartValue(v, depth + 1);
    }
    return clean;
  }
  return value;
}

function parseSafeMultipartJson(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'object') return sanitizeParsedMultipartValue(raw);
  const str = String(raw);
  if (str.length > 65536) {
    const err = new Error('JSON field exceeds maximum allowed length');
    err.status = 400;
    throw err;
  }
  return sanitizeParsedMultipartValue(JSON.parse(str));
}

function verifyMultipartFilesMagicBytes(filesMap) {
  if (!filesMap || typeof filesMap !== 'object') return { ok: true };
  for (const list of Object.values(filesMap)) {
    if (!Array.isArray(list)) continue;
    for (const file of list) {
      if (!file) continue;
      let headerBytes = null;
      if (Buffer.isBuffer(file.buffer)) {
        headerBytes = file.buffer.subarray(0, 64);
      } else if (file.path && fs.existsSync(file.path)) {
        const fd = fs.openSync(file.path, 'r');
        try {
          const buf = Buffer.alloc(64);
          const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
          headerBytes = buf.subarray(0, bytesRead);
        } finally {
          fs.closeSync(fd);
        }
      }
      if (headerBytes) {
        const normalizedMime = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
        const check = validateMagicBytes(headerBytes, normalizedMime);
        if (!check.valid) {
          return { ok: false, error: 'Invalid uploaded file signature' };
        }
      }
    }
  }
  return { ok: true };
}

router.post(
  '/register',
  optionalTeacherRegistrationAuth,
  guardExternalMultipartBeforeMulter,
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
    { name: 'graduationCertificate', maxCount: 1 },
    { name: 'tajweedCertificates', maxCount: 5 },
    { name: 'ijazat', maxCount: 5 },
    { name: 'introductionVideo', maxCount: 1 },
    { name: 'recitationVideo', maxCount: 5 },
    { name: 'teachingMethodVideo', maxCount: 1 },
    { name: 'additionalVideos', maxCount: 10 },
    { name: 'audioRecordings', maxCount: 5 },
  ]),
  async (req, res) => {
    let newlyCreatedUserId = null;
    let inviteReservation = null;
    const rollbackInvite = async () => {
      if (inviteReservation) {
        const toRollback = inviteReservation;
        inviteReservation = null;
        await rollbackTeacherInviteReservation(toRollback);
      }
    };
    try {
      const {
        personalInfo, academicInfo, quranInfo, languages, availability,
        email, password, verificationToken, phoneVerificationToken, inviteToken
      } = req.body;
      const rawInviteToken = String(inviteToken || req.headers?.['x-teacher-invite'] || '').trim();
      const parsedPersonalForVerification = parseSafeMultipartJson(personalInfo, {});
      const rawEmailInput = String(email || '').trim().toLowerCase();
      const rawPhoneInput = String(req.body?.phone || parsedPersonalForVerification?.phone || '').trim();
      const normalizedPhone = normalizePhone(rawPhoneInput);
      const derivedPhoneEmail = !rawEmailInput && normalizedPhone ? syntheticPhoneEmail(normalizedPhone) : '';
      const normalizedEmail = rawEmailInput || derivedPhoneEmail;
      const uploadedFiles = parseSafeMultipartJson(req.body.uploadedFiles, {});
      const documentAvailability = parseSafeMultipartJson(req.body.documentAvailability, {});
      const declaredDocuments = {
        graduationCertificate: documentAvailability.graduationCertificate === true,
        tajweedCertificates: documentAvailability.tajweedCertificates === true,
        ijazat: documentAvailability.ijazat === true,
      };

      const uploadedFileCount = Object.values(req.files || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
      if (externalStorage && uploadedFileCount > 0) {
        return res.status(503).json({ error: 'External file storage is not configured yet', code: 'FILE_STORAGE_NOT_READY' });
      }
      if (uploadedFileCount > 0) {
        const magicStatus = verifyMultipartFilesMagicBytes(req.files);
        if (!magicStatus.ok) {
          return res.status(400).json({ error: magicStatus.error, code: 'INVALID_FILE_MAGIC_BYTES' });
        }
      }

      // When an explicit inviteToken is provided for a new teacher registration, do not
      // hijack the submission with an unrelated logged-in session header/cookie.
      const useAuthenticatedSession = Boolean(req.user?.id && !rawInviteToken);
      let userId = useAuthenticatedSession ? req.user.id : null;
      let uploadOwner = useAuthenticatedSession ? req.user.id : null;
      let verifiedEmailViaOtp = false;

      if (!userId) {
        const clientIp = extractClientIp(req);
        const inviteCheck = await validateTeacherInvite(rawInviteToken, { clientIp, bindIfUnbound: false });
        if (!inviteCheck.valid) {
          return res.status(403).json({
            error: inviteCheck.error,
            code: inviteCheck.code,
          });
        }

        if (!normalizedEmail || !password) {
          return res.status(400).json({ error: 'Email or phone number and password are required' });
        }
        if (normalizedEmail.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/.test(normalizedEmail)) {
          return res.status(400).json({ error: 'Valid email address or phone number is required' });
        }
        if (String(password).length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const teacherVerificationToken = verificationToken;
        if (teacherVerificationToken) {
          let verifiedJti = null;
          let verifiedExp = null;
          try {
            const verification = jwt.verify(
              teacherVerificationToken,
              getAccessSecret(),
              { algorithms: ['HS256'] }
            );

            if (verification.purpose === 'teacher-email-verification') {
              if (!normalizedEmail || verification.email !== normalizedEmail) {
                return res.status(400).json({ error: 'Email verification does not match this application' });
              }
              uploadOwner = verification.email;
              verifiedJti = verification.jti || null;
              verifiedExp = verification.exp || null;
              verifiedEmailViaOtp = true;
            } else {
              return res.status(400).json({ error: 'Verification does not match this application' });
            }
          } catch {
            return res.status(400).json({ error: 'Email verification is invalid or expired' });
          }

          if (verifiedJti) {
            const consumedOk = await consumeVerificationTokenJti(verifiedJti, verifiedExp);
            if (!consumedOk) {
              return res.status(409).json({
                error: 'Verification token has already been used. Please request a fresh verification code.',
                code: 'VERIFICATION_TOKEN_ALREADY_USED',
              });
            }
          }
        } else {
          // Valid admin-issued temporary invite authorizes registration without email OTP.
          uploadOwner = normalizedEmail;
        }
      }

      const validUploadedFiles =
        validateDirectUpload(uploadedFiles.profilePhoto, 'teacher-public', uploadOwner) &&
        validateDirectUpload(uploadedFiles.introductionVideo, 'teacher-public', uploadOwner) &&
        validateDirectUpload(uploadedFiles.teachingMethodVideo, 'teacher-public', uploadOwner) &&
        validateDirectUpload(uploadedFiles.idCard, 'teacher-private', uploadOwner) &&
        validateDirectUpload(uploadedFiles.idCardFront, 'teacher-private', uploadOwner) &&
        validateDirectUpload(uploadedFiles.idCardBack, 'teacher-private', uploadOwner) &&
        validateDirectUpload(uploadedFiles.graduationCertificate, 'teacher-private', uploadOwner) &&
        validateDirectUploadList(uploadedFiles.recitationVideo, 'teacher-public', uploadOwner) &&
        validateDirectUploadList(uploadedFiles.additionalVideos, 'teacher-public', uploadOwner) &&
        validateDirectUploadList(uploadedFiles.audioRecordings, 'teacher-public', uploadOwner) &&
        validateDirectUploadList(uploadedFiles.tajweedCertificates, 'teacher-private', uploadOwner) &&
        validateDirectUploadList(uploadedFiles.ijazat, 'teacher-private', uploadOwner);

      if (!validUploadedFiles) {
        return res.status(400).json({ error: 'One or more uploaded files do not belong to this application' });
      }

      const hasDirectOrLegacy = (directValue, legacyFiles) => Boolean(
        directReference(directValue) || legacyFiles?.[0]
      );
      const hasDirectOrLegacyList = (directValues, legacyFiles) => Boolean(
        (Array.isArray(directValues) && directValues.length) ||
        (Array.isArray(legacyFiles) && legacyFiles.length)
      );

      if (!hasDirectOrLegacy(uploadedFiles.profilePhoto, req.files?.profilePhoto)) {
        return res.status(400).json({
          error: 'Profile photo is required',
          code: 'TEACHER_PROFILE_PHOTO_REQUIRED',
        });
      }

      if (!hasDirectOrLegacyList(uploadedFiles.recitationVideo, req.files?.recitationVideo)) {
        return res.status(400).json({
          error: 'At least one recitation video is required',
          code: 'TEACHER_RECITATION_VIDEO_REQUIRED',
        });
      }

      const hasGraduationCert = hasDirectOrLegacy(uploadedFiles.graduationCertificate, req.files?.graduationCertificate);
      const hasTajweedCerts = hasDirectOrLegacyList(uploadedFiles.tajweedCertificates, req.files?.tajweedCertificates);
      const hasIjazatCerts = hasDirectOrLegacyList(uploadedFiles.ijazat, req.files?.ijazat);

      if (declaredDocuments.graduationCertificate && !hasGraduationCert) {
        return res.status(400).json({
          error: 'Graduation certificate was marked available but no file was uploaded',
          code: 'TEACHER_GRADUATION_CERTIFICATE_REQUIRED',
        });
      }

      if (declaredDocuments.tajweedCertificates && !hasTajweedCerts) {
        return res.status(400).json({
          error: 'Tajweed certificates were marked available but no file was uploaded',
          code: 'TEACHER_TAJWEED_CERTIFICATE_REQUIRED',
        });
      }

      if (declaredDocuments.ijazat && !hasIjazatCerts) {
        return res.status(400).json({
          error: 'Ijazat were marked available but no file was uploaded',
          code: 'TEACHER_IJAZA_REQUIRED',
        });
      }

      declaredDocuments.graduationCertificate = declaredDocuments.graduationCertificate || hasGraduationCert;
      declaredDocuments.tajweedCertificates = declaredDocuments.tajweedCertificates || hasTajweedCerts;
      declaredDocuments.ijazat = declaredDocuments.ijazat || hasIjazatCerts;

      if (!userId && (normalizedEmail || password)) {
        if (!normalizedEmail || !password) {
          return res.status(400).json({ error: 'Email or phone number and password are required' });
        }
        if (String(password).length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (isMockMode && !isDBConnected()) {
          const existingUser = findMockUserByEmail(normalizedEmail)
            || (normalizedPhone && !rawEmailInput ? findMockUserByPhone(normalizedPhone) : null);
          if (existingUser) {
            return res.status(409).json({ error: 'البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً' });
          }

          const consumed = await consumeTeacherInviteAtomic(rawInviteToken, {
            email: rawEmailInput || normalizedPhone || normalizedEmail,
            name: parsedPersonalForVerification.fullName || '',
            clientIp: extractClientIp(req),
          });
          if (!consumed.ok) {
            return res.status(403).json({ error: consumed.error, code: consumed.code });
          }
          inviteReservation = consumed;

          const parsedPersonal = parseSafeMultipartJson(personalInfo, {});
          const user = addMockUser({
            name: parsedPersonal.fullName || 'معلم أزهري',
            email: normalizedEmail,
            password,
            phone: normalizedPhone || parsedPersonal.phone,
            role: 'teacher',
            emailVerified: verifiedEmailViaOtp,
            isActive: true,
          });

          userId = user._id || user.id;
        } else {
          const dupQuery = [{ email: normalizedEmail }];
          if (normalizedPhone) {
            dupQuery.push({ role: 'teacher', phoneNormalized: normalizedPhone });
          }
          const existingUser = await User.findOne({ $or: dupQuery });
          if (existingUser) {
            return res.status(409).json({ error: 'البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً' });
          }

          const consumed = await consumeTeacherInviteAtomic(rawInviteToken, {
            email: rawEmailInput || normalizedPhone || normalizedEmail,
            name: parsedPersonalForVerification.fullName || '',
            clientIp: extractClientIp(req),
          });
          if (!consumed.ok) {
            return res.status(403).json({ error: consumed.error, code: consumed.code });
          }
          inviteReservation = consumed;

          const parsedPersonal = parseSafeMultipartJson(personalInfo, {});
          const user = await User.create({
            name: parsedPersonal.fullName,
            email: normalizedEmail,
            password,
            phone: normalizedPhone || parsedPersonal.phone,
            role: 'teacher',
            emailVerified: verifiedEmailViaOtp,
          });

          userId = user._id;
          newlyCreatedUserId = user._id;
        }
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const parsedPersonal = parseSafeMultipartJson(personalInfo, {});
      const parsedAcademic = parseSafeMultipartJson(academicInfo, {});
      const parsedQuran = parseSafeMultipartJson(quranInfo, {});

      if (isMockMode && !isDBConnected()) {
        const existingT = findMockTeacherByUserId(userId);
        if (existingT) {
          return res.status(400).json({ error: 'ملف المعلم مسجل مسبقاً' });
        }

        const mockT = addMockTeacher({
          user: userId,
          personalInfo: {
            ...parsedPersonal,
            age: Number(parsedPersonal.age) || 28,
            city: parsedPersonal.city || parsedPersonal.address?.split('،')?.[0] || 'القاهرة',
          },
          academicInfo: {
            university: parsedAcademic.university || 'جامعة الأزهر الشريف',
            faculty: parsedAcademic.faculty || 'كلية أصول الدين والدعوة',
            graduationYear: Number(parsedAcademic.graduationYear) || 2020,
            specialization: parsedAcademic.specialization || 'تحفيظ قرآن',
            qualification: parsedAcademic.qualification || 'ليسانس أصول دين',
          },
          quranInfo: {
            numberOfIjazat: parsedQuran.numberOfIjazat || 2,
            memorizedParts: parsedQuran.memorizedParts || 30,
            teachingExperience: parsedQuran.teachingExperience || 3,
            specializations: parsedQuran.specializations?.length ? parsedQuran.specializations : ['tajweed', 'hifz'],
            ...parsedQuran,
          },
          languages: parseSafeMultipartJson(languages, ['arabic']),
          availability: parseSafeMultipartJson(availability, []),
          status: 'pending',
          isVerified: false,
        });

        if (inviteReservation) {
          await finalizeTeacherInviteUsage({
            inviteId: inviteReservation.inviteId,
            reservationId: inviteReservation.reservationId,
            userId,
            teacherId: mockT._id,
          });
          inviteReservation = null;
        }

        return res.status(201).json({
          success: true,
          message: 'تم إرسال طلب تسجيل المعلم بنجاح وهو الآن في انتظار موافقة الإدارة.',
          applicationStatus: 'pending',
          applicationStatusToken: createTeacherApplicationStatusToken({
            userId,
            teacherId: mockT._id,
            email: normalizedEmail,
          }),
          teacher: mockT,
        });
      }

      const existingTeacher = await Teacher.findOne({ user: userId });
      const canResubmitExisting = Boolean(existingTeacher && req.user?.id && String(req.user.id) === String(userId) && ['pending', 'under-review', 'rejected'].includes(existingTeacher.status));
      if (existingTeacher && !canResubmitExisting) {
        await rollbackInvite();
        return res.status(400).json({ error: 'يوجد ملف معلم مسجل بالفعل لهذا الحساب. لتسجيل معلم جديد استخدم رابط دعوة جديد.' });
      }

      const directRef = directReference;
      const directPublic = (value) => {
        const ref = directRef(value);
        return ref ? objectStorage.publicProxyUrl(ref) : null;
      };

      const idCardFront =
        directRef(uploadedFiles.idCardFront) ||
        privateDocumentPath(req.files?.idCardFront?.[0]) ||
        'not-provided';
      const idCardBack =
        directRef(uploadedFiles.idCardBack) ||
        privateDocumentPath(req.files?.idCardBack?.[0]) ||
        'not-provided';

      const documents = {
        // Keep the legacy field pointed at the front side for older admin tools.
        idCard: idCardFront,
        idCardFront,
        idCardBack,
        graduationCertificateAvailable: declaredDocuments.graduationCertificate,
        graduationCertificate: declaredDocuments.graduationCertificate
          ? (directRef(uploadedFiles.graduationCertificate) || privateDocumentPath(req.files?.graduationCertificate?.[0]) || 'not-provided')
          : 'not-provided',
        tajweedCertificatesAvailable: declaredDocuments.tajweedCertificates,
        tajweedCertificates: declaredDocuments.tajweedCertificates
          ? (
            uploadedFiles.tajweedCertificates?.map(directRef).filter(Boolean)
            || req.files?.tajweedCertificates?.map(privateDocumentPath).filter(Boolean)
            || []
          )
          : [],
        ijazatAvailable: declaredDocuments.ijazat,
        ijazat: declaredDocuments.ijazat
          ? (
            uploadedFiles.ijazat?.map(directRef).filter(Boolean)
            || req.files?.ijazat?.map(privateDocumentPath).filter(Boolean)
            || []
          )
          : [],
      };

      const directRecitations = uploadedFiles.recitationVideo || [];
      const recitationFiles = req.files?.recitationVideo || [];
      const profilePhoto =
        directPublic(uploadedFiles.profilePhoto) ||
        publicMediaPath(req.files?.profilePhoto?.[0]);

      const mainVideo =
        directPublic(directRecitations[0]) ||
        publicMediaPath(recitationFiles[0]);

      const media = {
        profilePhoto: profilePhoto || '/default-teacher.png',
        introductionVideo: directPublic(uploadedFiles.introductionVideo) || publicMediaPath(req.files?.introductionVideo?.[0]) || '',
        recitationVideo: mainVideo,
        teachingMethodVideo: directPublic(uploadedFiles.teachingMethodVideo) || publicMediaPath(req.files?.teachingMethodVideo?.[0]) || '',
        additionalVideos: [
          ...directRecitations.slice(1).map(directPublic),
          ...(uploadedFiles.additionalVideos?.map(directPublic) || []),
          ...recitationFiles.slice(1).map(publicMediaPath),
          ...(req.files?.additionalVideos?.map(publicMediaPath) || []),
        ].filter(Boolean),
        audioRecordings: [
          ...(uploadedFiles.audioRecordings?.map(directPublic) || []),
          ...(req.files?.audioRecordings?.map(publicMediaPath) || []),
        ].filter(Boolean),
      };

      if (!coreMediaAreDistinct(media)) {
        await rollbackInvite();
        if (newlyCreatedUserId && isDBConnected()) {
          await User.findByIdAndDelete(newlyCreatedUserId).catch(() => {});
          newlyCreatedUserId = null;
        }
        return res.status(400).json({
          error: 'Introduction, recitation, and teaching-method videos must be different files',
          code: 'TEACHER_CORE_MEDIA_MUST_BE_DISTINCT',
        });
      }

    const teacherPayload = {
      user: userId,
      personalInfo: {
        ...parsedPersonal,
        age: Number(parsedPersonal.age),
        city: parsedPersonal.city || parsedPersonal.address?.split('،')?.[0] || '—',
      },
      academicInfo: {
        university: parsedAcademic.university || '—',
        faculty: parsedAcademic.faculty || '—',
        graduationYear: Number(parsedAcademic.graduationYear) || new Date().getFullYear(),
        specialization: parsedAcademic.specialization || 'تحفيظ قرآن',
        qualification: parsedAcademic.qualification || '—',
      },
      quranInfo: {
        numberOfIjazat: parsedQuran.numberOfIjazat || 0,
        memorizedParts: parsedQuran.memorizedParts || 30,
        teachingExperience: parsedQuran.teachingExperience || 0,
        specializations: parsedQuran.specializations?.length ? parsedQuran.specializations : ['tajweed'],
        ...parsedQuran,
      },
      languages: parseSafeMultipartJson(languages, ['arabic']),
      availability: parseSafeMultipartJson(availability, []),
      documents,
      media,
      storageOwner: externalStorage && uploadOwner ? String(uploadOwner) : undefined,
      hourlyRate: existingTeacher?.hourlyRate || 50,
    };
    let teacher;
    if (canResubmitExisting && existingTeacher) {
      Object.assign(existingTeacher, teacherPayload);
      existingTeacher.status = 'pending';
      existingTeacher.isVerified = false;
      if (Array.isArray(existingTeacher.reviewChecklist)) {
        existingTeacher.reviewChecklist.forEach((item) => {
          if (item.status === 'changes-requested') item.status = 'pending';
        });
      }
      teacher = await existingTeacher.save();
    } else {
      teacher = await Teacher.create(teacherPayload);
    }
    await User.findByIdAndUpdate(userId, { $set: { role: 'teacher', 'onboarding.teacherApplicationReady': true } });

    if (inviteReservation) {
      await finalizeTeacherInviteUsage({
        inviteId: inviteReservation.inviteId,
        reservationId: inviteReservation.reservationId,
        userId,
        teacherId: teacher._id,
      });
      inviteReservation = null;
    }

    notifyAdmins({
      type: 'system',
      title: { ar: 'طلب انضمام معلم جديد', en: 'New tutor application' },
      message: {
        ar: `وصل طلب معلم جديد من ${parsedPersonal.fullName || 'معلم جديد'} ويحتاج مراجعة المستندات والاعتماد.`,
        en: `A new tutor application from ${parsedPersonal.fullName || 'a new tutor'} requires document review and approval.`,
      },
      data: {
        actionUrl: '/admin?tab=teachers',
        metadata: { teacherId: String(teacher._id) },
      },
      priority: 'high',
    }).catch((error) => {
      console.warn('Admin teacher application notification failed:', error.message);
    });

    if (email) {
      sendEmail({
        to: String(email).trim().toLowerCase(),
        subject: 'تم استلام طلبك كمعلم — وَحْيٌ وَنَمَاء',
        text: 'تم استلام طلبك كمعلم وهو الآن في انتظار مراجعة الإدارة. لن يتم فتح لوحة المعلم قبل اعتماد الطلب.',
        html: '<div dir="rtl"><h2>تم استلام طلبك ✅</h2><p>طلبك كمعلم في أكاديمية وَحْيٌ وَنَمَاء أصبح الآن قيد مراجعة الإدارة.</p><p>لن يتم فتح لوحة المعلم قبل اعتماد الطلب، وسنرسل لك تحديثًا عند تغيير الحالة.</p></div>',
      }).catch((error) => {
        console.warn('Teacher application acknowledgement email failed:', error.message);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Teacher registration submitted successfully. Awaiting admin review.',
      applicationStatus: 'pending',
      applicationStatusToken: createTeacherApplicationStatusToken({
        userId,
        teacherId: teacher._id,
        email: String(email || '').trim().toLowerCase(),
      }),
      teacher
    });
  } catch (error) {
    await rollbackInvite();
    if (newlyCreatedUserId && isDBConnected()) {
      await User.findByIdAndDelete(newlyCreatedUserId).catch(() => {});
    }
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/application-status', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    if (!token) {
      return res.status(400).json({ error: 'Application status token is required' });
    }

    const payload = jwt.verify(
      token,
      getAccessSecret(),
      { algorithms: ['HS256'] }
    );

    if (
      payload.purpose !== 'teacher-application-status' ||
      !payload.userId ||
      !payload.teacherId
    ) {
      return res.status(400).json({ error: 'Invalid application status token' });
    }

    if (isDBConnected()) {
      const account = await User.findById(payload.userId).select('isActive role').lean();
      if (!account || account.isActive === false || account.role !== 'teacher') {
        return res.status(403).json({ error: 'Account is inactive or unavailable' });
      }
    }

    if (isMockMode && !isDBConnected()) {
      const mockUser = findMockUserById(payload.userId);
      if (!mockUser || mockUser.isActive === false || mockUser.role !== 'teacher') {
        return res.status(403).json({ error: 'Account is inactive or unavailable' });
      }
      const teacher = findMockTeacherByUserId(payload.userId);
      if (!teacher || String(teacher._id) !== String(payload.teacherId)) {
        return res.status(404).json({ error: 'Teacher application not found' });
      }
      if (teacher.status === 'suspended') {
        return res.status(403).json({ error: 'Account is inactive or unavailable' });
      }
      return res.json({
        applicationStatus: teacher.status || 'pending',
        approved: teacher.status === 'approved' && teacher.isVerified === true,
        updatedAt: teacher.updatedAt || null,
        ...extractReviewFeedback(teacher),
      });
    }

    const teacher = await Teacher.findOne({
      _id: payload.teacherId,
      user: payload.userId,
    }).select('status isVerified updatedAt reviewNotes reviewChecklist').lean();

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher application not found' });
    }

    if (teacher.status === 'suspended') {
      return res.status(403).json({ error: 'Account is inactive or unavailable' });
    }

    return res.json({
      applicationStatus: teacher.status || 'pending',
      approved: teacher.status === 'approved' && teacher.isVerified === true,
      updatedAt: teacher.updatedAt || null,
      ...extractReviewFeedback(teacher),
    });
  } catch (error) {
    const status = error?.name === 'TokenExpiredError' ? 401 : 400;
    return res.status(status).json({
      error: error?.name === 'TokenExpiredError'
        ? 'Application status token expired'
        : 'Invalid application status token',
    });
  }
});

function hydrateMockPublicTeacher(raw) {
  if (!raw) return null;
  const userObj = typeof raw.user === 'object' && raw.user
    ? raw.user
    : findMockUserById(raw.user);
  const hydrated = {
    ...raw,
    user: userObj
      ? { _id: userObj._id, name: userObj.name, avatar: userObj.avatar, bio: userObj.bio }
      : raw.user,
  };
  const teacher = sanitizePublicTeacher(hydrated);
  teacher.media = {
    profilePhoto: teacher.media?.profilePhoto || '',
    introductionVideo: teacher.media?.introductionVideo || '',
    recitationVideo: teacher.media?.recitationVideo || '',
  };
  return teacher;
}

function readNestedField(obj, dotPath) {
  return String(dotPath || '').split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

router.get('/', async (req, res) => {
  try {
    const {
      country,
      market,
      gender,
      specialization,
      language,
      currency,
      minRating,
      minExperience,
      search,
      sortBy = 'rating.average',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    const filter = { status: 'approved', isVerified: true, isPublic: { $ne: false } };
    let allowedCountries = null;
    let specialties = null;

    if (market) {
      const { getMarketBySlug } = require('../config/markets');
      const m = getMarketBySlug(market);
      if (m?.countries?.length) {
        allowedCountries = m.countries;
        filter['personalInfo.country'] = { $in: m.countries };
      }
    } else if (country) {
      filter['personalInfo.country'] = country;
    }
    if (gender) filter['personalInfo.gender'] = gender;
    if (specialization) {
      specialties = String(specialization).split(',').map(value => value.trim()).filter(value => /^[a-z_]{2,30}$/.test(value)).slice(0, 10);
      if (!specialties.length) return res.status(400).json({ error: 'Invalid specialization' });
      filter['quranInfo.specializations'] = { $in: specialties };
    }
    if (language) filter.languages = language;
    if (minRating) filter['rating.average'] = { $gte: parseFloat(minRating) };
    if (minExperience) filter['quranInfo.teachingExperience'] = { $gte: parseInt(minExperience) };

    const boundedSearch = search && String(search).trim()
      ? String(search).trim().slice(0, 100)
      : '';
    if (boundedSearch) {
      const escaped = boundedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { 'personalInfo.fullName': regex },
        { 'academicInfo.specialization': regex },
        { 'quranInfo.specializations': regex },
        { languages: regex },
      ];
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;
    const SORT_MAP = {
      rating: 'rating.average',
      'rating.average': 'rating.average',
      experience: 'quranInfo.teachingExperience',
      price: 'hourlyRate',
      students: 'stats.totalStudents',
      newest: 'createdAt',
    };
    const sortField = Object.prototype.hasOwnProperty.call(SORT_MAP, sortBy)
      ? SORT_MAP[sortBy]
      : 'rating.average';
    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    if (
      isMockMode
      && !isDBConnected()
      && Teacher.find === mongoose.Model.find
      && Teacher.countDocuments === mongoose.Model.countDocuments
    ) {
      const searchRegex = boundedSearch
        ? new RegExp(boundedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : null;
      const filtered = getMockTeachers().filter((item) => {
        if (item.status !== 'approved' || item.isVerified !== true || item.isPublic === false) return false;
        if (allowedCountries && !allowedCountries.includes(item.personalInfo?.country)) return false;
        if (!allowedCountries && country && item.personalInfo?.country !== country) return false;
        if (gender && item.personalInfo?.gender !== gender) return false;
        if (specialties && !specialties.some((spec) => (item.quranInfo?.specializations || []).includes(spec))) return false;
        if (language && !(item.languages || []).includes(language)) return false;
        if (minRating && Number(item.rating?.average || 0) < parseFloat(minRating)) return false;
        if (minExperience && Number(item.quranInfo?.teachingExperience || 0) < parseInt(minExperience, 10)) return false;
        if (searchRegex) {
          const haystacks = [
            item.personalInfo?.fullName,
            item.academicInfo?.specialization,
            ...(item.quranInfo?.specializations || []),
            ...(item.languages || []),
          ];
          if (!haystacks.some((val) => searchRegex.test(String(val || '')))) return false;
        }
        return true;
      });
      const dir = sortOrder === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const av = readNestedField(a, sortField);
        const bv = readNestedField(b, sortField);
        if (sortField === 'createdAt') return (new Date(av || 0).getTime() - new Date(bv || 0).getTime()) * dir;
        return (Number(av || 0) - Number(bv || 0)) * dir;
      });
      const paged = filtered.slice(skip, skip + limitNum).map(hydrateMockPublicTeacher);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json({
        teachers: paged,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filtered.length,
          pages: Math.ceil(filtered.length / limitNum),
        },
      });
    }

    const [teachers, total] = await Promise.all([
      Teacher.find(filter)
        .select(PUBLIC_TEACHER_LIST_SELECT)
        .populate('user', 'name avatar bio')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Teacher.countDocuments(filter)
    ]);

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      teachers: teachers.map(item => {
        const teacher = sanitizePublicTeacher(item);
        teacher.media = {
          profilePhoto: teacher.media?.profilePhoto || '',
          introductionVideo: teacher.media?.introductionVideo || '',
          recitationVideo: teacher.media?.recitationVideo || '',
        };
        return teacher;
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/featured', async (req, res) => {
  try {
    if (isMockMode && !isDBConnected() && Teacher.find === mongoose.Model.find) {
      const featured = getMockTeachers()
        .filter((item) => item.status === 'approved' && item.isVerified === true && item.isPublic !== false && Boolean(item.isFeatured))
        .sort((a, b) => Number(b.rating?.average || 0) - Number(a.rating?.average || 0))
        .slice(0, 6)
        .map(hydrateMockPublicTeacher);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json(featured);
    }

    const teachers = await Teacher.find({ 
      status: 'approved', 
      isVerified: true, 
      isPublic: { $ne: false },
      isFeatured: true 
    })
      .select(PUBLIC_TEACHER_LIST_SELECT)
      .populate('user', 'name avatar bio')
      .sort({ 'rating.average': -1 })
      .limit(6)
      .lean();

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(teachers.map(sanitizePublicTeacher));
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/admin/profile-changes/pending', protect, authorize('admin'), async (_req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json({ requests: [] });
  }
  try {
    const requests = await TeacherProfileChangeRequest.find({ status: 'pending' })
      .populate({
        path: 'teacher',
        select: 'personalInfo status user',
        populate: { path: 'user', select: 'name email' },
      })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return res.json({
      requests: requests.map((request) => ({
        _id: request._id,
        teacher: request.teacher,
        changedFields: request.changedFields || [],
        createdAt: request.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/admin/:id/profile-change/media-playback/:kind', protect, authorize('admin'), async (req, res) => {
  try {
    const allowed = new Set(['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo']);
    if (!allowed.has(req.params.kind)) return res.status(400).json({ error: 'Invalid media type' });
    const request = await TeacherProfileChangeRequest.findOne({
      teacher: req.params.id,
      status: 'pending',
    }).sort({ createdAt: -1 }).lean();
    const reference = request?.proposed?.media?.[req.params.kind];
    if (!reference) return res.status(404).json({ error: 'Proposed media not found' });

    // Verify the object exists and supports small byte-range reads BEFORE
    // returning a playback link. Never use a cross-origin signed Blob URL
    // for video: it can work server-side but be blocked by browser CORP.
    const verifiedPlayback = await createVerifiedTeacherPlayback(reference, {
      teacherId: req.params.id,
      kind: req.params.kind,
      index: 0,
      scope: 'proposed',
      issuedBy: req.user?.id,
      issuedVersion: req.user?.v,
    });

    await logAdminAction({
      req,
      action: 'teacher.profile-change.media-playback-authorized',
      entityType: 'teacher',
      entityId: req.params.id,
      reason: 'profile-change-review',
      metadata: { requestId: String(request._id), kind: req.params.kind },
    }).catch(() => {});

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.json(verifiedPlayback);
  } catch (error) {
    console.error('Teacher profile-change media playback failed:', error.message);
    return res.status(error.status || 502).json({
      code: error.code || 'MEDIA_PREVIEW_URL_FAILED',
      error: error.code ? error.message : 'تعذر إعداد معاينة التعديل مؤقتًا. حاول مرة أخرى.',
    });
  }
});

router.get('/admin/:id/profile-change/media/:kind', protect, authorize('admin'), async (req, res) => {
  try {
    const allowedKinds = new Set(['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo']);
    if (!allowedKinds.has(req.params.kind)) {
      return res.status(400).json({ error: 'Invalid profile change media kind' });
    }

    const request = await TeacherProfileChangeRequest.findOne({
      teacher: req.params.id,
      status: 'pending',
    }).sort({ createdAt: -1 }).lean();

    const reference = request?.proposed?.media?.[req.params.kind];
    if (!reference) return res.status(404).json({ error: 'Proposed media not found' });

    await logAdminAction({
      req,
      action: 'teacher.profile-change.media-opened',
      entityType: 'teacher',
      entityId: req.params.id,
      reason: String(req.query.reason || 'profile-change-review').slice(0, 240),
      metadata: { requestId: String(request._id), kind: req.params.kind },
    }).catch(() => {});

    return streamAdminTeacherAsset(reference, res, {
      fallbackContentType: req.params.kind === 'profilePhoto' ? 'image/jpeg' : 'video/mp4',
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/admin/:id/profile-change/review', protect, authorize('admin'), async (req, res) => {
  try {
    const action = String(req.body?.action || '');
    const note = String(req.body?.note || '').trim().slice(0, 1500);
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid profile change review action' });
    }
    if (action === 'reject' && !note) {
      return res.status(400).json({ error: 'اكتب سبب رفض التعديل', code: 'PROFILE_CHANGE_REJECT_NOTE_REQUIRED' });
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const request = await TeacherProfileChangeRequest.findOne({
      teacher: teacher._id,
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (!request) {
      return res.status(404).json({ error: 'No pending profile change request', code: 'NO_PENDING_PROFILE_CHANGE' });
    }

    const userDoc = await User.findById(teacher.user);
    if (!userDoc) return res.status(404).json({ error: 'Teacher account not found' });

    const previousMediaSnapshot = { ...(teacher.media?.toObject?.() || teacher.media || {}) };
    const proposedMedia = request.proposed?.media || {};
    const ownerForCleanup = String(teacher.user?._id || teacher.user || request.user || '');

    if (action === 'approve') {
      const mergedMedia = mergeTeacherMedia(previousMediaSnapshot, proposedMedia);
      if (!coreMediaAreDistinct(mergedMedia)) {
        return res.status(409).json({
          error: 'لا يمكن نشر التعديل لأن فيديوهات التعريف والتلاوة وطريقة التدريس يجب أن تكون ملفات مختلفة',
          code: 'TEACHER_CORE_MEDIA_MUST_BE_DISTINCT',
        });
      }

      applyTeacherProfileChange(teacher, userDoc, request.proposed || {});
      await Promise.all([teacher.validate(), userDoc.validate()]);
      await Promise.all([teacher.save(), userDoc.save()]);
      request.status = 'approved';

      for (const mediaKey of ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo']) {
        const oldRef = previousMediaSnapshot[mediaKey];
        const newRef = teacher.media?.[mediaKey];
        if (oldRef && oldRef !== newRef && oldRef !== '/default-teacher.png' && ownerForCleanup) {
          await deleteStoredReference(oldRef, { purpose: 'teacher-public', owner: ownerForCleanup }).catch(() => {});
        }
      }
    } else {
      request.status = 'rejected';
      for (const mediaKey of ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo']) {
        const rejectedRef = proposedMedia[mediaKey];
        if (rejectedRef && rejectedRef !== previousMediaSnapshot[mediaKey] && rejectedRef !== '/default-teacher.png' && ownerForCleanup) {
          await deleteStoredReference(rejectedRef, { purpose: 'teacher-public', owner: ownerForCleanup }).catch(() => {});
        }
      }
    }

    request.adminNote = note;
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    await logAdminAction({
      req,
      action: `teacher.profile-change.${action}`,
      entityType: 'teacher',
      entityId: teacher._id,
      reason: note || 'Teacher public profile change reviewed.',
      metadata: {
        requestId: String(request._id),
        changedFields: request.changedFields || [],
      },
    }).catch(() => {});

    await notifyUser(request.user, {
      type: 'system',
      title: action === 'approve'
        ? { ar: 'تم اعتماد تعديل ملفك', en: 'Your profile changes were approved' }
        : { ar: 'تعديل ملفك يحتاج مراجعة', en: 'Your profile changes need revision' },
      message: action === 'approve'
        ? { ar: 'تمت مراجعة التعديلات ونشرها في ملفك العام.', en: 'Your changes were reviewed and published to your public profile.' }
        : { ar: `لم يتم نشر التعديلات. ملاحظة الإدارة: ${note}`, en: `The changes were not published. Admin note: ${note}` },
      data: { actionUrl: '/teacher/dashboard?tab=account', metadata: { profileChangeRequestId: String(request._id) } },
      priority: 'high',
    }).catch((error) => console.warn('Teacher profile change result notification failed:', error.message));

    return res.json({
      success: true,
      request,
      teacher: action === 'approve' ? sanitizePublicTeacher(teacher) : undefined,
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/admin/:id/review-dossier', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const mockTeacher = findMockTeacherById(req.params.id);
    if (!mockTeacher) return res.status(404).json({ error: 'Teacher not found' });
    const mockUser = findMockUserById(mockTeacher.user?._id || mockTeacher.user) || {
      _id: mockTeacher.user || 'mock-teacher-user',
      name: mockTeacher.personalInfo?.fullName || 'معلم الأكاديمية',
      email: 'teacher@wahy.com',
      phone: mockTeacher.personalInfo?.phone || '+201000000000',
      isActive: true,
    };
    const hydrated = {
      ...mockTeacher,
      user: mockUser,
      documents: mockTeacher.documents || {},
      media: mockTeacher.media || {},
      reviewChecklist: mockTeacher.reviewChecklist || [],
      reviewNotes: mockTeacher.reviewNotes || [],
    };
    const gate = buildTeacherReviewGate(hydrated);
    return res.json(teacherDossierPayload(
      hydrated,
      gate,
      [],
      { totalSessions: 0, completedSessions: 0, acceptedSessions: 0, distinctStudents: 0 },
      null,
    ));
  }
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('user', 'name email phone whatsappPhone avatar bio isActive createdAt lastLogin')
      .populate('reviewChecklist.reviewedBy', 'name email')
      .populate('reviewNotes.admin', 'name email');

    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const [auditEntries, activityAgg, distinctStudents, profileChange] = await Promise.all([
      AdminAuditLog.find({ entityType: 'teacher', entityId: String(teacher._id) })
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Session.aggregate([
        { $match: { teacher: teacher._id } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            completedSessions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            acceptedSessions: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          },
        },
      ]),
      Session.find({ teacher: teacher._id, student: { $ne: null } }).distinct('student'),
      TeacherProfileChangeRequest.findOne({ teacher: teacher._id })
        .sort({ createdAt: -1 })
        .populate('reviewedBy', 'name email')
        .lean(),
    ]);

    const gate = buildTeacherReviewGate(teacher);
    return res.json(teacherDossierPayload(
      teacher,
      gate,
      auditEntries,
      {
        totalSessions: activityAgg[0]?.totalSessions || 0,
        completedSessions: activityAgg[0]?.completedSessions || 0,
        acceptedSessions: activityAgg[0]?.acceptedSessions || 0,
        distinctStudents: distinctStudents.length,
      },
      profileChange,
    ));
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/admin/:id/review-checklist/:key', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const itemDefinition = REVIEW_ITEMS.find((item) => item.key === req.params.key);
    if (!itemDefinition) {
      return res.status(400).json({ error: 'Invalid review checklist item', code: 'INVALID_REVIEW_ITEM' });
    }

    const requiredForTeacher = itemRequiredForTeacher(teacher, itemDefinition);
    const status = sanitizeChecklistStatus(req.body.status, requiredForTeacher);
    if (!status) {
      return res.status(400).json({ error: 'Invalid checklist status', code: 'INVALID_REVIEW_STATUS' });
    }

    const note = String(req.body.note || '').trim().slice(0, 1000);
    if (status === 'changes-requested' && !note) {
      return res.status(400).json({
        error: 'A note is required when requesting changes',
        code: 'REVIEW_NOTE_REQUIRED',
      });
    }

    const existing = teacher.reviewChecklist.find((item) => item.key === itemDefinition.key);
    if (existing) {
      existing.status = status;
      existing.note = note;
      existing.reviewedBy = req.user.id;
      existing.reviewedAt = new Date();
    } else {
      teacher.reviewChecklist.push({
        key: itemDefinition.key,
        status,
        note,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      });
    }

    if (!teacher.reviewStartedAt) teacher.reviewStartedAt = new Date();
    if (status === 'changes-requested') {
      teacher.status = 'under-review';
      teacher.isVerified = false;
    }
    await teacher.save();

    const gate = buildTeacherReviewGate(teacher);
    await logAdminAction({
      req,
      action: 'teacher.review-checklist.updated',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: note,
      metadata: {
        checklistKey: itemDefinition.key,
        checklistStatus: status,
        readiness: gate.readiness,
      },
    });

    return res.json({ success: true, gate, reviewChecklist: teacher.reviewChecklist });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// Scoped, short-lived browser playback avoids proxying multi-MB videos through
// the API function. The client never receives storage credentials or raw blob refs.
const TEACHER_MEDIA_KINDS = new Set([
  'profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo',
  'additionalVideos', 'audioRecordings',
]);
const TEACHER_MEDIA_TICKET_PURPOSE = 'teacher-admin-media-range';

function createAdminMediaRangeUrl(teacherId, kind, index, reference, scope = 'original', issuedBy = undefined, issuedVersion = undefined) {
  const indexNumber = Number(index ?? 0);
  const referenceDigest = crypto.createHash('sha256').update(String(reference)).digest('hex');
  const ticket = jwt.sign({
    purpose: TEACHER_MEDIA_TICKET_PURPOSE,
    teacherId: String(teacherId),
    kind,
    index: indexNumber,
    scope,
    referenceDigest,
    ...(issuedBy ? { issuedBy: String(issuedBy) } : {}),
    ...(issuedVersion !== undefined ? { issuedVersion: Number(issuedVersion || 0) } : {}),
  }, getAccessSecret(), { expiresIn: '30m', algorithm: 'HS256' });
  // The frontend rewrites /api to the backend. Keep video requests on the
  // academy's own origin: Helmet's same-origin CORP otherwise blocks media
  // loaded from the separate API domain in the browser.
  const pathname = `/api/teachers/admin-media-range/${encodeURIComponent(teacherId)}/${encodeURIComponent(kind)}/${indexNumber}`;
  return `${pathname}?ticket=${encodeURIComponent(ticket)}`;
}

class TeacherPlaybackError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function createVerifiedTeacherPlayback(reference, { teacherId, kind, index = 0, scope = 'original', issuedBy = undefined, issuedVersion = undefined }) {
  const metadata = await objectStorage.inspectPrivateMedia(reference);
  const size = Number(metadata?.sizeBytes);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new TeacherPlaybackError(
      'MEDIA_FILE_MISSING', 'الملف غير موجود في التخزين أو حجمه صفر. اطلب إعادة رفع الفيديو.', 404
    );
  }

  if (kind !== 'profilePhoto') {
    // Probe only 32 bytes using the SAME private Range method as the player.
    // This catches absent objects, provider errors, and non-range responses.
    const end = Math.min(size - 1, 31);
    const result = await objectStorage.getPrivateObject(reference, {
      headers: { Range: `bytes=0-${end}` },
    });
    const actualRange = result?.headers?.get?.('content-range') || result?.blob?.contentRange || '';
    try {
      if (!result?.stream || actualRange !== `bytes 0-${end}/${size}`) {
        throw new TeacherPlaybackError(
          'MEDIA_RANGE_UNAVAILABLE',
          'تعذر قراءة أجزاء الفيديو من التخزين. يرجى فحص اتصال Vercel Blob وإعدادات Range.'
        );
      }
    } finally {
      if (typeof result?.stream?.cancel === 'function') await result.stream.cancel().catch(() => {});
      else result?.stream?.destroy?.();
    }
    return {
      url: createAdminMediaRangeUrl(teacherId, kind, index, reference, scope, issuedBy, issuedVersion),
      streamingMode: 'authenticated-range',
      contentType: metadata.contentType,
      sizeBytes: size,
      streamingChecked: true,
    };
  }

  // Photos remain small and are fetched with the authenticated admin API.
  // Keep signed-photo compatibility without exposing unrestricted storage.
  const playback = await objectStorage.createTemporaryReadUrl(reference);
  if (!playback) throw new TeacherPlaybackError('MEDIA_PREVIEW_NOT_SUPPORTED', 'Direct media playback is not supported by the current storage driver', 409);
  const check = await objectStorage.probeTemporaryMediaUrl(playback.url);
  if (!check.ok) throw new TeacherPlaybackError('MEDIA_SIGNED_URL_REJECTED', 'مخزن الوسائط رفض رابط المعاينة. راجع إعدادات الوصول.');
  return {
    ...playback,
    streamingMode: 'direct',
    contentType: metadata.contentType,
    sizeBytes: size,
    streamingChecked: true,
  };
}

// The media element cannot send Authorization headers. Grant a short-lived,
// asset-specific bearer ticket only after the admin endpoint authenticates.
// Each streamed byte-range is limited to 2 MiB to fit serverless response limits.
router.get('/admin-media-range/:id/:kind/:index', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');

  try {
    const ticket = String(req.query.ticket || '');
    if (!ticket || ticket.length > 4096) return res.status(401).end();
    const payload = jwt.verify(ticket, getAccessSecret(), {
      algorithms: ['HS256'],
    });
    if (payload.issuedBy) {
      const principalOk = await verifyLiveSessionPrincipal(payload.issuedBy, 'admin', payload.iat);
      if (!principalOk) return res.status(401).end();
      if (payload.issuedVersion !== undefined && (Boolean(mongoose.connection?.db) || User.findById !== mongoose.Model.findById)) {
        const issuerDoc = await User.findById(payload.issuedBy).select('+refreshTokenVersion').lean();
        if (!issuerDoc || Number(issuerDoc.refreshTokenVersion || 0) !== Number(payload.issuedVersion || 0)) {
          return res.status(401).end();
        }
      }
    }
    const index = Number(req.params.index);
    if (
      payload.purpose !== TEACHER_MEDIA_TICKET_PURPOSE ||
      payload.teacherId !== req.params.id ||
      payload.kind !== req.params.kind ||
      payload.index !== index ||
      !TEACHER_MEDIA_KINDS.has(req.params.kind) ||
      !Number.isSafeInteger(index) || index < 0 ||
      !['original', 'proposed'].includes(payload.scope)
    ) return res.status(403).end();

    const readOriginalReference = async () => {
      const teacher = await Teacher.findById(req.params.id).select('media');
      const media = teacher?.media?.[req.params.kind];
      return Array.isArray(media) ? media[index] : index === 0 ? media : null;
    };
    const readProposedReference = async () => {
      const request = await TeacherProfileChangeRequest.findOne({
        teacher: req.params.id,
        status: 'pending',
      }).sort({ createdAt: -1 }).lean();
      return request?.proposed?.media?.[req.params.kind] || null;
    };
    const matchesTicket = (candidate) => candidate && (
      crypto.createHash('sha256').update(String(candidate)).digest('hex') === payload.referenceDigest
    );

    let reference = payload.scope === 'proposed'
      ? await readProposedReference()
      : await readOriginalReference();

    // Compatibility for tickets minted by the previous buggy deploy where the
    // original/proposed scope value was swapped. The immutable reference hash
    // is authoritative, so this never grants access to a different object.
    if (!matchesTicket(reference)) {
      const legacyCandidate = payload.scope === 'proposed'
        ? await readOriginalReference()
        : await readProposedReference();
      reference = matchesTicket(legacyCandidate) ? legacyCandidate : null;
    }
    if (!reference) return res.status(404).end();

    const meta = await objectStorage.inspectPrivateMedia(reference);
    if (!meta || !Number.isSafeInteger(Number(meta.sizeBytes)) || Number(meta.sizeBytes) <= 0) return res.status(404).end();

    let selection;
    try {
      selection = boundedMediaRange(req.headers.range, Number(meta.sizeBytes));
    } catch {
      res.setHeader('Content-Range', `bytes */${meta.sizeBytes}`);
      return res.status(416).end();
    }
    const { start, end, size } = selection;
    const result = await objectStorage.getPrivateObject(reference, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!result?.stream) return res.status(404).end();
    const actualRange = result.headers?.get?.('content-range')
      || result.blob?.contentRange || '';
    // Refuse to serve unbounded/full blobs; the SDK hides HTTP 206 in its
    // statusCode, but passes the upstream content-range header unchanged.
    if (actualRange !== `bytes ${start}-${end}/${size}`) {
      if (typeof result.stream.cancel === 'function') await result.stream.cancel().catch(() => {});
      else result.stream.destroy?.();
      console.warn('Private teacher video range mismatch', {
        media: req.params.kind, expectedBytes: end - start + 1,
        rangeProvided: Boolean(actualRange),
      });
      return res.status(502).end();
    }

    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    res.status(206);

    if (typeof result.stream.pipe === 'function') return result.stream.pipe(res);
    const reader = result.stream.getReader?.();
    if (!reader) return res.end();
    try {
      let remaining = end - start + 1;
      while (remaining > 0) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = Buffer.from(value);
        res.write(part.subarray(0, remaining));
        remaining -= part.length;
      }
      return res.end();
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch (error) {
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') return res.status(401).end();
    console.error('Teacher admin media range playback failed:', error?.message);
    if (!res.headersSent) return res.status(502).end();
    return res.destroy();
  }
});

router.get('/admin/:id/media-playback/:kind{/:index}', protect, authorize('admin'), async (req, res) => {
  try {
    const allowed = ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo', 'additionalVideos', 'audioRecordings'];
    if (!allowed.includes(req.params.kind)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    const teacher = await Teacher.findById(req.params.id).select('media');
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    let reference = teacher.media?.[req.params.kind];
    if (Array.isArray(reference)) {
      const index = req.params.index === undefined ? 0 : Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || index >= reference.length) {
        return res.status(404).json({ error: 'Media not found' });
      }
      reference = reference[index];
    }
    if (!reference) return res.status(404).json({ error: 'Media not found' });

    // Verify the object exists and supports small byte-range reads BEFORE
    // returning a playback link. Never use a cross-origin signed Blob URL
    // for video: it can work server-side but be blocked by browser CORP.
    const verifiedPlayback = await createVerifiedTeacherPlayback(reference, {
      teacherId: teacher._id,
      kind: req.params.kind,
      index: req.params.index,
      scope: 'original',
      issuedBy: req.user?.id,
      issuedVersion: req.user?.v,
    });

    await logAdminAction({
      req,
      action: 'teacher.sensitive-media.playback-authorized',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: 'teacher-review',
      metadata: { kind: req.params.kind, index: req.params.index || null },
    }).catch(() => {});

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.json(verifiedPlayback);
  } catch (error) {
    console.error('Teacher private media playback failed:', error.message);
    return res.status(error.status || 502).json({
      code: error.code || 'MEDIA_PREVIEW_URL_FAILED',
      error: error.code ? error.message : 'تعذر إعداد تشغيل الفيديو مؤقتًا. حاول مرة أخرى.',
    });
  }
});

router.get('/admin/:id/media/:kind{/:index}', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('media');
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const allowed = ['profilePhoto', 'introductionVideo', 'recitationVideo', 'teachingMethodVideo', 'additionalVideos', 'audioRecordings'];
    const { kind } = req.params;
    if (!allowed.includes(kind)) return res.status(400).json({ error: 'Invalid media type' });

    let stored = teacher.media?.[kind];
    if (Array.isArray(stored)) {
      const index = Number(req.params.index || 0);
      if (!Number.isInteger(index) || index < 0 || index >= stored.length) {
        return res.status(404).json({ error: 'Media not found' });
      }
      stored = stored[index];
    }

    if (!stored) return res.status(404).json({ error: 'Media not found' });

    await logAdminAction({
      req,
      action: 'teacher.sensitive-media.viewed',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: String(req.query.reason || '').trim(),
      metadata: { kind, index: req.params.index || null },
    }).catch(() => {});

    return streamAdminTeacherAsset(stored, res, {
      fallbackContentType: kind === 'profilePhoto' ? 'image/jpeg' : kind === 'audioRecordings' ? 'audio/mpeg' : 'video/mp4',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load teacher media' });
  }
});

router.get('/invite-status', inviteStatusLimiter, async (req, res) => {
  try {
    const rawToken = String(req.query?.token || req.query?.invite || '').trim();
    const clientIp = extractClientIp(req);
    const result = await validateTeacherInvite(rawToken, { clientIp, bindIfUnbound: true });
    if (!result.valid) {
      return res.status(403).json({
        valid: false,
        code: result.code,
        error: result.error,
      });
    }
    return res.json({
      valid: true,
      code: result.code,
      invite: result.invite,
    });
  } catch (error) {
    return res.status(500).json({ valid: false, error: safeErrorMessage(error, 500) });
  }
});

router.get('/admin/invites', protect, authorize('admin'), async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 100);
    const invites = await listTeacherInvites({ limit });
    const activeCount = invites.filter((item) => item.status === 'active').length;
    return res.json({ invites, activeCount, totalCount: invites.length });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/admin/invites', protect, authorize('admin'), async (req, res) => {
  try {
    const label = String(req.body?.label || '').trim().slice(0, 120);
    const expiresInHours = Number(req.body?.expiresInHours ?? 24);
    const maxUses = Number(req.body?.maxUses ?? 1);
    const lockToFirstIp = typeof req.body?.lockToFirstIp === 'boolean' ? req.body.lockToFirstIp : undefined;
    const locale = String(req.body?.locale || 'ar').trim().toLowerCase();

    const rawOrigin = String(req.headers?.origin || '').trim();
    const safeOrigin = /^https?:\/\/[^/\s]+$/i.test(rawOrigin) ? rawOrigin : '';

    const created = await createTeacherInvite({
      createdBy: req.user.id,
      label,
      expiresInHours,
      maxUses,
      lockToFirstIp,
      locale,
      origin: process.env.FRONTEND_URL || safeOrigin || 'https://wahywanamaa.com',
    });

    if (isDBConnected()) {
      logAdminAction({
        req,
        action: 'teacher_invite_created',
        entityType: 'TeacherInvite',
        entityId: created.invite?.id || null,
        reason: label || `Temporary teacher invite (${created.invite?.maxUses} uses)`,
        metadata: {
          label,
          maxUses: created.invite?.maxUses,
          lockToFirstIp: created.invite?.lockToFirstIp,
          expiresAt: created.invite?.expiresAt,
          locale: created.invite?.locale,
        },
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      ...created,
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/admin/invites/:inviteId/link', protect, authorize('admin'), async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    const inviteId = String(req.params.inviteId || '').trim();
    const rawOrigin = String(req.headers?.origin || '').trim();
    const safeOrigin = /^https?:\/\/[^/\s]+$/i.test(rawOrigin) ? rawOrigin : '';
    const result = await revealTeacherInviteLink(inviteId, {
      origin: process.env.FRONTEND_URL || safeOrigin || 'https://wahywanamaa.com',
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    return res.json({
      success: true,
      inviteToken: result.inviteToken,
      invitePath: result.invitePath,
      inviteUrl: result.inviteUrl,
      status: result.status,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/admin/invites/:inviteId/reset-ip', protect, authorize('admin'), async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId || '').trim();
    const result = await resetTeacherInviteIpLock(inviteId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    if (isDBConnected()) {
      logAdminAction({
        req,
        action: 'teacher_invite_ip_reset',
        entityType: 'TeacherInvite',
        entityId: inviteId,
        reason: String(req.body?.reason || '').trim() || 'IP lock reset by admin',
      }).catch(() => {});
    }

    return res.json({ success: true, invite: result.invite });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/admin/invites/:inviteId/revoke', protect, authorize('admin'), async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId || '').trim();
    const result = await revokeTeacherInvite(inviteId, req.user.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    if (isDBConnected()) {
      logAdminAction({
        req,
        action: 'teacher_invite_revoked',
        entityType: 'TeacherInvite',
        entityId: inviteId,
        reason: String(req.body?.reason || '').trim() || 'Revoked by admin',
      }).catch(() => {});
    }

    return res.json({ success: true, invite: result.invite });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.delete('/admin/invites/:inviteId', protect, authorize('admin'), async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId || '').trim();
    const result = await deleteTeacherInvite(inviteId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    if (isDBConnected()) {
      logAdminAction({
        req,
        action: 'teacher_invite_deleted',
        entityType: 'TeacherInvite',
        entityId: inviteId,
      }).catch(() => {});
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/admin/pending', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json([]);
  }
  try {
    const teachers = await Teacher.find({ status: { $in: ['pending', 'under-review'] } })
      .select('-documents -storageOwner')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/admin/:id/review', protect, authorize('admin'), async (req, res) => {
  const { action } = req.body;
  const note = String(req.body.note || '').trim().slice(0, 1000);
  const statusMap = {
    approve: 'approved',
    reject: 'rejected',
    'request-changes': 'under-review'
  };

  if (!Object.prototype.hasOwnProperty.call(statusMap, action)) {
    return res.status(400).json({
      error: 'Invalid teacher review action',
      code: 'INVALID_TEACHER_REVIEW_ACTION',
    });
  }

  if (['reject', 'request-changes'].includes(action) && !note) {
    return res.status(400).json({
      error: 'ملاحظة الإدارة مطلوبة لهذا القرار',
      code: 'TEACHER_REVIEW_NOTE_REQUIRED',
    });
  }

  if (isMockMode && !isDBConnected()) {
    updateMockTeacher(req.params.id, {
      status: statusMap[action],
      isVerified: action === 'approve',
    });
    return res.json({
      success: true,
      teacher: {
        _id: req.params.id,
        status: statusMap[action],
        isVerified: action === 'approve',
        reviewNotes: [{ admin: req.user?.id || 'admin', note, date: new Date() }]
      }
    });
  }

  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const gate = buildTeacherReviewGate(teacher);
    if (action === 'approve' && !gate.approvalReady) {
      await logAdminAction({
        req,
        action: 'teacher.review.approval-blocked',
        entityType: 'teacher',
        entityId: teacher._id,
        reason: 'Approval attempted before all required review items were complete.',
        metadata: {
          readiness: gate.readiness,
          blockers: gate.blockers.map((item) => item.key),
        },
      }).catch(() => {});

      return res.status(409).json({
        error: 'لا يمكن اعتماد المعلم قبل اكتمال قائمة المراجعة الإلزامية',
        code: 'TEACHER_REVIEW_GATE_INCOMPLETE',
        gate,
      });
    }

    teacher.status = statusMap[action];
    teacher.isVerified = action === 'approve';
    teacher.reviewNotes.push({
      admin: req.user.id,
      note: note || (action === 'approve' ? 'تم اعتماد الملف بعد اكتمال قائمة المراجعة.' : ''),
      date: new Date(),
    });
    if (!teacher.reviewStartedAt) teacher.reviewStartedAt = new Date();
    if (action === 'approve') teacher.reviewCompletedAt = new Date();
    await teacher.save();

    await logAdminAction({
      req,
      action: `teacher.review.${action}`,
      entityType: 'teacher',
      entityId: teacher._id,
      reason: note,
      metadata: {
        previousStatus: req.body.previousStatus || null,
        newStatus: teacher.status,
        readiness: gate.readiness,
      },
    });

    const teacherUser = await User.findByIdAndUpdate(
      teacher.user,
      {
        $inc: { refreshTokenVersion: 1 },
        ...(action !== 'approve' ? { $set: { sessionsRevokedAt: new Date() } } : {}),
      },
      { new: true }
    ).select('name email');

    if (['rejected', 'suspended'].includes(teacher.status)) {
      const SessionModel = require('../models/Session');
      const StudentSubscriptionModel = require('../models/StudentSubscription');
      if (Boolean(mongoose.connection?.db) || SessionModel.updateMany !== mongoose.Model.updateMany) {
        await SessionModel.updateMany(
          {
            teacher: teacher._id,
            status: { $in: ['pending', 'accepted'] },
            scheduledAt: { $gt: new Date() },
          },
          { $set: { status: 'cancelled', cancellationReason: 'Teacher deactivated' } }
        ).catch(() => {});
      }
      if (Boolean(mongoose.connection?.db) || StudentSubscriptionModel.updateMany !== mongoose.Model.updateMany) {
        await StudentSubscriptionModel.updateMany(
          {
            preferredTeacher: teacher._id,
            status: { $nin: ['cancelled', 'expired'] },
          },
          { $set: { preferredTeacher: null } }
        ).catch(() => {});
      }
    }

    if (teacherUser?.email) {
      const notification = {
        approve: {
          subject: 'تم قبول طلبك كمعلم — وَحْيٌ وَنَمَاء',
          text: 'تم اعتماد طلبك كمعلم. يمكنك الآن تسجيل الدخول إلى حسابك.',
          html: '<div dir="rtl"><h2>تم قبول طلبك ✅</h2><p>تم اعتماد طلبك كمعلم في أكاديمية وَحْيٌ وَنَمَاء.</p><p>يمكنك الآن تسجيل الدخول إلى حسابك.</p></div>',
        },
        'request-changes': {
          subject: 'طلبك كمعلم يحتاج استكمال — وَحْيٌ وَنَمَاء',
          text: `طلبك يحتاج استكمال أو تعديل قبل الاعتماد. ملاحظة الإدارة: ${note}`,
          html: `<div dir="rtl"><h2>طلبك يحتاج استكمال</h2><p>تحتاج الإدارة إلى استكمال أو تعديل بعض البيانات قبل الاعتماد.</p><p><strong>ملاحظة الإدارة:</strong> ${String(note).replace(/[<>&"]/g, '')}</p></div>`,
        },
        reject: {
          subject: 'تحديث حالة طلب المعلم — وَحْيٌ وَنَمَاء',
          text: `تعذر اعتماد طلبك كمعلم في الوقت الحالي. ملاحظة الإدارة: ${note}`,
          html: `<div dir="rtl"><h2>تحديث حالة الطلب</h2><p>تعذر اعتماد طلبك كمعلم في الوقت الحالي.</p><p><strong>ملاحظة الإدارة:</strong> ${String(note).replace(/[<>&"]/g, '')}</p></div>`,
        },
      }[action];

      sendEmail({
        to: teacherUser.email,
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
      }).catch((error) => {
        console.warn('Teacher review email failed:', error.message);
      });
    }

    return res.json({
      success: true,
      teacher,
      applicationStatus: teacher.status,
      gate: buildTeacherReviewGate(teacher),
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/admin/:id/assets', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .select('+storageOwner documents media status user isVerified assetsPurgedAt')
      .populate('user', 'email');

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    if (!['rejected', 'suspended'].includes(teacher.status)) {
      return res.status(409).json({
        error: 'Teacher assets can only be purged for rejected or suspended records',
        code: 'TEACHER_ASSET_PURGE_NOT_ALLOWED'
      });
    }

    if (teacher.assetsPurgedAt) {
      return res.status(409).json({
        error: 'Teacher assets were already purged',
        code: 'TEACHER_ASSETS_ALREADY_PURGED'
      });
    }

    let lifecycle;
    try {
      lifecycle = resolveOwnedTeacherAssets({
        teacher,
        user: teacher.user,
      });
    } catch (error) {
      if (error.code === 'ASSET_OWNERSHIP_UNRESOLVED') {
        return res.status(409).json({
          error: 'One or more teacher assets cannot be proven to belong to this application',
          code: error.code,
          field: error.asset?.field,
        });
      }
      throw error;
    }

    const localAssets = lifecycle.skipped.filter((asset) => ![
      'not-provided',
      '/default-teacher.png',
    ].includes(asset.reference));

    if (localAssets.length) {
      return res.status(409).json({
        error: 'Legacy local teacher assets require manual cleanup before this record can be purged',
        code: 'LEGACY_LOCAL_ASSETS_REQUIRE_MANUAL_CLEANUP',
        fields: localAssets.map((asset) => asset.field),
      });
    }

    await Promise.all(
      lifecycle.resolved.map((asset) => (
        objectStorage.deleteOwnedObject(asset.reference, asset.purpose, asset.owner)
      ))
    );

    teacher.documents = {
      idCard: 'not-provided',
      idCardFront: 'not-provided',
      idCardBack: 'not-provided',
      graduationCertificateAvailable: false,
      graduationCertificate: 'not-provided',
      tajweedCertificatesAvailable: false,
      tajweedCertificates: [],
      ijazatAvailable: false,
      ijazat: [],
    };
    teacher.media = {
      profilePhoto: '/default-teacher.png',
      introductionVideo: '/default-teacher.png',
      recitationVideo: '/default-teacher.png',
      teachingMethodVideo: '/default-teacher.png',
      additionalVideos: [],
      audioRecordings: [],
    };
    teacher.assetsPurgedAt = new Date();
    teacher.storageOwner = undefined;
    teacher.isVerified = false;
    await teacher.save();

    return res.json({
      success: true,
      deletedAssets: lifecycle.resolved.length,
      assetsPurgedAt: teacher.assetsPurgedAt,
    });
  } catch (error) {
    console.error('Teacher asset purge failed:', error.message);
    return res.status(500).json({ error: 'Failed to purge teacher assets' });
  }
});

router.get('/admin/:id/document/:kind{/:index}', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('documents');
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const { kind } = req.params;
    const allowed = ['idCard', 'idCardFront', 'idCardBack', 'graduationCertificate', 'tajweedCertificates', 'ijazat'];
    if (!allowed.includes(kind)) return res.status(400).json({ error: 'Invalid document type' });

    let stored = teacher.documents?.[kind];
    if (kind === 'idCardFront' && (!stored || stored === 'not-provided')) {
      stored = teacher.documents?.idCard;
    }
    if (Array.isArray(stored)) {
      const index = Number(req.params.index || 0);
      stored = stored[index];
    }

    if (!stored || stored === 'not-provided') {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAdminAction({
      req,
      action: 'teacher.sensitive-document.viewed',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: String(req.query.reason || '').trim(),
      metadata: { kind, index: req.params.index || null },
    }).catch(() => {});

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'attachment');

    if (/^https?:\/\//i.test(stored)) {
      const result = await objectStorage.getPrivateObject(stored, {
        ifNoneMatch: req.headers['if-none-match'],
      });
      if (!result) return res.status(404).json({ error: 'Document not found' });
      if (result.statusCode === 304) return res.status(304).end();

      res.setHeader('Content-Type', clampSafeAdminMime(result.blob?.contentType, 'application/octet-stream'));
      if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

      if (result.stream?.pipe) return result.stream.pipe(res);
      const reader = result.stream?.getReader?.();
      if (!reader) return res.status(404).json({ error: 'Document not found' });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      return res.end();
    }

    if (!stored.startsWith('private/teachers/')) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filename = path.basename(stored);
    const absolutePath = path.join(privateUploadDir, filename);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Document not found' });
    return res.sendFile(absolutePath);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load document' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const teacherId = String(req.params.id || '');
    if (isMockMode && !isDBConnected() && Teacher.findOne === mongoose.Model.findOne) {
      const mockTeacher = findMockTeacherById(teacherId);
      if (!mockTeacher || mockTeacher.status !== 'approved' || mockTeacher.isVerified !== true || mockTeacher.isPublic === false) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json(hydrateMockPublicTeacher(mockTeacher));
    }

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacher = await Teacher.findOne({ 
      _id: teacherId, 
      status: 'approved', 
      isVerified: true,
      isPublic: { $ne: false }
    })
      .select(PUBLIC_TEACHER_SELECT)
      .populate('user', 'name avatar bio')
      .lean();

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(sanitizePublicTeacher(teacher));
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.sanitizePublicTeacher = sanitizePublicTeacher;
module.exports = router;