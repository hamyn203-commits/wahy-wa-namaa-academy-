const express = require('express');
const router = express.Router();
const TeacherLedger = require('../models/TeacherLedger');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { logAdminAction } = require('../services/adminAudit');
const { protect, authorize } = require('../middleware/auth');
const {
  MIN_PAYOUT_EGP,
  MIN_PAYOUT_USD,
  calculateTeacherBalance,
  ensureSessionEarning,
  listTeacherTransactions,
} = require('../services/teacherFinance');

// Constants for academic financial rules (V7.6)
const STUDENT_RATE_EGP = 20; // 20 ج للمصريين لكل طالب في الحلقة
const STUDENT_RATE_USD = 1;  // 1$ للمغتربين لكل طالب في الحلقة
const { isMockMode } = require('../config/runtime');

/**
 * Helper: Determine if user/student is in Egyptian market
 */
function isEgyptianStudent(user) {
  if (!user) return false;
  const market = user.preferences?.market;
  const currency = user.preferences?.currency;
  const country = (user.personalInfo?.country || user.country || '').toLowerCase();
  return market === 'egypt' || currency === 'EGP' || country === 'eg' || country.includes('مصر') || country.includes('egypt');
}

// ==========================================
// 1. GET /api/finance/teacher/balance
// ==========================================
router.get('/teacher/balance', protect, authorize('teacher'), async (req, res) => {
  try {
    if (isMockMode) {
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
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. GET /api/finance/teacher/transactions
// ==========================================
router.get('/teacher/transactions', protect, authorize('teacher'), async (req, res) => {
  try {
    if (isMockMode) {
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
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. POST /api/finance/teacher/request-payout
// ==========================================
router.post('/teacher/request-payout', protect, authorize('teacher'), async (req, res) => {
  try {
    const { amount, currency = 'EGP', payoutMethod, payoutDetails, notes } = req.body;
    const numAmount = Number(amount);
    const curr = (currency || 'EGP').toUpperCase();

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال مبلغ سحب صحيح' });
    }

    if (!['EGP', 'USD'].includes(curr)) {
      return res.status(400).json({ error: 'العملة يجب أن تكون EGP أو USD' });
    }

    const minAmount = curr === 'USD' ? MIN_PAYOUT_USD : MIN_PAYOUT_EGP;
    if (numAmount < minAmount) {
      return res.status(400).json({
        error: `الحد الأدنى لطلب السحب هو ${minAmount} ${curr === 'USD' ? 'دولار' : 'جنيه'}`,
      });
    }

    const validMethods = ['instapay', 'vodafone_cash', 'bank_transfer', 'paypal'];
    if (!payoutMethod || !validMethods.includes(payoutMethod)) {
      return res.status(400).json({
        error: 'يرجى اختيار وسيلة سحب صحيحة: instapay, vodafone_cash, bank_transfer, paypal',
      });
    }

    if (!payoutDetails || typeof payoutDetails !== 'object') {
      return res.status(400).json({ error: 'يرجى إدخال تفاصيل وسيلة السحب' });
    }

    // Specific validations per payout method
    if (payoutMethod === 'instapay') {
      if (!payoutDetails.ipaAddress && !payoutDetails.phone) {
        return res.status(400).json({ error: 'يرجى إدخال عنوان انستاباي (IPA) أو رقم الهاتف المرتبط بـ InstaPay' });
      }
    } else if (payoutMethod === 'vodafone_cash') {
      if (!payoutDetails.phone || !/^(010|011|012|015)[0-9]{8}$/.test(payoutDetails.phone.replace(/\s+/g, ''))) {
        return res.status(400).json({ error: 'يرجى إدخال رقم محفظة إلكترونية صحيح مكون من 11 رقماً' });
      }
    } else if (payoutMethod === 'bank_transfer') {
      if (!payoutDetails.bankAccountNumber || !payoutDetails.bankName) {
        return res.status(400).json({ error: 'يرجى إدخال اسم البنك ورقم الحساب البنكي / IBAN' });
      }
    } else if (payoutMethod === 'paypal') {
      if (!payoutDetails.paypalEmail || !/^\S+@\S+\.\S+$/.test(payoutDetails.paypalEmail)) {
        return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صالح لحساب PayPal' });
      }
    }

    if (isMockMode) {
      return res.status(201).json({
        success: true,
        message: 'تم تقديم طلب سحب الأرباح بنجاح وجارٍ مراجعته من قِبل الإدارة',
        transaction: {
          _id: `mock-payout-${Date.now()}`,
          type: 'payout',
          amount: numAmount,
          currency: curr,
          payoutMethod,
          payoutDetails,
          status: 'pending',
          notes: notes || '',
          description: `طلب سحب أرباح بقيمة ${numAmount} ${curr} عبر ${payoutMethod}`,
          createdAt: new Date().toISOString(),
        },
      });
    }

    const teacher = await Teacher.findOne({ user: req.user.id });
    if (!teacher) {
      return res.status(404).json({ error: 'لم يتم العثور على ملف المعلم' });
    }

    // Verify sufficient available balance
    const balances = await calculateTeacherBalance(teacher._id);
    const available = balances[curr]?.available || 0;

    if (numAmount > available) {
      return res.status(400).json({
        error: `الرصيد المتاح للسحب غير كافٍ. رصيدك الحالي: ${available} ${curr}`,
      });
    }

    const transaction = await TeacherLedger.create({
      teacher: teacher._id,
      type: 'payout',
      amount: numAmount,
      currency: curr,
      payoutMethod,
      payoutDetails: {
        phone: payoutDetails.phone?.trim(),
        ipaAddress: payoutDetails.ipaAddress?.trim(),
        bankAccountNumber: payoutDetails.bankAccountNumber?.trim(),
        bankName: payoutDetails.bankName?.trim(),
        accountHolderName: payoutDetails.accountHolderName?.trim(),
        paypalEmail: payoutDetails.paypalEmail?.trim().toLowerCase(),
      },
      status: 'pending',
      notes: notes || '',
      description: `طلب سحب أرباح بقيمة ${numAmount} ${curr} عبر ${payoutMethod}`,
    });

    res.status(201).json({
      success: true,
      message: 'تم تقديم طلب سحب الأرباح بنجاح وجارٍ مراجعته من قِبل الإدارة',
      transaction,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// 4. GET /api/finance/admin/overview
// ==========================================
router.get('/admin/overview', protect, authorize('admin'), async (req, res) => {
  try {
    if (isMockMode) {
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
        revenue: { EGP: 0, USD: 0 },
        teacherDues: {
          EGP: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
          USD: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
        },
        netIncome: { EGP: 0, USD: 0 },
        pendingPayoutsCount: 0,
        processingPayoutsCount: 0,
      });
    }

    // 1. Fetch completed sessions and calculate student attendees by origin
    const completedSessions = await Session.find({ status: 'completed' })
      .populate({ path: 'attendance.student', select: 'preferences personalInfo country' })
      .populate({ path: 'student', select: 'preferences personalInfo country' })
      .lean();

    let egyptianAttendees = 0;
    let expatriateAttendees = 0;

    for (const session of completedSessions) {
      if (Array.isArray(session.attendance) && session.attendance.length > 0) {
        for (const record of session.attendance) {
          if (record.status === 'attended' || (!record.status && record.student)) {
            if (isEgyptianStudent(record.student)) {
              egyptianAttendees++;
            } else {
              expatriateAttendees++;
            }
          }
        }
      } else if (session.student) {
        // Individual 1-on-1 session
        if (isEgyptianStudent(session.student)) {
          egyptianAttendees++;
        } else {
          expatriateAttendees++;
        }
      }
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

    const revenue = { EGP: 0, USD: 0 };
    for (const item of paymentAgg) {
      const curr = item._id ? String(item._id).toUpperCase() : 'EGP';
      const major = (item.totalMinor || 0) / 100;
      revenue[curr] = (revenue[curr] || 0) + major;
    }

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

    const teacherDues = {
      EGP: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
      USD: { totalEarned: 0, withdrawn: 0, pendingPayouts: 0, availableLiability: 0 },
    };

    let pendingPayoutsCount = 0;
    let processingPayoutsCount = 0;

    for (const item of ledgerAgg) {
      const curr = item._id.currency === 'USD' ? 'USD' : 'EGP';
      const type = item._id.type;
      const status = item._id.status;
      const amount = item.totalAmount || 0;

      if (type === 'session_earning' || type === 'bonus' || type === 'adjustment') {
        if (status === 'completed') {
          teacherDues[curr].totalEarned += amount;
        }
      } else if (type === 'payout') {
        if (status === 'completed') {
          teacherDues[curr].withdrawn += amount;
        } else if (status === 'pending' || status === 'processing') {
          teacherDues[curr].pendingPayouts += amount;
          if (status === 'pending') pendingPayoutsCount += item.count;
          if (status === 'processing') processingPayoutsCount += item.count;
        }
      }
    }

    teacherDues.EGP.availableLiability = Math.max(0, teacherDues.EGP.totalEarned - teacherDues.EGP.withdrawn - teacherDues.EGP.pendingPayouts);
    teacherDues.USD.availableLiability = Math.max(0, teacherDues.USD.totalEarned - teacherDues.USD.withdrawn - teacherDues.USD.pendingPayouts);

    // 3. Net academy income
    const netIncomeEGP = grossRevenueEGP - teacherDues.EGP.totalEarned;
    const netIncomeUSD = grossRevenueUSD - teacherDues.USD.totalEarned;

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
        totalCompletedSessions: completedSessions.length,
      },
      revenue: {
        EGP: grossRevenueEGP,
        USD: grossRevenueUSD,
      },
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
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. GET /api/finance/admin/payouts
// ==========================================
router.get('/admin/payouts', protect, authorize('admin'), async (req, res) => {
  try {
    if (isMockMode) {
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
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. PUT /api/finance/admin/payouts/:id/process
// ==========================================
router.put('/admin/payouts/:id/process', protect, authorize('admin'), async (req, res) => {
  try {
    const { action, status, referenceNumber, receiptUrl, notes } = req.body;
    const targetStatus = status || (action === 'approve' ? 'completed' : action === 'reject' ? 'rejected' : action === 'processing' ? 'processing' : null);

    if (!targetStatus || !['processing', 'completed', 'rejected'].includes(targetStatus)) {
      return res.status(400).json({
        error: 'الحالة المستهدفة غير صحيحة. يجب أن تكون: processing, completed, rejected أو action: approve, reject, processing',
      });
    }

    if (isMockMode) {
      await logAdminAction({
        req,
        action: 'payout_processed',
        entityType: 'TeacherLedger',
        entityId: req.params.id,
        reason: notes || `معالجة سحب أرباح (${targetStatus})`,
        metadata: {
          status: targetStatus,
          referenceNumber: referenceNumber || '',
          receiptUrl: receiptUrl || '',
          notes: notes || '',
        },
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'تمت معالجة وتحديث طلب السحب بنجاح',
        payout: {
          _id: req.params.id,
          status: targetStatus,
          referenceNumber: referenceNumber || '',
          receiptUrl: receiptUrl || '',
          notes: notes || '',
          processedAt: new Date().toISOString(),
        },
      });
    }

    const payout = await TeacherLedger.findById(req.params.id).populate('teacher');
    if (!payout) {
      return res.status(404).json({ error: 'لم يتم العثور على سجل المعاملة' });
    }

    if (payout.type !== 'payout') {
      return res.status(400).json({ error: 'هذه المعاملة ليست طلب سحب أرباح' });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({ error: 'تم تحويل وسداد هذا الطلب مسبقاً' });
    }

    payout.status = targetStatus;
    if (referenceNumber !== undefined) payout.referenceNumber = referenceNumber.trim();
    if (receiptUrl !== undefined) payout.receiptUrl = receiptUrl.trim();
    if (notes !== undefined) payout.notes = notes.trim();

    payout.processedBy = req.user.id;
    payout.processedAt = new Date();

    await payout.save();

    // Sync legacy withdrawnEarnings on Teacher document for backwards compatibility
    if (targetStatus === 'completed' && payout.teacher && payout.currency === 'EGP') {
      await Teacher.findByIdAndUpdate(payout.teacher._id, {
        $inc: { 'earnings.withdrawnEarnings': payout.amount },
      });
    }

    await logAdminAction({
      req,
      action: 'payout_processed',
      entityType: 'TeacherLedger',
      entityId: payout._id,
      reason: notes || `معالجة سحب أرباح (${targetStatus})`,
      metadata: {
        status: targetStatus,
        amount: payout.amount,
        currency: payout.currency,
        teacherId: payout.teacher?._id || payout.teacher,
        payoutMethod: payout.payoutMethod,
        recipientAccount: payout.recipientAccount,
        referenceNumber: payout.referenceNumber,
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: 'تمت معالجة وتحديث طلب السحب بنجاح',
      payout,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Backwards-compatible exports for scripts that still import helpers from this route.
module.exports = router;
module.exports.calculateTeacherBalance = calculateTeacherBalance;
module.exports.recordSessionEarning = ensureSessionEarning;
