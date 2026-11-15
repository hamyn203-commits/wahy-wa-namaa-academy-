const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdmin } = require('../services/growthNotify');
const { logAdminAction } = require('../services/adminAudit');

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, amount, currency = 'USD', category = 'general', message, isAnonymous } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanMessage = String(message || '').trim();
    const numericAmount = Number(amount);
    const normalizedCurrency = String(currency || 'USD').toUpperCase();
    const normalizedCategory = String(category || 'general').trim();
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];
    const allowedCategories = ['student', 'teacher', 'halaqa', 'general'];

    if (!cleanName || !cleanEmail || !numericAmount) {
      return res.status(400).json({ error: 'الاسم والبريد والمبلغ مطلوبة' });
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'الاسم غير صالح' });
    }
    if (cleanEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 10000000) {
      return res.status(400).json({ error: 'المبلغ غير صالح' });
    }
    if (!allowedCurrencies.includes(normalizedCurrency) || !allowedCategories.includes(normalizedCategory)) {
      return res.status(400).json({ error: 'العملة أو فئة التبرع غير صالحة' });
    }
    if (cleanPhone.length > 32 || cleanMessage.length > 500) {
      return res.status(400).json({ error: 'بيانات التبرع تتجاوز الحد المسموح' });
    }

    if (!isDBConnected()) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'خدمة التبرعات غير متاحة مؤقتاً، يرجى المحاولة لاحقاً' });
      }
      return res.status(201).json({
        success: true,
        message: 'شكراً لتبرعك — سنتواصل معك لإتمام العملية',
        id: 'mock-donation-' + Date.now(),
      });
    }

    const amountMinor = Math.round(numericAmount * 100);
    const roundedAmount = amountMinor / 100;
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 100) {
      return res.status(400).json({ error: 'المبلغ غير صالح' });
    }

    const donation = await Donation.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      amount: roundedAmount,
      amountMinor,
      currency: normalizedCurrency,
      category: normalizedCategory,
      message: cleanMessage,
      isAnonymous: Boolean(isAnonymous),
    });
    notifyAdmin({
      subject: `تبرع جديد — ${roundedAmount} ${normalizedCurrency}`,
      html: '<p>تم تسجيل تعهد تبرع جديد.</p><p>راجع لوحة الإدارة للاطلاع على بيانات المتبرع.</p>',
    }).catch(() => {});
    res.status(201).json({ success: true, message: 'شكراً لتبرعك — سنتواصل معك لإتمام العملية', id: donation._id });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    if (!isDBConnected()) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'خدمة الإحصاءات غير متاحة مؤقتاً' });
      }
      return res.json({
        totalDonors: 0,
        totalsByCurrency: {},
        byCategory: {},
      });
    }

    const [totalsByCurrencyRows, byCategoryRows] = await Promise.all([
      Donation.aggregate([
        { $match: { status: 'confirmed' } },
        {
          $group: {
            _id: '$currency',
            totalMinor: {
              $sum: {
                $ifNull: ['$amountMinor', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Donation.aggregate([
        { $match: { status: 'confirmed' } },
        {
          $group: {
            _id: { category: '$category', currency: '$currency' },
            totalMinor: {
              $sum: {
                $ifNull: ['$amountMinor', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalsByCurrency = totalsByCurrencyRows.reduce((acc, row) => {
      acc[row._id] = { total: Math.round(Number(row.totalMinor || 0)) / 100, count: row.count };
      return acc;
    }, {});

    const byCategory = byCategoryRows.reduce((acc, row) => {
      const category = row._id.category;
      const currency = row._id.currency;

      if (!acc[category]) {
        acc[category] = { currencies: {}, count: 0 };
      }

      acc[category].currencies[currency] = {
        total: Math.round(Number(row.totalMinor || 0)) / 100,
        count: row.count,
      };
      acc[category].count += row.count;
      return acc;
    }, {});

    const totalDonors = Object.values(totalsByCurrency)
      .reduce((sum, item) => sum + item.count, 0);

    return res.json({
      totalDonors,
      totalsByCurrency,
      byCategory,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/config', async (_req, res) => {
  res.json({
    paymentEnabled: !!(process.env.STRIPE_DONATION_URL || process.env.PAYPAL_DONATION_URL),
    stripeUrl: process.env.STRIPE_DONATION_URL || '',
    paypalUrl: process.env.PAYPAL_DONATION_URL || '',
  });
});

router.get('/', protect, authorize('admin'), async (req, res) => {
  const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const status = req.query.status ? String(req.query.status).trim() : '';

  if (!isDBConnected()) {
    if (!isMockMode) {
      return res.status(503).json({ error: 'قاعدة البيانات غير متاحة حالياً' });
    }
    return res.json({
      donations: [],
      pagination: { page: pageNum, limit: limitNum, total: 0 },
    });
  }
  try {
    const allowedStatuses = ['pledged', 'confirmed', 'cancelled'];
    const filter = status && allowedStatuses.includes(status) ? { status } : {};
    const skip = (pageNum - 1) * limitNum;
    const [donations, total] = await Promise.all([
      Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Donation.countDocuments(filter),
    ]);
    res.json({ donations, pagination: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف التبرع غير صالح' });
    }
    const status = String(req.body?.status || '').trim();
    const paymentReference = typeof req.body?.paymentReference === 'string'
      ? req.body.paymentReference.trim().slice(0, 120)
      : '';
    const allowedStatuses = ['pledged', 'confirmed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'حالة التبرع غير صالحة' });
    }
    const existingDonation = await Donation.findById(req.params.id);
    if (!existingDonation) return res.status(404).json({ error: 'التبرع غير موجود' });

    const beforeStatus = existingDonation.status;
    if (beforeStatus === 'confirmed' && status === 'pledged') {
      return res.status(409).json({
        error: 'لا يمكن إعادة تبرع مؤكد إلى حالة تعهد',
        code: 'INVALID_DONATION_STATUS_TRANSITION',
      });
    }
    const setFields = { status };
    const unsetFields = {};
    if (status === 'confirmed') {
      setFields.confirmedAt = existingDonation.confirmedAt || new Date();
      setFields.confirmedBy = req.user.id;
      if (paymentReference) setFields.paymentReference = paymentReference;
    } else if (status === 'cancelled') {
      unsetFields.confirmedAt = 1;
      unsetFields.confirmedBy = 1;
    }

    const donation = await Donation.findOneAndUpdate(
      { _id: req.params.id, status: beforeStatus },
      {
        $set: setFields,
        ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!donation) return res.status(409).json({ error: 'تغيرت حالة التبرع بالتزامن، أعد المحاولة' });

    await logAdminAction({
      req,
      action: `donation.status.${status}`,
      entityType: 'donation',
      entityId: String(donation._id),
      reason: paymentReference ? `تحديث حالة التبرع إلى ${status} (${paymentReference})` : `تحديث حالة التبرع إلى ${status}`,
      before: { status: beforeStatus },
      after: { status: donation.status, paymentReference: donation.paymentReference || null },
      metadata: {
        status,
        amount: donation.amount,
        amountMinor: donation.amountMinor || Math.round(Number(donation.amount || 0) * 100),
        currency: donation.currency,
      },
    }).catch(() => {});

    res.json(donation);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
