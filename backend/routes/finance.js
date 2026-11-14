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
                    { $eq: ['$studentDoc.market', 'egypt'] },
                    { $eq: ['$studentDoc.currency', 'EGP'] },
                    { $eq: ['$studentDoc.country', 'eg'] },
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

    // 2. Aggregate TeacherLedger data for dues and payouts
    const ledgerAgg = await TeacherLedger.aggregate([
      {
        $group: {
          _id: { currency: '$currency', type: '$type', status: '$status' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const duesMinor = {
      EGP: { earned: 0, deducted: 0, withdrawn: 0, pendingPayouts: 0 },
      USD: { earned: 0, deducted: 0, withdrawn: 0, pendingPayouts: 0 },
    };

    let pendingPayoutsCount = 0;
    let processingPayoutsCount = 0;

    for (const item of ledgerAgg) {
      const curr = item._id.currency === 'USD' ? 'USD' : 'EGP';
      const type = item._id.type;
      const status = item._id.status;
      const amountMinor = toMinor(item.totalAmount || 0);

      if (type === 'session_earning' || type === 'bonus' || type === 'adjustment') {
        if (status === 'completed') {
          duesMinor[curr].earned += amountMinor;
        }
      } else if (type === 'deduction') {
        if (status === 'completed') {
          duesMinor[curr].deducted += amountMinor;
        }
      } else if (type === 'payout') {
        if (status === 'completed') {
          duesMinor[curr].withdrawn += amountMinor;
        } else if (status === 'pending' || status === 'processing') {
          duesMinor[curr].pendingPayouts += amountMinor;
          if (status === 'pending') pendingPayoutsCount += item.count;
          if (status === 'processing') processingPayoutsCount += item.count;
        }
      }
    }

    const teacherDues = {};
    for (const curr of ['EGP', 'USD']) {
      const netEarnedMinor = Math.max(0, duesMinor[curr].earned - duesMinor[curr].deducted);
      const availMinor = Math.max(0, netEarnedMinor - duesMinor[curr].withdrawn - duesMinor[curr].pendingPayouts);
      teacherDues[curr] = {
        totalEarned: fromMinor(netEarnedMinor),
        withdrawn: fromMinor(duesMinor[curr].withdrawn),
        pendingPayouts: fromMinor(duesMinor[curr].pendingPayouts),
        availableLiability: fromMinor(availMinor),
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

    const status = String(req.query.status || 'all');
    const filter = { type: 'payout' };
    if (status !== 'all') filter.status = status;

    const payouts = await TeacherLedger.find(filter)
      .populate({
        path: 'teacher',
        select: 'personalInfo user',
        populate: { path: 'user', select: 'name email phone' },
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

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

router.post('/admin/deduction', protect, authorize('admin'), async (req, res) => {
  try {
    const { teacherId, amount, currency = 'EGP', reason } = req.body || {};
    const numAmount = Number(amount);
    const curr = String(currency || 'EGP').trim().toUpperCase();
    const cleanReason = String(reason || '').trim().slice(0, 500);

    if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) {
      return res.status(400).json({ error: 'معرف المعلم غير صالح' });
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0 || Math.abs(Math.round(numAmount * 100) - (numAmount * 100)) > 1e-6) {
      return res.status(400).json({ error: 'مبلغ الخصم غير صالح' });
    }
    if (!['EGP', 'USD'].includes(curr)) {
      return res.status(400).json({ error: 'العملة يجب أن تكون EGP أو USD' });
    }
    if (!cleanReason) {
      return res.status(400).json({ error: 'سبب القيد العكسي مطلوب' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ error: 'لم يتم العثور على ملف المعلم' });

    const entry = await TeacherLedger.create({
      teacher: teacher._id,
      type: 'deduction',
      amount: fromMinor(toMinor(numAmount)),
      currency: curr,
      status: 'completed',
      processedBy: req.user.id,
      processedAt: new Date(),
      notes: cleanReason,
      description: `خصم إداري: ${cleanReason.slice(0, 120)}`,
    });

    await logAdminAction({
      req,
      action: 'teacher_ledger.deduction',
      entityType: 'TeacherLedger',
      entityId: entry._id,
      reason: cleanReason,
      metadata: { teacherId: String(teacher._id), amount: entry.amount, currency: curr },
    }).catch(() => {});

    return res.status(201).json({ success: true, transaction: entry });
  } catch (error) {
    return res.status(400).json({ error: 'تعذر تسجيل القيد العكسي' });
  }
});

// Backwards-compatible exports for scripts that still import helpers from this route.
module.exports = router;
module.exports.calculateTeacherBalance = calculateTeacherBalance;
module.exports.recordSessionEarning = ensureSessionEarning;
