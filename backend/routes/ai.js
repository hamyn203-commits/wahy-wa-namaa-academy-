const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const aiService = require('../services/aiService');
const objectStorage = require('../services/objectStorage');
const RecitationReport = require('../models/RecitationReport');
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const TeacherTask = require('../models/TeacherTask');
const GroupCircle = require('../models/GroupCircle');
const Progress = require('../models/Progress');
const { validateMagicBytes } = require('../utils/magicBytes');

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
]);

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 1500;
const ALLOWED_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);

function sanitizeLocale(value) {
  const clean = String(value || 'ar').trim().toLowerCase();
  return ALLOWED_LOCALES.has(clean) ? clean : 'ar';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DIRECT_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIMES.has(mime)) {
      return cb(new Error('Unsupported audio format'));
    }
    return cb(null, true);
  },
});

async function readPrivateStreamToBuffer(stream, maxBytes = MAX_AUDIO_BYTES) {
  if (!stream) throw new Error('Audio stream unavailable');
  if (Buffer.isBuffer(stream)) {
    if (stream.length > maxBytes) throw new Error('Audio file exceeds maximum size');
    return stream;
  }

  const chunks = [];
  let total = 0;

  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('Audio file exceeds maximum size');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  for await (const part of stream) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('Audio file exceeds maximum size');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

router.post('/quran-assistant', protect, async (req, res) => {
  try {
    const { question, locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) return res.status(400).json({ error: 'Question is required' });
    if (cleanQuestion.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: 'Question is too long' });
    }

    const result = await aiService.chat(cleanQuestion, { locale: safeLoc, role: 'quran' });
    res.json({
      answer: result.text,
      sources: ['Quran', 'Authentic Tafsir'],
      confidence: result.fallback ? 0.6 : 0.9,
      provider: result.provider,
    });
  } catch {
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

router.post('/teacher-assistant', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { prompt, locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanPrompt = String(prompt || 'Suggest a lesson plan for today Quran class').trim();
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: 'Prompt is too long' });
    }

    const result = await aiService.chat(cleanPrompt, { locale: safeLoc, role: 'teacher' });

    res.json({
      suggestions: result.text.split('\n').filter(Boolean).slice(0, 6),
      lessonPlan: result.text,
      provider: result.provider,
    });
  } catch {
    res.status(500).json({ error: 'Failed to process teacher assistant request' });
  }
});

router.post('/student-assistant', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const { goal, level, locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanGoal = String(goal || 'memorization').trim().slice(0, 200);
    const cleanLevel = String(level || 'beginner').trim().slice(0, 60);
    const result = await aiService.chat(
      `Daily plan for student. Goal: ${cleanGoal}. Level: ${cleanLevel}. Return structured daily tasks.`,
      { locale: safeLoc, role: 'student' }
    );

    res.json({
      dailyPlan: [
        { task: safeLoc === 'ar' ? 'مراجعة حفظ الأمس' : 'Review yesterday', duration: 15 },
        { task: safeLoc === 'ar' ? 'حفظ جديد (5 آيات)' : 'New memorization (5 ayat)', duration: 30 },
        { task: safeLoc === 'ar' ? 'تدريب تجويد' : 'Tajweed practice', duration: 15 },
      ],
      aiNotes: result.text,
      goal: cleanGoal,
      level: cleanLevel,
      provider: result.provider,
    });
  } catch {
    res.status(500).json({ error: 'Failed to process student assistant request' });
  }
});

router.post('/recitation-analyze', protect, authorize('student', 'teacher', 'admin'), (req, res, next) => {
  const contentTypeHeader = String(req.headers['content-type'] || '').toLowerCase();
  if (contentTypeHeader.includes('application/json')) {
    return next();
  }
  upload.single('audio')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid audio upload' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    const storageRef = req.body?.storageRef || req.body?.blobUrl || req.body?.objectKey || '';
    if ((!req.file || !req.file.buffer) && storageRef) {
      if (!objectStorage.isOwnedObjectReference(storageRef, 'recitation-audio', req.user.id)) {
        return res.status(403).json({
          error: 'Audio reference does not belong to current user',
          code: 'INVALID_AUDIO_STORAGE_REF',
        });
      }
      const privateObj = await objectStorage.getPrivateObject(storageRef);
      if (!privateObj || !privateObj.stream) {
        return res.status(404).json({ error: 'Uploaded audio object not found', code: 'AUDIO_OBJECT_NOT_FOUND' });
      }
      const declaredMime = String(req.body?.contentType || privateObj.blob?.contentType || '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_AUDIO_MIMES.has(declaredMime)) {
        return res.status(400).json({ error: 'Unsupported audio format' });
      }
      const buffer = await readPrivateStreamToBuffer(privateObj.stream, MAX_AUDIO_BYTES);
      req.file = {
        buffer,
        mimetype: declaredMime,
        originalname: String(req.body?.filename || 'recitation.webm').slice(0, 120),
        size: buffer.length,
      };
    }

    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Audio file required' });
    const mime = String(req.file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    const magicCheck = validateMagicBytes(req.file.buffer, mime);
    if (!magicCheck.valid) {
      return res.status(400).json({ error: 'Audio file content does not match declared MIME type', code: 'INVALID_AUDIO_MAGIC_BYTES' });
    }
    const { locale = 'ar', surah = '' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanSurah = String(surah || '').trim().slice(0, 120);
    const report = await aiService.analyzeRecitation(req.user.id, req.file, { locale: safeLoc, surah: cleanSurah });
    res.json(report);
  } catch {
    res.status(500).json({ error: 'Failed to analyze recitation' });
  }
});

router.get('/recitation-reports', protect, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const reports = await RecitationReport.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ reports });
  } catch {
    res.status(500).json({ error: 'Failed to load recitation reports' });
  }
});

router.get('/recitation-reports/:reportId', protect, async (req, res) => {
  try {
    const reportId = String(req.params.reportId || '').trim().slice(0, 80);
    const orConditions = [{ reportId }];
    if (mongoose.Types.ObjectId.isValid(reportId)) {
      orConditions.push({ _id: reportId });
    }
    const report = await RecitationReport.findOne({
      $or: orConditions,
      user: req.user.id,
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch {
    res.status(500).json({ error: 'Failed to load recitation report' });
  }
});

router.post('/homework-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { topic, level, count = 5, locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanTopic = String(topic || '').trim().slice(0, 300);
    const cleanLevel = String(level || 'beginner').trim().slice(0, 60);
    const safeCount = Math.min(20, Math.max(1, parseInt(count, 10) || 5));
    const result = await aiService.generateHomework({ topic: cleanTopic, level: cleanLevel, count: safeCount, locale: safeLoc });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to generate homework' });
  }
});

router.post('/exam-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { topic, questionCount = 5, locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanTopic = String(topic || '').trim().slice(0, 300);
    const safeCount = Math.min(20, Math.max(1, parseInt(questionCount, 10) || 5));
    const result = await aiService.generateExam({ topic: cleanTopic, questionCount: safeCount, locale: safeLoc });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to generate exam' });
  }
});

router.post('/reports-generate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { studentId, period = 'monthly', locale = 'ar' } = req.body || {};
    const safeLoc = sanitizeLocale(locale);
    const cleanStudentId = String(studentId || '').trim();
    if (!cleanStudentId || !mongoose.Types.ObjectId.isValid(cleanStudentId)) {
      return res.status(400).json({ error: 'Valid studentId is required', code: 'INVALID_STUDENT_ID' });
    }

    let teacherScopeFilter = {};
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id').lean();
      if (!teacher) {
        return res.status(403).json({ error: 'Teacher profile not found' });
      }
      const [hasSession, hasCircle] = await Promise.all([
        Session.exists({
          teacher: teacher._id,
          $or: [{ student: cleanStudentId }, { 'attendance.student': cleanStudentId }],
        }),
        GroupCircle.exists({ teacher: teacher._id, students: cleanStudentId }),
      ]);
      if (!hasSession && !hasCircle) {
        return res.status(403).json({
          error: 'You can only generate reports for your assigned students',
          code: 'TEACHER_STUDENT_SCOPE_VIOLATION',
        });
      }
      teacherScopeFilter = { teacher: teacher._id };
    }

    const cleanPeriod = String(period || 'monthly').slice(0, 40);
    const days = cleanPeriod === 'weekly' ? 7 : cleanPeriod === 'quarterly' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [sessions, tasks, progressDocs] = await Promise.all([
      Session.find({
        ...teacherScopeFilter,
        scheduledAt: { $gte: since },
        status: { $in: ['completed', 'missed'] },
        $or: [{ student: cleanStudentId }, { 'attendance.student': cleanStudentId }],
      })
        .select('student status attendance teacherEvaluation studentReports')
        .lean(),
      TeacherTask.find({
        ...teacherScopeFilter,
        student: cleanStudentId,
        createdAt: { $gte: since },
      })
        .select('status')
        .lean(),
      Progress.find({ student: cleanStudentId })
        .select('overallProgress')
        .lean(),
    ]);

    let attendedCount = 0;
    let totalTrackedSessions = sessions.length;
    const scores = [];

    for (const s of sessions) {
      const att = (s.attendance || []).find((a) => a?.student && String(a.student) === cleanStudentId);
      if (att) {
        if (att.status === 'excused') {
          totalTrackedSessions = Math.max(0, totalTrackedSessions - 1);
        } else if (att.status === 'attended') {
          attendedCount += 1;
        }
      } else if (s.status === 'completed') {
        attendedCount += 1;
      }

      const studentRep = (s.studentReports || []).find((r) => r?.student && String(r.student) === cleanStudentId);
      if (studentRep) {
        if (typeof studentRep.memorizationScore === 'number') scores.push(studentRep.memorizationScore * 10);
        if (typeof studentRep.tajweedScore === 'number') scores.push(studentRep.tajweedScore * 10);
      } else if (s.teacherEvaluation) {
        if (typeof s.teacherEvaluation.memorizationScore === 'number') scores.push(s.teacherEvaluation.memorizationScore * 10);
        if (typeof s.teacherEvaluation.tajweedScore === 'number') scores.push(s.teacherEvaluation.tajweedScore * 10);
      }
    }

    const attendance = totalTrackedSessions > 0
      ? Math.round((attendedCount / totalTrackedSessions) * 100)
      : 0;

    const completedTasks = tasks.filter((t) => t.status === 'done' || t.status === 'submitted').length;
    const homeworkCompletion = tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;

    const progress = progressDocs.length > 0
      ? Math.round(
          progressDocs.reduce((sum, p) => sum + Number(p.overallProgress?.percentage || 0), 0) / progressDocs.length
        )
      : 0;

    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((sum, val) => sum + val, 0) / scores.length)
      : 0;

    res.json({
      studentId: cleanStudentId,
      period: cleanPeriod,
      windowDays: days,
      counts: {
        sessionsEvaluated: totalTrackedSessions,
        sessionsAttended: attendedCount,
        tasksAssigned: tasks.length,
        tasksCompleted: completedTasks,
      },
      summary: {
        attendance,
        progress,
        homeworkCompletion,
        averageScore,
      },
      generatedAt: new Date().toISOString(),
      note: safeLoc === 'ar'
        ? `تقرير فعلي مستخرج من سجلات الحلقات والواجبات لآخر ${days} يوماً`
        : `Live academic report aggregated over the last ${days} days`,
    });
  } catch {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/status', protect, authorize('admin'), (_req, res) => {
  const providers = aiService.getAiProviders();
  const active = providers.chain.find((p) => p !== 'local' && providers[p]);
  res.json({
    ...providers,
    mode: active ? 'cloud' : 'local-fallback',
    activeProvider: active || 'local',
  });
});

module.exports = router;
