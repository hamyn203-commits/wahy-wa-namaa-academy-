const mongoose = require('mongoose');
const { publishRealtimeNotification } = require('../services/realtimeNotificationBus');

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'course-enrollment',
      'lesson-completed',
      'assignment-due',
      'assignment-graded',
      'quiz-available',
      'quiz-result',
      'badge-unlocked',
      'achievement',
      'certificate-issued',
      'session-request',
      'session-accepted',
      'session-rejected',
      'session-completed',
      'session-reminder',
      'session-cancelled',
      'session-rescheduled',
      'session-chat-message',
      'support-message',
      'homework-assigned',
      'homework-submitted',
      'review-received',
      'teacher-update',
      'payment-received',
      'system',
      'marketing'
    ],
    required: true
  },
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String },
    de: { type: String },
    tr: { type: String },
    ur: { type: String },
    id: { type: String },
    ms: { type: String }
  },
  message: {
    ar: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String },
    de: { type: String },
    tr: { type: String },
    ur: { type: String },
    id: { type: String },
    ms: { type: String }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: {
    inApp: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    email: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    push: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    telegram: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    sms: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    }
  },
  data: {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment'
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    },
    certificate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Certificate'
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session'
    },
    url: String,
    actionUrl: String,
    supportMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportMessage' },
    imageUrl: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  expiresAt: Date,
  scheduledAt: Date,
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'expired'],
    default: 'pending'
  }
}, {
  timestamps: true
});

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, 'data.supportMessage': 1 }, { unique: true, partialFilterExpression: { 'data.supportMessage': { $exists: true } } });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, type: 1 });
NotificationSchema.index({ scheduledAt: 1 });
NotificationSchema.index({ expiresAt: 1 });
NotificationSchema.index({ status: 1 });

NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

NotificationSchema.methods.send = async function(channel) {
  if (!this.channels[channel] || !this.channels[channel].enabled) {
    return false;
  }

  try {
    switch (channel) {
      case 'inApp':
        this.channels.inApp.sent = true;
        this.channels.inApp.sentAt = new Date();
        break;
      
      case 'email':
        const emailSent = await this.sendEmail();
        this.channels.email.sent = emailSent;
        this.channels.email.sentAt = emailSent ? new Date() : null;
        break;
      
      case 'push':
        const pushSent = await this.sendPush();
        this.channels.push.sent = pushSent;
        this.channels.push.sentAt = pushSent ? new Date() : null;
        break;
      
      case 'telegram':
        const telegramSent = await this.sendTelegram();
        this.channels.telegram.sent = telegramSent;
        this.channels.telegram.sentAt = telegramSent ? new Date() : null;
        break;
      
      case 'sms':
        const smsSent = await this.sendSMS();
        this.channels.sms.sent = smsSent;
        this.channels.sms.sentAt = smsSent ? new Date() : null;
        break;
    }

    const allSent = Object.values(this.channels).every(ch => !ch.enabled || ch.sent);
    if (allSent) {
      this.status = 'sent';
    }

    await this.save();
    return true;
  } catch (error) {
    console.error(`Send ${channel} error:`, error);
    this.channels[channel].error = error.message;
    this.status = 'failed';
    await this.save();
    return false;
  }
};

const dispatcher = require('../services/notificationDispatcher');

NotificationSchema.methods.sendEmail = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  if (!user?.email) throw new Error('User email not found');

  const result = await dispatcher.sendEmail({
    to: user.email,
    subject: this.title.en || this.title.ar,
    text: this.message.en || this.message.ar,
  });
  if (!result?.sent) throw new Error(`Email delivery unavailable (${result?.provider || 'unknown'})`);
  return true;
};

NotificationSchema.methods.sendPush = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  if (!user?.pushToken) throw new Error('User push token not found');

  const result = await dispatcher.sendPush({
    token: user.pushToken,
    title: this.title.ar || this.title.en,
    body: this.message.ar || this.message.en,
    data: { notificationId: String(this._id), type: this.type },
  });
  if (!result?.sent) throw new Error(`Push delivery unavailable (${result?.provider || 'unknown'})`);
  return true;
};

NotificationSchema.methods.sendTelegram = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  if (!user?.telegramId) throw new Error('User telegram ID not found');

  const result = await dispatcher.sendTelegram({
    chatId: user.telegramId,
    text: `<b>${this.title.ar || this.title.en}</b>\n${this.message.ar || this.message.en}`,
  });
  if (!result?.sent) throw new Error(`Telegram delivery unavailable (${result?.provider || 'unknown'})`);
  return true;
};

NotificationSchema.methods.sendSMS = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  if (!user?.phone) throw new Error('User phone not found');

  const result = await dispatcher.sendWhatsApp({
    phone: user.phone,
    text: `${this.title.ar || this.title.en}\n${this.message.ar || this.message.en}`,
  });
  if (!result?.sent) throw new Error(`WhatsApp delivery unavailable (${result?.provider || 'unknown'})`);
  return true;
};

NotificationSchema.statics.createAndSend = async function(userId, notificationData) {
  const notification = new this({
    user: userId,
    ...notificationData
  });

  await notification.save();

  // Persist and deliver inside the app first. External channels must never
  // delay the user's in-app alert.
  if (notification.channels.inApp?.enabled) {
    await notification.send('inApp');
  }

  await publishRealtimeNotification(userId, {
    type: 'notification',
    notification: {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      createdAt: notification.createdAt,
    },
  });

  for (const channel of ['email', 'push', 'telegram', 'sms']) {
    if (notification.channels[channel]?.enabled) {
      await notification.send(channel);
    }
  }

  return notification;
};

NotificationSchema.statics.sendBulk = async function(userIds, notificationData) {
  const notifications = userIds.map(userId => ({
    user: userId,
    ...notificationData
  }));

  const created = await this.insertMany(notifications);

  for (const notification of created) {
    if (notification.channels.inApp?.enabled) {
      await notification.send('inApp');
    }

    await publishRealtimeNotification(notification.user, {
      type: 'notification',
      notification: {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        createdAt: notification.createdAt,
      },
    });

    for (const channel of ['email', 'push', 'telegram', 'sms']) {
      if (notification.channels[channel]?.enabled) {
        await notification.send(channel);
      }
    }
  }

  return created;
};

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;

