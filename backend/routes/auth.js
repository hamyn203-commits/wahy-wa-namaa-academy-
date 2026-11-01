const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Guardian = require('../models/Guardian');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyAccessToken, 
  verifyRefreshToken,
  readRefreshTokenIfValid,
  requireRole 
} = require('../middleware/auth');
const { addMockUser, findMockUserByEmail, findMockUserById, updateMockUser } = require('../mockStore');
const { sendEmail } = require('../services/notificationDispatcher');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const { normalizePhone } = require('../utils/phone');
const { isSection } = require('../config/subscriptionPlans');
const storage = require('../services/objectStorage');
const { createGuardianInvitation } = require('../services/guardianInvitations');

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

const REFRESH_COOKIE = 'wn_refresh';
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const LOCKOUT_DURATION_MS = Number(process.env.LOCKOUT_DURATION_MS || 15 * 60 * 1000);
const REFRESH_COOKIE_MAX_AGE_SECONDS = Number(
  process.env.REFRESH_COOKIE_MAX_AGE_SECONDS || 7 * 24 * 60 * 60
);

function setRefreshCookie(res, refreshToken) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.REFRESH_COOKIE_SAMESITE || 'Lax';
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/api/auth; HttpOnly; SameSite=${sameSite}; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}${secure}`
  );
}

function clearRefreshCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.REFRESH_COOKIE_SAMESITE || 'Lax';
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE}=; Path=/api/auth; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`
  );
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
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.__v;
  return obj;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, guardianPhone, guardianRelationship, whatsappPhone, age, gender, currentLevel, preferredTrack, memorizedJuz, memorizationDetails, customLevel, enrollmentSection } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const allowedRoles = ['student', 'guardian'];

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ 
        error: 'Name, email, and password are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters' 
      });
    }

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'This role cannot be self-registered' });
    }
    const assignedRole = role || 'student';
    // A guardian may manage children from both divisions, so do not bind guardians.
    if (assignedRole === 'student' && enrollmentSection !== undefined && !isSection(enrollmentSection)) {
      return res.status(400).json({ error: 'القسم التعليمي المختار غير صحيح', code: 'ENROLLMENT_SECTION_INVALID' });
    }
    const normalizedPhone = normalizePhone(phone);

    if (assignedRole === 'guardian' && !normalizedPhone) {
      return res.status(400).json({ error: 'رقم هاتف ولي الأمر مطلوب لإنشاء الحساب' });
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
        name,
        email: normalizedEmail,
        password,
        phone,
        phoneNormalized: normalizedPhone || undefined,
        role: assignedRole,
        ...(assignedRole === 'student' ? {
          whatsappPhone: String(whatsappPhone || '').trim(),
          ...(age ? { age: Number(age) } : {}),
          ...(gender ? { gender } : {}),
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

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      setRefreshCookie(res, refreshToken);

      user.lastLogin = new Date();
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      res.status(201).json({
        message: 'Registration successful',
        user: await presentUser(user),
        accessToken
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
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      message: 'Registration successful',
      user: await presentUser(user),
      accessToken
    });
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.message 
      });
    }

    res.status(500).json({ 
      error: 'Registration failed' 
    });
  }
});

// Google Identity Services (OpenID Connect). Only student accounts may use self-service Google login.
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
    const requestedRole = ['student', 'guardian', 'teacher'].includes(req.body?.role) ? req.body.role : 'student';
    const enrollmentSection = req.body?.enrollmentSection;
    if (requestedRole === 'student' && req.body?.context === 'signup' && enrollmentSection !== undefined && !isSection(enrollmentSection)) {
      return res.status(400).json({ error: 'القسم التعليمي المختار غير صحيح', code: 'ENROLLMENT_SECTION_INVALID' });
    }
    let user = await User.findOne({ googleSubject: identity.sub }).select('+googleSubject +refreshTokenVersion');

    if (!user) {
      const existing = await User.findOne({ email: identity.email })
        .select('+googleSubject +refreshTokenVersion');
      if (existing) {
        if (!['student', 'guardian', 'teacher'].includes(existing.role)) {
          return res.status(403).json({ error: 'Use the account login method for this role' });
        }
        // An existing non-Gmail address must be linked from an authenticated session.
        // Google is authoritative for Gmail addresses it operates.
        if (!/^[^@]+@(gmail\.com|googlemail\.com)$/.test(identity.email)) {
          return res.status(409).json({ error: 'Sign in with your existing password to link this address' });
        }
        if (existing.googleSubject && existing.googleSubject !== identity.sub) {
          return res.status(409).json({ error: 'This account is linked to another Google identity' });
        }
        existing.googleSubject = identity.sub;
        existing.emailVerified = true;
        await existing.save();
        user = existing;
      } else {
        user = await User.create({
          name: identity.name.length >= 2 ? identity.name : 'طالب الأكاديمية',
          email: identity.email,
          password: require('crypto').randomBytes(48).toString('base64url'),
          googleSubject: identity.sub,
          role: requestedRole,
          ...(requestedRole === 'student' && req.body?.context === 'signup' && enrollmentSection ? { enrollmentSection } : {}),
          onboarding: { required: true, completed: false },
          emailVerified: true,
          avatar: identity.picture,
        });
      }
    }
    if (!['student', 'guardian', 'teacher'].includes(user.role) || user.isActive === false) {
      return res.status(403).json({ error: 'Account is not eligible for Google sign-in' });
    }
    if (user.role === 'guardian') {
      await Guardian.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, children: [] } }, { upsert: true });
    }
    user.lastLogin = new Date();
    await user.save();
    setRefreshCookie(res, generateRefreshToken(user));
    return res.json({
      accessToken: generateAccessToken(user),
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    const user = isMockMode && !isDBConnected()
      ? findMockUserByEmail(email)
      : await User.findOne({ email: email.toLowerCase() }).select('+password +refreshTokenVersion +phoneNormalized +failedLoginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
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
        const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;
        user.failedLoginAttempts = nextAttempts;
        if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }
        await user.save().catch(() => {});
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
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    if (!isMockMode || isDBConnected()) {
      user.lastLogin = new Date();
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      if (user.phone) {
        user.phoneNormalized = normalizePhone(user.phone) || undefined;
      }
      await user.save();
    } else {
      updateMockUser(user._id || user.id, { lastLogin: new Date() });
    }

    res.json({
      message: 'Login successful',
      user: await presentUser(user),
      accessToken
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
      : await User.findById(req.refreshToken.id).select('+refreshTokenVersion');
    
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({ 
        error: 'User not found or deactivated' 
      });
    }

    const expectedVersion = Number(user.refreshTokenVersion || 0);
    const tokenVersion = Number(req.refreshToken.v || 0);
    if (tokenVersion !== expectedVersion) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh session has been revoked' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed' 
    });
  }
});

router.post('/logout', readRefreshTokenIfValid, async (req, res) => {
  clearRefreshCookie(res);

  try {
    if (req.refreshToken?.id) {
      if (isMockMode && !isDBConnected()) {
        const user = findMockUserById(req.refreshToken.id);
        if (user) {
          updateMockUser(user._id || user.id, {
            refreshTokenVersion: Number(user.refreshTokenVersion || 0) + 1,
          });
        }
      } else {
        await User.findByIdAndUpdate(req.refreshToken.id, {
          $inc: { refreshTokenVersion: 1 },
        });
      }
    }
  } catch (error) {
    console.warn('Logout token revocation warning:', error.message);
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
    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return res.status(400).json({ 
        error: 'Invalid update fields' 
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar') && req.user.role === 'student') {
      const value = String(req.body.avatar || '');
      if (value && (!storage.referenceMatches(value, 'student-avatar', req.user.id) ||
          (storage.getDriver() === 'vercel-blob' && !storage.isVercelBlobReference(value)))) {
        return res.status(400).json({ error: 'Invalid student avatar reference' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar') && req.user.role !== 'student') {
      const value = String(req.body.avatar || '');
      if (value && !storage.referenceMatches(value, 'teacher-public', req.user.id) && !storage.referenceMatches(value, 'student-avatar', req.user.id)) {
        return res.status(400).json({ error: 'Invalid avatar reference' });
      }
    }
    if (typeof req.body.name === 'string') req.body.name = req.body.name.trim().slice(0, 100);
    if (typeof req.body.bio === 'string') req.body.bio = req.body.bio.trim().slice(0, 1000);
    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      req.body.phone = String(req.body.phone || '').trim().slice(0, 32);
      req.body.phoneNormalized = normalizePhone(req.body.phone) || undefined;
    }

    let user;
    if (isMockMode && !isDBConnected()) {
      user = updateMockUser(req.user.id, req.body);
    } else {
      user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: req.body },
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
    const updated = await User.findById(req.user.id);
    if (!updated || !updated.isActive || updated.role !== req.user.role) return res.status(403).json({ error: 'Invalid account' });
    if (submitted.guardianContact !== undefined) {
      if (req.user.role !== 'student' || !submitted.guardianContact || typeof submitted.guardianContact !== 'object' || Array.isArray(submitted.guardianContact)) return res.status(400).json({ error: 'Invalid guardian contact' });
      const contact = submitted.guardianContact;
      if (Object.keys(contact).some(key => !['name', 'phone', 'relationship'].includes(key))) return res.status(400).json({ error: 'Invalid guardian contact fields' });
      const relationship = String(contact.relationship || '').trim();
      if (!['', 'father', 'mother', 'guardian', 'other'].includes(relationship)) return res.status(400).json({ error: 'Invalid guardian relationship' });
      if (contact.phone && !normalizePhone(contact.phone)) return res.status(400).json({ error: 'Invalid guardian phone' });
      updated.guardianContact = { name: String(contact.name || '').trim(), phone: String(contact.phone || '').trim(), relationship };
    }
    for (const key of allowed.filter(value => value !== 'guardianContact')) {
      if (Object.prototype.hasOwnProperty.call(submitted, key)) {
        if (['preferredTrack', 'currentLevel', 'memorizedJuz', 'memorizationDetails'].includes(key) && updated.role !== 'student') continue;
        updated[key] = submitted[key];
      }
    }
    if (!updated.name?.trim() || !updated.phone?.trim()) return res.status(400).json({ error: 'Name and phone are required to finish profile' });
    const isMinor = updated.role === 'student' && Number(updated.age) > 0 && Number(updated.age) < 18;
    if (isMinor && (!updated.guardianContact?.name?.trim() || !updated.guardianContact?.phone?.trim() || !updated.guardianContact?.relationship)) {
      return res.status(400).json({ code: 'GUARDIAN_CONTACT_REQUIRED', error: 'بيانات ولي الأمر مطلوبة للطالب أقل من 18 سنة' });
    }
    updated.phoneNormalized = normalizePhone(updated.phone) || undefined;
    if (isMinor) {
      updated.set('privacyConsent.parentalConsentVerified', true);
      updated.set('privacyConsent.parentalConsentAt', new Date());
    }
    updated.set('onboarding.required', true);
    updated.set('onboarding.completed', true);
    await updated.save();
    return res.json({ user: await presentUser(updated) });
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
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

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters' 
      });
    }

    const user = await User.findById(req.user.id).select('+password +refreshTokenVersion');

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      if (!isMockMode || isDBConnected()) {
        const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;
        user.failedLoginAttempts = nextAttempts;
        if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }
        await user.save().catch(() => {});
      }
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    user.password = newPassword;
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

    if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
      return res.status(503).json({
        error: 'Password reset email service is temporarily unavailable'
      });
    }

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.json({ 
        message: 'If your email is registered, you will receive a password reset link' 
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const frontendUrl = String(
      process.env.FRONTEND_URL || 'https://wahy-wa-namaa-academy.vercel.app'
    ).replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    if (process.env.RESEND_API_KEY) {
      await sendEmail({
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

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters' 
      });
    }

    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+refreshTokenVersion');

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
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
        parentalConsentVerified: Boolean(Number(user.age) > 0 && Number(user.age) < 18 && user.guardianContact?.phone),
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
