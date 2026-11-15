const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/SupportMessage');
const Notification = require('../models/Notification');
const { publishRealtimeNotification } = require('../services/realtimeNotificationBus');
const { SAFETY_WARNING_MESSAGE, containsExternalLink, inspectChatSafety } = require('../utils/chatSafety');
const router = express.Router();

router.use(protect, authorize('student', 'admin'));
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 900, keyGenerator: (req) => req.user.id, standardHeaders: true, legacyHeaders: false, skip: () => process.env.DISABLE_RATE_LIMIT === 'true' }));
const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyGenerator: (req) => req.user.id, standardHeaders: true, legacyHeaders: false, skip: () => process.env.DISABLE_RATE_LIMIT === 'true' });

async function studentFor(req, res) {
  const id = req.user.role === 'student' ? req.user.id : req.params.studentId;
  if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'معرّف الطالب غير صالح' }); return null; }
  const student = await User.findOne({ _id: id, role: 'student' }).select('_id name');
  if (!student) { res.status(404).json({ error: 'الطالب غير موجود' }); return null; }
  return student;
}

function olderThan(message, prefix = '') {
  return { $or: [{ [`${prefix}createdAt`]: { $lt: message.createdAt } }, { [`${prefix}createdAt`]: message.createdAt, [`${prefix}_id`]: { $lt: message._id } }] };
}

router.get('/inbox', authorize('admin'), async (req, res, next) => {
  try {
    const before = req.query.before;
    if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ error: 'مؤشر الصفحة غير صالح' });
    const cursor = before ? await Message.findById(before).select('_id createdAt').lean() : null;
    if (before && !cursor) return res.status(404).json({ error: 'مؤشر الصفحة غير موجود' });
    const rows = await Message.aggregate([
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: '$student', latest: { $first: '$$ROOT' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$senderRole', 'student'] }, { $eq: ['$readAt', null] }] }, 1, 0] } } } },
      ...(cursor ? [{ $match: olderThan(cursor, 'latest.') }] : []),
      { $sort: { 'latest.createdAt': -1, 'latest._id': -1 } }, { $limit: 51 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $project: { _id: 0, student: { _id: '$student._id', name: '$student.name' }, latest: 1, unread: 1 } },
    ]);
    res.json({ conversations: rows.slice(0, 50), nextBefore: rows.length > 50 ? String(rows[49].latest._id) : null });
  } catch (error) { next(error); }
});

router.get('/me/unread', authorize('student'), async (req, res, next) => {
  try { res.json({ unread: await Message.countDocuments({ student: req.user.id, senderRole: 'admin', readAt: null }) }); }
  catch (error) { next(error); }
});

router.get('/:studentId/messages', async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    const before = req.query.before;
    if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ error: 'مؤشر الصفحة غير صالح' });
    const cursor = before ? await Message.findOne({ _id: before, student: student._id }).select('_id createdAt').lean() : null;
    if (before && !cursor) return res.status(404).json({ error: 'مؤشر الصفحة غير موجود' });
    const [rows, unread] = await Promise.all([
      Message.find({ student: student._id, ...(cursor ? olderThan(cursor) : {}) }).sort({ createdAt: -1, _id: -1 }).limit(51).lean(),
      Message.countDocuments({ student: student._id, senderRole: req.user.role === 'admin' ? 'student' : 'admin', readAt: null }),
    ]);
    res.json({ student, messages: rows.slice(0, 50).reverse(), unread, nextBefore: rows.length > 50 ? String(rows[49]._id) : null });
  } catch (error) { next(error); }
});

router.put('/:studentId/read', async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    const through = req.body.through;
    if (!mongoose.isValidObjectId(through)) return res.status(400).json({ error: 'معرّف الرسالة غير صالح' });
    const messageIds = req.body.messageIds;
    if (!Array.isArray(messageIds) || !messageIds.length || messageIds.length > 50 || !messageIds.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) return res.status(400).json({ error: 'حدد الرسائل المعروضة فقط لتسجيل قراءتها' });
    const last = await Message.exists({ _id: through, student: student._id });
    if (!last) return res.status(404).json({ error: 'الرسالة غير موجودة' });
    const observed = await Message.find({ student: student._id, _id: { $in: messageIds }, senderRole: req.user.role === 'admin' ? 'student' : 'admin' }).select('_id').lean();
    const observedIds = observed.map((m) => m._id);
    await Message.updateMany({ student: student._id, _id: { $in: observedIds }, readAt: null }, { $set: { readAt: new Date() } });
    const readers = req.user.role === 'admin' ? await User.find({ role: 'admin' }).select('_id').lean() : [{ _id: req.user.id }];
    await Notification.updateMany({ user: { $in: readers.map((u) => u._id) }, type: 'support-message', 'data.metadata.studentId': String(student._id), 'data.supportMessage': { $in: observedIds }, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    await Promise.all(readers.map((u) => publishRealtimeNotification(u._id, { type: 'notifications-changed' })));
    const recipients = req.user.role === 'admin' ? [student] : await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
    await Promise.all(recipients.map((u) => publishRealtimeNotification(u._id, { type: 'support-updated', studentId: String(student._id) })));
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/:studentId/messages', sendLimiter, async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    const { text, clientId } = req.body;
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000 || typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)) {
      return res.status(400).json({ error: 'اكتب رسالة من 1 إلى 2000 حرف مع معرّف إرسال صالح' });
    }
    if (req.user.role === 'student') {
      const profileQuery = User.findById(student._id);
      const safetyProfile = typeof profileQuery?.select === 'function'
        ? await profileQuery.select('age enrollmentSection').lean()
        : await profileQuery;
      const rawAge = safetyProfile?.age;
      const parsedAge = rawAge !== undefined && rawAge !== null && rawAge !== '' ? Number(rawAge) : NaN;
      const isMinorOrUnverifiedAge =
        safetyProfile?.enrollmentSection === 'children'
        || !Number.isFinite(parsedAge)
        || parsedAge < 18;

      if (isMinorOrUnverifiedAge) {
        const safety = inspectChatSafety(text.trim());
        if (!safety.isSafe) {
          return res.status(400).json({
            error: safety.warning,
            code: 'CHAT_SAFETY_VIOLATION',
            reason: safety.reason,
          });
        }
      } else if (containsExternalLink(text.trim())) {
        return res.status(400).json({
          error: SAFETY_WARNING_MESSAGE,
          code: 'CHAT_SAFETY_VIOLATION',
          reason: 'url',
        });
      }
    }
    let message;
    try {
      message = await Message.findOneAndUpdate({ sender: req.user.id, clientId }, { $setOnInsert: { student: student._id, senderRole: req.user.role, text: text.trim() } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      message = await Message.findOne({ sender: req.user.id, clientId });
    }
    if (String(message.student) !== String(student._id) || message.text !== text.trim()) return res.status(409).json({ error: 'معرّف الإرسال مستخدم لرسالة أخرى' });
    const recipients = req.user.role === 'admin' ? [student] : await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
    // Upserts make retrying an uncertain send safe for both the message and its notifications.
    await Promise.all(recipients.map(async (recipient) => {
      const admin = req.user.role === 'student';
      let notice;
      const noticeFilter = { user: recipient._id, 'data.supportMessage': message._id };
      try { notice = await Notification.findOneAndUpdate(noticeFilter, { $setOnInsert: {
        type: 'support-message', title: { ar: admin ? `رسالة من ${student.name}` : 'رسالة من الإدارة', en: admin ? 'New student message' : 'New administration message' },
        message: { ar: message.text.slice(0, 140), en: message.text.slice(0, 140) }, status: 'sent',
        data: { supportMessage: message._id, metadata: { studentId: String(student._id) }, actionUrl: admin ? `/admin?tab=messages&student=${student._id}` : '/student/dashboard?tab=support' },
      } }, { upsert: true, new: true, runValidators: true }); }
      catch (error) { if (error.code !== 11000) throw error; notice = await Notification.findOne(noticeFilter); }
      // A reader can open the chat between saving the message and saving its notice.
      const receipt = await Message.findById(message._id).select('readAt').lean();
      if (receipt?.readAt && !notice.isRead) { notice.isRead = true; notice.readAt = receipt.readAt; await notice.save(); }
      await publishRealtimeNotification(recipient._id, { type: 'notification', notification: notice.toObject() });
    }));
    await publishRealtimeNotification(req.user.id, { type: 'support-updated', studentId: String(student._id) });
    res.status(201).json({ message });
  } catch (error) { next(error); }
});
module.exports = router;
