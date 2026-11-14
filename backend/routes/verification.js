const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const VerificationCode = require('../models/VerificationCode');
const { sendEmail } = require('../services/notificationDispatcher');

const OTP_MSG = (code) => `رمز التحقق — أكاديمية وَحْيٌ وَنَمَاء: ${code}\nصالح 10 دقائق.`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

router.post('/send-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();

    await VerificationCode.deleteMany({ email });
    await VerificationCode.create({
      email,
      code,
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

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Email and a 6-digit code are required' });
    }

    const verification = await VerificationCode.findOne({ email, method: 'email' }).sort({ createdAt: -1 });
    if (!verification) return res.status(400).json({ error: 'No verification code found for this email' });

    if (Date.now() > verification.expires.getTime()) {
      await VerificationCode.deleteOne({ _id: verification._id });
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (verification.attempts >= 5) {
      await VerificationCode.deleteOne({ _id: verification._id });
      return res.status(429).json({ error: 'Too many attempts. Please request a new code' });
    }

    if (verification.code !== code) {
      const updated = await VerificationCode.findOneAndUpdate(
        { _id: verification._id, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
        { new: true }
      );
      if (!updated || updated.attempts >= 5) {
        await VerificationCode.deleteOne({ _id: verification._id });
        return res.status(429).json({ error: 'Too many attempts. Please request a new code' });
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await VerificationCode.deleteOne({ _id: verification._id });

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Verification service is not configured' });
    }

    const { getAccessSecret } = require('../middleware/auth');
    const verificationToken = jwt.sign(
      { email, purpose: 'teacher-email-verification' },
      getAccessSecret(),
      { expiresIn: '30m' }
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

module.exports = router;