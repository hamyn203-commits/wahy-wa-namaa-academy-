const crypto = require('crypto');
const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const GroupCircle = require('../models/GroupCircle');
const { protect, authorize } = require('../middleware/auth');
const { createScopedRateLimiter } = require('../middleware/userRateLimit');
const { createUserRealtimeToken, isRealtimeConfigured, publishRealtimeNotification } = require('../services/realtimeNotificationBus');
router.use(protect, rateLimit({ windowMs: 15 * 60 * 1000, max: 900, keyGenerator: (req) => req.user.id, standardHeaders: true, legacyHeaders: false, skip: () => process.env.DISABLE_RATE_LIMIT === 'true' }));

const realtimeTokenLimiter = createScopedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  scope: 'realtime-notify-token',
  message: 'Too many realtime token requests. Please try again later.',
});

// @route   GET /api/notifications/realtime-token
// @desc    Get a short-lived LiveKit data-only token for instant in-app events
// @access  Private
router.get('/realtime-token', protect, realtimeTokenLimiter, async (req, res) => {
  try {
    if (!isRealtimeConfigured()) {
      return res.status(503).json({ error: 'Realtime notifications are not configured' });
    }
    const connection = await createUserRealtimeToken(req.user.id);
    return res.json(connection);
  } catch (error) {
    console.error('Realtime notification token error:', error);
    return res.status(500).json({ error: 'Failed to create realtime notification connection' });
  }
});

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { 
      limit = 20, 
      unreadOnly = false, 
      type,
      page = 1 
    } = req.query;

    const filter = { user: req.user.id };
    
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }
    
    if (typeof type === 'string' && type) {
      filter.type = type;
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const pageNumber = Math.min(10000, Math.max(1, parseInt(page) || 1));
    const skip = (pageNumber - 1) * pageSize;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('data.course', 'title slug')
        .populate('data.lesson', 'title')
        .populate('data.assignment', 'title')
        .populate('data.quiz', 'title')
        .populate('data.badge', 'name icon')
        .populate('data.certificate', 'certificateId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Notification.countDocuments(filter)
    ]);

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false
    });

    res.json({
      notifications,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.markAsRead();
    await publishRealtimeNotification(req.user.id, { type: 'notifications-changed' });

    res.json(notification);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    await publishRealtimeNotification(req.user.id, { type: 'notifications-changed' });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   DELETE /api/notifications/clear-all
// @desc    Delete all notifications
// @access  Private
router.delete('/clear-all', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user.id });

    await publishRealtimeNotification(req.user.id, { type: 'notifications-changed' });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear all error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await publishRealtimeNotification(req.user.id, { type: 'notifications-changed' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences
// @access  Private
router.put('/preferences', protect, async (req, res) => {
  try {
    const { preferences } = req.body || {};

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const safeUpdates = {};
    if (preferences && typeof preferences === 'object') {
      for (const key of ['email', 'push', 'telegram', 'sms']) {
        if (typeof preferences[key] === 'boolean') {
          safeUpdates[key] = preferences[key];
        }
      }
    }

    user.preferences = user.preferences || {};
    user.preferences.notifications = {
      ...(user.preferences.notifications || {}),
      ...safeUpdates,
    };

    await user.save();

    res.json({ preferences: user.preferences.notifications });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/notifications/preferences
// @desc    Get notification preferences
// @access  Private
router.get('/preferences', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      preferences: user.preferences?.notifications || {
        email: true,
        push: true,
        telegram: true,
        sms: false,
      },
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// @route   POST /api/notifications/push-token
// @desc    Register push notification token
// @access  Private
router.post('/push-token', protect, async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    const cleanToken = typeof token === 'string' ? token.trim() : '';
    const cleanPlatform = String(platform || 'web').trim().toLowerCase();
    if (!cleanToken || cleanToken.length > 512) {
      return res.status(400).json({ error: 'Valid push token is required' });
    }
    if (!['web', 'ios', 'android'].includes(cleanPlatform)) {
      return res.status(400).json({ error: 'Unsupported push platform' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.pushToken = cleanToken;
    user.pushPlatform = cleanPlatform;
    await user.save();

    res.json({ message: 'Push token registered' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   POST /api/notifications/telegram-id
// @desc    Register Telegram ID (requires verified bot binding token)
// @access  Private
router.post('/telegram-id', protect, async (req, res) => {
  try {
    const { telegramId, bindingToken } = req.body || {};
    const cleanTelegramId = String(telegramId || '').trim();
    if (!/^-?\d{5,20}$/.test(cleanTelegramId)) {
      return res.status(400).json({ error: 'Invalid Telegram chat ID' });
    }

    if (req.user.role !== 'admin') {
      const secret = process.env.TELEGRAM_BINDING_SECRET || process.env.TELEGRAM_BOT_TOKEN;
      if (!secret || typeof bindingToken !== 'string' || !bindingToken.trim()) {
        return res.status(403).json({
          error: 'يتطلب ربط تلغرام رمز تحقق صادر من بوت الأكاديمية الرسمي',
          code: 'TELEGRAM_BINDING_VERIFICATION_REQUIRED',
        });
      }
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${req.user.id}:${cleanTelegramId}`)
        .digest('hex');
      const providedBuf = Buffer.from(bindingToken.trim(), 'utf8');
      const expectedBuf = Buffer.from(expected, 'utf8');
      if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        return res.status(403).json({
          error: 'رمز ربط تلغرام غير صالح',
          code: 'INVALID_TELEGRAM_BINDING_TOKEN',
        });
      }
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.telegramId = cleanTelegramId;
    await user.save();

    res.json({ message: 'Telegram ID registered' });
  } catch (error) {
    console.error('Register telegram ID error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

const TEACHER_ALLOWED_NOTIFICATION_TYPES = new Set([
  'teacher-update',
  'homework-assigned',
  'session-reminder',
]);
const ADMIN_ALLOWED_NOTIFICATION_TYPES = new Set([
  'system',
  'marketing',
  'teacher-update',
  'homework-assigned',
  'session-reminder',
  'course-enrollment',
  'payment-received',
]);
const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const LOCALIZED_KEYS = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms'];

function normalizeLocalizedField(input, maxLength) {
  if (typeof input === 'string') {
    const trimmed = input.trim().slice(0, maxLength);
    if (!trimmed) return null;
    return { ar: trimmed, en: trimmed };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const result = {};
  for (const locale of LOCALIZED_KEYS) {
    if (typeof input[locale] === 'string' && input[locale].trim()) {
      result[locale] = input[locale].trim().slice(0, maxLength);
    }
  }
  const fallback = result.ar || result.en || Object.values(result)[0];
  if (!fallback) return null;
  if (!result.ar) result.ar = fallback;
  if (!result.en) result.en = fallback;
  return result;
}

function sanitizeManualNotificationPayload(rawNotification, { role }) {
  if (!rawNotification || typeof rawNotification !== 'object' || Array.isArray(rawNotification)) {
    throw new Error('Notification payload object is required');
  }

  const title = normalizeLocalizedField(rawNotification.title, 200);
  const message = normalizeLocalizedField(rawNotification.message, 2000);
  if (!title || !message) {
    throw new Error('Notification title and message are required');
  }

  const defaultType = role === 'admin' ? 'system' : 'teacher-update';
  const requestedType = rawNotification.type ? String(rawNotification.type).trim() : defaultType;
  const allowedTypes = role === 'admin' ? ADMIN_ALLOWED_NOTIFICATION_TYPES : TEACHER_ALLOWED_NOTIFICATION_TYPES;
  if (!allowedTypes.has(requestedType)) {
    throw new Error('Unsupported notification type for this role');
  }

  const priority = rawNotification.priority ? String(rawNotification.priority).trim() : 'medium';
  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new Error('Invalid notification priority');
  }

  const channels = {
    inApp: { enabled: true },
  };
  if (role === 'admin' && rawNotification.channels && typeof rawNotification.channels === 'object') {
    for (const channelName of ['inApp', 'email', 'push', 'telegram', 'sms']) {
      if (typeof rawNotification.channels[channelName]?.enabled === 'boolean') {
        channels[channelName] = { enabled: rawNotification.channels[channelName].enabled };
      }
    }
  }

  const data = {};
  if (rawNotification.data && typeof rawNotification.data === 'object' && !Array.isArray(rawNotification.data)) {
    for (const urlKey of ['url', 'actionUrl']) {
      const candidate = rawNotification.data[urlKey];
      if (candidate !== undefined) {
        if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
          throw new Error(`Notification ${urlKey} must be an internal relative path`);
        }
        data[urlKey] = candidate.slice(0, 500);
      }
    }
  }

  return {
    type: requestedType,
    title,
    message,
    priority,
    channels,
    ...(Object.keys(data).length ? { data } : {}),
  };
}

async function getTeacherAllowedStudentIds(userId) {
  const teacher = await Teacher.findOne({ user: userId }).select('_id');
  if (!teacher) return null;

  const [directStudents, attendanceStudents, circles] = await Promise.all([
    Session.find({
      teacher: teacher._id,
      status: { $in: ['accepted', 'completed'] },
      student: { $ne: null },
    }).distinct('student'),
    Session.find({
      teacher: teacher._id,
      status: { $in: ['accepted', 'completed'] },
      'attendance.student': { $ne: null },
    }).distinct('attendance.student'),
    GroupCircle.find({
      teacher: teacher._id,
      status: 'active',
    }).select('students'),
  ]);

  const allowed = new Set();
  for (const id of directStudents) {
    if (id) allowed.add(String(id));
  }
  for (const id of attendanceStudents) {
    if (id) allowed.add(String(id));
  }
  for (const circle of circles) {
    for (const id of circle.students || []) {
      if (id) allowed.add(String(id));
    }
  }
  return allowed;
}

// @route   POST /api/notifications/send
// @desc    Send notification (Admin/Teacher — teachers scoped strictly to their own students)
// @access  Private (Admin/Teacher)
router.post('/send', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { userIds, notification } = req.body || {};

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      return res.status(400).json({ error: 'userIds must be a non-empty array of at most 100 IDs' });
    }

    const uniqueUserIds = [...new Set(userIds.map((id) => String(id || '').trim()))];
    if (uniqueUserIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'All userIds must be valid user identifiers' });
    }

    const sanitizedNotification = sanitizeManualNotificationPayload(notification, {
      role: req.user.role,
    });

    if (req.user.role === 'teacher') {
      const allowedStudentIds = await getTeacherAllowedStudentIds(req.user.id);
      if (!allowedStudentIds) {
        return res.status(403).json({ error: 'Teacher profile not found' });
      }
      const unauthorizedTarget = uniqueUserIds.find((id) => !allowedStudentIds.has(id));
      if (unauthorizedTarget) {
        return res.status(403).json({
          error: 'Teachers can only notify their own active students',
          code: 'TEACHER_STUDENT_SCOPE_VIOLATION',
        });
      }
    }

    const notifications = await Notification.sendBulk(uniqueUserIds, sanitizedNotification);

    res.status(201).json({
      message: `Sent ${notifications.length} notifications`,
      notifications
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   POST /api/notifications/send-all
// @desc    Send notification to all users matching safe scalar filter (Admin only)
// @access  Private (Admin)
router.post('/send-all', protect, authorize('admin'), async (req, res) => {
  try {
    const { notification, filter = {} } = req.body || {};

    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      return res.status(400).json({ error: 'Invalid filter object' });
    }

    const allowedFilterKeys = new Set(['role', 'isActive']);
    for (const key of Object.keys(filter)) {
      if (!allowedFilterKeys.has(key)) {
        return res.status(400).json({ error: `Unsupported filter field: ${key}` });
      }
    }

    const safeFilter = {};
    if (filter.role !== undefined) {
      if (!['student', 'teacher', 'guardian', 'admin'].includes(filter.role)) {
        return res.status(400).json({ error: 'Invalid role filter' });
      }
      safeFilter.role = filter.role;
    }
    if (filter.isActive !== undefined) {
      if (typeof filter.isActive !== 'boolean') {
        return res.status(400).json({ error: 'Invalid isActive filter' });
      }
      safeFilter.isActive = filter.isActive;
    } else {
      safeFilter.isActive = true;
    }

    const sanitizedNotification = sanitizeManualNotificationPayload(notification, {
      role: 'admin',
    });

    const users = await User.find(safeFilter).select('_id');
    const userIds = users.map(u => u._id);

    const notifications = userIds.length
      ? await Notification.sendBulk(userIds, sanitizedNotification)
      : [];

    res.status(201).json({
      message: `Sent ${notifications.length} notifications`,
      count: notifications.length
    });
  } catch (error) {
    console.error('Send all error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/notifications/stats
// @desc    Get notification statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const total = await Notification.countDocuments({ user: req.user.id });
    const unread = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });
    const read = total - unread;
    const userObjectId = mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : req.user.id;

    const byType = await Notification.aggregate([
      { $match: { user: userObjectId } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const recent = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      total,
      unread,
      read,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recent
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;

