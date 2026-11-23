const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Guardian = require('../models/Guardian');
const { 
  isNativeMobileClient,
  generateAccessToken, 
  generateRefreshToken, 
  verifyAccessToken, 
  verifyRefreshToken,
  readRefreshTokenIfValid,
  readAccessTokenIfValid,
  requireRole 
} = require('../middleware/auth');
const { addMockUser, findMockUserByEmail, findMockUserByPhone, findMockUserById, updateMockUser, getMockUsers } = require('../mockStore');
const { sendEmail } = require('../services/notificationDispatcher');
const { getEmailProviderStatus } = require('../config/emailProvider');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const { normalizePhone, syntheticPhoneEmail } = require('../utils/phone');
const { isSection } = require('../config/subscriptionPlans');
const storage = require('../services/objectStorage');
const { createGuardianInvitation } = require('../services/guardianInvitations');
const VerificationLedger = require('../models/VerificationLedger');
const logger = require('../utils/logger');

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const GuardianInvitation = require('../models/GuardianInvitation');
const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;
const hasRealMongoDriver = () => isDBConnected() && Boolean(mongoose.connection?.db);

const MAX_PASSWORD_LENGTH = 128;
const DUMMY_PASSWORD_HASH = '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const getRefreshCookieName = () => (process.env.NODE_ENV === 'production' ? '__Secure-wn_refresh' : 'wn_refresh');
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const LOCKOUT_DURATION_MS = Number(process.env.LOCKOUT_DURATION_MS || 15 * 60 * 1000);
const REFRESH_COOKIE_MAX_AGE_SECONDS = Number(
  process.env.REFRESH_COOKIE_MAX_AGE_SECONDS || 7 * 24 * 60 * 60
);
const MAX_CONSUMED_REFRESH_JTIS = 512;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_HOURLY_CAP = 4;
const consumedRefreshJtisFallback = new Map();
const passwordResetQuotaFallback = new Map();

async function recordFailedPasswordAttempt(user, lockExpired, maxAttempts = MAX_FAILED_LOGIN_ATTEMPTS) {
  const lockValue = new Date(Date.now() + LOCKOUT_DURATION_MS);
  if (typeof User.findByIdAndUpdate === 'function' && user?._id) {
    const updated = await Promise.resolve(User.findByIdAndUpdate(
      user._id,
      lockExpired
        ? { $set: { failedLoginAttempts: 1, lockUntil: null } }
        : { $inc: { failedLoginAttempts: 1 } },
      { new: true }
    )).catch(() => null);
    const attempts = Number(updated?.failedLoginAttempts ?? (lockExpired ? 1 : Number(user.failedLoginAttempts || 0) + 1));
    if (attempts >= maxAttempts) {
      await Promise.resolve(User.findByIdAndUpdate(
        user._id,
        { $set: { lockUntil: lockValue } },
        { new: true }
      )).catch(() => {});
    }
    return;
  }
  const baseAttempts = lockExpired ? 0 : Number(user.failedLoginAttempts || 0);
  const nextAttempts = baseAttempts + 1;
  user.failedLoginAttempts = nextAttempts;
  user.lockUntil = nextAttempts >= maxAttempts ? lockValue : null;
  await user.save?.().catch(() => {});
}

async function hasEstablishedStudentActivity(studentDoc) {
  if (!studentDoc) return false;
  if (studentDoc.guardian) return true;
  if (!hasRealMongoDriver()) return false;
  const StudentSubscription = require('../models/StudentSubscription');
  const Enrollment = require('../models/Enrollment');
  const Session = require('../models/Session');
  const [hasSub, hasEnroll, hasSession, hasAcceptedGuardian] = await Promise.all([
    StudentSubscription.exists({ student: studentDoc._id, status: { $nin: ['cancelled', 'expired'] } }),
    Enrollment.exists({ student: studentDoc._id, status: { $ne: 'cancelled' } }),
    Session.exists({ student: studentDoc._id, status: { $in: ['accepted', 'completed'] } }),
    Guardian.exists({ 'children.student': studentDoc._id, isActive: true }),
  ]);
  return Boolean(hasSub || hasEnroll || hasSession || hasAcceptedGuardian);
}

function markRefreshJtiConsumedInMemory(jti, expSeconds) {
  if (!jti) return false;
  const now = Date.now();
  if (consumedRefreshJtisFallback.size > 5000) {
    for (const [key, expiresAt] of consumedRefreshJtisFallback.entries()) {
      if (expiresAt <= now) consumedRefreshJtisFallback.delete(key);
    }
  }
  const existingExp = consumedRefreshJtisFallback.get(jti);
  if (existingExp && existingExp > now) {
    return true;
  }
  const ttlMs = expSeconds ? Math.max(1000, expSeconds * 1000 - now) : REFRESH_COOKIE_MAX_AGE_SECONDS * 1000;
  consumedRefreshJtisFallback.set(jti, now + ttlMs);
  return false;
}

function setRefreshCookie(res, refreshToken) {
  const cookieName = getRefreshCookieName();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.REFRESH_COOKIE_SAMESITE || 'Lax';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(refreshToken)}; Path=/api/auth; HttpOnly; SameSite=${sameSite}; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}${secure}`
  );
}

function clearRefreshCookie(res) {
  const cookieName = getRefreshCookieName();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.REFRESH_COOKIE_SAMESITE || 'Lax';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/api/auth; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`
  );
}

function attachRefreshSession(req, res, user) {
  const nativeMobile = isNativeMobileClient(req);
  const refreshToken = generateRefreshToken(user, { mobile: nativeMobile });
  if (!nativeMobile) {
    setRefreshCookie(res, refreshToken);
    return {};
  }
  return { refreshToken };
}

async function presentUser(user) {
  const result = sanitizeUserResponse(user);
  if (user?.role === 'teacher') {
    const decision = await getTeacherAccessDecision(user._id || user.id);
    result.teacherApproved = decision.allowed;
    result.teacherApprovalStatus = decision.status;
    result.teacherReviewNote = decision.reviewNote || '';
    result.teacherRequestedChanges = decision.requestedChanges || [];
  }
  return result;
}

function sanitizeUserResponse(user) {
  if (!user) return null;
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete obj.password;
  delete obj.googleSubject;
  delete obj.refreshTokenVersion;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  delete obj.sessionsRevokedAt;
  delete obj.guardianLinkCode;
  delete obj.pushToken;
  delete obj.telegramId;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.__v;
  return obj;
}

function sanitizePreferencesInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const clean = {};
  const allowedLangs = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];
  const allowedCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'PKR', 'IDR'];
  const allowedThemes = ['light', 'dark'];
  if (raw.language !== undefined) {
    if (!allowedLangs.includes(raw.language)) return null;
    clean['preferences.language'] = raw.language;
  }
  if (raw.currency !== undefined) {
    if (!allowedCurrencies.includes(raw.currency)) return null;
    clean['preferences.currency'] = raw.currency;
  }
  if (raw.timezone !== undefined) {
    if (typeof raw.timezone !== 'string' || raw.timezone.trim().length > 64) return null;
    clean['preferences.timezone'] = raw.timezone.trim();
  }
  if (raw.market !== undefined) {
    if (typeof raw.market !== 'string' || raw.market.trim().length > 64) return null;
    clean['preferences.market'] = raw.market.trim();
  }
  if (raw.theme !== undefined) {
    if (!allowedThemes.includes(raw.theme)) return null;
    clean['preferences.theme'] = raw.theme;
  }
  if (raw.notifications !== undefined) {
    if (!raw.notifications || typeof raw.notifications !== 'object' || Array.isArray(raw.notifications)) return null;
    for (const ch of ['email', 'push', 'telegram', 'sms']) {
      if (raw.notifications[ch] !== undefined) {
        if (typeof raw.notifications[ch] !== 'boolean') return null;
        clean[`preferences.notifications.${ch}`] = raw.notifications[ch];
      }
    }
  }
  return clean;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, guardianPhone, guardianRelationship, whatsappPhone, age, gender, currentLevel, preferredTrack, memorizedJuz, memorizationDetails, customLevel, enrollmentSection } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const allowedRoles = ['student', 'guardian'];

    if (!name || !normalizedEmail || !password || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ 
        error: 'Name, email, and password are required' 
      });
    }

    if (normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Email cannot exceed 254 characters' });
    }

    if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ 
        error: `Password must be between 8 and ${MAX_PASSWORD_LENGTH} characters` 
      });
    }

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'This role cannot be self-registered' });
    }
    const assignedRole = role || 'student';
    // A guardian may manage children from both divisions, so do not bind guardians.
    const normalizedGender = ['male', 'female'].includes(String(gender || '').trim().toLowerCase())
      ? String(gender).trim().toLowerCase()
      : undefined;
    if (assignedRole === 'student' && enrollmentSection !== undefined && !isSection(enrollmentSection)) {
      return res.status(400).json({ error: 'القسم التعليمي المختار غير صحيح', code: 'ENROLLMENT_SECTION_INVALID' });
    }
    if (assignedRole === 'student' && enrollmentSection === 'ladies' && normalizedGender === 'male') {
      return res.status(400).json({ error: 'قسم السيدات متاح للطالبات فقط', code: 'SECTION_GENDER_MISMATCH' });
    }
    const normalizedPhone = normalizePhone(phone);

    if (assignedRole === 'guardian' && !normalizedPhone) {
      return res.status(400).json({ error: 'رقم هاتف ولي الأمر مطلوب لإنشاء الحساب' });
    }

    let parsedAge = undefined;
    const hasAge = age !== undefined && age !== null && String(age).trim() !== '';
    if (assignedRole === 'student' && hasAge) {
      parsedAge = Number(age);
      if (!Number.isFinite(parsedAge) || parsedAge < 4 || parsedAge > 100) {
        return res.status(400).json({ error: 'عمر الطالب غير صحيح (يجب أن يكون بين 4 و 100 سنة)', code: 'INVALID_STUDENT_AGE' });
      }
      if (parsedAge < 18 && !normalizePhone(guardianPhone)) {
        return res.status(400).json({
          error: 'رقم هاتف ولي الأمر مطلوب لتسجيل الطالب أقل من 18 سنة',
          code: 'GUARDIAN_CONTACT_REQUIRED',
        });
      }
    }

    if (assignedRole === 'student' && guardianPhone) {
      const normalizedGuardianPhone = normalizePhone(guardianPhone);
      const normalizedWhatsapp = normalizePhone(whatsappPhone);
      if (
        normalizedGuardianPhone
        && (
          (normalizedPhone && normalizedGuardianPhone === normalizedPhone)
          || (normalizedWhatsapp && normalizedGuardianPhone === normalizedWhatsapp)
        )
      ) {
        return res.status(400).json({
          error: 'لا يمكن استخدام رقم هاتف الطالب نفسه كرقم لولي الأمر',
          code: 'GUARDIAN_SELF_LINK_FORBIDDEN',
        });
      }
    }

    if (!isMockMode || isDBConnected()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Email already registered' 
        });
      }

      if (assignedRole === 'guardian') {
        const guardianPhoneOwner = await User.findOne({
          role: 'guardian',
          phoneNormalized: normalizedPhone,
          isActive: { $ne: false },
        }).select('_id');
        if (guardianPhoneOwner) {
          return res.status(409).json({
            error: 'يوجد حساب ولي أمر مسجل بالفعل بهذا الرقم. سجل الدخول إلى الحساب الحالي.',
            code: 'GUARDIAN_PHONE_ALREADY_REGISTERED',
          });
        }
      }

      const user = await User.create({
        name: name.trim().slice(0, 100),
        email: normalizedEmail,
        password,
        phone,
        phoneNormalized: normalizedPhone || undefined,
        phoneVerified: false,
        role: assignedRole,
        ...(assignedRole === 'student' ? {
          whatsappPhone: String(whatsappPhone || '').trim().slice(0, 32),
          ...(parsedAge !== undefined ? { age: parsedAge } : {}),
          ...((parsedAge === undefined || !normalizedGender) ? { onboarding: { required: true, completed: false } } : {}),
          ...(parsedAge !== undefined && parsedAge < 18 && guardianPhone ? {
            guardianContact: {
              name: String(req.body.guardianName || '').trim().slice(0, 100),
              phone: String(guardianPhone).trim().slice(0, 32),
              relationship: ['father', 'mother', 'guardian', 'other'].includes(guardianRelationship) ? guardianRelationship : 'guardian',
            },
          } : {}),
          ...(normalizedGender ? { gender: normalizedGender } : {}),
          ...(enrollmentSection ? { enrollmentSection } : {}),
          currentLevel: ['beginner', 'intermediate', 'advanced', 'ijazah'].includes(currentLevel) ? currentLevel : 'beginner',
          preferredTrack: ['memorization', 'tajweed_ijazah', 'kids_foundation'].includes(preferredTrack) ? preferredTrack : 'memorization',
          memorizedJuz: Math.max(0, Math.min(30, Math.trunc(Number(memorizedJuz) || 0))),
          memorizationDetails: String(memorizationDetails || '').trim().slice(0, 500),
          customLevel: String(customLevel || '').trim().slice(0, 120),
        } : {}),
      });

      if (req.body.referralCode && user.role === 'student') {
        const { processReferralSignup } = require('./referrals');
        await processReferralSignup(req.body.referralCode, user._id).catch(() => {});
      }

      if (user.role === 'student' && guardianPhone) {
        await createGuardianInvitation({
          studentId: user._id,
          guardianPhone,
          relationship: guardianRelationship || 'guardian',
          source: 'student-registration',
        }).catch((error) => {
          console.warn('Guardian invitation creation warning:', error.message);
        });
      }

      if (assignedRole === 'guardian') {
        await Guardian.findOneAndUpdate(
          { user: user._id },
          { $setOnInsert: { user: user._id, children: [] } },
          { upsert: true, new: true }
        ).catch((error) => {
          console.warn('Guardian profile upsert warning:', error.message);
        });
      }

      const accessToken = generateAccessToken(user);
      const mobileRefresh = attachRefreshSession(req, res, user);

      user.lastLogin = new Date();
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      res.status(201).json({
        message: 'Registration successful',
        user: await presentUser(user),
        accessToken,
        ...mobileRefresh
      });
      return;
    }

    const existingUser = findMockUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const user = addMockUser({
      _id: `mock-${Date.now()}`,
      email: normalizedEmail,
      password,
      name,
      phone,
      role: assignedRole,
      ...(assignedRole === 'student' && enrollmentSection ? { enrollmentSection } : {}),
      isActive: true,
      lastLogin: new Date(),
    });

    const accessToken = generateAccessToken(user);
    const mobileRefresh = attachRefreshSession(req, res, user);

    res.status(201).json({
      message: 'Registration successful',
      user: await presentUser(user),
      accessToken,
      ...mobileRefresh
    });
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error',
        ...(process.env.NODE_ENV !== 'production' ? { details: error.message } : {}),
      });
    }

    res.status(500).json({ 
      error: 'Registration failed' 
    });
  }
});

// Google Identity Services (OpenID Connect). Self-service Google signup is strictly limited to student/guardian roles.
router.post('/google', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google sign-in is not configured', code: 'GOOGLE_NOT_CONFIGURED' });
  }
  if (!isDBConnected()) {
    return res.status(503).json({ error: 'Google sign-in requires the account database' });
  }
  try {
    const { verifyGoogleCredential } = require('../services/googleIdentity');
    const identity = await verifyGoogleCredential(req.body?.credential, process.env.GOOGLE_CLIENT_ID);
    if (req.body?.role && !['student', 'guardian'].includes(req.body.role)) {
      return res.status(400).json({ error: 'This role cannot be self-registered via Google', code: 'GOOGLE_ROLE_NOT_ALLOWED' });
    }
    const requestedRole = ['student', 'guardian'].includes(req.body?.role) ? req.body.role : 'student';
    const enrollmentSection = req.body?.enrollmentSection;
    if (requestedRole === 'student' && req.body?.context === 'signup' && enrollmentSection !== undefined && !isSection(enrollmentSection)) {
      return res.status(400).json({ error: 'القسم التعليمي المختار غير صحيح', code: 'ENROLLMENT_SECTION_INVALID' });
    }
    let user = await User.findOne({ googleSubject: identity.sub })
      .select('+googleSubject +refreshTokenVersion +failedLoginAttempts +lockUntil +sessionsRevokedAt');

    if (user && String(user.email || '').toLowerCase() !== String(identity.email || '').toLowerCase()) {
      return res.status(409).json({
        error: 'Google identity email no longer matches this account. Please sign in with your updated email.',
        code: 'GOOGLE_EMAIL_MISMATCH',
      });
    }

    if (!user) {
      const existing = await User.findOne({ email: identity.email })
        .select('+googleSubject +refreshTokenVersion +failedLoginAttempts +lockUntil +sessionsRevokedAt');
      if (existing) {
        if (!['student', 'guardian', 'teacher'].includes(existing.role) || existing.isActive === false) {
          return res.status(403).json({ error: 'Use the account login method for this role' });
        }
        if (existing.lockUntil && new Date(existing.lockUntil).getTime() > Date.now()) {
          const retryAfterSeconds = Math.ceil((new Date(existing.lockUntil).getTime() - Date.now()) / 1000);
          res.setHeader('Retry-After', String(retryAfterSeconds));
          return res.status(423).json({
            error: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
            code: 'ACCOUNT_LOCKED',
            retryAfterSeconds,
          });
        }
        // An existing non-Gmail address must be linked from an authenticated session.
        // Google is authoritative for Gmail addresses it operates.
        if (!/^[^@]+@(gmail\.com|googlemail\.com)$/.test(identity.email)) {
          return res.status(409).json({ error: 'Sign in with your existing password to link this address' });
        }
        if (existing.googleSubject && existing.googleSubject !== identity.sub) {
          return res.status(409).json({ error: 'This account is linked to another Google identity' });
        }
        if (existing.role === 'teacher') {
          const teacherAccess = await getTeacherAccessDecision(existing._id || existing.id);
          if (!teacherAccess.allowed) {
            return res.status(403).json({
              error: teacherAccess.error,
              code: teacherAccess.code,
              applicationStatus: teacherAccess.status,
            });
          }
          if (!existing.googleSubject && existing.emailVerified !== true) {
            return res.status(409).json({
              error: 'Sign in with your existing teacher password to link Google',
              code: 'PASSWORD_LINK_REQUIRED',
            });
          }
        }
        if (
          existing.role === 'guardian'
          && !existing.googleSubject
          && existing.emailVerified !== true
          && Array.isArray(existing.children)
          && existing.children.length > 0
        ) {
          return res.status(409).json({
            error: 'Sign in with your existing guardian password to link Google',
            code: 'PASSWORD_LINK_REQUIRED',
          });
        }
        // CRIT-03 / V3-HIGH-04 / V4-CRIT-02 defense:
        // Only purge genuinely empty unverified squatter accounts. Never wipe locked minor
        // demographics, accepted guardian links, or active learning records!
        if (!existing.googleSubject && existing.emailVerified !== true && existing.role !== 'teacher') {
          const hasActivity = await hasEstablishedStudentActivity(existing);
          if (hasActivity) {
            return res.status(409).json({
              error: 'Sign in with your existing password to link Google to an active account',
              code: 'PASSWORD_LINK_REQUIRED',
            });
          }
          existing.password = crypto.randomBytes(48).toString('base64url');
          existing.refreshTokenVersion = Number(existing.refreshTokenVersion || 0) + 1;
          existing.sessionsRevokedAt = new Date();
          existing.consumedRefreshJtis = [];
          existing.guardian = null;
          existing.children = [];
          existing.guardianLinkCode = undefined;
          existing.guardianContact = { name: '', phone: '', relationship: '' };
          existing.phone = '';
          existing.phoneNormalized = undefined;
          existing.phoneVerified = false;
          existing.whatsappPhone = '';
          existing.gender = undefined;
          existing.age = undefined;
          existing.enrollmentSection = undefined;
          existing.referredBy = undefined;
          existing.role = requestedRole;
          existing.onboarding = { required: true, completed: false };
          const cleanupTasks = [];
          if (hasRealMongoDriver() || GuardianInvitation.updateMany !== mongoose.Model.updateMany) {
            cleanupTasks.push(
              GuardianInvitation.updateMany?.(
                { student: existing._id, status: { $in: ['pending', 'accepted'] } },
                { $set: { status: 'cancelled' } }
              )
            );
          }
          if (hasRealMongoDriver() || Guardian.updateMany !== mongoose.Model.updateMany) {
            cleanupTasks.push(
              Guardian.updateMany?.(
                { 'children.student': existing._id },
                { $pull: { children: { student: existing._id }, reports: { student: existing._id } } }
              )
            );
          }
          if (hasRealMongoDriver() || User.updateMany !== mongoose.Model.updateMany) {
            cleanupTasks.push(
              User.updateMany?.(
                { children: existing._id },
                { $pull: { children: existing._id } }
              )
            );
          }
          await Promise.all(cleanupTasks).catch(() => {});
          if (hasRealMongoDriver()) {
            try {
              const Referral = require('../models/Referral');
              await Referral.deleteOne?.({ referee: existing._id }).catch(() => {});
            } catch { /* ignore */ }
          }
        }
        existing.googleSubject = identity.sub;
        existing.emailVerified = true;
        await existing.save();
        user = existing;
      } else {
        user = await User.create({
          name: identity.name.length >= 2 ? identity.name : 'طالب الأكاديمية',
          email: identity.email,
          password: crypto.randomBytes(48).toString('base64url'),
          googleSubject: identity.sub,
          role: requestedRole,
          ...(requestedRole === 'student' && req.body?.context === 'signup' && enrollmentSection ? { enrollmentSection } : {}),
          onboarding: { required: true, completed: false },
          emailVerified: true,
          avatar: identity.picture,
        });
        if (req.body?.referralCode && requestedRole === 'student') {
          const { processReferralSignup } = require('./referrals');
          await processReferralSignup(req.body.referralCode, user._id).catch(() => {});
        }
      }
    }
    if (!['student', 'guardian', 'teacher'].includes(user.role) || user.isActive === false) {
      return res.status(403).json({ error: 'Account is not eligible for Google sign-in' });
    }
    if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED',
        retryAfterSeconds,
      });
    }
    if (user.role === 'teacher') {
      const teacherAccess = await getTeacherAccessDecision(user._id || user.id);
      if (!teacherAccess.allowed) {
        return res.status(403).json({
          error: teacherAccess.error,
          code: teacherAccess.code,
          applicationStatus: teacherAccess.status,
        });
      }
    }
    if (user.role === 'guardian') {
      await Guardian.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, children: [] } }, { upsert: true });
    }
    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
    const accessToken = generateAccessToken(user);
    const mobileRefresh = attachRefreshSession(req, res, user);
    return res.json({
      accessToken,
      ...mobileRefresh,
      user: await presentUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'Account was already registered. Please retry.' });
    console.warn('Google sign-in rejected:', error.message);
    return res.status(401).json({ error: 'Google verification failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const rawIdentifier = req.body?.identifier ?? req.body?.email ?? req.body?.phone;
    const { password } = req.body;

    if (!rawIdentifier || !password || typeof rawIdentifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ 
        error: 'Email or phone number and password are required' 
      });
    }

    const identifier = rawIdentifier.trim();
    if (!identifier || identifier.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isEmailLogin = identifier.includes('@');
    let user = null;
    if (isMockMode && !isDBConnected()) {
      user = isEmailLogin
        ? findMockUserByEmail(identifier.toLowerCase())
        : findMockUserByPhone(identifier);
    } else if (isEmailLogin) {
      user = await User.findOne({ email: identifier.toLowerCase() })
        .select('+password +refreshTokenVersion +phoneNormalized +failedLoginAttempts +lockUntil');
    } else {
      const normalizedPhone = normalizePhone(identifier);
      const syntheticEmail = syntheticPhoneEmail(identifier);
      const phoneFilters = [];
      if (normalizedPhone) phoneFilters.push({ phoneNormalized: normalizedPhone });
      if (syntheticEmail) phoneFilters.push({ email: syntheticEmail });
      if (phoneFilters.length) {
        const candidates = await User.find({ $or: phoneFilters })
          .select('+password +refreshTokenVersion +phoneNormalized +failedLoginAttempts +lockUntil')
          .limit(5);
        if (candidates.length === 1) {
          user = candidates[0];
        } else if (candidates.length > 1) {
          for (const candidate of candidates) {
            if (candidate.isActive && await candidate.comparePassword(password).catch(() => false)) {
              user = candidate;
              break;
            }
          }
          if (!user) user = candidates[0];
        }
      }
    }
    
    if (!user) {
      if (!isMockMode || isDBConnected()) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => {});
      }
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const lockExpired = Boolean(user.lockUntil && new Date(user.lockUntil).getTime() <= Date.now());
    if (user.lockUntil && !lockExpired) {
      const retryAfterSeconds = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED',
        retryAfterSeconds,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Account is deactivated. Please contact support.' 
      });
    }

    const isPasswordValid = isMockMode && !isDBConnected()
      ? user.password === password
      : await user.comparePassword(password);
    
    if (!isPasswordValid) {
      if (!isMockMode || isDBConnected()) {
        await recordFailedPasswordAttempt(user, lockExpired, MAX_FAILED_LOGIN_ATTEMPTS);
      }
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // A valid password does not grant access to the teacher workspace until
    // the teacher application has been approved and verified by an admin.
    if (user.role === 'teacher') {
      const teacherAccess = await getTeacherAccessDecision(user._id || user.id);
      if (!teacherAccess.allowed) {
        return res.status(403).json({
          error: teacherAccess.error,
          code: teacherAccess.code,
          applicationStatus: teacherAccess.status,
        });
      }
    }

    const accessToken = generateAccessToken(user);
    const mobileRefresh = attachRefreshSession(req, res, user);

    if (!isMockMode || isDBConnected()) {
      user.lastLogin = new Date();
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      if (user.phone && !user.phoneNormalized) {
        user.$locals = { ...(user.$locals || {}), preservePhoneVerified: true };
        user.phoneNormalized = normalizePhone(user.phone) || undefined;
      }
      await user.save();
    } else {
      updateMockUser(user._id || user.id, { lastLogin: new Date() });
    }

    res.json({
      message: 'Login successful',
      user: await presentUser(user),
      accessToken,
      ...mobileRefresh
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed' 
    });
  }
});

router.post('/refresh', verifyRefreshToken, async (req, res) => {
  try {
    const user = isMockMode && !isDBConnected()
      ? findMockUserById(req.refreshToken.id)
      : await User.findById(req.refreshToken.id).select('+refreshTokenVersion +sessionsRevokedAt +lockUntil +consumedRefreshJtis');
    
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({ 
        error: 'User not found or deactivated' 
      });
    }

    if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
      clearRefreshCookie(res);
      return res.status(423).json({
        error: 'Account temporarily locked. Please try again later.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    if (req.refreshToken.role && user.role && req.refreshToken.role !== user.role) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh session role invalidated', code: 'SESSION_REVOKED' });
    }

    const expectedVersion = Number(user.refreshTokenVersion || 0);
    const tokenVersion = Number(req.refreshToken.v || 0);
    if (tokenVersion !== expectedVersion) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh session has been revoked' });
    }

    if (user.sessionsRevokedAt && req.refreshToken.iat) {
      const revokedMs = new Date(user.sessionsRevokedAt).getTime();
      if (Number.isFinite(revokedMs) && req.refreshToken.iat * 1000 < revokedMs - 1000) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Refresh session has been revoked' });
      }
    }

    const presentedJti = typeof req.refreshToken.jti === 'string' ? req.refreshToken.jti : '';
    if (presentedJti) {
      const canRotateInDb = isDBConnected() && User.findOneAndUpdate === mongoose.Model.findOneAndUpdate;
      if (canRotateInDb) {
        if (hasRealMongoDriver()) {
          const ttlExpiresAt = new Date(
            req.refreshToken.exp
              ? Math.max(Date.now() + 5000, req.refreshToken.exp * 1000)
              : Date.now() + REFRESH_COOKIE_MAX_AGE_SECONDS * 1000
          );
          const ledgerClaim = await VerificationLedger.findOneAndUpdate(
            { kind: 'refresh_jti', key: `${user._id}:${presentedJti}`, consumed: { $ne: true } },
            { $set: { consumed: true, expiresAt: ttlExpiresAt } },
            { upsert: true, new: true }
          ).catch((err) => (err?.code === 11000 ? null : Promise.reject(err)));
          if (!ledgerClaim) {
            await Promise.resolve(User.findByIdAndUpdate(user._id, {
              $inc: { refreshTokenVersion: 1 },
              $set: { sessionsRevokedAt: new Date(), consumedRefreshJtis: [] },
            })).catch(() => {});
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Refresh token reuse detected. All sessions revoked.', code: 'REFRESH_TOKEN_REUSED' });
          }
        }
        if (Array.isArray(user.consumedRefreshJtis) && user.consumedRefreshJtis.includes(presentedJti)) {
          await Promise.resolve(User.findByIdAndUpdate(user._id, {
            $inc: { refreshTokenVersion: 1 },
            $set: { sessionsRevokedAt: new Date(), consumedRefreshJtis: [] },
          })).catch(() => {});
          clearRefreshCookie(res);
          return res.status(401).json({ error: 'Refresh token reuse detected. All sessions revoked.', code: 'REFRESH_TOKEN_REUSED' });
        }
        const rotated = await User.findOneAndUpdate(
          {
            _id: user._id,
            refreshTokenVersion: expectedVersion,
            consumedRefreshJtis: { $ne: presentedJti },
          },
          {
            $push: { consumedRefreshJtis: { $each: [presentedJti], $slice: -MAX_CONSUMED_REFRESH_JTIS } },
          },
          { new: true }
        );
        if (!rotated) {
          await Promise.resolve(User.findByIdAndUpdate(user._id, {
            $inc: { refreshTokenVersion: 1 },
            $set: { sessionsRevokedAt: new Date(), consumedRefreshJtis: [] },
          })).catch(() => {});
          clearRefreshCookie(res);
          return res.status(401).json({ error: 'Refresh session has been revoked', code: 'REFRESH_TOKEN_REUSED' });
        }
      } else if (markRefreshJtiConsumedInMemory(presentedJti, req.refreshToken.exp)) {
        if (isDBConnected() && typeof User.findByIdAndUpdate === 'function') {
          await Promise.resolve(User.findByIdAndUpdate(user._id, {
            $inc: { refreshTokenVersion: 1 },
            $set: { sessionsRevokedAt: new Date(), consumedRefreshJtis: [] },
          })).catch(() => {});
        } else if (isMockMode) {
          updateMockUser(user._id || user.id, {
            refreshTokenVersion: expectedVersion + 1,
            sessionsRevokedAt: new Date(),
          });
        }
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Refresh session has been revoked', code: 'REFRESH_TOKEN_REUSED' });
      }
    }

    if (user.role === 'teacher') {
      const teacherAccess = await getTeacherAccessDecision(user._id || user.id);
      if (!teacherAccess.allowed) {
        clearRefreshCookie(res);
        return res.status(403).json({
          error: teacherAccess.error,
          code: teacherAccess.code,
          applicationStatus: teacherAccess.status,
        });
      }
    }

    const accessToken = generateAccessToken(user);
    const mobileRefresh = attachRefreshSession(req, res, user);

    res.json({
      accessToken,
      ...mobileRefresh
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed' 
    });
  }
});

router.post('/logout', readRefreshTokenIfValid, readAccessTokenIfValid, async (req, res) => {
  clearRefreshCookie(res);

  try {
    const targetId = req.refreshToken?.id || req.user?.id;
    const tokenVersion = Number((req.refreshToken ? req.refreshToken.v : req.user?.v) || 0);
    if (targetId) {
      if (isMockMode && !isDBConnected()) {
        const user = findMockUserById(targetId);
        if (user && Number(user.refreshTokenVersion || 0) === tokenVersion) {
          updateMockUser(user._id || user.id, {
            refreshTokenVersion: Number(user.refreshTokenVersion || 0) + 1,
            sessionsRevokedAt: new Date(),
            pushToken: undefined,
          });
        }
      } else {
        await User.findOneAndUpdate(
          { _id: targetId, refreshTokenVersion: tokenVersion },
          {
            $inc: { refreshTokenVersion: 1 },
            $set: { sessionsRevokedAt: new Date(), consumedRefreshJtis: [] },
            $unset: { pushToken: 1 },
          }
        );
      }
    }
  } catch (error) {
    logger.warn('Logout token revocation warning', { error: error?.message });
  }

  return res.json({ message: 'Logged out successfully' });
});

router.get('/me', verifyAccessToken, async (req, res) => {
  try {
    const user = isMockMode && !isDBConnected()
      ? findMockUserById(req.user.id)
      : await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.json({ user: await presentUser(user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile' 
    });
  }
});

router.patch('/me', verifyAccessToken, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'avatar', 'bio', 'preferences'];
    const updates = Object.keys(req.body || {});
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return res.status(400).json({ 
        error: 'Invalid update fields' 
      });
    }

    const patchFields = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar') && req.user.role === 'student') {
      const value = String(req.body.avatar || '');
      if (value && !storage.isOwnedObjectReference(value, 'student-avatar', req.user.id)) {
        return res.status(400).json({ error: 'Invalid student avatar reference' });
      }
      patchFields.avatar = value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar') && req.user.role !== 'student') {
      const value = String(req.body.avatar || '');
      const validOwnerRef = storage.isOwnedObjectReference(value, 'teacher-public', req.user.id)
        || storage.isOwnedObjectReference(value, 'student-avatar', req.user.id);
      if (value && !validOwnerRef) {
        return res.status(400).json({ error: 'Invalid avatar reference' });
      }
      patchFields.avatar = value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
      patchFields.name = req.body.name.trim().slice(0, 100);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'bio')) {
      patchFields.bio = String(req.body.bio || '').trim().slice(0, 500);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'preferences')) {
      const sanitizedPrefs = sanitizePreferencesInput(req.body.preferences);
      if (!sanitizedPrefs) {
        return res.status(400).json({ error: 'Invalid preferences payload' });
      }
      Object.assign(patchFields, sanitizedPrefs);
    }

    const unsetFields = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      const cleanPhone = String(req.body.phone || '').trim().slice(0, 32);
      const normalizedPhone = normalizePhone(cleanPhone);
      if (!cleanPhone && (!isMockMode || isDBConnected())) {
        const currentDoc = await User.findById(req.user.id).select('onboarding');
        if (currentDoc?.onboarding?.completed === true) {
          return res.status(400).json({ error: 'لا يمكن حذف رقم الهاتف بعد إكمال إعداد الملف الشخصي' });
        }
      }
      if (req.user.role === 'guardian' && !normalizedPhone) {
        return res.status(400).json({ error: 'رقم هاتف ولي الأمر غير صالح' });
      }
      if (cleanPhone && !normalizedPhone) {
        return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
      }
      if ((!isMockMode || isDBConnected()) && req.user.role === 'guardian' && normalizedPhone) {
        const duplicateGuardian = await User.findOne({
          _id: { $ne: req.user.id },
          role: 'guardian',
          phoneNormalized: normalizedPhone,
          isActive: { $ne: false },
        }).select('_id');
        if (duplicateGuardian) {
          return res.status(409).json({
            error: 'يوجد حساب ولي أمر آخر مسجل بهذا الرقم',
            code: 'GUARDIAN_PHONE_ALREADY_REGISTERED',
          });
        }
      }
      patchFields.phone = cleanPhone;
      if (normalizedPhone) {
        patchFields.phoneNormalized = normalizedPhone;
      } else {
        unsetFields.phoneNormalized = 1;
      }
      patchFields.phoneVerified = false;
    }

    let user;
    if (isMockMode && !isDBConnected()) {
      user = updateMockUser(req.user.id, patchFields);
    } else {
      user = await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: patchFields,
          ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
        },
        { new: true, runValidators: true }
      );
    }

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.json({ 
      message: 'Profile updated successfully',
      user: await presentUser(user) 
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: safeErrorMessage(error, 400) });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'رقم الهاتف مستخدم بالفعل في حساب آخر',
        code: 'GUARDIAN_PHONE_ALREADY_REGISTERED',
      });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile' 
    });
  }
});

router.patch('/onboarding', verifyAccessToken, async (req, res) => {
  try {
    if (!isDBConnected()) return res.status(503).json({ error: 'Database unavailable' });
    if (!['student', 'teacher', 'guardian'].includes(req.user.role)) return res.status(403).json({ error: 'Not permitted' });
    const allowed = ['name', 'phone', 'age', 'gender', 'whatsappPhone', 'preferredTrack', 'currentLevel', 'memorizedJuz', 'memorizationDetails', 'bio', 'guardianContact'];
    const submitted = req.body || {};
    if (Object.keys(submitted).some(key => !allowed.includes(key))) return res.status(400).json({ error: 'Invalid fields' });
    const updated = await User.findById(req.user.id).select('+phoneNormalized');
    if (!updated || !updated.isActive || updated.role !== req.user.role) return res.status(403).json({ error: 'Invalid account' });
    if (updated.onboarding?.completed === true) {
      if (
        Object.prototype.hasOwnProperty.call(submitted, 'age')
        && submitted.age !== undefined
        && updated.age !== undefined
        && updated.age !== null
        && Math.trunc(Number(submitted.age)) !== Number(updated.age)
      ) {
        return res.status(403).json({
          code: 'DEMOGRAPHICS_LOCKED',
          error: 'لا يمكن تعديل العمر بعد إكمال إعداد الملف الشخصي إلا عبر التواصل مع الإدارة',
        });
      }
      if (
        Object.prototype.hasOwnProperty.call(submitted, 'gender')
        && submitted.gender !== undefined
        && updated.gender
        && String(submitted.gender) !== String(updated.gender)
      ) {
        return res.status(403).json({
          code: 'DEMOGRAPHICS_LOCKED',
          error: 'لا يمكن تعديل الجنس بعد إكمال إعداد الملف الشخصي إلا عبر التواصل مع الإدارة',
        });
      }
    }
    const previousNormalizedPhone = updated.phoneNormalized || normalizePhone(updated.phone) || '';
    if (submitted.guardianContact !== undefined) {
      if (req.user.role !== 'student' || !submitted.guardianContact || typeof submitted.guardianContact !== 'object' || Array.isArray(submitted.guardianContact)) return res.status(400).json({ error: 'Invalid guardian contact' });
      const contact = submitted.guardianContact;
      if (Object.keys(contact).some(key => !['name', 'phone', 'relationship'].includes(key))) return res.status(400).json({ error: 'Invalid guardian contact fields' });
      const relationship = String(contact.relationship || '').trim();
      if (!['', 'father', 'mother', 'guardian', 'other'].includes(relationship)) return res.status(400).json({ error: 'Invalid guardian relationship' });
      if (contact.phone && !normalizePhone(contact.phone)) return res.status(400).json({ error: 'Invalid guardian phone' });
      updated.guardianContact = { name: String(contact.name || '').trim().slice(0, 100), phone: String(contact.phone || '').trim().slice(0, 32), relationship };
    }
    for (const key of allowed.filter(value => value !== 'guardianContact')) {
      if (Object.prototype.hasOwnProperty.call(submitted, key)) {
        if (['preferredTrack', 'currentLevel', 'memorizedJuz', 'memorizationDetails'].includes(key) && updated.role !== 'student') continue;
        updated[key] = submitted[key];
      }
    }
    if (!updated.name?.trim() || !updated.phone?.trim()) return res.status(400).json({ error: 'Name and phone are required to finish profile' });
    const nextNormalizedPhone = normalizePhone(updated.phone);
    if (!nextNormalizedPhone) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }
    if (updated.role === 'guardian') {
      const duplicateGuardian = await User.findOne({
        _id: { $ne: updated._id },
        role: 'guardian',
        phoneNormalized: nextNormalizedPhone,
        isActive: { $ne: false },
      }).select('_id');
      if (duplicateGuardian) {
        return res.status(409).json({
          error: 'يوجد حساب ولي أمر آخر مسجل بهذا الرقم',
          code: 'GUARDIAN_PHONE_ALREADY_REGISTERED',
        });
      }
    }
    if (updated.role === 'student') {
      const parsedAge = Number(updated.age);
      if (!Number.isFinite(parsedAge) || parsedAge < 4 || parsedAge > 100) {
        return res.status(400).json({ code: 'AGE_REQUIRED', error: 'يرجى تحديد عمر الطالب بشكل صحيح (بين 4 و 100 سنة)' });
      }
      updated.age = Math.trunc(parsedAge);
      if (!['male', 'female'].includes(String(updated.gender || ''))) {
        return res.status(400).json({ code: 'GENDER_REQUIRED', error: 'يرجى تحديد جنس الطالب لإكمال إعداد الملف الشخصي' });
      }
      if (updated.enrollmentSection === 'ladies' && updated.gender === 'male') {
        return res.status(400).json({
          code: 'SECTION_GENDER_MISMATCH',
          error: 'قسم السيدات متاح للطالبات فقط',
        });
      }
    }
    const isMinor = updated.role === 'student' && Number(updated.age) > 0 && Number(updated.age) < 18;
    if (isMinor) {
      updated.guardianLinkCode = undefined;
    }
    if (isMinor && (!updated.guardianContact?.name?.trim() || !updated.guardianContact?.phone?.trim() || !updated.guardianContact?.relationship)) {
      return res.status(400).json({ code: 'GUARDIAN_CONTACT_REQUIRED', error: 'بيانات ولي الأمر مطلوبة للطالب أقل من 18 سنة' });
    }
    if (updated.role === 'student' && updated.guardianContact?.phone?.trim()) {
      const normalizedGuardianPhone = normalizePhone(updated.guardianContact.phone);
      if (normalizedGuardianPhone && normalizedGuardianPhone === nextNormalizedPhone) {
        return res.status(400).json({
          code: 'GUARDIAN_SELF_LINK_FORBIDDEN',
          error: 'لا يمكن استخدام رقم هاتف الطالب نفسه كرقم لولي الأمر',
        });
      }
    }
    updated.phoneNormalized = nextNormalizedPhone;
    if (nextNormalizedPhone !== previousNormalizedPhone) {
      updated.phoneVerified = false;
    }
    updated.set('onboarding.required', true);
    updated.set('onboarding.completed', true);
    await updated.save();
    if (isMinor && updated.guardianContact?.phone?.trim()) {
      await createGuardianInvitation({
        studentId: updated._id,
        guardianPhone: updated.guardianContact.phone,
        relationship: updated.guardianContact.relationship || 'guardian',
        source: 'student-onboarding',
      }).catch((error) => {
        console.warn('Onboarding guardian invitation warning:', error.message);
      });
    }
    return res.json({ user: await presentUser(updated) });
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: safeErrorMessage(error, 400) });
    if (error?.code === 11000) return res.status(409).json({ error: 'رقم الهاتف مستخدم بالفعل في حساب آخر', code: 'GUARDIAN_PHONE_ALREADY_REGISTERED' });
    return res.status(500).json({ error: 'Could not save profile' });
  }
});

router.patch('/learning-track', verifyAccessToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const allowed = ['memorization', 'tajweed_ijazah', 'kids_foundation'];
    const { track } = req.body || {};
    if (!allowed.includes(track)) return res.status(400).json({ error: 'Invalid learning track' });
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account unavailable' });
    if (!user.name?.trim() || !user.phone?.trim() || (user.onboarding?.required && !user.onboarding.completed))
      return res.status(403).json({ code: 'PROFILE_INCOMPLETE', error: 'Complete your profile before choosing a track' });
    user.preferredTrack = track;
    user.set('onboarding.trackSelected', true);
    await user.save();
    return res.json({ user: await presentUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Could not save selected learning track' });
  }
});

router.post('/change-password', verifyAccessToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ 
        error: 'Current and new password are required' 
      });
    }

    if (currentPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (newPassword.length < 8 || newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ 
        error: `New password must be between 8 and ${MAX_PASSWORD_LENGTH} characters` 
      });
    }

    const user = await User.findById(req.user.id).select('+password +refreshTokenVersion +failedLoginAttempts +lockUntil');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const lockExpired = Boolean(user.lockUntil && new Date(user.lockUntil).getTime() <= Date.now());
    if (user.lockUntil && !lockExpired) {
      const retryAfterSeconds = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed password attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED',
        retryAfterSeconds,
      });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      if (!isMockMode || isDBConnected()) {
        await recordFailedPasswordAttempt(user, lockExpired);
      }
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    user.password = newPassword;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.sessionsRevokedAt = new Date();
    user.refreshTokenVersion = Number(user.refreshTokenVersion || 0) + 1;
    await user.save();

    clearRefreshCookie(res);
    res.json({ 
      message: 'Password changed successfully. Please sign in again.' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Failed to change password' 
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const emailStatus = getEmailProviderStatus();

    if (process.env.NODE_ENV === 'production' && !emailStatus.configured) {
      return res.status(503).json({
        error: 'Password reset email service is temporarily unavailable'
      });
    }

    if (!email || typeof email !== 'string' || email.trim().length > 254) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const existingQuota = passwordResetQuotaFallback.get(normalizedEmail);
    if (existingQuota && now - existingQuota.windowStart < 60 * 60 * 1000) {
      if (now - existingQuota.lastSentAt < PASSWORD_RESET_COOLDOWN_MS || existingQuota.count >= PASSWORD_RESET_HOURLY_CAP) {
        return res.json({
          message: 'If your email is registered, you will receive a password reset link',
        });
      }
      passwordResetQuotaFallback.set(normalizedEmail, {
        windowStart: existingQuota.windowStart,
        lastSentAt: now,
        count: existingQuota.count + 1,
      });
    } else {
      if (passwordResetQuotaFallback.size > 5000) passwordResetQuotaFallback.clear();
      passwordResetQuotaFallback.set(normalizedEmail, { windowStart: now, lastSentAt: now, count: 1 });
    }

    if (hasRealMongoDriver()) {
      const windowCutoff = new Date(now - 60 * 60 * 1000);
      const cooldownCutoff = new Date(now - PASSWORD_RESET_COOLDOWN_MS);
      const dbQuota = await VerificationLedger.findOne({ kind: 'password_reset_quota', key: normalizedEmail }).lean();
      if (dbQuota && dbQuota.windowStart && new Date(dbQuota.windowStart).getTime() > windowCutoff.getTime()) {
        if (
          (dbQuota.lastSentAt && new Date(dbQuota.lastSentAt).getTime() > cooldownCutoff.getTime())
          || Number(dbQuota.count || 0) >= PASSWORD_RESET_HOURLY_CAP
        ) {
          return res.json({
            message: 'If your email is registered, you will receive a password reset link',
          });
        }
        await VerificationLedger.updateOne(
          { kind: 'password_reset_quota', key: normalizedEmail },
          { $inc: { count: 1 }, $set: { lastSentAt: new Date(now) } }
        ).catch(() => {});
      } else {
        await VerificationLedger.findOneAndUpdate(
          { kind: 'password_reset_quota', key: normalizedEmail },
          {
            $set: {
              windowStart: new Date(now),
              lastSentAt: new Date(now),
              count: 1,
              expiresAt: new Date(now + 60 * 60 * 1000),
            },
          },
          { upsert: true }
        ).catch(() => {});
      }
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordResetExpires');
    
    if (!user) {
      return res.json({ 
        message: 'If your email is registered, you will receive a password reset link' 
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const frontendUrl = String(
      process.env.FRONTEND_URL || 'https://wahywanamaa.com'
    ).replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const delivery = await sendEmail({
      to: user.email,
      subject: 'استعادة كلمة المرور — وَحْيٌ وَنَمَاء',
      text: `استخدم الرابط التالي لإعادة تعيين كلمة المرور: ${resetUrl}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
          <h2>استعادة كلمة المرور</h2>
          <p>وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في أكاديمية وَحْيٌ وَنَمَاء.</p>
          <p><a href="${resetUrl}">اضغط هنا لإعادة تعيين كلمة المرور</a></p>
          <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        </div>
      `,
    });

    if (!delivery?.sent) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save().catch(() => {});
      if (process.env.NODE_ENV === 'production') {
        logger.error('Password reset email delivery failed', { email: normalizedEmail });
        return res.json({
          message: 'If your email is registered, you will receive a password reset link',
        });
      }
      return res.status(503).json({
        error: 'Password reset email delivery failed. Please try again later.',
        code: 'EMAIL_DELIVERY_FAILED',
      });
    }

    res.json({ 
      message: 'If your email is registered, you will receive a password reset link',
      ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process request' 
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || typeof token !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }

    if (token.length > 256) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (newPassword.length < 8 || newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ 
        error: `Password must be between 8 and ${MAX_PASSWORD_LENGTH} characters` 
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires +refreshTokenVersion');

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.sessionsRevokedAt = new Date();
    user.refreshTokenVersion = Number(user.refreshTokenVersion || 0) + 1;
    await user.save();

    clearRefreshCookie(res);
    res.json({ 
      message: 'Password reset successful. Please sign in again.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password' 
    });
  }
});

// 027: Revoke all active refresh sessions across all devices
router.post('/logout-all', verifyAccessToken, async (req, res) => {
  clearRefreshCookie(res);
  try {
    const revokedAt = new Date();
    if (isMockMode && !isDBConnected()) {
      const user = findMockUserById(req.user.id);
      if (user) {
        updateMockUser(user._id || user.id, {
          refreshTokenVersion: Number(user.refreshTokenVersion || 0) + 1,
          sessionsRevokedAt: revokedAt,
        });
      }
      return res.json({ message: 'All active sessions have been revoked', sessionsRevokedAt: revokedAt });
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: { refreshTokenVersion: 1 },
        $set: { sessionsRevokedAt: revokedAt },
      },
      { new: true }
    ).select('+refreshTokenVersion +sessionsRevokedAt');

    return res.json({
      message: 'All active sessions have been revoked',
      refreshTokenVersion: Number(updated?.refreshTokenVersion || 0),
      sessionsRevokedAt: updated?.sessionsRevokedAt || revokedAt,
    });
  } catch (error) {
    console.error('Logout-all error:', error);
    return res.status(500).json({ error: 'Failed to revoke active sessions' });
  }
});

// 027: Inspect active session security status
router.get('/sessions', verifyAccessToken, async (req, res) => {
  try {
    const user = isMockMode && !isDBConnected()
      ? findMockUserById(req.user.id)
      : await User.findById(req.user.id).select('+refreshTokenVersion +sessionsRevokedAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      session: {
        userId: String(user._id || user.id),
        role: user.role,
        lastLogin: user.lastLogin || null,
        sessionsRevokedAt: user.sessionsRevokedAt || null,
        refreshTokenVersion: Number(user.refreshTokenVersion || 0),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load session details' });
  }
});

// 042 & 044: Privacy data portability export (GDPR / PDPL right of access)
router.get('/privacy/export', verifyAccessToken, async (req, res) => {
  try {
    const user = isMockMode && !isDBConnected()
      ? findMockUserById(req.user.id)
      : await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const presented = await presentUser(user);
    return res.json({
      exportedAt: new Date().toISOString(),
      schemaVersion: '1.0',
      account: presented,
      privacyConsent: user.privacyConsent || {
        termsAcceptedAt: user.createdAt || null,
        parentalConsentVerified: Boolean(Number(user.age) > 0 && Number(user.age) < 18 && user.guardian),
        parentalConsentAt: null,
        deletionRequestedAt: null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to export personal data' });
  }
});

// 042 & 044: Account deletion / erasure request (GDPR / PDPL right to erasure)
router.post('/privacy/delete-request', verifyAccessToken, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    const deactivateImmediately = Boolean(req.body?.deactivateImmediately);
    const requestedAt = new Date();

    if (isMockMode && !isDBConnected()) {
      const user = findMockUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (deactivateImmediately && user.role === 'admin') {
        const otherAdmins = getMockUsers().filter((candidate) => (
          candidate.role === 'admin'
          && candidate.isActive !== false
          && String(candidate._id || candidate.id) !== String(user._id || user.id)
        ));
        if (otherAdmins.length === 0) {
          return res.status(409).json({
            error: 'Cannot deactivate the sole active administrator account',
            code: 'LAST_ADMIN_CANNOT_DEACTIVATE',
          });
        }
      }
      updateMockUser(user._id || user.id, {
        privacyConsent: {
          ...(user.privacyConsent || {}),
          deletionRequestedAt: requestedAt,
          deletionReason: reason,
        },
        ...(deactivateImmediately ? { isActive: false, refreshTokenVersion: Number(user.refreshTokenVersion || 0) + 1 } : {}),
      });
      if (deactivateImmediately) clearRefreshCookie(res);
      return res.status(202).json({
        message: 'Account deletion request recorded',
        deletionRequestedAt: requestedAt,
        deactivated: deactivateImmediately,
      });
    }

    if (deactivateImmediately && req.user.role === 'admin') {
      const remainingActiveAdmins = await User.countDocuments({
        role: 'admin',
        isActive: { $ne: false },
        _id: { $ne: req.user.id },
      });
      if (remainingActiveAdmins === 0) {
        return res.status(409).json({
          error: 'Cannot deactivate the sole active administrator account',
          code: 'LAST_ADMIN_CANNOT_DEACTIVATE',
        });
      }
    }

    const updateDoc = {
      $set: {
        'privacyConsent.deletionRequestedAt': requestedAt,
        'privacyConsent.deletionReason': reason,
        ...(deactivateImmediately ? { isActive: false, sessionsRevokedAt: requestedAt } : {}),
      },
      ...(deactivateImmediately ? { $inc: { refreshTokenVersion: 1 } } : {}),
    };

    const updated = await User.findByIdAndUpdate(req.user.id, updateDoc, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (deactivateImmediately) {
      clearRefreshCookie(res);
    }

    return res.status(202).json({
      message: 'Account deletion request recorded',
      deletionRequestedAt: requestedAt,
      deactivated: deactivateImmediately,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit account deletion request' });
  }
});

module.exports = router;
