const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { protect, authorize } = require('../middleware/auth');

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
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const filter = status ? { status: String(status) } : {};
    const skip = (pageNum - 1) * limitNum;
    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      ContactMessage.countDocuments(filter),
    ]);
    res.json({ messages, pagination: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/:id/reply', protect, authorize('admin'), async (req, res) => {
  try {
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
    res.json(msg);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
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
