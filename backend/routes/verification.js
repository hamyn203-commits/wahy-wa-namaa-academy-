const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const VerificationCode = require('../models/VerificationCode');
const { sendEmail } = require('../services/notificationDispatcher');

const OTP_MSG = (code) => `رمز التحقق — أكاديمية وَحْيٌ وَنَمَاء: ${code}\nصالح 10 دقائق.`;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/;
const EMAIL_SEND_COOLDOWN_MS = 45 * 1000;
const EMAIL_HOURLY_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_HOURLY_CAP = 6;
const emailSendLedger = new Map();
const consumedVerificationTokens = new Map();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashVerificationCode(email, code) {
  return crypto.createHash('sha256').update(`${normalizeEmail(email)}:${String(code).trim()}`).digest('hex');
}

function timingSafeCodeMatch(verification, email, candidateCode) {
  const expectedHex = verification?.codeHash
    ? String(verification.codeHash)
    : hashVerificationCode(email, verification?.code || '');
  const candidateHex = hashVerificationCode(email, candidateCode);
  const left = Buffer.from(expectedHex, 'hex');
  const right = Buffer.from(candidateHex, 'hex');
  return left.length === 32 && right.length === 32 && crypto.timingSafeEqual(left, right);
}

function checkEmailSendQuota(email) {
  const now = Date.now();
  if (emailSendLedger.size > 5000) {
    for (const [k, v] of emailSendLedger.entries()) {
      if (now - v.windowStart > EMAIL_HOURLY_WINDOW_MS) emailSendLedger.delete(k);
    }
  }
  const entry = emailSendLedger.get(email);
  if (!entry || now - entry.windowStart > EMAIL_HOURLY_WINDOW_MS) {
    return { allowed: true, nextEntry: { windowStart: now, lastSentAt: now, count: 1 } };
  }
  if (now - entry.lastSentAt < EMAIL_SEND_COOLDOWN_MS) {
    return { allowed: false, reason: 'Please wait before requesting another verification code' };
  }
  if (entry.count >= EMAIL_HOURLY_CAP) {
    return { allowed: false, reason: 'Hourly verification code limit reached for this email' };
  }
  return {
    allowed: true,
    nextEntry: { windowStart: entry.windowStart, lastSentAt: now, count: entry.count + 1 },
  };
}

function consumeVerificationTokenJti(jti, expSeconds) {
  if (!jti) return true;
  const now = Date.now();
  if (consumedVerificationTokens.size > 5000) {
    for (const [k, expiresAt] of consumedVerificationTokens.entries()) {
      if (expiresAt <= now) consumedVerificationTokens.delete(k);
    }
  }
  const existingExp = consumedVerificationTokens.get(jti);
  if (existingExp && existingExp > now) {
    return false;
  }
  const ttlMs = expSeconds ? Math.max(1000, expSeconds * 1000 - now) : 30 * 60 * 1000;
  consumedVerificationTokens.set(jti, now + ttlMs);
  return true;
}

router.post('/send-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const quota = checkEmailSendQuota(email);
    if (!quota.allowed) {
      return res.status(429).json({ error: quota.reason, code: 'OTP_COOLDOWN_ACTIVE' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(email, code);

    await VerificationCode.deleteMany({ email });
    await VerificationCode.create({
      email,
      codeHash,
      method: 'email',
      expires: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    });

    let result;
    try {
      result = await sendEmail({
        to: email,
        subject: 'رمز التحقق — أكاديمية وحي ونماء',
        text: OTP_MSG(code),
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
          <h2>أكاديمية وحي ونماء</h2>
          <p>رمز التحقق الخاص بتسجيل المعلم:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
          <p>الرمز صالح لمدة 10 دقائق.</p>
          <p>إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
        </div>`,
      });
    } catch (deliveryError) {
      await VerificationCode.deleteMany({ email }).catch(() => {});
      console.error('Verification email delivery error:', deliveryError?.message || 'unknown error');
      return res.status(503).json({
        error: 'Email verification is temporarily unavailable',
        code: 'EMAIL_DELIVERY_FAILED',
      });
    }

    if (!result?.sent) {
      await VerificationCode.deleteMany({ email });
      return res.status(503).json({
        error: 'Email verification is temporarily unavailable',
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      });
    }

    emailSendLedger.set(email, quota.nextEntry);

    return res.json({
      success: true,
      message: 'Verification code sent by email',
    });
  } catch (error) {
    console.error('Send verification error:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    if (!email || email.length > 254 || !EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Email and a 6-digit code are required' });
    }

    const now = new Date();
    // Atomic increment BEFORE comparing code to close concurrent brute-force TOCTOU race.
    let verification = null;
    if (typeof VerificationCode.findOneAndUpdate === 'function') {
      const query = VerificationCode.findOneAndUpdate(
        { email, method: 'email' },
        { $inc: { attempts: 1 } },
        { sort: { createdAt: -1 }, new: true }
      );
      verification = typeof query?.select === 'function' ? await query.select('+code') : await query;
    } else {
      verification = await VerificationCode.findOne({ email, method: 'email' }).sort({ createdAt: -1 });
      if (verification) verification.attempts = Number(verification.attempts || 0) + 1;
    }

    if (!verification) {
      return res.status(400).json({ error: 'No verification code found for this email' });
    }

    if (now.getTime() > new Date(verification.expires).getTime()) {
      await VerificationCode.deleteOne?.({ _id: verification._id });
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (Number(verification.attempts) > 5) {
      await VerificationCode.deleteOne?.({ _id: verification._id });
      return res.status(429).json({ error: 'Too many attempts. Please request a new code' });
    }

    if (!timingSafeCodeMatch(verification, email, code)) {
      if (Number(verification.attempts) >= 5) {
        await VerificationCode.deleteOne?.({ _id: verification._id });
        return res.status(429).json({ error: 'Too many attempts. Please request a new code' });
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (typeof VerificationCode.findOneAndDelete === 'function') {
      const consumed = await VerificationCode.findOneAndDelete({ _id: verification._id });
      if (!consumed) {
        return res.status(400).json({ error: 'Verification code already used or expired' });
      }
    } else {
      await VerificationCode.deleteOne?.({ _id: verification._id });
    }

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Verification service is not configured' });
    }

    const { getAccessSecret } = require('../middleware/auth');
    const verificationToken = jwt.sign(
      {
        email,
        purpose: 'teacher-email-verification',
        jti: crypto.randomUUID(),
      },
      getAccessSecret(),
      { expiresIn: '30m', algorithm: 'HS256' }
    );

    return res.json({
      success: true,
      message: 'Email verified successfully',
      verificationToken,
    });
  } catch (error) {
    console.error('Verify code error:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.consumeVerificationTokenJti = consumeVerificationTokenJti;
module.exports = router;