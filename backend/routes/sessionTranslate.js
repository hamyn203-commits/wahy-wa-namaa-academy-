const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router({ mergeParams: true });
const Session = require('../models/Session');
const SessionChatMessage = require('../models/SessionChatMessage');
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/auth');
const { createScopedRateLimiter } = require('../middleware/userRateLimit');
const { translateBatch, SUPPORTED } = require('../services/translateService');
const objectStorage = require('../services/objectStorage');
const { validateUploadMetadata } = require('../config/uploadPolicy');
const { notifyUser } = require('../utils/notify');
const { canAccessSession } = require('../utils/sessionChatAccess');
const { inspectChatSafety } = require('../utils/chatSafety');

const sessionChatLimiter = createScopedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  scope: 'session-chat-post',
  message: 'Too many chat messages. Please slow down.',
});

function audioMessageUrl(sessionId, messageId) {
  return `/api/sessions/${sessionId}/translate/messages/${messageId}/audio`;
}

function chatChannels() {
  return {
    inApp: { enabled: true },
    email: { enabled: false },
    push: { enabled: false },
    telegram: { enabled: false },
    sms: { enabled: false },
  };
}

async function notifyOtherParticipant(session, senderId, kind) {
  let targetUserId = null;

  const senderIsStudent = String(session.student?._id || session.student) === String(senderId);

  if (senderIsStudent) {
    targetUserId = session.teacher?.user?._id || session.teacher?.user || null;
  } else if (session.teacher?.user) {
    targetUserId = session.student?._id || session.student || null;
  }

  if (!targetUserId || String(targetUserId) === String(senderId)) return;

  await notifyUser(targetUserId, {
    type: 'session-chat-message',
    title: { ar: 'رسالة جديدة بخصوص الحصة', en: 'New session message' },
    message: {
      ar: kind === 'audio' ? 'لديك رسالة صوتية جديدة داخل محادثة الحصة.' : 'لديك رسالة جديدة داخل محادثة الحصة.',
      en: kind === 'audio' ? 'You have a new voice note in the session chat.' : 'You have a new message in the session chat.',
    },
    data: {
      session: session._id,
      actionUrl: senderIsStudent
        ? `/teacher/dashboard?session=${session._id}`
        : `/student/dashboard?session=${session._id}`,
    },
    priority: 'medium',
    channels: chatChannels(),
  });
}

router.get('/languages', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('student', 'name preferences')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name preferences' } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!(await canAccessSession(session, req.user.id, req.user.role, { allowGuardianRead: true }))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const studentLang = session.student?.preferences?.language || 'id';
    const teacherLang = session.teacher?.user?.preferences?.language || 'ar';

    return res.json({
      student: { name: session.student?.name, lang: studentLang },
      teacher: { name: session.teacher?.user?.name, lang: teacherLang },
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/messages', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!(await canAccessSession(session, req.user.id, req.user.role, { allowGuardianRead: true }))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const since = req.query.since ? new Date(req.query.since) : null;
    const filter = { session: session._id };
    if (since && !Number.isNaN(since.getTime())) filter.createdAt = { $gt: since };

    const messages = await SessionChatMessage.find(filter)
      .select('+audio.reference')
      .sort({ createdAt: 1 })
      .limit(100);

    const myLang = req.query.lang || req.user.preferences?.language || 'ar';

    return res.json({
      messages: messages.map((message) => {
        const trans = message.translations instanceof Map
          ? Object.fromEntries(message.translations)
          : (message.translations || {});

        return {
          _id: message._id,
          userName: message.userName,
          kind: message.kind || 'text',
          text: message.text,
          lang: message.lang,
          translation: message.kind === 'text' ? (trans[myLang] || message.text) : '',
          audioUrl: message.kind === 'audio' && message.audio?.reference
            ? audioMessageUrl(session._id, message._id)
            : null,
          audioContentType: message.audio?.contentType || null,
          audioDurationSeconds: message.audio?.durationSeconds || 0,
          createdAt: message.createdAt,
          isMe: String(message.user) === req.user.id,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/messages', protect, sessionChatLimiter, async (req, res) => {
  try {
    if (req.user.role === 'guardian') {
      return res.status(403).json({ error: 'Guardian chat access is read-only' });
    }
    const {
      text,
      lang,
      kind = 'text',
      storageFile,
      durationSeconds = 0,
    } = req.body || {};

    if (!['text', 'audio'].includes(kind)) {
      return res.status(400).json({ error: 'Unsupported chat message type' });
    }

    const session = await Session.findById(req.params.id)
      .populate('student', 'name preferences')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name preferences' } });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!(await canAccessSession(session, req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (session.status !== 'accepted') {
      return res.status(409).json({
        error: 'Session chat is open only for accepted sessions',
        code: 'SESSION_CHAT_CLOSED',
      });
    }

    const fromLang = SUPPORTED.includes(lang) ? lang : (req.user.preferences?.language || 'ar');
    let cleanText = '';
    let translationsMap = {};
    let audio = undefined;

    if (kind === 'text') {
      cleanText = String(text || '').trim();
      if (!cleanText) return res.status(400).json({ error: 'Text required' });
      if (cleanText.length > 1000) return res.status(400).json({ error: 'Message is too long' });

      const safety = inspectChatSafety(cleanText);
      if (!safety.isSafe) {
        return res.status(400).json({
          error: safety.warning,
          code: 'CHAT_SAFETY_VIOLATION',
          reason: safety.reason,
        });
      }

      const studentLang = session.student?.preferences?.language || 'id';
      const teacherLang = session.teacher?.user?.preferences?.language || 'ar';
      const targets = [...new Set([studentLang, teacherLang].filter((code) => SUPPORTED.includes(code)))];
      translationsMap = await translateBatch(cleanText, fromLang, targets);
    } else {
      if (!storageFile?.url || !storageFile?.name || !storageFile?.contentType || !storageFile?.size) {
        return res.status(400).json({ error: 'Voice note upload is required' });
      }

      if (!objectStorage.isOwnedObjectReference(
        storageFile.url,
        'session-chat-audio',
        req.user.id
      )) {
        return res.status(400).json({
          error: 'Voice note does not belong to this user',
          code: 'CHAT_AUDIO_OWNERSHIP_INVALID',
        });
      }

      validateUploadMetadata({
        purpose: 'session-chat-audio',
        role: req.user.role,
        filename: storageFile.name,
        contentType: storageFile.contentType,
        size: storageFile.size,
      });

      const numericDuration = Number(durationSeconds || 0);
      if (!Number.isFinite(numericDuration) || numericDuration < 0 || numericDuration > 120) {
        return res.status(400).json({ error: 'Voice note duration is invalid' });
      }

      audio = {
        reference: storageFile.url,
        contentType: storageFile.contentType,
        size: Number(storageFile.size),
        durationSeconds: numericDuration,
      };
    }

    const message = await SessionChatMessage.create({
      session: session._id,
      user: req.user.id,
      userName: req.user.name,
      kind,
      text: cleanText,
      lang: fromLang,
      translations: translationsMap,
      audio,
    });

    notifyOtherParticipant(session, req.user.id, kind).catch((error) => {
      console.warn('Session chat notification failed:', error.message);
    });

    return res.status(201).json({
      _id: message._id,
      userName: message.userName,
      kind: message.kind,
      text: message.text,
      lang: message.lang,
      translations: translationsMap,
      audioUrl: kind === 'audio' ? audioMessageUrl(session._id, message._id) : null,
      audioDurationSeconds: kind === 'audio' ? audio.durationSeconds : 0,
      createdAt: message.createdAt,
      isMe: true,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/messages/:messageId/audio', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!(await canAccessSession(session, req.user.id, req.user.role, { allowGuardianRead: true }))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await SessionChatMessage.findOne({
      _id: req.params.messageId,
      session: session._id,
      kind: 'audio',
    }).select('+audio.reference');

    if (!message?.audio?.reference) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    const result = await objectStorage.getPrivateObject(message.audio.reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });

    if (!result) return res.status(404).end();
    if (result.statusCode === 304) return res.status(304).end();

    res.setHeader('Content-Type', result.blob?.contentType || message.audio.contentType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

    if (result.stream?.pipe) {
      return result.stream.pipe(res);
    }

    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(500).end();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    console.error('Session voice note stream failed:', error.message);
    return res.status(404).end();
  }
});

module.exports = router;
