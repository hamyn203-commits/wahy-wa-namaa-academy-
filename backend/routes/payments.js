const { safeErrorMessage } = require('../utils/safeError');
'use strict';

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const router = express.Router();

const Course = require('../models/Course');
const User = require('../models/User');
const Payment = require('../models/Payment');
const StudentSubscription = require('../models/StudentSubscription');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');
const {
  normalizeCurrency,
  toMinorUnits,
} = require('../utils/paymentIntegrity');
const paymob = require('../services/paymob');
const manualPayments = require('../config/manualPayments');
const objectStorage = require('../services/objectStorage');
const { validateMagicBytes, normalizeContentType } = require('../config/uploadPolicy');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
const { hasChildPermission } = require('../utils/guardianSafeguarding');
const { processPaymobWebhook } = require('../services/paymentSettlement');
const { processManualPaymentReview } = require('../services/manualPaymentSettlement');
const { placeSubscription } = require('../services/subscriptionPlacement');
const {
  findStudentTeacherLock,
  isTeacherAllowedForLock,
  teacherLockedResponse,
} = require('../utils/studentTeacherLock');
const { notifyCourseEnrollment, notifyAdmins, notifyUser } = require('../utils/notify');
const { logAdminAction } = require('../services/adminAudit');

const SUPPORTED_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);

function cleanBaseUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('Public payment URLs must use HTTPS');
  return parsed.origin;
}

function paymentPublicConfig() {
  return {
    ...manualPayments.getPublicConfig(),
    paymobAvailable: paymob.isConfigured(),
  };
}

function cleanText(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function normalizeTransferReference(value) {
  const collapsed = String(value || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 160);
  if (!collapsed) return undefined;
  if (collapsed.length < 4) {
    const err = new Error('رقم أو مرجع التحويل قصير جداً (يجب ألا يقل عن 4 أحرف/أرقام)');
    err.code = 'INVALID_TRANSFER_REFERENCE';
    err.status = 400;
    throw err;
  }
  return collapsed;
}

const ALLOWED_PROOF_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

async function verifyAndHashPaymentProof(proofReference, declaredContentType) {
  let result = null;
  try {
    result = await objectStorage.getPrivateObject(proofReference);
  } catch {
    result = null;
  }

  if (!result) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('لم يتم العثور على ملف إثبات الدفع المرفوع');
      err.code = 'INVALID_PAYMENT_PROOF';
      err.status = 400;
      throw err;
    }
    return { proofHash: undefined, detectedContentType: undefined };
  }

  const maxBytes = 10 * 1024 * 1024;
  const hash = crypto.createHash('sha256');
  const headerChunks = [];
  let headerBytes = 0;
  let totalBytes = 0;

  if (result.stream?.pipe && typeof result.stream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of result.stream) {
      const buf = Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        const err = new Error('حجم ملف الإثبات يتجاوز الحد المسموح (10MB)');
        err.code = 'INVALID_PAYMENT_PROOF';
        err.status = 400;
        throw err;
      }
      hash.update(buf);
      if (headerBytes < 64) {
        const slice = buf.subarray(0, 64 - headerBytes);
        headerChunks.push(slice);
        headerBytes += slice.length;
      }
    }
  } else if (result.stream?.getReader) {
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        const err = new Error('حجم ملف الإثبات يتجاوز الحد المسموح (10MB)');
        err.code = 'INVALID_PAYMENT_PROOF';
        err.status = 400;
        throw err;
      }
      hash.update(buf);
      if (headerBytes < 64) {
        const slice = buf.subarray(0, 64 - headerBytes);
        headerChunks.push(slice);
        headerBytes += slice.length;
      }
    }
  } else {
    return { proofHash: undefined, detectedContentType: undefined };
  }

  const headerBuf = Buffer.concat(headerChunks);
  const candidateMime = normalizeContentType(declaredContentType || result.blob?.contentType || '');
  const mimesToCheck = ALLOWED_PROOF_MIMES.has(candidateMime)
    ? [candidateMime]
    : [...ALLOWED_PROOF_MIMES];

  const matchedMime = mimesToCheck.find((mime) => validateMagicBytes(headerBuf, mime).valid);
  if (!matchedMime) {
    const err = new Error('بصمة ملف الإثبات غير مطابقة لصيغة PDF أو صورة PNG/JPEG معتمدة');
    err.code = 'INVALID_PAYMENT_PROOF_SIGNATURE';
    err.status = 400;
    throw err;
  }

  return {
    proofHash: hash.digest('hex'),
    detectedContentType: matchedMime,
  };
}

async function assertManualProofNotReplayed({ proofReference, proofHash, methodId, transferReference }) {
  const orClauses = [{ 'manual.proofReference': proofReference }];
  if (proofHash) {
    orClauses.push({ 'manual.proofHash': proofHash });
  }
  if (transferReference) {
    orClauses.push({
      'manual.method': methodId,
      'manual.transferReference': transferReference,
    });
  }

  const existingReplay = await Payment.findOne({
    provider: 'manual',
    status: { $in: ['pending', 'succeeded'] },
    $or: orClauses,
  }).select('_id status');

  if (existingReplay) {
    const err = new Error('تم استخدام إثبات التحويل أو رقم المرجع هذا مسبقاً في عملية أخرى');
    err.code = 'DUPLICATE_PAYMENT_PROOF';
    err.status = 409;
    throw err;
  }
}

async function streamPrivateProof(reference, res) {
  const pathname = objectStorage.extractPathname(reference);
  if (!objectStorage.isSafeObjectPath(pathname) || !pathname.startsWith('uploads/payment-proof/')) {
    return res.status(404).json({ error: 'Payment proof not found' });
  }

  const driver = objectStorage.getDriver();
  if (
    (driver === 'vercel-blob' && !objectStorage.isVercelBlobReference(reference))
    || (driver !== 'vercel-blob' && objectStorage.isVercelBlobReference(reference))
  ) {
    return res.status(404).json({ error: 'Payment proof not found' });
  }

  const result = await objectStorage.getPrivateObject(reference);
  if (!result) return res.status(404).json({ error: 'Payment proof not found' });

  const normalizedMime = normalizeContentType(result.blob?.contentType || '');
  const safeContentType = ALLOWED_PROOF_MIMES.has(normalizedMime)
    ? normalizedMime
    : 'application/octet-stream';

  res.setHeader('Content-Type', safeContentType);
  if (safeContentType === 'application/octet-stream' || safeContentType === 'application/pdf') {
    res.setHeader('Content-Disposition', 'attachment');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'none'; script-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');

  if (result.stream?.pipe) {
    result.stream.pipe(res);
    return undefined;
  }

  const reader = result.stream?.getReader?.();
  if (!reader) return res.status(500).end();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  return res.end();
}

router.get('/config', (_req, res) => {
  return res.json(paymentPublicConfig());
});

router.post('/course/:slug/checkout', protect, authorize('student'), async (req, res) => {
  let payment = null;

  try {
    if (!paymob.isConfigured()) {
      return res.status(503).json({
        error: 'Online payment is not configured yet',
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      });
    }

    const course = await Course.findOne({
      slug: req.params.slug,
      status: 'published',
    });

    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (Number(course.price || 0) <= 0) {
      return res.status(400).json({
        error: 'This course does not require payment',
        code: 'FREE_COURSE_USE_ENROLLMENT',
      });
    }

    const Enrollment = require('../models/Enrollment');
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id,
      status: { $in: ['active', 'completed'] },
    }).select('_id status');

    if (existingEnrollment) {
      return res.status(409).json({
        error: 'Already enrolled in this course',
        code: 'ALREADY_ENROLLED',
      });
    }

    const user = await User.findById(req.user.id)
      .select('name email phone whatsappPhone');

    if (!user) return res.status(404).json({ error: 'User not found' });

    const phone = String(user.phone || user.whatsappPhone || '').trim();
    if (!phone) {
      return res.status(400).json({
        error: 'A phone number is required before online payment',
        code: 'PAYMENT_PROFILE_INCOMPLETE',
      });
    }

    const currency = normalizeCurrency(course.currency || 'USD');
    const amountMinor = toMinorUnits(course.price, currency);

    const recentWindow = new Date(Date.now() - 30 * 60 * 1000);
    const activePendingCheckout = await Payment.findOne({
      kind: 'course_enrollment',
      provider: 'paymob',
      student: user._id,
      course: course._id,
      status: 'pending',
      createdAt: { $gte: recentWindow },
    }).select('_id');

    if (activePendingCheckout) {
      return res.status(409).json({
        error: 'A payment session is already pending for this course',
        code: 'PAYMENT_ALREADY_PENDING',
        paymentId: String(activePendingCheckout._id),
      });
    }

    payment = await Payment.create({
      kind: 'course_enrollment',
      provider: 'paymob',
      idempotencyKey: `paymob:${crypto.randomUUID()}`,
      student: user._id,
      course: course._id,
      amountMinor,
      currency,
      status: 'created',
    });

    const apiBase = cleanBaseUrl(process.env.API_PUBLIC_URL);
    const frontendBase = cleanBaseUrl(process.env.FRONTEND_URL);
    const locale = SUPPORTED_LOCALES.has(String(req.body?.locale || ''))
      ? String(req.body.locale)
      : 'ar';

    const redirect = new URL(`/${locale}/payment/return`, frontendBase);
    redirect.searchParams.set('payment', String(payment._id));
    redirect.searchParams.set('course', course.slug);

    const { firstName, lastName } = paymob.splitCustomerName(user.name);
    const title = String(course.title?.en || course.title?.ar || course.slug).slice(0, 120);

    const intention = await paymob.createIntention({
      amountMinor,
      currency,
      specialReference: String(payment._id),
      customer: {
        firstName,
        lastName,
        email: user.email,
        phone,
        country: 'EGY',
      },
      items: [{
        name: title,
        amount: amountMinor,
        description: `Wahy Wa Namaa course: ${course.slug}`,
        quantity: 1,
      }],
      notificationUrl: `${apiBase}/api/payments/paymob/webhook`,
      redirectionUrl: redirect.toString(),
    });

    payment.providerReference = intention.id;
    payment.providerOrderId = intention.orderId;
    payment.status = 'pending';
    await payment.save();

    return res.status(201).json({
      paymentId: String(payment._id),
      checkoutUrl: intention.checkoutUrl,
      provider: 'paymob',
    });
  } catch (error) {
    if (payment && payment.status === 'created') {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureCode = error.code || 'PAYMENT_PROVIDER_ERROR';
      await payment.save().catch(() => {});
    }

    if (error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
      return res.status(503).json({ error: safeErrorMessage(error, 503), code: error.code });
    }

    if (error.code === 'PAYMENT_PROVIDER_TIMEOUT' || error.code === 'PAYMENT_PROVIDER_ERROR') {
      return res.status(502).json({
        error: 'Payment provider is temporarily unavailable',
        code: error.code,
      });
    }

    console.error('Paymob checkout creation failed:', error.message);
    return res.status(400).json({
      error: 'Unable to start payment',
      code: 'PAYMENT_CHECKOUT_FAILED',
    });
  }
});

router.post('/course/:slug/manual', protect, authorize('student'), async (req, res) => {
  try {
    if (!manualPayments.isConfigured()) {
      return res.status(503).json({
        error: 'Manual payment is not configured yet',
        code: 'MANUAL_PAYMENT_NOT_CONFIGURED',
      });
    }

    const course = await Course.findOne({
      slug: req.params.slug,
      status: 'published',
    });

    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (Number(course.price || 0) <= 0) {
      return res.status(400).json({
        error: 'This course does not require payment',
        code: 'FREE_COURSE_USE_ENROLLMENT',
      });
    }

    const Enrollment = require('../models/Enrollment');
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id,
      status: { $in: ['active', 'completed'] },
    }).select('_id status');

    if (existingEnrollment) {
      return res.status(409).json({
        error: 'Already enrolled in this course',
        code: 'ALREADY_ENROLLED',
      });
    }

    const existingPending = await Payment.findOne({
      kind: 'course_enrollment',
      provider: 'manual',
      student: req.user.id,
      course: course._id,
      status: 'pending',
    }).select('_id');

    if (existingPending) {
      return res.status(409).json({
        error: 'A transfer is already waiting for review',
        code: 'PAYMENT_REVIEW_PENDING',
        paymentId: String(existingPending._id),
      });
    }

    const method = manualPayments.getMethod(req.body?.method);
    if (!method) {
      return res.status(400).json({
        error: 'Unsupported manual payment method',
        code: 'INVALID_PAYMENT_METHOD',
      });
    }

    const proofReference = cleanText(req.body?.proofReference, 2048);
    if (!proofReference || !objectStorage.isOwnedObjectReference(
      proofReference,
      'payment-proof',
      req.user.id
    )) {
      return res.status(400).json({
        error: 'A valid owned payment proof is required',
        code: 'INVALID_PAYMENT_PROOF',
      });
    }

    const normalizedRef = normalizeTransferReference(req.body?.transferReference);
    const { proofHash, detectedContentType } = await verifyAndHashPaymentProof(
      proofReference,
      req.body?.proofContentType
    );
    await assertManualProofNotReplayed({
      proofReference,
      proofHash,
      methodId: method.id,
      transferReference: normalizedRef,
    });

    const currency = normalizeCurrency(course.currency || 'EGP');
    const amountMinor = toMinorUnits(course.price, currency);

    const payment = await Payment.create({
      kind: 'course_enrollment',
      provider: 'manual',
      idempotencyKey: `manual:${crypto.randomUUID()}`,
      student: req.user.id,
      course: course._id,
      amountMinor,
      currency,
      status: 'pending',
      manual: {
        method: method.id,
        transferReference: normalizedRef,
        proofReference,
        proofHash,
        submittedBy: req.user.id,
        proofFilename: cleanText(req.body?.proofFilename, 180) || undefined,
        proofContentType: detectedContentType || cleanText(req.body?.proofContentType, 100) || undefined,
        proofSize: Number.isFinite(Number(req.body.proofSize))
          ? Math.max(1, Math.min(Number(req.body.proofSize), 10 * 1024 * 1024))
          : undefined,
        submittedAt: new Date(),
      },
    });

    notifyAdmins({
      type: 'payment-received',
      title: { ar: 'إثبات دفع يدوي جديد', en: 'New manual payment proof' },
      message: {
        ar: 'تم رفع إثبات دفع جديد ويحتاج مراجعة وتأكيد وصول المبلغ.',
        en: 'A new manual payment proof was submitted and requires fund verification.',
      },
      data: {
        actionUrl: '/admin/payments',
        metadata: {
          paymentId: String(payment._id),
          courseId: String(course._id),
          amountMinor,
          currency,
        },
      },
      priority: 'high',
    }).catch((error) => {
      console.warn('Admin manual payment notification failed:', error.message);
    });

    return res.status(201).json({
      paymentId: String(payment._id),
      provider: 'manual',
      status: payment.status,
      reviewRequired: true,
    });
  } catch (error) {
    if (error?.code === 'DUPLICATE_PAYMENT_PROOF' || error?.code === 'SUBSCRIPTION_MODIFIED_CONCURRENTLY') {
      const publicMsg = String(error.publicMessage || error.message || 'تم استخدام إثبات التحويل أو رقم المرجع هذا مسبقاً في عملية أخرى');
      return res.status(409).json({ error: publicMsg, code: error.code });
    }
    if (error?.code === 'INVALID_TRANSFER_REFERENCE' || error?.code === 'INVALID_PAYMENT_PROOF' || error?.code === 'INVALID_PAYMENT_PROOF_SIGNATURE') {
      const publicMsg = String(error.publicMessage || error.message || 'بيانات إثبات التحويل غير صالحة');
      return res.status(400).json({ error: publicMsg, code: error.code });
    }
    if (error?.code === 11000) {
      const keyPattern = error?.keyPattern || {};
      if (keyPattern['manual.proofReference'] || keyPattern['manual.proofHash'] || keyPattern['manual.transferReference']) {
        return res.status(409).json({
          error: 'تم استخدام إثبات التحويل أو رقم المرجع هذا مسبقاً في عملية أخرى',
          code: 'DUPLICATE_PAYMENT_PROOF',
        });
      }
      const duplicatePayment = await Payment.findOne({
        kind: 'course_enrollment',
        provider: 'manual',
        student: req.user.id,
        status: 'pending',
      }).select('_id').catch(() => null);
      return res.status(409).json({
        error: 'A transfer is already waiting for review',
        code: 'PAYMENT_REVIEW_PENDING',
        paymentId: duplicatePayment ? String(duplicatePayment._id) : null,
      });
    }
    console.error('Manual payment submission failed:', error.message);
    return res.status(400).json({
      error: 'Unable to submit manual payment',
      code: 'MANUAL_PAYMENT_SUBMISSION_FAILED',
    });
  }
});


router.post('/subscription/:id/manual', protect, authorize('student', 'guardian'), async (req, res) => {
  try {
    if (!manualPayments.isConfigured()) {
      return res.status(503).json({
        error: 'Manual payment is not configured yet',
        code: 'MANUAL_PAYMENT_NOT_CONFIGURED',
      });
    }

    const method = manualPayments.getMethod(req.body?.method);
    if (!method) {
      return res.status(400).json({
        error: 'Unsupported manual payment method',
        code: 'INVALID_PAYMENT_METHOD',
      });
    }

    const actorUserId = String(req.user.id);
    const proofReference = cleanText(req.body?.proofReference, 2048);
    if (!proofReference || !objectStorage.isOwnedObjectReference(
      proofReference,
      'payment-proof',
      req.user.id
    )) {
      return res.status(400).json({
        error: 'A valid owned payment proof is required',
        code: 'INVALID_PAYMENT_PROOF',
      });
    }

    const preferredTeacherId = cleanText(req.body?.preferredTeacherId, 80);
    if (req.user.role === 'guardian') {
      const targetSub = await StudentSubscription.findById(req.params.id).select('student').lean();
      if (!targetSub?.student) {
        return res.status(404).json({ error: 'الاشتراك غير موجود', code: 'SUBSCRIPTION_NOT_FOUND' });
      }
      const guardianDoc = await Guardian.findOne({
        user: req.user.id,
        isActive: { $ne: false },
        'children.student': targetSub.student,
      }).lean();
      const legacyLinked = !guardianDoc && await User.exists({ _id: req.user.id, isActive: { $ne: false }, children: targetSub.student });
      if (!guardianDoc && !legacyLinked) {
        return res.status(403).json({ error: 'غير مصرح بسداد اشتراك هذا الطالب' });
      }
      const studentCheck = await User.findById(targetSub.student).select('age').lean().catch(() => null);
      if (
        guardianDoc
        && Number(studentCheck?.age || 0) >= 18
        && !hasChildPermission(guardianDoc, targetSub.student, 'approveEnrollments')
      ) {
        return res.status(403).json({
          error: 'غير مصرح بإدارة اشتراكات الطالب البالغ بدون صلاحية اعتماد التسجيل',
          code: 'GUARDIAN_PERMISSION_DENIED',
        });
      }
      req.user = { ...req.user, id: String(targetSub.student) };
    }
    const teacher = await Teacher.findOne({
      _id: preferredTeacherId,
      status: 'approved',
      isVerified: true,
    }).select('_id personalInfo');

    if (!teacher) {
      return res.status(400).json({
        error: 'اختر معلمًا متاحًا ومعتمدًا',
        code: 'PREFERRED_TEACHER_INVALID',
      });
    }

    const subscription = await StudentSubscription.findOne({
      _id: req.params.id,
      student: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'الاشتراك غير موجود',
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
    }

    if (subscription.status === 'payment_review') {
      const existingPending = await Payment.findOne({
        kind: 'subscription',
        provider: 'manual',
        student: req.user.id,
        subscription: subscription._id,
        status: 'pending',
      }).select('_id');

      return res.status(409).json({
        error: 'التحويل مرفوع بالفعل وينتظر مراجعة الإدارة',
        code: 'PAYMENT_REVIEW_PENDING',
        paymentId: existingPending ? String(existingPending._id) : null,
      });
    }

    if (subscription.status !== 'pending_payment') {
      return res.status(409).json({
        error: 'هذا الاشتراك لم يعد في مرحلة الدفع',
        code: 'SUBSCRIPTION_PAYMENT_NOT_ALLOWED',
      });
    }

    const teacherLock = await findStudentTeacherLock(req.user.id);
    if (!isTeacherAllowedForLock(teacherLock, teacher._id)) {
      return res.status(409).json(teacherLockedResponse(teacherLock));
    }

    if (
      subscription.renewalOf
      && subscription.preferredTeacher
      && String(subscription.preferredTeacher) !== String(teacher._id)
    ) {
      return res.status(409).json({
        error: 'التجديد مرتبط بنفس المعلم والجروب الحاليين',
        code: 'RENEWAL_TEACHER_LOCKED',
      });
    }

    if (
      subscription.section === 'ladies'
      && teacher.personalInfo?.gender
      && teacher.personalInfo.gender !== 'female'
    ) {
      return res.status(400).json({
        error: 'قسم السيدات متاح مع المعلمات فقط',
        code: 'LADIES_SECTION_TEACHER_MISMATCH',
      });
    }

    const canQueryStudent = mongoose.connection.readyState === 1 || User.findById !== mongoose.Model.findById;
    const studentDoc = canQueryStudent
      ? await User.findById(req.user.id).select('gender age').lean().catch(() => null)
      : null;
    if (studentDoc) {
      assertGenderAndAgeCompatibility({
        student: studentDoc,
        teacher,
        section: subscription.section,
      });
    }

    const transferReference = normalizeTransferReference(req.body?.transferReference);
    const { proofHash, detectedContentType } = await verifyAndHashPaymentProof(
      proofReference,
      req.body?.proofContentType
    );
    await assertManualProofNotReplayed({
      proofReference,
      proofHash,
      methodId: method.id,
      transferReference,
    });

    const existingPending = await Payment.findOne({
      kind: 'subscription',
      provider: 'manual',
      student: req.user.id,
      subscription: subscription._id,
      status: 'pending',
    }).select('_id');

    if (existingPending) {
      return res.status(409).json({
        error: 'التحويل مرفوع بالفعل وينتظر مراجعة الإدارة',
        code: 'PAYMENT_REVIEW_PENDING',
        paymentId: String(existingPending._id),
      });
    }

    const dbSession = await mongoose.startSession();
    let payment;
    try {
      await dbSession.withTransaction(async () => {
        const created = await Payment.create([{
          kind: 'subscription',
          provider: 'manual',
          idempotencyKey: `manual-subscription:${crypto.randomUUID()}`,
          student: req.user.id,
          subscription: subscription._id,
          amountMinor: subscription.totalAmountMinor,
          currency: subscription.currency,
          status: 'pending',
          manual: {
            method: method.id,
            transferReference,
            proofReference,
            proofHash,
            proofFilename: cleanText(req.body?.proofFilename, 180) || undefined,
            proofContentType: detectedContentType || cleanText(req.body?.proofContentType, 100) || undefined,
            proofSize: Number.isFinite(Number(req.body.proofSize))
              ? Math.max(1, Math.min(Number(req.body.proofSize), 10 * 1024 * 1024))
              : undefined,
            submittedBy: actorUserId,
            submittedAt: new Date(),
          },
        }], { session: dbSession });

        payment = created[0];
        const useCasUpdate = StudentSubscription.findOne === mongoose.Model.findOne
          || StudentSubscription.findOneAndUpdate !== mongoose.Model.findOneAndUpdate;
        if (useCasUpdate) {
          const updatedSub = await StudentSubscription.findOneAndUpdate(
            {
              _id: subscription._id,
              student: req.user.id,
              status: 'pending_payment',
              planKey: subscription.planKey,
              section: subscription.section,
              sessionCount: subscription.sessionCount,
              totalAmountMinor: subscription.totalAmountMinor,
              currency: subscription.currency,
            },
            {
              $set: {
                preferredTeacher: teacher._id,
                payment: payment._id,
                status: 'payment_review',
              },
            },
            { new: true, session: dbSession }
          );
          if (!updatedSub) {
            const conflictErr = new Error('تغيرت بيانات الباقة أثناء رفع الإيصال، يرجى إعادة المحاولة');
            conflictErr.publicMessage = conflictErr.message;
            conflictErr.code = 'SUBSCRIPTION_MODIFIED_CONCURRENTLY';
            conflictErr.status = 409;
            throw conflictErr;
          }
        } else {
          subscription.preferredTeacher = teacher._id;
          subscription.payment = payment._id;
          subscription.status = 'payment_review';
          await subscription.save({ session: dbSession });
        }
      });
    } catch (error) {
      if (error?.code === 11000) {
        const keyPattern = error?.keyPattern || {};
        if (keyPattern['manual.proofReference'] || keyPattern['manual.proofHash'] || keyPattern['manual.transferReference']) {
          return res.status(409).json({
            error: 'تم استخدام إثبات التحويل أو رقم المرجع هذا مسبقاً في عملية أخرى',
            code: 'DUPLICATE_PAYMENT_PROOF',
          });
        }
        const duplicatePayment = await Payment.findOne({
          kind: 'subscription',
          provider: 'manual',
          student: req.user.id,
          subscription: subscription._id,
          status: 'pending',
        }).select('_id');

        return res.status(409).json({
          error: 'التحويل مرفوع بالفعل وينتظر مراجعة الإدارة',
          code: 'PAYMENT_REVIEW_PENDING',
          paymentId: duplicatePayment ? String(duplicatePayment._id) : null,
        });
      }
      throw error;
    } finally {
      await dbSession.endSession();
    }

    notifyAdmins({
      type: 'payment-received',
      title: subscription.renewalOf
        ? { ar: 'إثبات دفع تجديد باقة', en: 'Package renewal payment proof' }
        : { ar: 'إثبات دفع اشتراك جديد', en: 'New subscription payment proof' },
      message: subscription.renewalOf
        ? {
            ar: 'طالب رفع إثبات تحويل لتجديد نفس الجروب والمعلم. راجع وصول المبلغ فقط.',
            en: 'A learner submitted proof for renewing the same circle and tutor. Verify the funds.',
          }
        : {
            ar: 'طالب رفع إثبات تحويل لاشتراك واختار المعلم. راجع وصول المبلغ ثم أرسل الطلب للتسكين.',
            en: 'A student submitted a subscription transfer proof and selected a tutor. Verify funds before placement.',
          },
      data: {
        actionUrl: '/admin/payments',
        metadata: {
          paymentId: String(payment._id),
          subscriptionId: String(subscription._id),
          preferredTeacherId: String(teacher._id),
          amountMinor: subscription.totalAmountMinor,
          currency: subscription.currency,
        },
      },
      priority: 'high',
    }).catch((error) => {
      console.warn('Admin subscription payment notification failed:', error.message);
    });

    return res.status(201).json({
      paymentId: String(payment._id),
      subscriptionId: String(subscription._id),
      provider: 'manual',
      status: payment.status,
      subscriptionStatus: 'payment_review',
      reviewRequired: true,
    });
  } catch (error) {
    if (error?.code === 'DUPLICATE_PAYMENT_PROOF' || error?.code === 'SUBSCRIPTION_MODIFIED_CONCURRENTLY') {
      const publicMsg = String(error.publicMessage || error.message || 'تم استخدام إثبات التحويل أو رقم المرجع هذا مسبقاً في عملية أخرى');
      return res.status(409).json({ error: publicMsg, code: error.code });
    }
    if (
      error?.code === 'INVALID_TRANSFER_REFERENCE'
      || error?.code === 'INVALID_PAYMENT_PROOF'
      || error?.code === 'INVALID_PAYMENT_PROOF_SIGNATURE'
      || error?.status === 400
    ) {
      const publicMsg = String(error.publicMessage || error.message || 'بيانات الدفع أو توافق القسم غير صالحة');
      return res.status(400).json({ error: publicMsg, code: error.code || 'INVALID_PAYMENT_REQUEST' });
    }
    console.error('Subscription manual payment submission failed:', error.message);
    return res.status(400).json({
      error: 'تعذر رفع إثبات التحويل حالياً',
      code: 'MANUAL_PAYMENT_SUBMISSION_FAILED',
    });
  }
});

router.get('/admin/manual', protect, authorize('admin'), async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || 'pending').trim().toLowerCase();
    const allowedStatuses = new Set(['pending', 'succeeded', 'failed', 'all']);
    const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'pending';

    const query = {
      provider: 'manual',
      kind: { $in: ['course_enrollment', 'subscription'] },
    };
    if (status !== 'all') query.status = status;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('student', 'name email phone whatsappPhone')
      .populate('course', 'title slug price currency')
      .populate({
        path: 'subscription',
        select: 'planKey section sessionCount sessionsRemaining status preferredTeacher renewalOf circle pricingSnapshot',
        populate: {
          path: 'preferredTeacher',
          select: 'personalInfo user',
          populate: { path: 'user', select: 'name email avatar' },
        },
      })
      .populate('manual.reviewedBy', 'name email')
      .select('+manual.proofReference');

    return res.json({
      payments: payments.map((payment) => ({
        id: String(payment._id),
        kind: payment.kind,
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        provider: payment.provider,
        createdAt: payment.createdAt,
        settledAt: payment.settledAt || null,
        failedAt: payment.failedAt || null,
        student: payment.student,
        course: payment.course,
        subscription: payment.subscription,
        proofAvailable: Boolean(payment.manual?.proofReference),
        manual: {
          method: payment.manual?.method || null,
          transferReference: payment.manual?.transferReference || null,
          submittedAt: payment.manual?.submittedAt || null,
          reviewedAt: payment.manual?.reviewedAt || null,
          reviewedBy: payment.manual?.reviewedBy || null,
          reviewAction: payment.manual?.reviewAction || null,
          reviewNote: payment.manual?.reviewNote || '',
        },
      })),
    });
  } catch (error) {
    console.error('Manual payment admin list failed:', error.message);
    return res.status(400).json({ error: 'Unable to load manual payments' });
  }
});

router.get('/admin/manual/:id/proof', protect, authorize('admin'), async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      provider: 'manual',
    }).select('+manual.proofReference');

    if (!payment?.manual?.proofReference) {
      return res.status(404).json({ error: 'Payment proof not found' });
    }

    return await streamPrivateProof(payment.manual.proofReference, res);
  } catch (error) {
    console.error('Manual payment proof read failed:', error.message);
    return res.status(404).json({ error: 'Payment proof not found' });
  }
});

router.patch('/admin/manual/:id/review', protect, authorize('admin'), async (req, res) => {
  try {
    let result = await processManualPaymentReview({
      paymentId: req.params.id,
      adminId: req.user.id,
      action: req.body?.action,
      note: req.body?.note,
    });

    await logAdminAction({
      req,
      action: result.paymentStatus === 'succeeded' ? 'payment.manual.approved' : 'payment.manual.rejected',
      entityType: 'payment',
      entityId: result.paymentId || req.params.id,
      reason: String(req.body?.note || '').trim() || (result.paymentStatus === 'succeeded' ? 'اعتماد تحويل يدوي' : 'رفض تحويل يدوي'),
      metadata: {
        paymentStatus: result.paymentStatus,
        studentId: result.studentId ? String(result.studentId) : undefined,
        subscriptionId: result.subscriptionId ? String(result.subscriptionId) : undefined,
        courseId: result.courseId ? String(result.courseId) : undefined,
      },
    }).catch(() => {});

    let autoPlacement = null;
    if (
      result?.paymentStatus === 'succeeded'
      && result?.subscriptionId
      && result?.awaitingPlacement
      && result?.renewalCircleId
    ) {
      try {
        autoPlacement = await placeSubscription({
          subscriptionId: result.subscriptionId,
          existingCircleId: result.renewalCircleId,
        });
        result = {
          ...result,
          subscriptionStatus: autoPlacement.subscriptionStatus,
          awaitingPlacement: false,
          autoPlaced: true,
          circleId: autoPlacement.circleId,
        };
      } catch (error) {
        // Keep the approved renewal in the admin placement queue if the old circle
        // is full or no longer compatible.
        console.warn('Renewal auto-placement fallback:', error.code || error.message);
      }
    }

    if (result?.enrollmentCreated && result.studentId && result.courseId) {
      const course = await Course.findById(result.courseId).select('title slug').lean();
      if (course) notifyCourseEnrollment(result.studentId, course).catch(() => {});
    }

    if (result?.subscriptionId && result.studentId) {
      const succeeded = result.paymentStatus === 'succeeded';
      const queuedRenewal = succeeded && result.renewalQueued;
      const placedRenewal = succeeded && (result.autoPlaced || result.renewalActivated);
      const awaitingPlacement = succeeded && result.awaitingPlacement;

      notifyUser(result.studentId, {
        type: 'system',
        title: succeeded
          ? (queuedRenewal
              ? { ar: 'تم اعتماد تجديد الباقة', en: 'Package renewal approved' }
              : { ar: 'تم اعتماد تحويل الاشتراك', en: 'Subscription payment approved' })
          : { ar: 'تعذر اعتماد تحويل الاشتراك', en: 'Subscription payment not approved' },
        message: succeeded
          ? (queuedRenewal
              ? {
                  ar: 'التجديد مدفوع وجاهز. سيبدأ تلقائيًا بعد استخدام آخر حصة في باقتك الحالية.',
                  en: 'Your renewal is paid and ready. It will activate automatically after your current package ends.',
                }
              : placedRenewal
                ? {
                    ar: 'تم اعتماد التجديد وإعادتك تلقائيًا إلى نفس الجروب والمعلم.',
                    en: 'Your renewal was approved and you were restored to the same group and tutor automatically.',
                  }
                : awaitingPlacement
                  ? {
                      ar: 'تم التأكد من وصول المبلغ. طلبك الآن في مرحلة التسكين مع المعلم الذي اخترته.',
                      en: 'Your payment was verified. Your request is now waiting for placement with your selected tutor.',
                    }
                  : {
                      ar: 'تم اعتماد الدفع بنجاح.',
                      en: 'Your payment was approved successfully.',
                    })
          : {
              ar: 'لم يتم اعتماد التحويل. يمكنك مراجعة البيانات ورفع إثبات جديد.',
              en: 'The transfer was not approved. You can review the details and submit a new proof.',
            },
        data: {
          actionUrl: succeeded
            ? '/student/dashboard'
            : `/payment/manual?subscription=${result.subscriptionId}`,
          metadata: {
            subscriptionId: result.subscriptionId,
            paymentId: result.paymentId,
            paymentStatus: result.paymentStatus,
            renewalQueued: Boolean(result.renewalQueued),
            autoPlaced: Boolean(result.autoPlaced),
          },
        },
        priority: 'high',
      }).catch(() => {});
    }

    return res.json({
      ok: true,
      paymentId: result.paymentId,
      status: result.paymentStatus,
      enrollmentCreated: result.enrollmentCreated,
      enrollmentId: result.enrollmentId,
      subscriptionId: result.subscriptionId || null,
      awaitingPlacement: Boolean(result.awaitingPlacement),
      renewalQueued: Boolean(result.renewalQueued),
      autoPlaced: Boolean(result.autoPlaced),
      renewalActivated: Boolean(result.renewalActivated),
      circleId: result.circleId || null,
    });
  } catch (error) {
    if (error.code === 'PAYMENT_NOT_FOUND') {
      return res.status(404).json({ error: safeErrorMessage(error, 404), code: error.code });
    }
    if (
      error.code === 'PAYMENT_ALREADY_REVIEWED'
      || error.code === 'ALREADY_ENROLLED'
      || error.code === 'PAYMENT_AMOUNT_MISMATCH'
      || error.code === 'PAYMENT_CURRENCY_MISMATCH'
      || error.code === 'SUBSCRIPTION_NOT_IN_REVIEW'
      || error.code === 'COURSE_UNAVAILABLE'
    ) {
      return res.status(409).json({ error: safeErrorMessage(error, 409), code: error.code });
    }
    if (error.code === 'INVALID_REVIEW_ACTION') {
      return res.status(400).json({ error: safeErrorMessage(error, 400), code: error.code });
    }

    console.error('Manual payment review failed:', error.message);
    return res.status(400).json({
      error: 'Unable to review manual payment',
      code: error.code || 'MANUAL_PAYMENT_REVIEW_FAILED',
    });
  }
});

router.post('/paymob/webhook', async (req, res) => {
  try {
    if (!paymob.isConfigured()) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const obj = req.body?.obj;
    const receivedHmac = String(req.query?.hmac || '');

    if (!obj || !paymob.verifyTransactionPostHmac(obj, receivedHmac)) {
      return res.status(401).json({
        error: 'Invalid payment callback signature',
        code: 'INVALID_PAYMENT_HMAC',
      });
    }

    const rawBuffer = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body || {}));
    const payloadHash = crypto
      .createHash('sha256')
      .update(rawBuffer)
      .digest('hex');

    const merchantReference = String(obj.order?.merchant_order_id || '');
    const classification = paymob.classifyTransaction(obj);
    const baseTxId = String(obj.id);
    const lifecycleSuffix = obj.is_refunded === true
      ? ':refunded'
      : obj.is_voided === true
        ? ':voided'
        : classification === 'succeeded'
          ? ''
          : `:${classification}`;

    const result = await processPaymobWebhook({
      eventId: `${baseTxId}${lifecycleSuffix}`,
      eventType: String(req.body?.type || 'TRANSACTION'),
      payloadHash,
      merchantReference,
      providerOrderId: String(obj.order?.id || ''),
      amountMinor: Number(obj.amount_cents),
      currency: String(obj.currency || '').toUpperCase(),
      classification,
      transactionId: baseTxId,
    });

    if (result?.enrollmentCreated && result.studentId && result.courseId) {
      const course = await Course.findById(result.courseId).select('title slug').lean();
      if (course) {
        notifyCourseEnrollment(result.studentId, course).catch(() => {});
      }
    }

    return res.status(200).json({
      received: true,
      processed: Boolean(result?.processed),
      duplicate: Boolean(result?.duplicate),
    });
  } catch (error) {
    console.error('Paymob webhook persistence failed:', error.message);
    return res.status(503).json({
      error: 'Payment callback persistence failed',
      code: 'PAYMENT_WEBHOOK_PERSISTENCE_FAILED',
    });
  }
});

router.get('/:id/status', protect, authorize('student', 'guardian', 'admin'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('course', 'slug title')
      .populate('subscription', 'planKey section sessionCount status preferredTeacher pricingSnapshot')
      .select('kind provider student course subscription amountMinor currency status manual createdAt updatedAt settledAt failedAt cancelledAt refundedAt');

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    let isAllowed = req.user.role === 'admin'
      || String(payment.student || '') === String(req.user.id)
      || String(payment.manual?.submittedBy || '') === String(req.user.id);

    if (!isAllowed && req.user.role === 'guardian' && payment.student) {
      const linked = await Guardian.exists({ user: req.user.id, isActive: { $ne: false }, 'children.student': payment.student })
        || await User.exists({ _id: req.user.id, isActive: { $ne: false }, children: payment.student });
      isAllowed = Boolean(linked);
    }

    if (!isAllowed) {
      return res.status(403).json({ error: 'Not authorized to view this payment' });
    }

    return res.json({
      payment: {
        id: String(payment._id),
        kind: payment.kind,
        provider: payment.provider,
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        course: payment.course ? {
          id: String(payment.course._id),
          slug: payment.course.slug,
          title: payment.course.title,
        } : null,
        subscription: payment.subscription || null,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        settledAt: payment.settledAt || null,
        manualReview: payment.provider === 'manual' ? {
          method: payment.manual?.method || null,
          submittedAt: payment.manual?.submittedAt || null,
          reviewedAt: payment.manual?.reviewedAt || null,
          reviewAction: payment.manual?.reviewAction || null,
          reviewNote: payment.manual?.reviewNote || '',
        } : null,
      },
    });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to read payment status' });
  }
});

module.exports = router;
