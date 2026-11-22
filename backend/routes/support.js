const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/SupportMessage');
const Notification = require('../models/Notification');
const objectStorage = require('../services/objectStorage');
const { PURPOSES, normalizeContentType } = require('../config/uploadPolicy');
const { validateMagicBytes } = require('../utils/magicBytes');
const { publishRealtimeNotification } = require('../services/realtimeNotificationBus');
const { SAFETY_WARNING_MESSAGE, containsExternalLink, inspectChatSafety } = require('../utils/chatSafety');
const router = express.Router();

const SUPPORT_AUDIO_ROOT = path.resolve(process.cwd(), 'uploads', 'support-audio');
const SUPPORT_MEDIA_ROOT = path.resolve(process.cwd(), 'uploads', 'support-media');
const ALLOWED_AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac', 'mp4']);
const ALLOWED_MEDIA_EXTS = new Set(['jpg', 'jpeg', 'jfif', 'png', 'webp', 'mp4', 'webm', 'mov']);
const SAFE_AUDIO_STREAM_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
]);
const SAFE_MEDIA_STREAM_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function canonicalAudioMime(rawMime) {
  const normalized = normalizeContentType(rawMime);
  if (normalized === 'audio/m4a' || normalized === 'audio/x-m4a') return 'audio/mp4';
  return normalized;
}

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(3.5 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).toLowerCase().replace('.', '');
    const normalizedMime = normalizeContentType(file.mimetype);
    if (ALLOWED_AUDIO_EXTS.has(ext) && PURPOSES['support-audio'].types.includes(normalizedMime)) {
      cb(null, true);
    } else {
      cb(new Error('صيغة الملف الصوتي غير مدعومة'));
    }
  },
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(3.5 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).toLowerCase().replace('.', '');
    const normalizedMime = normalizeContentType(file.mimetype);
    if (ALLOWED_MEDIA_EXTS.has(ext) && PURPOSES['support-media'].types.includes(normalizedMime)) {
      cb(null, true);
    } else {
      cb(new Error('صيغة الصورة أو الفيديو غير مدعومة'));
    }
  },
});

async function storeSupportBinary({ buffer, originalname, contentType, studentId, bucket = 'support-audio' }) {
  const driver = objectStorage.getDriver();
  const defaultExt = bucket === 'support-media' ? '.jpg' : '.m4a';
  const safeExt = path.extname(String(originalname || defaultExt)).toLowerCase().replace(/[^.a-z0-9]/g, '') || defaultExt;
  const prefix = bucket === 'support-media' ? 'media' : 'voice';
  const key = objectStorage.createObjectKey(`${bucket}/${String(studentId)}`, `${prefix}${safeExt}`);

  if (driver === 'vercel-blob') {
    const { put } = require('@vercel/blob');
    const result = await put(key, buffer, {
      access: 'private',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return result.url;
  }

  if (driver === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = objectStorage.getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    const endpoint = String(process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/+$/, '');
    return endpoint ? `${endpoint}/${key}` : key;
  }

  const rootDir = bucket === 'support-media' ? SUPPORT_MEDIA_ROOT : SUPPORT_AUDIO_ROOT;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
  const fullPath = path.join(rootDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

async function readRemoteHeaderSlice(reference) {
  const temp = await objectStorage.createTemporaryReadUrl(reference, { expiresIn: 120 });
  if (!temp?.url) return null;
  const response = await fetch(temp.url, {
    method: 'GET',
    headers: { Range: 'bytes=0-63' },
    signal: AbortSignal.timeout(7000),
    redirect: 'follow',
  });
  if (!response.ok && response.status !== 206) {
    if (response.body) await response.body.cancel().catch(() => {});
    return null;
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const arr = new Uint8Array(await response.arrayBuffer());
    return Buffer.from(arr.subarray(0, 64));
  }
  const chunks = [];
  let total = 0;
  try {
    while (total < 64) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, 64);
}

async function streamSupportAttachment(req, res, reference, fallbackMime = 'image/jpeg') {
  if (!reference) return res.status(404).json({ error: 'الملف غير موجود' });

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

  if (/^https?:\/\//i.test(reference)) {
    // Use short-lived signed URL redirect for private object storage so large videos
    // stream directly with full HTTP Range seeking without hitting serverless payload caps.
    const signed = await objectStorage.createTemporaryReadUrl(reference, { expiresIn: 15 * 60 }).catch(() => null);
    if (signed?.url) {
      if (String(req.query?.mode || '').toLowerCase() === 'json') {
        return res.json({ url: signed.url, mimeType: fallbackMime, expiresAt: signed.expiresAt });
      }
      return res.redirect(302, signed.url);
    }

    const result = await objectStorage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });
    if (!result) return res.status(404).json({ error: 'الملف غير موجود' });
    if (result.statusCode === 304) return res.status(304).end();

    const rawMime = normalizeContentType(result.blob?.contentType || fallbackMime);
    res.setHeader('Content-Type', SAFE_MEDIA_STREAM_TYPES.has(rawMime) ? rawMime : 'application/octet-stream');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

    if (result.stream?.pipe) return result.stream.pipe(res);
    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(404).json({ error: 'الملف غير موجود' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  }

  const absolute = path.resolve(reference);
  if (!absolute.startsWith(SUPPORT_MEDIA_ROOT + path.sep) || !fs.existsSync(absolute)) {
    return res.status(404).json({ error: 'الملف غير موجود' });
  }
  const safeMime = SAFE_MEDIA_STREAM_TYPES.has(normalizeContentType(fallbackMime))
    ? normalizeContentType(fallbackMime)
    : 'application/octet-stream';
  res.setHeader('Content-Type', safeMime);
  return res.sendFile(absolute);
}

async function storeSupportAudio({ buffer, originalname, contentType, studentId }) {
  return storeSupportBinary({ buffer, originalname, contentType, studentId, bucket: 'support-audio' });
}

async function streamSupportAudio(req, res, reference, fallbackMime = 'audio/mp4') {
  if (!reference) return res.status(404).json({ error: 'الملف الصوتي غير موجود' });

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

  if (/^https?:\/\//i.test(reference)) {
    const result = await objectStorage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });
    if (!result) return res.status(404).json({ error: 'الملف الصوتي غير موجود' });
    if (result.statusCode === 304) return res.status(304).end();

    const rawMime = canonicalAudioMime(result.blob?.contentType || fallbackMime);
    res.setHeader('Content-Type', SAFE_AUDIO_STREAM_TYPES.has(rawMime) ? rawMime : 'audio/mp4');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

    if (result.stream?.pipe) return result.stream.pipe(res);
    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(404).json({ error: 'الملف الصوتي غير موجود' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  }

  const absolute = path.resolve(reference);
  if (!absolute.startsWith(SUPPORT_AUDIO_ROOT + path.sep) || !fs.existsSync(absolute)) {
    return res.status(404).json({ error: 'الملف الصوتي غير موجود' });
  }
  const safeMime = SAFE_AUDIO_STREAM_TYPES.has(normalizeContentType(fallbackMime))
    ? normalizeContentType(fallbackMime)
    : 'audio/mp4';
  res.setHeader('Content-Type', safeMime);
  return res.sendFile(absolute);
}

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
      { $project: { _id: 0, student: { _id: '$student._id', name: '$student.name' }, latest: { _id: '$latest._id', senderRole: '$latest.senderRole', text: '$latest.text', hasAudio: '$latest.hasAudio', audioDuration: '$latest.audioDuration', hasAttachment: '$latest.hasAttachment', attachmentType: '$latest.attachmentType', attachmentName: '$latest.attachmentName', readAt: '$latest.readAt', createdAt: '$latest.createdAt' }, unread: 1 } },
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

router.get('/:studentId/messages/:messageId/audio', async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ error: 'معرّف الرسالة غير صالح' });
    }
    const msg = await Message.findOne({
      _id: req.params.messageId,
      student: student._id,
      hasAudio: true,
    }).select('+audioPath audioMimeType').lean();
    if (!msg || !msg.audioPath) {
      return res.status(404).json({ error: 'الملف الصوتي غير موجود' });
    }
    return streamSupportAudio(req, res, msg.audioPath, msg.audioMimeType);
  } catch (error) { next(error); }
});

router.get('/:studentId/messages/:messageId/attachment', async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ error: 'معرّف الرسالة غير صالح' });
    }
    const msg = await Message.findOne({
      _id: req.params.messageId,
      student: student._id,
      hasAttachment: true,
    }).select('+attachmentPath attachmentMimeType attachmentType').lean();
    if (!msg || !msg.attachmentPath) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }
    return streamSupportAttachment(req, res, msg.attachmentPath, msg.attachmentMimeType);
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

router.post('/:studentId/audio', sendLimiter, (req, res, next) => {
  audioUpload.single('audio')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'تعذر رفع الملف الصوتي' });
    return next();
  });
}, async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ error: 'يرجى إرفاق تسجيل صوتي صالح' });
    }
    const clientId = String(req.body?.clientId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)) {
      return res.status(400).json({ error: 'معرّف إرسال غير صالح' });
    }

    const normalizedMime = canonicalAudioMime(req.file.mimetype);
    const magicCheck = validateMagicBytes(req.file.buffer.subarray(0, 64), normalizedMime);
    if (!magicCheck.valid) {
      return res.status(400).json({ error: 'توقيع الملف الصوتي غير صالح', code: 'INVALID_FILE_MAGIC_BYTES' });
    }

    const durationSeconds = Math.min(300, Math.max(1, Math.round(Number(req.body?.durationSeconds) || 1)));
    const rawCaption = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 500) : '';
    const caption = rawCaption || 'رسالة صوتية';

    const storedRef = await storeSupportAudio({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      contentType: normalizedMime,
      studentId: student._id,
    });

    let message;
    try {
      message = await Message.findOneAndUpdate(
        { sender: req.user.id, clientId },
        {
          $setOnInsert: {
            student: student._id,
            senderRole: req.user.role,
            text: caption,
            hasAudio: true,
            audioDuration: durationSeconds,
            audioMimeType: normalizedMime,
            audioPath: storedRef,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      message = await Message.findOne({ sender: req.user.id, clientId });
    }

    const safeMessage = message.toObject ? message.toObject() : { ...message };
    delete safeMessage.audioPath;

    const recipients = req.user.role === 'admin'
      ? [student]
      : await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
    await Promise.all(recipients.map(async (recipient) => {
      const toAdmin = req.user.role === 'student';
      let notice;
      const noticeFilter = { user: recipient._id, 'data.supportMessage': message._id };
      try {
        notice = await Notification.findOneAndUpdate(noticeFilter, {
          $setOnInsert: {
            type: 'support-message',
            title: { ar: toAdmin ? `رسالة صوتية من ${student.name}` : 'رسالة صوتية من الإدارة', en: toAdmin ? 'New student voice note' : 'New admin voice note' },
            message: { ar: `🎤 ${caption}`, en: `🎤 ${caption}` },
            status: 'sent',
            data: { supportMessage: message._id, metadata: { studentId: String(student._id) }, actionUrl: toAdmin ? `/admin?tab=messages&student=${student._id}` : '/student/dashboard?tab=support' },
          },
        }, { upsert: true, new: true, runValidators: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        notice = await Notification.findOne(noticeFilter);
      }
      await publishRealtimeNotification(recipient._id, { type: 'notification', notification: notice.toObject() });
    }));
    await publishRealtimeNotification(req.user.id, { type: 'support-updated', studentId: String(student._id) });

    res.status(201).json({ message: safeMessage });
  } catch (error) { next(error); }
});

router.post('/:studentId/media', sendLimiter, (req, res, next) => {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('multipart/form-data')) return next();
  mediaUpload.single('media')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'تعذر رفع الصورة أو الفيديو' });
    return next();
  });
}, async (req, res, next) => {
  try {
    const student = await studentFor(req, res); if (!student) return;
    const clientId = String(req.body?.clientId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)) {
      return res.status(400).json({ error: 'معرّف إرسال غير صالح' });
    }

    let storedRef = '';
    let resolvedMime = '';
    let attachmentName = '';

    if (req.file && req.file.buffer?.length) {
      resolvedMime = normalizeContentType(req.file.mimetype);
      if (!SAFE_MEDIA_STREAM_TYPES.has(resolvedMime)) {
        return res.status(400).json({ error: 'صيغة الصورة أو الفيديو غير مدعومة' });
      }
      const magicCheck = validateMagicBytes(req.file.buffer.subarray(0, 64), resolvedMime);
      if (!magicCheck.valid) {
        return res.status(400).json({ error: 'توقيع الملف غير صالح', code: 'INVALID_FILE_MAGIC_BYTES' });
      }
      attachmentName = String(req.file.originalname || 'attachment').trim().slice(0, 180);
      storedRef = await storeSupportBinary({
        buffer: req.file.buffer,
        originalname: attachmentName,
        contentType: resolvedMime,
        studentId: student._id,
        bucket: 'support-media',
      });
    } else if (typeof req.body?.attachmentUrl === 'string' && req.body.attachmentUrl.trim()) {
      const candidateUrl = req.body.attachmentUrl.trim();
      resolvedMime = normalizeContentType(req.body?.attachmentMimeType);
      if (!SAFE_MEDIA_STREAM_TYPES.has(resolvedMime)) {
        return res.status(400).json({ error: 'صيغة الصورة أو الفيديو غير مدعومة' });
      }
      if (!objectStorage.isOwnedObjectReference(candidateUrl, 'support-media', String(req.user.id))) {
        return res.status(400).json({ error: 'مرجع الملف غير مصرح به', code: 'INVALID_UPLOAD_REFERENCE' });
      }
      const headerSlice = await readRemoteHeaderSlice(candidateUrl).catch(() => null);
      if (!headerSlice || !headerSlice.length) {
        return res.status(400).json({ error: 'تعذر التحقق من الملف المرفوع' });
      }
      const magicCheck = validateMagicBytes(headerSlice, resolvedMime);
      if (!magicCheck.valid) {
        return res.status(400).json({ error: 'توقيع الملف غير صالح', code: 'INVALID_FILE_MAGIC_BYTES' });
      }
      storedRef = candidateUrl;
      attachmentName = String(req.body?.attachmentName || 'attachment').trim().slice(0, 180);
    } else {
      return res.status(400).json({ error: 'يرجى اختيار صورة أو فيديو للإرسال' });
    }

    const attachmentType = resolvedMime.startsWith('video/') ? 'video' : 'image';
    const rawCaption = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 500) : '';
    const caption = rawCaption || (attachmentType === 'video' ? 'مرفق فيديو' : 'مرفق صورة');

    let message;
    try {
      message = await Message.findOneAndUpdate(
        { sender: req.user.id, clientId },
        {
          $setOnInsert: {
            student: student._id,
            senderRole: req.user.role,
            text: caption,
            hasAttachment: true,
            attachmentType,
            attachmentMimeType: resolvedMime,
            attachmentName,
            attachmentPath: storedRef,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      message = await Message.findOne({ sender: req.user.id, clientId });
    }

    const safeMessage = message.toObject ? message.toObject() : { ...message };
    delete safeMessage.attachmentPath;
    delete safeMessage.audioPath;

    const icon = attachmentType === 'video' ? '🎬' : '📷';
    const recipients = req.user.role === 'admin'
      ? [student]
      : await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
    await Promise.all(recipients.map(async (recipient) => {
      const toAdmin = req.user.role === 'student';
      let notice;
      const noticeFilter = { user: recipient._id, 'data.supportMessage': message._id };
      try {
        notice = await Notification.findOneAndUpdate(noticeFilter, {
          $setOnInsert: {
            type: 'support-message',
            title: {
              ar: toAdmin
                ? `${attachmentType === 'video' ? 'فيديو' : 'صورة'} من ${student.name}`
                : `${attachmentType === 'video' ? 'فيديو' : 'صورة'} من الإدارة`,
              en: toAdmin ? 'New student attachment' : 'New admin attachment',
            },
            message: { ar: `${icon} ${caption}`, en: `${icon} ${caption}` },
            status: 'sent',
            data: { supportMessage: message._id, metadata: { studentId: String(student._id) }, actionUrl: toAdmin ? `/admin?tab=messages&student=${student._id}` : '/student/dashboard?tab=support' },
          },
        }, { upsert: true, new: true, runValidators: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        notice = await Notification.findOne(noticeFilter);
      }
      await publishRealtimeNotification(recipient._id, { type: 'notification', notification: notice.toObject() });
    }));
    await publishRealtimeNotification(req.user.id, { type: 'support-updated', studentId: String(student._id) });

    res.status(201).json({ message: safeMessage });
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
