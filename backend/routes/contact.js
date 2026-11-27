const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanMessage = String(message || '').trim();

    if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
      return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب تعبئتها' });
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'الاسم غير صالح' });
    }
    if (cleanEmail.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    if (cleanPhone.length > 32 || cleanSubject.length > 160 || cleanMessage.length > 5000) {
      return res.status(400).json({ error: 'الرسالة تتجاوز الحد المسموح' });
    }

    const msg = await ContactMessage.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
    });
    res.status(201).json({ success: true, message: 'تم إرسال رسالتك بنجاح', id: msg._id });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, q, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const filter = {};
    if (status && status !== 'all' && ['new', 'read', 'replied', 'closed'].includes(String(status))) {
      filter.status = String(status);
    }
    const cleanSearch = String(q || '').trim().slice(0, 80);
    if (cleanSearch) {
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { subject: rx },
        { message: rx },
      ];
    }
    const skip = (pageNum - 1) * limitNum;
    const canAggregate =
      typeof ContactMessage.aggregate === 'function'
      && (Boolean(mongoose.connection?.db) || ContactMessage.aggregate !== mongoose.Model.aggregate);

    const [messages, total, aggRows] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      ContactMessage.countDocuments(filter),
      canAggregate
        ? Promise.resolve(
            ContactMessage.aggregate([
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ])
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

    const summary = { totalAll: 0, new: 0, read: 0, replied: 0, closed: 0 };
    if (Array.isArray(aggRows)) {
      for (const row of aggRows) {
        if (row && row._id in summary) {
          summary[row._id] = Number(row.count || 0);
        }
        summary.totalAll += Number(row?.count || 0);
      }
    } else {
      const list = Array.isArray(messages) ? messages : [];
      summary.totalAll = Number(total || list.length);
      for (const m of list) {
        if (m?.status in summary) summary[m.status] += 1;
      }
    }

    res.json({ messages, summary, pagination: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/:id/reply', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'معرف الرسالة غير صالح' });
    }
    const { reply, status = 'replied' } = req.body;
    const allowedStatuses = ['new', 'read', 'replied', 'closed'];
    const cleanReply = String(reply || '').trim();
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'حالة الرسالة غير صالحة' });
    }
    if (cleanReply.length > 5000) {
      return res.status(400).json({ error: 'الرد يتجاوز الحد المسموح' });
    }
    const msg = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { adminReply: cleanReply, status, repliedBy: req.user.id, repliedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });
    await logAdminAction({
      req,
      action: 'contact_message.replied',
      entityType: 'contact_message',
      entityId: msg._id,
      reason: cleanReply.slice(0, 180),
    }).catch(() => {});
    res.json(msg);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'معرف الرسالة غير صالح' });
    }
    const allowedStatuses = ['new', 'read', 'replied', 'closed'];
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'حالة الرسالة غير صالحة' });
    }
    const msg = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });
    await logAdminAction({
      req,
      action: `contact_message.status.${req.body.status}`,
      entityType: 'contact_message',
      entityId: msg._id,
    }).catch(() => {});
    res.json(msg);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
