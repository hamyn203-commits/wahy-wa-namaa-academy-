const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const TeacherLedger = require('../models/TeacherLedger');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { SUPPORTED_CURRENCIES } = require('../utils/paymentIntegrity');
const { logAdminAction } = require('../services/adminAudit');
const { notifyUser } = require('../utils/notify');
const { protect, authorize } = require('../middleware/auth');
const {
  MIN_PAYOUT_EGP,
  MIN_PAYOUT_USD,
  toMinor,
  fromMinor,
  validateAndNormalizePayoutInput,
  validateHttpsReceiptUrl,
  calculateTeacherBalance,
  ensureSessionEarning,
  requestTeacherPayout,
  processTeacherPayout,
  listTeacherTransactions,
} = require('../services/teacherFinance');

function createHttpError(status, publicMessage, code) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  if (code) err.code = code;
  return err;
}

async function runWithOptionalMongoTransaction(work) {
  if (typeof mongoose.startSession !== 'function' || mongoose.connection.readyState !== 1) {
    return work(null);
  }
  const dbSession = await mongoose.startSession();
  try {
    let output;
    await dbSession.withTransaction(async () => {
      output = await work(dbSession);
    });
    return output;
  } catch (error) {
    const msg = String(error?.message || '');
    if (
      process.env.NODE_ENV !== 'production'
      && /Transaction numbers are only allowed on a replica set|standalone/i.test(msg)
    ) {
      return work(null);
    }
    throw error;
  } finally {
    await dbSession.endSession();
  }
}

// Constants for academic financial rules (V7.6)
const STUDENT_RATE_EGP = 20; // 20 ج للمصريين لكل طالب في الحلقة
const STUDENT_RATE_USD = 1;  // 1$ للمغتربين لكل طالب في الحلقة
const { isMockMode } = require('../config/runtime');
const shouldUseMockFinance = () => (
  isMockMode
  && mongoose.connection.readyState !== 1
  && process.env.FORCE_REAL_FINANCE_IN_TEST !== 'true'
);

// ==========================================
// 1. GET /api/finance/teacher/balance
// ==========================================
router.get('/teacher/balance', protect, authorize('teacher'), async (req, res) => {
  try {
    if (shouldUseMockFinance()) {
      return res.json({
        success: true,
        balances: {
          EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
          USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
        },
        limits: {
          minPayoutEGP: MIN_PAYOUT_EGP,
          minPayoutUSD: MIN_PAYOUT_USD,
        },
      });
    }

    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) {
      return res.status(404).json({ error: 'لم يتم العثور على ملف المعلم' });
    }

    const balances = await calculateTeacherBalance(teacher._id);

    res.json({
      success: true,
      balances,
      limits: {
        minPayoutEGP: MIN_PAYOUT_EGP,
        minPayoutUSD: MIN_PAYOUT_USD,
      },
    });
  } catch (error) {
    console.error('Teacher balance fetch error:', error);
    res.status(500).json({ error: 'تعذر جلب رصيد المعلم حالياً' });
  }
});

// ==========================================
// 2. GET /api/finance/teacher/transactions
// ==========================================
router.get('/teacher/transactions', protect, authorize('teacher'), async (req, res) => {
  try {
    if (shouldUseMockFinance()) {
      return res.json({
        success: true,
        transactions: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    }

    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) {
      return res.status(404).json({ error: 'لم يتم العثور على ملف المعلم' });
    }

    const result = await listTeacherTransactions(teacher._id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Teacher transactions fetch error:', error);
    res.status(500).json({ error: 'تعذر جلب سجل المعاملات المالية حالياً' });
  }
});

// ==========================================
// 3. POST /api/finance/teacher/request-payout
// ==========================================
router.post('/teacher/request-payout', protect, authorize('teacher'), async (req, res) => {
  try {
    const { amount, currency = 'EGP', payoutMethod, payoutDetails, notes } = req.body || {};
    const validated = validateAndNormalizePayoutInput({
      amount,
      currency,
      payoutMethod,
      payoutDetails,
      notes,
    });

    if (shouldUseMockFinance()) {
      return res.status(201).json({
        success: true,
        message: 'تم تقديم طلب سحب الأرباح بنجاح وجارٍ مراجعته من قِبل الإدارة',
        transaction: {
          _id: `mock-payout-${Date.now()}`,
          type: 'payout',
          amount: validated.numAmount,
          currency: validated.curr,
          payoutMethod: validated.payoutMethod,
          payoutDetails: validated.cleanDetails,
          status: 'pending',
          notes: validated.cleanNotes,
          description: `طلب سحب أرباح بقيمة ${validated.numAmount} ${validated.curr} عبر ${validated.payoutMethod}`,
          createdAt: new Date().toISOString(),
        },
      });
    }

    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) {
      return res.status(404).json({ error: 'لم يتم العثور على ملف المعلم' });
    }

    const transaction = await requestTeacherPayout({
      teacherId: teacher._id,
      amount,
      currency,
      payoutMethod,
      payoutDetails,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'تم تقديم طلب سحب الأرباح بنجاح وجارٍ مراجعته من قِبل الإدارة',
      transaction,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'لديك طلب سحب قيد المراجعة بالفعل لهذه العملة',
        code: 'PAYOUT_ALREADY_PENDING',
      });
    }
    const status = error?.status || 400;
    const message = error?.publicMessage || 'تعذر تقديم طلب السحب حالياً';
    res.status(status).json({
      error: message,
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

// ==========================================
// 4. GET /api/finance/admin/overview
// ==========================================
router.get('/admin/overview', protect, authorize('admin'), async (req, res) => {
  try {
    if (shouldUseMockFinance()) {
      return res.json({
        success: true,
        rates: {
          egyptianStudentSessionRateEGP: STUDENT_RATE_EGP,
          expatriateStudentSessionRateUSD: STUDENT_RATE_USD,
        },
        studentsBreakdown: {
          egyptianAttendees: 0,
          expatriateAttendees: 0,
          totalCompletedSessions: 0,
        },
        revenue: Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, 0])),
        teacherDues: {
          EGP: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
          USD: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
        },
        netIncome: { EGP: 0, USD: 0 },
        pendingPayoutsCount: 0,
        processingPayoutsCount: 0,
      });
    }

    // 1. Aggregate completed sessions and student attendees by origin in MongoDB (constant memory)
    const sessionOverviewAgg = await Session.aggregate([
      { $match: { status: 'completed' } },
      {
        $project: {
          attendeeIds: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$attendance', []] } }, 0] },
              {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ['$attendance', []] },
                      as: 'att',
                      cond: {
                        $or: [
                          { $eq: ['$$att.status', 'attended'] },
                          {
                            $and: [
                              { $not: ['$$att.status'] },
                              { $ne: ['$$att.student', null] },
                            ],
                          },
                        ],
                      },
                    },
                  },
                  as: 'validAtt',
                  in: '$$validAtt.student',
                },
              },
              {
                $cond: [
                  { $ne: ['$student', null] },
                  ['$student'],
                  [],
                ],
              },
            ],
          },
        },
      },
      {
        $facet: {
          totals: [{ $count: 'totalCompletedSessions' }],
          attendees: [
            { $unwind: '$attendeeIds' },
            {
              $lookup: {
                from: User.collection.name,
                localField: 'attendeeIds',
                foreignField: '_id',
                pipeline: [
                  {
                    $project: {
                      market: '$preferences.market',
                      currency: '$preferences.currency',
                      phone: { $ifNull: ['$phoneNormalized', { $ifNull: ['$phone', ''] }] },
                      country: {
                        $toLower: {
                          $ifNull: ['$personalInfo.country', { $ifNull: ['$country', ''] }],
                        },
                      },
                    },
                  },
                ],
                as: 'studentDoc',
              },
            },
            { $unwind: { path: '$studentDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                isEgyptian: {
                  $or: [
                    { $in: ['$studentDoc.market', ['egypt', 'egyptian']] },
                    { $eq: ['$studentDoc.currency', 'EGP'] },
                    { $eq: ['$studentDoc.country', 'eg'] },
                    {
                      $regexMatch: {
                        input: { $ifNull: ['$studentDoc.phone', ''] },
                        regex: /^\+?20/,
                      },
                    },
                    {
                      $regexMatch: {
                        input: { $ifNull: ['$studentDoc.country', ''] },
                        regex: /مصر|egypt/i,
                      },
                    },
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$isEgyptian',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const facetResult = sessionOverviewAgg[0] || { totals: [], attendees: [] };
    const totalCompletedSessions = facetResult.totals?.[0]?.totalCompletedSessions || 0;
    let egyptianAttendees = 0;
    let expatriateAttendees = 0;
    for (const row of facetResult.attendees || []) {
      if (row._id === true) egyptianAttendees += row.count || 0;
      else expatriateAttendees += row.count || 0;
    }

    // Calculate collected revenue from total successful payments for subscriptions and courses (Payment with status 'succeeded')
    const paymentAgg = await Payment.aggregate([
      {
        $match: {
          status: 'succeeded',
          kind: { $in: ['subscription', 'course_enrollment'] },
        },
      },
      {
        $group: {
          _id: '$currency',
          totalMinor: { $sum: '$amountMinor' },
        },
      },
    ]);

    const revenueMinor = Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, 0]));
    for (const item of paymentAgg) {
      const curr = item._id ? String(item._id).toUpperCase() : 'EGP';
      revenueMinor[curr] = (revenueMinor[curr] || 0) + (Number(item.totalMinor) || 0);
    }
    const revenue = Object.fromEntries(
      Object.entries(revenueMinor).map(([curr, minor]) => [curr, fromMinor(minor)])
    );

    const grossRevenueEGP = revenue.EGP || 0;
    const grossRevenueUSD = revenue.USD || 0;

    // 2. Aggregate TeacherLedger data per teacher in minor units so per-teacher clamping prevents cross-teacher deficit offsetting
    const ledgerAgg = await TeacherLedger.aggregate([
      {
        $group: {
          _id: {
            teacher: '$teacher',
            currency: '$currency',
            type: '$type',
            status: '$status',
          },
          totalMinor: { $sum: { $round: [{ $multiply: ['$amount', 100] }, 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const perTeacherMinor = new Map();
    let pendingPayoutsCount = 0;
    let processingPayoutsCount = 0;

    for (const item of ledgerAgg) {
      const curr = item._id.currency === 'USD' ? 'USD' : 'EGP';
      const teacherKey = `${String(item._id.teacher || 'unassigned')}:${curr}`;
      if (!perTeacherMinor.has(teacherKey)) {
        perTeacherMinor.set(teacherKey, {
          curr,
          earned: 0,
          deducted: 0,
          withdrawn: 0,
          pendingPayouts: 0,
        });
      }
      const bucket = perTeacherMinor.get(teacherKey);
      const type = item._id.type;
      const status = item._id.status;
      const amountMinor = item.totalMinor !== undefined
        ? (Number(item.totalMinor) || 0)
        : toMinor(item.totalAmount || 0);

      if (type === 'session_earning' || type === 'bonus' || type === 'adjustment') {
        if (status === 'completed') {
          bucket.earned += amountMinor;
        }
      } else if (type === 'deduction') {
        if (status === 'completed') {
          bucket.deducted += amountMinor;
        }
      } else if (type === 'payout') {
        if (status === 'completed') {
          bucket.withdrawn += amountMinor;
        } else if (status === 'pending' || status === 'processing') {
          bucket.pendingPayouts += amountMinor;
          if (status === 'pending') pendingPayoutsCount += item.count;
          if (status === 'processing') processingPayoutsCount += item.count;
        }
      }
    }

    const duesMinor = {
      EGP: { netEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
      USD: { netEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
    };

    for (const bucket of perTeacherMinor.values()) {
      const netTeacherEarned = Math.max(0, bucket.earned - bucket.deducted);
      const availTeacherMinor = Math.max(0, netTeacherEarned - bucket.withdrawn - bucket.pendingPayouts);
      duesMinor[bucket.curr].netEarned += netTeacherEarned;
      duesMinor[bucket.curr].withdrawn += bucket.withdrawn;
      duesMinor[bucket.curr].pendingPayouts += bucket.pendingPayouts;
      duesMinor[bucket.curr].availableLiability += availTeacherMinor;
    }

    const teacherDues = {};
    for (const curr of ['EGP', 'USD']) {
      teacherDues[curr] = {
        totalEarned: fromMinor(duesMinor[curr].netEarned),
        withdrawn: fromMinor(duesMinor[curr].withdrawn),
        pendingPayouts: fromMinor(duesMinor[curr].pendingPayouts),
        availableLiability: fromMinor(duesMinor[curr].availableLiability),
      };
    }

    // 3. Net academy income
    const netIncomeEGP = fromMinor(toMinor(grossRevenueEGP) - toMinor(teacherDues.EGP.totalEarned));
    const netIncomeUSD = fromMinor(toMinor(grossRevenueUSD) - toMinor(teacherDues.USD.totalEarned));

    // 4. Fetch recent payout requests for fast admin action
    const recentPayoutRequests = await TeacherLedger.find({ type: 'payout', status: { $in: ['pending', 'processing'] } })
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      rates: {
        egyptianStudentSessionRateEGP: STUDENT_RATE_EGP,
        expatriateStudentSessionRateUSD: STUDENT_RATE_USD,
      },
      studentsBreakdown: {
        egyptianAttendees,
        expatriateAttendees,
        totalCompletedSessions,
      },
      revenue,
      teacherDues,
      netIncome: {
        EGP: netIncomeEGP,
        USD: netIncomeUSD,
      },
      pendingPayoutsCount,
      processingPayoutsCount,
      recentPayoutRequests,
    });
  } catch (error) {
    console.error('Admin finance overview error:', error);
    res.status(500).json({ error: 'تعذر تحميل ملخص البيانات المالية حالياً' });
  }
});

// ==========================================
// 5. GET /api/finance/admin/payouts
// ==========================================
router.get('/admin/payouts', protect, authorize('admin'), async (req, res) => {
  try {
    if (shouldUseMockFinance()) {
      return res.json({ success: true, payouts: [] });
    }

    const status = String(req.query.status || 'all').trim();
    const currency = String(req.query.currency || 'all').trim().toUpperCase();
    const method = String(req.query.method || 'all').trim().toLowerCase();
    const rawQ = String(req.query.q || '').trim().slice(0, 120).toLowerCase();

    const filter = { type: 'payout' };
    if (status !== 'all') filter.status = status;
    if (['EGP', 'USD'].includes(currency)) filter.currency = currency;
    if (['instapay', 'vodafone_cash', 'bank_transfer', 'paypal'].includes(method)) {
      filter.payoutMethod = method;
    }

    let payouts = await TeacherLedger.find(filter)
      .populate({
        path: 'teacher',
        select: 'personalInfo user hourlyRate',
        populate: { path: 'user', select: 'name email phone whatsappPhone' },
      })
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    if (rawQ) {
      payouts = payouts.filter((item) => {
        const hay = [
          item.teacher?.personalInfo?.fullName,
          item.teacher?.user?.name,
          item.teacher?.user?.email,
          item.teacher?.user?.phone,
          item.referenceNumber,
          item.payoutDetails?.ipaAddress,
          item.payoutDetails?.phone,
          item.payoutDetails?.bankName,
          item.payoutDetails?.bankAccountNumber,
          item.payoutDetails?.accountHolderName,
          item.payoutDetails?.paypalEmail,
          item.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(rawQ);
      });
    }

    return res.json({ success: true, payouts });
  } catch (error) {
    console.error('Admin payouts list error:', error);
    return res.status(500).json({ error: 'تعذر تحميل طلبات السحب حالياً' });
  }
});

// ==========================================
// 6. PUT /api/finance/admin/payouts/:id/process
// ==========================================
router.put('/admin/payouts/:id/process', protect, authorize('admin'), async (req, res) => {
  try {
    const { action, status, referenceNumber, receiptUrl, notes } = req.body || {};
    const targetStatus = status || (action === 'approve' ? 'completed' : action === 'reject' ? 'rejected' : action === 'processing' ? 'processing' : null);

    if (!targetStatus || !['processing', 'completed', 'rejected'].includes(targetStatus)) {
      return res.status(400).json({
        error: 'الحالة المستهدفة غير صحيحة. يجب أن تكون: processing, completed, rejected أو action: approve, reject, processing',
      });
    }

    const cleanReceiptUrl = validateHttpsReceiptUrl(receiptUrl);

    if (shouldUseMockFinance()) {
      await logAdminAction({
        req,
        action: 'payout_processed',
        entityType: 'TeacherLedger',
        entityId: req.params.id,
        reason: String(notes || '').trim().slice(0, 500) || `معالجة سحب أرباح (${targetStatus})`,
        metadata: {
          status: targetStatus,
          referenceNumber: String(referenceNumber || '').trim().slice(0, 160),
          receiptUrl: cleanReceiptUrl || '',
          notes: String(notes || '').trim().slice(0, 500),
        },
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'تمت معالجة وتحديث طلب السحب بنجاح',
        payout: {
          _id: req.params.id,
          status: targetStatus,
          referenceNumber: String(referenceNumber || '').trim().slice(0, 160),
          receiptUrl: cleanReceiptUrl || '',
          notes: String(notes || '').trim().slice(0, 500),
          processedAt: new Date().toISOString(),
        },
      });
    }

    const payout = await processTeacherPayout({
      payoutId: req.params.id,
      targetStatus,
      adminUserId: req.user.id,
      referenceNumber,
      receiptUrl: cleanReceiptUrl,
      notes,
    });

    await logAdminAction({
      req,
      action: 'payout_processed',
      entityType: 'TeacherLedger',
      entityId: payout._id,
      reason: String(notes || '').trim().slice(0, 500) || `معالجة سحب أرباح (${targetStatus})`,
      metadata: {
        status: targetStatus,
        amount: payout.amount,
        currency: payout.currency,
        teacherId: payout.teacher?._id || payout.teacher,
        payoutMethod: payout.payoutMethod,
        referenceNumber: payout.referenceNumber,
      },
    }).catch(() => {});

    if (mongoose.connection.readyState === 1) {
      const teacherUserId = payout.teacher?.user?._id || payout.teacher?.user;
      if (teacherUserId) {
        const refSuffixAr = payout.referenceNumber ? ` (مرجع التحويل: ${payout.referenceNumber})` : '';
        const refSuffixEn = payout.referenceNumber ? ` (Ref: ${payout.referenceNumber})` : '';
        const noteSuffixAr = payout.notes ? ` — ملاحظة: ${payout.notes}` : '';
        const noteSuffixEn = payout.notes ? ` — Note: ${payout.notes}` : '';
        const notifCopy = targetStatus === 'completed'
          ? {
              title: { ar: 'تم تحويل مستحقاتك المالية', en: 'Your payout has been transferred' },
              message: {
                ar: `تم إتمام تحويل مبلغ ${payout.amount} ${payout.currency}${refSuffixAr}.${noteSuffixAr}`,
                en: `Your payout of ${payout.amount} ${payout.currency} has been completed${refSuffixEn}.${noteSuffixEn}`,
              },
            }
          : targetStatus === 'processing'
            ? {
                title: { ar: 'طلب السحب قيد التنفيذ البنكي', en: 'Payout transfer in progress' },
                message: {
                  ar: `بدأت الإدارة إجراءات تحويل مبلغ ${payout.amount} ${payout.currency} إلى حسابك.`,
                  en: `Administration has started processing your ${payout.amount} ${payout.currency} payout.`,
                },
              }
            : {
                title: { ar: 'تحديث بخصوص طلب السحب', en: 'Payout request update' },
                message: {
                  ar: `تعذر إتمام طلب سحب ${payout.amount} ${payout.currency} وتمت إعادة المبلغ لرصيدك المتاح.${noteSuffixAr}`,
                  en: `Your ${payout.amount} ${payout.currency} payout request was declined and returned to your available balance.${noteSuffixEn}`,
                },
              };
        notifyUser(teacherUserId, {
          type: 'system',
          ...notifCopy,
          data: {
            actionUrl: '/teacher/dashboard',
            metadata: {
              payoutId: String(payout._id),
              status: targetStatus,
              amount: payout.amount,
              currency: payout.currency,
            },
          },
          priority: 'high',
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: 'تمت معالجة وتحديث طلب السحب بنجاح',
      payout,
    });
  } catch (error) {
    const status = error?.status || 400;
    const message = error?.publicMessage || 'تعذر معالجة طلب السحب حالياً';
    res.status(status).json({
      error: message,
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

router.post('/admin/bonus', protect, authorize('admin'), async (req, res) => {
  try {
    const { teacherId, amount, currency = 'EGP', reason, idempotencyKey } = req.body || {};
    const { recordTeacherBonus } = require('../services/teacherFinance');
    const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const cleanReason = String(reason || '').trim().slice(0, 500);

    if (shouldUseMockFinance()) {
      if (!teacherId || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !cleanReason) {
        return res.status(400).json({ error: 'بيانات المكافأة غير مكتملة' });
      }
      const mockTx = {
        _id: `mock-bonus-${Date.now()}`,
        teacher: teacherId,
        type: 'bonus',
        amount: fromMinor(toMinor(amount)),
        currency: String(currency || 'EGP').toUpperCase() === 'USD' ? 'USD' : 'EGP',
        status: 'completed',
        notes: cleanReason,
        createdAt: new Date().toISOString(),
      };
      await logAdminAction({
        req,
        action: 'teacher_ledger.bonus',
        entityType: 'TeacherLedger',
        entityId: mockTx._id,
        reason: cleanReason,
        metadata: { teacherId: String(teacherId), amount: mockTx.amount, currency: mockTx.currency },
      }).catch(() => {});
      return res.status(201).json({ success: true, transaction: mockTx });
    }

    const entry = await recordTeacherBonus({
      teacherId,
      amount,
      currency,
      reason,
      adminUserId: req.user.id,
      idempotencyKey: idempotencyKey || headerKey,
    });

    await logAdminAction({
      req,
      action: 'teacher_ledger.bonus',
      entityType: 'TeacherLedger',
      entityId: entry._id,
      reason: cleanReason,
      metadata: { teacherId: String(entry.teacher), amount: entry.amount, currency: entry.currency },
    }).catch(() => {});

    if (mongoose.connection.readyState === 1) {
      const teacherDoc = await Teacher.findById(entry.teacher).select('user').lean().catch(() => null);
      if (teacherDoc?.user) {
        notifyUser(teacherDoc.user, {
          type: 'system',
          title: { ar: 'مكافأة مالية مضافة لمحفظتك', en: 'Bonus credited to your wallet' },
          message: {
            ar: `تمت إضافة مكافأة بقيمة ${entry.amount} ${entry.currency} إلى رصيدك: ${cleanReason}`,
            en: `A bonus of ${entry.amount} ${entry.currency} has been added to your wallet: ${cleanReason}`,
          },
          data: { actionUrl: '/teacher/dashboard', metadata: { ledgerId: String(entry._id) } },
          priority: 'high',
        }).catch(() => {});
      }
    }

    return res.status(201).json({ success: true, transaction: entry });
  } catch (error) {
    const status = error?.status || 400;
    return res.status(status).json({
      error: error?.publicMessage || 'تعذر تسجيل المكافأة المالية',
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

router.post('/admin/deduction', protect, authorize('admin'), async (req, res) => {
  try {
    const { teacherId, amount, currency = 'EGP', reason, idempotencyKey } = req.body || {};
    const { recordTeacherDeduction } = require('../services/teacherFinance');
    const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    const entry = await recordTeacherDeduction({
      teacherId,
      amount,
      currency,
      reason,
      adminUserId: req.user.id,
      idempotencyKey: idempotencyKey || headerKey,
    });

    const cleanReason = String(reason || '').trim().slice(0, 500);
    await logAdminAction({
      req,
      action: 'teacher_ledger.deduction',
      entityType: 'TeacherLedger',
      entityId: entry._id,
      reason: cleanReason,
      metadata: { teacherId: String(entry.teacher), amount: entry.amount, currency: entry.currency },
    }).catch(() => {});

    return res.status(201).json({ success: true, transaction: entry });
  } catch (error) {
    const status = error?.status || 400;
    return res.status(status).json({
      error: error?.publicMessage || 'تعذر تسجيل القيد العكسي',
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

// Backwards-compatible exports for scripts that still import helpers from this route.
module.exports = router;
module.exports.calculateTeacherBalance = calculateTeacherBalance;
module.exports.recordSessionEarning = ensureSessionEarning;
